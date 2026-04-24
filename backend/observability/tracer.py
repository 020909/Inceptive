from __future__ import annotations

from datetime import UTC, datetime
from functools import wraps
from typing import Any, Callable, TypeVar

from langfuse import Langfuse
from langfuse.api import LangfuseAPI

from utils.settings import get_settings


F = TypeVar("F", bound=Callable[..., Any])


def _sanitize(value: Any, max_items: int = 20) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(key): _sanitize(item, max_items=max_items) for key, item in list(value.items())[:max_items]}
    if isinstance(value, (list, tuple, set)):
        return [_sanitize(item, max_items=max_items) for item in list(value)[:max_items]]
    return repr(value)


def _configured() -> bool:
    settings = get_settings()
    return bool(settings.langfuse_public_key and settings.langfuse_secret_key)


def get_langfuse_client() -> Langfuse | None:
    if not _configured():
        return None
    settings = get_settings()
    return Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        base_url=settings.langfuse_base_url,
    )


def get_langfuse_api() -> LangfuseAPI | None:
    if not _configured():
        return None
    settings = get_settings()
    return LangfuseAPI(
        base_url=f"{settings.langfuse_base_url.rstrip('/')}/api/public",
        x_langfuse_public_key=settings.langfuse_public_key,
        username=settings.langfuse_public_key,
        password=settings.langfuse_secret_key,
    )


def trace_agent(func: F) -> F:
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        client = get_langfuse_client()
        agent_name = func.__qualname__
        input_payload = {
            "args": _sanitize(args[1:] if args and hasattr(args[0], func.__name__) else args),
            "kwargs": _sanitize(kwargs),
        }

        if client is None:
            return func(*args, **kwargs)

        with client.start_as_current_observation(
            name=agent_name,
            as_type="agent",
            input=input_payload,
            metadata={
                "agent_name": agent_name,
                "started_at": datetime.now(UTC).isoformat(),
            },
        ) as observation:
            try:
                result = func(*args, **kwargs)
                observation.update(
                    output=_sanitize(result),
                    metadata={
                        "agent_name": agent_name,
                        "completed_at": datetime.now(UTC).isoformat(),
                    },
                )
                client.flush()
                return result
            except Exception as exc:
                observation.update(
                    level="ERROR",
                    status_message=str(exc),
                    output={"error": str(exc)},
                    metadata={
                        "agent_name": agent_name,
                        "failed_at": datetime.now(UTC).isoformat(),
                    },
                )
                client.flush()
                raise

    return wrapper


def trace_llm_call(
    *,
    name: str,
    model: str,
    prompt: Any,
    response: Any | None = None,
    token_count: int | None = None,
    error: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    client = get_langfuse_client()
    if client is None:
        return

    payload_metadata: dict[str, Any] = {"model": model}
    if metadata:
        payload_metadata.update(_sanitize(metadata))

    with client.start_as_current_observation(
        name=name,
        as_type="generation",
        model=model,
        input=_sanitize(prompt),
        metadata=payload_metadata,
    ) as generation:
        update_payload: dict[str, Any] = {
            "output": _sanitize(response),
        }
        if token_count is not None:
            update_payload["usage_details"] = {"total": token_count}
        if error:
            update_payload["level"] = "ERROR"
            update_payload["status_message"] = error
        generation.update(**update_payload)

    client.flush()


def fetch_recent_agent_traces(limit: int = 20) -> list[dict[str, Any]]:
    api = get_langfuse_api()
    if api is None:
        return []

    observations = api.observations.get_many(
        limit=limit,
        type="AGENT",
        fields="core,basic,time,io,metadata,usage,model",
    )

    data = getattr(observations, "data", []) or []
    traces: list[dict[str, Any]] = []
    for item in data[:limit]:
        traces.append(
            {
                "id": getattr(item, "id", None),
                "trace_id": getattr(item, "trace_id", None),
                "name": getattr(item, "name", None),
                "type": getattr(item, "type", None),
                "level": getattr(item, "level", None),
                "status_message": getattr(item, "status_message", None),
                "start_time": getattr(item, "start_time", None),
                "end_time": getattr(item, "end_time", None),
                "input": getattr(item, "input", None),
                "output": getattr(item, "output", None),
                "usage_details": getattr(item, "usage_details", None),
                "model": getattr(item, "provided_model_name", None),
                "metadata": getattr(item, "metadata", None),
            }
        )

    return traces
