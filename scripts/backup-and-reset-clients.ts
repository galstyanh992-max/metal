import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const capturedAt = new Date().toISOString();
  const clients = await db.client.findMany();
  const clientIds = clients.map((client) => client.id);
  const orders = await db.order.findMany({ where: { clientId: { in: clientIds } } });
  const orderIds = orders.map((order) => order.id);

  const backup = {
    version: 1,
    capturedAt,
    clients,
    clientContacts: await db.clientContact.findMany({ where: { clientId: { in: clientIds } } }),
    clientAddresses: await db.clientAddress.findMany({ where: { clientId: { in: clientIds } } }),
    clientPhotos: await db.clientPhoto.findMany({ where: { clientId: { in: clientIds } } }),
    clientDocuments: await db.clientDocument.findMany({ where: { clientId: { in: clientIds } } }),
    clientComments: await db.clientComment.findMany({ where: { clientId: { in: clientIds } } }),
    loyaltyOverrides: await db.loyaltyOverride.findMany({ where: { clientId: { in: clientIds } } }),
    orders,
    orderItems: await db.orderItem.findMany({ where: { orderId: { in: orderIds } } }),
    orderItemParameters: await db.orderItemParameter.findMany({
      where: { orderItem: { orderId: { in: orderIds } } },
    }),
    payments: await db.orderPayment.findMany({ where: { orderId: { in: orderIds } } }),
    statusHistory: await db.orderStatusHistory.findMany({ where: { orderId: { in: orderIds } } }),
    generatedDocuments: await db.generatedDocument.findMany({ where: { entityId: { in: orderIds } } }),
    communications: await db.communicationLog.findMany({
      where: { OR: [{ clientId: { in: clientIds } }, { orderId: { in: orderIds } }] },
    }),
    aiProposals: await db.aiProposal.findMany({ where: { orderId: { in: orderIds } } }),
  };

  const backupDirectory = join(process.cwd(), "backups");
  await mkdir(backupDirectory, { recursive: true });
  const filePath = join(backupDirectory, `clients-before-reset-${capturedAt.replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, JSON.stringify(backup, null, 2), "utf8");

  await db.$transaction(async (tx) => {
    await tx.communicationLog.deleteMany({
      where: { OR: [{ clientId: { in: clientIds } }, { orderId: { in: orderIds } }] },
    });
    await tx.generatedDocument.deleteMany({ where: { entityId: { in: orderIds } } });
    await tx.aiProposal.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.orderPayment.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.orderItemParameter.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
    await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    await tx.clientContact.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.clientAddress.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.clientPhoto.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.clientDocument.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.clientComment.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.loyaltyOverride.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.client.deleteMany({ where: { id: { in: clientIds } } });
  });

  console.log(JSON.stringify({
    filePath,
    clientsRemoved: clients.length,
    ordersRemoved: orders.length,
    remainingClients: await db.client.count(),
    remainingOrders: await db.order.count(),
    remainingPayments: await db.orderPayment.count(),
  }));
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
