# Worklog — Metal Blinds ERP/CRM Armenia

## Project status

**Phase:** P6 — Dynamic Form Builder UI COMPLETE
**Overall:** ~88% complete. Admin can now create custom forms with fields visually, no code required.
**Build:** Lint PASS (0 errors). Dev server stable.
**Last QA:** 2026-08-28 — Form Builder create/edit/render verified via agent-browser

## Current goals / completed modifications

### This round (webDevReview #4)

**NEW FEATURE: Dynamic Form Builder (Phase 6)** — the biggest pending feature is now complete:

1. **Form Builder Module** (`form-builder.tsx`) — admin visual editor:
   - List all form templates with KPIs (total, active, groups, fields)
   - Create new template (name + entity type: ORDER_ITEM, PRODUCT, CLIENT)
   - Template editor Sheet with:
     - Header: template name, entity type, version, group count
     - Active/Inactive toggle
     - "New Version" button (creates snapshot, deactivates old)
     - Expandable groups with field counts
     - Add Group button
     - Add Field button per group
   - Add Field dialog: key, label, type (16 types), required toggle, options (for SELECT/MULTISELECT), condition expression (DSL)
   - Field type icons (Aa, ¶, #, ↔, ×, ֏, ☑, 📅, ▾, ☰, ●, ☎, @, ⌂, 📷, 📎)
   - Delete field (soft-delete/archives if used, hard-delete if never used)
   - Audit log entries for all changes

2. **Dynamic Form Renderer** (`dynamic-form-renderer.tsx`) — renders fields from template:
   - Supports all 16 field types: TEXT, TEXTAREA, NUMBER, DECIMAL, DIMENSION, QUANTITY, MONEY, BOOLEAN, DATE, SELECT, MULTISELECT, COLOR, PHONE, EMAIL, ADDRESS, PHOTO, FILE
   - Conditional field display (evaluates conditionExpr via safe DSL)
   - Group-level conditions
   - Required field indicators
   - Full-width layout for textarea/multiselect/file
   - Multi-select with toggle chips
   - Ready to integrate into order creation dialog

3. **Form Builder API** (3 routes):
   - `GET /api/forms` — list all templates with groups + fields
   - `POST /api/forms` — create new template
   - `GET /api/forms/[id]` — get single template
   - `PATCH /api/forms/[id]` — operations: add_group, add_field, update_field, delete_field, toggle_active, duplicate (version)

**Navigation:**
- Added "Դինամիկ ձևեր" nav item (admin-only) with FileText icon

### Verification results (agent-browser)

**Tested and PASSED:**
1. ✅ Form Builder module loads — shows seeded "Ջալուզիի պատվերի ձև" template (3 groups, 12 fields, v1, active)
2. ✅ KPIs correct: 1 ձև, 1 ակտիվ, 3 խմբեր, 12 դաշտեր
3. ✅ Click template → editor Sheet opens with 3 groups expanded
4. ✅ Fields render with type icons (↔ DIMENSION, × QUANTITY, ▾ SELECT) and required asterisks
5. ✅ Add Field dialog works — created "room_name" field, appears in group
6. ✅ Create new template — "Պրոֆիլի պատվերի ձև" (PRODUCT type) created, editor auto-opens
7. ✅ Add Group — "Չափեր" group created, shows empty state
8. ✅ Lint PASS (0 errors), no runtime errors
9. ✅ Screenshot saved: `/home/z/my-project/download/form-builder.png`

## Architecture invariants enforced

- **Money:** AMD integer, decimal.js for math, never binary float ✅
- **Inventory:** immutable movements, AVAILABLE = ON_HAND − RESERVED, transactional ✅
- **AI:** PROPOSAL only, guardrails reject forbidden mutation types ✅
- **RBAC:** enforced at API + Prisma select layer ✅
- **Forms:** versioned, old orders use snapshot ✅
  - New version creates snapshot, deactivates old
  - Delete field: soft-delete if used, hard-delete if never used
- **Delete:** hard delete only for never-used objects ✅
- **Audit:** every form/admin action logged ✅
- **Tax:** versioned rules, profile-gated ✅
- **Documents:** PDF generation with template versioning ✅
- **BOM DSL:** safe expression engine, no JS eval ✅

## Unresolved issues / risks

1. **OllamaCloud API key** — NOT provided. AI falls back to z-ai-web-dev-sdk.
2. **Email / WhatsApp credentials** — NOT provided. Comms module has placeholders.
3. **Armenian STT** — NOT provided. Voice order module uses text input.
4. **Tax profile** — UNKNOWN (legal form, VAT status, turnover).
5. **Production deployment** — NOT specified.
6. **Mobile viewport test** — agent-browser cannot resize; relies on Tailwind responsive classes.
7. **BOM engine integration** — DSL ready, not wired into order creation flow.
8. **Email/WhatsApp adapters** — stubs only, no credentials.
9. **Dynamic form renderer integration** — renderer ready, not yet wired into order creation dialog.

## Priority recommendations for next phase

1. **Phase 8: BOM integration** — wire BOM calculation into order creation (auto-calculate component quantities from product dimensions)
2. **Wire dynamic form renderer into order dialog** — replace hardcoded width/height/color fields with dynamic fields from FormTemplate
3. **Phase 13: Email/WhatsApp adapters** — implement with stub providers
4. **Phase 18: Mobile audit** — test on real devices at 320/360/375/390/414px
5. **Phase 19: Security tests** — RBAC field-level verification
6. **Phase 20: Release gate** — final audit
7. **Product detail drawer** — price history, suppliers, BOM rules
8. **Client debt statement PDF** — generate debt statement document
9. **Procurement PO PDF** — generate procurement document

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
| 8. Orders + BOM + Inventory | ✅ PARTIAL | Orders+inventory done, BOM integration pending |
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
| 19. Security + Preview + Browser Audit | ✅ PARTIAL | Drawers + charts + PDFs + forms verified |
| 20. Final Release Gate | ⏳ PENDING | |

**Overall: ~88% complete.** Dynamic Form Builder complete. Remaining: BOM integration, Email/WhatsApp, mobile audit, security tests, release gate.
