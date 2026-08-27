# 01 — Requirements Lock

**Project:** Metal Blinds ERP/CRM — Armenia
**Phase:** 1 — Requirements Lock
**Model:** GLM 5.2 (Architect)
**Status:** LOCKED

---

## 1. Product Identity

- **Name:** Metal Blinds ERP/CRM — Armenia
- **Domain:** Shop + production of metal blinds (жалюзи)
- **Country:** Armenia
- **Primary UI language:** Հայերեն (Armenian), with Latin/English fallback for technical terms
- **Currency:** AMD (Armenian Dram), integer minor units (no float)
- **Locale code:** `hy-AM`
- **Number format:** AMD with thousand separators, no decimals by default
- **Date format:** DD.MM.YYYY
- **Design language:** Premium Armenian Industrial Precision

## 2. User Roles (locked, 3 roles)

| Role | Summary | Sees financials? | Can override price/discount? | Can edit tax rules? |
|---|---|---|---|---|
| ADMIN | Full control, minimum 2 separate accounts | YES | YES (audited) | YES |
| OPERATOR | Creates clients, orders, communications | Sales price YES, profit/margin NO | NO | NO |
| WAREHOUSE | Picks, issues, returns, low-stock alerts | NO | NO | NO |

### Authentication
- Single login page (`/` with auth gate).
- After login → role-detected workspace (Admin / Operator / Warehouse).
- No separate login URLs per role.

## 3. Functional Modules (locked scope)

### 3.1 Clients
- Individuals: name, surname, phone, email, primary + secondary address, photos, documents, comments, preferred language, preferred channel.
- Companies: company name, tax ID, legal address, actual address, banking details, multiple contact persons, phone, email, contracts, documents, payment terms.
- One client can be linked to many orders.

### 3.2 Client Financial Profile
Computed (not stored as single mutable number):
- Lifetime turnover, total orders, average order value, total payments
- Current debt, overdue debt, profit generated, last order date
- Loyalty tier, discount %, credit limit
- Status indicator: GREEN / YELLOW / ORANGE / RED / CRITICAL

### 3.3 Orders
- 1 client → many orders.
- 1 order → many items.
- Each item has its own parameters.
- Min parameters: width, height, quantity, color, product/profile type, material, manual/motorized, motor, guides, accessories, installation/options.
- System is **not** limited to these — dynamic form builder adds fields.

### 3.4 Dynamic Form Builder
- ADMIN creates products / categories / units / metrics / parameters / form templates / field groups / fields / options / validation / conditional fields / BOM mapping — **without code**.
- Field types: text, textarea, number, decimal, dimension, quantity, money, boolean, date, select, multiselect, color, phone, email, address, photo, file.
- Field lifecycle: create / edit / reorder / disable / archive / safe-delete (only if never used).

### 3.5 Versioning
If a form / BOM formula / tax rule / price / document template has been used, edits create a new version:
- Old orders keep V1 snapshot.
- New orders use latest version.
- Every calculation log records: formula version, inputs, output, timestamp.

### 3.6 Delete Policy
- Hard delete: only objects never used.
- Archive / deactivate / soft-delete / correction transaction for everything else.
- Never hard-delete: orders, payments, debts, inventory movements, purchase history, fiscal documents, audit log.

### 3.7 Products
- SKU, name, category, color, description, photo, barcode, QR, unit, sale price, purchase price history, minimum stock, multiple suppliers, active/archive.

### 3.8 Units
- piece, meter, square meter, kilogram, roll, kit, + ADMIN-created units.

### 3.9 Inventory Ledger (immutable movements)
Movement types: RECEIVE, RESERVE, RELEASE_RESERVATION, ISSUE, RETURN, WRITE_OFF, ADJUSTMENT.
`AVAILABLE = ON_HAND - RESERVED`
Never mutate an old movement — append corrections.

### 3.10 Order → Inventory Flow
1. Calculate materials (BOM).
2. Check warehouse availability.
3. Create RESERVE movement.
4. Create warehouse task.
5. On warehouse confirm: RESERVE → ISSUE.
6. On cancel: RESERVE → RELEASE_RESERVATION.
7. On return: new RETURN movement (not mutation).

### 3.11 BOM Engine
- ADMIN defines: product type, component, formula (safe DSL, no JS eval), unit, coefficient, waste, rounding, minimum, conditions.
- Each calculation logs formula version + inputs + output + timestamp.

### 3.12 Procurement
Flow: PURCHASE_REQUEST → PURCHASE_ORDER → ORDERED → IN_TRANSIT → PARTIALLY_RECEIVED → RECEIVED → CLOSED.
Each PO stores supplier, items, unit, qty, unit price, total, expected date, actual date, attachments, purchase price history.
On receiving → automatic INVENTORY RECEIVE movement.

### 3.13 Low Stock
- ADMIN sets minimum stock per product.
- When `available < minimum`: alert + dashboard warning + procurement recommendation.

### 3.14 Finance
- Currency: AMD.
- Payment methods: bank transfer, card, contract payment.
- Partial payments, multiple payments per order, allocation, due dates.
- Per order: base amount, discount, tax, total, paid, outstanding, cost, gross profit, margin %.
- **Decimal.js for money — never binary float.**

### 3.15 Debt Ledger
- Client total debt = sum of order balances.
- Always traceable: CLIENT → ORDER → CHARGE → PAYMENT → BALANCE.
- Never a single mutable number.

### 3.16 Loyalty
- ADMIN defines tiers based on lifetime turnover.
- Crossing threshold: tier auto-changes, discount auto-assigned.
- Operator sees discount; only ADMIN can override (with reason + user + timestamp + audit event).

### 3.17 Profitability
- ADMIN sees: revenue, historical material cost, gross profit, gross margin, profit per order, profit per client, daily/weekly/monthly/custom.
- Cost is captured at order time (historical) — later purchase price changes do not affect old orders.

### 3.18 Armenia Tax Engine
- Separate versioned module.
- Each tax rule stores: type, regime, rate/formula, applicability, effective_from, effective_to, official source, verified_at, version, status.
- Architecture supports: VAT, turnover tax, profit-related, payroll-related (future), import charges, fiscal documents.
- **UNKNOWN (not yet facts):** company legal form, turnover, VAT status, tax regime, import profile.
- Tax engine cannot be marked production-ready until company tax profile is confirmed.

### 3.19 Documents
Auto-generated: customer order (with prices), warehouse order (no prices), invoice, payment receipt, debt statement, delivery note, procurement document.
Formats: PDF, print, email, WhatsApp attachment, barcode, QR.

### 3.20 Email
- Domain email for ADMIN/OPERATOR.
- AI draft → user review → send.
- Mailbox password never stored in app DB.

### 3.21 WhatsApp
- Official WhatsApp Business workflow.
- Client opt-in, templates, status (sent/delivered/read/error), attachments, conversation history.
- AI generates: debt reminders, payment reminders, order ready, invoice, follow-up.
- No provider-policy bypass.

### 3.22 AI Modules (9)
1. Armenian voice order input
2. AI order validation
3. Ask Business assistant
4. Inventory demand forecast
5. Debt assistant
6. Price/margin assistant
7. OCR / document extraction
8. AI email assistant
9. AI WhatsApp assistant

**AI cannot directly mutate:** payments, debt ledger, inventory ledger, price, discount, tax rules. AI returns PROPOSAL → schema validation → RBAC → business rule → user approval if required → deterministic action.

### 3.23 Dashboards

**ADMIN:** sales today/week/month, collected payments, outstanding debt, overdue debt, expected cash, orders, avg order, gross profit, margin, top clients, loyalty distribution, low stock, purchases, in-transit purchases, alerts, recent activity. Configurable metrics. **No fake metrics.**

**OPERATOR:** new orders, pending, clients, debt warnings, stock availability, recent communications, quick new client, quick new order, search.

**WAREHOUSE:** pending picks, picking, shortages, ready, returns, low stock. **No financial data.**

### 3.24 Global Search
Search by: name, surname, company, phone, email, tax ID, order number, invoice, SKU, barcode, QR, supplier, purchase order.

### 3.25 Notifications
Low stock, overdue debt, due soon, large order, shortage, supplier delay, loyalty tier reached, failed email, failed WhatsApp, document generation failure, critical application error.

## 4. Non-Functional Requirements

### 4.1 Design
- Premium Armenian Industrial Precision.
- Strong typography, clear hierarchy, precise spacing.
- Premium neutral surfaces, restrained metallic references.
- Excellent Armenian typography (Noto Sans Armenian / Noto Serif Armenian).
- Highly readable AMD numbers.
- Premium tables, refined status states, excellent forms.
- **NOT:** generic dashboard template, excessive glassmorphism, random gradients, all-rounded cards, fake charts, decorative animations, sci-fi cockpit UI.

### 4.2 Mobile
Tested at: 320, 360, 375, 390, 414, 768, tablet landscape, desktop, wide desktop.
Verify: no horizontal overflow, touch targets ≥44px, keyboard handling, forms, tables, modals, drawers, navigation, scan flow, dynamic forms, Armenian long labels, reduced motion, focus, contrast.

### 4.3 Security
- Warehouse cannot access sale price / debt / margin / finance API.
- Operator cannot override discount / protected price / tax config / inventory ledger.
- Unauthenticated cannot access protected data.
- AI cannot bypass RBAC or mutate protected ledgers.
- All overrides audited.

### 4.4 Source-First
Before every phase, read real repo state. Never invent files/routes/APIs/tables/envs/tests/commands/outputs.

## 5. Out of Scope (for this run)

- Payroll module (architecture stub only).
- Real production deployment to external cloud (preview via dev server only).
- iOS/Android native apps (responsive web only).
- Real-time multi-instance clustering (single-instance dev).

## 6. Acceptance Criteria (per phase)

Each phase ends with:
- PASS: artifact exists, code lints, targeted verification passes.
- REPAIR: targeted fix loop until PASS.
- BLOCKED: documented blocker, no further phase progress on that track.

## 7. Open Questions (for user — answer with READY / NOT_NEEDED / BLOCKED)

1. OllamaCloud API key (for DeepSeek v4 flash/pro)?
2. Email provider credentials?
3. WhatsApp Business token?
4. Armenian STT provider credentials?
5. Company tax profile (legal form, VAT status, turnover)?
6. Production deployment target?

**Until answered, the AI / Email / WhatsApp modules will run on `z-ai-web-dev-sdk` (already available) as a working fallback, with adapters for OllamaCloud ready to switch on.**

## 8. Status

**Requirements Lock: LOCKED.**
No further requirements changes without explicit user instruction.
