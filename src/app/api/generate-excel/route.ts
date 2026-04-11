import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import {
  generateActivityExcel,
  generateLeadsExcel,
  type Activity,
  type Lead,
} from "@/lib/excel-generator";

export const runtime = "nodejs";
export const maxDuration = 30;

const leadSchema = z.object({
  name: z.string(),
  company: z.string(),
  title: z.string(),
  email: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  dateAdded: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

const activitySchema = z.object({
  dateTime: z.string(),
  actionType: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  status: z.string(),
  duration: z.string().optional().nullable(),
});

const requestSchema = z.object({
  type: z.enum(["leads", "activity"]),
  data: z.array(z.record(z.string(), z.unknown())),
});

function fileNameForType(type: z.infer<typeof requestSchema>["type"]) {
  return type === "leads" ? "inceptive-leads.xlsx" : "inceptive-activity-log.xlsx";
}

export async function POST(request: Request) {
  try {
    const authenticatedUserId = await getAuthenticatedUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());

    const buffer =
      payload.type === "leads"
        ? generateLeadsExcel(z.array(leadSchema).parse(payload.data) as Lead[])
        : generateActivityExcel(z.array(activitySchema).parse(payload.data) as Activity[]);

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileNameForType(payload.type)}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate Excel.";
    console.error("[generate-excel]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
