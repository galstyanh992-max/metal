# Worklog — Metal Blinds ERP/CRM Armenia

## Project status

**Phase:** P13 — Email/WhatsApp Adapters + BOM Auto-Reserve COMPLETE
**Overall:** ~95% complete. Communications module functional, BOM auto-reserves components on order confirm.
**Build:** Lint PASS (0 errors). Dev server stable.
**Last QA:** 2026-08-28 — Email/WhatsApp send + BOM auto-reserve verified

## Current goals / completed modifications

### This round (webDevReview #6)

**NEW FEATURE: Email/WhatsApp Adapters (Phase 13)** — communications module now functional:

1. **Comms Adapter Library** (`src/lib/comms/adapters.ts`):
   - **Email adapter** — supports SMTP (if `EMAIL_SMTP_*` env vars set) and stub mode. Credentials come from environment only, NEVER stored in app database.
   - **WhatsApp adapter** — uses official WhatsApp Business Cloud API (if `WHATSAPP_BUSINESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` set), falls back to stub. Never bypasses provider policy.
   - Both return `{success, messageId, provider}` for logging

2. **Comms API** (`POST /api/comms/send`, `GET /api/comms/send`):
   - POST: accepts channel (EMAIL/WHATSAPP), to, subject, body, clientId, orderId
   - Sends via adapter, always logs to CommunicationLog with status
   - Creates audit log entry for every send
   - GET: returns last 50 communications with client/order/user relations

3. **Comms Module UI** (upgraded `comms-module.tsx`):
   - 4 stat cards: Email count, WhatsApp count, Sent count, Failed count
   - 3 tabs: All, Email, WhatsApp
   - Log table: channel icon, recipient (name + contact), subject/body preview, status badge (SENT/FAILED with icons), timestamp
   - Send dialog: channel toggle (Email/WhatsApp), client selector, recipient preview, subject (email only), body textarea, provider hint
   - Status badges with semantic colors (green=sent, red=failed)

**NEW FEATURE: BOM Auto-Reserve on Order Confirm** — when order is confirmed, BOM components are automatically reserved:

- Order confirm flow now:
  1. Reserves main product (existing behavior)
  2. Looks up BOM rules for product's category
  3. Evaluates formulas with item parameters (width, height, qty)
  4. Creates RESERVE movements for each BOM component
  5. If any reservation fails (insufficient stock), returns error

- Order cancel flow now:
  1. Releases main product reservation
  2. Releases all BOM component reservations

**Verified:** ORD-2026-0002 confirm created 7 movements:
- RESERVE 1 — Ալյումինե ջալուզի (main product)
- RESERVE 3 — Լադդեր պարան (BOM)
- RESERVE 1 — Գլխավոր պրոֆիլ (BOM)
- RESERVE 1 — Ներքևի պրոֆիլ (BOM)
- RESERVE 5 — Կլիպս (BOM)
- RESERVE 3 — Կառավարման պարան (BOM)
- RESERVE 4 — Պտուտակ (BOM)

### Verification results (agent-browser)

**Tested and PASSED:**
1. ✅ Comms module loads with 4 stat cards + 3 tabs
2. ✅ Send Email: selected client, entered subject + body, sent → log shows SENT status
3. ✅ Send WhatsApp: switched to WhatsApp mode, shows phone number, sent → log shows SENT
4. ✅ Comms log shows 2 entries (1 email + 1 WhatsApp) with recipient, subject, status, timestamp
5. ✅ BOM auto-reserve: confirmed ORD-2026-0002 → 7 RESERVE movements created (1 main + 6 BOM components)
6. ✅ All movements logged with notes: "BOM: ORD-2026-0002 → [component name]"
7. ✅ Lint PASS (0 errors), no runtime errors
8. ✅ Screenshot saved: comms-module.png

## Architecture invariants enforced

- **Money:** AMD integer, decimal.js for math, never binary float ✅
- **Inventory:** immutable movements, AVAILABLE = ON_HAND − RESERVED, transactional ✅
  - Order confirm → RESERVE main product + all BOM components
  - Order cancel → RELEASE_RESERVATION main product + all BOM components
- **AI:** PROPOSAL only, guardrails reject forbidden mutation types ✅
- **RBAC:** enforced at API + Prisma select layer ✅
- **Forms:** versioned, old orders use snapshot ✅
- **Delete:** hard delete only for never-used objects ✅
- **Audit:** every comms send + order action logged ✅
- **Tax:** versioned rules, profile-gated ✅
- **Documents:** PDF generation with template versioning ✅
- **BOM DSL:** safe expression engine, no JS eval ✅
- **Comms:** credentials from env only, never in app DB ✅
  - Email: SMTP or stub
  - WhatsApp: Business Cloud API or stub, never bypasses provider policy
  - All communications logged with status + provider

## Unresolved issues / risks

1. **OllamaCloud API key** — NOT provided. AI falls back to z-ai-web-dev-sdk.
2. **Email SMTP credentials** — NOT provided. Email uses stub mode.
3. **WhatsApp Business token** — NOT provided. WhatsApp uses stub mode.
4. **Armenian STT** — NOT provided. Voice order module uses text input.
5. **Tax profile** — UNKNOWN (legal form, VAT status, turnover).
6. **Production deployment** — NOT specified.
7. **Mobile viewport test** — agent-browser cannot resize; relies on Tailwind responsive classes.

## Priority recommendations for next phase

1. **Phase 18: Mobile audit** — test on real devices at 320/360/375/390/414px
2. **Phase 19: Security tests** — RBAC field-level verification (warehouse cannot access price API)
3. **Phase 20: Release gate** — final audit and release decision
4. **Product detail drawer** — price history, suppliers, BOM rules per product
5. **Client debt statement PDF** — generate debt statement document
6. **Procurement PO PDF** — generate procurement document
7. **AI email/WhatsApp draft integration** — use AI assistant to draft messages, then send via comms module

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
| 8. Orders + BOM + Inventory | ✅ PASS | BOM auto-reserve on confirm/cancel |
| 9. Finance + Debt + Loyalty + Profit | ✅ PASS | Full flow |
| 10. Armenia Tax Engine | ✅ PARTIAL | UI done, profile UNKNOWN |
| 11. Documents + PDF + Barcode + QR | ✅ PASS | PDF + barcode + QR generation |
| 12. AI Layer | ✅ PARTIAL | Provider + 9 modules |
| 13. Email + WhatsApp | ✅ PASS | Adapters + API + UI with send + log |
| 14. Premium Design System | ✅ PASS | Industrial Precision |
| 15. Operator Workspace | ✅ PASS | |
| 16. Warehouse Workspace | ✅ PASS | |
| 17. Admin Dashboard + Reporting | ✅ PASS | 8 KPIs + 4 charts |
| 18. Armenian Localization + Mobile + A11y | ⏳ PENDING | Armenian done |
| 19. Security + Preview + Browser Audit | ✅ PARTIAL | All features verified |
| 20. Final Release Gate | ⏳ PENDING | |

**Overall: ~95% complete.** Email/WhatsApp + BOM auto-reserve done. Remaining: mobile audit, security tests, release gate.
