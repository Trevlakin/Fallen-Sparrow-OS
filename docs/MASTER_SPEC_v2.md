# FALLEN SPARROW TATTOO STUDIO MANAGEMENT SYSTEM
# MASTER IMPLEMENTATION DOCUMENT
## Single Source of Truth — Do Not Fragment Into Multiple Files

**Version:** 2.0 (Consolidated Master)
**Client:** Legion Avegno — Fallen Sparrow Tattoo Co., Kissimmee, FL
**Prepared By:** Trevor Lakin
**Date:** May 28, 2026
**Status:** Ready for Implementer — Proceed Immediately

---

## TABLE OF CONTENTS

1. Your Job — Crystal Clear
2. Business Context — Know The Client
3. Source Code Intake — What To Request From Trevor
4. Architecture — The Blueprint
5. Feature Specifications — Build Exactly This
6. Pain Point Verification — Every Issue Legion Mentioned, Addressed
7. Integration Specifications — Porter, QuickBooks, OpenAI
8. Database Schema — Tables, Fields, Relationships
9. Code Standards — Non-Negotiable Rules
10. Testing Requirements — How To Prove It Works
11. Implementation Roadmap — Day-By-Day
12. Deliverables — What Cursor Gets
13. Deployment & Infrastructure
14. Support & Iteration Plan
15. Appendices — Reference Material

---

---

# SECTION 1: YOUR JOB — CRYSTAL CLEAR

## What You Are

You are the implementer. You sit between Trevor's existing fragmented codebases and Cursor's frontend build. Your job is to take two proven systems, extract what works, adapt it for a tattoo studio, wire everything together, and hand Cursor a clean, documented, production-ready backend.

## What You Are NOT Doing

- You are NOT building from scratch
- You are NOT guessing what the client wants (it's all in this document)
- You are NOT using Notion (non-negotiable — banned from this project)
- You are NOT writing spaghetti code
- You are NOT making assumptions without confirming with Trevor first

## What You ARE Doing

You are extracting proven patterns from:
1. **GCOps Brain Dump Feature** — Trevor's expense categorization system for general contractors
2. **KPI Tracker (B.O.S.S. Action Coach)** — Trevor's customer segmentation and action plan engine

...and adapting them for a tattoo studio context, wiring them to QuickBooks + Porter, and delivering a clean unified backend with complete documentation.

## Your Output

A production-ready backend codebase + complete API documentation that Cursor wraps a UI around. When you hand it off, Cursor should be able to build the full frontend without asking a single architectural question.

## The Standard

This is not a "get it done fast" project. This is a "get it done right, then move fast" project.

Legion Avegno's 16-year-old business depends on this system. His livelihood runs through it. Spaghetti code written in week 1 becomes a lawsuit-level failure in month 6. Build it like you're going to maintain it for 5 years. Because someone will.

---

---

# SECTION 2: BUSINESS CONTEXT — KNOW THE CLIENT

## Client Profile

| Field | Value |
|---|---|
| Business Name | Fallen Sparrow Tattoo Co. |
| Owner | Legion Avegno |
| Co-Owner / Manager | Hector |
| Location | Kissimmee, FL |
| Established | 2009 (16 years) |
| Services | Tattoos, Piercings, Laser Removal, Medical Tattoos |
| Team Size | ~4-6 people (Legion, Hector, front desk, cleaner, 2-3 artists) |
| Current Tools | Porter (scheduling/POS/CRM), QuickBooks (via external bookkeepers) |
| Urgency Level | 10/10 — "The flame has been lit, the fuse is going, we have about 5 minutes" |
| Budget | $12,000-$15,000 build + $250-$350/month retainer |
| Owner Vision | Monitor entire shop in real-time from anywhere — including Belize |

## What Legion Uses And Loves (Do Not Compete With This)

**Porter** is their front-end booking, POS, and CRM. Legion said: *"We love this thing, it actually works so well."* Porter handles:
- Client booking and intake
- Payment processing and deposits
- Commission splits to artists
- Automated appointment reminders
- Pre-appointment text reminders and checklists
- Email and SMS marketing

**Your system does NOT replace Porter.** Your system is the operational brain that Porter was never designed to be. Porter stays. Your system powers everything Porter doesn't touch.

## What Legion Hates (Pain Points — Verbatim From Transcript)

Every one of these must be solved. No exceptions.

### Pain Point 1 — No Order of Operations / SOPs
*"Order of operations, certain things fall through the cracks because there isn't something that has an order of operations."*
*"Sometimes things get ordered when we shouldn't have ordered because we have enough somewhere else."*

**Root cause:** No system. Everything runs on memory and habit. When habit breaks, things fall apart.

### Pain Point 2 — No Inventory Visibility
*"I feel like having those systems in place will eliminate those human errors. Like an inventory background or like some sort of inventory stock place where people can look at it and say, okay, you know, we've got enough of X, but we need to order more of Y."*

**Root cause:** Buying duplicates or running out because no one can see what's in stock.

### Pain Point 3 — Random Tasks Disrupting Daily Operations
*"There's a lot of random little things, random little tasks that happen that sometimes get in the way of the standard operating procedure, like inventory, like certain follow up, like messages or reschedules or stuff like that."*
*"Something randomly breaks. The AC stops working. The clog in the upstairs bathroom sink. A million different random things that pop up."*

**Root cause:** No separation between "standard daily tasks" and "random incident tasks."

### Pain Point 4 — No Task Time Tracking
*"Adds a checklist with maybe like a date in for the entry and a date out when it was completed would be nice too, just to see how long things are taking and all that jazz."*

**Root cause:** No visibility into how long tasks take or whether they were completed.

### Pain Point 5 — No Weekly P&L Reports
*"I don't get reports weekly. They don't have a method of emailing the reports automatically."*
*"I would love to have that kind of, like, a P&L weekly where, okay, like, I know exactly where our money went, what we're spending too much on, what we need to cut back on."*

**Root cause:** Bookkeeping team manually pulls from Porter + bank statements + QB. Takes days, not seconds.

### Pain Point 6 — Manual Accounting Chain / Middleman
*"We have an accounting team that handles all the financials and stuff, but it's separate from Porter, so it's just a lot of extra steps to get from one point to the next point."*
*"It's something that they kind of have to go in and they go through our bank statements, they go through our Porter, they go through, like, so it's that."*
*"If I could find a way I can keep those numbers to where I can just text it like, hey, we just spent eight seat covers for the chairs out here in the lobby... categorize it as an expense for maintenance."*

**Root cause:** Legion is the bottleneck between Porter (revenue) and QuickBooks (accounting). Data doesn't flow automatically.

### Pain Point 7 — No Expense Logging System
*"If there's just a central AI that just kind of gathers all that information and makes it happen, that would be... Because him and I aren't going to go in and be like, oh, OK, well, this goes over here. We don't have the time."*

**Root cause:** No quick way to log an expense in the moment. By the time someone logs it, they've forgotten the details.

### Pain Point 8 — Zero Customer Follow-Up System
*"The follow-up there, we've never done that. It's something that I wanted to implement here coming up. So I wouldn't be able to give you an example because there isn't anything to compare to."*

**Root cause:** Porter has follow-up capability but it's never been activated or structured.

### Pain Point 9 — No Reschedule Tracking
*"Certain things fall through the cracks... messages or reschedules or stuff like that."*

**Root cause:** Reschedule requests come in via Porter messages but no one is tracking whether they've been actioned.

### Pain Point 10 — No Real-Time Owner Visibility
*"I could see exactly what's happening, whether I'm in town, in the office, or I'm on a vacation across the planet. I'd be able to just log in and just be like, this is what's happening in the shop right now. This is what we have. This is what we don't have. This is what needs to be done. These are the tasks that I need to maybe do as the owner."*

**Root cause:** No dashboard. Legion has to call, text, or physically be present to know what's happening.

### Pain Point 11 — Commission Tracking Is Manual
*"We're also going to be implementing percentages of sales off of the tattoos, depending on how you if you sold one, you know, like walk-ins and things like that. So keeping track of that in order to pay them out would be necessary."*
*"It's commissions for the person up front or the person that's creating the experience... Off of the booking process, the follow-ups and all that."*
*"Some sort of tracking device or tracking ID to be able to lock that into them."*

**Root cause:** Walk-in commissions are attributed manually (or not at all). No system links which front-desk person converted a walk-in.

### Pain Point 12 — Cleaner Has No System
*"That's where things get a little time consuming. But we have a guy who does that. We just need something for him to like physically look at. And then know like, all right, I got to do this, that and the third."*

**Root cause:** Cleaner operates from memory. No structured daily task list. No accountability.

### Pain Point 13 — Data Entry Is The Enemy
*"The less amount of individual data entry, the better."*
*"If it's just pretty much, for the most part, hands off, that'd be an ideal situation."*

**Root cause:** Every manual touchpoint is a failure point. Legion wants automation, not forms.

## Success Criteria (How We Know It's Done Right)

Every single one of these must be true at launch:

- [ ] Legion logs into dashboard from Belize and sees exactly what's happening in the shop in real-time
- [ ] P&L updates automatically without anyone manually entering data
- [ ] Expense logging takes under 30 seconds (brain dump input)
- [ ] Cleaner has a clear daily task list on their phone, no ambiguity
- [ ] Tasks have timestamps — date started, date completed, duration visible
- [ ] Inventory shows green/yellow/red status at a glance, alerts when low
- [ ] Walk-in is logged, attributed to specific front desk person, commission calculated automatically
- [ ] Artist commissions calculate automatically from Porter appointment data
- [ ] Weekly P&L report emails automatically every Friday
- [ ] Customer follow-up actions appear in daily action plan
- [ ] Reschedule requests become tasks that are tracked to completion
- [ ] CPA can pull everything from QuickBooks — Legion answers zero questions from accountants
- [ ] New hire can onboard using SOPs in the system — Legion not needed

---

---

# SECTION 3: SOURCE CODE INTAKE — WHAT TO REQUEST FROM TREVOR

## Before You Write A Single Line Of Code

Request the following from Trevor. Do not proceed past Phase 0 until you have all of this.

### 3.1 GCOps Brain Dump Feature

Request:
- Full backend source code (every file)
- README or any documentation
- Database schema (what tables exist, what fields)
- List of all API endpoints and what they do
- The exact OpenAI prompt(s) used for categorization
- The full list of expense categories it supports
- The full list of routing destinations (where does each category go?)
- How does it handle photos/receipts?
- How does it handle ambiguous or failed categorization?
- Any known bugs or tech debt
- What tech stack is it built on? (language, framework, database, hosting)

### 3.2 KPI Tracker (B.O.S.S. Action Coach)

Request:
- Full backend source code (every file)
- README or any documentation
- Database schema (what customer data is stored, what fields)
- List of all API endpoints and what they do
- The exact segmentation algorithm (what defines At-Risk, Referral Goldmine, Upsell Opportunity — the thresholds, the logic)
- The action plan generation logic (how does it prioritize? what are the templates?)
- How does data get into the system currently? (CSV upload, manual entry, API?)
- Any known bugs or tech debt
- What tech stack is it built on?

### 3.3 GitHub Access

If repos exist on GitHub:
- Request collaborator access or clone access
- Review commit history for architectural decisions
- Look for any .env.example files to understand required credentials

### 3.4 Clarifying Questions (Get Answers Before Building)

Ask Trevor these before proceeding:

1. "In GCOps brain dump, what are ALL the possible expense categories? List every one."
2. "In KPI Tracker, what is the exact threshold for 'At-Risk'? Is it 90 days? Configurable?"
3. "Are there any known bugs in either codebase we should NOT replicate?"
4. "What tech stack is each project built on — I want to match or improve, not mix languages."
5. "Is QuickBooks Online confirmed (not QuickBooks Desktop)? OAuth only works with Online."
6. "What are the exact commission rates for each role? Or are these configurable by Legion?"
7. "Does Legion want to keep using the external bookkeepers after launch, or eliminate them entirely?"

### 3.5 Extraction Map — What To Keep, Adapt, Discard

After receiving and reading both codebases, create this document for Trevor's approval before building:

```
GCOPS BRAIN DUMP — EXTRACTION MAP

KEEP (reuse as-is or near as-is):
- [specific function names]
- [specific validation logic]
- [specific OpenAI prompt structure]

ADAPT (modify for tattoo context):
- Input categories: Material/Labor/Equipment → Supplies/Maintenance/Payroll/Marketing/Utilities/Admin
- Routing destinations: Job cost codes → QuickBooks GL accounts
- Inventory trigger: Job site usage → Studio consumables inventory
- Remove: Job number references, crew assignments, site-specific fields

DISCARD (construction-specific, not applicable):
- [specific functions or modules]

QUESTIONS FOR TREVOR:
- [anything unclear]
```

```
KPI TRACKER (B.O.S.S.) — EXTRACTION MAP

KEEP (reuse as-is or near as-is):
- Customer segmentation algorithm (At-Risk, Referral Goldmine, Upsell)
- Action plan prioritization logic
- Message template engine

ADAPT (modify for tattoo context):
- Data source: CSV upload → automatic Porter appointment sync
- Customer segments: Generic → tattoo-specific (visit history, service types, spend patterns)
- Action templates: Generic → tattoo-specific
  ("Call Maria — hasn't booked in 4 months, high-value customer" instead of generic)
- Upsell logic: Any service → "tattoo only → offer piercing/laser consultation"

DISCARD (other industry logic):
- HVAC-specific logic
- Auto shop logic
- Landscaping logic
- Any hardcoded industry-specific references

QUESTIONS FOR TREVOR:
- [anything unclear]
```

Get Trevor's sign-off on this extraction map before writing a single line of unified code.

---

---

# SECTION 4: ARCHITECTURE — THE BLUEPRINT

## 4.1 High-Level System Overview

```
╔══════════════════════════════════════════════════════════════════╗
║                    FALLEN SPARROW SYSTEM                         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  FRONTEND LAYER (Cursor builds this)                            ║
║  ├── Mobile Web App                                             ║
║  │   ├── AI Morning Briefing                                    ║
║  │   ├── Brain Dump Input (expense logging)                     ║
║  │   ├── Quick-View Dashboard (4 tiles)                         ║
║  │   └── Task Checklist (daily + incidents)                     ║
║  └── Desktop Web App                                            ║
║      ├── P&L Financial Dashboard                                ║
║      ├── Inventory Management                                   ║
║      ├── SOP Library & Task Management                          ║
║      ├── Commission Tracking                                    ║
║      ├── Customer Intelligence (B.O.S.S.)                       ║
║      ├── Walk-In Logging                                        ║
║      ├── Message Center                                         ║
║      └── Settings & Roles                                       ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  API LAYER (REST — you build this)                              ║
║  ├── /api/auth              (login, tokens, roles)              ║
║  ├── /api/expenses          (brain dump input)                  ║
║  ├── /api/inventory         (stock tracking)                    ║
║  ├── /api/tasks             (SOPs + incidents)                  ║
║  ├── /api/commissions       (artist + front desk)               ║
║  ├── /api/walk-ins          (walk-in logging + attribution)     ║
║  ├── /api/customers         (B.O.S.S. intelligence)             ║
║  ├── /api/messages          (follow-up generation + sending)    ║
║  ├── /api/financials        (P&L, reports)                      ║
║  ├── /api/dashboard         (morning briefing, tiles)           ║
║  ├── /api/webhooks          (Porter Zapier ingest)              ║
║  ├── /api/integrations/qb   (QuickBooks OAuth + sync)           ║
║  └── /api/reports           (weekly email, exports)             ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  SERVICE LAYER (business logic — you build this)                ║
║  ├── ExpenseService         (categorization, QB routing)        ║
║  ├── InventoryService       (stock tracking, alerts)            ║
║  ├── TaskService            (SOP management, incidents)         ║
║  ├── CommissionService      (calculation, attribution)          ║
║  ├── CustomerService        (B.O.S.S. segmentation)             ║
║  ├── ActionPlanService      (prioritization, templates)         ║
║  ├── MessageService         (template generation, sending)      ║
║  ├── FinancialService       (P&L aggregation)                   ║
║  ├── ReportService          (weekly report generation)          ║
║  └── BriefingService        (morning briefing assembly)         ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  DATA LAYER (PostgreSQL — you design this)                      ║
║  ├── users                  (all staff, roles)                  ║
║  ├── expenses               (all logged expenses)               ║
║  ├── inventory_items        (all stock items)                   ║
║  ├── inventory_transactions (in/out history)                    ║
║  ├── tasks                  (all SOPs and incidents)            ║
║  ├── task_logs              (completion timestamps)             ║
║  ├── appointments           (cached from Porter)                ║
║  ├── customers              (cached from Porter)                ║
║  ├── walk_ins               (walk-in records)                   ║
║  ├── commissions            (artist + front desk)               ║
║  ├── messages               (outreach history)                  ║
║  └── settings               (system config)                    ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  INTEGRATION LAYER (external APIs)                              ║
║  ├── Porter     → Zapier webhook → /api/webhooks/porter         ║
║  ├── QuickBooks → OAuth 2.0 → /api/integrations/qb             ║
║  ├── OpenAI     → API → ExpenseService + ActionPlanService      ║
║  ├── Twilio     → SMS → MessageService                          ║
║  └── SendGrid   → Email → MessageService + ReportService        ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

## 4.2 Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | Node.js + Express | Match GCOps/KPI Tracker if possible. Fast, widely supported. |
| Database | PostgreSQL | Relational data, complex queries for analytics |
| ORM | Prisma | Type-safe, migration management, clean models |
| Authentication | JWT + bcrypt | Stateless auth, role-based |
| AI | OpenAI GPT-4o | Expense categorization + action plan generation |
| SMS | Twilio | Industry standard for programmable SMS |
| Email | SendGrid | Reliable transactional + marketing email |
| File Storage | AWS S3 | Receipt photos, report exports |
| Job Scheduling | node-cron | Daily Porter sync, weekly reports, commission calculations |
| Hosting | Railway | Simple, handles Node.js + PostgreSQL, affordable |
| Frontend Hosting | Vercel | Static React build, auto-deploy from GitHub |
| Monitoring | Sentry | Error tracking and alerting |
| Logging | Winston | Structured logging for all API calls and integration events |

**CRITICAL:** If GCOps and KPI Tracker are built on a different stack (Python, etc.), flag this to Trevor before proceeding. The goal is a single unified stack — no polyglot backend.

## 4.3 Folder Structure

```
/fallen-sparrow-backend
├── /src
│   ├── /api
│   │   ├── /routes
│   │   │   ├── auth.routes.js
│   │   │   ├── expenses.routes.js
│   │   │   ├── inventory.routes.js
│   │   │   ├── tasks.routes.js
│   │   │   ├── commissions.routes.js
│   │   │   ├── walk-ins.routes.js
│   │   │   ├── customers.routes.js
│   │   │   ├── messages.routes.js
│   │   │   ├── financials.routes.js
│   │   │   ├── dashboard.routes.js
│   │   │   ├── webhooks.routes.js
│   │   │   ├── integrations.routes.js
│   │   │   └── reports.routes.js
│   │   ├── /controllers
│   │   │   └── [matching controller for each route file]
│   │   └── /middleware
│   │       ├── auth.middleware.js      (JWT verification)
│   │       ├── rbac.middleware.js      (role-based access control)
│   │       ├── validate.middleware.js  (request validation)
│   │       ├── logger.middleware.js    (request logging)
│   │       └── error.middleware.js     (global error handling)
│   ├── /services
│   │   ├── expense.service.js
│   │   ├── inventory.service.js
│   │   ├── task.service.js
│   │   ├── commission.service.js
│   │   ├── customer.service.js
│   │   ├── actionPlan.service.js
│   │   ├── message.service.js
│   │   ├── financial.service.js
│   │   ├── report.service.js
│   │   └── briefing.service.js
│   ├── /models
│   │   └── [Prisma models — defined in schema.prisma]
│   ├── /integrations
│   │   ├── openai.integration.js
│   │   ├── quickbooks.integration.js
│   │   ├── porter.integration.js
│   │   ├── twilio.integration.js
│   │   └── sendgrid.integration.js
│   ├── /jobs
│   │   ├── porter-sync.job.js         (runs daily at 6am)
│   │   ├── weekly-report.job.js       (runs Friday at 5pm)
│   │   ├── commission-calc.job.js     (runs end of each pay period)
│   │   └── qb-retry.job.js            (retries failed QB syncs every 5 min)
│   ├── /utils
│   │   ├── logger.js
│   │   ├── errors.js                  (AppError class)
│   │   ├── validators.js
│   │   ├── formatters.js
│   │   └── constants.js
│   └── /config
│       ├── env.js                     (validated env variable access)
│       └── database.js
├── /prisma
│   ├── schema.prisma                  (full database schema)
│   └── /migrations
├── /tests
│   ├── /unit
│   │   └── /services
│   ├── /integration
│   │   └── /api
│   └── /fixtures
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

## 4.4 Data Flow — Complete End-to-End

### Brain Dump Expense Flow
```
Legion taps "Log Expense" on mobile
  ↓
Enters: amount=$140, description="Bought 8 ink cartridges"
  ↓
POST /api/expenses
  ↓
Controller validates input
  ↓
ExpenseService.categorize(description)
  → OpenAI prompt: "You are a tattoo studio accountant. Categorize this expense..."
  → Returns: { category: "Supplies", confidence: 0.98, inventoryItem: "ink_cartridges", qty: 8 }
  ↓
If confidence < 0.85 → flag as "Manual Review", notify owner, stop QB sync
If confidence >= 0.85 → proceed
  ↓
ExpenseService.create({ amount, description, category, loggedBy })
  → INSERT INTO expenses (...)
  ↓
QuickBooksIntegration.postExpense(expense)
  → POST to QB API: Journal entry to 6100_Supplies_Expense | $140
  → Store qb_transaction_id in expense record
  ↓
If inventoryItem identified → InventoryService.increment(sku, qty)
  → UPDATE inventory_items SET current_qty = current_qty + 8 WHERE sku = 'ink_cartridges'
  ↓
Return to frontend: { expenseId, category, qbTransactionId, inventoryUpdated: true }
  ↓
Mobile shows: "✅ Logged as Supplies. QuickBooks updated. Inventory updated."
```

### Porter Sync Flow
```
Zapier fires daily at 6am
  ↓
Zapier pulls Porter report (CSV or webhook payload)
  ↓
POST /api/webhooks/porter (with webhook secret header)
  ↓
Middleware validates webhook secret
  ↓
PorterIntegration.ingest(payload)
  ↓
For each appointment in payload:
  - Upsert customer record (porter_id as unique key)
  - Upsert appointment record
  - Calculate artist commission based on service type + commission rate in settings
  - If appointment has walk_in_id → calculate front desk commission
  ↓
CommissionService.calculatePeriod(payPeriodStart, payPeriodEnd)
  ↓
Dashboard refreshes with updated appointment + commission data
```

### Morning Briefing Flow
```
Legion opens mobile app
  ↓
GET /api/dashboard/morning-briefing
  ↓
BriefingService assembles in parallel:
  - FinancialService.getYesterdayRevenue()     → "$3,240 (4 appointments)"
  - TaskService.getDueTodayCount()             → "2 tasks due"
  - InventoryService.getLowStockAlerts()       → "Laser ink low (2 bottles)"
  - CustomerService.getAtRiskCount()           → "3 at-risk customers"
  - CommissionService.getPendingPayouts()      → "$420 due to Hector"
  - ActionPlanService.getTopAction()           → "Call Maria G. — 4 months no booking"
  ↓
Returns: structured JSON with all 6 data points
  ↓
Frontend renders as 5-sentence briefing + "Top Action" card
```

---

---

# SECTION 5: FEATURE SPECIFICATIONS — BUILD EXACTLY THIS

## 5.1 Mobile Web App

### 5.1.1 AI Morning Briefing

**Purpose:** Legion opens the app. Within 2 seconds he knows everything that matters today.

**Display Format:**
```
Good morning, Legion. Here's your shop right now:

• Revenue yesterday: $3,240 (4 appointments, avg $810)
• 2 tasks due today — cleaner checklist + weekly inventory count
• Laser ink is low (2 bottles — about 1 week of supply left)
• 3 customers haven't booked in 90+ days — need follow-up
• Commission payout due to Hector: $420 (from last week's walk-ins)

Top action today: Call Maria Gonzalez. She's been a client since 2018,
spent $3,100 lifetime, but hasn't booked in 4 months. High priority.
```

**Logic:**
- Runs on page load
- Pulls from 6 sources in parallel (see 4.4 data flow)
- If any source fails, show that section as "Unavailable" — do not block the whole briefing
- Personalized greeting uses user's first name
- "Top action" comes from B.O.S.S. Action Plan (highest-priority customer)

**Performance requirement:** Full briefing renders within 2 seconds of page load. Cache individual data points for 5 minutes.

---

### 5.1.2 Brain Dump Expense Input

**Purpose:** Legion or Hector logs any business expense in under 30 seconds, from their phone, without thinking about where it goes.

**Form Fields:**
| Field | Type | Required | Notes |
|---|---|---|---|
| Amount | Currency input | YES | "$" prefix, decimal allowed |
| Description | Text area | YES | Plain language, what was bought |
| Photo | File upload | NO | Receipt scan, S3 storage |

**Submit button:** "Log It" (not "Submit" — casual language matches the user)

**Behind the scenes (automatic, user sees none of this):**
1. Validates: amount > 0, description not empty
2. Sends to OpenAI expense categorizer
3. AI returns: category, confidence, inventory item (if supply), quantity (if parseable)
4. If confidence >= 0.85: auto-categorize, post to QB, update inventory if applicable
5. If confidence < 0.85: flag for manual review, notify owner via in-app alert

**Feedback to user:**
- Success: "✅ Logged as [Category]. QuickBooks updated." (green, dismisses in 3s)
- Low confidence: "⚠️ We weren't sure how to categorize this. It's been saved for your review." (yellow)
- Failure: "❌ Couldn't save. Try again." (red, with retry button)

**Manual Review Queue:**
- Desktop dashboard shows "Expenses Needing Review" list
- Owner clicks expense, selects correct category, confirms
- System posts to QB and marks as resolved

**OpenAI Prompt (exact):**
```
System: You are an expert accountant for a tattoo studio. Your job is to categorize 
business expenses into exactly one of these categories:
- Supplies (ink, needles, gloves, cleaning supplies, sterilization packs, any consumable used in services)
- Maintenance (repairs, fixes, anything that maintains the physical space or equipment)
- Payroll (wages, contractor payments, artist fees — anything paid to a person for work)
- Marketing (advertising, social media, promotional materials, photography)
- Utilities (electricity, water, internet, phone, anything you pay monthly for building services)
- Admin (office supplies, software subscriptions, accounting fees, licenses, permits)
- Furniture (chairs, desks, lobby furniture, equipment — one-time purchases, not consumables)

Respond ONLY with a JSON object in this exact format, no preamble, no explanation:
{
  "category": "<exact category name from list above>",
  "confidence": <0.0 to 1.0>,
  "inventory_sku": "<if this is a supply item that should update inventory, provide a normalized sku like 'ink_black' or 'latex_gloves_medium' — otherwise null>",
  "inventory_qty": <integer if qty parseable from description, otherwise null>
}

User: [expense description goes here]
```

**Expense Categories → QuickBooks GL Account Mapping:**
```
Supplies    → 6100_Supplies_Expense
Maintenance → 6200_Repairs_Maintenance
Payroll     → 6300_Payroll_Expense
Marketing   → 6500_Marketing_Advertising
Utilities   → 6600_Utilities
Admin       → 6700_Admin_General
Furniture   → 1500_Furniture_Equipment (asset account)
```

This mapping is stored in the `settings` table — configurable by owner.

---

### 5.1.3 Quick-View Dashboard (Mobile)

**Four tiles, always visible on home screen:**

**Tile 1 — Today's Appointments**
- Source: appointments table (cached from Porter)
- Shows: count, total revenue forecast, artist names
- Example: "4 appointments today | Est. $1,800"

**Tile 2 — Cash Position**
- Source: QB P&L via FinancialService (cached 15 min)
- Shows: revenue this month vs. last month, profit margin
- Example: "May: $18,450 | April: $16,200 | Margin: 33%"

**Tile 3 — Open Tasks**
- Source: tasks table
- Shows: tasks due today, overdue count
- Example: "2 due today | 1 overdue"
- Tap to open task list

**Tile 4 — Alerts**
- Source: InventoryService + CommissionService + MessageService
- Shows: active alerts, color-coded by severity
- Example: "🔴 Laser ink low | 💛 $420 commission pending"

**Data freshness:** Tiles auto-refresh on app open + every 5 minutes while active.

---

### 5.1.4 Mobile Task Checklist

**Purpose:** Every staff member sees exactly what they need to do today, from their phone. Nothing falls through the cracks.

**View for Cleaner (role: cleaner):**
```
TODAY — THURSDAY, MAY 28

DAILY TASKS (5 total)
☐ Sweep and mop all floors          [DUE: Before open]
☐ Sanitize all chairs and stations  [DUE: Before open]
☐ Empty trash, replace liners       [DUE: Before open]
☐ Wipe down mirrors and glass       [DUE: 3:00 PM]
☐ Check and restock bathrooms       [DUE: Before close]

INCIDENTS (1 open)
⚠️ AC making weird noise — reported yesterday [OPEN]
   → [Mark Resolved] [Add Note]

[+ REPORT AN ISSUE]  ← Big red button
```

**Task States:** Not Started → In Progress → Complete → Overdue
**Timestamps:** System auto-records start_time when "In Progress" clicked, end_time when "Complete" clicked.

---

### 5.1.5 Walk-In Logging (Mobile — Front Desk)

**Purpose:** When a walk-in customer arrives, front desk logs them immediately so commission can be tracked.

**Form:**
| Field | Type | Notes |
|---|---|---|
| Customer Name | Text | Required |
| Phone | Phone input | For follow-up |
| How Did They Hear About Us? | Dropdown | Walk-by, Instagram, Google, Referral, Other |
| Referral Name | Text | Shows if "Referral" selected |
| Greeted By | Auto-filled | Currently logged-in user |
| Notes | Text area | Optional |

**On Submit:**
- Walk-in record created with unique tracking ID
- Greeted_by linked to current user (front desk person gets commission credit)
- If converted to booking (matched in Porter sync) → commission auto-calculates

---

## 5.2 Desktop Web App

### 5.2.1 Financial Dashboard (P&L)

**Layout:** Left sidebar nav, main content area, right summary panel.

**Main P&L View:**
```
FALLEN SPARROW — PROFIT & LOSS
Period: [Date Range Selector]   [This Week] [This Month] [YTD] [Custom]

REVENUE
  Tattoo Services          $18,450   ████████████████░░░░  84%
  Piercing Services         $2,340   ██░░░░░░░░░░░░░░░░░░  10.6%
  Laser Removal             $1,200   █░░░░░░░░░░░░░░░░░░░   5.4%
  ─────────────────────────────────────────────────────────────
  TOTAL REVENUE            $21,990

EXPENSES
  Supplies                  $3,200   ████████░░░░░░░░░░░░  22%
  Maintenance                 $450   █░░░░░░░░░░░░░░░░░░░   3%
  Payroll/Commissions       $8,900   ██████████████████░░  61%
  Rent                      $2,000   ████░░░░░░░░░░░░░░░░  13.7%
  ─────────────────────────────────────────────────────────────
  TOTAL EXPENSES           $14,550

  ═════════════════════════════════════════════════════════════
  NET PROFIT                $7,440   MARGIN: 33.8%
```

**Filters:**
- Date range (any range, or presets: Today, This Week, This Month, Last Month, YTD)
- By service type (tattoo / piercing / laser / medical)
- By artist (filter revenue to one artist)
- By expense category

**Export buttons:**
- "Export CSV" — downloads all transactions in date range
- "Export PDF" — formatted P&L report
- "Email to CPA" — sends formatted PDF to configurable email address

**CPA Mode:**
- Settings > Integrations > CPA Email: enter CPA's email
- Button on P&L: "Send to CPA" — one click sends current view as PDF
- CPA gets formatted report, can reconcile with QB directly
- Zero calls from accountants to Legion

**Data Source:** All data from QuickBooks API. Nothing manually entered into this dashboard. It's a read-only view of QB data + locally stored expense records.

---

### 5.2.2 Inventory Management

**Purpose:** Everyone can see what's in stock. Nobody orders what's already there. Nobody runs out of what's not.

**Inventory Item Structure:**

| Field | Description |
|---|---|
| SKU | Unique identifier (e.g., ink_black, latex_gloves_medium) |
| Name | Display name (e.g., "Black Ink — 1oz") |
| Category | Consumable / Equipment / Maintenance Supply |
| Current Qty | Live count |
| Reorder Level | Alert threshold (e.g., 3 units) |
| Reorder Qty | How many to order at once (e.g., 10 units) |
| Unit Cost | For spend tracking |
| Vendor | Who to order from |
| Lead Time | Days to arrive after ordering |
| Est. Monthly Usage | Calculated from usage history |

**Category Definitions:**
- **Consumables** — Ink, needles, gloves, sterilization packs, cleaning supplies. Usage tracked. Auto-order alerts. Tied to brain dump expense input.
- **Equipment** — Tattoo machines, autoclaves, chairs, lights. Tracked for maintenance history, not for auto-ordering.
- **Maintenance Supplies** — Cleaning solutions, sterilization packs. Usage tracked, alert on low stock.

**Dashboard View:**
```
INVENTORY STATUS

🔴 ORDER NOW (2 items)
  Laser Ink (Black)    Current: 2 | Reorder Level: 5  [Create Order]
  Latex Gloves (Med)   Current: 1 box | Reorder Level: 3 [Create Order]

🟡 MONITOR (1 item)
  Sterilization Packs  Current: 8 | Reorder Level: 10

🟢 STOCKED (14 items)
  Black Ink (1oz)      Current: 24 | Reorder Level: 10
  [+ 13 more items]
```

**Automatic Inventory Updates:**
- Brain dump: "Bought 8 ink cartridges" → AI extracts SKU + qty → `current_qty += 8`
- Mark used: Staff clicks "Mark Used" on item → decrements by 1 (or custom qty)
- Usage history: Every increment/decrement stored in `inventory_transactions`

**Low Stock Alerts:**
- When current_qty drops below reorder_level:
  1. Tile 4 on mobile dashboard turns red
  2. Morning briefing mentions it
  3. Email notification to owner

---

### 5.2.3 SOP Library & Task Management

**Purpose:** Every role has a documented procedure. Every task has a timestamp. Nothing falls through.

**SOP Structure:**

```
SOPs
├── DAILY
│   ├── Shop Cleanliness (Cleaner — Before Open)
│   ├── Opening Procedures (Front Desk — Open)
│   ├── Artist Station Prep (Artists — Before First Appointment)
│   └── Closing Procedures (Front Desk — At Close)
├── WEEKLY
│   ├── Inventory Count (Front Desk/Cleaner — Monday AM)
│   ├── Commission Payout Calculation (Manager — Friday EOD)
│   └── P&L Review (Owner — Friday)
└── AS-NEEDED
    ├── New Artist Onboarding (Owner/Manager)
    ├── New Front Desk Onboarding (Owner/Manager)
    └── Equipment Maintenance (Cleaner)
```

**Each SOP Contains:**
- Title
- Assigned role(s)
- Frequency + scheduled time
- Estimated duration
- Checklist items (ordered, checkable)
- Notes field (optional)

**Task Tracking (Every Instance):**
- `date_assigned` — when the task was scheduled
- `time_started` — when staff clicked "Start"
- `time_completed` — when staff clicked "Done"
- `duration_minutes` — auto-calculated
- `completed_by` — which user
- `notes` — any observations or issues

**Incident / Random Task Logging:**

Completely separate from daily SOPs. Staff can log an incident at any time:
```
[! REPORT AN ISSUE]

Issue Type: [Maintenance / Safety / Customer / Inventory / Other]
Description: [text]
Photo: [optional]
Priority: [Urgent / Normal]

→ Creates incident task, assigned to manager (default)
→ Notifies owner via in-app alert if "Urgent"
→ Tracks date-in (when reported) and date-out (when resolved)
```

**Analytics (Desktop — Ops section):**
- Tasks completed this week: X of Y (% completion rate)
- Average task duration by SOP type
- Most common incident types (top 5)
- Overdue tasks by staff member
- These help Legion identify patterns (e.g., "The AC keeps breaking — maybe it needs servicing")

---

### 5.2.4 Commission Tracking

**Purpose:** Artist and front desk commissions calculate automatically. No manual tracking. No disputes.

**Artist Commissions:**

Automatically calculated from Porter appointment sync:
```
Service Type → Commission Rate (configurable in settings)
Tattoo       → 15% of service charge (example — set by Legion)
Piercing     → 20% of service charge
Laser        → 25% of service charge
Medical      → 30% of service charge
```

Per artist view:
```
SARAH MARTINEZ — Commission Report
Period: May 1–31, 2026

Appointments (12 total):
  05/03  Tattoo    $800    Commission: $120.00
  05/07  Tattoo    $650    Commission:  $97.50
  05/11  Piercing  $150    Commission:  $30.00
  [... etc]

Walk-in Bonuses: $0 (no walk-ins attributed this period)
Referral Bonuses: $50 (1 referral confirmed)

TOTAL THIS PERIOD: $672.50
PAID: $0
PENDING: $672.50
SCHEDULED PAYOUT: June 1, 2026
```

**Walk-In Commissions (Front Desk):**

Calculated from walk-in records (see Section 5.1.5):
- When a walk-in converts to a completed appointment
- System looks up who logged the walk-in (greeted_by field)
- Awards walk-in bonus to that person

Example:
```
FRONT DESK — HECTOR
Walk-in commissions (May):

  05/12  Walk-in → Tattoo appointment ($800)   Bonus: $20.00
  05/18  Walk-in → Piercing ($120)             Bonus: $20.00
  05/22  Walk-in → Tattoo ($1,200)             Bonus: $20.00

WALK-IN TOTAL: $60.00
```

**Commission Rates (Configurable in Settings):**
- Artist rates: per service type, percentage
- Walk-in bonus: flat rate per converted walk-in (e.g., $20)
- Upsell bonus: flat rate if front desk upsells a service (e.g., $15)
- Referral bonus: flat rate per successful referral (e.g., $50)

---

### 5.2.5 Customer Intelligence (B.O.S.S. Layer)

**Purpose:** Tell Legion and Hector exactly which customers to contact, what to say, and why.

**Customer Segmentation Algorithm (Adapted From KPI Tracker):**

```
SEGMENT 1 — AT-RISK
Definition: Has visited at least once AND last appointment was 90+ days ago
Priority: Weighted by lifetime spend (highest spenders = highest priority)
Action: Personal outreach — call or SMS

SEGMENT 2 — REFERRAL GOLDMINE
Definition: 3+ completed appointments AND lifetime spend > $1,500
Priority: Weighted by total spend + recency
Action: Offer referral bonus — "Send a friend, get $50 credit"

SEGMENT 3 — UPSELL OPPORTUNITY
Definition: Has only booked tattoos (never piercing, never laser) AND visited in last 60 days
Priority: Weighted by visit recency
Action: Introduce piercing or laser removal during/after next appointment

SEGMENT 4 — NEW CUSTOMER FOLLOW-UP
Definition: First appointment was 7-14 days ago
Priority: All new customers equally
Action: "How was your experience?" + invite to rebook or refer a friend
```

**Thresholds stored in `settings` table — configurable by owner.**

**Weekly Action Plan View:**
```
THIS WEEK'S TOP ACTIONS
Generated: Monday, May 26

1. 📞 CALL — Maria Gonzalez (At-Risk, HIGH value)
   Last visit: January 2026 | Lifetime spend: $3,100
   Suggested: "Hi Maria, we miss you! We've added laser removal packages — thought of you."

2. 💬 SMS — Sarah Miller (Referral Goldmine)
   5 visits | $2,800 lifetime | No referrals yet
   Suggested: "Sarah, as one of our favorite clients, we'd love to offer you $50 credit for every friend you send!"

3. 💬 SMS — Marcus Brown (Upsell — Piercing)
   4 tattoo visits | Never pierced | Last visit: 3 weeks ago
   Suggested: "Marcus, we just expanded our piercing portfolio — we'd love to show you at your next visit."

4. 📞 CALL — 2 no-shows from last week
   Mike Chen, Rebecca Davis — didn't show for appointments
   Suggested: "Hey [name], we missed you last week! Want to reschedule?"

5. 📧 EMAIL CAMPAIGN — 8 laser removal clients
   Last laser session 90+ days ago, prime for follow-up session
   Suggested: Send the "Continue your laser journey" email template
```

**One-Click Send:**
- Each action has a "Send Message" button
- Opens message template with customer name pre-filled
- Choose channel (SMS or email)
- Send or customize first, then send
- Message logged in history with timestamp

---

### 5.2.6 Message Center

**Purpose:** Track all customer outreach in one place. Know who was contacted, when, what was said, and whether they responded.

**Features:**
- Template library (pre-written, categorizable)
- Send SMS (via Twilio) or Email (via SendGrid)
- Auto-fill: customer name, last visit date, service history
- Sent history: every message, to whom, when, channel, response (if any)
- Response tracking: if customer replies to SMS, flag in dashboard

**Template Library (Starter Set):**
```
AT-RISK TEMPLATES:
  "Hi [name], we miss you! It's been [days] since your last visit at Fallen Sparrow.
   Come in and we'll treat you to a free touch-up on your last piece."

  "Hey [name]! Just thinking about you — your [service] is looking due for a refresh.
   Book now and use code COMEBACK for 10% off."

REFERRAL TEMPLATES:
  "[name], as one of our most valued clients, we'd love to offer you $50 in credit
   for every friend you refer to us. Just have them mention your name when booking!"

UPSELL TEMPLATES:
  "[name], we recently expanded our [piercing/laser] services and thought of you!
   Ask about it at your next appointment — we think you'll love it."

NEW CUSTOMER FOLLOW-UP:
  "Hi [name]! Thanks for visiting Fallen Sparrow recently. How was your experience?
   We'd love to see you again — your next appointment is on us (consultation)."

NO-SHOW:
  "Hey [name], we missed you at your appointment! Life happens — let's get you
   rescheduled. Just reply to this message and we'll find a time."
```

**API Endpoints:**
```
POST /api/messages/generate
  Body: { templateId, customerId, channel: "sms" | "email" }
  Response: { message: "Hi Maria, we miss you..." }

POST /api/messages/send
  Body: { customerId, channel, message, templateId }
  Response: { messageId, status: "sent" }

GET /api/messages/history
  Query: ?customerId=123&dateFrom=2026-01-01
  Response: [{ messageId, customer, channel, message, sentAt, response }]
```

---

### 5.2.7 Reschedule Tracking

**Purpose:** Reschedule requests never fall through the cracks.

**How It Works:**
- Porter notifies front desk of reschedule request (via their existing system)
- Front desk creates reschedule task in the system:
  ```
  Customer: [name]
  Original appointment: [date]
  Reason: [optional]
  Assigned to: [front desk user]
  Due: Within 24 hours
  ```
- Task appears in front desk's task list
- If not completed within 24 hours → escalates to manager
- When rescheduled: marks task complete, logs new appointment date

---

### 5.2.8 Automated Weekly Report

**Purpose:** Legion gets a full financial and operational snapshot every Friday at 5pm. No one has to compile it. No one has to send it.

**Trigger:** Every Friday at 5:00 PM (configurable in Settings)

**Recipients:** Configurable email list (Legion, Hector, CPA if desired)

**Report Content:**
```
FALLEN SPARROW WEEKLY REPORT
Week of May 20–26, 2026

FINANCIAL SUMMARY
  Revenue this week:     $6,240   (↑ 12% vs last week: $5,571)
  Expenses this week:    $1,890
  Net Profit this week:  $4,350   (margin: 69.7%)
  YTD Revenue:          $78,450
  YTD Net Profit:       $26,520   (margin: 33.8%)

TOP EXPENSE CATEGORIES THIS WEEK
  1. Payroll/Commissions:    $1,200 (63.5%)
  2. Supplies:                 $450 (23.8%)
  3. Maintenance:              $240 (12.7%)

REVENUE BY SERVICE
  Tattoos:         $4,800 (76.9%)
  Piercings:         $960 (15.4%)
  Laser Removal:     $480  (7.7%)

REVENUE BY ARTIST
  Sarah Martinez:  $2,400
  Alex Torres:     $1,800
  Marcus Lee:        $600
  Walk-ins (unassigned): $1,440

INVENTORY STATUS
  🔴 Items needing order: 2 (Laser Ink, Latex Gloves)
  🟡 Items to monitor: 1
  🟢 All other items: stocked

CUSTOMER ACTIVITY
  New customers this week:  4
  Total appointments:       12
  No-shows:                 1
  At-risk customers:        3 (need follow-up)

TASKS
  Completed:   28 of 30 (93% completion rate)
  Overdue:      2 (Bathroom deep clean, Equipment sterilization log)
  Incidents:    1 (AC noise — IN PROGRESS)

COMMISSION PAYOUTS DUE
  Sarah Martinez:  $672.50 (due June 1)
  Hector (walk-in): $60.00 (due June 1)

TOP 3 ACTIONS NEXT WEEK
  1. Order: Laser Ink + Latex Gloves
  2. Call 3 at-risk customers (Maria G., James C., Rebecca D.)
  3. Resolve: 2 overdue tasks

[View Full Dashboard] [Export PDF]
```

---

### 5.2.9 Settings & Roles

**User Roles & Permissions:**

| Feature | Owner (Legion) | Manager (Hector) | Artist | Front Desk | Cleaner |
|---|---|---|---|---|---|
| P&L Dashboard | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| Expense Logging | ✅ | ✅ | ❌ | ❌ | ❌ |
| Inventory View | ✅ | ✅ | ✅ Read | ✅ Read | ✅ Read |
| Inventory Edit | ✅ | ✅ | ❌ | ❌ | ❌ |
| Task Management | ✅ Full | ✅ Full | ✅ Own tasks | ✅ Own tasks | ✅ Own tasks |
| Commission View | ✅ All | ✅ All | ✅ Own | ✅ Own | ❌ |
| Commission Edit | ✅ | ✅ | ❌ | ❌ | ❌ |
| Customer Data | ✅ Full | ✅ Full | ✅ Limited | ✅ Limited | ❌ |
| Messages | ✅ | ✅ | ❌ | ✅ Send only | ❌ |
| Walk-in Logging | ✅ | ✅ | ❌ | ✅ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ | ❌ |

**Configurable Settings (Owner only):**
- Commission rates (per service, per role)
- QB chart of accounts mapping
- Inventory reorder levels
- Customer segmentation thresholds (At-Risk: 90 days — changeable)
- Weekly report schedule (day + time + recipients)
- Walk-in bonus rates
- Message templates (edit, add, delete)
- Zapier webhook secret

---

---

# SECTION 6: PAIN POINT VERIFICATION

This section maps every single thing Legion said in the discovery call to a specific feature. If it's not checked, it's not done.

| # | What Legion Said | Feature That Solves It | Status |
|---|---|---|---|
| 1 | "Things fall through cracks — no order of operations" | Section 5.2.3 SOP Library | Build |
| 2 | "Sometimes things get ordered when we shouldn't have" | Section 5.2.2 Inventory with reorder alerts | Build |
| 3 | "Need to see what we have and what we need" | Section 5.2.2 Inventory — green/yellow/red view | Build |
| 4 | "Random little tasks get in the way of daily SOPs" | Section 5.2.3 — SOPs + Incident track as separate | Build |
| 5 | "AC breaks, bathroom clogs, random stuff always happening" | Section 5.2.3 — Incident report with [! REPORT ISSUE] | Build |
| 6 | "Date in, date out, want to see how long things take" | Section 5.2.3 — Task timestamps, duration analytics | Build |
| 7 | "We don't get reports weekly, no automatic emails" | Section 5.2.8 — Automated weekly report email | Build |
| 8 | "I don't know where our money went, what to cut" | Section 5.2.1 — P&L with category breakdown | Build |
| 9 | "Accounting team pulls from Porter + bank + QB manually" | Section 7 — QB API + Porter sync, chain eliminated | Build |
| 10 | "Want to just text an expense and have it categorized" | Section 5.1.2 — Brain dump input | Build |
| 11 | "We don't have time to manually categorize expenses" | Section 5.1.2 — AI handles it automatically | Build |
| 12 | "Never done customer follow-up, want to start" | Section 5.2.5 + 5.2.6 — B.O.S.S. + Message center | Build |
| 13 | "Messages and reschedules fall through cracks" | Section 5.2.7 — Reschedule task tracking | Build |
| 14 | "Want to see shop from anywhere, in real time" | Section 5.1.3 + 5.2.1 — Mobile tiles + full dashboard | Build |
| 15 | "This is what we have, what we need, what to do as owner" | Section 5.1.1 — AI morning briefing | Build |
| 16 | "Commission percentages for walk-ins — tracking ID" | Section 5.2.4 + 5.1.5 — Walk-in log + commission | Build |
| 17 | "Person up front deals with experience, back is automated" | Full system design — back-office runs itself | Build |
| 18 | "Less data entry. Hands off. Ideal situation." | Brain dump (30 sec) + all auto-syncs + auto-calcs | Build |
| 19 | "Cleaner needs something to physically look at" | Section 5.1.4 — Mobile task list for cleaner role | Build |
| 20 | "CPA needs the numbers — don't want to feed them manually" | Section 5.2.1 — Export to CPA, QB is source of truth | Build |

**Every row must be checked before delivery.**

---

---

# SECTION 7: INTEGRATION SPECIFICATIONS

## 7.1 Porter Integration

**Situation:** Porter has no public API as of this writing. Integration is via Zapier webhook.

**Primary method:**

```
Zapier Workflow:
  Trigger: Schedule — Daily at 6:00 AM EST
  Action: Pull Porter appointments/payments report (CSV or native Zapier Porter integration)
  Action: POST to /api/webhooks/porter with Bearer token
```

**Fallback method (if Zapier Porter integration is unavailable):**
- Porter exports CSV reports (confirmed they "export reports anytime")
- Zapier reads emailed CSV from Porter
- Same POST to /api/webhooks/porter

**Webhook Endpoint Spec:**
```
POST /api/webhooks/porter
Headers:
  Authorization: Bearer [webhook_secret from settings]
Body: {
  "appointments": [
    {
      "porter_id": "apt_123",
      "date": "2026-05-27",
      "time": "10:00",
      "artist_name": "Sarah Martinez",
      "artist_porter_id": "art_456",
      "service_type": "tattoo",
      "client_name": "Maria Gonzalez",
      "client_email": "maria@email.com",
      "client_phone": "407-555-0101",
      "price": 800.00,
      "tip": 80.00,
      "deposit_paid": 100.00,
      "status": "completed",
      "created_at": "2026-05-20T14:30:00Z"
    }
  ]
}

Response:
  200: { "received": true, "processed": 12, "errors": 0 }
  401: { "error": "Invalid webhook secret" }
  422: { "error": "Malformed payload", "details": [...] }
```

**Processing Logic:**
```
For each appointment:
  1. Look up artist in users table by artist_porter_id
     - If not found: create artist user record, notify admin
  2. Look up client in customers table by client_email
     - If not found: create customer record
     - If found: update visit_count, total_spend, last_visit
  3. Upsert appointment record (porter_id as unique key — avoid duplicates)
  4. If appointment.status === "completed":
     - Call CommissionService.calculateForAppointment(appointment)
     - Create commission record for artist
     - If appointment has walk_in_id match → create front desk commission
  5. Log success or error for each record
```

**Data Stored from Porter:**
```sql
-- appointments table (See Section 8 for full schema)
-- customers table
-- artist user records (if not already in users)
```

## 7.2 QuickBooks Integration

**Confirmed requirement:** QuickBooks Online (not Desktop). OAuth 2.0 only.

**Setup Flow (First Time):**
```
1. Owner goes to Settings > Integrations > QuickBooks
2. Clicks "Connect QuickBooks"
3. System redirects to:
   GET /api/integrations/quickbooks/auth
   → Builds OAuth URL with client_id, scopes, redirect_uri
   → Redirects to Intuit authorization page

4. Owner logs into QB, authorizes app
5. Intuit redirects to:
   GET /api/integrations/quickbooks/callback?code=AUTH_CODE&realmId=COMPANY_ID
   → Exchange code for access_token + refresh_token
   → Store both in settings table (encrypted)
   → Store realmId (QB company identifier)

6. System shows: "✅ QuickBooks connected"
7. System fetches QB chart of accounts → stores in local cache for mapping
```

**Token Refresh (Automatic):**
```
QB access tokens expire in 1 hour.
QB refresh tokens expire in 101 days.

Before every QB API call:
  - Check token expiry time
  - If expires in < 10 minutes: refresh
  - If refresh token expired: flag to owner (re-auth needed), queue all pending syncs

Token refresh endpoint (internal):
POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
  Body: grant_type=refresh_token&refresh_token=[stored_token]
  Response: { access_token, refresh_token, expires_in }
  → Update both tokens in settings table
```

**Posting Expenses to QB:**
```javascript
async function postExpenseToQB(expense) {
  const token = await getValidQBToken();
  const realmId = await getSetting('qb_realm_id');
  const accountId = await getQBAccountId(expense.category); // from settings mapping

  const payload = {
    "Line": [{
      "Amount": expense.amount,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "PostingType": "Debit",
        "AccountRef": {
          "value": accountId,
          "name": expense.category
        }
      }
    }, {
      "Amount": expense.amount,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "PostingType": "Credit",
        "AccountRef": {
          "value": "1000", // Cash account
          "name": "Cash"
        }
      }
    }],
    "Memo": expense.description,
    "TxnDate": expense.created_at.toISOString().split('T')[0]
  };

  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/journalentry`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    // Queue for retry
    await queueQBRetry(expense.id);
    throw new AppError('QB sync failed — queued for retry', 500);
  }

  const data = await response.json();
  return data.JournalEntry.Id; // QB transaction ID
}
```

**Pulling P&L from QB:**
```javascript
async function getProfitAndLoss(startDate, endDate) {
  const token = await getValidQBToken();
  const realmId = await getSetting('qb_realm_id');

  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/reports/ProfitAndLoss` +
    `?start_date=${startDate}&end_date=${endDate}&accounting_method=Accrual`,
    {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    }
  );

  const data = await response.json();
  // Parse QB's report structure into our simplified format
  return parseQBProfitAndLoss(data);
}

// Cache result in Redis or in-memory for 15 minutes
// QB API is slow — do not call on every page load
```

**Error Handling & Retry Queue:**
```
QB Retry Queue (qb_sync_queue table):
  - expense_id, attempt_count, next_retry_at, last_error

qb-retry.job.js runs every 5 minutes:
  - Fetch all records where next_retry_at <= NOW() AND attempt_count < 10
  - Try QB sync again
  - If success: update expense.qb_transaction_id, remove from queue
  - If fail: increment attempt_count, next_retry_at = NOW() + (5 * attempt_count) minutes
  - If attempt_count >= 10: flag as "permanent failure", notify owner
```

## 7.3 OpenAI Integration

**Model:** GPT-4o (most accurate for structured output — cost is negligible at this volume)

**Usage:**
1. Expense categorization (brain dump) — ~100-200 calls/day
2. Action plan generation (morning briefing) — ~1 call/day
3. Customer message template personalization — ~20-50 calls/day

**Estimated cost:** $10-20/month total. Not a concern.

**Implementation:**
```javascript
// Use OpenAI SDK, not raw fetch
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function categorizeExpense(description) {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: EXPENSE_CATEGORIZATION_PROMPT },
          { role: 'user', content: description }
        ],
        response_format: { type: 'json_object' }, // Enforce JSON output
        temperature: 0.1, // Low temperature for consistent categorization
        max_tokens: 150
      });

      const result = JSON.parse(response.choices[0].message.content);
      validateCategorizationResult(result); // Throws if malformed
      return result;

    } catch (error) {
      attempt++;
      if (attempt >= MAX_RETRIES) {
        logger.error(`Categorization failed after ${MAX_RETRIES} attempts: ${error.message}`);
        return { category: null, confidence: 0, status: 'manual_review' };
      }
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}
```

## 7.4 Twilio (SMS)

**Purpose:** Send follow-up and outreach SMS messages to customers.

**Setup:** Twilio account, verified phone number for Fallen Sparrow.

**Implementation:**
```javascript
import twilio from 'twilio';
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSMS(toPhone, message, customerId, templateId) {
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toPhone
    });

    // Log in messages table
    await db.messages.create({
      customer_id: customerId,
      template_id: templateId,
      channel: 'sms',
      message_body: message,
      external_id: result.sid,
      status: 'sent',
      sent_at: new Date()
    });

    return result.sid;
  } catch (error) {
    logger.error(`SMS send failed to ${toPhone}: ${error.message}`);
    throw new AppError('SMS send failed', 500);
  }
}
```

## 7.5 SendGrid (Email)

**Purpose:** Weekly report emails, follow-up emails, CPA report delivery.

**Implementation:**
```javascript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(toEmail, subject, htmlContent, customerId = null, templateId = null) {
  try {
    await sgMail.send({
      to: toEmail,
      from: { email: 'reports@fallensparrow.com', name: 'Fallen Sparrow' },
      subject,
      html: htmlContent
    });

    if (customerId) {
      await db.messages.create({
        customer_id: customerId,
        template_id: templateId,
        channel: 'email',
        message_body: htmlContent,
        status: 'sent',
        sent_at: new Date()
      });
    }
  } catch (error) {
    logger.error(`Email send failed to ${toEmail}: ${error.message}`);
    throw new AppError('Email send failed', 500);
  }
}
```

---

---

# SECTION 8: DATABASE SCHEMA

## Complete Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// USERS & AUTH
// ─────────────────────────────────────────────

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  firstName       String
  lastName        String
  role            UserRole  @default(FRONT_DESK)
  phone           String?
  porterArtistId  String?   @unique // Links to Porter artist ID
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  expensesLogged      Expense[]
  tasksAssigned       Task[]         @relation("AssignedTo")
  tasksCreated        Task[]         @relation("CreatedBy")
  taskLogs            TaskLog[]
  walkInsGreeted      WalkIn[]
  commissions         Commission[]
  messagesSent        Message[]
}

enum UserRole {
  OWNER
  MANAGER
  ARTIST
  FRONT_DESK
  CLEANER
}

// ─────────────────────────────────────────────
// EXPENSES (Brain Dump)
// ─────────────────────────────────────────────

model Expense {
  id                  String          @id @default(uuid())
  amount              Decimal         @db.Decimal(10, 2)
  description         String
  category            ExpenseCategory?
  qbAccountId         String?
  qbTransactionId     String?         @unique
  photoUrl            String?
  aiConfidence        Float?
  status              ExpenseStatus   @default(PENDING)
  loggedById          String
  loggedBy            User            @relation(fields: [loggedById], references: [id])
  inventoryUpdated    Boolean         @default(false)
  syncedToQbAt        DateTime?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@index([status])
  @@index([category])
  @@index([createdAt])
}

enum ExpenseCategory {
  SUPPLIES
  MAINTENANCE
  PAYROLL
  MARKETING
  UTILITIES
  ADMIN
  FURNITURE
}

enum ExpenseStatus {
  PENDING          // Created, not yet categorized
  CATEGORIZED      // AI categorized, waiting QB sync
  SYNCED           // Posted to QB successfully
  MANUAL_REVIEW    // AI confidence too low
  FAILED           // QB sync failed after all retries
}

// ─────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────

model InventoryItem {
  id                  String            @id @default(uuid())
  sku                 String            @unique
  name                String
  category            InventoryCategory
  currentQty          Int               @default(0)
  reorderLevel        Int               @default(5)
  reorderQty          Int               @default(10)
  unitCost            Decimal?          @db.Decimal(10, 2)
  vendor              String?
  leadTimeDays        Int?
  estimatedMonthlyUse Int?
  isActive            Boolean           @default(true)
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  transactions        InventoryTransaction[]

  @@index([category])
  @@index([currentQty])
}

enum InventoryCategory {
  CONSUMABLE
  EQUIPMENT
  MAINTENANCE_SUPPLY
}

model InventoryTransaction {
  id              String    @id @default(uuid())
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  type            String    // "in" or "out"
  qty             Int
  reason          String?   // "brain_dump_expense", "mark_used", "manual_adjustment"
  expenseId       String?   // Links to expense if triggered by brain dump
  loggedById      String?
  createdAt       DateTime  @default(now())

  @@index([itemId])
  @@index([createdAt])
}

// ─────────────────────────────────────────────
// TASKS & SOPs
// ─────────────────────────────────────────────

model SOP {
  id              String      @id @default(uuid())
  title           String
  assignedRoles   UserRole[]
  frequency       SOPFrequency
  scheduledTime   String?     // "08:00" (before open), "17:00" (before close)
  estimatedMins   Int?
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  checklistItems  SOPChecklistItem[]
  tasks           Task[]
}

enum SOPFrequency {
  DAILY
  WEEKLY
  MONTHLY
  AS_NEEDED
}

model SOPChecklistItem {
  id        String  @id @default(uuid())
  sopId     String
  sop       SOP     @relation(fields: [sopId], references: [id])
  order     Int
  text      String
  isActive  Boolean @default(true)
}

model Task {
  id              String      @id @default(uuid())
  sopId           String?
  sop             SOP?        @relation(fields: [sopId], references: [id])
  type            TaskType    @default(STANDARD)
  title           String
  description     String?
  assignedToId    String?
  assignedTo      User?       @relation("AssignedTo", fields: [assignedToId], references: [id])
  createdById     String
  createdBy       User        @relation("CreatedBy", fields: [createdById], references: [id])
  priority        TaskPriority @default(NORMAL)
  status          TaskStatus  @default(NOT_STARTED)
  dueDate         DateTime?
  dueTime         String?
  completedAt     DateTime?
  durationMins    Int?
  photoUrl        String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  logs            TaskLog[]

  @@index([status])
  @@index([assignedToId])
  @@index([dueDate])
}

enum TaskType {
  STANDARD    // From SOP
  INCIDENT    // Random/unplanned issue
  RESCHEDULE  // Customer reschedule request
}

enum TaskPriority {
  URGENT
  NORMAL
  LOW
}

enum TaskStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETE
  OVERDUE
  CANCELLED
}

model TaskLog {
  id          String    @id @default(uuid())
  taskId      String
  task        Task      @relation(fields: [taskId], references: [id])
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  action      String    // "started", "completed", "added_note", "marked_overdue"
  note        String?
  photoUrl    String?
  createdAt   DateTime  @default(now())

  @@index([taskId])
}

// ─────────────────────────────────────────────
// PORTER DATA (Cached)
// ─────────────────────────────────────────────

model Customer {
  id                  String    @id @default(uuid())
  porterId            String?   @unique
  firstName           String
  lastName            String
  email               String?   @unique
  phone               String?
  visitCount          Int       @default(0)
  totalSpend          Decimal   @default(0) @db.Decimal(10, 2)
  lastVisitAt         DateTime?
  servicesTaken       String[]  // ["tattoo", "piercing", "laser"]
  referralCount       Int       @default(0)
  segment             CustomerSegment?
  segmentUpdatedAt    DateTime?
  importedAt          DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  appointments        Appointment[]
  walkIns             WalkIn[]
  messages            Message[]
  commissions         Commission[]

  @@index([segment])
  @@index([lastVisitAt])
  @@index([totalSpend])
}

enum CustomerSegment {
  AT_RISK
  REFERRAL_GOLDMINE
  UPSELL_OPPORTUNITY
  NEW_CUSTOMER
  ACTIVE
}

model Appointment {
  id              String    @id @default(uuid())
  porterId        String    @unique
  date            DateTime
  artistId        String?
  artist          User?     @relation(fields: [artistId], references: [id])
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  serviceType     String    // "tattoo", "piercing", "laser", "medical"
  price           Decimal   @db.Decimal(10, 2)
  tip             Decimal   @default(0) @db.Decimal(10, 2)
  depositPaid     Decimal   @default(0) @db.Decimal(10, 2)
  status          String    // "completed", "cancelled", "no-show"
  walkInId        String?
  walkIn          WalkIn?   @relation(fields: [walkInId], references: [id])
  syncedAt        DateTime  @default(now())
  createdAt       DateTime

  commissions     Commission[]

  @@index([date])
  @@index([artistId])
  @@index([status])
}

// ─────────────────────────────────────────────
// WALK-INS
// ─────────────────────────────────────────────

model WalkIn {
  id                      String    @id @default(uuid())
  trackingId              String    @unique @default(cuid())
  customerId              String?
  customer                Customer? @relation(fields: [customerId], references: [id])
  customerName            String    // Captured at walk-in, may not yet be in system
  customerPhone           String?
  greetedById             String
  greetedBy               User      @relation(fields: [greetedById], references: [id])
  referralSource          String    // "walk-by", "instagram", "google", "referral", "other"
  referralName            String?   // If "referral", who referred them
  notes                   String?
  convertedToAppointmentId String?
  convertedAt             DateTime?
  createdAt               DateTime  @default(now())

  appointments            Appointment[]

  @@index([greetedById])
  @@index([createdAt])
}

// ─────────────────────────────────────────────
// COMMISSIONS
// ─────────────────────────────────────────────

model Commission {
  id              String            @id @default(uuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id])
  appointmentId   String?
  appointment     Appointment?      @relation(fields: [appointmentId], references: [id])
  customerId      String?
  customer        Customer?         @relation(fields: [customerId], references: [id])
  walkInId        String?
  type            CommissionType
  amount          Decimal           @db.Decimal(10, 2)
  rate            Decimal?          @db.Decimal(5, 4) // E.g., 0.15 for 15%
  periodStart     DateTime
  periodEnd       DateTime
  status          CommissionStatus  @default(PENDING)
  paidAt          DateTime?
  trackingId      String            @unique @default(cuid())
  notes           String?
  createdAt       DateTime          @default(now())

  @@index([userId])
  @@index([status])
  @@index([periodStart, periodEnd])
}

enum CommissionType {
  ARTIST_SERVICE    // % of service price
  WALK_IN_BONUS     // Flat rate for converting walk-in
  UPSELL_BONUS      // Flat rate for upselling a service
  REFERRAL_BONUS    // Flat rate for successful referral
}

enum CommissionStatus {
  PENDING
  APPROVED
  PAID
  DISPUTED
}

// ─────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────

model MessageTemplate {
  id          String    @id @default(uuid())
  name        String
  segment     CustomerSegment?  // Which segment this template targets
  channel     String    // "sms", "email", "both"
  subject     String?   // Email subject only
  body        String    // Template with [name], [days], [service] placeholders
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  messages    Message[]
}

model Message {
  id              String    @id @default(uuid())
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  templateId      String?
  template        MessageTemplate? @relation(fields: [templateId], references: [id])
  sentById        String
  sentBy          User      @relation(fields: [sentById], references: [id])
  channel         String    // "sms", "email"
  messageBody     String
  externalId      String?   // Twilio SID or SendGrid ID
  status          String    // "sent", "delivered", "failed", "responded"
  respondedAt     DateTime?
  responseText    String?
  sentAt          DateTime  @default(now())

  @@index([customerId])
  @@index([sentAt])
}

// ─────────────────────────────────────────────
// QB RETRY QUEUE
// ─────────────────────────────────────────────

model QBSyncQueue {
  id            String    @id @default(uuid())
  expenseId     String    @unique
  attemptCount  Int       @default(0)
  nextRetryAt   DateTime
  lastError     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────

model Setting {
  key       String  @id
  value     String
  updatedAt DateTime @updatedAt
}

// Keys used in settings table:
// qb_access_token (encrypted)
// qb_refresh_token (encrypted)
// qb_realm_id
// qb_token_expires_at
// porter_webhook_secret
// commission_rate_tattoo (e.g., "0.15")
// commission_rate_piercing (e.g., "0.20")
// commission_rate_laser (e.g., "0.25")
// commission_rate_medical (e.g., "0.30")
// walk_in_bonus_amount (e.g., "20.00")
// upsell_bonus_amount (e.g., "15.00")
// referral_bonus_amount (e.g., "50.00")
// at_risk_threshold_days (e.g., "90")
// referral_goldmine_min_visits (e.g., "3")
// referral_goldmine_min_spend (e.g., "1500.00")
// weekly_report_day (e.g., "5" for Friday)
// weekly_report_time (e.g., "17:00")
// weekly_report_recipients (comma-separated emails)
// cpa_email
// qb_account_supplies (e.g., "6100")
// qb_account_maintenance (e.g., "6200")
// ... (all QB account mappings)
```

---

---

# SECTION 9: CODE STANDARDS — NON-NEGOTIABLE

## 9.1 Architecture Rules

**Rule 1: Routes → Controllers → Services → Models. Never skip a layer.**
```javascript
// routes/expenses.routes.js
router.post('/', authMiddleware, validateMiddleware(expenseSchema), expenseController.create);

// controllers/expense.controller.js
async function create(req, res, next) {
  try {
    const expense = await expenseService.logExpense(req.body, req.user.id);
    res.status(201).json(expense);
  } catch (error) {
    next(error); // Global error handler catches it
  }
}

// services/expense.service.js
async function logExpense(data, userId) {
  validateInput(data); // Throws if invalid
  const categorized = await openaiIntegration.categorizeExpense(data.description);
  const expense = await expenseModel.create({ ...data, ...categorized, loggedById: userId });
  await quickbooksIntegration.postExpense(expense); // Has own retry logic
  if (categorized.inventorySku) {
    await inventoryService.increment(categorized.inventorySku, categorized.inventoryQty);
  }
  return expense;
}

// models are Prisma — used via prisma client, never raw SQL in services
```

**Rule 2: Every function has ONE job.**
```javascript
// WRONG — one function doing too much
async function processExpenseAndUpdateEverything(data) { ... }

// RIGHT — one job each
async function categorizeExpense(description) { ... }
async function createExpenseRecord(data) { ... }
async function postToQuickBooks(expense) { ... }
async function updateInventoryIfApplicable(expense) { ... }
```

**Rule 3: No hardcoded values. Everything from config or database.**
```javascript
// WRONG
const atRiskDays = 90;

// RIGHT
const atRiskDays = parseInt(await getSetting('at_risk_threshold_days'));
```

**Rule 4: Explicit naming. No abbreviations. No ambiguity.**
```javascript
// WRONG
const calc = async (a, b) => ...
const getC = async (id) => ...

// RIGHT
const calculateArtistCommission = async (appointmentId, commissionRate) => ...
const getCustomerById = async (customerId) => ...
```

**Rule 5: All secrets in .env. Never hardcoded. Ever.**
```javascript
// WRONG
const apiKey = 'sk-proj-abc123...';

// RIGHT
const apiKey = process.env.OPENAI_API_KEY;
// And process.env access is only via /config/env.js which validates at startup
```

## 9.2 Error Handling Rules

**Every async function is wrapped in try/catch.**
**Every error goes through the AppError class.**
**Every error is logged before re-throwing.**

```javascript
// /utils/errors.js
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Distinguishes from programming errors
  }
}

// /middleware/error.middleware.js
function globalErrorHandler(err, req, res, next) {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  // Programming error — don't leak details
  return res.status(500).json({
    success: false,
    error: 'Something went wrong. Our team has been notified.'
  });
}
```

## 9.3 Logging Rules

```javascript
// /utils/logger.js — Winston structured logging
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ level: process.env.LOG_LEVEL || 'info' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Usage throughout codebase:
logger.info('Expense categorized', { expenseId, category, confidence });
logger.warn('QB sync queued for retry', { expenseId, attempt: 2 });
logger.error('QB sync permanently failed', { expenseId, lastError });

// NEVER use console.log in production code
// ESLint rule: 'no-console': 'error'
```

## 9.4 Security Rules

- Passwords: bcrypt with salt rounds >= 12
- JWT: short expiry (15 minutes) + refresh token (7 days)
- All QB tokens: encrypted at rest in database using AES-256
- Webhook secrets: validated on every webhook request
- CORS: configured to allow only the frontend domain
- SQL injection: Prisma ORM prevents this by default — never use raw SQL
- Rate limiting: express-rate-limit on auth endpoints (5 req/min)
- Input validation: express-validator on every endpoint that accepts user data
- HTTPS: enforced at hosting level (Railway handles this)

---

---

# SECTION 10: TESTING REQUIREMENTS

## 10.1 Unit Tests — Service Layer

Every service method must have tests covering:
1. The happy path (it works correctly)
2. Invalid input (it rejects gracefully)
3. External service failure (it handles gracefully)

```javascript
// tests/unit/services/expense.service.test.js

describe('ExpenseService.logExpense', () => {

  describe('Happy Path', () => {
    it('should categorize, save, and sync to QB when confidence is high', async () => {
      // Mock OpenAI to return { category: 'SUPPLIES', confidence: 0.98 }
      // Mock QB to return a transaction ID
      // Call logExpense({ amount: 140, description: 'Bought ink cartridges' }, 'user-123')
      // Assert: expense saved in DB with status 'SYNCED'
      // Assert: QB mock called once with correct payload
      // Assert: inventory incremented if SKU detected
    });
  });

  describe('Low Confidence Path', () => {
    it('should flag for manual review when AI confidence < 0.85', async () => {
      // Mock OpenAI to return { category: 'ADMIN', confidence: 0.60 }
      // Call logExpense(...)
      // Assert: expense saved with status 'MANUAL_REVIEW'
      // Assert: QB mock NOT called
      // Assert: notification sent to owner
    });
  });

  describe('QB Failure Path', () => {
    it('should queue for retry when QB sync fails', async () => {
      // Mock OpenAI success
      // Mock QB to throw error
      // Call logExpense(...)
      // Assert: expense saved with status 'CATEGORIZED' (not synced)
      // Assert: QBSyncQueue record created
      // Assert: no error thrown to caller (graceful degradation)
    });
  });

  describe('Input Validation', () => {
    it('should reject expense with amount <= 0', async () => {
      await expect(logExpense({ amount: -5, description: 'Test' }, 'user-123'))
        .rejects.toThrow('Amount must be greater than 0');
    });

    it('should reject expense with empty description', async () => {
      await expect(logExpense({ amount: 50, description: '' }, 'user-123'))
        .rejects.toThrow('Description is required');
    });
  });
});
```

Write equivalent tests for:
- InventoryService (increment, decrement, getLowStockAlerts)
- TaskService (create, complete, logIncident, getDueTodayCount)
- CommissionService (calculateForAppointment, calculateForWalkIn)
- CustomerService (segmentAll, getAtRisk, getSegment)
- ActionPlanService (generateWeeklyPlan, getTopAction)
- MessageService (generateFromTemplate, send)
- BriefingService (assembleMorningBriefing)
- FinancialService (getProfitAndLoss, getYesterdayRevenue)

## 10.2 Integration Tests — API Layer

Test every endpoint end-to-end against a test database:

```javascript
// tests/integration/api/expenses.test.js

describe('POST /api/expenses', () => {

  beforeAll(async () => {
    // Seed test user, set up test DB
    testUser = await createTestUser({ role: 'MANAGER' });
    authToken = generateTestToken(testUser);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.expense.deleteMany({ where: { loggedById: testUser.id } });
  });

  it('returns 201 and expense object on success', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 140, description: 'Bought ink cartridges' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.category).toBe('SUPPLIES');
    expect(res.body.status).toMatch(/SYNCED|MANUAL_REVIEW/);
  });

  it('returns 401 when no auth token', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ amount: 140, description: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user role is CLEANER (no expense access)', async () => {
    const cleanerToken = generateTestToken({ role: 'CLEANER' });
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${cleanerToken}`)
      .send({ amount: 140, description: 'Test' });
    expect(res.status).toBe(403);
  });

  it('returns 422 when amount is missing', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ description: 'Test' });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain('amount');
  });
});
```

Write equivalent integration tests for every route.

## 10.3 Pre-Delivery Checklist

```
MUST PASS BEFORE HANDING TO CURSOR:

CODE QUALITY:
[ ] ESLint passes with 0 errors
[ ] No console.log statements anywhere
[ ] No hardcoded secrets or values
[ ] No unused imports or dead code
[ ] All functions have explicit return types (TypeScript) or JSDoc comments

TESTING:
[ ] All unit tests pass
[ ] All integration tests pass
[ ] Code coverage >= 80% on services, controllers, models
[ ] Edge cases and failure paths tested (not just happy path)

PERFORMANCE:
[ ] API startup time < 3 seconds
[ ] All API endpoints respond in < 200ms (under normal load)
[ ] No N+1 database queries (check Prisma query logs)
[ ] QB API calls are cached appropriately

SECURITY:
[ ] All passwords hashed (bcrypt, rounds >= 12)
[ ] All QB tokens encrypted in DB
[ ] CORS configured for frontend domain only
[ ] Rate limiting active on auth endpoints
[ ] Webhook secrets validated on every webhook call
[ ] No sensitive data in logs

DATABASE:
[ ] All migrations run successfully from clean state
[ ] All migrations are reversible
[ ] Indexes created on all frequently-queried columns
[ ] Foreign keys explicitly defined on all relations

INTEGRATIONS:
[ ] QB OAuth flow tested end-to-end (connect → post expense → verify in QB)
[ ] Porter webhook endpoint tested with sample payload
[ ] OpenAI expense categorization tested with 20+ sample descriptions
[ ] Twilio SMS tested with real phone number
[ ] SendGrid email tested with real email address

DOCUMENTATION:
[ ] README complete (setup, run, deploy, architecture overview)
[ ] Every service documented (what it does, dependencies, error cases)
[ ] .env.example includes every required variable with description
[ ] OpenAPI/Swagger spec generated and accurate
[ ] Database schema documented (schema.md)
[ ] Handoff notes for Cursor written (gotchas, known limitations)
```

---

---

# SECTION 11: IMPLEMENTATION ROADMAP

## Day-By-Day Plan (7 Weeks)

### Week 1 — Intake & Architecture

**Days 1-3: Code Intake & Analysis**
- Request all source code from Trevor (GCOps + KPI Tracker)
- Read every file of both codebases thoroughly
- Create extraction maps (what to keep, adapt, discard) for both
- Get Trevor's sign-off on extraction maps before proceeding
- Answer all clarifying questions (see Section 3.4)

**Days 4-5: Architecture Design**
- Design unified database schema (Prisma)
- Design folder structure
- Design all API endpoints
- Create data flow diagrams
- Confirm tech stack matches Trevor's existing codebases
- Get Trevor's sign-off on architecture before writing code

---

### Week 2 — Foundation

**Days 6-7: Project Setup**
- Initialize Node.js + Express project
- Install all dependencies
- Configure ESLint, Prettier, Winston
- Set up Docker + docker-compose for local development
- Set up PostgreSQL + Prisma
- Write and run all database migrations
- Create .env.example with all required variables
- Set up test framework (Jest + Supertest)

**Days 8-10: Auth + RBAC**
- User model + migrations
- Registration + login endpoints
- JWT middleware
- Role-based access control middleware
- Test: all auth paths

---

### Week 3 — Brain Dump + Inventory

**Days 11-13: Brain Dump (Adapted From GCOps)**
- Extract categorization logic from GCOps
- Adapt OpenAI prompt for tattoo studio context
- Build ExpenseService (categorize, create, sync to QB)
- Build QB integration (OAuth flow, token refresh, post expense, retry queue)
- Build expense endpoints (POST, GET, manual review queue)
- Test: 20+ expense descriptions for categorization accuracy

**Days 14-15: Inventory**
- Build InventoryService (increment, decrement, alerts)
- Build inventory endpoints (CRUD, low stock query)
- Wire brain dump → inventory auto-update
- Test: inventory tracking end-to-end

---

### Week 4 — Tasks + Commissions + Walk-Ins

**Days 16-17: SOP & Task Management**
- Build TaskService + SOPService
- Build task endpoints (create, update status, log, incident report)
- Build scheduled SOP task generation (daily tasks auto-created from SOPs)
- Build time tracking (start_time, end_time, duration)
- Test: task workflows for all roles

**Days 18-19: Commission Tracking**
- Build CommissionService (calculate artist, walk-in bonus, referral bonus)
- Build commission endpoints (view by user, by period, payout status)
- Build walk-in model + endpoints
- Wire walk-in → commission attribution
- Test: commission calculations for all types

**Day 20: Buffer / Catch-Up**

---

### Week 5 — Porter Sync + B.O.S.S.

**Days 21-22: Porter Integration**
- Build Porter webhook endpoint
- Build Porter data ingestion logic (upsert customers, appointments)
- Build scheduled Porter sync job (daily at 6am via node-cron)
- Test with sample Porter payload
- Verify customer data + appointment data lands correctly in DB

**Days 23-25: Customer Intelligence (Adapted From KPI Tracker)**
- Extract segmentation algorithm from KPI Tracker
- Adapt thresholds and logic for tattoo studio context
- Build CustomerService (segment, prioritize, get action plan)
- Build ActionPlanService (weekly plan generation)
- Build customer endpoints (segments, action plan)
- Build message template engine
- Build MessageService (generate, send via Twilio/SendGrid)
- Test: segmentation with sample customer data

---

### Week 6 — Dashboard + Reports + Briefing

**Days 26-27: Financial Dashboard**
- Build FinancialService (P&L from QB, yesterday revenue)
- Build financial endpoints (P&L with date range, filters, exports)
- Build CPA email endpoint
- Test: P&L accuracy against test QB account

**Days 28-29: Morning Briefing + Quick-View Tiles**
- Build BriefingService (assemble all 6 data points in parallel)
- Build dashboard endpoints (briefing, summary tiles)
- Implement caching (5-minute cache on all tile data)
- Test: briefing assembles correctly under various data states

**Day 30: Automated Weekly Report**
- Build ReportService (full weekly report HTML generation)
- Build weekly-report.job.js (scheduled job, Friday 5pm)
- Build report endpoints (manual trigger, settings for schedule)
- Test: send actual email with real report content

**Day 31: Reschedule Tracking**
- Add RESCHEDULE task type + creation endpoint
- Add escalation logic (24-hour rule)
- Test: reschedule workflow end-to-end

---

### Week 7 — Polish, Test, Document, Deliver

**Days 32-33: Full Test Pass**
- Run all unit tests — fix any failures
- Run all integration tests — fix any failures
- Manual QA of every feature
- Check all items on pre-delivery checklist (Section 10.3)

**Day 34: Performance & Security Audit**
- Check all API response times (< 200ms target)
- Check database query performance (no N+1s)
- Verify CORS configuration
- Verify token encryption
- Verify rate limiting

**Day 35: Documentation**
- Complete README (setup, deploy, architecture, service descriptions)
- Generate OpenAPI/Swagger spec
- Write schema.md (database documentation)
- Write handoff notes for Cursor

**Days 36-37: Deploy to Staging + Trevor UAT**
- Deploy to Railway staging environment
- Walk Trevor through every feature
- Fix any issues found
- Get Trevor's sign-off

**Delivery: Clean backend codebase + documentation → to Cursor**

---

---

# SECTION 12: DELIVERABLES — WHAT CURSOR GETS

When you hand off to Cursor, they receive:

## 12.1 Codebase

```
/fallen-sparrow-backend (complete, runnable Node.js app)
  All services built and tested
  All integrations wired (QB, Porter, OpenAI, Twilio, SendGrid)
  All API endpoints documented and working
  All database migrations ready to run
  Seed data for development/testing
```

## 12.2 API Documentation (Swagger)

Auto-generated from code annotations. Cursor opens this to understand every endpoint, what it accepts, what it returns.

## 12.3 .env.example

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fallen_sparrow

# Auth
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-...

# QuickBooks
QB_CLIENT_ID=your_qb_client_id
QB_CLIENT_SECRET=your_qb_client_secret
QB_REDIRECT_URI=http://localhost:3000/api/integrations/quickbooks/callback
QB_ENVIRONMENT=sandbox  # Change to 'production' for live

# Porter
PORTER_WEBHOOK_SECRET=your_webhook_secret

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+14075550100

# SendGrid
SENDGRID_API_KEY=SG...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=fallen-sparrow-uploads
AWS_REGION=us-east-1

# Encryption (for QB tokens at rest)
ENCRYPTION_KEY=32-character-random-string-here
```

## 12.4 README (Complete)

```markdown
# Fallen Sparrow Backend

## What This Is
Custom back-office management system for Fallen Sparrow Tattoo Co.
Built on Node.js + Express + PostgreSQL + Prisma.

## Setup (Local Development)
1. Clone repo
2. `npm install`
3. Copy `.env.example` to `.env`, fill in all values
4. `docker-compose up -d` (starts PostgreSQL)
5. `npx prisma migrate dev` (runs migrations)
6. `npx prisma db seed` (seeds test data)
7. `npm run dev` (starts server with hot reload)

## Architecture
[Diagram showing Frontend → API → Services → Models → DB]
[Brief description of each layer]

## Services
[Description of every service, what it does, dependencies]

## API
Swagger docs available at: http://localhost:3000/api-docs

## Database
Schema documented in /prisma/schema.md
All migrations in /prisma/migrations

## Testing
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests (requires test DB)
npm run test:coverage      # Coverage report

## Deployment (Railway)
1. Connect Railway to GitHub repo
2. Set all environment variables in Railway dashboard
3. Railway auto-deploys on push to main

## Gotchas / Known Issues
[List anything Cursor needs to know]

## Frontend Requirements
[What Cursor needs to build, API endpoints they'll call, auth flow, etc.]
```

## 12.5 Handoff Notes for Cursor

```markdown
# CURSOR FRONTEND HANDOFF

## Your Job
Build the full frontend (React, mobile + desktop) that calls the backend API.
The backend is complete and documented. You should not need to modify any backend code.

## Mobile App Requirements
- Mobile-responsive React app
- Primary colors: [TBD — get from Legion/Trevor]
- Thumb-friendly (minimum 44px tap targets)
- Auto-refresh every 5 minutes while active
- Works on iOS Safari and Android Chrome

## Desktop App Requirements
- Full-screen dashboard layout
- Left sidebar navigation
- Main content area
- Charts: Recharts or Chart.js (revenue trends, expense breakdown)
- Data tables: sortable, filterable

## Auth Flow
POST /api/auth/login → { token, refreshToken, user }
Store token in memory (NOT localStorage — session only)
Attach token to every request: Authorization: Bearer [token]
On 401: try refresh token, then redirect to login

## Role-Based UI
Frontend receives user.role from auth response.
Show/hide UI elements based on role (see Section 5.2.9 permissions table).
Never rely on frontend-only restrictions — backend enforces all permissions.

## Key Endpoints to Call (Mobile)
GET /api/dashboard/morning-briefing    (home screen)
POST /api/expenses                     (brain dump input)
GET /api/tasks?assignedToMe=true       (task checklist)
POST /api/walk-ins                     (walk-in logging)

## Key Endpoints to Call (Desktop)
GET /api/financials/p-and-l?start=X&end=Y
GET /api/inventory
GET /api/tasks
GET /api/commissions?period=current
GET /api/customers/segments
GET /api/intelligence/action-plan
GET /api/messages/history
GET /api/reports/weekly (manual trigger)

## Performance Notes
- Morning briefing: renders within 2 seconds (backend caches the data)
- P&L dashboard: first load may take 3-4 seconds (QB API is slow) — show loading state
- All other endpoints: < 200ms
```

---

---

# SECTION 13: DEPLOYMENT & INFRASTRUCTURE

## 13.1 Hosting Architecture

| Component | Service | Cost/Month |
|---|---|---|
| Backend (Node.js + API) | Railway | $20-30 |
| Database (PostgreSQL) | Railway managed | $15 |
| Frontend (React) | Vercel | $0 (free tier) |
| File Storage (receipts, exports) | AWS S3 | $5 |
| Email | SendGrid | $15 (Essentials plan) |
| SMS | Twilio | $10-20 (pay per message) |
| Error Tracking | Sentry | $0 (free tier) |
| **TOTAL** | | **~$65-85/month** |

(Covered by the $250-$350/month retainer. Significant margin for Trevor.)

## 13.2 Environments

**Local:** docker-compose (Node.js + PostgreSQL in containers)
**Staging:** Railway (exact mirror of production, separate QB sandbox account)
**Production:** Railway (live QB account, live Porter data)

## 13.3 CI/CD

- Code lives on GitHub
- Push to `main` → auto-deploy to staging
- Manual promote to production (Trevor approves)
- Prisma migrations run automatically on deploy (with down migration as backup)

## 13.4 Monitoring & Alerting

- **Sentry:** Any unhandled error in production → Sentry captures → alerts Trevor via email
- **Railway health checks:** If API goes down → auto-restart, alert if restart fails
- **Uptime:** Railway provides basic uptime monitoring
- **QB sync failures:** Logged + notified via in-app alert to owner
- **Porter sync failures:** Logged + notified via in-app alert

---

---

# SECTION 14: SUPPORT & ITERATION PLAN

## 14.1 Post-Launch (First 30 Days)

**Daily:**
- Monitor error logs in Sentry
- Check QB sync success rate (should be 100%)
- Check Porter sync success rate (should be 100%)
- Fix any critical bugs within 24 hours

**Weekly:**
- Review feature usage with Legion (async via chat)
- Review commission accuracy
- Review AI categorization accuracy (check manual review queue)
- Performance check

## 14.2 Monthly Retainer (Ongoing at $250-350/month)

Covers:
- Hosting infrastructure costs (~$65-85/month)
- Maintenance and bug fixes
- Minor feature additions
- QB OAuth token maintenance
- Dependency security updates
- Monthly check-in with Legion

## 14.3 Feature Request Process

1. Legion or Hector reports request via in-app feedback button
2. Trevor reviews, estimates complexity
3. Categories:
   - **Critical** (breaks workflow): fix immediately, included in retainer
   - **Important** (improves workflow): schedule in next sprint, may be billable
   - **Nice-to-have**: backlog, bundled into monthly updates

## 14.4 Scalability Path

If Fallen Sparrow grows significantly (multiple locations, franchise):
- Current architecture scales to ~10,000 appointments/month without changes
- Beyond that: add caching layer (Redis), upgrade Railway plan, read replicas for PostgreSQL
- All current decisions are forward-compatible with scaling

---

---

# SECTION 15: APPENDICES

## Appendix A: QuickBooks Chart of Accounts Mapping

```
EXPENSE BRAIN DUMP CATEGORY → QB GL ACCOUNT

SUPPLIES        → 6100 — Supplies Expense
MAINTENANCE     → 6200 — Repairs and Maintenance
PAYROLL         → 6300 — Payroll Expense
MARKETING       → 6500 — Marketing and Advertising
UTILITIES       → 6600 — Utilities
ADMIN           → 6700 — General and Administrative
FURNITURE       → 1500 — Furniture and Equipment (asset account)

INCOME (from Porter, read-only):
TATTOO          → 4100 — Tattoo Services Revenue
PIERCING        → 4200 — Piercing Services Revenue
LASER           → 4300 — Laser Removal Revenue
MEDICAL         → 4400 — Medical Tattoo Revenue

NOTE: These account numbers are examples. When QB is connected,
fetch the actual chart of accounts and let Legion map them in Settings.
Store mapping in settings table. Never hardcode account IDs.
```

## Appendix B: SOP Templates (Starter Set)

```
SOP 1: Daily Shop Cleanliness
Assigned: CLEANER
Frequency: DAILY
Scheduled: 30 minutes before open
Estimated: 60 minutes
Checklist:
  1. Sweep and mop all floors
  2. Sanitize all chairs and work stations
  3. Empty all trash cans, replace liners
  4. Organize supply shelves
  5. Wipe down mirrors and glass surfaces
  6. Check and refill hand sanitizers at each station
  7. Check bathrooms — clean if needed, restock paper products
  8. Check for any issues/incidents to report

SOP 2: Opening Procedures
Assigned: FRONT_DESK
Frequency: DAILY
Scheduled: At open time
Estimated: 15 minutes
Checklist:
  1. Unlock front door, turn off alarm
  2. Turn on lights, music, point-of-sale system
  3. Check Porter for today's appointments
  4. Set up lobby (water, coffee, etc.)
  5. Confirm artist stations are prepped
  6. Check walk-in log from previous day — any follow-ups needed?

SOP 3: Artist Station Prep
Assigned: ARTIST
Frequency: DAILY
Scheduled: Before first appointment
Estimated: 15 minutes
Checklist:
  1. Sanitize all surfaces
  2. Set up sterilized equipment
  3. Check ink supply — request restock if low
  4. Review day's appointments in Porter
  5. Prepare consent forms if not yet done by Porter

SOP 4: Closing Procedures
Assigned: FRONT_DESK
Frequency: DAILY
Scheduled: At close time
Estimated: 20 minutes
Checklist:
  1. Process any outstanding payments in Porter
  2. Count cash drawer (if applicable)
  3. Review walk-in log — any conversions to note for commissions?
  4. Check tomorrow's appointments in Porter
  5. Turn off equipment, lights, music
  6. Lock up, set alarm

SOP 5: Weekly Inventory Count
Assigned: FRONT_DESK
Frequency: WEEKLY
Scheduled: Monday at 9:00 AM
Estimated: 30 minutes
Checklist:
  1. Open Inventory in dashboard
  2. Count all consumables (ink, needles, gloves)
  3. Update quantities in dashboard for anything that doesn't match
  4. Note any items at or below reorder level
  5. Create purchase orders for anything RED status

SOP 6: Weekly Commission Review
Assigned: MANAGER
Frequency: WEEKLY
Scheduled: Friday at 4:00 PM
Estimated: 20 minutes
Checklist:
  1. Open Commission Tracking in dashboard
  2. Review all pending commissions for the week
  3. Verify artist commissions match Porter appointment data
  4. Verify walk-in bonuses are attributed correctly
  5. Approve commissions for payout
  6. Schedule payouts for following Tuesday
```

## Appendix C: Commission Rate Structure (Starting Point — Configurable)

```
ARTIST COMMISSIONS (% of service charge):
  Tattoo Services:        15%
  Piercing Services:      20%
  Laser Removal:          25%
  Medical Tattoo:         30%

FRONT DESK COMMISSIONS (flat rate per event):
  Walk-in conversion (becomes appointment):   $20.00
  Upsell (adds service not originally booked): $15.00
  Referral confirmed (new client referred):   $50.00
  New client first booking (via outreach):    $25.00

NOTE: These are starting values. Legion configures final rates in Settings.
All rates stored in settings table. Never hardcode in business logic.
```

## Appendix D: Customer Segmentation Thresholds (Starting Point — Configurable)

```
AT-RISK:
  Condition: last_visit_at < NOW() - INTERVAL '90 days'
  AND visit_count >= 1
  Priority factor: lifetime total_spend (descending)

REFERRAL GOLDMINE:
  Condition: visit_count >= 3
  AND total_spend >= 1500
  Priority factor: total_spend + recency

UPSELL OPPORTUNITY:
  Condition: 'tattoo' IN services_taken
  AND 'piercing' NOT IN services_taken
  AND 'laser' NOT IN services_taken
  AND last_visit_at > NOW() - INTERVAL '60 days'
  Priority factor: visit_count + recency

NEW CUSTOMER FOLLOW-UP:
  Condition: visit_count = 1
  AND last_visit_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '14 days'
  Priority factor: booking_amount (newest first)

NOTE: All thresholds configurable in settings table:
  at_risk_threshold_days = 90
  referral_goldmine_min_visits = 3
  referral_goldmine_min_spend = 1500.00
  upsell_recency_days = 60
  new_customer_follow_up_days_min = 7
  new_customer_follow_up_days_max = 14
```

## Appendix E: Message Templates (Starter Set)

```
TEMPLATE 1: At-Risk Outreach (SMS)
Name: at_risk_sms_v1
Segment: AT_RISK
Channel: SMS
Body: "Hey [firstName]! It's been a while since we've seen you at Fallen Sparrow. 
We miss you! We'd love to have you back — reply to book or call us at [shopPhone]. 
Hope to see you soon. 🖤"

TEMPLATE 2: At-Risk Outreach (Email)
Name: at_risk_email_v1
Segment: AT_RISK
Channel: EMAIL
Subject: "We miss you, [firstName]!"
Body: [HTML email with same message, formatted]

TEMPLATE 3: Referral Bonus Offer (SMS)
Name: referral_goldmine_sms_v1
Segment: REFERRAL_GOLDMINE
Channel: SMS
Body: "Hey [firstName]! As one of our favorite clients, we'd love to reward you. 
For every friend you refer who books with us, you get $50 credit. 
Just have them mention your name. 🙌 — Fallen Sparrow"

TEMPLATE 4: Upsell — Piercing (SMS)
Name: upsell_piercing_sms_v1
Segment: UPSELL_OPPORTUNITY
Channel: SMS
Body: "Hey [firstName]! We've expanded our piercing portfolio and thought of you. 
Ask us about it at your next appointment — or book a consultation today! 🖤"

TEMPLATE 5: New Customer Follow-Up (SMS)
Name: new_customer_followup_sms_v1
Segment: NEW_CUSTOMER
Channel: SMS
Body: "Hey [firstName]! Thanks for visiting Fallen Sparrow recently — 
we hope you loved your experience! We'd love to see you again. 
Reply to book or share us with a friend. 🙏"

TEMPLATE 6: No-Show Follow-Up (SMS)
Name: no_show_followup_sms_v1
Segment: null
Channel: SMS
Body: "Hey [firstName], we missed you at your appointment! 
Life happens — we'd love to reschedule. Just reply with a day that works for you!"
```

## Appendix F: Environment Variables Reference

```
REQUIRED (app won't start without these):
  NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

REQUIRED FOR CORE FEATURES:
  OPENAI_API_KEY                (expense categorization)
  QB_CLIENT_ID, QB_CLIENT_SECRET (QuickBooks — needed at first QB connect)
  QB_REDIRECT_URI

REQUIRED FOR COMMUNICATIONS:
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
  SENDGRID_API_KEY

REQUIRED FOR FILE UPLOADS:
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME, AWS_REGION

REQUIRED FOR SECURITY:
  ENCRYPTION_KEY (32 chars — for QB token encryption at rest)
  PORTER_WEBHOOK_SECRET (set this, configure same value in Zapier)

OPTIONAL:
  LOG_LEVEL (default: 'info')
  SENTRY_DSN (error tracking — add when deploying to production)
```

---

---

# FINAL WORD

This document is the single source of truth for the Fallen Sparrow build.

Every feature in here was derived from something Legion Avegno said on that discovery call. Not one requirement was invented. Not one pain point was ignored.

Your job is to build exactly what's in here — clean, tested, documented, and ready for Cursor to wrap a world-class UI around.

When Legion logs in for the first time and sees his shop in real-time from Belize, that's the moment this document paid off.

**Build it like it matters. Because it does.**

🚀
