from fastapi import APIRouter

from utils.settings import get_settings


router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "inceptive-backend",
        "environment": settings.app_env,
    }
