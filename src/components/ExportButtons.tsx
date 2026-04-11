"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trackClientEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

interface ExportButtonsProps {
  orgId: string;
  userId: string;
  pdfType: "morning_report" | "lead_report";
  pdfData: Record<string, unknown>;
  excelType: "leads" | "activity";
  excelData: Record<string, unknown>[];
}

async function downloadFile(endpoint: string, payload: unknown, fallbackFileName: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Download failed.";
    try {
      const json = await response.json();
      message = json.error || message;
    } catch {}
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get("Content-Disposition");
  const fileNameMatch = disposition?.match(/filename="([^"]+)"/);
  const fileName = fileNameMatch?.[1] || fallbackFileName;

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function ExportButtons({ orgId, userId, pdfType, pdfData, excelType, excelData }: ExportButtonsProps) {
  const [activeExport, setActiveExport] = useState<"pdf" | "excel" | null>(null);

  async function handlePdfDownload() {
    try {
      setActiveExport("pdf");
      await downloadFile(
        "/api/generate-pdf",
        { type: pdfType, data: pdfData },
        "inceptive-report.pdf"
      );
      trackClientEvent(orgId, userId, "document_downloaded", { type: "pdf" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate PDF.");
    } finally {
      setActiveExport(null);
    }
  }

  async function handleExcelDownload() {
    try {
      setActiveExport("excel");
      await downloadFile(
        "/api/generate-excel",
        { type: excelType, data: excelData },
        "inceptive-export.xlsx"
      );
      trackClientEvent(orgId, userId, "document_downloaded", { type: "excel" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate Excel.");
    } finally {
      setActiveExport(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={handlePdfDownload} disabled={activeExport !== null} size="lg">
        {activeExport === "pdf" ? <Loader2 className="animate-spin" /> : null}
        Download PDF Report
      </Button>
      <Button onClick={handleExcelDownload} disabled={activeExport !== null} size="lg" variant="outline">
        {activeExport === "excel" ? <Loader2 className="animate-spin" /> : null}
        Export to Excel
      </Button>
    </div>
  );
}
