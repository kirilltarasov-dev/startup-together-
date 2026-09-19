"""Thin adapter over the Devin v3 organization API. Normalizes provider details; never trusted for success."""
from dataclasses import dataclass

import httpx

from config import settings

STRUCTURED_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "root_cause": {"type": "string"},
        "files_changed": {"type": "array", "items": {"type": "string"}},
        "before_seconds": {"type": "number"},
        "after_seconds": {"type": "number"},
        "tests_passed": {"type": "integer"},
        "tests_total": {"type": "integer"},
        "branch": {"type": "string"},
        "commit_sha": {"type": "string"},
    },
    "required": ["root_cause", "files_changed", "branch", "commit_sha"],
}

# Suspension/error reasons -> our error codes (docs/DEVIN_CONTRACT.md)
CREDIT_DETAILS = {
    "usage_limit_exceeded", "out_of_credits", "out_of_quota", "no_quota_allocation", "payment_declined",
    "org_usage_limit_exceeded", "user_usage_limit_exceeded", "total_session_limit_exceeded",
}


def build_prompt(branch: str, constraint: str | None) -> str:
    repo, path = settings.challenge_repo, settings.challenge_path
    prompt = (
        f"You are the lead engineer of a fictional startup. Work ONLY inside the folder {path}/ of "
        f"repository {repo} (FastAPI + SQLite). Do not touch apps/, services/, docs/, or any file outside {path}/. "
        f"Production incident: GET /feed is extremely slow under load. The cause is inside {path}/backend/feed.py "
        "(full table scan, Python-side sort, per-post and per-like queries). Fix the bottleneck so that get_feed(limit) "
        "preserves exactly the same output shape, ordering (newest first), like counts and pro_likes semantics. "
        "Do not change tests/, benchmark/, the database schema, or the HTTP API. Run pytest and the benchmark from "
        f"inside {path}/ before and after. Push your work to a branch named {branch} and do NOT merge or open a PR "
        "against main. Finish with a summary containing: root_cause, files_changed, before_seconds, after_seconds, "
        "tests_passed, tests_total, branch, commit_sha."
    )
    if constraint:
        prompt += f"\n\nPLAYER CONSTRAINT: {constraint}"
    return prompt


@dataclass
class SessionView:
    session_id: str
    url: str | None
    status: str
    status_detail: str | None
    structured_output: dict | None

    @property
    def done(self) -> bool:
        return self.status == "exit" or (self.status == "running" and self.status_detail == "finished")

    @property
    def needs_human(self) -> bool:
        return self.status == "running" and self.status_detail in {"waiting_for_user", "waiting_for_approval"}

    def error_code(self) -> str | None:
        if self.status == "error":
            return "provider_down"
        if self.status == "suspended":
            return "credits" if self.status_detail in CREDIT_DETAILS else "provider_down"
        return None


class DevinClient:
    def __init__(self) -> None:
        if not settings.devin_api_key or not settings.devin_org_id:
            raise RuntimeError("DEVIN_API_KEY and DEVIN_ORG_ID are required for live mode")
        self.base = f"{settings.devin_api_url.rstrip('/')}/organizations/{settings.devin_org_id}/sessions"
        self.http = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {settings.devin_api_key}", "Content-Type": "application/json"},
            timeout=httpx.Timeout(30.0),
        )

    @staticmethod
    def _view(data: dict) -> SessionView:
        return SessionView(
            session_id=data.get("session_id") or data.get("id", ""),
            url=data.get("url"),
            status=data.get("status", "new"),
            status_detail=data.get("status_detail"),
            structured_output=data.get("structured_output"),
        )

    async def create(self, prompt: str, title: str) -> SessionView:
        body = {
            "prompt": prompt,
            "repos": [settings.challenge_repo],
            "title": title,
            "tags": ["runway"],
            "max_acu_limit": settings.max_acu_limit,
            "resumable": False,
            "structured_output_schema": STRUCTURED_OUTPUT_SCHEMA,
            "structured_output_required": True,
        }
        r = await self.http.post(self.base, json=body)
        r.raise_for_status()
        return self._view(r.json())

    async def get(self, session_id: str) -> SessionView:
        r = await self.http.get(f"{self.base}/{session_id}")
        r.raise_for_status()
        return self._view(r.json())

    async def terminate(self, session_id: str) -> None:
        try:
            await self.http.delete(f"{self.base}/{session_id}", params={"archive": "true"})
        except httpx.HTTPError:
            pass

    async def aclose(self) -> None:
        await self.http.aclose()
