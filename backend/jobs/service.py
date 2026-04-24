from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client


DEFAULT_INTERVAL_MINUTES = 24 * 60


def utcnow() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def compute_next_run_at(
    *,
    interval_minutes: int,
    run_at: str | None = None,
    now: datetime | None = None,
) -> str:
    current = now or utcnow()
    if run_at:
        parsed = parse_timestamp(run_at)
        if parsed:
            if parsed <= current:
                parsed = parsed + timedelta(minutes=interval_minutes)
            return parsed.isoformat()

    return (current + timedelta(minutes=interval_minutes)).isoformat()


def upsert_schedule(
    supabase: Client,
    *,
    user_id: str,
    agent_id: str,
    enabled: bool,
    interval_minutes: int = DEFAULT_INTERVAL_MINUTES,
    run_at: str | None = None,
    timezone: str = "UTC",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    next_run_at = compute_next_run_at(interval_minutes=interval_minutes, run_at=run_at) if enabled else None
    payload = {
        "user_id": user_id,
        "agent_id": agent_id,
        "enabled": enabled,
        "interval_minutes": interval_minutes,
        "run_at": run_at,
        "timezone": timezone,
        "next_run_at": next_run_at,
        "metadata": metadata or {},
    }
    response = (
        supabase.table("agent_job_schedules")
        .upsert(payload, on_conflict="user_id,agent_id")
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else payload


def list_schedules(
    supabase: Client,
    *,
    user_id: str | None = None,
    agent_id: str | None = None,
) -> list[dict[str, Any]]:
    query = supabase.table("agent_job_schedules").select("*").order("created_at", desc=False)
    if user_id:
        query = query.eq("user_id", user_id)
    if agent_id:
        query = query.eq("agent_id", agent_id)
    return query.execute().data or []


def get_schedule(supabase: Client, schedule_id: str) -> dict[str, Any] | None:
    response = (
        supabase.table("agent_job_schedules")
        .select("*")
        .eq("id", schedule_id)
        .maybe_single()
        .execute()
    )
    return response.data


def fetch_due_schedules(
    supabase: Client,
    *,
    agent_id: str | None = None,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    current = (now or utcnow()).isoformat()
    query = (
        supabase.table("agent_job_schedules")
        .select("*")
        .eq("enabled", True)
        .lte("next_run_at", current)
        .order("next_run_at", desc=False)
    )
    if agent_id:
        query = query.eq("agent_id", agent_id)
    return query.execute().data or []


def create_run(
    supabase: Client,
    *,
    agent_id: str,
    schedule_id: str | None,
    requested_by: str | None,
    run_type: str,
) -> dict[str, Any]:
    started_at = utcnow().isoformat()
    response = (
        supabase.table("agent_job_runs")
        .insert(
            {
                "agent_id": agent_id,
                "schedule_id": schedule_id,
                "requested_by": requested_by,
                "run_type": run_type,
                "status": "running",
                "started_at": started_at,
            }
        )
        .execute()
    )
    rows = response.data or []
    return rows[0]


def complete_run(
    supabase: Client,
    *,
    run_id: str,
    status: str,
    result: dict[str, Any] | None = None,
    error_message: str | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "completed_at": utcnow().isoformat(),
    }
    if result is not None:
        payload["result"] = result
    if error_message:
        payload["error_message"] = error_message
    supabase.table("agent_job_runs").update(payload).eq("id", run_id).execute()


def update_schedule_after_run(
    supabase: Client,
    *,
    schedule: dict[str, Any],
    status: str,
    error_message: str | None = None,
) -> None:
    interval_minutes = int(schedule.get("interval_minutes") or DEFAULT_INTERVAL_MINUTES)
    payload: dict[str, Any] = {
        "last_run_at": utcnow().isoformat(),
        "last_run_status": status,
        "last_error": error_message,
    }
    if schedule.get("enabled"):
        payload["next_run_at"] = compute_next_run_at(interval_minutes=interval_minutes, run_at=schedule.get("run_at"))
    supabase.table("agent_job_schedules").update(payload).eq("id", schedule["id"]).execute()


def mark_schedule_dispatched(supabase: Client, schedule: dict[str, Any]) -> None:
    interval_minutes = int(schedule.get("interval_minutes") or DEFAULT_INTERVAL_MINUTES)
    supabase.table("agent_job_schedules").update(
        {
            "last_run_status": "running",
            "last_error": None,
            "next_run_at": compute_next_run_at(interval_minutes=interval_minutes, run_at=schedule.get("run_at")),
        }
    ).eq("id", schedule["id"]).execute()


def create_agent_error(
    supabase: Client,
    *,
    agent_id: str,
    schedule_id: str | None,
    user_id: str | None,
    error_message: str,
    details: dict[str, Any] | None = None,
) -> None:
    supabase.table("agent_errors").insert(
        {
            "agent_id": agent_id,
            "schedule_id": schedule_id,
            "user_id": user_id,
            "error_message": error_message,
            "details": details or {},
        }
    ).execute()


def send_failure_alert(
    supabase: Client,
    *,
    user_id: str | None,
    agent_id: str,
    error_message: str,
) -> None:
    if not user_id:
        return
    supabase.table("notifications").insert(
        {
            "user_id": user_id,
            "title": f"{agent_id} failed",
            "body": error_message,
            "channel": "in_app",
        }
    ).execute()


def get_status(
    supabase: Client,
    *,
    user_id: str | None = None,
    agent_id: str | None = None,
) -> list[dict[str, Any]]:
    schedules = list_schedules(supabase, user_id=user_id, agent_id=agent_id)
    if not schedules:
        return []

    schedule_ids = [schedule["id"] for schedule in schedules]
    runs_query = (
        supabase.table("agent_job_runs")
        .select("*")
        .in_("schedule_id", schedule_ids)
        .order("started_at", desc=True)
        .execute()
    )
    runs = runs_query.data or []
    latest_run_by_schedule: dict[str, dict[str, Any]] = {}
    for run in runs:
        schedule_id = run.get("schedule_id")
        if schedule_id and schedule_id not in latest_run_by_schedule:
            latest_run_by_schedule[schedule_id] = run

    statuses: list[dict[str, Any]] = []
    for schedule in schedules:
        latest = latest_run_by_schedule.get(schedule["id"])
        statuses.append(
            {
                "schedule": schedule,
                "last_run": latest,
            }
        )
    return statuses
