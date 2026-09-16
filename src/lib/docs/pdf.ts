import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import type { DocumentType } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import { isColorApplicableName, isMeasureApplicableName } from "@/lib/rolshutter/catalog";

/**
 * PDF document generator using pdfkit.
 * Generates Armenian-localized documents with industrial precision layout.
 * Uses Noto Sans Armenian TTF font for proper Armenian Unicode rendering.
 */

export interface PdfGenResult {
  buffer: Buffer;
  filename: string;
}

// Load Armenian font files (from public/fonts)
// Vercel: process.cwd() points to the standalone build dir, public/ is copied there
const FONTS_DIR = join(process.cwd(), "public", "fonts");
let REGULAR_FONT: Buffer | null = null;
let BOLD_FONT: Buffer | null = null;
try {
  REGULAR_FONT = readFileSync(join(FONTS_DIR, "NotoSansArmenian-Regular.ttf"));
  BOLD_FONT = readFileSync(join(FONTS_DIR, "NotoSansArmenian-Bold.ttf"));
} catch (e) {
  // Fallback: try alternative path (local dev with cwd = project root)
  try {
    REGULAR_FONT = readFileSync(join(process.cwd(), "src", "public", "fonts", "NotoSansArmenian-Regular.ttf"));
    BOLD_FONT = readFileSync(join(process.cwd(), "src", "public", "fonts", "NotoSansArmenian-Bold.ttf"));
  } catch (e2) {
    console.error("Failed to load Armenian fonts:", e2);
  }
}

// Font name constants used by pdfkit
const FONT_REG = "NotoArmenian";
const FONT_BOLD = "NotoArmenian-Bold";

// PDFKit measures typography in points. 0.3 mm is the required breathing room
// between text baselines in every printable document.
export const DOCUMENT_LINE_GAP = (0.3 / 25.4) * 72;
// Reduced bottom margin to 0.5cm (from 1cm) to maximize A4 usage
export const DOCUMENT_VERTICAL_MARGIN = (5 / 25.4) * 72;
const DOCUMENT_FOOTER_Y = 815;
// Keep the lower part of the page free for the QR code and footer. This also
// avoids PDFKit creating a trailing page when it reaches the A4 bottom margin.
const TABLE_CONTENT_BOTTOM = 660;
// Extended content area to use more of the page (reduced from 760 to allow more rows)
const ORDER_TABLE_CONTENT_BOTTOM = 790;

type TableCell = {
  text: string;
  x: number;
  width: number;
  align?: "left" | "right" | "center" | "justify";
  color?: string;
  font?: string;
};

function createPdfDocument() {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: DOCUMENT_VERTICAL_MARGIN, bottom: DOCUMENT_VERTICAL_MARGIN, left: 50, right: 50 },
  });
  registerFonts(doc);
  doc.lineGap(DOCUMENT_LINE_GAP);
  return doc;
}

function textHeight(doc: any, text: string, width: number, fontSize = 11) {
  doc.fontSize(fontSize).font(FONT_REG);
  return doc.heightOfString(text || "—", { width, lineGap: DOCUMENT_LINE_GAP });
}

function drawTableHeader(doc: any, y: number, cells: TableCell[]) {
  const headerHeight = Math.max(...cells.map((cell) => textHeight(doc, cell.text, cell.width, 9)), 14);
  doc.fontSize(9).font(FONT_BOLD).fillColor("#666");
  for (const cell of cells) {
    doc.text(cell.text, cell.x, y, { width: cell.width, align: cell.align, lineGap: DOCUMENT_LINE_GAP });
  }
  doc.moveTo(50, y + headerHeight + 4).lineTo(545, y + headerHeight + 4).strokeColor("#ccc").lineWidth(0.5).stroke();
  return y + headerHeight + 12;
}

function getTableRowHeight(doc: any, cells: TableCell[], fontSize = 9, minHeight = 18, padding = 4) {
  return Math.max(minHeight, ...cells.map((cell) => textHeight(doc, cell.text, cell.width, fontSize))) + padding;
}

function drawTableRow(doc: any, y: number, cells: TableCell[], fontSize = 9, minHeight = 18, padding = 4) {
  const rowHeight = getTableRowHeight(doc, cells, fontSize, minHeight, padding);
  for (const cell of cells) {
    doc.fontSize(fontSize).font(cell.font ?? FONT_REG).fillColor(cell.color ?? "#000");
    doc.text(cell.text, cell.x, y, { width: cell.width, align: cell.align, lineGap: DOCUMENT_LINE_GAP });
  }
  return rowHeight;
}

function addTablePage(doc: any, title: string, cells: TableCell[]) {
  doc.addPage();
  doc.fontSize(12).font(FONT_BOLD).fillColor("#000").text(title, 50, DOCUMENT_VERTICAL_MARGIN, { width: 495 });
  doc.moveTo(50, DOCUMENT_VERTICAL_MARGIN + 20).lineTo(545, DOCUMENT_VERTICAL_MARGIN + 20).strokeColor("#999").lineWidth(0.5).stroke();
  return drawTableHeader(doc, DOCUMENT_VERTICAL_MARGIN + 35, cells);
}

function addFooter(doc: any) {
  // Footer removed - no date/company info at bottom of page
}

/**
 * Register Armenian fonts on a PDFDocument instance.
 * Falls back to Helvetica only if Armenian font files are missing (rare).
 */
function registerFonts(doc: any) {
  if (REGULAR_FONT && BOLD_FONT) {
    doc.registerFont(FONT_REG, REGULAR_FONT);
    doc.registerFont(FONT_BOLD, BOLD_FONT);
  }
}

const DOC_TYPE_LABELS: Record<string, string> = {
  CUSTOMER_ORDER: "ՀԱՃԱԽՈՐԴԻ ՊԱՏՎԵՐ",
  WAREHOUSE_ORDER: "ՊԱՀԵՍՏԻ ՀԱՆՁՆԱՐԱՐԱԿԱՆ",
  INVOICE: "ՀԱՇԻՎ-ԱՊՐԱՆՔԱԳԻՐ",
  PAYMENT_RECEIPT: "ՎՃԱՐՄԱՆ ԱՆԴՈՐՐԱԳԻՐ",
  DEBT_STATEMENT: "ՊԱՐՏՔԻ ՏԵՂԵԿԱԳԻՐ",
  DELIVERY_NOTE: "ՀԱՆՁՆՄԱՆ ԱԿՏ",
  PROCUREMENT_DOCUMENT: "ԳՆՄԱՆ ՓԱՍՏԱԹՈՒՂԹ",
};

export async function generateOrderPdf(orderId: string, type: DocumentType, role: string): Promise<PdfGenResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      items: {
        include: {
          product: { include: { unit: true } },
          parameters: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      payments: true,
    },
  });

  if (!order) throw new Error("Order not found");

  // Helper: read a parameter value from an order item.
  const param = (item: any, key: string): string | null => {
    const p = item.parameters?.find((x: any) => x.fieldKey === key);
    return p?.value != null && p.value !== "" ? String(p.value) : null;
  };
  // Helper: parse a numeric parameter (accepts comma or dot decimal).
  const paramNum = (item: any, key: string): number | null => {
    const v = param(item, key);
    if (v == null) return null;
    const n = Number(v.replace(",", "."));
    return isFinite(n) ? n : null;
  };

  const doc = createPdfDocument();
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Compact one-page header: company, document details, client data and QR
  // share one block so the items table receives the maximum usable height.
  const documentTitle = DOC_TYPE_LABELS[type] ?? type;
  const clientName = [order.client?.firstName, order.client?.lastName].filter(Boolean).join(" ") || "—";
  const clientDetails = [clientName, order.client?.phone, order.client?.primaryAddress].filter(Boolean).join(" · ");
  const orderMetaParts = [
    order.number,
    new Date(order.createdAt).toLocaleDateString("hy-AM"),
    order.dueDate ? `Կատարման՝ ${new Date(order.dueDate).toLocaleDateString("hy-AM")}` : null,
  ].filter(Boolean);
  const orderMeta = orderMetaParts.join(" · ");

  // Header — left: company; center-right: document title + meta; right: QR.
  // Compact industrial ERP layout (reference: 10–12 pt title, 8–9 pt meta).
  const qrSizePx = 56; // ≈ 14.8 mm — within reference 15–18 mm range
  const qrX = 545 - qrSizePx + 5; // right-aligned within content area (margins ~50pt)
  doc.fontSize(12).font(FONT_BOLD).fillColor("#000").text("ARM ROLL", 50, DOCUMENT_VERTICAL_MARGIN, { width: 115 });
  doc.fontSize(8).font(FONT_REG).fillColor("#666").text("ERP · ARMENIA", 50, DOCUMENT_VERTICAL_MARGIN + 16, { width: 115 });

  const titleHeight = textHeight(doc, documentTitle, 300, 11);
  doc.fontSize(11).font(FONT_BOLD).fillColor("#000").text(documentTitle, 170, DOCUMENT_VERTICAL_MARGIN, { align: "right", width: 300, lineGap: DOCUMENT_LINE_GAP });
  const metaY = DOCUMENT_VERTICAL_MARGIN + titleHeight + 1;
  doc.fontSize(9).font(FONT_REG).fillColor("#666").text(orderMeta, 170, metaY, { align: "right", width: 300, lineGap: DOCUMENT_LINE_GAP });

  const clientY = Math.max(DOCUMENT_VERTICAL_MARGIN + 34, metaY + textHeight(doc, orderMeta, 300, 9) + 4);
  doc.fontSize(9).font(FONT_REG).fillColor("#555").text(clientDetails, 50, clientY, { width: 415, lineGap: DOCUMENT_LINE_GAP });
  const dividerY = Math.max(DOCUMENT_VERTICAL_MARGIN + 52, clientY + textHeight(doc, clientDetails, 415, 8) + 6);
  doc.moveTo(50, dividerY).lineTo(545, dividerY).strokeColor("#cfcfcf").lineWidth(0.5).stroke();

  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ type: "order", id: order.id, number: order.number }), {
      width: qrSizePx, margin: 1, color: { dark: "#000", light: "#fff" },
    });
    doc.image(qrDataUrl, qrX, DOCUMENT_VERTICAL_MARGIN, { width: qrSizePx, height: qrSizePx });
  } catch (e) {
    // QR generation failed — the printable document remains valid.
  }

  doc.fillColor("#000");

  // Order parameters block — two columns of compact key/value pairs.
  // Source values come from the first non-service item's parameters
  // (rolshutter calculator stores width/height/color/meterage there).
  // System is inferred from the product name of the first meter-priced item.
  const firstNonService = order.items.find((it: any) => {
    const isService = it.parameters?.some((p: any) => p.fieldKey === "isService" && p.value === "true") === true
      || it.product?.unit?.code === "service";
    return !isService;
  });
  const pWidth = firstNonService ? paramNum(firstNonService, "width") : null;
  const pHeight = firstNonService ? paramNum(firstNonService, "height") : null;
  // Color in the header parameters block — strip "(RAL xxxx)" code, keep
  // only the human-friendly color name (e.g. "Անտրացիտ V16").
  const pColorRaw = firstNonService ? param(firstNonService, "color") : null;
  const pColor = pColorRaw ? pColorRaw.replace(/\s*\([^\)]*\)\s*/g, " ").trim() : null;
  // System — find first item whose unit is "m" (e.g. Լամիլ 7,7 / Տակացու 7,7) and use its name
  const systemItem = order.items.find((it: any) => it.product?.unit?.code === "m");
  const pSystem = systemItem ? systemItem.productName : null;
  // Motor side — extracted from order.note (e.g. "... · Շարժիչի կողմը՝ Աջ · ...")
  const motorSideMatch = order.note?.match(/Շարժիչի կողմը՝\s*(Աջ|Ձախ)/);
  const pMotorSide = motorSideMatch ? motorSideMatch[1] : null;
  // Delivery — true if the order contains an Առաքում service line
  const pDelivery = order.items.some((it: any) => {
    const isService = it.parameters?.some((p: any) => p.fieldKey === "isService" && p.value === "true") === true
      || it.product?.unit?.code === "service";
    return isService && it.productName === "Առաքում";
  });
  const pDeliveryAmount = pDelivery
    ? order.items.find((it: any) => {
        const isService = it.parameters?.some((p: any) => p.fieldKey === "isService" && p.value === "true") === true
          || it.product?.unit?.code === "service";
        return isService && it.productName === "Առաքում";
      })?.lineTotal ?? null
    : null;

  const paramsY = dividerY + 10;
  const fmtNum = (n: number | null) => (n != null ? n.toLocaleString("hy-AM", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
  doc.fontSize(8).font(FONT_REG).fillColor("#000");
  // Left column: Լայնք / Բարձրություն
  doc.fillColor("#999").text("Լայնք՝", 50, paramsY, { width: 50, lineGap: DOCUMENT_LINE_GAP });
  doc.fillColor("#000").text(fmtNum(pWidth), 100, paramsY, { width: 120, lineGap: DOCUMENT_LINE_GAP });
  doc.fillColor("#999").text("Բարձրություն՝", 50, paramsY + 12, { width: 50, lineGap: DOCUMENT_LINE_GAP });
  doc.fillColor("#000").text(fmtNum(pHeight), 100, paramsY + 12, { width: 120, lineGap: DOCUMENT_LINE_GAP });
  // Right column: Գույն / Համակարգ
  doc.fillColor("#999").text("Գույն՝", 240, paramsY, { width: 50, lineGap: DOCUMENT_LINE_GAP });
  doc.fillColor("#000").text(pColor ?? "—", 290, paramsY, { width: 255, lineGap: DOCUMENT_LINE_GAP });
  doc.fillColor("#999").text("Համակարգ՝", 240, paramsY + 12, { width: 50, lineGap: DOCUMENT_LINE_GAP });
  doc.fillColor("#000").text(pSystem ?? "—", 290, paramsY + 12, { width: 255, lineGap: DOCUMENT_LINE_GAP });
  // Extra row: Շարժիչի կողմը / Առաքում — only shown when present in the order
  let tableTopY = paramsY + 30;
  if (pMotorSide || pDelivery) {
    const extraY = paramsY + 24;
    if (pMotorSide) {
      doc.fillColor("#999").text("Շարժիչի կողմը՝", 50, extraY, { width: 95, lineGap: DOCUMENT_LINE_GAP });
      doc.fillColor("#000").text(pMotorSide, 145, extraY, { width: 75, lineGap: DOCUMENT_LINE_GAP });
    }
    if (pDelivery) {
      doc.fillColor("#999").text("Առաքում՝", 240, extraY, { width: 50, lineGap: DOCUMENT_LINE_GAP });
      const deliveryText = pDeliveryAmount != null
        ? `Այո · ${pDeliveryAmount.toLocaleString("hy-AM")} դր`
        : "Այո";
      doc.fillColor("#000").text(deliveryText, 290, extraY, { width: 255, lineGap: DOCUMENT_LINE_GAP });
    }
    tableTopY = extraY + 18;
  }

  // Items table
  const isWarehouseDoc = type === "WAREHOUSE_ORDER";
  // The warehouse document is a picking sheet. It is price-free even when
  // generated by an administrator.
  const showPrices = !isWarehouseDoc && role !== "WAREHOUSE";
  // Reference column layout (7 cols): # | Product | Color | Size/Measure | Qty | Price | Total
  // Numeric columns are right-aligned with nowrap behavior via single-line text.
  const columns: TableCell[] = isWarehouseDoc
    ? [
        { text: "#", x: 50, width: 20 },
        { text: "ԱՊՐԱՆՔ", x: 70, width: 150 },
        { text: "ԳՈՒՅՆ", x: 220, width: 130 },
        { text: "ՉԱՓ/ՄԵՏՐ", x: 350, width: 95, align: "right" },
        { text: "ՔԱՆԱԿ", x: 445, width: 100, align: "right" },
      ]
    : [
        { text: "#", x: 50, width: 20 },
        { text: "ԱՊՐԱՆՔ", x: 70, width: 130 },
        { text: "ԳՈՒՅՆ", x: 200, width: 120 },
        { text: "ՉԱՓ/ՄԵՏՐ", x: 320, width: 80, align: "right" },
        { text: "ՔԱՆԱԿ", x: 400, width: 45, align: "right" },
        { text: "ԳԻՆ", x: 445, width: 55, align: "right" },
        { text: "ԳՈՒՄԱՐ", x: 500, width: 45, align: "right" },
      ];

  let y = drawTableHeader(doc, tableTopY, columns);
  for (const [idx, item] of order.items.entries()) {
    const isService = item.parameters?.some((p: any) => p.fieldKey === "isService" && p.value === "true") === true
      || item.product?.unit?.code === "service";
    const meterage = paramNum(item, "measurement") ?? paramNum(item, "meterage");
    const measurementUnit = param(item, "measurementUnit") ?? item.product?.unit?.symbol ?? "մ";
    // Try to read width/height from parameters (rolshutter calculator)
    const width = isService ? null : (param(item, "width") ?? param(item, "profile_width") ?? null);
    const height = isService ? null : (param(item, "height") ?? param(item, "profile_height") ?? null);
    // Color parameter (rolshutter calculator) — shown in its own column, but
    // only for powder-coated parts (Կոռոբ/Լամիլ/Կողային կափարիչ/Տակացու/Ուղղորդիչ).
    // Other components are unpainted; showing a color there would be misleading.
    // Strip any "(RAL xxxx)" code from the displayed value — the warehouse/operator
    // wants the human-friendly color name only (e.g. "Անտրացիտ V16").
    const colorRaw = isService ? null : param(item, "color");
    const colorValue = colorRaw && isColorApplicableName(item.productName)
      ? colorRaw.replace(/\s*\([^\)]*\)\s*/g, " ").trim()
      : null;
    const color = colorValue && colorValue.length > 0 ? colorValue : null;

    // Only show unit if it's not "հատ" (piece) - for meters show "մ", hide "հատ"
    const unitDisplay = measurementUnit === "հատ" || isService ? "" : ` ${measurementUnit}`;
    const meterageText = isService ? "" : (meterage != null ? `${meterage.toFixed(2)}${unitDisplay}` : "—");
    // ՉԱՓ/ՄԵՏՐ column shows ONLY the meterage (length consumed by this row).
    // Width/height are gate dimensions, not per-part measurements, and were
    // removed per operator request. Empty for non-applicable parts.
    const measureApplicable = isMeasureApplicableName(item.productName);
    const sizeText = isService || !measureApplicable ? "" : meterageText;
    const colorText = color ?? "—";
    const cells: TableCell[] = isWarehouseDoc
      ? [
          { text: String(idx + 1), x: 50, width: 20 },
          { text: item.productName, x: 70, width: 150 },
          { text: colorText, x: 220, width: 130 },
          { text: sizeText, x: 350, width: 95, align: "right" },
          { text: String(item.qty), x: 445, width: 100, align: "right" },
        ]
      : [
          { text: String(idx + 1), x: 50, width: 20 },
          { text: item.productName, x: 70, width: 130 },
          { text: colorText, x: 200, width: 120 },
          { text: sizeText, x: 320, width: 80, align: "right" },
          { text: String(item.qty), x: 400, width: 45, align: "right" },
          { text: `${item.unitPriceSnapshot.toLocaleString("hy-AM")} դր`, x: 445, width: 55, align: "right" },
          { text: `${item.lineTotal.toLocaleString("hy-AM")} դր`, x: 500, width: 45, align: "right" },
        ];
    // Compact row padding (reference ~1.5 pt) — pass minHeight=14, padding=1.5
    const rowHeight = getTableRowHeight(doc, cells, 9, 14, 1.5);
    if (y + rowHeight > ORDER_TABLE_CONTENT_BOTTOM) y = addTablePage(doc, documentTitle, columns);
    y += drawTableRow(doc, y, cells, 9, 14, 1.5);
  }

  // Totals — reference style: short horizontal line, then bold Ընդհանուր՝ on the right.
  // Discount / paid / outstanding / note lines are kept (they reflect real order data
  // and do not contradict the reference, which simply omits them when zero).
  if (showPrices) {
    if (y + 120 > ORDER_TABLE_CONTENT_BOTTOM) y = addTablePage(doc, documentTitle, columns);
    y += 10;
    // Short line above total (reference: ~195pt wide on the right)
    doc.moveTo(350, y).lineTo(545, y).strokeColor("#cfcfcf").lineWidth(0.5).stroke();
    y += 8;
    doc.fontSize(10).font(FONT_REG).fillColor("#000").text("Մինչև զեղչումը՝", 350, y, { width: 130, align: "right" });
    doc.font(FONT_REG).text(`${order.baseAmount.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });
    y += 14;
    if (order.discountAmount > 0) {
      doc.fillColor("#000").font(FONT_REG).text("Զեղչում՝", 350, y, { width: 130, align: "right" });
      doc.text(`-${order.discountAmount.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });
      y += 14;
    }
    // Grand total — bold, right-aligned, with short line above
    doc.moveTo(350, y).lineTo(545, y).strokeColor("#cfcfcf").lineWidth(0.5).stroke();
    y += 8;
    doc.font(FONT_BOLD).fillColor("#000").fontSize(11).text("Ընդհանուր՝", 350, y, { width: 130, align: "right" });
    doc.text(`${order.totalAmount.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });
    y += 18;
    doc.font(FONT_REG).fillColor("#666").fontSize(9);
    doc.text(`Վճարված՝ ${order.paidAmount.toLocaleString("hy-AM")} դր`, 350, y, { width: 195, align: "right" });
    y += 12;
    doc.text(`Մնացորդ՝ ${order.outstandingAmount.toLocaleString("hy-AM")} դր`, 350, y, { width: 195, align: "right" });
    y += 16;
    // Order note (payment method / custom note from operator)
    if (order.note) {
      doc.fillColor("#000").font(FONT_REG).fontSize(8);
      doc.text(`Նշում՝ ${order.note}`, 350, y, { width: 195, align: "right" });
    }
  }

  // Footer
  addFooter(doc);

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => {
      resolve({
        buffer: Buffer.concat(chunks),
        filename: `${order.number}-${type}.pdf`,
      });
    });
  });
}

export async function generateBarcodePng(productId: string): Promise<Buffer> {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  const code = product.barcode || product.sku;
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: code,
    scale: 2,
    height: 40,
    includetext: true,
    textxalign: "center",
  });
  return png;
}

export async function generateQrPng(data: string): Promise<Buffer> {
  const png = await QRCode.toBuffer(data, { width: 200, margin: 1, color: { dark: "#000", light: "#fff" } });
  return png;
}

/**
 * Generate a debt statement PDF for a client.
 * Shows all unpaid orders with their outstanding amounts.
 */
export async function generateDebtStatementPdf(clientId: string): Promise<PdfGenResult> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      orders: {
        where: { outstandingAmount: { gt: 0 }, status: { notIn: ["DRAFT", "CANCELLED"] } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!client) throw new Error("Client not found");

  const doc = createPdfDocument();
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(20).font(FONT_BOLD).text("ARM ROLL", 50, DOCUMENT_VERTICAL_MARGIN, { width: 200 });
  doc.fontSize(8).font(FONT_REG).fillColor("#666").text("ERP · ARMENIA", 50, DOCUMENT_VERTICAL_MARGIN + 25, { width: 200 });
  doc.fillColor("#000");

  doc.fontSize(16).font(FONT_BOLD).text("ՊԱՐՏՔԻ ՏԵՂԵԿԱԳԻՐ", 350, DOCUMENT_VERTICAL_MARGIN, { align: "right", width: 200 });
  doc.fontSize(10).font(FONT_REG).text(new Date().toLocaleDateString("hy-AM"), 350, DOCUMENT_VERTICAL_MARGIN + 22, { align: "right", width: 200 });

  doc.moveTo(50, DOCUMENT_VERTICAL_MARGIN + 45).lineTo(545, DOCUMENT_VERTICAL_MARGIN + 45).strokeColor("#999").lineWidth(0.5).stroke();

  // Client info
  const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "—";
  let clientY = DOCUMENT_VERTICAL_MARGIN + 60;
  doc.fontSize(9).font(FONT_BOLD).fillColor("#666").text("ՀԱՃԱԽՈՐԴ", 50, clientY, { lineGap: DOCUMENT_LINE_GAP });
  clientY += textHeight(doc, "ՀԱՃԱԽՈՐԴ", 280) + 4;
  doc.fontSize(12).font(FONT_REG).fillColor("#000").text(clientName ?? "—", 50, clientY, { width: 280, lineGap: DOCUMENT_LINE_GAP });
  clientY += textHeight(doc, clientName ?? "—", 280, 12) + 3;
  doc.fontSize(9).font(FONT_REG).fillColor("#666");
  for (const value of [client.phone, client.primaryAddress]) {
    if (!value) continue;
    doc.text(value, 50, clientY, { width: 280, lineGap: DOCUMENT_LINE_GAP });
    clientY += textHeight(doc, value, 280) + 3;
  }

  // Summary
  const totalDebt = client.orders.reduce((s, o) => s + o.outstandingAmount, 0);
  const totalOrders = client.orders.length;
  doc.fillColor("#000");
  doc.fontSize(11).font(FONT_BOLD).text("ԸՆԴՀԱՆՈՒՐ ՊԱՐՏՔ:", 350, DOCUMENT_VERTICAL_MARGIN + 75, { width: 195, align: "right" });
  doc.fontSize(14).fillColor("#c00").text(`${totalDebt.toLocaleString("hy-AM")} դր`, 350, DOCUMENT_VERTICAL_MARGIN + 90, { width: 195, align: "right" });
  doc.fontSize(9).font(FONT_REG).fillColor("#666").text(`${totalOrders} չվճարված պատվեր`, 350, DOCUMENT_VERTICAL_MARGIN + 110, { width: 195, align: "right" });

  // Orders table
  const columns: TableCell[] = [
    { text: "#", x: 50, width: 30 },
    { text: "ՊԱՏՎԵՐ", x: 85, width: 100 },
    { text: "ԱՄՍԱԹԻՎ", x: 200, width: 80 },
    { text: "ԸՆԴՀԱՆՈՒՐ", x: 320, width: 80, align: "right" },
    { text: "ՎՃԱՐՎԱԾ", x: 410, width: 60, align: "right" },
    { text: "ՄՆԱՑՈՐԴ", x: 480, width: 65, align: "right" },
  ];
  const statementTitle = "ՊԱՐՏՔԻ ՏԵՂԵԿԱԳԻՐ";
  let y = drawTableHeader(doc, Math.max(DOCUMENT_VERTICAL_MARGIN + 150, clientY + 12), columns);
  for (const [idx, order] of client.orders.entries()) {
    const cells: TableCell[] = [
      { text: String(idx + 1), x: 50, width: 30 },
      { text: order.number, x: 85, width: 100 },
      { text: new Date(order.createdAt).toLocaleDateString("hy-AM"), x: 200, width: 80 },
      { text: `${order.totalAmount.toLocaleString("hy-AM")} դր`, x: 320, width: 80, align: "right" },
      { text: `${order.paidAmount.toLocaleString("hy-AM")} դր`, x: 410, width: 60, align: "right" },
      { text: `${order.outstandingAmount.toLocaleString("hy-AM")} դր`, x: 480, width: 65, align: "right", color: "#c00", font: FONT_BOLD },
    ];
    const rowHeight = Math.max(18, ...cells.map((cell) => textHeight(doc, cell.text, cell.width))) + 4;
    if (y + rowHeight > TABLE_CONTENT_BOTTOM) y = addTablePage(doc, statementTitle, columns);
    y += drawTableRow(doc, y, cells);
  }

  // Total
  if (y + 48 > TABLE_CONTENT_BOTTOM) y = addTablePage(doc, statementTitle, columns);
  y += 10;
  doc.moveTo(350, y).lineTo(545, y).strokeColor("#999").lineWidth(0.5).stroke();
  y += 10;
  doc.fontSize(11).font(FONT_BOLD).fillColor("#000").text("ՄԱՔՐ ՊԱՐՏՔ՝", 350, y, { width: 130, align: "right" });
  doc.fontSize(14).fillColor("#c00").text(`${totalDebt.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });

  addFooter(doc);

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => {
      resolve({
        buffer: Buffer.concat(chunks),
        filename: `debt-statement-${clientId}.pdf`,
      });
    });
  });
}

/**
 * Generate a procurement PO PDF.
 */
export async function generateProcurementPdf(poId: string): Promise<PdfGenResult> {
  const po = await db.purchaseOrder.findUnique({
    where: { id: poId },
    include: { supplier: true, items: { include: { product: { include: { unit: true } } } } },
  });
  if (!po) throw new Error("Purchase order not found");

  const doc = createPdfDocument();
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(20).font(FONT_BOLD).text("ARM ROLL", 50, DOCUMENT_VERTICAL_MARGIN, { width: 200 });
  doc.fontSize(8).font(FONT_REG).fillColor("#666").text("ERP · ARMENIA", 50, DOCUMENT_VERTICAL_MARGIN + 25, { width: 200 });
  doc.fillColor("#000");

  doc.fontSize(16).font(FONT_BOLD).text("ԳՆՄԱՆ ՓԱՍՏԱԹՈՒՂԹ", 350, DOCUMENT_VERTICAL_MARGIN, { align: "right", width: 200 });
  doc.fontSize(10).font(FONT_REG).text(po.number, 350, DOCUMENT_VERTICAL_MARGIN + 22, { align: "right", width: 200 });
  doc.text(new Date(po.createdAt).toLocaleDateString("hy-AM"), 350, DOCUMENT_VERTICAL_MARGIN + 36, { align: "right", width: 200 });

  doc.moveTo(50, DOCUMENT_VERTICAL_MARGIN + 55).lineTo(545, DOCUMENT_VERTICAL_MARGIN + 55).strokeColor("#999").lineWidth(0.5).stroke();

  // Supplier info
  let supplierY = DOCUMENT_VERTICAL_MARGIN + 70;
  doc.fontSize(9).font(FONT_BOLD).fillColor("#666").text("ՄԱՏԱԿԱՐԱՐ", 50, supplierY, { lineGap: DOCUMENT_LINE_GAP });
  supplierY += textHeight(doc, "ՄԱՏԱԿԱՐԱՐ", 280) + 4;
  const supplierName = po.supplier?.name ?? "—";
  doc.fontSize(11).font(FONT_REG).fillColor("#000").text(supplierName, 50, supplierY, { width: 280, lineGap: DOCUMENT_LINE_GAP });
  supplierY += textHeight(doc, supplierName, 280, 11) + 3;
  doc.fontSize(9).font(FONT_REG).fillColor("#666");
  for (const value of [po.supplier?.phone, po.supplier?.email, po.supplier?.taxId ? `ՀՎՀՀ: ${po.supplier.taxId}` : null]) {
    if (!value) continue;
    doc.text(value, 50, supplierY, { width: 280, lineGap: DOCUMENT_LINE_GAP });
    supplierY += textHeight(doc, value, 280) + 3;
  }

  // Status
  doc.fillColor("#000");
  doc.fontSize(9).font(FONT_BOLD).fillColor("#666").text("ԿԱՐԳԱՎԻՃԱԿ", 350, DOCUMENT_VERTICAL_MARGIN + 70, { width: 195, align: "right" });
  doc.fontSize(12).font(FONT_BOLD).fillColor(po.status === "RECEIVED" ? "#0a0" : "#c80").text(po.status, 350, DOCUMENT_VERTICAL_MARGIN + 85, { width: 195, align: "right" });

  // Items table
  const columns: TableCell[] = [
    { text: "#", x: 50, width: 30 },
    { text: "ԱՊՐԱՆՔ", x: 85, width: 200 },
    { text: "ՔԱՆԱԿ", x: 340, width: 50, align: "right" },
    { text: "ԳԻՆ", x: 410, width: 60, align: "right" },
    { text: "ԳՈՒՄԱՐ", x: 480, width: 65, align: "right" },
  ];
  const procurementTitle = "ԳՆՄԱՆ ՓԱՍՏԱԹՈՒՂԹ";
  let y = drawTableHeader(doc, Math.max(DOCUMENT_VERTICAL_MARGIN + 160, supplierY + 12), columns);
  for (const [idx, item] of po.items.entries()) {
    const cells: TableCell[] = [
      { text: String(idx + 1), x: 50, width: 30 },
      { text: item.product?.name ?? "—", x: 85, width: 200 },
      { text: `${item.qty} ${item.product?.unit?.symbol ?? ""}`, x: 340, width: 50, align: "right" },
      { text: `${item.unitPrice.toLocaleString("hy-AM")} դր`, x: 410, width: 60, align: "right" },
      { text: `${item.total.toLocaleString("hy-AM")} դր`, x: 480, width: 65, align: "right" },
    ];
    const rowHeight = Math.max(18, ...cells.map((cell) => textHeight(doc, cell.text, cell.width))) + 4;
    if (y + rowHeight > TABLE_CONTENT_BOTTOM) y = addTablePage(doc, procurementTitle, columns);
    y += drawTableRow(doc, y, cells);
  }

  // Total
  if (y + 48 > TABLE_CONTENT_BOTTOM) y = addTablePage(doc, procurementTitle, columns);
  y += 10;
  doc.moveTo(350, y).lineTo(545, y).strokeColor("#999").lineWidth(0.5).stroke();
  y += 10;
  doc.fontSize(11).font(FONT_BOLD).fillColor("#000").text("ԸՆԴՀԱՆՈՒՐ՝", 350, y, { width: 130, align: "right" });
  doc.fontSize(14).text(`${po.totalAmount.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });

  addFooter(doc);

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => {
      resolve({
        buffer: Buffer.concat(chunks),
        filename: `${po.number}.pdf`,
      });
    });
  });
}
