# 02 — Analog Research + Product Blueprint

**Project:** Metal Blinds ERP/CRM — Armenia
**Phase:** 2
**Model:** GLM 5.2 (Architect) for reasoning, design directions

---

## A. Analog Research

Study of comparable systems for visual + functional vocabulary. None copied directly — used as inspiration only.

| Analog | What we take | What we reject |
|---|---|---|
| Linear (linear.app) | Dense tables, keyboard-first command palette, dense-but-clean typography | Pure dark mode default, indigo accent |
| Notion | Document-centric feel, callout blocks, inline edits | Generic rounded cards, casual tone |
| Stripe Dashboard | Premium number typography, status pills with clear states, restrained color | Blue/gradient brand colors |
| SAP Fiori | Industrial B2B density, role-based workspaces, table-heavy data views | Aged visual style, low contrast |
| Dynamics 365 | Module breadth, finance module rigor | Cluttered IA, dated chrome |
| Katana MRP | Manufacturing BOM clarity, production flow | None — too narrow scope |
| Bitrix24 CRM | Multi-channel comms, client timeline | Visual noise, generic icons |
| Vtex / Shopify Admin | Order→fulfillment clarity, status indicators | E-commerce consumer feel |
| Local Armenian ERP UIs (1C, Odoo-based) | Right-to-left-aware density, RTL/i18n lessons | Visual austerity, dated fonts |

### Visual vocabulary harvested
- **Status pills** with semantic background tints (green / amber / orange / red / dark)
- **Numeric cells** right-aligned, tabular figures, AMD currency suffix
- **Tables** with sticky header, row hover, zebra optional, inline edit
- **Drawers** for create/edit (not modals where possible)
- **Command palette** (cmdk) for global search and quick actions
- **Detail panels** slide-in from right
- **Inline statuses** with icon + label, not just colored dots
- **Density modes**: comfortable / compact (admin choice)

### What we explicitly reject
- Gradient hero sections
- Glassmorphism cards
- Excessive border radius (everything rounded)
- Decorative animations
- Sci-fi / cockpit UI
- Fake charts with no data
- Indigo / blue primary brand

---

## B. Product Blueprint

### B.1 Information Architecture (single route `/`)

Because the sandbox exposes only one route, the entire app lives at `/` with a role-detected shell.

```
/  (auth gate)
 ├─ auth screen (if not logged in)
 └─ workspace shell (role-detected)
     ├─ ADMIN shell
     │   ├─ Dashboard (KPI grid + alerts + recent activity)
     │   ├─ Clients (individuals + companies)
     │   ├─ Orders (list + detail drawer)
     │   ├─ Warehouse (inventory ledger + movements + picking tasks)
     │   ├─ Procurement (purchase requests + POs + suppliers)
     │   ├─ Products (catalog + BOM + units + categories)
     │   ├─ Finance (payments + debts + profit)
     │   ├─ Loyalty (tiers + rules + overrides)
     │   ├─ Tax Engine (rules + versions + statuses)
     │   ├─ Documents (templates + generated)
     │   ├─ Communications (email + WhatsApp log)
     │   ├─ AI Center (9 modules)
     │   ├─ Dynamic Forms (form builder)
     │   ├─ Reports
     │   ├─ Users (RBAC + audit log)
     │   └─ Settings
     ├─ OPERATOR shell
     │   ├─ Dashboard (focused)
     │   ├─ Clients (create/edit permitted fields)
     │   ├─ Orders (create/edit)
     │   ├─ Communications (email/WhatsApp draft+send)
     │   ├─ AI tools (limited)
     │   └─ Search
     └─ WAREHOUSE shell
         ├─ Dashboard (picks, shortages, low stock)
         ├─ Pick tasks (queue + scan + confirm)
         ├─ Inventory movements
         └─ Returns
```

Navigation between shells: tabbed sidebar, top command palette (Cmd+K), breadcrumb.

### B.2 Key Workflows

**Operator creates an order:**
1. Open `Orders` → `+ New`
2. Select / create client
3. Add item → pick product → enter dynamic parameters (width, height, qty, color, motor…)
4. System calculates price (BOM-driven) → shows sale price + auto-discount
5. Reserve stock → create warehouse task
6. Generate customer PDF + warehouse PDF (no prices)
7. Optional: AI-drafted email / WhatsApp message
8. Submit → order persisted → audit logged

**Warehouse picks:**
1. Dashboard shows pending picks
2. Open pick → scan barcode/QR
3. Confirm items → movement ISSUE
4. If shortage: report → triggers procurement recommendation
5. Mark ready → notify operator

**Admin audits:**
1. Open `Users / Audit Log`
2. Filter by user, action type, date
3. See full trace (who, when, what, before/after)

### B.3 Module Dependency Order (build sequence)

```
5  Auth/RBAC
 ↓
6  Dynamic Forms (foundation for all entities)
 ↓
7  Products/Suppliers/Procurement
 ↓
8  Orders/BOM/Inventory
 ↓
9  Finance/Debt/Loyalty/Profit
 ↓
10 Tax Engine
 ↓
11 Documents
 ↓
12 AI Layer
 ↓
13 Email/WhatsApp
 ↓
14 Design System polish
 ↓
15-17 Workspaces
 ↓
18 i18n/Mobile/A11y
 ↓
19 Security/Audit
 ↓
20 Release Gate
```

---

## C. Three Design Directions

Three concrete, executable directions. After review, **Direction B** is selected as the primary, with selective elements from A and C integrated.

### Direction A — "Tuff & Copper"
- **Palette:** warm stone neutrals (oklch 0.96 / 0.92 / 0.86), deep tuff rose accent (oklch 0.55 0.13 25), copper highlights (oklch 0.65 0.15 65)
- **Typography:** Noto Serif Armenian for headings (gravitas), Noto Sans Armenian for body, tabular numerals
- **Surfaces:** matte, low-sheen, subtle paper grain on cards
- **Corners:** 4px on inputs/buttons, 8px on cards, 0px on tables (sharp grid)
- **Shadows:** very subtle, single-layer, warm tint
- **Status colors:** deep emerald (oklch 0.55 0.13 145), amber (oklch 0.7 0.16 75), terracotta (oklch 0.6 0.18 35), deep red (oklch 0.5 0.2 25)
- **Mood:** heritage, weight, craftsmanship
- **Pros:** distinctly Armenian, premium, memorable
- **Cons:** can feel heavy; needs careful contrast tuning

### Direction B — "Industrial Precision" ← SELECTED
- **Palette:** cool graphite neutrals (oklch 0.98 / 0.94 / 0.20 background-to-text), single steel accent (oklch 0.45 0.02 240), copper for highlights on critical actions (oklch 0.65 0.13 65)
- **Typography:** Noto Sans Armenian for everything (one family, weights 400/500/600/700), Inter for Latin/numerals fallback, tabular figures mandatory
- **Surfaces:** clean, no grain, subtle 1px borders, single hairline dividers
- **Corners:** 6px on inputs/buttons, 8px on cards, 0px on tables and status bars
- **Shadows:** none by default; elevation via border contrast + subtle 1px tint
- **Status colors:** emerald (oklch 0.55 0.14 150), amber (oklch 0.7 0.16 75), orange (oklch 0.65 0.17 50), red (oklch 0.55 0.22 25), slate for neutral
- **Mood:** precise, confident, industrial, no-nonsense
- **Pros:** dense data clarity, premium without being heavy, excellent for tables, scale-tested for Armenian long labels
- **Cons:** needs careful hierarchy or it feels austere — solved with strong type scale + accent color use

### Direction C — "Modern Armenian Editorial"
- **Palette:** cream paper (oklch 0.97 0.01 90), deep ink text (oklch 0.18 0.01 240), single saturated accent (pomegranate oklch 0.55 0.2 25)
- **Typography:** Playfair-like serif for headings, sans for body, numerals in mono
- **Surfaces:** paper-like, generous whitespace
- **Corners:** 12px on cards, 8px on inputs
- **Mood:** editorial, magazine-like
- **Pros:** beautiful, distinctive
- **Cons:** not dense enough for ERP data — better for marketing site

### Final direction (locked)
**Industrial Precision (B)** as the base, with one selective element from A: **copper accent on critical CTAs and the loyalty-tier badge** — gives Armenian warmth without compromising density.

---

## D. Status

**Phase 2 artifacts:**
- `docs/02_analog_research.md` (this file)
- `docs/02_product_blueprint.md` (this file)
- Design direction locked: **Industrial Precision + copper accent**

**Phase 2: PASS.** Proceed to PHASE 3.
