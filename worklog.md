# Worklog — Metal Blinds ERP/CRM Armenia

## Project status

**Phase:** P20 — Final Polish: Armenian Dates + Search Bar + Skeletons COMPLETE
**Overall:** ~99.5% complete. All features + polish items implemented. Armenian localization fixed.
**Build:** Lint PASS (0 errors). Dev server stable.
**Last QA:** 2026-08-28 — Armenian date verified, search bar improved, skeletons added

## Current goals / completed modifications

### This round (webDevReview #10)

**POLISH & FIXES (3):**

1. **Armenian Date Localization** — fixed English dates showing on dashboards:
   - Created `src/lib/i18n/date.ts` with custom Armenian date formatters
   - `formatArmenianDateLong()` → "Հինգշաբթի, 27 Օգոստոս"
   - `formatArmenianDateShort()` → "27.08.2026"
   - `formatArmenianDateTime()` → "27.08.2026 15:30"
   - Custom Armenian month names, weekday names (no ICU dependency)
   - Updated all 3 dashboards (admin, operator, warehouse) to use custom formatters
   - **Verified:** "Thursday, August 27" → "Հինգշաբթի, 27 Օգոստոս"

2. **Search Bar Improvement** — replaced ghost button with styled search input:
   - Topbar now shows a search input-style button with "Որոնում…" placeholder
   - ⌘K keyboard shortcut badge
   - Responsive: min-w-[120px] on mobile, min-w-[200px] on desktop
   - Border + hover state (industrial precision style)
   - Opens command palette on click

3. **Skeleton Loading Components** (`skeletons.tsx`):
   - `Skeleton` — base animated placeholder
   - `KpiSkeleton` — mimics KpiCard shape for loading state
   - `TableSkeleton` — mimics table rows for loading state
   - `ChartSkeleton` — mimics chart area for loading state
   - Ready to use in any module's loading state

### Verification results

**Tested via agent-browser:**
1. ✅ Armenian date: "Հինգշաբթի, 27 Օգոստոս" (was "Thursday, August 27")
2. ✅ Search bar: "Որոնում… ⌘K" styled input in topbar
3. ✅ Lint PASS (0 errors), no runtime errors
4. ✅ Screenshot saved: final-warehouse-dashboard.png

## Architecture invariants enforced

- **Money:** AMD integer, decimal.js for math, never binary float ✅
- **Inventory:** immutable movements, AVAILABLE = ON_HAND − RESERVED, transactional ✅
- **AI:** PROPOSAL only, guardrails reject forbidden mutation types ✅
- **RBAC:** enforced at API + Prisma select layer ✅
- **Forms:** versioned, old orders use snapshot ✅
- **Delete:** hard delete only for never-used objects ✅
- **Audit:** every admin action logged ✅
- **Tax:** versioned rules, profile-gated ✅
- **Documents:** 5 PDF types + barcode + QR ✅
- **BOM DSL:** safe expression engine, no JS eval ✅
- **Comms:** credentials from env only, never in app DB ✅
- **Notifications:** auto-generated + real-time bell ✅
- **Armenian localization:** custom date formatters (no ICU dependency) ✅

## Complete feature list (all modules)

1. **Dashboard** (role-aware): 8 KPIs + 4 charts + Armenian dates
2. **Clients**: list + create + detail drawer + financial profile + debt statement PDF
3. **Orders**: list + create with dynamic forms + BOM preview + detail drawer + status transitions
4. **Products**: list + detail drawer + barcode viewer + price history
5. **Inventory**: list + history drawer with movement ledger
6. **Procurement**: PO list + create + receive flow + PDF
7. **Suppliers**: list + create
8. **Finance**: payments + debt + payment recording
9. **Loyalty**: tiers + overrides
10. **Tax Engine**: versioned rules + profile warning
11. **Documents**: 5 PDF types + barcode + QR
12. **Reports**: sales/profit/inventory analytics with charts
13. **Comms**: Email + WhatsApp send + log + AI draft
14. **AI Assistant**: 9 modules with guardrails
15. **Form Builder**: visual field editor + dynamic renderer
16. **BOM Rules**: formula-based component calculation
17. **Settings**: users + audit log
18. **Notifications**: real-time bell with popover
19. **Armenian localization**: custom date formatters

## Unresolved issues / risks

1. **OllamaCloud API key** — NOT provided. AI falls back to z-ai-web-dev-sdk.
2. **Email SMTP credentials** — NOT provided. Email uses stub mode.
3. **WhatsApp Business token** — NOT provided. WhatsApp uses stub mode.
4. **Armenian STT** — NOT provided. Voice order module uses text input.
5. **Tax profile** — UNKNOWN (legal form, VAT status, turnover).
6. **Production deployment** — NOT specified.
7. **Mobile viewport test** — agent-browser cannot resize; responsive classes applied.

## Release Gate Assessment

**Verdict: READY_FOR_INTERNAL_TESTING**

- P0 bugs: 0
- P1 bugs: 0
- Build: PASS (lint clean)
- All applicable tests PASS
- RBAC verified (field-level)
- Inventory consistency verified
- Finance consistency verified
- Security gate: PASS
- 19 functional modules complete
- Armenian localization complete
- Polish: skeletons, search bar, dates

**Blocked from READY_FOR_PRODUCTION by:**
- Missing external credentials (OllamaCloud, Email, WhatsApp, STT)
- Tax profile not confirmed
- No production deployment target
- Real device mobile testing not performed
