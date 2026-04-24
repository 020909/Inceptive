from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any


LINE_ITEM_PATTERN = re.compile(
    r"(?P<label>[A-Za-z][A-Za-z0-9 \-_/&().]{2,})\s+\$?(?P<amount>\d[\d,]*(?:\.\d{2})?)",
    re.MULTILINE,
)
AMOUNT_PATTERNS = [
    re.compile(r"(?:total due|amount due|invoice total|balance due|total)\s*[:\-]?\s*\$?(?P<amount>\d[\d,]*(?:\.\d{2})?)", re.IGNORECASE),
    re.compile(r"\$\s?(?P<amount>\d[\d,]*(?:\.\d{2})?)"),
]
DATE_PATTERNS = [
    re.compile(r"(?:due date|payment due)\s*[:\-]?\s*(?P<date>[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})", re.IGNORECASE),
    re.compile(r"(?:due date|payment due)\s*[:\-]?\s*(?P<date>\d{4}-\d{2}-\d{2})", re.IGNORECASE),
    re.compile(r"(?:due date|payment due)\s*[:\-]?\s*(?P<date>\d{1,2}/\d{1,2}/\d{2,4})", re.IGNORECASE),
]
VENDOR_PATTERNS = [
    re.compile(r"(?:vendor|supplier|bill from)\s*[:\-]?\s*(?P<name>[^\n]+)", re.IGNORECASE),
    re.compile(r"invoice from\s*(?P<name>[^\n]+)", re.IGNORECASE),
]


@dataclass(slots=True)
class ParsedInvoice:
    vendor_name: str | None
    amount: float | None
    due_date: str | None
    line_items: list[dict[str, Any]]
    raw_text: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "vendor_name": self.vendor_name,
            "amount": self.amount,
            "due_date": self.due_date,
            "line_items": self.line_items,
            "raw_text": self.raw_text,
        }


def _pdf_to_text(path: str) -> str:
    # Adapted from invoice2data's pdfminer_wrapper: PDF page iteration -> text accumulator.
    from pdfminer.converter import TextConverter
    from pdfminer.layout import LAParams
    from pdfminer.pdfinterp import PDFPageInterpreter, PDFResourceManager
    from pdfminer.pdfpage import PDFPage
    from io import StringIO

    resource_manager = PDFResourceManager()
    text_buffer = StringIO()
    layout_params = LAParams()
    layout_params.all_texts = True
    converter = TextConverter(resource_manager, text_buffer, laparams=layout_params)
    try:
        with Path(path).open("rb") as handle:
            interpreter = PDFPageInterpreter(resource_manager, converter)
            for page in PDFPage.get_pages(handle, set(), maxpages=0, password="", caching=True, check_extractable=True):
                interpreter.process_page(page)
        return text_buffer.getvalue()
    finally:
        converter.close()
        text_buffer.close()


def _normalize_input(text: str) -> str:
    # Adapted from invoice2data's InvoiceTemplate.prepare_input: whitespace normalization first.
    collapsed = re.sub(r"[ \t]+", " ", text)
    collapsed = re.sub(r"\n{3,}", "\n\n", collapsed)
    return collapsed.strip()


def _parse_currency(value: str) -> float:
    cleaned = value.replace(",", "").replace("$", "").strip()
    return round(float(cleaned), 2)


def _parse_date(value: str) -> str | None:
    value = value.strip()
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed.replace(tzinfo=UTC).isoformat()
        except ValueError:
            continue
    return None


def _extract_vendor_name(text: str) -> str | None:
    for pattern in VENDOR_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group("name").strip()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[0] if lines else None


def _extract_amount(text: str) -> float | None:
    for pattern in AMOUNT_PATTERNS:
        match = pattern.search(text)
        if match:
            return _parse_currency(match.group("amount"))
    return None


def _extract_due_date(text: str) -> str | None:
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            return _parse_date(match.group("date"))
    return None


def _extract_line_items(text: str, limit: int = 8) -> list[dict[str, Any]]:
    # Adapted from invoice2data's grouped field extraction: gather repeated matches, dedupe, and trim.
    items: list[dict[str, Any]] = []
    seen: set[tuple[str, float]] = set()
    for match in LINE_ITEM_PATTERN.finditer(text):
        label = re.sub(r"\s+", " ", match.group("label")).strip(" -:")
        amount = _parse_currency(match.group("amount"))
        key = (label.lower(), amount)
        if key in seen:
            continue
        seen.add(key)
        items.append({"description": label, "amount": amount})
        if len(items) >= limit:
            break
    return items


def parse_invoice_pdf_bytes(content: bytes) -> ParsedInvoice:
    with NamedTemporaryFile(suffix=".pdf", delete=True) as temp_file:
        temp_file.write(content)
        temp_file.flush()
        raw_text = _normalize_input(_pdf_to_text(temp_file.name))

    return ParsedInvoice(
        vendor_name=_extract_vendor_name(raw_text),
        amount=_extract_amount(raw_text),
        due_date=_extract_due_date(raw_text),
        line_items=_extract_line_items(raw_text),
        raw_text=raw_text,
    )
