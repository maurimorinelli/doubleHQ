# Research & Product Analysis

> **⚠️ Disclaimer:** This research was conducted with the assistance of AI tools. Information was gathered from publicly available sources including Double's website, changelog, help center, user reviews (G2, Capterra), Canny feature requests, and job postings. While care was taken to verify accuracy, some details may be incomplete or outdated. This document reflects understanding as of March 2026.

---

## Table of Contents

- [1. Company Overview](#1-company-overview)
- [2. Product Deep-Dive](#2-product-deep-dive)
- [3. Bookkeeping Workflow Mapping](#3-bookkeeping-workflow-mapping)
- [4. Changelog & Shipping Analysis](#4-changelog--shipping-analysis)
- [5. User Pain Points](#5-user-pain-points)
- [6. Competitive Landscape](#6-competitive-landscape)
- [7. The Gap We Identified](#7-the-gap-we-identified)
- [8. Feature Selection & Rationale](#8-feature-selection--rationale)
- [9. Architecture Decisions](#9-architecture-decisions)
- [10. AI Insights — Business Rules](#10-ai-insights--business-rules)

---

## 1. Company Overview

| Field | Detail |
|---|---|
| **Name** | Double (formerly "Keeper", rebranded Oct 2025) |
| **Funding** | $6.5M Series A |
| **Customers** | 4,000+ firms, closing books for hundreds of thousands of businesses |
| **Team Size** | ~30 people |
| **Growth** | +8 team members in the past year, shipped 100+ features |
| **HQ** | US-based, engineering hubs in Buenos Aires and Mendoza, Argentina |
| **Mission** | "Close the books in half the time" |

### What Double Does

Double is practice management software for **bookkeeping firms** — small companies (5–50 people) who manage the financial books for dozens of small businesses. Every month, each client's books need to be "closed": transactions categorized, accounts reconciled, reports generated. Double automates and organizes this entire month-end close process, sitting on top of QuickBooks Online or Xero as the accounting ledger.

---

## 2. Product Deep-Dive

### Core Features

| Feature | Description |
|---|---|
| **Client Portal** | Custom-branded (white-labeled) portal with magic links, ledger-integrated Q&A, automated follow-ups, document hub, and mobile app |
| **AI Bank Feeds** | 4-tier classification: Potential Matches → Rules → Auto Classifications → Needs Review. Recently added QBO rule imports |
| **AI Journal Entries** | Upload source files, AI extracts details, pre-built/custom templates. Added AI Expenses (Feb 2026) and AI Reasoning transparency |
| **AI Reconciliation** | Compares bank statements against ledger, pinpoints discrepancies, CSV upload support |
| **File Reviews** | 2-way QBO/Xero integration, auto-identifies miscoded transactions, bulk payee updates, vendor-level P&L review |
| **Task Management** | Accounting-specific workflows, recurring templates, sections (payroll, tax, admin), attachment roll-forward, task creation from client questions |
| **1099/W-9** | Vendor threshold identification, W-9 requests via portal, data sync to QBO/Xero, export for filing |
| **Reports** | Full reporting package in 4 clicks, executive summaries with visuals, AI financial summaries, custom KPIs |
| **CRM** | Single dashboard for monthly close statuses, custom properties, grid + Kanban views, Zapier integrations |
| **Accruals** | Reusable rules, GL-linked entries, auto amortization/depreciation, cash-basis fixed asset schedules |
| **Tax Suite** | Tax workflows, interactive organizers, KBA e-signatures, live tax tracker, secure storage |
| **Integrations** | QBO & Xero (2-way sync), Zapier, Ping, Abacor, Chrome extension |

### Pricing

Per-client pricing with unlimited users:

| Plan | $/client/mo | Key Inclusions |
|---|---|---|
| **Lite** | $8 | Limited features |
| **Core** | $10 | Client portal, AI bank feeds, task management, reporting, W-9, email |
| **Plus** | $25 | Core + AI financial summaries + receipt management |
| **Scale** | $50 | Plus + accruals + AI journal entries + AI bills |

### Tech Stack (from job posting)

| Layer | Technologies |
|---|---|
| **Frontend** | React, Redux Toolkit, TanStack Query, TypeScript |
| **Backend** | Node.js, Express, TypeScript, TypeORM, PostgreSQL |
| **Nice-to-haves** | AI agents in production, TypeORM, TanStack Query |

---

## 3. Bookkeeping Workflow Mapping

```
Transactions → Categorization → Reconciliation → Review → Close → Report
    ↓              ↓                 ↓              ↓        ↓        ↓
AI Bank Feeds   AI Bank Feeds   AI Reconcil.   File Reviews  Tasks   Reports
(Tier 1-4)      (Rules/Auto)    (CSV upload)   (Vendor P&L)  (Templ)  (AI Summary)
                                               Client Portal
                                               (Questions)
```

Double touches **every stage** of the month-end close:
- **Pre-close**: Code bank transactions (AI Bank Feeds), post payroll/sales JEs (AI Journal Entries)
- **Reconciliation**: AI-assisted with discrepancy detection
- **Transaction Review**: File Reviews catch uncategorized/miscoded transactions
- **Payee Review**: Vendor-level P&L, new vendor review, W-9 tracking
- **Final Review**: Management reports, AI financial summaries, P&L/Balance Sheet review
- **Client Communication**: Client Portal throughout the process

---

## 4. Changelog & Shipping Analysis

### Shipping Velocity

11 major releases in ~12 weeks (Dec 2025 – Mar 2026) — approximately weekly releases.

| Date | Title | Area |
|---|---|---|
| Mar 5, 2026 | Refreshed vendor request designs + accrual improvements | 1099/W-9, Accruals |
| Feb 26, 2026 | Create task from inbound client question | Client Portal, Tasks |
| Feb 19, 2026 | Bug fixes & performance improvements | Month-end close |
| Feb 12, 2026 | AI Reasoning & chart of accounts updates | AI Bank Feeds |
| Feb 5, 2026 | Create Expenses with AI | AI Journal Entries |
| Jan 29, 2026 | Bug fixes & polishing | AI prompts UX |
| Jan 22, 2026 | Cash basis fixed asset schedules | Accruals |
| Jan 15, 2026 | Attachment roll-forward for closing tasks | Task Management |
| Jan 1, 2026 | Tax Suite improvements | Tax Suite, 1099 |
| Dec 24, 2025 | Import rules from QuickBooks | AI Bank Feeds |
| Dec 11, 2025 | Accruals sync & tax projects | Accruals, Tax |

### Investment Direction

| Area | % of Releases | Trend |
|---|---|---|
| **AI Features** | 45% | #1 investment direction |
| **Accruals** | 27% | Heavy investment |
| **Client Portal / Tasks** | 18% | Steady iteration |
| **Tax Suite** | 18% | Ongoing development |

**Key insight:** AI is their #1 investment direction. They're adding AI to more surfaces every release — bank feeds, journal entries, expenses, reconciliation, and now showing AI "reasoning" transparency.

---

## 5. User Pain Points

| Source | Pain Point |
|---|---|
| Capterra | "Not ideal for managing a team of remote bookkeepers or easily tracking project status" |
| G2 | "Interface can feel clunky" when tracking multiple clients |
| Changelog | Client list + task management bugs weekly → high-complexity area |
| Product Gap | No intelligent bird's-eye view: "Which of my 80 clients should I worry about right now?" |
| G2 | Limited integrations beyond QBO/Xero |
| Capterra | Batch processing described as "cumbersome" |
| Reviews | No comprehensive client health dashboard — data scattered across views |

### Top Canny Feature Request Categories

| Category | Requests |
|---|---|
| Client Portal & Communications | 805 |
| Workflow / Task Management | 756 |
| File Reviews and Close Reports | 449 |
| Management Reporting | 252 |
| Receipts | 175 |

---

## 6. Competitive Landscape

| Aspect | Double | Financial Cents | Karbon |
|---|---|---|---|
| **Primary Focus** | Bookkeeping month-end close | All-in-one practice management | Comprehensive workflow + collaboration |
| **Target** | Bookkeeping firms | Solo → mid-sized firms | Growing → large firms |
| **Pricing** | Per client ($8–$50) | Per user ($19–$89) | Per user ($59–$99) |
| **AI Depth** | Deep (4+ AI modules) | Basic (ChatGPT email) | Moderate (Karbon AI beta) |
| **Ledger Integration** | 2-way sync QBO/Xero | QBO/Xero connection | QBO/Xero + more |
| **Client Portal** | Custom-branded, mobile app | Basic portal | Portal (less intuitive) |

### Double's Competitive Advantages

1. **Per-client pricing** — more cost-effective at scale
2. **Deepest AI integration** — 4+ AI modules vs. competitors' basic AI
3. **2-way ledger sync** — changes instantly update QBO/Xero
4. **Month-end close specialization** — purpose-built vs. generic
5. **Custom-branded portal** — clients see the firm's brand

---

## 7. The Gap We Identified

Double provides excellent **per-client** tools (file reviews, task lists, client portal), but there is **no intelligent bird's-eye view** that answers the critical daily question:

> **"Which of my 80 clients should I worry about right now, and why?"**

Today, a firm manager has to click into each client individually, check their status, and mentally track who's behind, who's stuck waiting for a client response, etc. With 50+ clients, this becomes chaotic.

### Evidence

- **User reviews** directly cite difficulty tracking project status across clients
- **No dashboard** exists that prioritizes or scores clients
- **Canny data** shows the top 2 request categories (1,561 combined requests) are Client Portal and Workflow Management
- **Competitors** don't have this either — opportunity for differentiation

### What They Don't Have Yet

- ❌ No bird's-eye-view dashboard across all clients
- ❌ No AI-powered close health scoring
- ❌ No team workload optimization / load balancing
- ❌ No proactive AI insights ("which client should I worry about?")

---

## 8. Feature Selection & Rationale

### Why "AI Close Copilot"

We evaluated multiple feature ideas against four criteria:

| Criterion | Weight |
|---|---|
| Addresses real user pain points | 30% |
| Showcases AI skills (job posting nice-to-have) | 25% |
| Demos well in ≤60 seconds | 20% |
| Uses their exact tech stack | 15% |
| Buildable without their data | 10% |

### Comparison

| Feature | Score | Why |
|---|---|---|
| **AI Close Copilot** ✅ | **93/100** | Solves real pain point + showcases AI + visual demo + exact stack |
| Calendar View for Tasks | 72/100 | Highest Canny votes but shows zero AI skills |
| AI Anomaly Detection Agent | 70/100 | Great AI showcase but needs real financial data |
| Task Dependencies Graph | 64/100 | Too abstract, hard to demo, minimal AI |

### The Four Core Views

1. **📊 Firm Overview Dashboard** — All clients as health-scored cards (🟢/🟡/🔴) with progress bars and days remaining
2. **🤖 AI Insights Panel** — LLM-generated actionable insights categorized by urgency
3. **📋 Client Close Detail** — Deep dive into a client's close workflow with sections matching Double's real process
4. **👥 Team Workload** — Work distribution with capacity indicators and AI rebalance suggestions

---

## 9. Architecture Decisions

### AI as Narrator, Not Calculator

All metrics (days remaining, completion %, overdue flags, unanswered questions) are **pre-computed in the backend**. The AI receives these computed facts and its job is to **narrate and prioritize**, never to calculate raw numbers. This prevents hallucinated metrics while leveraging AI's strength in generating actionable English sentences.

### Cost & Caching Strategy

| Concern | Demo Approach | Production Recommendation |
|---|---|---|
| **LLM cost** | Acceptable for demo | Generate on state change, not on-demand |
| **Caching** | Cache after first generation; "Refresh" always hits LLM | Invalidate cache on meaningful state change |
| **Determinism** | `temperature: 0.1` + JSON structured output | Same approach |
| **Graceful degradation** | Hardcoded fallback insights if API fails | Same + monitoring |

### Data Model

The entities mirror what was reverse-engineered from Double's help docs, changelog, and product pages:

- **Firm** — The bookkeeping practice (Double's customer)
- **TeamMember** — Bookkeepers with roles (preparer, reviewer, manager)
- **Client** — Small businesses whose books the firm manages
- **ClosePeriod** — A specific monthly close for a client
- **CloseTask** — Tasks within a close workflow, organized by section
- **ClientQuestion** — Questions sent to clients through the portal
- **TransactionFlag** — Flagged transaction issues (uncategorized, duplicates, unusual amounts)

---

## 10. AI Insights — Business Rules

### Health Score (0-100)

A weighted numeric score computed from 5 dimensions:

| Dimension | Weight | What it measures |
|---|---|---|
| **Task Progress** | 35% | completed / total × 100 |
| **Time Pressure** | 25% | Days remaining vs. total window. Drops to 0 when overdue |
| **Blocking Issues** | 20% | Pending questions + critical flags. Each costs 20 points |
| **Client Responsiveness** | 10% | How long pending questions have been waiting |
| **Historical Comparison** | 10% | Current pace vs. average previous close times |

### Status Badge Mapping

| Score | Status | Color |
|---|---|---|
| ≥ 75 | On Track | 🟢 Green |
| 50–74 | At Risk | 🟡 Amber |
| < 50 | Behind | 🔴 Red |
| 0 completed + 0 blocked | Not Started | ⚪ Gray |

### Risk Assessment

The system evaluates 6 risk factors in order:

1. **Overdue + incomplete** — Past deadline with remaining tasks
2. **Pending client questions** — Unanswered questions blocking progress
3. **Monetary impact** — Pending questions involving significant amounts
4. **Transaction flags** — Unresolved uncategorized/unusual transactions
5. **Blocked tasks** — Tasks that can't proceed
6. **Time crunch** — ≤ 2 days left with < 50% complete

Risk level is determined by factor count: 0 = low, 1 = medium, 2 = medium-high, 3 = high, 4+ = critical.

### Recommendation Engine

Generates actionable next steps in strict priority order (first match wins):

| Priority | Condition | Action |
|---|---|---|
| 1 | All tasks complete | Review and sign off |
| 2 | Overdue + pending questions | Escalate to unblock |
| 3 | Overdue (no questions) | Focus on remaining tasks |
| 4 | ≥ 3 pending questions + ≤ 3 days | Call the client directly |
| 5 | Any pending questions | Follow up with client |
| 6 | ≤ 2 days + < 80% done | Prioritize remaining tasks |
| 7 | Has risk factors | Address most critical first |
| 8 | Everything fine | Continue at current pace |
