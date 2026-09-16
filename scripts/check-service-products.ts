// Check if service products (HARAKUM / ARAKUM) exist in catalog
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const serviceUnit = await db.unit.findUnique({ where: { code: "service" } })
  console.log('Service unit:', serviceUnit ? `${serviceUnit.code} — ${serviceUnit.name}` : 'NOT FOUND')
  
  const services = await db.product.findMany({
    where: { OR: [{ sku: "SVC-ASSEMBLY" }, { sku: "SVC-DELIVERY" }] },
    include: { unit: true }
  })
  console.log(`\nService products found: ${services.length}`)
  for (const s of services) {
    console.log(`  - SKU: ${s.sku}, Name: ${s.name}, Unit: ${s.unit?.code}, Active: ${s.active}, SalePrice: ${s.salePrice}`)
  }
  
  // Also check all products with service unit
  const allServiceProducts = await db.product.findMany({
    where: { unit: { code: "service" } },
    include: { unit: true }
  })
  console.log(`\nAll products with service unit: ${allServiceProducts.length}`)
  for (const s of allServiceProducts) {
    console.log(`  - SKU: ${s.sku}, Name: ${s.name}, Active: ${s.active}`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())