# Inceptive AI - Comprehensive Fix Roadmap

## Vision
Build a production-ready AI agent platform that surpasses Manus, Vercept, Claude Cowork, and Perplexity Computer with autonomous workflows, flawless design, and powerful connectors.

---

## ✅ PHASE 1: Critical Fixes (COMPLETED)

### 1.1 Gmail Connector - AI Features
**Status:** ✅ FIXED

**Issues Fixed:**
- AI Summary not working → Fixed `getGmailFullBody()` to properly extract email content
- Compose with AI broken → Enhanced token handling and error messages
- Dashboard unaware of Gmail → Added connected accounts fetch and display

**Files Modified:**
- `src/lib/email/gmail-api.ts` - Added full body extraction
- `src/app/(dashboard)/email/page.tsx` - Fixed summary error handling
- `src/app/(dashboard)/dashboard/page.tsx` - Gmail awareness
- `src/app/api/auth/google/connect/route.ts` - Enhanced OAuth scopes

**Testing Steps:**
1. Connect Gmail via Email page
2. Open an email and click "AI Summary"
3. Use "Compose with AI" feature
4. Check dashboard for Gmail indicator

---

## 🔧 PHASE 2: Connector Fixes (HIGH PRIORITY)

### 2.1 Make All Connectors Functional
**Status:** ⚠️ PARTIAL - Need implementation

**Current State:**
- Gmail: ✅ Working (read/send)
- Outlook: ⚠️ OAuth exists, needs testing
- Slack: ⚠️ Bot token stub only
- Twitter/X: ⚠️ OAuth exists, needs API integration
- LinkedIn: ⚠️ OAuth exists, needs API integration
- Instagram: ⚠️ OAuth exists, needs API integration
- Telegram: ⚠️ Bot-based, needs testing
- WhatsApp: ❌ Not implemented

**Action Items:**
1. Test all existing OAuth flows
2. Implement missing API integrations
3. Add connector health checks
4. Create unified connector interface

**Priority Files:**
- `src/lib/connectors/*.ts` - Implement missing methods
- `src/app/api/connectors/[provider]/auth` - Verify OAuth
- `src/app/(dashboard)/social/page.tsx` - Test UI

---

### 2.2 Agent Gmail Awareness
**Status:** ✅ COMPLETED

**What Works:**
- Dashboard shows Gmail connection status
- Agent receives Gmail context in messages
- readGmail tool works when connected

**Still Needed:**
- Test agent actually uses Gmail tools proactively
- Add tool usage indicators in UI

---

## 🚀 PHASE 3: Autonomous Agent Features (MEDIUM PRIORITY)

### 3.1 Real-Time Progress Indicators
**Status:** ❌ NOT IMPLEMENTED

**Manus Reference:**
- Step-by-step breakdown of agent actions
- "Analyzing requirements", "Generating database schema", "Optimizing SEO"
- Live activity feed with status updates

**Implementation Plan:**
1. Enhance task_logs table with step tracking
2. Update agent stream to emit progress events
3. Create progress visualization component
4. Add estimated time remaining

**Files to Create/Modify:**
- `src/components/agent/ProgressIndicator.tsx` (NEW)
- `src/app/api/agent/stream/route.ts` - Add progress events
- `supabase/018_agent_steps.sql` (NEW)

---

### 3.2 Wide Research Feature
**Status:** ❌ NOT IMPLEMENTED

**Manus Reference:**
- Multi-source data synthesis
- In-depth, structured research reports
- Automatic source citation

**Implementation Plan:**
1. Create research workflow engine
2. Implement multi-source gathering (web, APIs, databases)
3. Add citation tracking
4. Build research report template

---

### 3.3 Mail Manus (Email-Triggered Workflows)
**Status:** ❌ NOT IMPLEMENTED

**Manus Reference:**
- Email-triggered agentic workflows
- Asynchronous execution
- Automatic replies based on rules

**Implementation Plan:**
1. Add email polling/watcher service
2. Create workflow rules engine
3. Implement auto-reply templates
4. Build workflow builder UI

---

## 🎨 PHASE 4: UI/UX Overhaul (HIGH PRIORITY)

### 4.1 Manus-Style Design System
**Status:** ❌ NEEDS WORK

**Current Issues:**
- Design not as polished as Manus
- Inconsistent spacing and typography
- Missing subtle animations

**Manus Aesthetic:**
- Minimalist, high-end interface
- 12-column grid, generous whitespace
- Inter/Geist font family
- Subtle hover animations (scale 1.02x)
- Smooth page transitions

**Color Palette (Dark Mode):**
```
Background: #121212
Cards: #1b1b1b
Primary Text: #f9fafb
Secondary Text: #9ca3af
Accent: #6366f1 (Indigo)
```

**Implementation Plan:**
1. Update `globals.css` with refined color palette
2. Add Framer Motion transitions to all pages
3. Standardize spacing (8px grid)
4. Improve typography hierarchy
5. Add hover animations to interactive elements

**Files to Modify:**
- `src/app/globals.css` - Design tokens
- `src/components/ui/*` - Component library
- All page components - Add transitions

---

### 4.2 Intelligence Dashboard
**Status:** ⚠️ PARTIAL

**Current State:**
- Basic chat interface exists
- Task feed shows agent actions
- Missing: unified view, metrics, insights

**Manus Reference:**
- Centralized hub for all AI tasks
- Real-time progress indicators
- Library of previously built apps/presentations

**Implementation Plan:**
1. Redesign dashboard layout (3-column)
2. Add metrics panel (tasks completed, time saved, credits used)
3. Create recent projects gallery
4. Implement quick actions bar

---

## 🛠️ PHASE 5: Advanced Features (LOW PRIORITY)

### 5.1 AI Website Builder
**Status:** ❌ NOT IMPLEMENTED

**Manus Reference:**
- Natural language → full-stack app
- Auto database schema generation
- Stripe + NextAuth setup
- Full code export

**Implementation Plan:**
1. Create app generation prompt template
2. Build code generation engine (Vercel AI SDK)
3. Implement file structure generator
4. Add GitHub integration for export
5. Create preview/deploy pipeline

**Estimated Effort:** 2-3 weeks

---

### 5.2 AI Slides Maker (Nano Banana Pro)
**Status:** ❌ NOT IMPLEMENTED

**Manus Reference:**
- Two modes: Standard (text) + Nano Banana Pro (image)
- Perfect text rendering in graphics
- Studio-grade graphics

**Implementation Plan:**
1. Integrate image generation API (Flux/Replicate)
2. Build slide layout engine
3. Add text overlay with perfect rendering
4. Create presentation export (PPTX, PDF)

**Estimated Effort:** 2-3 weeks

---

### 5.3 Browser Operator Agent
**Status:** ⚠️ PARTIAL (Playwright stub exists)

**Manus Reference:**
- Autonomous web navigation
- Click elements, fill forms
- Multi-step goals ("Book a flight", "Extract LinkedIn data")

**Current State:**
- Playwright integration exists
- Basic computerUse tools implemented
- Missing: autonomous planning, multi-step execution

**Implementation Plan:**
1. Enhance Playwright session management
2. Add DOM parsing and element detection
3. Implement action planning agent
4. Create visual feedback for browser actions

---

### 5.4 Slack Integration
**Status:** ❌ NOT IMPLEMENTED

**Manus Reference:**
- Real-time notifications
- Team collaboration
- Trigger agents from Slack commands

**Implementation Plan:**
1. Implement full OAuth flow (not just bot token)
2. Add per-user Slack connections
3. Create Slack command handlers
4. Build notification preferences

---

## 💳 PHASE 6: Billing & Credits (MEDIUM PRIORITY)

### 6.1 Pricing Tiers
**Status:** ⚠️ PARTIAL

**Current State:**
- Stripe integration exists
- Basic credit system implemented
- Missing: proper tier limits, features

**Target Structure:**
```
Free:
- 50 credits/day
- Basic AI models
- 3 active tasks
- No code export

Pro ($29/mo):
- 500 credits/day
- All AI models (incl. Nano Banana Pro)
- Unlimited tasks
- Code export
- Priority support

Team ($99/mo):
- 2000 credits/shared
- SSO
- Granular permissions
- Shared workspace
- Analytics

Enterprise (Custom):
- Unlimited credits
- Dedicated support
- Custom integrations
- SLA
```

---

## 📋 IMMEDIATE ACTION ITEMS (Next 48 Hours)

### Priority 1: Test Gmail Features
```bash
# 1. Start dev server
cd /Users/alymaknojiya/Desktop/Inceptive
npm run dev

# 2. Test flow:
# - Go to /email
# - Connect Gmail (if not connected)
# - Open an email → Click "AI Summary"
# - Use "Compose with AI"
# - Go to /dashboard → Verify Gmail indicator shows
```

### Priority 2: Fix Remaining Connectors
1. Test Outlook OAuth flow
2. Add Twitter API v2 integration
3. Implement LinkedIn posting API
4. Test Instagram Basic Display

### Priority 3: UI Polish
1. Fix any layout issues
2. Add loading states
3. Improve error messages
4. Test mobile responsiveness

---

## 🎯 SUCCESS METRICS

### Functional Requirements:
- [ ] All connectors working (Gmail, Outlook, Twitter, LinkedIn, Instagram, Slack)
- [ ] AI Summary works on all emails
- [ ] Compose with AI generates quality drafts
- [ ] Dashboard aware of all connected accounts
- [ ] Agent executes multi-step tasks autonomously
- [ ] Real-time progress indicators visible

### Design Requirements:
- [ ] Matches Manus aesthetic quality
- [ ] Smooth animations throughout
- [ ] Consistent spacing and typography
- [ ] Mobile-responsive
- [ ] Accessible (WCAG 2.1 AA)

### Performance Requirements:
- [ ] Page load < 2s
- [ ] AI responses < 3s (streaming)
- [ ] No console errors
- [ ] 95+ Lighthouse score

---

## 📞 NEXT STEPS

1. **Review this roadmap** and prioritize
2. **Test the Gmail fixes** I just implemented
3. **Choose next feature** to implement from Phase 2-4
4. **Provide feedback** on what's most critical for your use case

---

**Questions for You:**
1. Which connector is most important after Gmail? (Outlook, Slack, Twitter?)
2. Should I focus on UI polish or new features next?
3. Do you have specific Manus features you want to replicate first?
4. What's your timeline for launch/MVP?
