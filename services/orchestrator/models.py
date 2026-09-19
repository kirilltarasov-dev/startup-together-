from typing import Literal

from pydantic import BaseModel, Field

Mode = Literal["live", "cached", "mock"]
Phase = Literal[
    "queued", "running", "awaiting_verification", "succeeded", "failed", "needs_attention", "timed_out", "cancelled"
]
TERMINAL: set[str] = {"succeeded", "failed", "needs_attention", "timed_out", "cancelled"}
LogKind = Literal["info", "tool", "ok", "err"]
ErrorCode = Literal["provider_down", "credits", "auth", "timeout", "outside_allowed_paths", "internal"]

ALLOWED_INCIDENTS = {"optimize_feed"}


class CreateMission(BaseModel):
    runId: str = Field(min_length=1, max_length=128)
    incidentId: str
    idempotencyKey: str = Field(min_length=1, max_length=128)
    playerConstraint: str | None = None


class CreateMissionResponse(BaseModel):
    id: str
    phase: Phase
    mode: Mode
    attached: bool = False


class LogLine(BaseModel):
    t: float
    text: str
    kind: LogKind = "info"


class Tests(BaseModel):
    passed: int
    total: int
    ok: bool


class Benchmark(BaseModel):
    before: float
    after: float
    threshold: float
    unit: Literal["s"] = "s"
    samples: int
    ok: bool


class Verification(BaseModel):
    tests: Tests
    benchmark: Benchmark
    filesChanged: list[str]
    baselineCommit: str
    candidateCommit: str


class MissionResult(BaseModel):
    success: bool
    summary: str
    verification: Verification | None = None
    verifiedAt: str


class MissionError(BaseModel):
    code: ErrorCode
    message: str


class MissionStatus(BaseModel):
    id: str
    runId: str
    mode: Mode
    phase: Phase
    elapsedSec: float
    statusDetail: str | None = None
    sessionUrl: str | None = None
    log: list[LogLine] = []
    result: MissionResult | None = None
    error: MissionError | None = None
