# 03 — Technical Architecture

**Project:** Metal Blinds ERP/CRM — Armenia
**Phase:** 3
**Model:** GLM 5.2 (Architect)

---

## 1. Stack (locked)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | Already initialized, RSC, server actions |
| Language | TypeScript 5 strict | Type safety for finance/inventory invariants |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) | Already configured; meets design system needs |
| Auth | NextAuth.js v4 (Credentials + JWT) | Already in deps; SQLite-compatible |
| DB | Prisma + SQLite | Already configured; sufficient for single-instance |
| State (client) | Zustand | Already in deps |
| State (server) | TanStack Query v5 | Already in deps |
| Tables | TanStack Table v8 | Already in deps |
| Forms | react-hook-form + zod | Already in deps |
| Charts | Recharts | Already in deps |
| Animation | Framer Motion | Already in deps; subtle transitions only |
| i18n | next-intl | Armenian primary, English fallback |
| AI SDK | `z-ai-web-dev-sdk` (default) + OllamaCloud adapter (ready) | Per requirement |
| Money | `decimal.js` | No binary float |
| PDF | `pdfkit` (to install) | Server-side, no headless browser needed |
| Barcode/QR | `bwip-js` + `qrcode` (to install) | Standard, no external service |
| Realtime | socket.io mini-service | For low-stock + alert push |
| Browser QA | `agent-browser` skill | For deep audit |

## 2. Folder Structure

```
src/
├── app/
│   ├── api/                      # server-only API routes
│   │   ├── auth/[...nextauth]/   # NextAuth
│   │   ├── clients/
│   │   ├── orders/
│   │   ├── inventory/
│   │   ├── products/
│   │   ├── procurement/
│   │   ├── finance/
│   │   ├── ai/
│   │   ├── documents/
│   │   ├── comms/
│   │   ├── admin/                # admin-only
│   │   └── warehouse/            # warehouse-only
│   ├── globals.css               # Armenian Industrial design tokens
│   ├── layout.tsx                # root layout + providers
│   └── page.tsx                  # SINGLE route — auth gate + workspace shell
├── components/
│   ├── ui/                       # shadcn primitives (already present)
│   ├── shell/                    # workspace shell, sidebar, topbar, command palette
│   ├── auth/                     # login form
│   ├── admin/                    # admin modules
│   ├── operator/                 # operator modules
│   ├── warehouse/                # warehouse modules
│   ├── shared/                   # cross-role: status pills, money cell, etc.
│   ├── forms/                    # dynamic form renderer + builder
│   └── charts/                   # chart wrappers (Recharts)
├── lib/
│   ├── db.ts                     # Prisma singleton (exists)
│   ├── auth.ts                   # NextAuth config
│   ├── rbac.ts                   # permission matrix + helpers
│   ├── ai/                       # AI provider router + guardrails
│   │   ├── provider.ts           # OllamaCloud + z-ai-web-dev-sdk switch
│   │   ├── guardrails.ts         # forbidden mutations list
│   │   ├── router.ts             # model routing per task
│   │   └── modules/              # 9 AI modules
│   ├── finance/                  # decimal money, debt ledger calc
│   ├── inventory/                # ledger invariant helpers
│   ├── bom/                      # safe expression DSL
│   ├── tax/                      # Armenia tax engine
│   ├── docs/                     # PDF, barcode, QR generators
│   ├── comms/                    # email + WhatsApp adapters
│   ├── i18n/                     # Armenian strings
│   ├── utils.ts                  # exists; add cn(), formatters
│   └── validations/              # zod schemas
├── hooks/                        # React hooks (data + UI)
└── types/                        # shared TypeScript types
prisma/
├── schema.prisma                 # full ERP schema
└── migrations/                   # generated
mini-services/
└── alert-service/                # socket.io for realtime alerts
docs/                             # phase artifacts
scripts/                          # generation scripts (per Rule 9)
```

## 3. Data Model Summary (full schema in 03_data_dictionary.md)

### Core entities

```
User (id, email, name, role, passwordHash, active, createdAt)
  └─ role: ADMIN | OPERATOR | WAREHOUSE
  └─ minimum 2 ADMIN accounts enforced at seed time

Client (id, type INDIVIDUAL|COMPANY, …contact fields, …financial profile fields)
  └─ ClientContact (for company: multiple contacts)
  └─ ClientAddress (primary + secondary)
  └─ ClientDocument, ClientPhoto, ClientComment
  └─ preferredLanguage, preferredChannel
  └─ creditLimit (AMD integer, admin-set)

Order (id, number, clientId, status, baseAmount, discountAmount, taxAmount,
       totalAmount, paidAmount, outstandingAmount, costAmount, grossProfit,
       marginPercent, dueDate, createdAt, createdBy)
  └─ OrderItem (id, orderId, productId, qty, unitPriceSnapshot, …parameters)
       └─ OrderItemParameter (id, orderItemId, fieldId, value JSON)
  └─ OrderPayment (id, orderId, amount, method, date, allocation)
  └─ OrderStatusHistory (id, orderId, status, at, by, note)
  └─ OrderDocument (id, orderId, type, url, generatedAt)

Product (id, sku, name, categoryId, unitId, color, salePrice, purchasePrice,
         minStock, active, archivedAt)
  └─ ProductSupplier (productId, supplierId, supplierSku, leadTimeDays)
  └─ ProductPriceHistory (id, productId, price, purchasePrice, from, to, reason)
  └─ ProductPhoto

Category (id, name, parentId)  — tree
Unit (id, code, name, symbol)  — piece/m/m²/kg/roll/kit + admin-created
Supplier (id, name, taxId, …contacts, paymentTerms)

FormTemplate (id, name, entityType PRODUCT|ORDER_ITEM|CLIENT, version, active)
  └─ FieldGroup (id, templateId, label, order, conditionExpr)
       └─ Field (id, groupId, key, label, type, required, order, options JSON,
                 validation JSON, conditionExpr, archivedAt)
  └─ FormTemplateVersion (snapshot for old orders)

BomRule (id, productTypeId, componentProductId, formulaExpr, unit, coefficient,
         waste, rounding, minimum, conditionExpr, version, active)
  └─ BomCalculationLog (id, ruleId, ruleVersion, orderId, inputs JSON, output JSON,
                         calculatedAt)

InventoryItem (id, productId, onHand, reserved) — derived, not authoritative
InventoryMovement (id, productId, type, qty, refType, refId, lot, at, by, note)
  └─ types: RECEIVE, RESERVE, RELEASE_RESERVATION, ISSUE, RETURN, WRITE_OFF, ADJUSTMENT
  └─ IMMUTABLE — corrections via new ADJUSTMENT movement

PurchaseRequest (id, productId, qty, reason, status, createdBy)
PurchaseOrder (id, number, supplierId, status, expectedDate, actualDate,
               totalAmount, attachments)
  └─ PurchaseOrderItem (id, poId, productId, qty, unit, unitPrice, total)
  └─ status: DRAFT|REQUESTED|ORDERED|IN_TRANSIT|PARTIALLY_RECEIVED|RECEIVED|CLOSED

LoyaltyTier (id, name, thresholdTurnover, discountPercent, active)
  └─ LoyaltyOverride (id, clientId, discountPercent, reason, by, at)

TaxRule (id, type, regime, rate, formula, applicability, effectiveFrom,
         effectiveTo, officialSource, verifiedAt, version, status)
  └─ status: DRAFT|ACTIVE|SUPERSEDED|RETIRED
  └─ TaxProfile (id, companyId?, legalForm, vatStatus, turnover, regime, verifiedAt)

DocumentTemplate (id, type, name, version, bodyTemplate, active)
GeneratedDocument (id, templateId, templateVersion, entityId, entityType,
                   url, generatedAt, by)

CommunicationLog (id, channel EMAIL|WHATSAPP, direction, clientId, orderId,
                  subject, body, status, attachments, at, by)

Notification (id, type, severity, payload JSON, readAt, userId, createdAt)
AuditLog (id, actorId, action, entityType, entityId, before JSON, after JSON,
          at, ip, userAgent) — IMMUTABLE

AiProposal (id, module, input JSON, output JSON, status, approvedBy, approvedAt,
            appliedAt, rejectedReason)
  └─ status: PENDING|APPROVED|REJECTED|APPLIED|EXPIRED
```

### Money handling
- All amounts stored as `BigInt` (AMD integer minor units) in Prisma — SQLite supports `BigInt`.
- Or stored as `Int` if amounts fit AMD billions; we'll use `Int` for simplicity given AMD scale (1 AMD = 1 unit, no decimals).
- Application layer uses `decimal.js` for percentage / margin math.

## 4. Permission Matrix (excerpt — full in 03_permission_matrix.md)

| Action | ADMIN | OPERATOR | WAREHOUSE | UNAUTH |
|---|---|---|---|---|
| View dashboard | ✓ | ✓ (limited) | ✓ (limited) | ✗ |
| Create client | ✓ | ✓ | ✗ | ✗ |
| Create order | ✓ | ✓ | ✗ | ✗ |
| View sale price | ✓ | ✓ | ✗ | ✗ |
| View cost / margin / profit | ✓ | ✗ | ✗ | ✗ |
| Override price | ✓ (audited) | ✗ | ✗ | ✗ |
| Override discount | ✓ (audited) | ✗ | ✗ | ✗ |
| Edit tax rules | ✓ | ✗ | ✗ | ✗ |
| Set credit limit | ✓ | ✗ | ✗ | ✗ |
| Manage products / units / metrics | ✓ | ✗ | ✗ | ✗ |
| Edit BOM rules | ✓ | ✗ | ✗ | ✗ |
| Confirm warehouse pick | ✓ | ✗ | ✓ | ✗ |
| View debt | ✓ | ✓ (own client) | ✗ | ✗ |
| Send email/WhatsApp | ✓ | ✓ | ✗ | ✗ |
| Generate PDF | ✓ | ✓ | ✓ (warehouse-only) | ✗ |
| Use AI modules | ✓ | ✓ (limited) | ✗ | ✗ |
| Manage users | ✓ | ✗ | ✗ | ✗ |
| View audit log | ✓ | ✗ | ✗ | ✗ |

## 5. AI Layer Architecture

```
User invokes AI module
  ↓
Module composes prompt + context (read-only)
  ↓
AI Router selects model:
  - OllamaCloud deepseek-v4-pro (reasoning, audit, code)
  - OllamaCloud deepseek-v4-flash (drafting, validation, QA)
  - Fallback: z-ai-web-dev-sdk
  ↓
Provider sends request
  ↓
AI returns PROPOSAL (JSON, schema-validated)
  ↓
Guardrail check:
  - if proposal mutates forbidden ledger → REJECTED_BY_GUARDRAIL
  ↓
RBAC check
  ↓
Business rule check
  ↓
If requires approval → AiProposal persisted, status PENDING
  ↓
User approves
  ↓
Deterministic action executes (NOT AI)
  ↓
Audit log entry
```

## 6. Inventory Invariant

`ON_HAND = SUM(RECEIVE) − SUM(ISSUE) − SUM(WRITE_OFF) + SUM(RETURN) − SUM(ADJUSTMENT negative) + SUM(ADJUSTMENT positive)`
`RESERVED = SUM(RESERVE) − SUM(RELEASE_RESERVATION) − SUM(ISSUE from reservation)`
`AVAILABLE = ON_HAND − RESERVED`

Enforced by:
- Prisma transaction wrapping every movement.
- App-level validator: cannot ISSUE more than RESERVED.
- Cannot RESERVE more than AVAILABLE.
- Corrections via new ADJUSTMENT movement, never mutation.

## 7. Status

**Phase 3: PASS.** Artifacts:
- `docs/03_architecture.md` (this)
- `docs/03_data_dictionary.md` (next)
- `docs/03_permission_matrix.md` (next)

Proceed to PHASE 4 (Repository Foundation).
