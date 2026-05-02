import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getIpAddressFromRequest, getTenantIdFromRequest } from "@/lib/ubo/requestContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TransactionInput {
  transaction_id: string;
  amount: number;
  currency?: string;
  direction?: string;
  counterparty_name?: string;
  transaction_date: string;
  description?: string;
  account_number?: string;
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantIdFromRequest(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
  }

  const admin = createAdminClient();
  let run: { id: string } | undefined;

  try {
    const body = (await request.json()) as {
      sourceAName: string;
      sourceBName: string;
      sourceA: TransactionInput[];
      sourceB: TransactionInput[];
    };

    const { sourceAName, sourceBName, sourceA, sourceB } = body;

    if (!sourceAName || !sourceBName) {
      return NextResponse.json({ error: "Source names are required" }, { status: 400 });
    }
    if (!Array.isArray(sourceA) || !Array.isArray(sourceB)) {
      return NextResponse.json({ error: "sourceA and sourceB must be arrays of transactions" }, { status: 400 });
    }

    const validDirections = ["credit", "debit"];
    const allSourceA = sourceA.filter(tx => validDirections.includes(tx.direction || ""));
    const allSourceB = sourceB.filter(tx => validDirections.includes(tx.direction || ""));

    const runNumber = `RECON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

  const { data: runData, error: runErr } = await admin
    .from("reconciliation_runs")
    .insert({
      tenant_id: tenantId,
      run_number: runNumber,
      source_a_name: sourceAName,
      source_b_name: sourceBName,
    total_source_a: allSourceA.length,
    total_source_b: allSourceB.length,
      status: "running",
    })
    .select()
    .single();

  if (runErr) throw new Error(runErr.message);
  run = runData;

  const aMap = new Map<string, TransactionInput & { _idx: number }>();
  allSourceA.forEach((tx, i) => {
    const key = `${tx.transaction_id}|${tx.amount}|${tx.direction || "credit"}`;
    aMap.set(key, { ...tx, _idx: i });
  });

  const matched: any[] = [];
  const exceptionsA: any[] = [];
  const exceptionsB: any[] = [];
  const usedB = new Set<number>();

  for (const [key, aTx] of aMap) {
    const bIdx = allSourceB.findIndex((bTx, i) => {
      if (usedB.has(i)) return false;
      const bKey = `${bTx.transaction_id}|${bTx.amount}|${bTx.direction || "credit"}`;
      return bKey === key || (bTx.transaction_id === aTx.transaction_id && Math.abs(bTx.amount - aTx.amount) < 0.01);
    });

    if (bIdx >= 0) {
      usedB.add(bIdx);
      const matchGroupId = crypto.randomUUID();
      const { _idx, ...cleanA } = aTx;
      const cleanB = allSourceB[bIdx]!;
      matched.push({ a: cleanA, b: cleanB, matchGroupId });
    } else {
      const { _idx, ...cleanTx } = aTx;
      exceptionsA.push(cleanTx);
    }
  }

  allSourceB.forEach((bTx, i) => {
    if (!usedB.has(i)) {
      exceptionsB.push(bTx);
    }
  });

    for (const m of matched) {
      await admin.from("transactions").insert([
        {
          tenant_id: tenantId,
          transaction_id: m.a.transaction_id,
          source_system: sourceAName,
          amount: m.a.amount,
          currency: m.a.currency || "USD",
          direction: m.a.direction || "credit",
          counterparty_name: m.a.counterparty_name,
          transaction_date: m.a.transaction_date,
          description: m.a.description,
          account_number: m.a.account_number,
          matched: true,
          match_group_id: m.matchGroupId,
reconciliation_run_id: run!.id,
            },
            {
              tenant_id: tenantId,
              transaction_id: m.b.transaction_id,
              source_system: sourceBName,
              amount: m.b.amount,
              currency: m.b.currency || "USD",
              direction: m.b.direction || "credit",
              counterparty_name: m.b.counterparty_name,
              transaction_date: m.b.transaction_date,
              description: m.b.description,
              account_number: m.b.account_number,
              matched: true,
              match_group_id: m.matchGroupId,
              reconciliation_run_id: run!.id,
        },
      ]);
    }

    for (const eTx of [...exceptionsA, ...exceptionsB]) {
      const source = exceptionsA.includes(eTx) ? sourceAName : sourceBName;
      await admin.from("transactions").insert({
        tenant_id: tenantId,
        transaction_id: eTx.transaction_id,
        source_system: source,
        amount: eTx.amount,
        currency: eTx.currency || "USD",
        direction: eTx.direction || "credit",
        counterparty_name: eTx.counterparty_name,
        transaction_date: eTx.transaction_date,
        description: eTx.description,
        account_number: eTx.account_number,
        matched: false,
      reconciliation_run_id: run!.id,
      });
      }

      const exceptions = [
        ...exceptionsA.map((tx) => ({ source: sourceAName, ...tx })),
        ...exceptionsB.map((tx) => ({ source: sourceBName, ...tx })),
      ];

      await admin
        .from("reconciliation_runs")
        .update({
          matched_count: matched.length,
          exception_count: exceptions.length,
          status: "completed",
          exceptions: exceptions,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run!.id);

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const actorEmail = authUser?.user?.email || "system@inceptive-ai.com";

  try {
    await admin.from("audit_log").insert({
      tenant_id: tenantId,
      actor_id: userId,
      actor_email: actorEmail,
      action_type: "reconciliation_completed",
      entity_type: "reconciliation_run",
      entity_id: run!.id,
      after_state: {
        run_number: runNumber,
        matched: matched.length,
        exceptions: exceptions.length,
        source_a: sourceAName,
        source_b: sourceBName,
      },
      ip_address: getIpAddressFromRequest(request),
    });
  } catch (auditErr) {
    console.error("Audit log insert failed:", auditErr);
  }

    return NextResponse.json({
      success: true,
      run: {
        id: run!.id,
        run_number: runNumber,
        matched_count: matched.length,
        exception_count: exceptions.length,
    total_source_a: allSourceA.length,
    total_source_b: allSourceB.length,
  },
  exceptions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconciliation failed";
    console.error("Error in reconciliation:", error);
    if (run) {
      try {
        await admin.from("reconciliation_runs").update({ status: "failed" }).eq("id", run.id);
      } catch (_) { /* best effort */ }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantIdFromRequest(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: runs, error } = await admin
      .from("reconciliation_runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ runs: runs || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch runs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
