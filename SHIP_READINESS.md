# Ship readiness — Compliance OS (UBO Unwrapper)

## What’s working (build gates)
- `npm run build`: PASS
- `npm run lint`: PASS (warnings only)

## Primary demo flow (happy path)
1. Go to `/ubo`
2. Upload a KYB/UBO document (PDF/PNG/JPG; DOCX uploads but parsing may fail)
3. Watch pipeline stepper (realtime `approval_queue` updates)
4. Review extracted entities + citations drawer
5. Inspect ownership graph visualization
6. Go to `/approval-queue` and **Approve** / **Reject**
7. Go to `/audit-trail` and confirm immutable log entries were written

## Secrets safety check (client bundles)
- Searched `.next/static/chunks` for common secret keys and patterns:
  - `OPENROUTER_KEY`, `OPENROUTER_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENSANCTIONS_API_KEY`
  - `sk-...` token patterns  
  Result: **no matches found**.

## Known limitations
- **DOCX parsing**: upload accepted; parsing currently throws “not supported yet”.
- **Sanctions screening**: OpenSanctions calls are skipped if `OPENSANCTIONS_API_KEY` is not set.
- **Audit actor email**: approval endpoints currently log `actor_email` as a placeholder (`user@inceptive-ai.com`).

