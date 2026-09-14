/**
 * Centralized authorization layer.
 *
 * Actor identity is derived ONLY from the authenticated session.
 * NEVER trust body.role / body.userId / query.userId from the client.
 *
 * This module wraps the rbac matrix with:
 *   - live session/active/sessionVersion validation (stale JWT detection)
 *   - object-level scoping (orders/clients/payments)
 *   - consistent NextResponse error shapes (401/403/404/409)
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, type AppRole } from "@/lib/auth";
import { can as canMatrix, type Action } from "@/lib/rbac";
import { db } from "@/lib/db";

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

export interface AuthContext {
  userId: string;
  role: AppRole;
  email: string;
  sessionVersion: number;
}

/**
 * Resolve the authenticated actor and verify the session is still fresh.
 * Throws an AuthError-shaped NextResponse on failure.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as AppRole | undefined;
  const sessionVersion = ((session?.user as any)?.sessionVersion as number | undefined) ?? 0;

  if (!session || !userId || !role) {
    throw jsonError(401, "unauthenticated", "Authentication required");
  }

  // Live check: confirm the user is still active and the JWT version matches.
  // This prevents stale JWTs (role/disabled/password-changed) from authorizing.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { active: true, sessionVersion: true, role: true },
  });
  if (!user || !user.active) {
    throw jsonError(401, "session_revoked", "Session no longer valid");
  }
  if (user.sessionVersion !== sessionVersion) {
    throw jsonError(401, "session_stale", "Session outdated — please re-authenticate");
  }
  // Defensive: if role in DB differs from JWT, trust DB and force re-auth.
  if (user.role !== role) {
    throw jsonError(401, "role_changed", "Role changed — please re-authenticate");
  }

  return { userId, role, email: (session.user as any).email ?? "", sessionVersion };
}

export async function requireAuthenticatedUser(): Promise<AuthContext> {
  return getAuthContext();
}

export async function requireActiveUser(): Promise<AuthContext> {
  return getAuthContext();
}

export async function requireRole(...allowed: AppRole[]): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!allowed.includes(ctx.role)) {
    throw jsonError(403, "forbidden", "Insufficient role");
  }
  return ctx;
}

export async function requirePermission(action: Action): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!canMatrix(ctx.role, action)) {
    throw jsonError(403, "forbidden", `Missing permission: ${action}`);
  }
  return ctx;
}

// =============================================================
// Object-level scoping
// =============================================================

/**
 * Returns a Prisma `where` filter that limits orders to those visible to the actor.
 * - ADMIN: all orders
 * - OPERATOR: orders they created OR that have at least one item assigned to them as picker
 * - WAREHOUSE: orders in non-DRAFT status (they fulfill picks; no financial details are returned)
 */
export function scopeOrdersForUser(ctx: AuthContext): Record<string, unknown> {
  if (ctx.role === "ADMIN") return {};
  if (ctx.role === "OPERATOR") {
    return {
      OR: [
        { createdById: ctx.userId },
        // Orders where this user is the picker for at least one line.
        { items: { some: { pickedById: ctx.userId } } },
      ],
    };
  }
  // WAREHOUSE — only non-draft orders they can pick.
  return { status: { not: "DRAFT" } };
}

/**
 * Returns a Prisma `where` filter for clients visible to the actor.
 * - ADMIN: all clients
 * - OPERATOR: clients who placed orders created by this operator OR all active clients
 *   (business decision: operators create orders and need to pick clients; we keep it permissive
 *    for client *listing* but strictly enforce financial masking at the API layer)
 * - WAREHOUSE: no direct client access — callers MUST reject before reaching DB.
 *   Returns an impossible filter as defense in depth.
 */
export function scopeClientsForUser(ctx: AuthContext): Record<string, unknown> {
  if (ctx.role === "ADMIN") return {};
  if (ctx.role === "OPERATOR") return { active: true, archivedAt: null };
  return { id: "__NO_ACCESS__" };
}

/**
 * Returns a Prisma `where` filter for payments visible to the actor.
 * - ADMIN: all payments
 * - OPERATOR: payments on orders they created
 * - WAREHOUSE: no access (returns impossible filter)
 */
export function scopePaymentsForUser(ctx: AuthContext): Record<string, unknown> {
  if (ctx.role === "ADMIN") return {};
  if (ctx.role === "OPERATOR") {
    return { order: { createdById: ctx.userId } };
  }
  return { id: "__NO_ACCESS__" };
}

// =============================================================
// Object-level access checks
// =============================================================

export async function canAccessOrder(ctx: AuthContext, orderId: string): Promise<boolean> {
  if (ctx.role === "ADMIN") return true;
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, items: { select: { pickedById: true } } },
  });
  if (!order) return false;
  if (ctx.role === "OPERATOR") {
    return order.createdById === ctx.userId || order.items.some((it) => it.pickedById === ctx.userId);
  }
  // WAREHOUSE: any non-DRAFT order (status filtered upstream) is accessible for fulfillment.
  return true;
}

export async function canAccessClient(ctx: AuthContext, clientId: string): Promise<boolean> {
  if (ctx.role === "ADMIN") return true;
  if (ctx.role === "OPERATOR") {
    // Operators may access active clients (for order creation).
    const c = await db.client.findUnique({ where: { id: clientId }, select: { active: true, archivedAt: true } });
    return !!c && c.active && !c.archivedAt;
  }
  return false;
}

export async function canAccessPayment(ctx: AuthContext, paymentId: string): Promise<boolean> {
  if (ctx.role === "ADMIN") return true;
  if (ctx.role === "OPERATOR") {
    const p = await db.orderPayment.findUnique({
      where: { id: paymentId },
      select: { order: { select: { createdById: true } } },
    });
    return !!p && p.order.createdById === ctx.userId;
  }
  return false;
}

// =============================================================
// Field masking
// =============================================================

const WAREHOUSE_FORBIDDEN_FIELDS = [
  "salePrice", "purchasePrice", "costAmount", "grossProfit", "marginPercent",
  "baseAmount", "discountAmount", "taxAmount", "totalAmount", "paidAmount",
  "outstandingAmount", "unitPriceSnapshot", "lineTotal", "bankingDetails", "creditLimit",
] as const;

export function stripForbiddenForWarehouse<T extends Record<string, any>>(obj: T, role: AppRole | undefined): T {
  if (role !== "WAREHOUSE") return obj;
  const out: any = { ...obj };
  for (const f of WAREHOUSE_FORBIDDEN_FIELDS) {
    if (f in out) delete out[f];
  }
  return out;
}