from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")

    supabase_url: str = Field(
        validation_alias=AliasChoices("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    )
    supabase_service_role_key: str = Field(
        validation_alias=AliasChoices("SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    )
    supabase_db_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL"),
    )
    app_url: str = Field(default="https://app.inceptive-ai.com", alias="NEXT_PUBLIC_APP_URL")
    vercel_project_production_url: str | None = Field(
        default=None, alias="VERCEL_PROJECT_PRODUCTION_URL"
    )
    backend_cors_origins: str | None = Field(default=None, alias="BACKEND_CORS_ORIGINS")
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY"),
    )
    openai_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_BASE_URL", "OPENAI_API_BASE"),
    )
    openrouter_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENROUTER_KEY", "OPENROUTER_API_KEY", "OPENROUTER_DEFAULT_KEY"),
    )
    mem0_embedder_model: str = Field(default="text-embedding-3-small", alias="MEM0_EMBEDDER_MODEL")
    mem0_embedding_dims: int = Field(default=64, alias="MEM0_EMBEDDING_DIMS")
    langfuse_public_key: str | None = Field(default=None, alias="LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key: str | None = Field(default=None, alias="LANGFUSE_SECRET_KEY")
    langfuse_base_url: str = Field(default="https://cloud.langfuse.com", alias="LANGFUSE_BASE_URL")
    redis_url: str | None = Field(default=None, alias="REDIS_URL")

    @property
    def cors_origins(self) -> list[str]:
        origins = {
            "http://localhost:3000",
            self.app_url.rstrip("/"),
        }
        if self.vercel_project_production_url:
            origins.add(self._normalize_url(self.vercel_project_production_url))
        if self.backend_cors_origins:
            for origin in self.backend_cors_origins.split(","):
                cleaned = origin.strip()
                if cleaned:
                    origins.add(self._normalize_url(cleaned))
        return sorted(origins)

    @property
    def cors_origin_regex(self) -> str:
        return r"https://.*\.vercel\.app"

    @staticmethod
    def _normalize_url(value: str) -> str:
        return value.strip().rstrip("/")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
