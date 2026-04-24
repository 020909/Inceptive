from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from supabase import Client

from memory.mem0_client import get_memories, save_memory
from observability.tracer import trace_agent


REVENUE_AGENT_ID = "revenue_agent"
PLAN_PRICES = {"free": 0.0, "basic": 9.0, "pro": 29.0, "unlimited": 49.0}
PLAN_USAGE_LIMITS = {"free": 120, "basic": 400, "pro": 1_500, "unlimited": 10_000_000}
DISCOUNT_STATUSES = {"custom", "discounted", "discount", "custom_pricing"}
FAILED_PAYMENT_STATUSES = {"failed", "disputed", "past_due"}


@dataclass(slots=True)
class RevenueFinding:
    account_id: str
    signal_type: str
    severity: str
    estimated_dollar_impact: float
    description: str
    recommended_action: str
    detected_at: str
    status: str = "open"

    @property
    def signal_id(self) -> str:
        stable = f"{self.account_id}:{self.signal_type}:{self.description}"
        return str(uuid5(NAMESPACE_URL, stable))

    def to_record(self) -> dict[str, Any]:
        return {
            "id": self.signal_id,
            "account_id": self.account_id,
            "signal_type": self.signal_type,
            "severity": self.severity,
            "dollar_impact": round(self.estimated_dollar_impact, 2),
            "description": self.description,
            "recommended_action": self.recommended_action,
            "detected_at": self.detected_at,
            "status": self.status,
        }


class RevenueAgent:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase
        self._accounts_cache: list[dict[str, Any]] | None = None
        self._billing_cache: list[dict[str, Any]] | None = None
        self._contracts_cache: list[dict[str, Any]] | None = None
        self._monthly_activity_cache: dict[str, dict[str, int]] | None = None
        self._recent_activity_cache: dict[str, int] | None = None

    @trace_agent
    def run(self) -> dict[str, Any]:
        detected_at = self._now().isoformat()
        prior_memories = get_memories(
            user_id="system",
            agent_id=REVENUE_AGENT_ID,
            query="past revenue leakage findings, recurring leakage trends, and resolved revenue issues",
            scope="agent",
            limit=5,
        )
        findings = [
            *self.detect_expiring_contracts(),
            *self.detect_billing_anomalies(),
            *self.detect_missed_upsells(),
            *self.detect_payment_failures(),
            *self.detect_inactive_high_value(),
            *self.detect_discount_abuse(),
        ]
        findings = self._apply_trend_context(findings, prior_memories)
        if findings:
            self.supabase.table("revenue_signals").upsert(
                [item.to_record() for item in findings],
                on_conflict="id",
            ).execute()

        total_leakage = round(sum(item.estimated_dollar_impact for item in findings), 2)
        critical_count = sum(1 for item in findings if item.severity == "critical")
        warning_count = sum(1 for item in findings if item.severity == "warning")
        summary = (
            f"Revenue scan on {detected_at}: {len(findings)} findings, "
            f"${total_leakage:.2f} estimated leakage, "
            f"{critical_count} critical and {warning_count} warning signals."
        )
        save_memory(user_id="system", agent_id=REVENUE_AGENT_ID, content=summary, scope="agent")
        return {
            "detected_at": detected_at,
            "total_leakage": total_leakage,
            "critical_count": critical_count,
            "warning_count": warning_count,
            "findings": [item.to_record() for item in findings],
        }

    def list_signals(
        self,
        *,
        severity: str | None = None,
        signal_type: str | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        query = (
            self.supabase.table("revenue_signals")
            .select("*")
            .eq("status", "open")
            .order("dollar_impact", desc=True)
            .limit(max(1, min(limit, 500)))
        )
        if severity:
            query = query.eq("severity", severity)
        if signal_type:
            query = query.eq("signal_type", signal_type)
        rows = query.execute().data or []
        return {"count": len(rows), "signals": rows}

    def resolve_signal(self, signal_id: str, resolution_note: str | None = None) -> dict[str, Any]:
        payload = {
            "status": "resolved",
            "resolution_note": resolution_note,
            "resolved_at": self._now().isoformat(),
        }
        response = (
            self.supabase.table("revenue_signals")
            .update(payload)
            .eq("id", signal_id)
            .eq("status", "open")
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else {}

    def summary(self) -> dict[str, Any]:
        open_signals = (
            self.supabase.table("revenue_signals")
            .select("severity,dollar_impact")
            .eq("status", "open")
            .execute()
            .data
            or []
        )
        start_of_month = self._now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        resolved = (
            self.supabase.table("revenue_signals")
            .select("dollar_impact")
            .eq("status", "resolved")
            .gte("resolved_at", start_of_month)
            .execute()
            .data
            or []
        )
        return {
            "total_open_leakage": round(sum(float(row.get("dollar_impact") or 0.0) for row in open_signals), 2),
            "critical_count": sum(1 for row in open_signals if row.get("severity") == "critical"),
            "warning_count": sum(1 for row in open_signals if row.get("severity") == "warning"),
            "signals_resolved_this_month": len(resolved),
            "estimated_recovered": round(sum(float(row.get("dollar_impact") or 0.0) for row in resolved), 2),
        }

    def detect_expiring_contracts(self, days_ahead: int = 30) -> list[RevenueFinding]:
        findings: list[RevenueFinding] = []
        today = self._now()
        contracts = self._contracts()
        if contracts:
            for row in contracts:
                renewal = self._parse_dt(row.get("renewal_date"))
                if not renewal or not 0 <= (renewal - today).days <= days_ahead:
                    continue
                account = self._account_map().get(str(row["account_id"]), {})
                findings.append(
                    self._finding(
                        account_id=str(row["account_id"]),
                        signal_type="expiring_contract",
                        severity="critical" if (renewal - today).days < 7 else "warning",
                        impact=float(row.get("value") or self._plan_price(account.get("plan"))),
                        description=f"Contract renews on {renewal.date()} with no confirmed renewal workflow.",
                        action="Start renewal outreach and assign an owner before the contract lapses.",
                    )
                )
            return findings

        for account in self._accounts():
            renewal = self._parse_dt(account.get("subscription_period_end"))
            active_like = account.get("subscription_status") in {"active", "trialing"}
            if not renewal or not active_like or not 0 <= (renewal - today).days <= days_ahead:
                continue
            findings.append(
                self._finding(
                    account_id=str(account["id"]),
                    signal_type="expiring_contract",
                    severity="critical" if (renewal - today).days < 7 else "warning",
                    impact=self._plan_price(account.get("plan")),
                    description=f"Subscription renews on {renewal.date()} and should be reviewed before expiration.",
                    action="Queue a renewal touchpoint and confirm billing ownership for this account.",
                )
            )
        return findings

    def detect_billing_anomalies(self) -> list[RevenueFinding]:
        rows = self._billing_records()
        if not rows:
            return []
        findings: list[RevenueFinding] = []
        current_key, history_keys = self._month_key(0), [self._month_key(i) for i in range(1, 4)]
        for account_id, monthly in self._billing_by_account_month(rows).items():
            current = monthly.get(current_key, 0.0)
            history = [monthly[key] for key in history_keys if key in monthly]
            last_month = monthly.get(history_keys[0], 0.0)
            if last_month > 0 and current == 0:
                findings.append(self._finding(account_id, "billing_anomaly", "critical", last_month, "No successful charge posted this month despite activity last month.", "Review billing pipeline immediately and retry invoice collection."))
                continue
            if not history:
                continue
            average = sum(history) / len(history)
            deviation = abs(current - average) / average if average else 0
            if deviation > 0.2:
                findings.append(self._finding(account_id, "billing_anomaly", "critical" if deviation > 0.5 else "warning", abs(current - average), f"Current month billing (${current:.2f}) deviates {deviation:.0%} from the trailing 3-month average (${average:.2f}).", "Investigate invoice changes, usage mismatch, or missing billable events."))
        return findings

    def detect_missed_upsells(self) -> list[RevenueFinding]:
        findings: list[RevenueFinding] = []
        usage = self._monthly_activity()
        latest_two = [self._month_key(0), self._month_key(1)]
        for account in self._accounts():
            plan = (account.get("plan") or "free").lower()
            if plan == "unlimited":
                continue
            limit = PLAN_USAGE_LIMITS.get(plan, PLAN_USAGE_LIMITS["free"])
            monthly_counts = usage.get(str(account["id"]), {})
            if all(monthly_counts.get(month, 0) >= limit * 0.8 for month in latest_two):
                findings.append(
                    self._finding(
                        account_id=str(account["id"]),
                        signal_type="missed_upsell",
                        severity="warning",
                        impact=self._next_plan_price(plan) - self._plan_price(plan),
                        description=f"Usage has exceeded 80% of the {plan} plan threshold for two consecutive months.",
                        action="Trigger an upgrade offer before the account caps out on current capacity.",
                    )
                )
        return findings

    def detect_payment_failures(self) -> list[RevenueFinding]:
        rows = [
            row for row in self._billing_records(days=60)
            if str(row.get("status") or "").lower() in FAILED_PAYMENT_STATUSES
        ]
        grouped = self._sum_rows(rows)
        return [
            self._finding(
                account_id=account_id,
                signal_type="payment_failure",
                severity="critical",
                impact=totals["amount"],
                description=f"{totals['count']} failed or disputed payments in the last 60 days.",
                action="Escalate to collections, retry payment, and pause non-essential spend until cleared.",
            )
            for account_id, totals in grouped.items()
            if totals["count"] > 1
        ]

    def detect_inactive_high_value(self) -> list[RevenueFinding]:
        rows = self._billing_records(days=45)
        if not rows:
            return []
        current_month = self._month_key(0)
        monthly = self._billing_by_account_month(rows)
        activity = self._recent_activity()
        findings: list[RevenueFinding] = []
        for account_id, totals in monthly.items():
            amount = totals.get(current_month, totals.get(self._month_key(1), 0.0))
            if amount <= 500 or activity.get(account_id, 0) > 0:
                continue
            findings.append(self._finding(account_id, "inactive_high_value", "critical", amount, "High-value account has produced zero agent runs in the last 14 days.", "Assign customer success follow-up and audit onboarding or activation blockers immediately."))
        return findings

    def detect_discount_abuse(self) -> list[RevenueFinding]:
        rows = [row for row in self._billing_records(days=210) if str(row.get("status") or "").lower() in DISCOUNT_STATUSES]
        if not rows:
            return []
        usage = self._monthly_activity()
        findings: list[RevenueFinding] = []
        for account_id, latest in self._latest_row_by_account(rows).items():
            growth = self._usage_growth_multiple(usage.get(account_id, {}))
            reviewed_at = self._parse_dt(latest.get("created_at"))
            if growth < 5 or not reviewed_at or (self._now() - reviewed_at).days < 90:
                continue
            amount = abs(float(latest.get("amount") or 0.0))
            findings.append(self._finding(account_id, "discount_abuse", "critical" if growth >= 10 else "warning", max(amount * 0.25, 100.0), f"Discounted pricing has not been reviewed for {(self._now() - reviewed_at).days} days while usage grew {growth:.1f}x.", "Review commercial terms and renegotiate pricing against current usage intensity."))
        return findings

    def _finding(self, account_id: str, signal_type: str, severity: str, impact: float, description: str, action: str) -> RevenueFinding:
        return RevenueFinding(
            account_id=account_id,
            signal_type=signal_type,
            severity=severity,
            estimated_dollar_impact=max(round(float(impact), 2), 0.0),
            description=description,
            recommended_action=action,
            detected_at=self._now().isoformat(),
        )

    def _accounts(self) -> list[dict[str, Any]]:
        if self._accounts_cache is None:
            self._accounts_cache = (
                self.supabase.table("users")
                .select("id,email,plan,subscription_status,subscription_period_end,created_at,last_login_at")
                .order("created_at", desc=False)
                .execute()
                .data
                or []
            )
        return self._accounts_cache

    def _account_map(self) -> dict[str, dict[str, Any]]:
        return {str(item["id"]): item for item in self._accounts()}

    def _contracts(self) -> list[dict[str, Any]]:
        if self._contracts_cache is None:
            self._contracts_cache = self._safe_table_fetch("contracts", "account_id,value,renewal_date,status,created_at")
        return self._contracts_cache

    def _billing_records(self, days: int = 120) -> list[dict[str, Any]]:
        if self._billing_cache is None:
            self._billing_cache = self._safe_table_fetch("billing_records", "account_id,amount,period_start,period_end,status,created_at")
        if not self._billing_cache:
            return []
        since = self._now() - timedelta(days=days)
        return [row for row in self._billing_cache if (self._parse_dt(row.get("period_end")) or self._parse_dt(row.get("created_at")) or since) >= since]

    def _monthly_activity(self) -> dict[str, dict[str, int]]:
        if self._monthly_activity_cache is not None:
            return self._monthly_activity_cache
        since = (self._now() - timedelta(days=210)).isoformat()
        rows = self._safe_table_fetch("usage_logs", "user_id,created_at", "created_at", since)
        rows += self._safe_table_fetch("task_logs", "user_id,created_at", "created_at", since)
        counts: dict[str, dict[str, int]] = {}
        for row in rows:
            user_id = str(row.get("user_id") or "")
            created_at = self._parse_dt(row.get("created_at"))
            if not user_id or not created_at:
                continue
            counts.setdefault(user_id, {}).setdefault(created_at.strftime("%Y-%m"), 0)
            counts[user_id][created_at.strftime("%Y-%m")] += 1
        self._monthly_activity_cache = counts
        return counts

    def _recent_activity(self) -> dict[str, int]:
        if self._recent_activity_cache is not None:
            return self._recent_activity_cache
        since = self._now() - timedelta(days=14)
        recent: dict[str, int] = {}
        for user_id, monthly in self._monthly_activity().items():
            recent[user_id] = 0
            for month_key, count in monthly.items():
                marker = datetime.fromisoformat(f"{month_key}-01T00:00:00+00:00")
                if marker >= since.replace(day=1, hour=0, minute=0, second=0, microsecond=0):
                    recent[user_id] += count
        self._recent_activity_cache = recent
        return recent

    def _safe_table_fetch(self, table: str, columns: str, since_field: str | None = None, since_iso: str | None = None) -> list[dict[str, Any]]:
        try:
            query = self.supabase.table(table).select(columns)
            if since_field and since_iso:
                query = query.gte(since_field, since_iso)
            return query.execute().data or []
        except Exception:
            return []

    def _billing_by_account_month(self, rows: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
        monthly: dict[str, dict[str, float]] = {}
        for row in rows:
            account_id = str(row.get("account_id") or "")
            marker = self._parse_dt(row.get("period_start")) or self._parse_dt(row.get("created_at"))
            if not account_id or not marker:
                continue
            monthly.setdefault(account_id, {}).setdefault(marker.strftime("%Y-%m"), 0.0)
            monthly[account_id][marker.strftime("%Y-%m")] += abs(float(row.get("amount") or 0.0))
        return monthly

    def _sum_rows(self, rows: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
        grouped: dict[str, dict[str, float]] = {}
        for row in rows:
            account_id = str(row.get("account_id") or "")
            if not account_id:
                continue
            grouped.setdefault(account_id, {"count": 0, "amount": 0.0})
            grouped[account_id]["count"] += 1
            grouped[account_id]["amount"] += abs(float(row.get("amount") or 0.0))
        return grouped

    def _latest_row_by_account(self, rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        latest: dict[str, dict[str, Any]] = {}
        for row in sorted(rows, key=lambda item: item.get("created_at") or "", reverse=True):
            account_id = str(row.get("account_id") or "")
            if account_id and account_id not in latest:
                latest[account_id] = row
        return latest

    def _usage_growth_multiple(self, monthly_counts: dict[str, int]) -> float:
        values = [count for _, count in sorted(monthly_counts.items()) if count > 0]
        if len(values) < 2 or values[0] == 0:
            return 1.0
        return values[-1] / values[0]

    def _apply_trend_context(self, findings: list[RevenueFinding], memories: list[dict[str, Any]]) -> list[RevenueFinding]:
        memory_text = " ".join(self._memory_text(item) for item in memories).lower()
        adjusted: list[RevenueFinding] = []
        for finding in findings:
            if finding.signal_type.lower() in memory_text:
                finding.description = f"{finding.description} This pattern also appeared in prior revenue scans."
            adjusted.append(finding)
        return adjusted

    def _memory_text(self, item: dict[str, Any]) -> str:
        for key in ("memory", "text", "content"):
            value = item.get(key)
            if isinstance(value, str):
                return value
        return ""

    def _month_key(self, months_ago: int) -> str:
        reference = self._now().replace(day=1) - timedelta(days=32 * months_ago)
        return reference.strftime("%Y-%m")

    def _plan_price(self, plan: str | None) -> float:
        return PLAN_PRICES.get((plan or "free").lower(), 0.0)

    def _next_plan_price(self, plan: str | None) -> float:
        current = (plan or "free").lower()
        if current == "free":
            return PLAN_PRICES["basic"]
        if current == "basic":
            return PLAN_PRICES["pro"]
        return PLAN_PRICES["unlimited"]

    def _parse_dt(self, value: Any) -> datetime | None:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)

    def _now(self) -> datetime:
        return datetime.now(UTC).replace(microsecond=0)
