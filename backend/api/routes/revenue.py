from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.revenue_agent import RevenueAgent
from utils.supabase import get_supabase_client


router = APIRouter(prefix="/agents/revenue", tags=["agents"])


class ResolveRevenueSignalRequest(BaseModel):
    resolution_note: str | None = None


@router.post("/run")
async def run_revenue_agent() -> dict:
    agent = RevenueAgent(get_supabase_client())
    return agent.run()


@router.get("/signals")
async def list_revenue_signals(
    severity: str | None = None,
    signal_type: str | None = None,
    limit: int = 100,
) -> dict:
    agent = RevenueAgent(get_supabase_client())
    return agent.list_signals(severity=severity, signal_type=signal_type, limit=limit)


@router.post("/resolve/{signal_id}")
async def resolve_revenue_signal(signal_id: str, payload: ResolveRevenueSignalRequest) -> dict:
    agent = RevenueAgent(get_supabase_client())
    signal = agent.resolve_signal(signal_id, payload.resolution_note)
    if not signal:
        raise HTTPException(status_code=404, detail="Revenue signal not found or already resolved.")
    return {"signal": signal}


@router.get("/summary")
async def get_revenue_summary() -> dict:
    agent = RevenueAgent(get_supabase_client())
    return agent.summary()
