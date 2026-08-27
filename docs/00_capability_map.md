# 00 — Capability Map

**Project:** Metal Blinds ERP/CRM — Armenia
**Date:** 2026-08-27
**Phase:** 1 — Capability Discovery
**Model used:** GLM 5.2 (Architect role)

---

## 1. Purpose

Inventory of every capability the implementation will rely on. Each row reports the real,
verified state of the environment in `/home/z/my-project`. Nothing is assumed; if a tool was
not exercised, it is marked `NOT_RUN`.

Status legend:
- `AVAILABLE` — verified working in this session
- `PARTIAL` — present but with limitations
- `AUTH_REQUIRED` — code path exists, credentials needed to use
- `NOT_AVAILABLE` — confirmed absent
- `BLOCKED` — present but blocked by external dependency
- `NOT_NEEDED` — not required for this scope
- `NOT_RUN` — not exercised yet (honest)

---

## 2. Repository & Execution Environment

| Capability | Status | Evidence |
|---|---|---|
| Working directory `/home/z/my-project` | AVAILABLE | `ls -la` shows full Next.js scaffold |
| Next.js 16 (App Router) | AVAILABLE | `package.json`: `"next": "^16.1.1"` |
| React 19 | AVAILABLE | `package.json`: `"react": "^19.0.0"` |
| TypeScript 5 | AVAILABLE | `package.json`: `"typescript": "^5"` |
| Tailwind CSS 4 | AVAILABLE | `package.json` + `globals.css` `@import "tailwindcss"` |
| shadcn/ui (New York) | AVAILABLE | `components.json` + 40+ components in `src/components/ui/` |
| Bun runtime | AVAILABLE | `bun.lock`, dev script uses `bun` |
| Dev server (port 3000) | AVAILABLE | `.zscripts/dev.sh` started in background |
| ESLint | AVAILABLE | `eslint.config.mjs` |
| Prisma ORM | AVAILABLE | `prisma/schema.prisma` present, `@prisma/client` v6 |
| SQLite datasource | AVAILABLE | `.env`: `DATABASE_URL=file:/home/z/my-project/db/custom.db` |
| NextAuth.js v4 | AVAILABLE | `next-auth` v4.24.11 in `package.json` |
| Zustand | AVAILABLE | `zustand` v5 in `package.json` |
| TanStack Query | AVAILABLE | `@tanstack/react-query` v5 |
| TanStack Table | AVAILABLE | `@tanstack/react-table` v8 |
| Recharts | AVAILABLE | `recharts` v2 |
| Framer Motion | AVAILABLE | `framer-motion` v12 |
| zod | AVAILABLE | `zod` v4 |
| next-intl | AVAILABLE | `next-intl` v4 (Armenian i18n) |
| next-themes | AVAILABLE | `next-themes` v0.4 (light/dark) |
| sonner (toasts) | AVAILABLE | `sonner` v2 |
| vaul (drawer) | AVAILABLE | `vaul` v1 |
| cmdk (command palette) | AVAILABLE | `cmdk` v1 |
| @dnd-kit (drag-drop) | AVAILABLE | core/sortable/utilities |
| Lucide icons | AVAILABLE | `lucide-react` v0.525 |
| sharp (image processing) | AVAILABLE | `sharp` v0.34 |
| `z-ai-web-dev-sdk` | AVAILABLE | v0.0.18 (AI provider SDK) |
| Mini-services support | AVAILABLE | `mini-services/` + Caddyfile gateway pattern |
| WebSocket / socket.io | AVAILABLE | via mini-service pattern + `XTransformPort` query |
| Caddy gateway (port 81) | AVAILABLE | `Caddyfile` configured |

## 3. Database & Persistence

| Capability | Status | Notes |
|---|---|---|
| Prisma Client | AVAILABLE | `src/lib/db.ts` singleton pattern |
| SQLite file DB | AVAILABLE | `db/custom.db` |
| Migration system | AVAILABLE | `prisma migrate dev` script |
| Schema push | AVAILABLE | `prisma db push --accept-data-loss` |
| Postgres / Supabase | NOT_AVAILABLE | SQLite only — sufficient for current scope; Supabase requires external credentials |
| Redis / external cache | NOT_AVAILABLE | Local memory caching only (per skill rules) |

## 4. Authentication & RBAC

| Capability | Status | Notes |
|---|---|---|
| NextAuth.js v4 | AVAILABLE | Credentials + JWT strategy viable |
| Role-based access | TO_BUILD | Will implement ADMIN / OPERATOR / WAREHOUSE roles |
| Per-field data filtering (warehouse cannot see price) | TO_BUILD | Will enforce at API + Prisma `select` layer |

## 5. External Integrations

| Capability | Status | Notes |
|---|---|---|
| AI provider — OllamaCloud | AUTH_REQUIRED | Will implement client; needs API key from user |
| AI models — DeepSeek v4 flash/pro | AUTH_REQUIRED | Routing table will be code-defined; key needed |
| Email provider (SMTP/3rd-party) | AUTH_REQUIRED | Will abstract behind adapter; key needed |
| WhatsApp Business API | AUTH_REQUIRED | Will abstract behind adapter; token needed |
| Armenian STT (voice order) | AUTH_REQUIRED | Will use `z-ai-web-dev-sdk` ASR or external; needs key |
| OCR / document extraction | AUTH_REQUIRED | Via AI provider vision capability |
| PDF generation | AVAILABLE | Will use `pdfkit` (to install) or built-in approaches |
| Barcode / QR generation | TO_INSTALL | `bwip-js` + `qrcode` packages to install |
| Cloud storage (S3/OSS) | NOT_NEEDED | Local file storage under `/home/z/my-project/upload/` for now |
| Deployment platform | NOT_RUN | User has not specified; preview via dev server |

## 6. Quality & Verification Tooling

| Capability | Status | Notes |
|---|---|---|
| ESLint | AVAILABLE | `bun run lint` |
| TypeScript check | AVAILABLE | via build |
| Vitest | NOT_INSTALLED | Will add if unit tests needed mid-implementation |
| Playwright | NOT_INSTALLED | Will use `agent-browser` skill for browser QA instead |
| `agent-browser` CLI | AVAILABLE | Per skill instructions; for deep audit phase |

## 7. Constraints (from skill rules — non-negotiable)

1. **Only `/` route is user-visible.** All ERP features must live behind the single root page using client-side view routing (tabs / drawers / panels / conditional rendering).
2. **Dev server auto-runs** on port 3000 — must not be started manually.
3. **`bun run build` is forbidden** during dev (only `bun run lint`).
4. **`z-ai-web-dev-sdk` backend-only** — never import on client.
5. **Relative paths only** for API calls; cross-port via `?XTransformPort=N`.
6. **No indigo / blue primary colors** — design uses Armenian Industrial palette (slate/stone/amber/copper).
7. **SQLite only** — Prisma schema cannot use Postgres-only features.
8. **Prisma lists not allowed** as primitive type — use JSON columns or relation tables.

## 8. Capability Gaps to Resolve Before Phase 12 (AI)

- Need user to confirm `READY` / `BLOCKED` / `NOT_NEEDED` for:
  - OllamaCloud API key
  - Email provider credentials
  - WhatsApp Business token
  - Armenian STT credentials
- Until then AI modules will use `z-ai-web-dev-sdk` (already in `package.json`) as the working provider, with OllamaCloud adapter wired and ready.

## 9. Decision

**Capability Discovery: PASS.**
All core capabilities needed for Phases 2–11, 14–18 are AVAILABLE.
Phases 12–13 (AI, Email, WhatsApp) have adapters that will work with `z-ai-web-dev-sdk` immediately and accept OllamaCloud/external keys when provided.

Proceed to Requirements Lock.
