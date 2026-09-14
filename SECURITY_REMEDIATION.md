# Security Remediation Report — Arm Roll ERP/CRM

Generated: 2026-09-14
Scope: `D:\metal` (current working tree). External provider actions are listed in `SECRET_ROTATION_REQUIRED.md`.

> **No secrets are included in this report.** All values are masked with `<REDACTED>`.

---

## Baseline (before remediation)

| Check | Before |
|---|---|
| TypeScript errors | 19 |
| ESLint errors | 1 (after cleanup) |
| Tests | 67 pass / 1 fail |
| Production build | passed (with `ignoreBuildErrors: true`) |
| npm audit (prod) | 24 vulnerabilities (2 critical, 14 high) |
| Hardcoded secrets in tree | yes (NEXTAUTH_SECRET, DB URL, passwords) |
| `new Function` in untrusted path | yes (BOM DSL condition evaluator) |
| Authorization | role-only, no object-level scoping |
| Assistant RBAC | none — WAREHOUSE could read CRM/finance |
| Receipts | stored under `public/uploads` |
| Caddy | SSRF via `XTransformPort` query param |

---

## Findings & Fixes

### P0-1 NEXTAUTH_SECRET hardcoded
- **Severity:** Critical
- **Root cause:** `vercel.json` and `src/lib/auth.ts` contained `dev-secret-change-in-production` as a fallback.
- **Files:** `vercel.json`, `src/lib/auth.ts`
- **Fix:** Removed hardcoded value from `vercel.json`. Created `src/lib/env.ts` with `getNextAuthSecret()` that throws in production when missing and generates an ephemeral per-process secret in dev. `auth.ts` now resolves the secret via this helper (getter, fail-closed).
- **Tests:** Manual — production server without `NEXTAUTH_SECRET` returns 500 on `/api/auth/session` with the expected error; with the secret set, returns 200.
- **Status:** FIXED

### P0-2 Plaintext credentials in scripts/markdown
- **Severity:** Critical
- **Root cause:** `scripts/create-admin.ts`, `scripts/reset-passwords.ts`, `scripts/seed.ts`, `worklog.md` contained plaintext passwords and DB URLs.
- **Files:** `scripts/create-admin.ts`, `scripts/reset-passwords.ts`, `scripts/seed.ts`, `worklog.md`
- **Fix:** Rewrote `create-admin.ts` and `reset-passwords.ts` to source passwords from env vars (`ADMIN_PASSWORD`, etc.) or generate cryptographically secure random passwords (printed once). `seed.ts` uses `SEED_*_PASSWORD` env vars or generates. Redacted all leaked values in `worklog.md` with `<REDACTED>`.
- **Tests:** `grep` for known leaked values in working tree returns 0 matches (excluding removed lines in diffs).
- **Status:** FIXED

### P0-3 `db/custom.db` tracked in git
- **Severity:** High
- **Root cause:** Local SQLite snapshot was committed.
- **Files:** `db/custom.db`, `.gitignore`
- **Fix:** `git rm --cached db/custom.db`. Added `db/*.db` and `var/` to `.gitignore`. Created `.env.example` template.
- **Status:** FIXED

### P0-4 Caddy SSRF via `XTransformPort`
- **Severity:** High
- **Root cause:** `Caddyfile` allowed `?XTransformPort=<n>` to proxy to arbitrary localhost ports.
- **Files:** `Caddyfile`
- **Fix:** Removed the `@transform_port_query` matcher; fixed upstream `localhost:3000`.
- **Status:** FIXED

### P1-1 Centralized authorization layer
- **Severity:** High
- **Root cause:** Each route called `requireAction`/`requireRole` from `rbac.ts` with no object-level scoping. IDOR was possible.
- **Files:** `src/lib/authz.ts` (new), `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts`, `src/app/api/payments/route.ts`, `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`, `src/app/api/procurement/[id]/route.ts`, `src/app/api/assistant/route.ts`, `src/app/api/users/route.ts`
- **Fix:** Created `src/lib/authz.ts` with `requirePermission`, `requireRole`, `getAuthContext` (live session/active/sessionVersion validation), `scopeOrdersForUser`, `scopeClientsForUser`, `scopePaymentsForUser`, `canAccessOrder`, `canAccessClient`, `canAccessPayment`. Routes now use these helpers.
- **Tests:** `tests/assistant-rbac.test.ts` (9 tests), `tests/order-drafts.test.ts` (21 tests).
- **Status:** FIXED

### P1-2 Session version / JWT revocation
- **Severity:** High
- **Root cause:** JWTs stayed valid for 12h even after disable/role-change/password-reset.
- **Files:** `prisma/schema.prisma`, `supabase/migrations/20260914120000_add_user_session_version.sql`, `src/lib/auth.ts`, `src/lib/authz.ts`, `src/app/api/users/route.ts`, `scripts/reset-passwords.ts`
- **Fix:** Added `User.sessionVersion` (Int, default 0). JWT carries `sessionVersion`. `getAuthContext` compares JWT version against DB; mismatches → 401 `session_stale`. `users` PATCH/DELETE and `reset-passwords.ts` increment the version on disable/password-change/role-change.
- **Status:** FIXED

### P1-3 IDOR — orders/payments/clients object-level auth
- **Severity:** High
- **Root cause:** `GET /api/orders/[id]` returned any order to any authenticated user.
- **Files:** `src/app/api/orders/[id]/route.ts`, `src/app/api/orders/route.ts`, `src/app/api/payments/route.ts`
- **Fix:** `canAccessOrder(ctx, id)` checks createdById / picker assignment for OPERATOR; WAREHOUSE sees only non-DRAFT. List routes apply `scopeOrdersForUser` / `scopePaymentsForUser` at the Prisma `where` layer.
- **Tests:** `tests/order-drafts.test.ts` covers WAREHOUSE denial and OPERATOR scoping.
- **Status:** FIXED

### P1-4 Operator privilege escalation (product price mutation)
- **Severity:** High
- **Root cause:** `PATCH /api/products/[id]` allowed OPERATOR to change `salePrice`.
- **Files:** `src/app/api/products/[id]/route.ts`, `src/app/api/products/route.ts`
- **Fix:** Price changes now require `product.edit` permission (ADMIN). `purchasePrice` is ADMIN-only. The `order.override_price` permission remains the path for operators to override prices at order-entry time (audited).
- **Status:** FIXED

### P1-5 Assistant RBAC scoping
- **Severity:** High
- **Root cause:** `answerQuestion` ignored role — WAREHOUSE could read client phones, debts, revenue, employees, suppliers.
- **Files:** `src/lib/assistant/engine.ts`, `src/app/api/assistant/route.ts`
- **Fix:** `answerQuestion(question, ctx)` now receives the `AuthContext`. Every intent checks `can(role, action)` before querying; financial fields are only included when the role has the matching permission. Queries are scoped at the Prisma layer (not fetch-then-hide).
- **Tests:** `tests/assistant-rbac.test.ts` — 9 adversarial tests (WAREHOUSE denied CRM/finance/employees/suppliers; OPERATOR denied employees; OPERATOR does not see cost/margin; ADMIN sees phones, OPERATOR does not).
- **Status:** FIXED

### P1-6 `new Function` removed from BOM DSL
- **Severity:** High
- **Root cause:** `evaluateCondition` used `new Function(...)` to evaluate user-supplied expressions — arbitrary JS execution.
- **Files:** `src/lib/bom/dsl.ts`
- **Fix:** Replaced with a restricted AST evaluator (`CondParser`). Allowed tokens: identifiers, string/number literals, `== != > < >= <= && || ! ( )`. Forbidden: `constructor`, `prototype`, `__proto__`, `globalThis`, `window`, `document`, `process`, `fetch`, `Function`, property access (`.`), brackets (`[]`), function calls, assignment, statements. Added `validateCondition(expr)` for pre-save validation.
- **Tests:** `tests/dsl-security.test.ts` — 16 tests covering legitimate conditions + all malicious payload classes.
- **Status:** FIXED

### P2-1 Atomic order reservation & oversell prevention
- **Severity:** High
- **Root cause:** Order confirmation reserved stock non-atomically (already fixed in `confirm-draft.ts` prior to this audit, verified).
- **Files:** `src/lib/orders/confirm-draft.ts`, `src/lib/inventory/order-reservations.ts`
- **Fix:** Verified — `confirmDraftOrder` claims the DRAFT via conditional `updateMany`, then `reserveOrderStock` uses `SELECT ... FOR UPDATE` (`lockInventoryProducts`) inside a transaction. Availability is computed from locked movements; over-allocation throws `OrderStockError`.
- **Tests:** `tests/concurrency-oversell.test.ts` — stock=1, two parallel reservations → exactly one wins.
- **Status:** FIXED (verified)

### P2-2 Atomic inventory transfer
- **Severity:** High
- **Root cause:** Transfer movements were created outside the transaction; stock check was a TOCTOU window.
- **Files:** `src/app/api/inventory/transfer/route.ts`
- **Fix:** Entire transfer (record + movements + audit) wrapped in `db.$transaction`. Stock re-validated inside the tx. Positive-integer quantity validation added.
- **Status:** FIXED

### P2-3 Idempotent purchase receiving
- **Severity:** High
- **Root cause:** Receiving was not guarded against duplicate concurrent calls.
- **Files:** `src/app/api/procurement/[id]/route.ts`
- **Fix:** Conditional `updateMany` on status (`REQUESTED|ORDERED|IN_TRANSIT|PARTIALLY_RECEIVED → RECEIVED`). If 0 rows updated, the transaction rolls back (no duplicate movements).
- **Status:** FIXED

### P2-4 Payment validation & overpayment prevention
- **Severity:** High
- **Root cause:** No overpayment check; floating-point money; parallel payments could exceed balance.
- **Files:** `src/app/api/payments/route.ts`
- **Fix:** Amount rounded to integer AMD. Negative/zero/non-finite rejected. Overpayment rejected. Concurrent-payment race guarded with conditional `updateMany` on `paidAmount`.
- **Status:** FIXED

### P2-5 Private receipt storage
- **Severity:** High
- **Root cause:** Receipts were written to `public/uploads/receipts/` (world-readable).
- **Files:** `src/app/api/payments/[id]/receipt/route.ts` (rewritten), `src/app/api/payments/[id]/receipt/file/route.ts` (new), `.gitignore`
- **Fix:** Receipts stored in `var/uploads/receipts/` (private, gitignored). Filename is server-generated (`${id}-${random16}.${ext}`). Download route authenticates + authorizes via `canAccessPayment`; `Cache-Control: private, no-store`.
- **Status:** FIXED

### P2-6 Email/WhatsApp honest status
- **Severity:** Medium
- **Root cause:** Stub mode returned `success: true` — fake SENT.
- **Files:** `src/lib/comms/adapters.ts`, `src/app/api/comms/send/route.ts`, `prisma/schema.prisma` (CommStatus enum)
- **Fix:** Adapters return `NOT_CONFIGURED` when env vars are missing, `FAILED` on error, `SENT` only on confirmed provider send. Route records the honest status and returns HTTP 503 for NOT_CONFIGURED.
- **Status:** FIXED

### P2-7 Next.js / next-auth updated
- **Severity:** Critical
- **Root cause:** next@16.1.3 and next-auth@4.24.13 had critical advisories.
- **Files:** `package.json`, `package-lock.json`
- **Fix:** Updated to `next@16.3.5`, `next-auth@4.24.15`. Prisma kept on stable `^6` (downgraded from an accidental `8.0.0-rc`). `@types/node` reinstalled.
- **Verification:** `npm audit --omit=dev` — 0 critical, 9 total (down from 24/2 critical). Remaining: prisma transitives (fixable only via major bump — deferred), xlsx (no upstream fix).
- **Status:** FIXED (critical eliminated; residuals documented)

### P2-8 TypeScript build checks enabled
- **Severity:** Medium
- **Root cause:** `next.config.mjs` had `typescript.ignoreBuildErrors: true`.
- **Files:** `next.config.mjs`
- **Fix:** Set `ignoreBuildErrors: false` and `eslint.ignoreDuringBuilds: false`. Fixed all 19 pre-existing TS errors (Buffer→Uint8Array, readonly arrays, Skeleton style prop, bwip-js ambient types, seed/transfer typing).
- **Verification:** `npx tsc --noEmit` → 0 errors. `npm run build` → "Compiled successfully".
- **Status:** FIXED

### P2-9 count+1 order number race
- **Severity:** Medium
- **Root cause:** Order number generated as `ORD-{year}-{count+1}` with no collision guard.
- **Files:** `src/app/api/orders/route.ts`
- **Fix:** Seed-based generation with existence check and retry loop (up to 50 attempts). The `number` unique constraint is the real guard.
- **Status:** FIXED

### P2-10 Windows-compatible start
- **Severity:** Low
- **Root cause:** `build` used `cp -r` and `start` used `bun ... | tee` — incompatible with Windows.
- **Files:** `package.json`, `scripts/copy-standalone-assets.mjs` (new)
- **Fix:** `build` uses a cross-platform Node copier. `start` is `node .next/standalone/server.js`. Added `typecheck` and `test` scripts.
- **Status:** FIXED

### P2-11 Accessibility — icon-only buttons
- **Severity:** Low
- **Root cause:** Icon-only buttons had no `aria-label`.
- **Files:** `src/components/operator/dashboard.tsx`, `src/components/shell/notifications-bell.tsx`, `src/components/shell/workspace-shell.tsx`
- **Fix:** Added Armenian `aria-label` to each icon-only button. No visual style change.
- **Status:** FIXED

### P2-12 Secret scanner + CI
- **Severity:** Medium
- **Root cause:** No CI gate, no secret scanning.
- **Files:** `.gitleaks.toml` (new), `.github/workflows/ci.yml` (new)
- **Fix:** Gitleaks config scans for NEXTAUTH_SECRET, connection strings, passwords, API keys, private keys. CI runs typecheck, lint, tests, build, audit, and gitleaks on every push/PR.
- **Status:** FIXED

---

## Acceptance Gate

| Item | Status |
|---|---|
| NEXTAUTH_SECRET absent from repository | ✅ FIXED |
| No production secret fallback | ✅ FIXED |
| Production fail-closed without required secret | ✅ FIXED (verified — 500 without secret) |
| Plaintext passwords removed | ✅ FIXED |
| `custom.db` no longer tracked | ✅ FIXED |
| Secrets removed from current tree | ✅ FIXED |
| Git history remediation prepared | ✅ (instructions in SECRET_ROTATION_REQUIRED.md) |
| External secret rotation marked | ✅ BLOCKED_EXTERNAL |
| Next.js updated to fixed version | ✅ 16.1.3 → 16.3.5 |
| Authorization centralized | ✅ `src/lib/authz.ts` |
| IDOR fixed | ✅ |
| Operator privileges fixed | ✅ |
| Warehouse scope fixed | ✅ |
| Assistant uses RBAC/scope | ✅ |
| `new Function` removed from untrusted path | ✅ |
| Safe DSL works | ✅ (16 tests) |
| Order reservation atomic | ✅ |
| Overselling prevented | ✅ (concurrency test) |
| Inventory transfers atomic | ✅ |
| Negative quantities forbidden | ✅ |
| Purchase receive idempotent | ✅ |
| Payment validation fixed | ✅ |
| Receipts private | ✅ |
| Stale sessions revoked | ✅ sessionVersion |
| Fake delivery success eliminated | ✅ NOT_CONFIGURED |
| Arbitrary Caddy localhost proxy eliminated | ✅ |
| count+1 race fixed | ✅ |
| Meter costing verified | ✅ (existing tests pass) |
| TypeScript 0 errors | ✅ |
| Build type-check enabled | ✅ |
| Lint clean | ✅ (0 errors, 2 pre-existing warnings) |
| Tests pass | ✅ 94/0 |
| Security tests pass | ✅ 25 new tests |
| Concurrency tests pass | ✅ |
| Production build pass | ✅ |
| UI smoke pass | ✅ (login page renders, APIs 401/403 unauth) |
| npm audit repeated | ✅ 0 critical (9 total residual) |
| Secret scan config added | ✅ gitleaks |

---

## Residual Risks

1. **Git history** — secrets exist in prior commits. Rotating credentials (see
   `SECRET_ROTATION_REQUIRED.md`) makes them useless; history rewriting is
   optional and must be coordinated with collaborators.
2. **npm audit residuals** — `prisma` transitive deps (fix requires major
   bump, deferred to avoid breaking changes), `xlsx` (no upstream fix;
   SheetJS CDN version is the documented workaround). Neither is reachable by
   untrusted input in the current app flow (xlsx is used for Excel export of
   DB data by ADMIN).
3. **External provider configuration** — email/WhatsApp return
   `NOT_CONFIGURED` until env vars are set (honest, not a vulnerability).
4. **Supabase connection pool** — uses session pooler (port 5432); under high
   load, EMAXCONNSESSION may occur. Not a security issue; documented in
   `worklog.md`.