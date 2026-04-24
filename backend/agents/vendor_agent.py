from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from supabase import Client

from memory.mem0_client import get_memories, save_memory
from observability.tracer import trace_agent
from utils.vendor_sla import predict_sla_breach


VENDOR_AGENT_ID = "vendor_agent"


@dataclass(slots=True)
class VendorAlert:
    vendor_id: str
    alert_type: str
    severity: str
    description: str
    dollar_impact: float
    detected_at: str
    status: str = "open"

    @property
    def alert_id(self) -> str:
        stable = f"{self.vendor_id}:{self.alert_type}:{self.description}"
        return str(uuid5(NAMESPACE_URL, stable))

    def to_record(self) -> dict[str, Any]:
        return {
            "id": self.alert_id,
            "vendor_id": self.vendor_id,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "description": self.description,
            "dollar_impact": round(self.dollar_impact, 2),
            "detected_at": self.detected_at,
            "status": self.status,
        }


class VendorAgent:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase
        self._vendors_cache: list[dict[str, Any]] | None = None
        self._invoices_cache: list[dict[str, Any]] | None = None
        self._delivery_cache: list[dict[str, Any]] | None = None

    @trace_agent
    def run(self) -> dict[str, Any]:
        detected_at = self._now().isoformat()
        prior_memories = get_memories(
            user_id="system",
            agent_id=VENDOR_AGENT_ID,
            query="past vendor overbilling, SLA breaches, renewals, and vendor performance issues",
            scope="agent",
            limit=5,
        )
        sla_alerts = self.detect_sla_breaches()
        alerts = [
            *sla_alerts,
            *self.detect_overbilling(),
            *self.detect_upcoming_renewals(sla_alerts),
            *self.detect_underperforming_vendors(sla_alerts),
        ]
        alerts = self._apply_trend_context(alerts, prior_memories)
        if alerts:
            self.supabase.table("vendor_alerts").upsert(
                [alert.to_record() for alert in alerts],
                on_conflict="id",
            ).execute()

        total_overbilling = round(
            sum(alert.dollar_impact for alert in alerts if alert.alert_type == "overbilling"),
            2,
        )
        renewal_value_at_risk = round(
            sum(alert.dollar_impact for alert in alerts if alert.alert_type == "upcoming_renewal"),
            2,
        )
        breach_count = sum(1 for alert in alerts if alert.alert_type == "sla_breach")
        summary = (
            f"Vendor scan on {detected_at}: {len(alerts)} alerts, "
            f"${total_overbilling:.2f} overbilling detected, "
            f"${renewal_value_at_risk:.2f} renewal value at risk, {breach_count} SLA breach alerts."
        )
        save_memory(user_id="system", agent_id=VENDOR_AGENT_ID, content=summary, scope="agent")
        return {
            "detected_at": detected_at,
            "total_overbilling": total_overbilling,
            "renewal_value_at_risk": renewal_value_at_risk,
            "breach_count": breach_count,
            "alerts": [alert.to_record() for alert in alerts],
        }

    def list_alerts(self, *, severity: str | None = None, alert_type: str | None = None, limit: int = 100) -> dict[str, Any]:
        query = (
            self.supabase.table("vendor_alerts")
            .select("*, vendors(name)")
            .eq("status", "open")
            .order("dollar_impact", desc=True)
            .limit(max(1, min(limit, 500)))
        )
        if severity:
            query = query.eq("severity", severity)
        if alert_type:
            query = query.eq("alert_type", alert_type)
        rows = query.execute().data or []
        return {"count": len(rows), "alerts": rows}

    def resolve_alert(self, alert_id: str, resolution_note: str | None = None) -> dict[str, Any]:
        payload = {
            "status": "resolved",
            "resolution_note": resolution_note,
            "resolved_at": self._now().isoformat(),
        }
        response = (
            self.supabase.table("vendor_alerts")
            .update(payload)
            .eq("id", alert_id)
            .eq("status", "open")
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else {}

    def summary(self) -> dict[str, Any]:
        open_alerts = (
            self.supabase.table("vendor_alerts")
            .select("alert_type,severity,dollar_impact")
            .eq("status", "open")
            .execute()
            .data
            or []
        )
        return {
            "total_vendors": len(self._vendors()),
            "overbilling_detected": round(
                sum(float(row.get("dollar_impact") or 0.0) for row in open_alerts if row.get("alert_type") == "overbilling"),
                2,
            ),
            "renewals_due": sum(1 for row in open_alerts if row.get("alert_type") == "upcoming_renewal"),
            "sla_breaches_this_month": sum(1 for row in open_alerts if row.get("alert_type") == "sla_breach"),
            "critical_count": sum(1 for row in open_alerts if row.get("severity") == "critical"),
        }

    def detect_sla_breaches(self) -> list[VendorAlert]:
        findings: list[VendorAlert] = []
        window_start = self._now() - timedelta(days=30)
        deliveries = [row for row in self._delivery_records() if (self._parse_dt(row.get("created_at")) or window_start) >= window_start]
        grouped: dict[str, list[float]] = {}
        for record in deliveries:
            vendor_id = str(record.get("vendor_id") or "")
            actual = float(record.get("delivery_minutes") or 0.0)
            if vendor_id and actual:
                grouped.setdefault(vendor_id, []).append(actual)

        for vendor in self._vendors():
            vendor_id = str(vendor["id"])
            sla_terms = vendor.get("sla_terms") or {}
            threshold = float(sla_terms.get("delivery_target_minutes") or 0.0)
            values = grouped.get(vendor_id, [])
            if not threshold or len(values) < 3:
                continue
            prediction = predict_sla_breach(values, threshold)
            violations = sum(1 for value in values if value > threshold)
            if violations <= 2 or not prediction.is_breach:
                continue
            contract_value = float(vendor.get("contract_value") or 0.0)
            findings.append(
                self._alert(
                    vendor_id=vendor_id,
                    alert_type="sla_breach",
                    severity="critical" if contract_value > 10_000 else "warning",
                    dollar_impact=max(contract_value * 0.1, 250.0),
                    description=f"{violations} SLA violations in 30 days with predicted delivery latency {prediction.predicted_value:.1f} minutes against a {threshold:.1f}-minute target.",
                )
            )
        return findings

    def detect_overbilling(self) -> list[VendorAlert]:
        findings: list[VendorAlert] = []
        for invoice in self._invoices():
            vendor = self._vendor_map().get(str(invoice.get("vendor_id") or ""))
            if not vendor:
                continue
            contracted = float(vendor.get("contract_value") or 0.0)
            amount = float(invoice.get("amount") or 0.0)
            if contracted <= 0 or amount <= contracted * 1.05:
                continue
            findings.append(
                self._alert(
                    vendor_id=str(vendor["id"]),
                    alert_type="overbilling",
                    severity="critical" if amount > contracted * 1.15 else "warning",
                    dollar_impact=amount - contracted,
                    description=f"Invoice amount ${amount:.2f} is more than 5% above the contracted rate of ${contracted:.2f}.",
                )
            )
        return findings

    def detect_upcoming_renewals(self, sla_alerts: list[VendorAlert] | None = None) -> list[VendorAlert]:
        findings: list[VendorAlert] = []
        now = self._now()
        breach_vendors = {alert.vendor_id for alert in (sla_alerts or self.detect_sla_breaches())}
        for vendor in self._vendors():
            renewal = self._parse_dt(vendor.get("renewal_date"))
            if not renewal:
                continue
            days = (renewal - now).days
            if not 0 <= days <= 60:
                continue
            breach_flag = str(vendor["id"]) in breach_vendors
            findings.append(
                self._alert(
                    vendor_id=str(vendor["id"]),
                    alert_type="upcoming_renewal",
                    severity="critical" if days <= 14 or breach_flag else "warning",
                    dollar_impact=float(vendor.get("contract_value") or 0.0),
                    description=f"Vendor contract renews on {renewal.date()} with {'performance concerns' if breach_flag else 'no major performance issue logged yet'}.",
                )
            )
        return findings

    def detect_underperforming_vendors(self, sla_alerts: list[VendorAlert] | None = None) -> list[VendorAlert]:
        breach_counts: dict[str, int] = {}
        for alert in (sla_alerts or self.detect_sla_breaches()):
            breach_counts[alert.vendor_id] = breach_counts.get(alert.vendor_id, 0) + 1

        paid_by_vendor: dict[str, float] = {}
        for invoice in self._invoices():
            if str(invoice.get("status") or "").lower() != "paid":
                continue
            vendor_id = str(invoice.get("vendor_id") or "")
            paid_by_vendor[vendor_id] = paid_by_vendor.get(vendor_id, 0.0) + float(invoice.get("amount") or 0.0)

        findings: list[VendorAlert] = []
        for vendor in self._vendors():
            vendor_id = str(vendor["id"])
            if breach_counts.get(vendor_id, 0) < 3 or paid_by_vendor.get(vendor_id, 0.0) <= 0:
                continue
            findings.append(
                self._alert(
                    vendor_id=vendor_id,
                    alert_type="underperforming_vendor",
                    severity="critical",
                    dollar_impact=paid_by_vendor[vendor_id],
                    description=f"Vendor has repeated SLA breaches while still receiving ${paid_by_vendor[vendor_id]:.2f} in full payment.",
                )
            )
        return findings

    def _alert(self, *, vendor_id: str, alert_type: str, severity: str, dollar_impact: float, description: str) -> VendorAlert:
        return VendorAlert(
            vendor_id=vendor_id,
            alert_type=alert_type,
            severity=severity,
            description=description,
            dollar_impact=max(round(dollar_impact, 2), 0.0),
            detected_at=self._now().isoformat(),
        )

    def _vendors(self) -> list[dict[str, Any]]:
        if self._vendors_cache is None:
            self._vendors_cache = (
                self.supabase.table("vendors")
                .select("*")
                .order("created_at", desc=False)
                .execute()
                .data
                or []
            )
        return self._vendors_cache

    def _vendor_map(self) -> dict[str, dict[str, Any]]:
        return {str(item["id"]): item for item in self._vendors()}

    def _invoices(self) -> list[dict[str, Any]]:
        if self._invoices_cache is None:
            self._invoices_cache = (
                self.supabase.table("invoices")
                .select("*")
                .order("created_at", desc=False)
                .execute()
                .data
                or []
            )
        return self._invoices_cache

    def _delivery_records(self) -> list[dict[str, Any]]:
        if self._delivery_cache is None:
            try:
                self._delivery_cache = (
                    self.supabase.table("vendor_delivery_records")
                    .select("*")
                    .order("created_at", desc=False)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                self._delivery_cache = []
        return self._delivery_cache

    def _apply_trend_context(self, alerts: list[VendorAlert], memories: list[dict[str, Any]]) -> list[VendorAlert]:
        memory_text = " ".join(self._memory_text(item) for item in memories).lower()
        for alert in alerts:
            if alert.alert_type.lower() in memory_text:
                alert.description = f"{alert.description} This issue also appeared in prior vendor scans."
        return alerts

    def _memory_text(self, item: dict[str, Any]) -> str:
        for key in ("memory", "text", "content"):
            value = item.get(key)
            if isinstance(value, str):
                return value
        return ""

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
