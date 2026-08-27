# Worklog — Metal Blinds ERP/CRM Armenia

## Project status

**Phase:** P9 — Finance + Procurement + Tax + Loyalty + Settings + Documents + Comms modules COMPLETE
**Overall:** 11 of 13 nav modules now functional (was 5). Full order→payment→audit flow verified end-to-end.
**Build:** PASS (lint clean, dev server compiles, browser QA passed)
**Last QA:** 2026-08-27 — full cycle verified via agent-browser

## Current goals / completed modifications

### This round (webDevReview #1)

**BUG FIXES:**
- **BUG-1 (P1) FIXED:** "New Client" button was not wired — now opens full create dialog
- **BUG-2 (P2) FIXED:** No client creation dialog existed — built `ClientCreateDialog` with individual/company toggle, all fields (name, tax ID, phone, email, address, credit limit, preferred channel)
- **BUG-3 (P2) FIXED:** Order create dialog client dropdown was empty — now populated after client creation
- **BUG-4 (P2) FIXED:** Payment recording didn't refresh UI — added TanStack Query invalidation for payments/orders/dashboard queries

**NEW MODULES (6 added):**
1. **Finance module** (`finance-module.tsx`) — payments list + unpaid orders + payment recording dialog (amount, method: bank/card/contract, note). KPIs: total payments, total collected, unpaid count, unpaid amount. Updates order outstanding/paid/status in transaction.
2. **Procurement module** (`procurement-module.tsx`) — PO list with status badges (DRAFT→ORDERED→IN_TRANSIT→RECEIVED→CLOSED), create PO dialog with multi-line items, supplier selection, total calculation.
3. **Tax engine module** (`tax-module.tsx`) — versioned tax rules, profile warning banner (UNKNOWN status prominent), create rule dialog (type: VAT/TURNOVER/PROFIT/etc., rate, regime). All new rules start as DRAFT.
4. **Loyalty module** (`loyalty-module.tsx`) — 4 tiers (Bronze/Silver/Gold/Platinum) with copper crown icons, threshold/discount/client count, overrides table.
5. **Settings module** (`settings-module.tsx`) — Users tab (4 users, 2 admins with "minimum 2 satisfied" indicator, role badges) + Audit log tab (all actions traced: client.create, order.create, payment.create with actor, entity, timestamp).
6. **Documents module** (`documents-module.tsx`) — 4 seeded templates (Customer Order, Warehouse Order, Invoice, Payment Receipt), version tracking, active status.
7. **Comms module** (`comms-module.tsx`) — Email + WhatsApp tabs with setup placeholders.

**NEW API ROUTES (7 added):**
- `/api/payments` (GET list, POST record payment with transaction)
- `/api/procurement` (GET POs, POST create PO)
- `/api/tax` (GET rules+profile, POST create rule with version snapshot)
- `/api/loyalty` (GET tiers+overrides)
- `/api/users` (GET users, admin-only)
- `/api/audit` (GET audit logs, admin-only)
- `/api/search` (GET global search across clients/orders/products)
- `/api/documents` (GET templates+generated)

**NEW FEATURES:**
- **Global search** in command palette (Cmd+K) — searches clients by name/phone/email/taxId, orders by number, products by name/SKU/barcode. Returns typed results with navigation.
- **Cmd+K keyboard shortcut** — opens/closes command palette globally
- **Client search bar** in clients module — filters by name/phone/email
- **Client avatars** — initial letter badges in table rows
- **Status pills** refined with semantic colors (green/yellow/orange/red/critical)
- **Role-aware columns** — warehouse sees no financial columns, operator sees no cost/profit

### Verification results (agent-browser)

**Full cycle tested and PASSED:**
1. ✅ Login as admin1@blinds.am
2. ✅ Navigate to Clients → click "Նոր հաճախորդ" → dialog opens with individual/company toggle
3. ✅ Fill form (Արամ Պողոսյան, +374 99 123456) → submit → client created, KPI updates to "1 հաճախորդ", appears in table with GREEN status
4. ✅ Navigate to Orders → click "Նոր պատվեր" → dialog opens, client dropdown now populated
5. ✅ Select client + product (Ալյումինե ջալուզի 50մմ սև) → submit → order ORD-2026-0001 created (19,500 դր, profit 6,500 դր)
6. ✅ Navigate to Finance → shows unpaid order with "Վճարել" button
7. ✅ Click "Վճարել" → payment dialog → enter 10,000 → submit → UI refreshes: 1 payment, 10,000 collected, outstanding drops to 9,500
8. ✅ Navigate to Tax → shows profile warning (UNKNOWN), empty rules, create dialog works
9. ✅ Navigate to Loyalty → shows 4 tiers with copper crowns
10. ✅ Navigate to Settings → Users tab shows 4 users, 2 admins; Audit tab shows 3 entries (client.create, order.create, payment.create) with full traceability
11. ✅ Navigate to Documents → shows 4 seeded templates
12. ✅ Cmd+K → type "Արամ" → returns client + order results with type labels
13. ✅ Lint PASS (0 errors)

## Architecture invariants enforced

- **Money:** AMD integer, decimal.js for math, never binary float ✅
- **Inventory:** immutable movements, AVAILABLE = ON_HAND − RESERVED, transactional ✅
- **AI:** PROPOSAL only, guardrails reject forbidden mutation types ✅
- **RBAC:** enforced at API + Prisma select layer (warehouse never sees price fields) ✅
- **Forms:** versioned, old orders use snapshot ✅
- **Delete:** hard delete only for never-used objects; everything else archive/soft-delete ✅
- **Audit:** every financial/admin action logged with actor, entity, before/after ✅
- **Tax:** versioned rules, profile-gated, DRAFT status until verified ✅

## Unresolved issues / risks

1. **OllamaCloud API key** — NOT provided. AI falls back to z-ai-web-dev-sdk. Adapter ready to switch.
2. **Email / WhatsApp credentials** — NOT provided. Comms module has placeholders.
3. **Armenian STT** — NOT provided. Voice order module uses text input.
4. **Tax profile** — UNKNOWN (legal form, VAT status, turnover). Tax engine shows prominent warning.
5. **Production deployment** — NOT specified. Preview via dev server only.
6. **Mobile viewport test** — agent-browser cannot resize viewport; responsive design relies on Tailwind classes (lg:/md:/sm:) which are applied throughout. Needs real device test.
7. **Procurement receive flow** — PO creation works, but receiving (which should create INVENTORY RECEIVE movement) not yet wired in UI.

## Priority recommendations for next phase

1. **Phase 6: Dynamic Form Builder UI** — admin creates custom fields visually (drag-drop, field types, validation, conditional logic). Schema is ready (FormTemplate, FieldGroup, Field models).
2. **Phase 8: BOM engine integration** — wire BOM calculation into order creation flow (auto-calculate component quantities, auto-reserve stock). DSL is ready (`src/lib/bom/dsl.ts`).
3. **Phase 7: Procurement receive flow** — add "Receive" button on POs that creates INVENTORY RECEIVE movement via `recordMovement()`.
4. **Phase 11: PDF generation** — implement actual PDF generation from document templates (pdfkit installed, templates seeded).
5. **Phase 11: Barcode/QR generation** — generate barcode/QR for products and warehouse pick lists (bwip-js + qrcode installed).
6. **Phase 18: Mobile deep audit** — test on real mobile devices at 320/360/375/390/414px widths.
7. **Phase 19: Security tests** — verify RBAC field-level enforcement (warehouse cannot access price via API, operator cannot override discount).
8. **Order detail view** — currently orders are listed but no detail drawer for viewing/editing individual orders.
9. **Client detail view** — same, no detail drawer for client financial profile breakdown.
10. **Inventory movement history** — show movement ledger per product (RECEIVE/RESERVE/ISSUE/RETURN/WRITE_OFF/ADJUSTMENT).

## Phase progress

| Phase | Status | Notes |
|---|---|---|
| 1. Capability Discovery + Requirements | ✅ PASS | docs/00, 01 |
| 2. Analog Research + Blueprint | ✅ PASS | docs/02 |
| 3. Architecture + Data Model + Permissions | ✅ PASS | docs/03 |
| 4. Repository Foundation | ✅ PASS | Next.js 16 + TS + Tailwind 4 |
| 5. Database + Auth + RBAC | ✅ PASS | 30+ Prisma models, NextAuth, RBAC matrix |
| 6. Dynamic Admin Meta-System | ⏳ PENDING | Schema ready, UI not built |
| 7. Products + Suppliers + Procurement | ✅ PARTIAL | Products/Suppliers done, Procurement list+create done, receive flow pending |
| 8. Orders + BOM + Inventory | ✅ PARTIAL | Orders done, Inventory ledger done, BOM integration pending |
| 9. Finance + Debt + Loyalty + Profit | ✅ PASS | Payments, debt, loyalty, profit all functional |
| 10. Armenia Tax Engine | ✅ PARTIAL | Versioned schema + UI done, no ACTIVE rules (profile UNKNOWN) |
| 11. Documents + PDF + Barcode + QR | ⏳ PENDING | Templates seeded, PDF/QR generation not implemented |
| 12. AI Layer | ✅ PARTIAL | Provider + guardrails done, 9 modules in UI |
| 13. Email + WhatsApp | ⏳ PENDING | Adapters stubbed, no credentials |
| 14. Premium Design System | ✅ PASS | Armenian Industrial Precision tokens applied |
| 15. Operator Workspace | ✅ PASS | Dashboard + clients + orders + comms + AI |
| 16. Warehouse Workspace | ✅ PASS | Dashboard + picks (no financial data) |
| 17. Admin Dashboard + Reporting | ✅ PASS | 8 KPIs + low stock + all modules |
| 18. Armenian Localization + Mobile + A11y | ⏳ PENDING | Armenian done, mobile/a11y audit pending |
| 19. Security + Preview + Browser Audit | ✅ PARTIAL | Browser QA passed, security tests pending |
| 20. Final Release Gate | ⏳ PENDING | Awaiting remaining phases |

**Overall: ~70% complete. Core ERP flows (clients→orders→payments→audit) fully functional and verified.**
