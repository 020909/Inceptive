from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from agents.vendor_agent import VendorAgent
from utils.supabase import get_supabase_client
from utils.vendor_invoice_parser import parse_invoice_pdf_bytes


router = APIRouter(tags=["vendors"])


class ResolveVendorAlertRequest(BaseModel):
    resolution_note: str | None = None


@router.post("/agents/vendor/run")
async def run_vendor_agent() -> dict:
    agent = VendorAgent(get_supabase_client())
    return agent.run()


@router.get("/agents/vendor/alerts")
async def list_vendor_alerts(
    severity: str | None = None,
    alert_type: str | None = None,
    limit: int = 100,
) -> dict:
    agent = VendorAgent(get_supabase_client())
    return agent.list_alerts(severity=severity, alert_type=alert_type, limit=limit)


@router.post("/agents/vendor/resolve/{alert_id}")
async def resolve_vendor_alert(alert_id: str, payload: ResolveVendorAlertRequest) -> dict:
    agent = VendorAgent(get_supabase_client())
    alert = agent.resolve_alert(alert_id, payload.resolution_note)
    if not alert:
        raise HTTPException(status_code=404, detail="Vendor alert not found or already resolved.")
    return {"alert": alert}


@router.get("/agents/vendor/summary")
async def get_vendor_summary() -> dict:
    agent = VendorAgent(get_supabase_client())
    return agent.summary()


@router.post("/vendors/parse-invoice")
async def parse_invoice(
    file: UploadFile = File(...),
    confirm: bool = Form(default=False),
    vendor_id: str | None = Form(default=None),
) -> dict:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="Only PDF invoice uploads are supported.")

    content = await file.read()
    parsed = parse_invoice_pdf_bytes(content)
    payload = parsed.to_dict()

    if not confirm:
        return {"saved": False, "extracted": payload}

    supabase = get_supabase_client()
    matched_vendor_id = vendor_id
    if not matched_vendor_id:
        if parsed.vendor_name:
            existing = (
                supabase.table("vendors")
                .select("id,name")
                .ilike("name", parsed.vendor_name)
                .limit(1)
                .execute()
                .data
                or []
            )
            if existing:
                matched_vendor_id = existing[0]["id"]
        if not matched_vendor_id:
            inserted_vendor = (
                supabase.table("vendors")
                .insert(
                    {
                        "name": parsed.vendor_name or file.filename.replace(".pdf", ""),
                        "contract_value": parsed.amount or 0,
                        "sla_terms": {},
                        "status": "active",
                    }
                )
                .execute()
                .data
                or []
            )
            matched_vendor_id = inserted_vendor[0]["id"]

    invoice_row = (
        supabase.table("invoices")
        .insert(
            {
                "vendor_id": matched_vendor_id,
                "amount": parsed.amount or 0,
                "due_date": parsed.due_date,
                "status": "parsed",
                "raw_text": parsed.raw_text,
                "line_items": parsed.line_items,
            }
        )
        .execute()
        .data
        or []
    )
    return {"saved": True, "invoice": invoice_row[0] if invoice_row else None, "extracted": payload}
