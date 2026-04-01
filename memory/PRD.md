# Inceptive AI v2 — Product Requirements Document

## Original Problem Statement
Build Inceptive into the undisputed #1 AI coding and productivity platform with a 10-agent "Perfectionist Studio" that delivers production-grade websites, full-stack apps, PPTs, Excel files, and PDFs. Must use only free models (Qwen 3.6 Plus Preview + Minimax M2.5), no paid APIs.

## Tech Stack (Unchanged)
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Next.js API Routes, Supabase (Auth + DB), Vercel
- **AI Models**: Qwen 3.6 Plus Preview + Minimax M2.5 (FREE only, via OpenRouter)
- **Zero paid APIs or new dependencies**

## What's Been Implemented

### Phase 1: Foundation & Studio Mode (COMPLETE)
- Drag-to-resize split-screen with spring physics (25-75% range)
- Premium Framer Motion animations on all messages and panels
- Studio Mode toggle in header with event count badge
- Studio Mode side panel (300px) with live debate feed, phase progress, trust scores
- Sidebar: added Projects + GitHub navigation
- 12+ new CSS utility classes (glassmorphism, glow effects, premium buttons, trust badges, agent rings, scroll reveal, page transitions, stagger children)

### Phase 2: 10-Agent Council Engine (COMPLETE)
- **Council Types** — 10 agents: Planner, UX Designer, Architect, Coder, Critic, Tester, Doc Specialist, Visual Polish, Deployer, Orchestrator
- **Council Engine v2** — 4-phase execution with style memory injection, trust scoring (0-100)
- **Smart agent selection** — only relevant agents activate per task
- **Real-time streaming** — council events streamed via shared enqueue bridge
- **Style Memory** — API route + Supabase table + agent integration. Remembers user preferences across sessions
- **New tools**: saveStylePreference, createProject, fetchUrl

### Phase 3: Projects System (COMPLETE)
- Projects page with New Project modal (6 templates)
- Project cards with staggered animations, search, empty state
- Full CRUD API (GET/POST/PATCH/DELETE) with Supabase RLS
- Supabase migration: projects, style_preferences, github_connections tables

### GitHub Integration (COMPLETE)
- Full GitHub connection page with PAT-based auth
- Repo listing with real-time GitHub API calls
- Connected state management, repo selection UI
- Branch display, disconnect capability

### URL/Article/YouTube Analysis (COMPLETE)
- New `fetchUrl` tool in stream route
- YouTube transcript extraction via free API
- General webpage content extraction (HTML→text with boilerplate removal)
- JSON response detection
- Title + meta description extraction

### Premium UI Overhaul (COMPLETE)
- **Glassmorphism**: `.glass-panel`, `.glass-card` with backdrop blur
- **Glow effects**: `.glow-accent`, `.glow-accent-hover`, `.glow-success`
- **Premium buttons**: `.btn-premium` with gradient shine on hover, scale on active
- **Trust badges**: `.trust-high/medium/low` with color coding
- **Agent ring animation**: Pulsing ring on active agents
- **Focus ring**: Accessible focus-visible outline
- **Enhanced preview**: Animated tab switching, "Run" button with Play icon
- **Copy feedback**: Check icon on successful copy

### Premium Document Generation (COMPLETE)
- PowerPoint v2: 6 slide layouts (title, content, two-column, section-break, chart, blank)
- Charts support (bar, line, pie) with Inceptive color palette
- Speaker notes, slide numbers, gradient backgrounds
- Professional typography (Helvetica Neue)

## Design Constraints (Strictly Followed)
- NO color changes — exact same dark theme
- NO new paid models — only Qwen 3.6 Plus + Minimax M2.5
- NO tech stack changes — remains Next.js 15 + Supabase + Vercel
- NO new dependencies — package.json unchanged

## Files Created/Modified

### New Files (9)
1. `src/lib/agent/council-types.ts` — 10 agent definitions + selection logic
2. `src/lib/agent/council.ts` — Council engine v2 with style memory + trust scoring
3. `src/components/agent/AgentCouncilPanel.tsx` — Agent avatar strip UI
4. `src/components/agent/StudioModePanel.tsx` — Premium Studio Mode panel
5. `src/app/(dashboard)/projects/page.tsx` — Projects page
6. `src/app/(dashboard)/github/page.tsx` — GitHub connection page
7. `src/app/api/projects/route.ts` — Projects CRUD API
8. `src/app/api/style-memory/route.ts` — Style memory API
9. `supabase/025_projects_style_github.sql` — Database migration

### Modified Files (8)
1. `src/app/api/agent/stream/route.ts` — Council integration, new tools, streaming
2. `src/app/(dashboard)/dashboard/page.tsx` — Split-screen, Studio Mode, animations
3. `src/app/api/generate/powerpoint/route.ts` — Premium PPT generation v2
4. `src/app/globals.css` — 15+ premium CSS utilities
5. `src/components/dashboard/website-preview-panel.tsx` — Animated preview
6. `src/components/layout/sidebar.tsx` — Projects + GitHub nav items
7. `src/components/ui/ai-prompt-box.tsx` — Premium button styling
8. `src/components/ui/progress-indicator.tsx` — Agent-aware indicators
9. `src/lib/ai-model.ts` — Updated debate case
10. `src/lib/ai/model-router.ts` — Updated routing description

## Manual Setup Steps Required
1. Run `supabase/025_projects_style_github.sql` in your Supabase SQL Editor
2. No new env vars needed (uses existing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_KEY)
3. GitHub connection uses Personal Access Tokens (no OAuth app setup needed)

## Remaining / Future Tasks

### P0
- [ ] Run the SQL migration in Supabase
- [ ] E2E testing with real Supabase + OpenRouter keys
- [ ] Verify council streaming in production

### P1
- [ ] Browser control via Playwright (sandboxed)
- [ ] Iterative refinement ("make the hero more premium" → targeted council rework)
- [ ] Export as ZIP
- [ ] Code sandbox execution improvements

### P2
- [ ] Style memory UI (view/edit preferences page)
- [ ] Project gallery browsing
- [ ] Visual regression detection
- [ ] "Build + Deploy" button (Vercel deployment)
- [ ] Agent Trust Score history
