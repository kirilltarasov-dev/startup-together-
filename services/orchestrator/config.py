import os
from dataclasses import dataclass, field

Mode = str  # "live" | "cached" | "mock"


def _origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGIN", "")
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    return list(dict.fromkeys(["http://localhost:5173", "http://127.0.0.1:5173", *extra]))


@dataclass(frozen=True)
class Settings:
    devin_api_key: str = os.environ.get("DEVIN_API_KEY", "")
    devin_org_id: str = os.environ.get("DEVIN_ORG_ID", "")
    devin_api_url: str = os.environ.get("DEVIN_API_URL", "https://api.devin.ai/v3")
    challenge_repo: str = os.environ.get("CHALLENGE_REPO", "kirilltarasov-dev/startup-together-")
    challenge_path: str = os.environ.get("CHALLENGE_PATH", "startup-repo")
    baseline_sha: str = os.environ.get("BASELINE_SHA", "")
    orch_token: str = os.environ.get("ORCH_TOKEN", "")
    allowed_origins: list[str] = field(default_factory=_origins)
    mission_timeout_sec: int = int(os.environ.get("MISSION_TIMEOUT_SEC", "480"))
    benchmark_threshold_sec: float = 0.5  # frozen, see docs/HANDOFF.md
    cache_file: str = os.environ.get("CACHE_FILE", os.path.join(os.path.dirname(__file__), "..", "..", "cache", "optimize_feed.json"))

    @property
    def mode(self) -> Mode:
        forced = os.environ.get("ORCH_MODE", "").lower()
        if forced in {"live", "cached", "mock"}:
            return forced
        return "live" if self.devin_api_key else "mock"


settings = Settings()
