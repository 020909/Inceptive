from fastapi import APIRouter
from pydantic import BaseModel, Field

from jobs.service import DEFAULT_INTERVAL_MINUTES, get_status, upsert_schedule
from utils.supabase import get_supabase_client


router = APIRouter(prefix="/jobs", tags=["jobs"])


class ScheduleJobRequest(BaseModel):
    user_id: str
    agent_id: str = Field(default="churn_agent")
    enabled: bool = True
    interval_minutes: int = Field(default=DEFAULT_INTERVAL_MINUTES, ge=1)
    run_at: str | None = None
    timezone: str = "UTC"


@router.post("/schedule")
async def schedule_job(payload: ScheduleJobRequest) -> dict:
    schedule = upsert_schedule(
        get_supabase_client(),
        user_id=payload.user_id,
        agent_id=payload.agent_id,
        enabled=payload.enabled,
        interval_minutes=payload.interval_minutes,
        run_at=payload.run_at,
        timezone=payload.timezone,
    )
    return {"schedule": schedule}


@router.get("/status")
async def get_job_status(user_id: str | None = None, agent_id: str | None = None) -> dict:
    statuses = get_status(get_supabase_client(), user_id=user_id, agent_id=agent_id)
    return {"count": len(statuses), "jobs": statuses}
