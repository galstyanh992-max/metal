/**
 * Assistant engine — deterministic, DB-grounded Q&A.
 * No external LLM required. Reads live Supabase data via Prisma.
 * Answers in Armenian.
 */

import { db } from "@/lib/db";
import {
  PROJECT_OVERVIEW,
  ROLES,
  MODULES,
  ORDER_STATUSES,
  CLIENT_STATUSES,
  DOCUMENT_TYPES,
  HELP_TEXT,
} from "./knowledge";

const fmt = (n: number) => new Intl.NumberFormat("hy-AM").format(Math.round(n || 0));
const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("hy-AM") : "—";

function clientName(c: any): string {
  return c.type === "COMPANY"
    ? c.companyName ?? "—"
    : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
}

export interface AssistantReply {
  text: string;
  data?: any;
}

export async function answerQuestion(question: string): Promise<AssistantReply> {
  const q = question.toLowerCase().trim();

  // ---- Greetings / help ----
  if (/^(բարև|ողջույն|հայ|hi|hello|բարեւ)/.test(q)) {
    return { text: "Բարև ձեզ։ Ես Arm Roll ERP/CRM համակարգի օգնականն եմ։ Ինչպե՞ս կարող եմ օգնել։" };
  }
  if (/օգն|help|ինչ կարող|ինչ հարց/.test(q)) {
    return { text: HELP_TEXT };
  }
  if (/ինչ է|նկարագր|about|project|նախագիծ/.test(q)) {
    return {
      text: `${PROJECT_OVERVIEW.name} — ${PROJECT_OVERVIEW.description}\nՏեխնոլոգիաներ՝ ${PROJECT_OVERVIEW.stack}։`,
    };
  }

  // ---- Modules / sections ----
  if (/բաժին|մոդուլ|սեկցիա|ինչ կա|հատված/.test(q)) {
    const lines = MODULES.map((m) => `• ${m.label} — ${m.description}`).join("\n");
    return { text: `Համակարգի բաժինները՝\n${lines}` };
  }

  // ---- Roles ----
  if (/դեր|ռոլ|ադմին|օպերատոր|պահեստ/.test(q)) {
    const lines = Object.entries(ROLES).map(([k, v]) => `• ${k} — ${v}`).join("\n");
    return { text: `Դերերը համակարգում՝\n${lines}` };
  }

  // ---- Clients ----
  if (/հաճախորդ|client|հաճախորդներ/.test(q)) {
    const count = await db.client.count({ where: { active: true, archivedAt: null } });
    if (/քանի|թիվ|count/.test(q)) {
      return { text: `Համակարգում կա ${count} ակտիվ հաճախորդ։` };
    }
    // Search by name
    const nameMatch = q.match(/հաճախորդ[ին]?\s+([ա-ֆԱ-Ֆa-zA-Z]+)/);
    if (nameMatch) {
      const term = nameMatch[1];
      const clients = await db.client.findMany({
        where: {
          active: true,
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            { companyName: { contains: term, mode: "insensitive" } },
          ],
        },
        take: 5,
        include: { orders: { select: { outstandingAmount: true } } },
      });
      if (clients.length === 0) {
        return { text: `«${term}» անունով հաճախորդ չգտնվեց։` };
      }
      const lines = clients.map((c) => {
        const debt = c.orders.reduce((s, o) => s + o.outstandingAmount, 0);
        return `• ${clientName(c)} — ${c.phone}${debt > 0 ? `, պարտք՝ ${fmt(debt)} դր` : ""}`;
      }).join("\n");
      return { text: `Գտնված հաճախորդներ՝\n${lines}` };
    }
    const clients = await db.client.findMany({
      where: { active: true, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const lines = clients.map((c) => `• ${clientName(c)} — ${c.phone}`).join("\n");
    return { text: `Վերջին հաճախորդները (${count} ընդհանուր)՝\n${lines}` };
  }

  // ---- Orders ----
  if (/պատվեր|order/.test(q)) {
    const count = await db.order.count();
    if (/քանի|թիվ|count/.test(q)) {
      return { text: `Համակարգում կա ${count} պատվեր։` };
    }
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { client: true },
    });
    if (orders.length === 0) return { text: "Պատվերներ դեռ չկան։" };
    const lines = orders.map((o) => {
      const name = o.client ? clientName(o.client) : "—";
      return `• ${o.number} — ${name}, ${ORDER_STATUSES[o.status] ?? o.status}, ${fmt(o.totalAmount)} դր (${fmtDate(o.createdAt)})`;
    }).join("\n");
    return { text: `Վերջին պատվերները (${count} ընդհանուր)՝\n${lines}` };
  }

  // ---- Products ----
  if (/ապրանք|product|sku/.test(q)) {
    const count = await db.product.count({ where: { active: true, archivedAt: null } });
    if (/քանի|թիվ|count/.test(q)) {
      return { text: `Կատալոգում կա ${count} ակտիվ ապրանք։` };
    }
    if (/ցածր|մնացորդ|low/.test(q)) {
      const products = await db.product.findMany({
        where: { active: true, archivedAt: null },
        include: { inventorySnapshots: true, unit: true },
      });
      const low = products
        .map((p) => ({
          name: p.name,
          sku: p.sku,
          onHand: p.inventorySnapshots.reduce((s, i) => s + i.onHand, 0),
          min: p.minStock,
          unit: p.unit?.symbol ?? "",
        }))
        .filter((p) => p.onHand <= p.min)
        .slice(0, 10);
      if (low.length === 0) return { text: "Ցածր մնացորդով ապրանքներ չկան։" };
      const lines = low.map((p) => `• ${p.name} (${p.sku}) — ${p.onHand} ${p.unit}, նվազագույնը՝ ${p.min}`).join("\n");
      return { text: `Ցածր մնացորդով ապրանքներ՝\n${lines}` };
    }
    const products = await db.product.findMany({
      where: { active: true, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { unit: true },
    });
    const lines = products.map((p) => `• ${p.name} (${p.sku}) — ${fmt(p.salePrice)} դր/${p.unit?.symbol ?? "հատ"}`).join("\n");
    return { text: `Վերջին ապրանքները (${count} ընդհանուր)՝\n${lines}` };
  }

  // ---- Inventory ----
  if (/պահեստ|մնացորդ|inventory|stock/.test(q)) {
    const snapshots = await db.inventorySnapshot.findMany({
      include: { product: { include: { unit: true } } },
    });
    const totalOnHand = snapshots.reduce((s, i) => s + i.onHand, 0);
    const totalReserved = snapshots.reduce((s, i) => s + i.reserved, 0);
    const lowCount = snapshots.filter((i) => i.onHand <= i.product.minStock).length;
    return {
      text: `Պահեստի ամփոփում՝\n• Ընդհանուր մնացորդ՝ ${fmt(totalOnHand)} միավոր\n• Ամրագրված՝ ${fmt(totalReserved)}\n• Ցածր մնացորդով ապրանքներ՝ ${lowCount}`,
    };
  }

  // ---- Debts ----
  if (/պարտք|պարտատեր|debt/.test(q)) {
    const clients = await db.client.findMany({
      where: { active: true, archivedAt: null },
      include: { orders: { where: { outstandingAmount: { gt: 0 } } } },
    });
    const debtors = clients
      .map((c) => ({
        name: clientName(c),
        phone: c.phone,
        debt: c.orders.reduce((s, o) => s + o.outstandingAmount, 0),
      }))
      .filter((d) => d.debt > 0)
      .sort((a, b) => b.debt - a.debt);
    const total = debtors.reduce((s, d) => s + d.debt, 0);
    if (/ընդհանուր|գումար|total/.test(q)) {
      return { text: `Ընդհանուր պարտքը՝ ${fmt(total)} դրամ (${debtors.length} պարտատեր)։` };
    }
    if (debtors.length === 0) return { text: "Պարտատերեր չկան 🎉" };
    const lines = debtors.slice(0, 10).map((d) => `• ${d.name} — ${fmt(d.debt)} դր (${d.phone})`).join("\n");
    return { text: `Պարտատերեր (ընդհանուր՝ ${fmt(total)} դր)՝\n${lines}` };
  }

  // ---- Sales ----
  if (/վաճառք|եկամուտ|sales|շրջանառություն/.test(q)) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [todayOrders, monthOrders] = await Promise.all([
      db.order.findMany({ where: { createdAt: { gte: startOfDay }, status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { totalAmount: true } }),
      db.order.findMany({ where: { createdAt: { gte: startOfMonth }, status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { totalAmount: true } }),
    ]);
    const today = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
    const month = monthOrders.reduce((s, o) => s + o.totalAmount, 0);
    return {
      text: `Վաճառք՝\n• Այսօր՝ ${fmt(today)} դր (${todayOrders.length} պատվեր)\n• Այս ամիս՝ ${fmt(month)} դր (${monthOrders.length} պատվեր)`,
    };
  }

  // ---- Suppliers ----
  if (/մատակարար|supplier/.test(q)) {
    const suppliers = await db.supplier.findMany({ where: { active: true }, take: 10 });
    if (suppliers.length === 0) return { text: "Մատակարարներ դեռ չկան։" };
    const lines = suppliers.map((s) => `• ${s.name}${s.phone ? ` — ${s.phone}` : ""}`).join("\n");
    return { text: `Մատակարարներ՝\n${lines}` };
  }

  // ---- Documents ----
  if (/փաստաթուղթ|շաբլոն|document|template/.test(q)) {
    const templates = await db.documentTemplate.findMany({ orderBy: { type: "asc" } });
    if (templates.length === 0) return { text: "Փաստաթղթերի շաբլոններ չկան։" };
    const lines = templates.map((t) => `• ${DOCUMENT_TYPES[t.type] ?? t.type} — v${t.version} (${t.active ? "ակտիվ" : "պասիվ"})`).join("\n");
    return { text: `Փաստաթղթերի շաբլոններ (${templates.length})՝\n${lines}` };
  }

  // ---- Forms ----
  if (/ձև|form|դինամիկ/.test(q)) {
    const templates = await db.formTemplate.findMany({
      include: { groups: { include: { fields: true } } },
    });
    if (templates.length === 0) return { text: "Դինամիկ ձևեր դեռ չկան։" };
    const lines = templates.map((t) => {
      const fields = t.groups.reduce((s, g) => s + g.fields.length, 0);
      return `• ${t.name} — ${t.entityType}, v${t.version}, ${t.groups.length} խումբ, ${fields} դաշտ (${t.active ? "ակտիվ" : "պասիվ"})`;
    }).join("\n");
    return { text: `Դինամիկ ձևեր (${templates.length})՝\n${lines}` };
  }

  // ---- Users ----
  if (/օգտատեր|user|աշխատակից/.test(q)) {
    const users = await db.user.findMany({ where: { active: true }, select: { name: true, email: true, role: true } });
    const lines = users.map((u) => `• ${u.name} — ${u.email} (${u.role})`).join("\n");
    return { text: `Օգտատերեր (${users.length})՝\n${lines}` };
  }

  // ---- How to register an order ----
  if (/ինչպես.*պատվեր|գրանցել.*պատվեր|նոր պատվեր/.test(q)) {
    return {
      text: "Պատվեր գրանցելու համար՝\n1. Բացեք «Հաճախորդներ և Պատվերներ» բաժինը։\n2. Սեղմեք «Նոր» կամ «Պատվերի լրացում»։\n3. Ընտրեք հաճախորդին և ապրանքները։\n4. Լրացրեք քանակը, մետրաժը և գինը։\n5. Ընտրեք վճարման եղանակը և պահպանեք։",
    };
  }

  // ---- Fallback ----
  return {
    text: "Ներողություն, չկարողացա հասկանալ հարցը։ Փորձեք հարցնել հաճախորդների, պատվերների, ապրանքների, պահեստի, պարտքերի, վաճառքի, մատակարարների, փաստաթղթերի կամ ձևերի մասին։ Գրեք «օգնություն»՝ հնարավորությունների ցանկի համար։",
  };
}
