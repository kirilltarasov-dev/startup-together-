"""Mission lifecycle: in-memory registry, idempotency, single live mission, mock runner."""
import asyncio
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone

from config import settings
from models import (
    TERMINAL, Benchmark, LogKind, LogLine, MissionError, MissionResult, MissionStatus, Tests, Verification,
)

_SHELL_TOKENS = ("rm ", "curl", "sudo", "git push", "token", "key")
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)


class ConstraintRejected(ValueError):
    pass


def sanitize_constraint(raw: str | None) -> str | None:
    if not raw:
        return None
    text = _URL_RE.sub("", raw).replace("`", "").replace("\n", " ").replace("\r", " ")
    text = re.sub(r"\s+", " ", text).strip()[:200]
    lowered = text.lower()
    if any(tok in lowered for tok in _SHELL_TOKENS):
        raise ConstraintRejected("constraint contains disallowed tokens")
    return text or None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Mission:
    def __init__(self, run_id: str, incident_id: str, idem_key: str, constraint: str | None, mode: str):
        self.id = uuid.uuid4().hex[:12]
        self.run_id = run_id
        self.incident_id = incident_id
        self.idem_key = idem_key
        self.constraint = constraint
        self.mode = mode
        self.phase = "queued"
        self.started = time.monotonic()
        self.status_detail: str | None = None
        self.session_url: str | None = None
        self.log: list[LogLine] = []
        self.result: MissionResult | None = None
        self.error: MissionError | None = None
        self.task: asyncio.Task | None = None

    @property
    def terminal(self) -> bool:
        return self.phase in TERMINAL

    def add_log(self, text: str, kind: LogKind = "info") -> None:
        self.log.append(LogLine(t=round(time.monotonic() - self.started, 1), text=text, kind=kind))

    def set_phase(self, phase: str, detail: str | None = None) -> None:
        self.phase = phase
        if detail is not None:
            self.status_detail = detail

    def fail_attention(self, code: str, message: str) -> None:
        self.set_phase("needs_attention")
        self.error = MissionError(code=code, message=message)
        self.add_log(message, "err")

    def status(self) -> MissionStatus:
        return MissionStatus(
            id=self.id, runId=self.run_id, mode=self.mode, phase=self.phase,
            elapsedSec=round(time.monotonic() - self.started, 1), statusDetail=self.status_detail,
            sessionUrl=self.session_url, log=self.log, result=self.result, error=self.error,
        )


class Registry:
    def __init__(self) -> None:
        self.by_id: dict[str, Mission] = {}
        self.by_key: dict[str, Mission] = {}

    def get(self, mission_id: str) -> Mission | None:
        return self.by_id.get(mission_id)

    def active(self) -> Mission | None:
        return next((m for m in self.by_id.values() if not m.terminal), None)

    def create(self, run_id: str, incident_id: str, idem_key: str, constraint: str | None) -> tuple[Mission, bool]:
        """Returns (mission, attached). Never starts a second paid session for a known key or while one is live."""
        if existing := self.by_key.get(idem_key):
            return existing, True
        if live := self.active():
            return live, True
        mission = Mission(run_id, incident_id, idem_key, constraint, settings.mode)
        self.by_id[mission.id] = mission
        self.by_key[idem_key] = mission
        mission.task = asyncio.create_task(_run(mission))
        return mission, False

    async def cancel(self, mission_id: str) -> Mission | None:
        mission = self.get(mission_id)
        if mission and not mission.terminal:
            if mission.task:
                mission.task.cancel()
            mission.set_phase("cancelled")
            mission.add_log("cancelled by player", "err")
        return mission


registry = Registry()


async def _run(mission: Mission) -> None:
    try:
        if mission.mode == "mock":
            await run_mock(mission)
        elif mission.mode == "cached":
            await run_cached(mission)
        else:
            await run_live(mission)
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        mission.fail_attention("internal", f"orchestrator error: {type(exc).__name__}: {str(exc)[:160]}")


# ---- LIVE ------------------------------------------------------------------------------------

async def run_live(mission: Mission) -> None:
    from agents.devin import DevinClient, build_prompt
    from verifier import runner

    mission.add_log("measuring trusted baseline (verifier-owned tests + benchmark)", "tool")
    try:
        base = await runner.baseline()
    except runner.VerifyError as exc:
        return mission.fail_attention(exc.code, f"baseline unavailable: {exc}")
    mission.add_log(f"baseline {base['sha'][:7]}: tests {base['tests']}, p95 {base['p95']:.2f}s over {base['posts']:,} posts", "info")

    branch = f"devin/optimize-feed-{mission.id}"
    client = DevinClient()
    try:
        mission.add_log("creating Devin session")
        try:
            view = await client.create(build_prompt(branch, mission.constraint), title=f"RUNWAY mission {mission.id}")
        except Exception as exc:  # noqa: BLE001
            return mission.fail_attention(_http_code(exc), f"could not create Devin session: {_http_msg(exc)}")
        mission.session_url = view.url
        mission.set_phase("running", f"devin: {view.status}")
        mission.add_log(f"Devin session started: {view.session_id}", "ok")

        delay, last = 5.0, (view.status, view.status_detail)
        deadline = mission.started + settings.mission_timeout_sec
        while True:
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 15.0)
            if time.monotonic() > deadline:
                mission.add_log(f"application timeout after {settings.mission_timeout_sec}s; terminating session", "err")
                await client.terminate(view.session_id)
                mission.set_phase("timed_out", "devin: terminated by orchestrator")
                mission.error = MissionError(code="timeout", message="Devin did not finish within the mission timeout")
                return
            try:
                view = await client.get(view.session_id)
            except Exception as exc:  # noqa: BLE001
                mission.add_log(f"poll failed: {_http_msg(exc)}", "err")
                continue
            cur = (view.status, view.status_detail)
            if cur != last:
                last = cur
                mission.status_detail = f"devin: {view.status}" + (f" / {view.status_detail}" if view.status_detail else "")
                mission.add_log(mission.status_detail, "info")
            if view.needs_human:
                mission.add_log("Devin is waiting for input/approval; the orchestrator cannot answer", "err")
            if code := view.error_code():
                return mission.fail_attention(code, f"Devin session ended: {view.status} / {view.status_detail}")
            if view.done:
                break

        so = view.structured_output or {}
        mission.set_phase("awaiting_verification", "verifier: fetching candidate")
        mission.add_log("Devin reports done; running independent verification", "tool")
        try:
            candidate, files, out = await runner.verify_candidate(so.get("commit_sha"), so.get("branch") or branch)
        except runner.VerifyError as exc:
            if exc.code == "outside_allowed_paths":
                mission.set_phase("failed", "verifier: rejected")
                mission.error = MissionError(code=exc.code, message=str(exc))
                mission.add_log(str(exc), "err")
                return
            return mission.fail_attention(exc.code, f"verification infrastructure error: {exc}")

        tests_ok = out.tests_passed == out.tests_total and out.tests_total > 0
        bench_ok = out.p95 < settings.benchmark_threshold_sec
        mission.add_log(f"tests {out.tests_passed}/{out.tests_total}", "ok" if tests_ok else "err")
        mission.add_log(f"benchmark p95 {base['p95']:.2f}s -> {out.p95:.2f}s (threshold {settings.benchmark_threshold_sec}s)",
                        "ok" if bench_ok else "err")
        mission.result = MissionResult(
            success=tests_ok and bench_ok,
            summary=str(so.get("root_cause") or "Devin did not provide a structured summary."),
            verification=Verification(
                tests=Tests(passed=out.tests_passed, total=out.tests_total, ok=tests_ok),
                benchmark=Benchmark(before=round(base["p95"], 3), after=round(out.p95, 3) if out.p95 != float("inf") else 999.0,
                                    threshold=settings.benchmark_threshold_sec, samples=out.samples, ok=bench_ok),
                filesChanged=files, baselineCommit=base["sha"], candidateCommit=candidate,
            ),
            verifiedAt=now_iso(),
        )
        mission.set_phase("succeeded" if mission.result.success else "failed", "verifier: complete")
        mission.add_log("INCIDENT RESOLVED: independent verification passed" if mission.result.success
                        else "verification failed", "ok" if mission.result.success else "err")
        if mission.result.success:
            _save_cache(mission)
    finally:
        await client.aclose()


def _http_code(exc: Exception) -> str:
    import httpx
    if isinstance(exc, httpx.HTTPStatusError):
        s = exc.response.status_code
        return "auth" if s in (401, 403) else "credits" if s == 402 else "provider_down"
    return "provider_down"


def _http_msg(exc: Exception) -> str:
    import httpx
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}"
    return type(exc).__name__


def _save_cache(mission: Mission) -> None:
    """Persist an authentic run for CACHED REAL RUN mode. Also served via GET /api/missions/{id}/cache."""
    try:
        os.makedirs(os.path.dirname(settings.cache_file), exist_ok=True)
        with open(settings.cache_file, "w") as f:
            json.dump(cache_payload(mission), f, indent=2)
    except OSError:
        pass


def cache_payload(mission: Mission) -> dict:
    return {
        "log": [[line.t, line.text, line.kind] for line in mission.log],
        "result": mission.result.model_dump() if mission.result else None,
        "sessionUrl": mission.session_url,
        "recordedAt": now_iso(),
        "missionId": mission.id,
    }


# ---- CACHED REAL RUN ---------------------------------------------------------------------------

async def run_cached(mission: Mission) -> None:
    """Replay a genuine earlier run from cache/optimize_feed.json with its original timing (capped)."""
    if not os.path.exists(settings.cache_file):
        return mission.fail_attention("internal", "no cached real run exists yet (cache/optimize_feed.json missing)")
    with open(settings.cache_file) as f:
        data = json.load(f)
    mission.session_url = data.get("sessionUrl")
    mission.add_log(f"[CACHED REAL RUN] replaying mission recorded {data.get('recordedAt')}", "info")
    mission.set_phase("running", "cached: replay")
    prev = 0.0
    for t, text, kind in data["log"]:
        await asyncio.sleep(min(max(t - prev, 0.0), 6.0))
        prev = t
        mission.add_log(text, kind)
        if text.startswith("Devin reports done"):
            mission.set_phase("awaiting_verification", "cached: replay")
    result = data.get("result")
    mission.result = MissionResult(**result) if result else None
    mission.set_phase("succeeded" if result and result["success"] else "failed", "cached: replay complete")


async def run_mock(mission: Mission) -> None:
    """Deterministic simulated lifecycle. Clearly flagged mode=mock; nothing here is real engineering."""
    mission.add_log("[MOCK] mission accepted; no Devin session is created in mock mode")
    if mission.constraint:
        mission.add_log(f"[MOCK] player constraint recorded: {mission.constraint}")
    await asyncio.sleep(1)
    mission.set_phase("running", "mock: simulated session")
    mission.session_url = None
    for line, kind in [
        ("[MOCK] simulated provider status: running", "info"),
        ("[MOCK] simulated provider status: running / finished", "info"),
    ]:
        await asyncio.sleep(3)
        mission.add_log(line, kind)
    mission.set_phase("awaiting_verification", "mock: simulated verification")
    mission.add_log("[MOCK] simulated verifier: pytest + benchmark", "tool")
    await asyncio.sleep(3)
    mission.result = MissionResult(
        success=True,
        summary="[MOCK] Simulated fix: replaced per-post/per-like queries with a single joined query.",
        verification=Verification(
            tests=Tests(passed=9, total=9, ok=True),
            benchmark=Benchmark(before=2.31, after=0.19, threshold=settings.benchmark_threshold_sec, samples=12, ok=True),
            filesChanged=["startup-repo/backend/feed.py"],
            baselineCommit="mock-baseline",
            candidateCommit="mock-candidate",
        ),
        verifiedAt=now_iso(),
    )
    mission.set_phase("succeeded", "mock: complete")
    mission.add_log("[MOCK] simulated verification passed", "ok")
