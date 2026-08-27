import { getServerSession } from "next-auth";
import { authOptions, type AppRole } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Permission matrix — see docs/03_permission_matrix.md
 * Authoritative enforcement at API + Prisma layer.
 */

export type Action =
  // clients
  | "client.list" | "client.create" | "client.view_finance" | "client.set_credit_limit" | "client.archive"
  // orders
  | "order.list" | "order.create" | "order.view_price" | "order.view_cost" | "order.override_price"
  | "order.override_discount" | "order.confirm" | "order.cancel" | "order.mark_ready"
  // inventory
  | "inventory.view_on_hand" | "inventory.view_reserved" | "inventory.view_history"
  | "inventory.issue" | "inventory.return" | "inventory.write_off" | "inventory.adjust" | "inventory.set_min_stock"
  // products
  | "product.list" | "product.view_sale_price" | "product.view_purchase_price" | "product.create" | "product.edit" | "product.archive"
  | "product.manage_units" | "product.manage_categories" | "product.manage_bom"
  // procurement
  | "procurement.create_request" | "procurement.approve_request" | "procurement.create_po" | "procurement.receive_po"
  | "procurement.view_purchase_history" | "procurement.manage_suppliers"
  // finance
  | "finance.view_payments" | "finance.record_payment" | "finance.view_debt" | "finance.view_profit"
  | "finance.manage_loyalty" | "finance.override_loyalty"
  // tax
  | "tax.view" | "tax.create" | "tax.edit" | "tax.retire"
  // documents
  | "doc.view_templates" | "doc.edit_templates" | "doc.generate" | "doc.send"
  // ai
  | "ai.voice_order" | "ai.order_validation" | "ai.ask_business" | "ai.inventory_forecast"
  | "ai.debt_assistant" | "ai.price_margin" | "ai.ocr" | "ai.email_assistant" | "ai.whatsapp_assistant"
  // admin
  | "admin.manage_users" | "admin.view_audit" | "admin.manage_forms" | "admin.manage_metrics" | "admin.manage_notifications";

const MATRIX: Record<AppRole, Partial<Record<Action, boolean>>> = {
  ADMIN: {
    "client.list": true, "client.create": true, "client.view_finance": true,
    "client.set_credit_limit": true, "client.archive": true,
    "order.list": true, "order.create": true, "order.view_price": true, "order.view_cost": true,
    "order.override_price": true, "order.override_discount": true, "order.confirm": true,
    "order.cancel": true, "order.mark_ready": true,
    "inventory.view_on_hand": true, "inventory.view_reserved": true, "inventory.view_history": true,
    "inventory.issue": true, "inventory.return": true, "inventory.write_off": true,
    "inventory.adjust": true, "inventory.set_min_stock": true,
    "product.list": true, "product.view_sale_price": true, "product.view_purchase_price": true,
    "product.create": true, "product.edit": true, "product.archive": true,
    "product.manage_units": true, "product.manage_categories": true, "product.manage_bom": true,
    "procurement.create_request": true, "procurement.approve_request": true, "procurement.create_po": true,
    "procurement.receive_po": true, "procurement.view_purchase_history": true, "procurement.manage_suppliers": true,
    "finance.view_payments": true, "finance.record_payment": true, "finance.view_debt": true,
    "finance.view_profit": true, "finance.manage_loyalty": true, "finance.override_loyalty": true,
    "tax.view": true, "tax.create": true, "tax.edit": true, "tax.retire": true,
    "doc.view_templates": true, "doc.edit_templates": true, "doc.generate": true, "doc.send": true,
    "ai.voice_order": true, "ai.order_validation": true, "ai.ask_business": true,
    "ai.inventory_forecast": true, "ai.debt_assistant": true, "ai.price_margin": true,
    "ai.ocr": true, "ai.email_assistant": true, "ai.whatsapp_assistant": true,
    "admin.manage_users": true, "admin.view_audit": true, "admin.manage_forms": true,
    "admin.manage_metrics": true, "admin.manage_notifications": true,
  },
  OPERATOR: {
    "client.list": true, "client.create": true,
    "order.list": true, "order.create": true, "order.view_price": true,
    "order.confirm": true, "order.cancel": true, "order.mark_ready": true,
    "inventory.view_on_hand": false,
    "product.list": true, "product.view_sale_price": true,
    "procurement.create_request": true,
    "finance.view_payments": true, "finance.record_payment": true, "finance.view_debt": true,
    "doc.view_templates": true, "doc.generate": true, "doc.send": true,
    "ai.voice_order": true, "ai.order_validation": true, "ai.ask_business": true,
    "ai.debt_assistant": true, "ai.ocr": true, "ai.email_assistant": true, "ai.whatsapp_assistant": true,
  },
  WAREHOUSE: {
    "order.list": true, // limited to assigned picks
    "inventory.view_on_hand": true, "inventory.view_reserved": true, "inventory.view_history": true,
    "inventory.issue": true, "inventory.return": true, "inventory.write_off": true,
    "procurement.receive_po": true,
    "product.list": true, // no prices
    "doc.generate": true, // warehouse docs only
    "procurement.create_request": true,
  },
};

export function can(role: AppRole | undefined | null, action: Action): boolean {
  if (!role) return false;
  return MATRIX[role]?.[action] === true;
}

export async function requireRole(...allowed: AppRole[]) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as AppRole | undefined;
  if (!session || !role || !allowed.includes(role)) {
    throw new NextResponse(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return { session, role, userId: (session.user as any).id as string };
}

export async function requireAction(action: Action) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as AppRole | undefined;
  if (!session || !role || !can(role, action)) {
    throw new NextResponse(JSON.stringify({ error: "forbidden", action }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return { session, role, userId: (session.user as any).id as string };
}

/**
 * Field-level masking for warehouse role.
 * NEVER include salePrice, purchasePrice, costAmount, grossProfit, marginPercent, etc.
 */
export const WAREHOUSE_FORBIDDEN_FIELDS = [
  "salePrice", "purchasePrice", "costAmount", "grossProfit", "marginPercent",
  "baseAmount", "discountAmount", "taxAmount", "totalAmount", "paidAmount",
  "outstandingAmount", "unitPriceSnapshot", "lineTotal",
] as const;

export function stripForbiddenForWarehouse<T extends Record<string, any>>(
  obj: T,
  role: AppRole | undefined
): T {
  if (role !== "WAREHOUSE") return obj;
  const out: any = { ...obj };
  for (const f of WAREHOUSE_FORBIDDEN_FIELDS) {
    if (f in out) delete out[f];
  }
  return out;
}
