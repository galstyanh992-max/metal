# 03b — Permission Matrix (full)

**Project:** Metal Blinds ERP/CRM — Armenia

Legend: ✓ allowed · ✗ denied · ◐ allowed with audit/reason

## 1. Clients

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| List clients | ✓ | ✓ | ✗ |
| View client contact | ✓ | ✓ | ◐ (name + phone only, for delivery) |
| View client financial profile | ✓ | ◐ (own orders only) | ✗ |
| View client debt | ✓ | ◐ (own clients) | ✗ |
| Create individual | ✓ | ✓ | ✗ |
| Create company | ✓ | ✓ | ✗ |
| Edit contact fields | ✓ | ✓ | ✗ |
| Edit payment terms | ✓ | ✗ | ✗ |
| Set credit limit | ✓ (audited) | ✗ | ✗ |
| Upload photo / document | ✓ | ✓ | ✗ |
| Delete client (hard) | ✓ (only if no orders) | ✗ | ✗ |
| Archive client | ✓ | ✗ | ✗ |

## 2. Orders

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| List orders | ✓ | ✓ (own created) | ✓ (assigned picks) |
| View order items | ✓ | ✓ | ◐ (items + qty only, no price) |
| View order price | ✓ | ✓ | ✗ |
| View order cost/profit | ✓ | ✗ | ✗ |
| Create order | ✓ | ✓ | ✗ |
| Add item to order | ✓ | ✓ (draft) | ✗ |
| Enter dynamic parameters | ✓ | ✓ | ✗ |
| Override calculated price | ✓ (audited) | ✗ | ✗ |
| Override discount | ✓ (audited) | ✗ | ✗ |
| Confirm order (reserve stock) | ✓ | ✓ | ✗ |
| Cancel order | ✓ | ✓ (own, if not issued) | ✗ |
| Mark ready | ✓ | ◐ (after warehouse confirm) | ✓ |
| Generate customer PDF (with price) | ✓ | ✓ | ✗ |
| Generate warehouse PDF (no price) | ✓ | ✓ | ✓ |

## 3. Inventory

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| View on-hand | ✓ | ◐ (availability only) | ✓ |
| View reserved | ✓ | ◐ | ✓ |
| View movement history | ✓ | ✗ | ✓ (own picks) |
| RESERVE | ✓ (system, on order confirm) | system | ✗ |
| ISSUE | ✓ | ✗ | ✓ |
| RETURN | ✓ | ✗ | ✓ |
| WRITE_OFF | ✓ (audited) | ✗ | ◐ (with reason) |
| ADJUSTMENT | ✓ (audited) | ✗ | ✗ |
| Set minimum stock | ✓ | ✗ | ✗ |
| View low stock alerts | ✓ | ◐ (availability hint) | ✓ |

## 4. Products / Catalog

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| List products | ✓ | ✓ | ✓ |
| View sale price | ✓ | ✓ | ✗ |
| View purchase price | ✓ | ✗ | ✗ |
| Create product | ✓ | ✗ | ✗ |
| Edit product | ✓ | ✗ | ✗ |
| Archive product | ✓ | ✗ | ✗ |
| Manage units | ✓ | ✗ | ✗ |
| Manage categories | ✓ | ✗ | ✗ |
| Manage BOM rules | ✓ | ✗ | ✗ |
| View BOM | ✓ | ◐ (for parameter hints) | ◐ (for picking components) |

## 5. Procurement

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| Create purchase request | ✓ | ◐ (suggest only) | ✓ (from shortage) |
| Approve purchase request | ✓ | ✗ | ✗ |
| Create purchase order | ✓ | ✗ | ✗ |
| Receive PO | ✓ | ✗ | ✓ |
| View purchase price history | ✓ | ✗ | ✗ |
| View supplier list | ✓ | ✓ | ◐ (for receiving) |
| Manage suppliers | ✓ | ✗ | ✗ |

## 6. Finance

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| View payments | ✓ | ◐ (own orders) | ✗ |
| Record payment | ✓ | ✓ (own orders) | ✗ |
| View debt ledger | ✓ | ◐ (own clients) | ✗ |
| View profit / margin | ✓ | ✗ | ✗ |
| Configure payment methods | ✓ | ✗ | ✗ |
| Manage loyalty tiers | ✓ | ✗ | ✗ |
| Override loyalty discount | ✓ (audited) | ✗ | ✗ |

## 7. Tax Engine

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| View tax rules | ✓ | ✗ | ✗ |
| Create tax rule | ✓ (audited) | ✗ | ✗ |
| Edit tax rule (creates new version) | ✓ (audited) | ✗ | ✗ |
| Retire tax rule | ✓ (audited) | ✗ | ✗ |
| View tax profile | ✓ | ✗ | ✗ |
| Edit tax profile | ✓ (audited) | ✗ | ✗ |

## 8. Documents

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| View document templates | ✓ | ◐ (read-only) | ✗ |
| Edit document templates | ✓ | ✗ | ✗ |
| Generate document | ✓ | ✓ | ◐ (warehouse docs only) |
| Send via email | ✓ | ✓ | ✗ |
| Send via WhatsApp | ✓ | ✓ | ✗ |

## 9. AI Modules

| Module | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| Armenian voice order input | ✓ | ✓ | ✗ |
| AI order validation | ✓ | ✓ | ✗ |
| Ask Business assistant | ✓ | ◐ (read-only Q&A) | ✗ |
| Inventory demand forecast | ✓ | ✗ | ◐ (read-only) |
| Debt assistant | ✓ | ◐ (own clients) | ✗ |
| Price/margin assistant | ✓ | ✗ | ✗ |
| OCR / document extraction | ✓ | ✓ | ✗ |
| AI email assistant | ✓ | ✓ | ✗ |
| AI WhatsApp assistant | ✓ | ✓ | ✗ |

**All AI modules return PROPOSAL only.** Never direct mutation.

## 10. Admin / System

| Action | ADMIN | OPERATOR | WAREHOUSE |
|---|---|---|---|
| Manage users | ✓ (minimum 2 admins invariant) | ✗ | ✗ |
| View audit log | ✓ | ✗ | ✗ |
| Configure dynamic forms | ✓ | ✗ | ✗ |
| Configure dashboard metrics | ✓ | ✗ | ✗ |
| Configure notifications | ✓ | ✗ | ✗ |
| View system alerts | ✓ | ✓ (limited) | ✓ (warehouse-relevant) |

## 11. Enforcement Layer

Permissions are enforced at THREE layers (defense in depth):

1. **API route layer** — `requireRole()` middleware throws 403.
2. **Prisma query layer** — `select` clause strips forbidden fields (e.g., warehouse never selects `price`, `cost`, `margin`).
3. **UI layer** — components don't render forbidden controls (cosmetic only, not authoritative).

The authoritative layers are 1 and 2. Layer 3 is convenience.

## Status

**Permission Matrix: LOCKED.** Proceed to data dictionary.
