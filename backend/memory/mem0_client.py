from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from utils.settings import get_settings


os.environ.setdefault("MEM0_DIR", str(Path(__file__).resolve().parents[1] / ".mem0"))
os.environ.setdefault("MEM0_TELEMETRY", "false")

from mem0 import Memory


MemoryScope = Literal["session", "user", "agent"]
DEFAULT_AGENT_COLLECTION = "inceptive_memories"


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _default_session_id(user_id: str, agent_id: str) -> str:
    hour_bucket = _utcnow().strftime("%Y%m%d%H")
    return f"{agent_id}:{user_id}:{hour_bucket}"


def _resolve_connection_string() -> str:
    settings = get_settings()
    direct = (settings.supabase_db_url or "").strip()
    if direct:
      return direct

    maybe_supabase_url = (settings.supabase_url or "").strip()
    if maybe_supabase_url.startswith("postgresql://"):
        return maybe_supabase_url

    raise RuntimeError(
        "Mem0 requires a PostgreSQL connection string. Set SUPABASE_DB_URL "
        "(recommended) or set SUPABASE_URL to a postgres:// connection string."
    )


def _resolve_embedder_config() -> dict[str, Any]:
    settings = get_settings()
    api_key = (settings.openai_api_key or settings.openrouter_key or "").strip()
    if not api_key:
        raise RuntimeError(
            "Mem0 embedding requires OPENAI_API_KEY or OPENROUTER_KEY in the backend environment."
        )

    base_url = (settings.openai_base_url or "").strip()
    if not base_url and settings.openrouter_key and not settings.openai_api_key:
        base_url = "https://openrouter.ai/api/v1"

    config: dict[str, Any] = {
        "provider": "openai",
        "config": {
            "api_key": api_key,
            "model": settings.mem0_embedder_model,
            "embedding_dims": settings.mem0_embedding_dims,
        },
    }
    if base_url:
        config["config"]["openai_base_url"] = base_url
    return config


def _resolve_llm_config() -> dict[str, Any]:
    settings = get_settings()
    api_key = (settings.openai_api_key or settings.openrouter_key or "").strip()
    if not api_key:
        raise RuntimeError(
            "Mem0 LLM setup requires OPENAI_API_KEY or OPENROUTER_KEY in the backend environment."
        )

    config: dict[str, Any] = {
        "provider": "openai",
        "config": {
            "api_key": api_key,
            "model": "openai/gpt-4o-mini" if settings.openrouter_key and not settings.openai_api_key else "gpt-4o-mini",
        },
    }

    if settings.openrouter_key and not settings.openai_api_key:
        config["config"]["openai_base_url"] = "https://openrouter.ai/api/v1"

    return config


def _build_mem0_config() -> dict[str, Any]:
    settings = get_settings()
    return {
        "vector_store": {
            "provider": "pgvector",
            "config": {
                "connection_string": _resolve_connection_string(),
                "collection_name": DEFAULT_AGENT_COLLECTION,
                "embedding_model_dims": settings.mem0_embedding_dims,
                "hnsw": True,
                "diskann": False,
            },
        },
        "embedder": _resolve_embedder_config(),
        "llm": _resolve_llm_config(),
    }


@lru_cache(maxsize=1)
def get_mem0() -> Memory:
    return Memory.from_config(_build_mem0_config())


def _scope_filters(
    user_id: str,
    agent_id: str,
    scope: MemoryScope,
    session_id: str | None = None,
) -> dict[str, str]:
    if scope == "session":
        return {
            "user_id": user_id,
            "agent_id": agent_id,
            "run_id": session_id or _default_session_id(user_id, agent_id),
        }
    if scope == "agent":
        return {"agent_id": agent_id}
    return {"user_id": user_id, "agent_id": agent_id}


def _is_expired(memory: dict[str, Any]) -> bool:
    metadata = memory.get("metadata") or {}
    expires_at = _normalize_iso(metadata.get("expires_at"))
    return bool(expires_at and expires_at <= _utcnow())


def _trim_results(memories: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for memory in memories:
        memory_id = str(memory.get("id") or "")
        if memory_id and memory_id in seen:
            continue
        if memory_id:
            seen.add(memory_id)
        deduped.append(memory)
        if len(deduped) >= limit:
            break
    return deduped


def save_memory(
    user_id: str,
    agent_id: str,
    content: str,
    scope: MemoryScope = "user",
    session_id: str | None = None,
) -> list[dict[str, Any]]:
    memory = get_mem0()
    filters = _scope_filters(user_id, agent_id, scope, session_id=session_id)
    metadata: dict[str, Any] = {
        "scope": scope,
        "saved_at": _utcnow().isoformat(),
    }
    if scope == "session":
        metadata["expires_at"] = (_utcnow() + timedelta(hours=1)).isoformat()

    result = memory.add(content, infer=False, metadata=metadata, **filters)
    return result.get("results", [])


def get_memories(
    user_id: str,
    agent_id: str,
    query: str,
    scope: MemoryScope = "user",
    session_id: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    memory = get_mem0()
    scopes: list[MemoryScope]
    if scope == "user":
        scopes = ["user", "agent"]
    else:
        scopes = [scope]

    results: list[dict[str, Any]] = []
    expired_ids: list[str] = []

    for active_scope in scopes:
        filters = _scope_filters(user_id, agent_id, active_scope, session_id=session_id)
        search = memory.search(query, top_k=limit, filters=filters)
        for item in search.get("results", []):
            if _is_expired(item):
                if item.get("id"):
                    expired_ids.append(str(item["id"]))
                continue
            metadata = item.get("metadata") or {}
            metadata.setdefault("scope", active_scope)
            item["metadata"] = metadata
            results.append(item)

    for memory_id in expired_ids:
        try:
            memory.delete(memory_id)
        except Exception:
            continue

    return _trim_results(results, limit)


def clear_memories(
    user_id: str,
    agent_id: str,
    scope: MemoryScope = "user",
    session_id: str | None = None,
) -> int:
    memory = get_mem0()
    scopes: list[MemoryScope]
    if scope == "user":
        scopes = ["user", "session"]
    else:
        scopes = [scope]

    deleted = 0
    for active_scope in scopes:
        filters = _scope_filters(user_id, agent_id, active_scope, session_id=session_id)
        items = memory.get_all(filters=filters, top_k=10_000).get("results", [])
        for item in items:
            memory_id = item.get("id")
            if not memory_id:
                continue
            memory.delete(str(memory_id))
            deleted += 1

    return deleted
