import { createClient } from "@supabase/supabase-js";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key);
}

export async function checkRateLimit(params: {
  identifier: string;
  route: string;
  maxRequests: number;
  windowMinutes: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const supabase = createServiceClient();
  const windowStart = new Date(Date.now() - params.windowMinutes * 60 * 1000);

  void (async () => {
    try {
      await supabase.rpc("cleanup_rate_limits");
    } catch {
      // Cleanup should never block request evaluation.
    }
  })();

  const { data } = await supabase
    .from("rate_limits")
    .select("request_count, window_start")
    .eq("identifier", params.identifier)
    .eq("route", params.route)
    .maybeSingle();

  if (!data || new Date(data.window_start) < windowStart) {
    await supabase.from("rate_limits").upsert(
      {
        identifier: params.identifier,
        route: params.route,
        request_count: 1,
        window_start: new Date().toISOString(),
      },
      { onConflict: "identifier,route" }
    );

    return {
      allowed: true,
      remaining: params.maxRequests - 1,
      resetAt: new Date(Date.now() + params.windowMinutes * 60 * 1000),
    };
  }

  if (data.request_count >= params.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(
        new Date(data.window_start).getTime() + params.windowMinutes * 60 * 1000
      ),
    };
  }

  await supabase
    .from("rate_limits")
    .update({ request_count: data.request_count + 1 })
    .eq("identifier", params.identifier)
    .eq("route", params.route);

  return {
    allowed: true,
    remaining: params.maxRequests - data.request_count - 1,
    resetAt: new Date(
      new Date(data.window_start).getTime() + params.windowMinutes * 60 * 1000
    ),
  };
}

export function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimitResponse(resetAt: Date): Response {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString(),
        "X-RateLimit-Reset": resetAt.toISOString(),
      },
    }
  );
}
