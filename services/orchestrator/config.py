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
    max_acu_limit: int = int(os.environ.get("MAX_ACU_LIMIT", "3"))
    github_token: str = os.environ.get("GITHUB_TOKEN", "")
    work_dir: str = os.environ.get("WORK_DIR", "/tmp/runway-challenge")
    benchmark_threshold_sec: float = 0.5  # frozen, see docs/HANDOFF.md
    bench_users: int = int(os.environ.get("BENCH_USERS", "50000"))
    bench_posts_per_user: int = int(os.environ.get("BENCH_POSTS_PER_USER", "10"))
    bench_samples: int = int(os.environ.get("BENCH_N", "5"))
    runner_timeout_sec: int = int(os.environ.get("RUNNER_TIMEOUT_SEC", "120"))
    cache_file: str = os.environ.get("CACHE_FILE", os.path.join(os.path.dirname(__file__), "..", "..", "cache", "optimize_feed.json"))

    @property
    def repo_url(self) -> str:
        auth = f"x-access-token:{self.github_token}@" if self.github_token else ""
        return f"https://{auth}github.com/{self.challenge_repo}.git"

    @property
    def mode(self) -> Mode:
        forced = os.environ.get("ORCH_MODE", "").lower()
        if forced in {"live", "cached", "mock"}:
            return forced
        return "live" if self.devin_api_key else "mock"


settings = Settings()
