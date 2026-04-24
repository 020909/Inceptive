from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import churn
from api.routes import health
from api.routes import jobs
from api.routes import observability
from api.routes import revenue
from api.routes import vendor
from utils.settings import get_settings


settings = get_settings()

app = FastAPI(
    title="Inceptive Backend",
    description="Dedicated agent orchestration service for Inceptive.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(churn.router, prefix="/api")
app.include_router(revenue.router, prefix="/api")
app.include_router(vendor.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(observability.router, prefix="/api")
