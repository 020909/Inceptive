# Inceptive AI — Product Requirements Document

## Original Problem Statement
Build the next version of Inceptive as a 10-agent "Perfectionist Studio" AI coding and productivity platform — better than Claude Code, Cursor, Manus, or any competitor. The core vision is a multi-agent council that takes its time (60-120s planning + full debate) and delivers production-grade results.

## Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Next.js API Routes, Supabase (Auth + DB), Vercel
- **AI Models**: Qwen 3.6 Plus Preview + Minimax M2.5 (FREE only, via OpenRouter)
- **No paid APIs or dependencies**

## Core Architecture
```
/app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/        # Protected dashboard routes
│   │   │   ├── dashboard/      # Main chat + Studio Mode
│   │   │   └── agent/          # Background agent jobs
│   │   └── api/
│   │       └── agent/stream/   # Main AI streaming endpoint
│   ├── components/
│   │   ├── agent/              # Agent Council UI components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   ├── layout/             # Sidebar, navigation
│   │   └── ui/                 # shadcn/ui + custom UI
│   └── lib/
│       ├── agent/              # Council engine + types
│       └── ai/                 # Model router, proxy
├── supabase/                   # SQL migrations
└── scripts/                    # Background workers
```

## What's Been Implemented

### Phase 1: Foundation & Studio Mode (COMPLETED - Apr 2026)
- **Drag-to-resize split-screen**: Resizable panels (25-75% range) with spring physics
- **Smoother animations**: Spring-based Framer Motion transitions on messages, panels, sidebar
- **CSS animation utilities**: fadeInUp, slideInRight, pulseGlow, breathe, staggered children
- **Studio Mode toggle**: Header button showing agent event count badge
- **Studio Mode panel**: Right-side panel (320px) showing live council debate feed
- **Sidebar NavItem improvements**: Smoother transition timings (200ms), motion.span labels

### Phase 2: 10-Agent Council Engine (COMPLETED - Apr 2026)
- **Council Types** (`src/lib/agent/council-types.ts`):
  - 10 agent definitions: Planner, UX Designer, Architect, Coder, Critic, Tester, Doc Specialist, Visual Polish, Deployer, Orchestrator
  - Each has unique system prompt, model assignment (qwen/minimax), and phase
  - Smart task-based agent selection (only relevant agents activate)
  
- **Council Engine** (`src/lib/agent/council.ts`):
  - 4-phase execution: Planning → Parallel Expertise → Review → Synthesis
  - Agents in same phase run in parallel (Promise.all)
  - Real-time event streaming via shared enqueue reference
  - Full error handling per agent (failures don't block others)
  
- **Stream Route Integration** (`src/app/api/agent/stream/route.ts`):
  - `multiAgentDebate` tool upgraded from 2-model to full 10-agent council
  - Real-time council events streamed as `4:` protocol lines
  - Events persisted to Supabase task_logs
  - Shared `streamEnqueue` ref bridges tool execute → response stream
  - System prompt updated to reference 10-Agent Council workflow
  - Council synthesis used as fallback text when model doesn't produce own response

- **UI Components**:
  - `AgentCouncilPanel` — 10 agent avatar strip with live pulse/done indicators
  - `StudioModePanel` — Full debate transcript with phase labels
  - `ProgressIndicator` — Enhanced with council-aware agent dot strip
  - All use existing CSS variable design system (no color changes)

## Design Constraints (User-Specified)
- NO color changes — exact same dark theme, sidebar, chat interface
- NO new paid models — only Qwen 3.6 Plus Preview + Minimax M2.5
- NO tech stack changes — remains Next.js 15 + Supabase + Vercel
- NO new paid dependencies — zero changes to package.json

## Remaining / Future Tasks

### P0 (Next)
- [ ] End-to-end testing with real Supabase + OpenRouter keys
- [ ] Verify council event streaming works in production

### P1 (Upcoming)
- [ ] Document Generation (PPT via python-pptx / pptxgenjs, Excel, PDF)
- [ ] Code Generation Sandbox (secure server-side execution)
- [ ] Iterative refinement ("make the hero more premium" → agents rework specific part)

### P2 (Future)
- [ ] Style memory across projects
- [ ] Visual regression detection
- [ ] Export as ZIP with all files
- [ ] "Build + Deploy" button (Vercel deployment)
- [ ] Agent Trust Scoring (0-100 reliability metric)
- [ ] Project gallery/library

## Key Files Modified
1. `src/lib/agent/council-types.ts` — NEW: 10 agent definitions + selection logic
2. `src/lib/agent/council.ts` — NEW: Council engine with 4-phase execution
3. `src/components/agent/AgentCouncilPanel.tsx` — NEW: Agent avatar strip UI
4. `src/components/agent/StudioModePanel.tsx` — NEW: Studio Mode panel
5. `src/app/api/agent/stream/route.ts` — MODIFIED: Council integration + streaming
6. `src/app/(dashboard)/dashboard/page.tsx` — MODIFIED: Split-screen + Studio Mode
7. `src/components/ui/progress-indicator.tsx` — MODIFIED: Agent-aware indicators
8. `src/app/globals.css` — MODIFIED: New animation keyframes
9. `src/components/layout/sidebar.tsx` — MODIFIED: Smoother transitions
10. `src/lib/ai-model.ts` — MODIFIED: Updated debate case comment
11. `src/lib/ai/model-router.ts` — MODIFIED: Updated routing description
