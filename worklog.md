# Worklog — Metal Blinds ERP/CRM Armenia

## Project status

**Phase:** P8 — BOM Engine Integration COMPLETE
**Overall:** ~92% complete. BOM calculation engine fully integrated into order creation flow with dynamic form renderer.
**Build:** Lint PASS (0 errors). Dev server stable.
**Last QA:** 2026-08-28 — BOM calculation + dynamic forms verified via agent-browser

## Current goals / completed modifications

### This round (webDevReview #5)

**NEW FEATURE: BOM Engine Integration (Phase 8)** — the core manufacturing calculation engine is now live:

1. **BOM Rules Seed** — 6 BOM rules seeded for "cat-blinds" category:
   - Լադդեր պարան (PRF-LAD-50): `(width / 1000) * height / 1000 * qty * 2` with 5% waste
   - Գլխավոր պրոֆիլ (PRF-HEAD-50): `(width / 1000) * qty` with 3% waste
   - Ներքևի պրոֆիլ (PRF-BOT-50): `(width / 1000) * qty` with 3% waste
   - Կլիպս (ACC-CLIP-50): `(height / 300) * qty` with minimum 2
   - Կառավարման պարան (ACC-CORD): `(height / 1000) * qty * 2` with 10% waste
   - Պտուտակ (ACC-SCREW): `qty * 4` with minimum 4

2. **BOM Calculation API** (`POST /api/bom`) — full calculation engine:
   - Accepts productId + parameters (width, height, quantity, etc.)
   - Looks up BOM rules for product's category
   - Evaluates formulas via safe DSL (no JS eval)
   - Calculates: rawQty → wasteQty → totalQty → roundedQty → finalQty (with minimum)
   - Checks inventory availability for each component
   - Logs every calculation to BomCalculationLog (rule version + inputs + output)
   - Returns components with sufficient/insufficient status

3. **BOM Preview Component** (`bom-preview.tsx`) — real-time calculation in order dialog:
   - Shows "BOM — ԿՈՄՊՈՆԵՆՏՆԵՐԻ ՀԱՇՎԱՐԿ" section
   - Sufficient/Insufficient badge (green/orange)
   - Component list with: name, SKU, formula, final quantity, unit, stock level
   - Recalculates dynamically as parameters change (width, height, quantity)
   - Only shows when product selected + width/height entered

4. **Dynamic Form Renderer Integration** — order dialog now uses dynamic forms:
   - Fetches active ORDER_ITEM template from `/api/forms/entity/ORDER_ITEM`
   - Renders all 3 groups (Հիմնական, Տեխնիկական, Աքսեսուարներ) with all fields
   - Conditional field display (e.g., motor field only if operation = "մոտորով")
   - All 16 field types supported (TEXT, DIMENSION, QUANTITY, SELECT, MULTISELECT, etc.)
   - Parameters flow to BOM calculation automatically

5. **BOM Rules Management Module** (`bom-rules-module.tsx`) — admin view:
   - Lists all BOM rules with KPIs (total, active, categories, components)
   - Table: category, component, formula, coefficient, waste %, minimum, version, status
   - Admin-only nav item "BOM Կանոններ" with Settings2 icon

**NEW API ROUTES (3):**
- `POST /api/bom` — calculate components from product + parameters
- `GET /api/bom/rules` — list all BOM rules (admin)
- `GET /api/forms/entity/[entityType]` — get active form template for entity type

**BUG FIX:**
- **Fixed:** BOM calculation returned empty array because formulas use `qty` but parameters had `quantity` — added alias mapping in context

### Verification results (agent-browser)

**Tested and PASSED:**
1. ✅ Order dialog now shows dynamic form fields (3 groups, all fields from template)
2. ✅ Selecting a product triggers BOM calculation
3. ✅ BOM preview shows 6 components with formulas, quantities, stock levels
4. ✅ "ԲԱՎԱՐԱՐ" (Sufficient) badge — all components in stock
5. ✅ Changing width from 1000 to 2000 recalculates BOM:
   - Լադդեր պարան: 3 մ → 6 մ (doubled)
   - Գլխավոր պրոֆիլ: 1 մ → 2 մ
   - Ներքևի պրոֆիլ: 1 մ → 2 մ
6. ✅ BOM Rules module shows 6 rules with formulas, coefficients, waste %, status
7. ✅ Lint PASS (0 errors), no runtime errors
8. ✅ Screenshots saved: bom-preview.png, bom-rules.png

## Architecture invariants enforced

- **Money:** AMD integer, decimal.js for math, never binary float ✅
- **Inventory:** immutable movements, AVAILABLE = ON_HAND − RESERVED, transactional ✅
- **AI:** PROPOSAL only, guardrails reject forbidden mutation types ✅
- **RBAC:** enforced at API + Prisma select layer ✅
- **Forms:** versioned, old orders use snapshot ✅
- **Delete:** hard delete only for never-used objects ✅
- **Audit:** every form/admin action logged ✅
- **Tax:** versioned rules, profile-gated ✅
- **Documents:** PDF generation with template versioning ✅
- **BOM DSL:** safe expression engine, no JS eval ✅
  - Every calculation logs formula version + inputs + output
  - Formulas evaluated via custom Pratt parser (no eval/Function)
  - Inventory availability checked per component

## Unresolved issues / risks

1. **OllamaCloud API key** — NOT provided. AI falls back to z-ai-web-dev-sdk.
2. **Email / WhatsApp credentials** — NOT provided. Comms module has placeholders.
3. **Armenian STT** — NOT provided. Voice order module uses text input.
4. **Tax profile** — UNKNOWN (legal form, VAT status, turnover).
5. **Production deployment** — NOT specified.
6. **Mobile viewport test** — agent-browser cannot resize; relies on Tailwind responsive classes.
7. **Email/WhatsApp adapters** — stubs only, no credentials.
8. **BOM auto-reserve on order confirm** — currently BOM shows preview but doesn't auto-reserve components on order confirm (only reserves the main product). Can be enhanced.

## Priority recommendations for next phase

1. **Phase 13: Email/WhatsApp adapters** — implement with stub providers
2. **Phase 18: Mobile audit** — test on real devices at 320/360/375/390/414px
3. **Phase 19: Security tests** — RBAC field-level verification (warehouse cannot access price API)
4. **Phase 20: Release gate** — final audit and release decision
5. **BOM auto-reserve on confirm** — when order confirmed, auto-reserve BOM components (not just main product)
6. **Product detail drawer** — price history, suppliers, BOM rules per product
7. **Client debt statement PDF** — generate debt statement document
8. **Procurement PO PDF** — generate procurement document

## Phase progress

| Phase | Status | Notes |
|---|---|---|
| 1. Capability Discovery + Requirements | ✅ PASS | docs/00, 01 |
| 2. Analog Research + Blueprint | ✅ PASS | docs/02 |
| 3. Architecture + Data Model + Permissions | ✅ PASS | docs/03 |
| 4. Repository Foundation | ✅ PASS | |
| 5. Database + Auth + RBAC | ✅ PASS | 30+ models |
| 6. Dynamic Admin Meta-System | ✅ PASS | Form Builder UI + renderer + API |
| 7. Products + Suppliers + Procurement | ✅ PASS | Receive flow + barcodes |
| 8. Orders + BOM + Inventory | ✅ PASS | BOM engine integrated, dynamic forms in order dialog |
| 9. Finance + Debt + Loyalty + Profit | ✅ PASS | Full flow |
| 10. Armenia Tax Engine | ✅ PARTIAL | UI done, profile UNKNOWN |
| 11. Documents + PDF + Barcode + QR | ✅ PASS | PDF + barcode + QR generation |
| 12. AI Layer | ✅ PARTIAL | Provider + 9 modules |
| 13. Email + WhatsApp | ⏳ PENDING | Stubs only |
| 14. Premium Design System | ✅ PASS | Industrial Precision |
| 15. Operator Workspace | ✅ PASS | |
| 16. Warehouse Workspace | ✅ PASS | |
| 17. Admin Dashboard + Reporting | ✅ PASS | 8 KPIs + 4 charts |
| 18. Armenian Localization + Mobile + A11y | ⏳ PENDING | Armenian done |
| 19. Security + Preview + Browser Audit | ✅ PARTIAL | Drawers + charts + PDFs + forms + BOM verified |
| 20. Final Release Gate | ⏳ PENDING | |

**Overall: ~92% complete.** BOM engine fully integrated with dynamic forms. Remaining: Email/WhatsApp, mobile audit, security tests, release gate.
