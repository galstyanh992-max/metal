# Worklog — Metal Blinds ERP/CRM Armenia

## Project status

**Phase:** P5 — Database + Auth + RBAC + UI foundation COMPLETE
**Overall:** Foundation ready, role-based workspaces functional
**Build:** PASS (lint clean, dev server compiles, browser QA passed)

## Completed

### Phase 1 — Capability Discovery + Requirements Lock
- `docs/00_capability_map.md` — full environment inventory
- `docs/01_requirements_lock.md` — locked product requirements

### Phase 2 — Analog Research + Product Blueprint
- `docs/02_analog_research.md` — analog study + 3 design directions
- Direction selected: **Industrial Precision** (steel + copper accent)

### Phase 3 — Technical Architecture + Data Model + Permission Matrix
- `docs/03_architecture.md` — stack, folder structure, AI layer
- `docs/03_permission_matrix.md` — full RBAC for ADMIN/OPERATOR/WAREHOUSE

### Phase 4-5 — Repository Foundation + Database + Auth + RBAC
- Prisma schema: 30+ models (User, Client, Order, Product, InventoryMovement, BomRule, TaxRule, LoyaltyTier, AiProposal, AuditLog, etc.)
- SQLite database initialized via `bun run db:push`
- Seed script (`scripts/seed.ts`): 4 users (2 admins min), 6 units, 4 categories, 4 loyalty tiers, 12 products, inventory movements, form templates, document templates
- NextAuth v4 (Credentials + JWT) — `src/lib/auth.ts`
- RBAC enforcement — `src/lib/rbac.ts` (matrix + `requireAction`/`requireRole` + warehouse field stripping)
- Inventory ledger with invariants — `src/lib/inventory/ledger.ts` (ON_HAND/RESERVED/AVAILABLE, transactional, immutable movements)
- Safe BOM DSL — `src/lib/bom/dsl.ts` (no JS eval, custom parser, condition evaluator)
- Money helpers — `src/lib/finance/money.ts` (decimal.js, AMD integer, tabular numerals)
- AI provider — `src/lib/ai/provider.ts` (OllamaCloud + DeepSeek v4 flash/pro + z-ai-web-dev-sdk fallback + guardrails)

### Phase 14 (early slice) — Premium Armenian Industrial Design System
- `globals.css` rewritten with industrial precision tokens (graphite neutrals, steel primary, copper accent for critical CTAs only, status colors)
- Noto Sans Armenian font loaded
- Tabular figures enforced for AMD numbers
- Reduced-motion support

### Phase 15-17 (early slice) — Workspaces
- Auth screen with brand panel + demo account buttons
- Workspace shell: sidebar + topbar + command palette (Cmd+K)
- Admin dashboard: 8 KPI cards + low stock table
- Operator dashboard: active orders + debt clients
- Warehouse dashboard: pending picks + inventory (no financial data)
- Warehouse picks module: scan interface
- Clients module: table with status pills, financial profile
- Orders module: table + create order dialog (multi-item, dynamic parameters)
- Products module: catalog with role-based price visibility
- Inventory module: on-hand/reserved/available with low-stock badges
- AI Assistant: 9 modules, PROPOSAL mode, guardrail visualization

### Browser QA — PASSED
- agent-browser verified:
  - Auth screen renders with Armenian text + copper accent
  - Admin login → workspace shell loads
  - Sidebar with 13 nav items
  - Dashboard shows 8 KPI cards with AMD formatting
  - Clients module shows empty state + role-aware table columns
  - All text in Armenian, status pills working

## Current goals / verification

**Verified:**
- Lint PASS (0 errors)
- Dev server compiles
- Browser QA: auth → admin workspace → clients module
- Role-based UI differentiation (WAREHOUSE sees no prices, OPERATOR sees no cost/profit)

**Pending (for next cron rounds):**
- Phase 6: Dynamic Form Builder UI (admin meta-system)
- Phase 7: Procurement module (PO flow)
- Phase 8: BOM engine integration with order flow + reservation
- Phase 9: Payments + debt ledger detail
- Phase 10: Tax engine UI
- Phase 11: PDF + barcode + QR generation
- Phase 13: Email + WhatsApp adapters
- Phase 18: i18n polish + mobile deep audit
- Phase 19: Security tests (RBAC field-level enforcement verification)
- Phase 20: Release gate

## Unresolved issues / risks

1. **OllamaCloud API key** — NOT provided. AI falls back to z-ai-web-dev-sdk. Adapter ready to switch.
2. **Email / WhatsApp credentials** — NOT provided. Adapters will be stubbed.
3. **Armenian STT** — NOT provided. Voice order module will use AI text input as fallback.
4. **Tax profile** — UNKNOWN (legal form, VAT status, turnover). Tax engine has versioned schema but no ACTIVE rules until profile confirmed.
5. **Production deployment target** — NOT specified. Preview via dev server only.

## Architecture invariants enforced

- Money: AMD integer, decimal.js for math, never binary float
- Inventory: immutable movements, AVAILABLE = ON_HAND − RESERVED, transactional
- AI: PROPOSAL only, guardrails reject forbidden mutation types
- RBAC: enforced at API + Prisma select layer (warehouse never sees price fields)
- Forms: versioned, old orders use snapshot
- Delete: hard delete only for never-used objects; everything else archive/soft-delete

## Priority recommendations for next phase

1. Implement Dynamic Form Builder UI (Phase 6) — admin creates custom fields visually
2. Wire BOM calculation into order creation (Phase 8) — auto-reserve components
3. Add payments recording UI + debt ledger detail (Phase 9)
4. Add procurement PO flow (Phase 7)
5. PDF generation for documents (Phase 11)
