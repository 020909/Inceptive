import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { recipient, subject, body: emailBody, send } = body;

  if (!recipient || !subject || !emailBody) {
    return NextResponse.json(
      { error: "Recipient, subject, and body are required" },
      { status: 400 }
    );
  }

  // If send flag is true, send via Resend
  if (send && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "Inceptive <noreply@inceptive.ai>",
        to: [recipient],
        subject,
        text: emailBody,
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }
  }

  const { data, error } = await supabase
    .from("emails")
    .insert({
      user_id: user.id,
      recipient,
      subject,
      body: emailBody,
      status: send ? "sent" : "draft",
      sent_at: send ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
