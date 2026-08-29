import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import type { DocumentType } from "@prisma/client";

/**
 * PDF document generator using pdfkit.
 * Generates Armenian-localized documents with industrial precision layout.
 */

export interface PdfGenResult {
  buffer: Buffer;
  filename: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  CUSTOMER_ORDER: "ՀԱՃԱԽՈՐԴԻ ՊԱՏՎԵՐ",
  WAREHOUSE_ORDER: "ՊԱՀԵՍՏԻ ՀԱՆՁՆԱՐԱՐԱԿԱՆ",
  INVOICE: "ՀԱՇԻՎ-ԱՊՐԱՆՔԱԳԻՐ",
  PAYMENT_RECEIPT: "ՎՃԱՐՄԱՆ ԱՆԴՈՐՐԱԳԻՐ",
  DEBT_STATEMENT: "ՊԱՐՏՔԻ ՏԵՂԵԿԱԳԻՐ",
  DELIVERY_NOTE: "ՀԱՆՁՆՄԱՆ ԱԿՏ",
  PROCUREMENT_DOCUMENT: "ԳՆՄԱՆ ՓԱՍՏԱԹՈՒԹԹ",
};

export async function generateOrderPdf(orderId: string, type: DocumentType, role: string): Promise<PdfGenResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      items: { include: { product: { include: { unit: true } } } },
      payments: true,
    },
  });

  if (!order) throw new Error("Order not found");

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text("ARM ROLL", 50, 50, { width: 200 });
  doc.fontSize(8).font("Helvetica").fillColor("#666").text("ERP · ARMENIA", 50, 75, { width: 200 });
  doc.fillColor("#000");

  doc.fontSize(16).font("Helvetica-Bold").text(DOC_TYPE_LABELS[type] ?? type, 350, 50, { align: "right", width: 200 });
  doc.fontSize(10).font("Helvetica").text(order.number, 350, 72, { align: "right", width: 200 });
  doc.text(new Date(order.createdAt).toLocaleDateString("hy-AM"), 350, 86, { align: "right", width: 200 });

  doc.moveTo(50, 105).lineTo(545, 105).strokeColor("#999").lineWidth(0.5).stroke();

  // Client info
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#666").text("ՀԱՃԱԽՈՐԴ", 50, 120);
  doc.fontSize(11).font("Helvetica").fillColor("#000");
  const clientName = order.client?.type === "COMPANY" ? order.client?.companyName : `${order.client?.firstName ?? ""} ${order.client?.lastName ?? ""}`;
  doc.text(clientName ?? "", 50, 135);
  doc.fontSize(9).font("Helvetica").fillColor("#666");
  doc.text(order.client?.phone ?? "", 50, 152);
  if (order.client?.email) doc.text(order.client.email, 50, 166);
  if (order.client?.primaryAddress) doc.text(order.client.primaryAddress, 50, 180);

  doc.fillColor("#000");

  // Items table
  const tableTop = 210;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#666");
  doc.text("#", 50, tableTop, { width: 30 });
  doc.text("ԱՊՐԱՆՔ", 85, tableTop, { width: 200 });
  doc.text("ՔԱՆԱԿ", 360, tableTop, { width: 50, align: "right" });
  if (role !== "WAREHOUSE" && type !== "WAREHOUSE_ORDER") {
    doc.text("ԳԻՆ", 420, tableTop, { width: 60, align: "right" });
    doc.text("ԳՈՒՄԱՐ", 480, tableTop, { width: 65, align: "right" });
  }

  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#ccc").lineWidth(0.5).stroke();

  let y = tableTop + 25;
  order.items.forEach((item, idx) => {
    doc.fontSize(9).font("Helvetica").fillColor("#000");
    doc.text(String(idx + 1), 50, y, { width: 30 });
    doc.text(item.productName, 85, y, { width: 200 });
    doc.text(`${item.qty} ${item.product?.unit?.symbol ?? ""}`, 360, y, { width: 50, align: "right" });
    if (role !== "WAREHOUSE" && type !== "WAREHOUSE_ORDER") {
      doc.text(`${item.unitPriceSnapshot.toLocaleString("hy-AM")} դր`, 420, y, { width: 60, align: "right" });
      doc.text(`${item.lineTotal.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });
    }
    y += 18;
  });

  // Totals
  if (role !== "WAREHOUSE" && type !== "WAREHOUSE_ORDER") {
    y += 10;
    doc.moveTo(350, y).lineTo(545, y).strokeColor("#999").lineWidth(0.5).stroke();
    y += 10;
    doc.fontSize(10).font("Helvetica").text("Ընդհանուր՝", 350, y, { width: 130, align: "right" });
    doc.font("Helvetica-Bold").text(`${order.totalAmount.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });
    y += 20;
    doc.font("Helvetica").fillColor("#666").fontSize(9);
    doc.text(`Վճարված՝ ${order.paidAmount.toLocaleString("hy-AM")} դր`, 350, y, { width: 195, align: "right" });
    y += 14;
    doc.text(`Մնացորդ՝ ${order.outstandingAmount.toLocaleString("hy-AM")} դր`, 350, y, { width: 195, align: "right" });
  }

  // QR code (bottom right)
  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ type: "order", id: order.id, number: order.number }), {
      width: 80, margin: 1, color: { dark: "#000", light: "#fff" },
    });
    doc.image(qrDataUrl, 440, 720, { width: 80, height: 80 });
    doc.fontSize(7).fillColor("#999").text(order.number, 440, 805, { width: 80, align: "center" });
  } catch (e) {
    // QR generation failed — continue without it
  }

  // Footer
  doc.fontSize(8).fillColor("#999").text(
    "Arm Roll ERP · Հայաստան · Ստեղծված է " + new Date().toLocaleString("hy-AM"),
    50, 820, { align: "center", width: 495 }
  );

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
        where: { outstandingAmount: { gt: 0 }, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!client) throw new Error("Client not found");

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text("ARM ROLL", 50, 50, { width: 200 });
  doc.fontSize(8).font("Helvetica").fillColor("#666").text("ERP · ARMENIA", 50, 75, { width: 200 });
  doc.fillColor("#000");

  doc.fontSize(16).font("Helvetica-Bold").text("ՊԱՐՏՔԻ ՏԵՂԵԿԱԳԻՐ", 350, 50, { align: "right", width: 200 });
  doc.fontSize(10).font("Helvetica").text(new Date().toLocaleDateString("hy-AM"), 350, 72, { align: "right", width: 200 });

  doc.moveTo(50, 95).lineTo(545, 95).strokeColor("#999").lineWidth(0.5).stroke();

  // Client info
  const clientName = client.type === "COMPANY" ? client.companyName : `${client.firstName} ${client.lastName}`;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#666").text("ՀԱՃԱԽՈՐԴ", 50, 110);
  doc.fontSize(12).font("Helvetica").fillColor("#000").text(clientName, 50, 125);
  doc.fontSize(9).font("Helvetica").fillColor("#666");
  doc.text(client.phone, 50, 142);
  if (client.email) doc.text(client.email, 50, 156);
  if (client.type === "COMPANY" && client.taxId) doc.text(`ՀՎՀՀ: ${client.taxId}`, 50, 170);

  // Summary
  const totalDebt = client.orders.reduce((s, o) => s + o.outstandingAmount, 0);
  const totalOrders = client.orders.length;
  doc.fillColor("#000");
  doc.fontSize(11).font("Helvetica-Bold").text("ԸՆԴՀԱՆՈՒՐ ՊԱՐՏՔ:", 350, 125, { width: 195, align: "right" });
  doc.fontSize(14).fillColor("#c00").text(`${totalDebt.toLocaleString("hy-AM")} դր`, 350, 140, { width: 195, align: "right" });
  doc.fontSize(9).font("Helvetica").fillColor("#666").text(`${totalOrders} չվճարված պատվեր`, 350, 160, { width: 195, align: "right" });

  // Orders table
  const tableTop = 200;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#666");
  doc.text("#", 50, tableTop, { width: 30 });
  doc.text("ՊԱՏՎԵՐ", 85, tableTop, { width: 100 });
  doc.text("ԱՄՍԱԹԻՎ", 200, tableTop, { width: 80 });
  doc.text("ԸՆԴՀԱՆՈՒՐ", 320, tableTop, { width: 80, align: "right" });
  doc.text("ՎՃԱՐՎԱԾ", 410, tableTop, { width: 60, align: "right" });
  doc.text("ՄՆԱՑՈՐԴ", 480, tableTop, { width: 65, align: "right" });

  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#ccc").lineWidth(0.5).stroke();

  let y = tableTop + 25;
  client.orders.forEach((order, idx) => {
    doc.fontSize(9).font("Helvetica").fillColor("#000");
    doc.text(String(idx + 1), 50, y, { width: 30 });
    doc.text(order.number, 85, y, { width: 100 });
    doc.text(new Date(order.createdAt).toLocaleDateString("hy-AM"), 200, y, { width: 80 });
    doc.text(`${order.totalAmount.toLocaleString("hy-AM")} դր`, 320, y, { width: 80, align: "right" });
    doc.text(`${order.paidAmount.toLocaleString("hy-AM")} դր`, 410, y, { width: 60, align: "right" });
    doc.font("Helvetica-Bold").fillColor("#c00").text(`${order.outstandingAmount.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });
    y += 18;
  });

  // Total
  y += 10;
  doc.moveTo(350, y).lineTo(545, y).strokeColor("#999").lineWidth(0.5).stroke();
  y += 10;
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text("ՄԱՔՐ ՊԱՐՏՔ՝", 350, y, { width: 130, align: "right" });
  doc.fontSize(14).fillColor("#c00").text(`${totalDebt.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });

  // Footer
  doc.fontSize(8).fillColor("#999").text(
    "Arm Roll ERP · Հայաստան · Ստեղծված է " + new Date().toLocaleString("hy-AM"),
    50, 820, { align: "center", width: 495 }
  );

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

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text("ARM ROLL", 50, 50, { width: 200 });
  doc.fontSize(8).font("Helvetica").fillColor("#666").text("ERP · ARMENIA", 50, 75, { width: 200 });
  doc.fillColor("#000");

  doc.fontSize(16).font("Helvetica-Bold").text("ԳՆՄԱՆ ՓԱՍՏԱԹՈՒԹԹ", 350, 50, { align: "right", width: 200 });
  doc.fontSize(10).font("Helvetica").text(po.number, 350, 72, { align: "right", width: 200 });
  doc.text(new Date(po.createdAt).toLocaleDateString("hy-AM"), 350, 86, { align: "right", width: 200 });

  doc.moveTo(50, 105).lineTo(545, 105).strokeColor("#999").lineWidth(0.5).stroke();

  // Supplier info
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#666").text("ՄԱՏԱԿԱՐԱՐ", 50, 120);
  doc.fontSize(11).font("Helvetica").fillColor("#000").text(po.supplier?.name ?? "—", 50, 135);
  doc.fontSize(9).font("Helvetica").fillColor("#666");
  if (po.supplier?.phone) doc.text(po.supplier.phone, 50, 152);
  if (po.supplier?.email) doc.text(po.supplier.email, 50, 166);
  if (po.supplier?.taxId) doc.text(`ՀՎՀՀ: ${po.supplier.taxId}`, 50, 180);

  // Status
  doc.fillColor("#000");
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#666").text("ԿԱՐԳԱՎԻՃԱԿ", 350, 120, { width: 195, align: "right" });
  doc.fontSize(12).font("Helvetica-Bold").fillColor(po.status === "RECEIVED" ? "#0a0" : "#c80").text(po.status, 350, 135, { width: 195, align: "right" });

  // Items table
  const tableTop = 210;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#666");
  doc.text("#", 50, tableTop, { width: 30 });
  doc.text("ԱՊՐԱՆՔ", 85, tableTop, { width: 200 });
  doc.text("ՔԱՆԱԿ", 340, tableTop, { width: 50, align: "right" });
  doc.text("ԳԻՆ", 410, tableTop, { width: 60, align: "right" });
  doc.text("ԳՈՒՄԱՐ", 480, tableTop, { width: 65, align: "right" });

  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#ccc").lineWidth(0.5).stroke();

  let y = tableTop + 25;
  po.items.forEach((item, idx) => {
    doc.fontSize(9).font("Helvetica").fillColor("#000");
    doc.text(String(idx + 1), 50, y, { width: 30 });
    doc.text(item.product?.name ?? "—", 85, y, { width: 200 });
    doc.text(`${item.qty} ${item.product?.unit?.symbol ?? ""}`, 340, y, { width: 50, align: "right" });
    doc.text(`${item.unitPrice.toLocaleString("hy-AM")} դր`, 410, y, { width: 60, align: "right" });
    doc.text(`${item.total.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });
    y += 18;
  });

  // Total
  y += 10;
  doc.moveTo(350, y).lineTo(545, y).strokeColor("#999").lineWidth(0.5).stroke();
  y += 10;
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text("ԸՆԴՀԱՆՈՒՐ՝", 350, y, { width: 130, align: "right" });
  doc.fontSize(14).text(`${po.totalAmount.toLocaleString("hy-AM")} դր`, 480, y, { width: 65, align: "right" });

  // Footer
  doc.fontSize(8).fillColor("#999").text(
    "Arm Roll ERP · Հայաստան · Ստեղծված է " + new Date().toLocaleString("hy-AM"),
    50, 820, { align: "center", width: 495 }
  );

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
