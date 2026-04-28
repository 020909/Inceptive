# Subagent prompt templates

These templates are used by the parent orchestrator to spawn domain-scoped subagents in waves.

Constraints (always):
- Do not touch marketing or public site
- Do not touch auth flows
- Keep Stripe billing + webhook routes intact (remove only computer-use/agent-credit logic)
- Do not edit `DESIGN_SYSTEM.md`
- Use Foundry Black tokens; no indigo/purple/coral/teal accents
- No shadows, gradients, glow, glass, hover-scale, or rounded-xl cards

Every subagent must:
- Read `DESIGN_SYSTEM.md` and `BUILD_JOURNAL.md` before editing
- Touch ONLY its assigned paths
- Run `npm run build` and `npm run lint`
- Append a report to `BUILD_JOURNAL.md`

