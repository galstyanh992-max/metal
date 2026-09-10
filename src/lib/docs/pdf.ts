import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import type { DocumentType } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

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
export const DOCUMENT_VERTICAL_MARGIN = (10 / 25.4) * 72;
const DOCUMENT_FOOTER_Y = 801;
// Keep the lower part of the page free for the QR code and footer. This also
// avoids PDFKit creating a trailing page when it reaches the A4 bottom margin.
const TABLE_CONTENT_BOTTOM = 660;
const ORDER_TABLE_CONTENT_BOTTOM = 760;

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

function textHeight(doc: any, text: string, width: number, fontSize = 9) {
  doc.fontSize(fontSize).font(FONT_REG);
  return doc.heightOfString(text || "—", { width, lineGap: DOCUMENT_LINE_GAP });
}

function drawTableHeader(doc: any, y: number, cells: TableCell[]) {
  const headerHeight = Math.max(...cells.map((cell) => textHeight(doc, cell.text, cell.width)), 11);
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
  doc.fontSize(8).font(FONT_REG).fillColor("#999").text(
    "Arm Roll ERP · Հայաստան · Տպվել է " + new Date().toLocaleString("hy-AM"),
    50, DOCUMENT_FOOTER_Y, { align: "center", width: 495, lineGap: DOCUMENT_LINE_GAP }
  );
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
  const orderMeta = `${order.number} · ${new Date(order.createdAt).toLocaleDateString("hy-AM")}`;

  doc.fontSize(16).font(FONT_BOLD).fillColor("#000").text("ARM ROLL", 50, DOCUMENT_VERTICAL_MARGIN, { width: 115 });
  doc.fontSize(7).font(FONT_REG).fillColor("#666").text("ERP · ARMENIA", 50, DOCUMENT_VERTICAL_MARGIN + 19, { width: 115 });

  const titleHeight = textHeight(doc, documentTitle, 300, 12);
  doc.fontSize(12).font(FONT_BOLD).fillColor("#000").text(documentTitle, 170, DOCUMENT_VERTICAL_MARGIN, { align: "right", width: 300, lineGap: DOCUMENT_LINE_GAP });
  const metaY = DOCUMENT_VERTICAL_MARGIN + titleHeight + 1;
  doc.fontSize(9).font(FONT_REG).text(orderMeta, 170, metaY, { align: "right", width: 300, lineGap: DOCUMENT_LINE_GAP });

  const clientY = Math.max(DOCUMENT_VERTICAL_MARGIN + 38, metaY + textHeight(doc, orderMeta, 300, 9) + 4);
  doc.fontSize(8).font(FONT_REG).fillColor("#555").text(clientDetails, 50, clientY, { width: 415, lineGap: DOCUMENT_LINE_GAP });
  const dividerY = Math.max(DOCUMENT_VERTICAL_MARGIN + 58, clientY + textHeight(doc, clientDetails, 415, 8) + 6);
  doc.moveTo(50, dividerY).lineTo(545, dividerY).strokeColor("#999").lineWidth(0.5).stroke();

  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ type: "order", id: order.id, number: order.number }), {
      width: 48, margin: 1, color: { dark: "#000", light: "#fff" },
    });
    doc.image(qrDataUrl, 492, DOCUMENT_VERTICAL_MARGIN, { width: 48, height: 48 });
  } catch (e) {
    // QR generation failed — the printable document remains valid.
  }

  doc.fillColor("#000");

  // Items table
  const isWarehouseDoc = type === "WAREHOUSE_ORDER";
  // The warehouse document is a picking sheet. It is price-free even when
  // generated by an administrator.
  const showPrices = !isWarehouseDoc && role !== "WAREHOUSE";
  const columns: TableCell[] = isWarehouseDoc
    ? [
        { text: "#", x: 50, width: 20 },
        { text: "ԱՊՐԱՆՔ", x: 70, width: 200 },
        { text: "ԳՈՒՅՆ", x: 270, width: 120 },
        { text: "ՄԵՏՐ", x: 390, width: 75, align: "right" },
        { text: "ՔԱՆԱԿ", x: 465, width: 80, align: "right" },
      ]
    : [
        { text: "#", x: 50, width: 20 },
        { text: "ԱՊՐԱՆՔ", x: 70, width: 120 },
        { text: "ԳՈՒՅՆ", x: 190, width: 110 },
        { text: "ՄԵՏՐ", x: 300, width: 45, align: "right" },
        { text: "ՔԱՆԱԿ", x: 345, width: 45, align: "right" },
        { text: "ԳԻՆ", x: 390, width: 75, align: "right" },
        { text: "ԳՈՒՄԱՐ", x: 465, width: 80, align: "right" },
      ];

  let y = drawTableHeader(doc, dividerY + 10, columns);
  for (const [idx, item] of order.items.entries()) {
    const meterage = paramNum(item, "measurement") ?? paramNum(item, "meterage");
    const measurementUnit = param(item, "measurementUnit") ?? item.product?.unit?.symbol ?? "";
    const color = param(item, "color") ?? item.product?.color ?? null;

    const meterageText = meterage != null ? `${meterage.toFixed(3)} ${measurementUnit}` : "—";
    const cells: TableCell[] = isWarehouseDoc
      ? [
          { text: String(idx + 1), x: 50, width: 20 },
          { text: item.productName, x: 70, width: 200 },
          { text: color ?? "—", x: 270, width: 120 },
          { text: meterageText, x: 390, width: 75, align: "right" },
          { text: String(item.qty), x: 465, width: 80, align: "right" },
        ]
      : [
          { text: String(idx + 1), x: 50, width: 20 },
          { text: item.productName, x: 70, width: 120 },
          { text: color ?? "—", x: 190, width: 110 },
          { text: meterageText, x: 300, width: 45, align: "right" },
          { text: String(item.qty), x: 345, width: 45, align: "right" },
          { text: `${item.unitPriceSnapshot.toLocaleString("hy-AM")} դր`, x: 390, width: 75, align: "right" },
          { text: `${item.lineTotal.toLocaleString("hy-AM")} դր`, x: 465, width: 80, align: "right" },
        ];
    const rowHeight = getTableRowHeight(doc, cells, 7.5, 12, 2);
    if (y + rowHeight > ORDER_TABLE_CONTENT_BOTTOM) y = addTablePage(doc, documentTitle, columns);
    y += drawTableRow(doc, y, cells, 7.5, 12, 2);
  }

  // Totals
  if (showPrices) {
    if (y + 72 > ORDER_TABLE_CONTENT_BOTTOM) y = addTablePage(doc, documentTitle, columns);
    y += 10;
    doc.moveTo(350, y).lineTo(545, y).strokeColor("#999").lineWidth(0.5).stroke();
    y += 10;
    doc.fontSize(10).font(FONT_REG).text("Ընդհանուր՝", 350, y, { width: 130, align: "right" });
    doc.font(FONT_BOLD).text(`${order.totalAmount.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });
    y += 20;
    doc.font(FONT_REG).fillColor("#666").fontSize(9);
    doc.text(`Վճարված՝ ${order.paidAmount.toLocaleString("hy-AM")} դր`, 350, y, { width: 195, align: "right" });
    y += 14;
    doc.text(`Մնացորդ՝ ${order.outstandingAmount.toLocaleString("hy-AM")} դր`, 350, y, { width: 195, align: "right" });
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
