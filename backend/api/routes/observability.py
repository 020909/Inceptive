from fastapi import APIRouter

from observability.tracer import fetch_recent_agent_traces


router = APIRouter(prefix="/observability", tags=["observability"])


@router.get("/traces")
async def get_recent_traces() -> dict:
    traces = fetch_recent_agent_traces(limit=20)
    return {
        "count": len(traces),
        "traces": traces,
    }
