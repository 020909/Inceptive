from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from memory.mem0_client import get_memories, save_memory
from observability.tracer import trace_agent


CHURN_AGENT_ID = "churn_agent"


@dataclass(slots=True)
class ChurnMetrics:
    user_id: str
    email: str | None
    account_name: str
    plan: str | None
    last_login_at: str | None
    usage_this_week: int
    usage_last_week: int
    support_ticket_count: int
    login_score: float
    usage_score: float
    ticket_score: float
    health_score: int
    churn_risk: str
    analyzed_at: str

    def to_record(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "email": self.email,
            "account_name": self.account_name,
            "plan": self.plan,
            "last_login_at": self.last_login_at,
            "usage_this_week": self.usage_this_week,
            "usage_last_week": self.usage_last_week,
            "support_ticket_count": self.support_ticket_count,
            "login_score": round(self.login_score, 2),
            "usage_score": round(self.usage_score, 2),
            "ticket_score": round(self.ticket_score, 2),
            "health_score": self.health_score,
            "churn_risk": self.churn_risk,
            "analyzed_at": self.analyzed_at,
        }


class ChurnAgent:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase

    @trace_agent
    def run(self) -> dict[str, Any]:
        analyzed_at = datetime.now(UTC).replace(microsecond=0).isoformat()
        users = self._fetch_accounts()
        usage_windows = self._fetch_usage_windows()
        tickets_by_user = self._fetch_ticket_counts()
        agent_memories = get_memories(
            user_id="system",
            agent_id=CHURN_AGENT_ID,
            query="past churn scan results, churn risks, and account health changes",
            scope="agent",
            limit=3,
        )
        user_memory_context = {
            str(user["id"]): get_memories(
                user_id=str(user["id"]),
                agent_id=CHURN_AGENT_ID,
                query="past churn scan results and churn risk history",
                scope="user",
                limit=3,
            )
            for user in users
        }

        ranked = [
            self._score_account(
                user,
                usage_windows,
                tickets_by_user,
                analyzed_at,
                user_memory_context.get(str(user["id"]), []),
            )
            for user in users
        ]
        ranked.sort(key=lambda item: (item.health_score, item.account_name.lower()))

        if ranked:
            self.supabase.table("churn_signals").upsert(
                [item.to_record() for item in ranked],
                on_conflict="user_id",
            ).execute()

        for item in ranked:
            prior_memory_count = len(user_memory_context.get(item.user_id, []))
            save_memory(
                user_id=item.user_id,
                agent_id=CHURN_AGENT_ID,
                content=(
                    f"Churn scan on {analyzed_at}: {item.account_name} scored {item.health_score}/100 "
                    f"and was classified as {item.churn_risk}. Usage this week: {item.usage_this_week}; "
                    f"last week: {item.usage_last_week}; support tickets: {item.support_ticket_count}; "
                    f"prior stored churn memories: {prior_memory_count}."
                ),
                scope="user",
            )

        summary = (
            f"Completed churn scan for {len(ranked)} accounts on {analyzed_at}. "
            f"High risk: {sum(1 for item in ranked if item.churn_risk == 'high')}; "
            f"medium: {sum(1 for item in ranked if item.churn_risk == 'medium')}; "
            f"healthy: {sum(1 for item in ranked if item.churn_risk == 'healthy')}."
        )
        save_memory(
            user_id="system",
            agent_id=CHURN_AGENT_ID,
            content=summary,
            scope="agent",
        )

        return {
            "last_run_at": analyzed_at,
            "count": len(ranked),
            "memories": agent_memories,
            "accounts": [item.to_record() for item in ranked],
        }

    def list_signals(self) -> dict[str, Any]:
        response = (
            self.supabase.table("churn_signals")
            .select("*")
            .order("health_score", desc=False)
            .order("account_name", desc=False)
            .execute()
        )
        rows = response.data or []
        last_run_at = max((row.get("analyzed_at") for row in rows if row.get("analyzed_at")), default=None)
        return {
            "last_run_at": last_run_at,
            "count": len(rows),
            "accounts": rows,
        }

    def _fetch_accounts(self) -> list[dict[str, Any]]:
        response = (
            self.supabase.table("users")
            .select("id,email,created_at,last_login_at,plan")
            .order("created_at", desc=False)
            .execute()
        )
        return response.data or []

    def _fetch_usage_windows(self) -> dict[str, dict[str, int]]:
        now = datetime.now(UTC)
        current_week_start = now - timedelta(days=7)
        previous_week_start = now - timedelta(days=14)

        current_usage = (
            self.supabase.table("usage_logs")
            .select("user_id,created_at")
            .gte("created_at", current_week_start.isoformat())
            .execute()
        )
        previous_usage = (
            self.supabase.table("usage_logs")
            .select("user_id,created_at")
            .gte("created_at", previous_week_start.isoformat())
            .lt("created_at", current_week_start.isoformat())
            .execute()
        )

        current_task_logs = (
            self.supabase.table("task_logs")
            .select("user_id,created_at")
            .gte("created_at", current_week_start.isoformat())
            .execute()
        )
        previous_task_logs = (
            self.supabase.table("task_logs")
            .select("user_id,created_at")
            .gte("created_at", previous_week_start.isoformat())
            .lt("created_at", current_week_start.isoformat())
            .execute()
        )

        counts: dict[str, dict[str, int]] = {}
        for key, rows in (
            ("this_week", (current_usage.data or []) + (current_task_logs.data or [])),
            ("last_week", (previous_usage.data or []) + (previous_task_logs.data or [])),
        ):
            for row in rows:
                user_id = row.get("user_id")
                if not user_id:
                    continue
                bucket = counts.setdefault(user_id, {"this_week": 0, "last_week": 0})
                bucket[key] += 1
        return counts

    def _fetch_ticket_counts(self) -> dict[str, int]:
        now = datetime.now(UTC)
        since = (now - timedelta(days=30)).isoformat()
        try:
            response = (
                self.supabase.table("tickets")
                .select("user_id,created_at")
                .gte("created_at", since)
                .execute()
            )
        except Exception:
            return {}

        counts: dict[str, int] = {}
        for row in response.data or []:
            user_id = row.get("user_id")
            if not user_id:
                continue
            counts[user_id] = counts.get(user_id, 0) + 1
        return counts

    def _score_account(
        self,
        user: dict[str, Any],
        usage_windows: dict[str, dict[str, int]],
        tickets_by_user: dict[str, int],
        analyzed_at: str,
        _historical_memories: list[dict[str, Any]],
    ) -> ChurnMetrics:
        user_id = str(user["id"])
        email = user.get("email")
        account_name = self._account_name_from_email(email)
        last_login_raw = user.get("last_login_at") or user.get("created_at")
        last_login_at = self._parse_iso(last_login_raw)
        usage = usage_windows.get(user_id, {"this_week": 0, "last_week": 0})
        ticket_count = tickets_by_user.get(user_id, 0)

        login_score = self._login_score(last_login_at)
        usage_score = self._usage_score(usage["this_week"], usage["last_week"])
        ticket_score = self._ticket_score(ticket_count, bool(tickets_by_user))
        health_score = int(round((login_score * 0.3) + (usage_score * 0.4) + (ticket_score * 0.3)))
        churn_risk = self._risk_bucket(health_score)
        if historical_memories:
            analyzed_at = analyzed_at

        return ChurnMetrics(
            user_id=user_id,
            email=email,
            account_name=account_name,
            plan=user.get("plan"),
            last_login_at=last_login_at.isoformat() if last_login_at else None,
            usage_this_week=usage["this_week"],
            usage_last_week=usage["last_week"],
            support_ticket_count=ticket_count,
            login_score=login_score,
            usage_score=usage_score,
            ticket_score=ticket_score,
            health_score=health_score,
            churn_risk=churn_risk,
            analyzed_at=analyzed_at,
        )

    @staticmethod
    def _account_name_from_email(email: str | None) -> str:
        if not email:
            return "Unknown account"
        prefix = email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
        return " ".join(part.capitalize() for part in prefix.split()) or email

    @staticmethod
    def _parse_iso(value: str | None) -> datetime | None:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)

    @staticmethod
    def _login_score(last_login_at: datetime | None) -> float:
        if not last_login_at:
            return 0.0
        days = max(0, (datetime.now(UTC) - last_login_at).days)
        if days <= 3:
            return 100.0
        if days <= 7:
            return 88.0
        if days <= 14:
            return 72.0
        if days <= 30:
            return 48.0
        if days <= 60:
            return 24.0
        return 5.0

    @staticmethod
    def _usage_score(this_week: int, last_week: int) -> float:
        if last_week <= 0 and this_week <= 0:
            return 35.0
        if last_week <= 0 and this_week > 0:
            return 100.0
        ratio = this_week / max(last_week, 1)
        if ratio >= 1:
            return 100.0
        return max(0.0, min(100.0, ratio * 100.0))

    @staticmethod
    def _ticket_score(ticket_count: int, has_ticket_source: bool) -> float:
        if not has_ticket_source:
            return 70.0
        return max(0.0, 100.0 - (ticket_count * 18.0))

    @staticmethod
    def _risk_bucket(score: int) -> str:
        if score < 40:
            return "high"
        if score < 70:
            return "medium"
        return "healthy"
