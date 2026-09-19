"""Mission lifecycle: in-memory registry, idempotency, single live mission, mock runner."""
import asyncio
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
        else:
            # Live/cached runners land in later tasks (agents/devin.py, verifier/).
            mission.fail_attention("internal", f"mode '{mission.mode}' runner not implemented yet")
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        mission.fail_attention("internal", f"orchestrator error: {type(exc).__name__}")


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
