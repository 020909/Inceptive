from fastapi import APIRouter

from agents.churn_agent import ChurnAgent
from memory.mem0_client import get_memories
from utils.supabase import get_supabase_client


router = APIRouter(prefix="/agents/churn", tags=["agents"])


@router.get("")
async def list_churn_signals() -> dict:
    agent = ChurnAgent(get_supabase_client())
    return agent.list_signals()


@router.post("/run")
async def run_churn_agent() -> dict:
    agent = ChurnAgent(get_supabase_client())
    return agent.run()


@router.get("/memories")
async def list_churn_memories(user_id: str, limit: int = 3) -> dict:
    memories = get_memories(
        user_id=user_id,
        agent_id="churn_agent",
        query="past churn scan results and churn risk history",
        scope="user",
        limit=max(1, min(limit, 10)),
    )
    return {"count": len(memories), "memories": memories}
