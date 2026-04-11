import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import {
  LeadReportPDF,
  MorningReportPDF,
  type LeadReportPDFProps,
  type MorningReportPDFProps,
} from "@/lib/pdf-generator";

export const runtime = "nodejs";
export const maxDuration = 30;

const morningReportSchema = z.object({
  date: z.string().min(1),
  orgName: z.string().min(1),
  stats: z.object({
    tasks: z.number(),
    emails: z.number(),
    leads: z.number(),
    hoursSaved: z.union([z.number(), z.string()]),
  }),
  highlights: z.array(z.string()),
  agentLog: z.array(
    z.object({
      time: z.string(),
      action: z.string(),
      result: z.string(),
    })
  ),
});

const leadReportSchema = z.object({
  date: z.string().min(1),
  searchCriteria: z.string().min(1),
  leads: z.array(
    z.object({
      name: z.string(),
      company: z.string(),
      title: z.string(),
      email: z.string().optional().nullable(),
      linkedin: z.string().optional().nullable(),
      notes: z.string(),
    })
  ),
});

const requestSchema = z.object({
  type: z.enum(["morning_report", "lead_report"]),
  data: z.record(z.string(), z.unknown()),
});

function fileNameForType(type: z.infer<typeof requestSchema>["type"]) {
  return type === "morning_report" ? "inceptive-morning-report.pdf" : "inceptive-lead-report.pdf";
}

async function renderMorningReportBuffer(data: MorningReportPDFProps) {
  return renderToBuffer(
    React.createElement(MorningReportPDF, data) as unknown as React.ReactElement<DocumentProps>
  );
}

async function renderLeadReportBuffer(data: LeadReportPDFProps) {
  return renderToBuffer(
    React.createElement(LeadReportPDF, data) as unknown as React.ReactElement<DocumentProps>
  );
}

export async function POST(request: Request) {
  try {
    const authenticatedUserId = await getAuthenticatedUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());

    const buffer =
      payload.type === "morning_report"
        ? await renderMorningReportBuffer(morningReportSchema.parse(payload.data) as MorningReportPDFProps)
        : await renderLeadReportBuffer(leadReportSchema.parse(payload.data) as LeadReportPDFProps);

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileNameForType(payload.type)}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate PDF.";
    console.error("[generate-pdf]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
