# B.O.S.S. EXTRACTION ANALYSIS
## What to Extract, What to Skip, What to Build Custom

**Date:** May 28, 2026  
**Project:** Fallen Sparrow Tattoo Studio Management System  
**Status:** Phase 0 — Architecture Validation

---

## EXECUTIVE SUMMARY

**What B.O.S.S. Does Well (Extract):**
✅ KPI/metric calculation framework (daily/weekly/monthly revenue by product)
✅ Payroll/labor cost tracking (monthly labor burden aggregation)
✅ Profit margin calculation (fixed vs. actual cost models)
✅ Multi-tenant data isolation (Drizzle ORM patterns, tenant enforcement)
✅ Data pipeline architecture (CSV import, real-time queries, caching)

**What B.O.S.S. Does Poorly for Tattoo Shops (Skip):**
❌ Customer segmentation logic (at-risk, referral goldmine, upsell)
❌ "Contact coaching" (B2B sales outreach automation)
❌ Business goal tracking (revenue targets don't translate)
❌ Construction-specific concepts (project phases, milestones, change orders)

**What Fallen Sparrow Needs (Build Custom):**
🔨 Artist performance model (not customer segments)
🔨 Customer continuity/portfolio tracking
🔨 Artist affinity & relationship management
🔨 Natural referral tracking (no incentive manipulation)
🔨 Long-gap friendly nudges (relationship maintenance, not re-engagement)
🔨 Tattoo-specific KPI definitions (margin by service type, artist economics)

---

## PART 1: B.O.S.S. ARCHITECTURE REVIEW

### 1.1 Tech Stack (Reusable)

```
├─ Backend: Express 5 (Node.js)
├─ ORM: Drizzle ORM (PostgreSQL)
├─ Database: PostgreSQL
├─ Frontend: React 18 + Vite
├─ Auth: Passport.js + sessions
├─ API: REST endpoints
└─ Hosting: Railway (deployable)
```

**Verdict:** KEEP. This is solid for Fallen Sparrow too.

---

### 1.2 Data Model (Partial Extract)

#### **KEEP (Extract to Fallen Sparrow):**

```sql
salesEntries
├─ id (PK)
├─ userId (tenant key)
├─ customerId (link to customer)
├─ productName (TEXT — in tattoo context: service type)
├─ revenue (DECIMAL)
├─ cost (DECIMAL — supplies, materials)
├─ quantity (INT — count of items/services)
├─ saleDate (TIMESTAMP)
├─ customerName (TEXT)
├─ salesperson (TEXT) — → ADAPT: rename to "artist"
├─ source (TEXT) — e.g., "booking", "walk-in", "referral"
└─ createdAt, updatedAt

payroll
├─ id (PK)
├─ userId (tenant key)
├─ month (TIMESTAMP — first day of month)
├─ amount (DECIMAL — total labor cost)
└─ createdAt

businessProfiles
├─ id (PK)
├─ userId
├─ businessName
├─ industry
├─ operatingDaysPerWeek
├─ annualClosedDays
└─ ... (contact info, etc.)
```

#### **ADAPT (Modify for Tattoo Context):**

```sql
-- Rename: salesEntries → appointmentPayments
appointmentPayments {
  id
  userId
  appointmentId (FK → appointments table)
  artistId (FK → artists/team table)
  customerId (FK → customers)
  
  serviceType: enum['tattoo', 'piercing', 'laser', 'other']
  depositAmount: DECIMAL
  finalAmount: DECIMAL
  tipAmount: DECIMAL
  totalRevenue: DECIMAL (= deposit + final + tip)
  
  estimatedCost: DECIMAL (supplies for this service)
  actualCost: DECIMAL (nullable, tracked later)
  
  commissionPercentage: DECIMAL (at time of transaction)
  artistPayout: DECIMAL (calculated)
  
  paymentMethod: enum['cash', 'card', 'other']
  paymentDate: TIMESTAMP
  
  createdAt
  updatedAt
}

-- New tables (tattoo-specific):
appointments {
  id
  userId
  customerId
  artistId
  serviceType
  depositCollected: BOOLEAN
  appointmentDate: TIMESTAMP
  completedDate: TIMESTAMP | null
  status: enum['scheduled', 'completed', 'cancelled', 'no_show']
  notes: TEXT
  referralSource: enum['walk_in', 'referral_customer', 'instagram', 'previous']
  referredBy: customerId | null
}

artists {
  id
  userId
  name
  commissionPercentage: DECIMAL
  isActive: BOOLEAN
  portraitUrl: TEXT
  bio: TEXT
  specialties: TEXT[] (tattoo styles)
  createdAt
}

customers {
  id
  userId
  name
  email
  phone
  preferredArtist: artistId | null
  totalSpent: DECIMAL (calculated)
  appointmentCount: INT (calculated)
  lastAppointmentDate: TIMESTAMP | null
  createdAt
}
```

#### **SKIP (Don't port):**

```sql
❌ businessGoals (revenue targets don't apply to tattoo shops)
❌ setupCompletion (onboarding flow is different)
❌ userActivity (login tracking not needed)
❌ monthlyAchievementLimits (fraud prevention for gamification, not needed)
❌ userFingerprints (anti-fraud for B2B context)
❌ globalAchievementLimits (multi-account gaming prevention)
```

---

## PART 2: EXTRACTABLE LOGIC (KPI ENGINE)

### 2.1 Metrics Calculation (EXTRACT AS-IS)

**File:** `server/routes/metrics.ts`

**What it does:**
- Daily revenue summary (by product type)
- Weekly revenue summary (by product type)
- Monthly revenue summary (by product type)

**Adaption for Fallen Sparrow:**

```typescript
// OLD: B.O.S.S. metrics by "product"
// NEW: Fallen Sparrow metrics by artist + service type

async function getDailyMetrics(userId: number, date: string) {
  // Group by: artist + service type
  // Return: revenue, count, avg booking value, tips
  
  return {
    date,
    byArtist: {
      carlos: {
        tattoos: { revenue: 1500, count: 2, avgValue: 750, tips: 200 },
        piercings: { revenue: 400, count: 4, avgValue: 100, tips: 30 },
        total: { revenue: 1900, count: 6 }
      },
      hector: { ... }
    },
    byService: {
      tattoos: { revenue: 2100, count: 5, margin: 0.34 },
      piercings: { revenue: 800, count: 8, margin: 0.28 }
    },
    totalRevenue: 2900,
    flags: [
      { type: 'high_noshow', count: 1 }
    ]
  }
}

async function getMonthlyMetrics(userId: number, year: number, month: number) {
  // Same structure, aggregated over month
  // Add: profit after payroll, margin analysis
  
  return {
    month: '2025-05',
    totalRevenue: 58200,
    totalCosts: { cogs: 8500, payroll: 28000, utilities: 6200, supplies: 1200 },
    netProfit: 14300,
    marginPercent: 0.246,
    
    byArtist: {
      carlos: { revenue: 18000, payout: 9000, margin: 0.50 },
      hector: { revenue: 16500, payout: 8250, margin: 0.50 }
    },
    
    byService: {
      tattoos: { revenue: 36000, cogs: 5400, margin: 0.35, volumePercent: 0.62 },
      piercings: { revenue: 15000, cogs: 1800, margin: 0.28, volumePercent: 0.24 },
      retail: { revenue: 7200, cogs: 1300, margin: 0.45, volumePercent: 0.12 }
    }
  }
}
```

**Implementation Pattern (Copy from B.O.S.S.):**
- Use Drizzle ORM for queries
- Group by artist ID and service type
- Aggregate revenue, count, cost
- Calculate margins: (revenue - cost) / revenue
- Sort by revenue descending
- Round to 2 decimals
- Multi-tenant isolation (userId filter on every query)

---

### 2.2 Payroll/Commission Tracking (EXTRACT + ADAPT)

**File:** `server/routes/payroll.ts`

**What it does:**
- Manual payroll entry (upsert by month)
- CSV bulk upload
- List historical payroll
- Delete entries

**Adaption for Fallen Sparrow:**

```typescript
// B.O.S.S.: Payroll = total monthly labor cost (input by user)
// Fallen Sparrow: Commission = calculated from appointmentPayments

async function calculateArtistCommission(userId: number, artistId: string, month: string) {
  // Sum all appointmentPayments for this artist in this month
  // Apply commission percentage at time of payment
  
  const payments = await db
    .select({
      artistPayout: appointmentPayments.artistPayout
    })
    .from(appointmentPayments)
    .where(and(
      eq(appointmentPayments.userId, userId),
      eq(appointmentPayments.artistId, artistId),
      gte(appointmentPayments.paymentDate, monthStart),
      lte(appointmentPayments.paymentDate, monthEnd)
    ))
  
  return payments.reduce((sum, p) => sum + p.artistPayout, 0)
}

async function calculateStudioCosts(userId: number, month: string) {
  // Payroll is now computed from artist commissions
  // Plus: COGS, rent, utilities, supplies (manually tracked or integrated)
  
  const artistPayouts = await calculateTotalArtistPayouts(userId, month)
  const cogs = await getCOGS(userId, month) // from inventory/purchases
  const fixedCosts = await getFixedCosts(userId, month) // rent, utilities, insurance
  
  return {
    artistPayouts,
    cogs,
    fixedCosts,
    totalCosts: artistPayouts + cogs + fixedCosts
  }
}

// Porter integration: import appointment data daily
async function ingestPorterAppointment(porterAppointment: any) {
  const appointment = await db.insert(appointments).values({
    userId,
    customerId: porterAppointment.clientId,
    artistId: mapArtistName(porterAppointment.artistName),
    serviceType: mapServiceType(porterAppointment.serviceType),
    appointmentDate: porterAppointment.appointmentDate,
    completedDate: porterAppointment.completedDate,
    status: porterAppointment.status
  })
  
  // Then create payment record
  if (porterAppointment.totalRevenue > 0) {
    await db.insert(appointmentPayments).values({
      appointmentId: appointment.id,
      artistId: appointment.artistId,
      serviceType: appointment.serviceType,
      depositAmount: porterAppointment.depositAmount,
      finalAmount: porterAppointment.finalAmount,
      tipAmount: porterAppointment.tipAmount,
      totalRevenue: porterAppointment.totalRevenue,
      commissionPercentage: getCommissionRate(appointment.artistId),
      artistPayout: porterAppointment.totalRevenue * getCommissionRate(appointment.artistId),
      paymentDate: porterAppointment.paymentDate
    })
  }
}
```

**Key Difference:**
- B.O.S.S.: Payroll is **user-entered** (manual data entry)
- Fallen Sparrow: Commission is **auto-calculated** from Porter payment data
- Fall back to manual entry if Porter API is unavailable

---

### 2.3 Profit Margin Calculation (EXTRACT)

**File:** `server/lib/profit.ts`

**What it does:**
```typescript
export type PricePositioning = "budget"|"standard"|"premium";

assumedMargin(position?) → returns margin % (0.25, 0.40, 0.55)
profitForOrder(amount, cost?, position?) → returns profit amount
ltvRevenue(orders) → sums order amounts
ltvProfit(orders, position) → sums profit across orders
```

**Adaption for Fallen Sparrow:**

```typescript
// B.O.S.S.: Assumes margin % if cost not provided
// Fallen Sparrow: Should track actual cost per service

function calculateServiceMargin(
  serviceType: 'tattoo' | 'piercing' | 'laser',
  revenue: number,
  actualCost: number | null
): number {
  // If we have actual cost (e.g., needle, ink, sterilization), use it
  if (typeof actualCost === 'number') {
    return Math.max(0, revenue - actualCost)
  }
  
  // Fallback: assume margin based on service type
  const defaultMargins = {
    tattoo: 0.34,      // Based on Legion's typical rates
    piercing: 0.28,
    laser: 0.30,
    other: 0.30
  }
  
  const margin = defaultMargins[serviceType] || 0.30
  return Math.max(0, revenue * margin)
}

// Artist-specific analysis
function analyzeArtistProfitability(
  artistId: string,
  month: string
): ArtistKPI {
  // Revenue = total appointments value
  // Commission payout = revenue * commission %
  // Margin for shop = revenue - payout
  
  return {
    artistName: 'Carlos',
    totalRevenue: 18000,
    commissionPayout: 9000,
    shopMargin: 9000,
    shopMarginPercent: 0.50,
    appointmentCount: 12,
    avgBookingValue: 1500,
    repeatRate: 0.68,
    efficiency: 'high' // revenue per day or per hour (if we track hours)
  }
}

// Service profitability
function analyzeServiceProfitability(
  serviceType: 'tattoo' | 'piercing' | 'laser',
  month: string
): ServiceKPI {
  return {
    serviceType,
    totalRevenue: 36000,
    cogs: 5400,
    commissionPayouts: 18000,
    shopMargin: 12600,
    shopMarginPercent: 0.35,
    volumePercent: 0.62,
    recommendation: 'Tattoos are driving profit. Consider premium pricing.'
  }
}
```

**Extract Pattern:**
- Copy profit calculation logic
- Adapt default margins to tattoo service types
- Add artist profitability analysis
- Add service profitability analysis

---

## PART 3: CUSTOM BUILD (TATTOO-SPECIFIC)

### 3.1 Artist Performance Model

**NOT in B.O.S.S. (Build for Fallen Sparrow):**

```typescript
// server/services/artistAnalytics.ts

interface ArtistMetrics {
  artistId: string
  artistName: string
  month: string
  
  // Financial
  totalRevenue: number
  commissionEarned: number
  payout: number
  marginalProfit: number // what shop keeps
  
  // Volume & Efficiency
  appointmentCount: number
  completedCount: number
  cancelledCount: number
  noShowCount: number
  avgBookingValue: number
  revenuePerDay: number
  
  // Quality & Retention
  repeatCustomerRate: number // % of customers who came back
  averageReview: number // if ratings exist
  customersServed: number
  
  // Booking Health
  appointmentUtilization: number // % of available slots booked
  averageLeadTime: number // days between booking and appointment
  
  // Portfolio
  lastPortfolioUpdate: Date
  portfolioSize: number // photos on Instagram
  specialties: string[] // 'blackwork', 'color', 'fine line', etc.
}

async function getArtistPerformance(userId: number, artistId: string, month: string): Promise<ArtistMetrics> {
  // Query appointments + payments for this artist in month
  // Calculate all metrics above
  // Compare to shop average (is this artist above/below average?)
  
  const appointments = await db.select().from(appointments)
    .where(and(
      eq(appointments.userId, userId),
      eq(appointments.artistId, artistId),
      isBetweenMonth(appointments.completedDate, month)
    ))
  
  const payments = await db.select().from(appointmentPayments)
    .where(and(
      eq(appointmentPayments.userId, userId),
      eq(appointmentPayments.artistId, artistId),
      isBetweenMonth(appointmentPayments.paymentDate, month)
    ))
  
  return {
    artistId,
    artistName: 'Carlos',
    month,
    
    totalRevenue: sum(payments.totalRevenue),
    commissionEarned: sum(payments.artistPayout),
    payout: sum(payments.artistPayout),
    marginalProfit: sum(payments.totalRevenue) - sum(payments.artistPayout),
    
    appointmentCount: appointments.length,
    completedCount: appointments.filter(a => a.status === 'completed').length,
    cancelledCount: appointments.filter(a => a.status === 'cancelled').length,
    noShowCount: appointments.filter(a => a.status === 'no_show').length,
    avgBookingValue: sum(payments.totalRevenue) / appointments.length,
    revenuePerDay: sum(payments.totalRevenue) / daysWorked,
    
    repeatCustomerRate: calculateRepeatRate(appointments),
    customersServed: countUniqueCustomers(appointments),
    appointmentUtilization: calculateUtilization(appointments),
    
    lastPortfolioUpdate: null, // track in artists table
    portfolioSize: 0,
    specialties: ['color realism', 'neo-traditional']
  }
}
```

### 3.2 Customer Continuity Model

**NOT in B.O.S.S. (Build for Fallen Sparrow):**

```typescript
// server/services/customerContinuity.ts

interface CustomerProfile {
  customerId: string
  name: string
  totalSpent: number
  appointmentCount: number
  
  // Tattoo History (Portfolio Continuity)
  tattoos: {
    date: Date
    artist: string
    bodyPart: string
    style: string
    size: string
    notes: string
    photoUrl?: string
  }[]
  
  // Relationship
  preferredArtist: string | null
  hasBookedWith: string[] // list of artists they've used
  
  // Timeline
  firstAppointment: Date
  lastAppointment: Date
  daysSinceLastAppointment: number
  
  // Pattern Recognition
  typicalBookingGap: number // days between appointments
  isOverdue: boolean // if daysSince > typical gap + buffer
  bookingFrequency: 'frequent' (< 3 months) | 'regular' (3-6) | 'occasional' (6-12) | 'rare' (12+)
  
  // Next Nudge Strategy
  shouldNudge: boolean
  nudgeMessage: string
  relevantArtist: string // which artist to suggest
}

async function getCustomerProfile(userId: number, customerId: string): Promise<CustomerProfile> {
  const customer = await db.select().from(customers).where(eq(customers.id, customerId))
  const appointments = await db.select().from(appointments)
    .where(and(eq(appointments.customerId, customerId)))
    .orderBy(appointments.appointmentDate)
  
  const gaps = calculateGapsBetweenAppointments(appointments)
  const typicalGap = median(gaps)
  const daysSinceLast = daysBetween(now(), last(appointments).completedDate)
  
  return {
    customerId,
    name: customer.name,
    totalSpent: sum(payments.totalRevenue),
    appointmentCount: appointments.length,
    
    tattoos: appointments.map(a => ({
      date: a.appointmentDate,
      artist: a.artistId,
      bodyPart: a.notes?.includes('arm') ? 'arm' : 'unknown', // extract from notes
      style: extractStyle(a.notes),
      notes: a.notes
    })),
    
    preferredArtist: customer.preferredArtist,
    hasBookedWith: unique(appointments.map(a => a.artistId)),
    
    firstAppointment: first(appointments).appointmentDate,
    lastAppointment: last(appointments).appointmentDate,
    daysSinceLastAppointment: daysSinceLast,
    
    typicalBookingGap: typicalGap,
    isOverdue: daysSinceLast > (typicalGap * 1.3), // 30% buffer
    bookingFrequency: classifyFrequency(typicalGap),
    
    shouldNudge: daysSinceLast > (typicalGap * 1.3),
    nudgeMessage: `"Hi ${name}, we'd love to see you for your next piece!"`,
    relevantArtist: customer.preferredArtist || getMostFrequentArtist(appointments)
  }
}

async function getNudgeCandidates(userId: number): Promise<CustomerProfile[]> {
  // Return customers who are overdue but not long-gone
  // daysSince > typicalGap (they're due for their next appointment)
  // daysSince < typicalGap * 3 (but not so long ago they've forgotten us)
  
  const allCustomers = await db.select().from(customers).where(eq(customers.userId, userId))
  
  const candidates = allCustomers
    .map(c => getCustomerProfile(userId, c.id))
    .filter(profile => profile.shouldNudge && profile.daysSinceLastAppointment < profile.typicalBookingGap * 3)
    .sort((a, b) => a.daysSinceLastAppointment - b.daysSinceLastAppointment) // most overdue first
  
  return candidates
}
```

### 3.3 Natural Referral Tracking

**NOT in B.O.S.S. (Build for Fallen Sparrow):**

```typescript
// server/services/referralTracking.ts

interface ReferralAnalysis {
  customerId: string
  name: string
  referralCount: number
  referredCustomers: { name: string; spentTotal: number; status: 'active' | 'inactive' }[]
  totalReferredRevenue: number
  
  // Should we thank them?
  isTopReferrer: boolean // top 10% of referrers
  lastReferralDate: Date
  
  // No incentives (Legion said so)
  // But we could offer: priority booking, free touch-ups, featured portfolio spot
}

async function getReferralNetwork(userId: number): Promise<ReferralAnalysis[]> {
  // For each customer, find who they referred
  // Sum revenue from referred customers
  // Identify top referrers
  
  const allAppointments = await db.select().from(appointments)
    .where(eq(appointments.userId, userId))
  
  // Build referral graph: who referred whom
  const referrals = new Map<string, string[]>() // customerId → [referred IDs]
  
  for (const appt of allAppointments) {
    if (appt.referredBy) {
      const existing = referrals.get(appt.referredBy) || []
      referrals.set(appt.referredBy, [...existing, appt.customerId])
    }
  }
  
  return Array.from(referrals.entries()).map(([referrerId, referredIds]) => {
    const referrer = customers.find(c => c.id === referrerId)
    const referred = referredIds.map(id => customers.find(c => c.id === id))
    
    return {
      customerId: referrerId,
      name: referrer.name,
      referralCount: referredIds.length,
      referredCustomers: referred.map(c => ({
        name: c.name,
        spentTotal: sumRevenueForCustomer(c.id),
        status: isActive(c) ? 'active' : 'inactive'
      })),
      totalReferredRevenue: sum(referred.map(c => sumRevenueForCustomer(c.id))),
      isTopReferrer: false, // calculated later
      lastReferralDate: null
    }
  })
}
```

### 3.4 Long-Gap Friendly Nudges

**NOT in B.O.S.S. (Build for Fallen Sparrow):**

```typescript
// server/services/communityNudges.ts

interface NudgeCandidate {
  customerId: string
  name: string
  lastAppointment: Date
  typicalGap: number
  daysSince: number
  preferredArtist: string
  nextNudgeDate: Date
  nudgeHistory: { sentDate: Date; resonated: boolean }[]
}

async function generateDailyNudges(userId: number): Promise<NudgeCandidate[]> {
  // Find customers overdue for their next appointment
  // But not annoying: only if 30+ days past typical gap
  // And space out nudges: don't send more than 1x per month
  
  const candidates = await getNudgeCandidates(userId)
  
  // Filter: only send if > 30 days overdue
  const toNudge = candidates.filter(c => c.daysSinceLastAppointment > c.typicalBookingGap + 30)
  
  // Filter: not nudged recently
  const notTooRecent = toNudge.filter(c => {
    const lastNudge = last(c.nudgeHistory)
    return !lastNudge || daysSince(lastNudge.sentDate) > 30
  })
  
  return notTooRecent
}

async function sendNudges(userId: number, nudges: NudgeCandidate[]): Promise<void> {
  for (const nudge of nudges) {
    const artist = nudge.preferredArtist
    
    // Friendly, personalized message (NO DISCOUNTS)
    const message = `
Hi ${nudge.name}!

It's been ${Math.round(nudge.daysSince / 30)} months since we saw you, and ${artist} misses doing your work.

When you're ready for your next piece (or touch-up), we'd love to get you on the books.

Book here: [link]
    `
    
    // Send via email or SMS
    await sendMessage(nudge.customerId, message)
    
    // Track that we sent it
    await recordNudgeSent(nudge.customerId, 'friendly_reconnect')
  }
}
```

---

## PART 4: BRIEFING INTEGRATION

### 4.1 Data Flow: B.O.S.S. → Briefing

```
Daily at 6am:
├─ Porter CSV import (via Zapier)
│  └─ Store appointments & payments
│
├─ Trigger metrics calculations
│  ├─ DailyMetrics (by artist + service)
│  ├─ ArtistPerformance
│  └─ ServiceProfitability
│
├─ Calculate commission payouts
│  └─ Update artist balances
│
├─ Run anomaly detection
│  ├─ High no-show rate?
│  ├─ Revenue below trend?
│  └─ Inventory low?
│
├─ Query B.O.S.S. data (customer continuity)
│  ├─ getNudgeCandidates()
│  └─ getReferralNetwork()
│
└─ Synthesize briefing
   ├─ Email to Legion @ 6am
   └─ Dashboard cache for on-demand pull
```

### 4.2 Briefing Structure (Daily)

```json
{
  "date": "2025-05-28",
  "financialSnapshot": {
    "revenue": "$2,100",
    "margin": "34%",
    "commissionsOwed": "$1,050",
    "trend": "↑ 12% vs yesterday"
  },
  "byArtist": {
    "carlos": {
      "revenue": "$1,500",
      "appointments": 2,
      "repeatRate": "68%",
      "status": "strong"
    },
    "hector": {
      "revenue": "$600",
      "appointments": 1,
      "repeatRate": "52%",
      "status": "slow"
    }
  },
  "byService": {
    "tattoos": { "revenue": "$1,800", "margin": "36%" },
    "piercings": { "revenue": "$300", "margin": "25%" }
  },
  "alerts": [
    { "severity": "medium", "message": "Hector has only 1 appointment today. Consider reaching out to nudge customers." }
  ],
  "operationalFlags": {
    "noShowCount": 0,
    "cancelledCount": 1,
    "inventoryLow": false
  },
  "customerIntelligence": {
    "nudgeCandidates": 3,
    "topReferrers": 2,
    "atRiskCustomers": 0
  }
}
```

---

## PART 5: IMPLEMENTATION ROADMAP

### Phase 0 (Current)
- ✅ Review B.O.S.S. architecture
- ✅ Decide what to extract vs. skip
- ⏳ Finalize Porter data format (Q1d answer)

### Phase 1 (Week 1-2)
- Set up Fallen Sparrow DB schema (adapted from B.O.S.S.)
- Create appointments, appointmentPayments, artists, customers tables
- Migrate payroll → commission calculation

### Phase 2 (Week 3-4)
- Port metrics calculation (`server/routes/metrics.ts`)
- Adapt for: artist, service type, margin analysis
- Build daily/weekly/monthly endpoints

### Phase 3 (Week 5-6)
- Build artist performance model (new)
- Build customer continuity model (new)
- Build natural referral tracking (new)

### Phase 4 (Week 7-8)
- Integrate with Porter CSV importer
- Build briefing synthesis engine
- Email delivery (Resend)

### Phase 5 (Week 9-10)
- Mobile views (on-demand briefing)
- Dashboard views
- Testing & refinement

---

## PART 6: FILE-BY-FILE EXTRACTION GUIDE

### EXTRACT (Copy to Fallen Sparrow)

| File | Purpose | Status |
|------|---------|--------|
| `shared/schema.ts` | Data model | Extract + adapt |
| `server/repos/revenueRepo.ts` | Financial queries | Extract + adapt |
| `server/routes/metrics.ts` | KPI calculations | Extract + adapt |
| `server/routes/payroll.ts` | Labor tracking | Extract + adapt |
| `server/lib/profit.ts` | Margin calculation | Extract + adapt |
| `server/middleware/tenantEnforcement.ts` | Multi-tenant | Extract as-is |
| `server/db.ts` | Drizzle setup | Extract as-is |
| `server/auth.ts` | Auth | Extract as-is |

### SKIP (Don't port)

| File | Reason |
|------|--------|
| `server/routes/outreach.ts` | Customer segmentation (at-risk, goldmine) |
| `server/routes/coaching.ts` | B2B sales coaching |
| `server/services/mission.ts` | Business goal tracking |
| `server/services/smartMixV2.ts` | Revenue optimization (for sales, not tattoos) |
| `server/lib/hormozi.ts` | Business coaching logic |
| `server/lib/cycles.ts` | Sales cycle tracking |
| All achievement/gamification tables | Fraud prevention for B2B context |

### BUILD NEW (Custom for Fallen Sparrow)

| Module | Purpose |
|--------|---------|
| `server/services/artistAnalytics.ts` | Artist performance KPIs |
| `server/services/customerContinuity.ts` | Portfolio & relationship tracking |
| `server/services/communityNudges.ts` | Friendly re-engagement (no discounts) |
| `server/services/referralTracking.ts` | Natural referral network |
| `server/services/briefingSynthesis.ts` | Daily briefing generation |
| `server/integrations/porterIngestion.ts` | CSV import + normalization |

---

## CONCLUSION

**Extract B.O.S.S.'s KPI & Financial Engine. Skip the Customer Segmentation. Build Tattoo-Native Models.**

B.O.S.S. is excellent at calculating metrics, tracking payroll, and managing multi-tenant data. Fallen Sparrow will use all of that.

B.O.S.S. assumes you need to "segment and re-engage customers." Legion's shop doesn't need that — customers come back because they trust the artists and the vibe. Fallen Sparrow will build models around artist relationships and portfolio continuity instead.

**Estimated effort:**
- Extract + adapt existing: 40 hours
- Build new modules: 60 hours
- Integration + testing: 40 hours
- **Total: ~140 hours (3-4 weeks)**

Ready to build the updated master spec with this architecture locked in?

