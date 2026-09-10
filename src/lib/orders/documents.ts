import type { DocumentType, Prisma } from "@prisma/client";

export async function createOrderDocuments(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  paid: boolean,
) {
  const types: DocumentType[] = [
    "CUSTOMER_ORDER", "WAREHOUSE_ORDER", "INVOICE", "PROCUREMENT_DOCUMENT", "DELIVERY_NOTE",
  ];
  if (paid) types.push("PAYMENT_RECEIPT");
  await tx.generatedDocument.createMany({
    data: types.map((type) => ({
      templateId: `template-${type.toLowerCase()}`,
      templateVersion: 1,
      type,
      entityType: "ORDER",
      entityId: orderId,
      url: `/api/orders/${orderId}/pdf?type=${type}`,
      generatedById: userId,
    })),
  });
}
