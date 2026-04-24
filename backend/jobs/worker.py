from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from agents.churn_agent import CHURN_AGENT_ID, ChurnAgent
from agents.revenue_agent import REVENUE_AGENT_ID, RevenueAgent
from agents.vendor_agent import VENDOR_AGENT_ID, VendorAgent
from jobs.service import (
    create_agent_error,
    create_run,
    fetch_due_schedules,
    get_schedule,
    mark_schedule_dispatched,
    send_failure_alert,
    update_schedule_after_run,
)
from observability.tracer import trace_llm_call
from utils.settings import get_settings
from utils.supabase import get_supabase_client


settings = get_settings()
redis_url = getattr(settings, "redis_url", None) or "redis://localhost:6379/0"

celery_app = Celery("backend.jobs.worker", broker=redis_url, backend=redis_url)
celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
    "daily-churn-agent": {
        "task": "backend.jobs.worker.run_churn_agent_scheduled",
        "schedule": 60 * 60 * 24,
    },
    "twice-daily-revenue-agent": {
        "task": "backend.jobs.worker.run_revenue_agent_scheduled",
        "schedule": 60 * 60 * 12,
    },
    "daily-vendor-agent": {
        "task": "backend.jobs.worker.run_vendor_agent_scheduled",
        "schedule": 60 * 60 * 24,
    },
    "dispatch-due-agent-jobs": {
        "task": "backend.jobs.worker.dispatch_due_jobs",
        "schedule": crontab(minute="*"),
    },
}


@celery_app.task(name="backend.jobs.worker.run_churn_agent_scheduled")
def run_churn_agent_scheduled() -> dict:
    supabase = get_supabase_client()
    schedules = fetch_due_schedules(supabase, agent_id=CHURN_AGENT_ID)
    processed = 0
    for schedule in schedules:
        mark_schedule_dispatched(supabase, schedule)
        run_scheduled_job.delay(schedule["id"])
        processed += 1
    return {"queued": processed}


@celery_app.task(name="backend.jobs.worker.run_revenue_agent_scheduled")
def run_revenue_agent_scheduled() -> dict:
    supabase = get_supabase_client()
    schedules = fetch_due_schedules(supabase, agent_id=REVENUE_AGENT_ID)
    processed = 0
    for schedule in schedules:
        mark_schedule_dispatched(supabase, schedule)
        run_scheduled_job.delay(schedule["id"])
        processed += 1
    return {"queued": processed}


@celery_app.task(name="backend.jobs.worker.run_vendor_agent_scheduled")
def run_vendor_agent_scheduled() -> dict:
    supabase = get_supabase_client()
    schedules = fetch_due_schedules(supabase, agent_id=VENDOR_AGENT_ID)
    processed = 0
    for schedule in schedules:
        mark_schedule_dispatched(supabase, schedule)
        run_scheduled_job.delay(schedule["id"])
        processed += 1
    return {"queued": processed}


@celery_app.task(name="backend.jobs.worker.dispatch_due_jobs")
def dispatch_due_jobs() -> dict:
    supabase = get_supabase_client()
    schedules = fetch_due_schedules(supabase)
    queued = 0
    for schedule in schedules:
        mark_schedule_dispatched(supabase, schedule)
        run_scheduled_job.delay(schedule["id"])
        queued += 1
    return {"queued": queued}


@celery_app.task(
    bind=True,
    name="backend.jobs.worker.run_scheduled_job",
    max_retries=3,
)
def run_scheduled_job(self, schedule_id: str) -> dict:
    supabase = get_supabase_client()
    schedule = get_schedule(supabase, schedule_id)
    if not schedule or not schedule.get("enabled"):
        return {"status": "skipped", "reason": "schedule_missing_or_disabled"}

    run = create_run(
        supabase,
        agent_id=schedule["agent_id"],
        schedule_id=schedule["id"],
        requested_by=schedule.get("user_id"),
        run_type="scheduled",
    )

    try:
        if schedule["agent_id"] == CHURN_AGENT_ID:
            result = ChurnAgent(supabase).run()
        elif schedule["agent_id"] == REVENUE_AGENT_ID:
            result = RevenueAgent(supabase).run()
        elif schedule["agent_id"] == VENDOR_AGENT_ID:
            result = VendorAgent(supabase).run()
        else:
            raise ValueError(f"Unsupported scheduled agent: {schedule['agent_id']}")

        update_schedule_after_run(supabase, schedule=schedule, status="success")
        from jobs.service import complete_run

        complete_run(supabase, run_id=run["id"], status="success", result=result)
        return {"status": "success", "run_id": run["id"]}
    except Exception as exc:
        from jobs.service import complete_run

        complete_run(supabase, run_id=run["id"], status="failed", error_message=str(exc))
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=300)

        update_schedule_after_run(supabase, schedule=schedule, status="failed", error_message=str(exc))
        create_agent_error(
            supabase,
            agent_id=schedule["agent_id"],
            schedule_id=schedule["id"],
            user_id=schedule.get("user_id"),
            error_message=str(exc),
            details={"run_id": run["id"]},
        )
        send_failure_alert(
            supabase,
            user_id=schedule.get("user_id"),
            agent_id=schedule["agent_id"],
            error_message=str(exc),
        )
        trace_llm_call(
            name="scheduled-job-error",
            model="none",
            prompt={"schedule_id": schedule["id"]},
            response=None,
            error=str(exc),
            metadata={"agent_id": schedule["agent_id"]},
        )
        raise
