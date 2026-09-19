"""Independent verifier. Fetches the candidate commit, validates it, and runs OUR tests + benchmark against it.

Isolation is process-level (clean env, temp dirs, timeouts) -- Railway offers no Docker-in-Docker.
The candidate's own tests/benchmark are never executed; only the copies in this package are.
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass

from config import settings

HERE = os.path.dirname(os.path.abspath(__file__))
TESTS_DIR = os.path.join(HERE, "tests")
BENCH = os.path.join(HERE, "benchmark_feed.py")


class VerifyError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass
class RunOutcome:
    tests_passed: int
    tests_total: int
    p95: float
    samples: int
    posts: int


def _git(*args: str, cwd: str | None = None) -> str:
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
    r = subprocess.run(["git", *args], cwd=cwd or settings.work_dir, capture_output=True, text=True, timeout=120, env=env)
    if r.returncode != 0:
        raise VerifyError("internal", f"git {args[0]} failed: {r.stderr.strip()[:200]}")
    return r.stdout.strip()


def ensure_repo() -> str:
    """Bare-ish mirror of the challenge repo under WORK_DIR. Returns resolved baseline SHA."""
    if not os.path.isdir(os.path.join(settings.work_dir, ".git")):
        os.makedirs(os.path.dirname(settings.work_dir) or "/", exist_ok=True)
        subprocess.run(["git", "clone", "--quiet", "--no-checkout", settings.repo_url, settings.work_dir],
                       check=True, capture_output=True, text=True, timeout=300,
                       env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})
    _git("fetch", "--quiet", "origin", "+refs/heads/*:refs/remotes/origin/*")
    return _git("rev-parse", settings.baseline_sha or "origin/main")


def fetch_devin_branches() -> None:
    _git("fetch", "--quiet", "--prune", "origin", "+refs/heads/devin/*:refs/remotes/origin/devin/*")


def resolve_candidate(preferred_sha: str | None, branch: str | None) -> str:
    """Prefer the commit Devin reported, then the mission branch tip, then the newest devin/* tip."""
    if preferred_sha:
        try:
            if _git("cat-file", "-t", preferred_sha) == "commit":
                return _git("rev-parse", preferred_sha)
        except VerifyError:
            pass
    if branch:
        try:
            return _git("rev-parse", f"refs/remotes/origin/{branch}")
        except VerifyError:
            pass
    out = _git("for-each-ref", "--sort=-committerdate", "--format=%(objectname)", "refs/remotes/origin/devin/")
    if not out:
        raise VerifyError("internal", "no devin/* branch found on the remote")
    return out.splitlines()[0]


def validate_candidate(baseline: str, candidate: str) -> list[str]:
    """Only Devin's own commits (fork point from origin/main .. candidate) are inspected, so teammates'
    unrelated pushes to main never cause a false rejection. The challenge folder at the fork point must
    still equal the frozen baseline, otherwise the measured "before" would not describe what Devin fixed."""
    if subprocess.run(["git", "merge-base", "--is-ancestor", baseline, candidate], cwd=settings.work_dir).returncode != 0:
        raise VerifyError("outside_allowed_paths", "candidate does not descend from the baseline commit")
    fork = _git("merge-base", "refs/remotes/origin/main", candidate)
    if subprocess.run(["git", "diff", "--quiet", baseline, fork, "--", settings.challenge_path],
                      cwd=settings.work_dir).returncode != 0:
        raise VerifyError("outside_allowed_paths", f"{settings.challenge_path}/ changed on main since baseline; refusing to verify")
    files = [f for f in _git("diff", "--name-only", f"{fork}..{candidate}").splitlines() if f]
    allowed = f"{settings.challenge_path}/backend/"
    bad = [f for f in files if not f.startswith(allowed)]
    if bad:
        raise VerifyError("outside_allowed_paths", f"candidate touches files outside {allowed}: {bad[:5]}")
    if not files:
        raise VerifyError("outside_allowed_paths", "candidate has no changes relative to main")
    return files


def _clean_env(tmp: str, pythonpath: str) -> dict[str, str]:
    """Minimal environment: no provider keys, no git credentials, no host secrets."""
    return {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": tmp, "TMPDIR": tmp, "LANG": "C.UTF-8",
        "PYTHONPATH": pythonpath, "PYTHONDONTWRITEBYTECODE": "1",
        "STARTUP_DB": os.path.join(tmp, "verify.db"),
        "BENCH_USERS": str(settings.bench_users),
        "BENCH_POSTS_PER_USER": str(settings.bench_posts_per_user),
        "BENCH_N": str(settings.bench_samples),
    }


def _run_isolated(cmd: list[str], env: dict[str, str], cwd: str, timeout: int) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise VerifyError("timeout", f"verifier step exceeded {timeout}s") from exc


def run_at_commit(commit: str) -> RunOutcome:
    """Export the challenge folder at `commit` into a temp dir and run verifier tests + benchmark against it."""
    tmp = tempfile.mkdtemp(prefix="runway-verify-")
    try:
        export_dir = os.path.join(tmp, "candidate")
        os.makedirs(export_dir)
        archive = subprocess.run(["git", "archive", commit, settings.challenge_path], cwd=settings.work_dir,
                                 capture_output=True, timeout=60)
        if archive.returncode != 0:
            raise VerifyError("internal", "git archive failed")
        subprocess.run(["tar", "-x", "-C", export_dir], input=archive.stdout, check=True, timeout=60)
        challenge = os.path.join(export_dir, settings.challenge_path)
        for junk in ("tests", "benchmark", "conftest.py", "pytest.ini", "pyproject.toml", "setup.cfg", "tox.ini"):
            path = os.path.join(challenge, junk)
            shutil.rmtree(path, ignore_errors=True) if os.path.isdir(path) else (os.path.exists(path) and os.remove(path))

        env = _clean_env(tmp, challenge)
        report = os.path.join(tmp, "report.json")
        pytest_cmd = [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "--rootdir", tmp,
                      "-o", "addopts=", TESTS_DIR, "--junitxml", report]
        r = _run_isolated(pytest_cmd, env, tmp, settings.runner_timeout_sec)
        passed, total = _parse_junit(report)
        if total == 0:
            raise VerifyError("internal", f"pytest produced no results: {r.stdout[-300:]}")

        b = _run_isolated([sys.executable, BENCH], env, tmp, settings.runner_timeout_sec)
        if b.returncode != 0:
            # Candidate crashed the benchmark: that is a legitimate failure, not an infra error.
            return RunOutcome(passed, total, p95=float("inf"), samples=0, posts=0)
        data = json.loads(b.stdout.strip().splitlines()[-1])
        return RunOutcome(passed, total, p95=float(data["p95"]), samples=int(data["n"]), posts=int(data["posts"]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _parse_junit(path: str) -> tuple[int, int]:
    if not os.path.exists(path):
        return 0, 0
    import xml.etree.ElementTree as ET
    root = ET.parse(path).getroot()
    suites = [root] if root.tag == "testsuite" else list(root)
    total = sum(int(s.get("tests", 0)) for s in suites)
    bad = sum(int(s.get("failures", 0)) + int(s.get("errors", 0)) + int(s.get("skipped", 0)) for s in suites)
    return total - bad, total


# ---- async facade used by missions.py -------------------------------------------------------

_baseline: dict | None = None
_lock = asyncio.Lock()


async def baseline() -> dict:
    """Measure the baseline once (tests + p95) and cache it. Raises VerifyError on infra problems."""
    global _baseline
    async with _lock:
        if _baseline is None:
            sha = await asyncio.to_thread(ensure_repo)
            out = await asyncio.to_thread(run_at_commit, sha)
            _baseline = {"sha": sha, "p95": out.p95, "tests": f"{out.tests_passed}/{out.tests_total}",
                         "samples": out.samples, "posts": out.posts}
        return _baseline


def baseline_cached() -> dict | None:
    return _baseline


async def verify_candidate(preferred_sha: str | None, branch: str | None) -> tuple[str, list[str], RunOutcome]:
    base = await baseline()
    await asyncio.to_thread(fetch_devin_branches)
    candidate = await asyncio.to_thread(resolve_candidate, preferred_sha, branch)
    files = await asyncio.to_thread(validate_candidate, base["sha"], candidate)
    outcome = await asyncio.to_thread(run_at_commit, candidate)
    return candidate, files, outcome
