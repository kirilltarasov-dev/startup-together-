"""RUNWAY orchestrator: turns a "Send Devin" click into a real, independently verified mission."""
import logging
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from missions import ConstraintRejected, registry, sanitize_constraint
from models import ALLOWED_INCIDENTS, CreateMission, CreateMissionResponse, MissionStatus

log = logging.getLogger("orchestrator")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="RUNWAY orchestrator", version="0.1.0", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Runway-Key"],
)


@app.on_event("startup")
def _startup() -> None:
    if not settings.orch_token:
        log.warning("ORCH_TOKEN is not set: /api/* is UNPROTECTED (acceptable only for local dev)")
    log.info("mode=%s repo=%s path=%s baseline=%s", settings.mode, settings.challenge_repo,
             settings.challenge_path, settings.baseline_sha or "<unset>")


def require_key(x_runway_key: str | None = Header(default=None)) -> None:
    if not settings.orch_token:
        return
    if not x_runway_key or not secrets.compare_digest(x_runway_key, settings.orch_token):
        raise HTTPException(401, "missing or invalid X-Runway-Key")


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "mode": settings.mode}


@app.post("/api/missions", response_model=CreateMissionResponse, dependencies=[Depends(require_key)])
async def create_mission(body: CreateMission) -> CreateMissionResponse:
    if body.incidentId not in ALLOWED_INCIDENTS:
        raise HTTPException(400, f"unknown incidentId; allowed: {sorted(ALLOWED_INCIDENTS)}")
    try:
        constraint = sanitize_constraint(body.playerConstraint)
    except ConstraintRejected as exc:
        raise HTTPException(400, str(exc)) from exc
    mission, attached = registry.create(body.runId, body.incidentId, body.idempotencyKey, constraint)
    return CreateMissionResponse(id=mission.id, phase=mission.phase, mode=mission.mode, attached=attached)


@app.get("/api/missions/{mission_id}", response_model=MissionStatus, dependencies=[Depends(require_key)])
async def get_mission(mission_id: str) -> MissionStatus:
    mission = registry.get(mission_id)
    if not mission:
        raise HTTPException(404, "no such mission")
    return mission.status()


@app.post("/api/missions/{mission_id}/cancel", response_model=MissionStatus, dependencies=[Depends(require_key)])
async def cancel_mission(mission_id: str) -> MissionStatus:
    mission = await registry.cancel(mission_id)
    if not mission:
        raise HTTPException(404, "no such mission")
    return mission.status()
