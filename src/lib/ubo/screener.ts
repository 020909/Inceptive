import "server-only";

export type OpenSanctionsMatchResult = {
  screened: boolean;
  provider: "opensanctions" | "none";
  reason?: string;
  matches?: Array<{
    score: number;
    entity: { id: string; caption?: string; schema?: string };
    datasets?: string[];
  }>;
};

export async function screenEntity(opts: {
  name: string;
  schema: "Person" | "Company";
  birthDate?: string | null;
  nationality?: string | null;
}): Promise<OpenSanctionsMatchResult> {
  const apiKey = process.env.OPENSANCTIONS_API_KEY?.trim();
  if (!apiKey) {
    return { screened: false, provider: "none", reason: "OPENSANCTIONS_API_KEY not set" };
  }

  const body = {
    queries: {
      q1: {
        schema: opts.schema,
        properties: {
          name: [opts.name],
          ...(opts.birthDate ? { birthDate: [opts.birthDate] } : {}),
          ...(opts.nationality ? { nationality: [opts.nationality] } : {}),
        },
      },
    },
  };

  const res = await fetch("https://api.opensanctions.org/match/default", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return {
      screened: false,
      provider: "opensanctions",
      reason: `OpenSanctions error: ${res.status}`,
    };
  }

  const json = (await res.json()) as any;
  const matches: any[] = json?.responses?.q1?.matches || [];

  const simplified = matches.map((m) => ({
    score: m?.score ?? 0,
    entity: { id: m?.id, caption: m?.caption, schema: m?.schema },
    datasets: m?.datasets,
  }));

  return {
    screened: true,
    provider: "opensanctions",
    matches: simplified,
  };
}

