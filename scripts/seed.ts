import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding ERP...");

  // Units
  const units = [
    { code: "piece", name: "Հատ", symbol: "հատ" },
    { code: "m", name: "Մետր", symbol: "մ" },
    { code: "m2", name: "Քառակուսի մետր", symbol: "մ²" },
    { code: "kg", name: "Կիլոգրամ", symbol: "կգ" },
    { code: "roll", name: "Ռուլոն", symbol: "ռուլ" },
    { code: "kit", name: "Հավաքածու", symbol: "կոմպլ" },
  ];
  for (const u of units) {
    await db.unit.upsert({ where: { code: u.code }, update: {}, create: u });
  }

  // Categories
  const catBlinds = await db.category.upsert({
    where: { id: "cat-blinds" },
    update: {},
    create: { id: "cat-blinds", name: "Մետաղական ջալուզիներ", sortOrder: 1 },
  });
  const catProfiles = await db.category.upsert({
    where: { id: "cat-profiles" },
    update: {},
    create: { id: "cat-profiles", name: "Պրոֆիլներ", sortOrder: 2 },
  });
  const catAccessories = await db.category.upsert({
    where: { id: "cat-accessories" },
    update: {},
    create: { id: "cat-accessories", name: "Աքսեսուարներ", sortOrder: 3 },
  });
  const catMotors = await db.category.upsert({
    where: { id: "cat-motors" },
    update: {},
    create: { id: "cat-motors", name: "Մոտորներ և մեխանիզմներ", sortOrder: 4 },
  });

  // Loyalty tiers
  const tiers = [
    { id: "tier-bronze", name: "Բրոնզ", thresholdTurnover: 0, discountPercent: 0, sortOrder: 1 },
    { id: "tier-silver", name: "Արծաթ", thresholdTurnover: 500000, discountPercent: 3, sortOrder: 2 },
    { id: "tier-gold", name: "Ոսկի", thresholdTurnover: 2000000, discountPercent: 5, sortOrder: 3 },
    { id: "tier-platinum", name: "Պլատին", thresholdTurnover: 5000000, discountPercent: 8, sortOrder: 4 },
  ];
  for (const t of tiers) {
    await db.loyaltyTier.upsert({ where: { id: t.id }, update: {}, create: t });
  }

  // Users — minimum 2 admins
  const pw = (s: string) => bcrypt.hashSync(s, 10);
  const users = [
    { id: "user-admin-1", email: "admin1@blinds.am", name: "Ադմին Մեկ", role: "ADMIN" as const, passwordHash: pw("admin123") },
    { id: "user-admin-2", email: "admin2@blinds.am", name: "Ադմին Երկու", role: "ADMIN" as const, passwordHash: pw("admin123") },
    { id: "user-op-1", email: "operator@blinds.am", name: "Օպերատոր Մեկ", role: "OPERATOR" as const, passwordHash: pw("operator123") },
    { id: "user-wh-1", email: "warehouse@blinds.am", name: "Պահեստապետ Մեկ", role: "WAREHOUSE" as const, passwordHash: pw("warehouse123") },
  ];
  for (const u of users) {
    await db.user.upsert({ where: { email: u.email }, update: {}, create: u });
  }

  // Suppliers
  const sup1 = await db.supplier.upsert({
    where: { id: "sup-1" },
    update: {},
    create: { id: "sup-1", name: "ArmProfile LLC", taxId: "12345678", phone: "+374 10 555 555", email: "sales@armprofile.am", paymentTerms: "30 օր" },
  });

  // Products
  const unitPiece = await db.unit.findUnique({ where: { code: "piece" } });
  const unitM = await db.unit.findUnique({ where: { code: "m" } });
  const unitM2 = await db.unit.findUnique({ where: { code: "m2" } });
  const unitRoll = await db.unit.findUnique({ where: { code: "roll" } });

  if (unitPiece && unitM && unitM2 && unitRoll) {
    const products = [
      { sku: "MB-AL-50", name: "Ալյումինե ջալուզի 50մմ", categoryId: catBlinds.id, unitId: unitM2.id, color: "սպիտակ", salePrice: 18500, purchasePrice: 12000, minStock: 0 },
      { sku: "MB-AL-80", name: "Ալյումինե ջալուզի 80մմ", categoryId: catBlinds.id, unitId: unitM2.id, color: "սպիտակ", salePrice: 22500, purchasePrice: 15000, minStock: 0 },
      { sku: "MB-AL-50-BK", name: "Ալյումինե ջալուզի 50մմ սև", categoryId: catBlinds.id, unitId: unitM2.id, color: "սև", salePrice: 19500, purchasePrice: 13000, minStock: 0 },
      { sku: "PRF-LAD-50", name: "Լադդեր պարան 50մմ", categoryId: catProfiles.id, unitId: unitM.id, salePrice: 350, purchasePrice: 180, minStock: 200 },
      { sku: "PRF-LAD-80", name: "Լադդեր պարան 80մմ", categoryId: catProfiles.id, unitId: unitM.id, salePrice: 420, purchasePrice: 220, minStock: 150 },
      { sku: "PRF-HEAD-50", name: "Գլխավոր պրոֆիլ 50մմ", categoryId: catProfiles.id, unitId: unitM.id, salePrice: 1800, purchasePrice: 1100, minStock: 50 },
      { sku: "PRF-BOT-50", name: "Ներքևի պրոֆիլ 50մմ", categoryId: catProfiles.id, unitId: unitM.id, salePrice: 1500, purchasePrice: 950, minStock: 50 },
      { sku: "ACC-CLIP-50", name: "Կլիպս 50մմ", categoryId: catAccessories.id, unitId: unitPiece.id, salePrice: 80, purchasePrice: 35, minStock: 500 },
      { sku: "ACC-SCREW", name: "Պտուտակ 4x20", categoryId: catAccessories.id, unitId: unitPiece.id, salePrice: 25, purchasePrice: 10, minStock: 1000 },
      { sku: "ACC-CORD", name: "Կառավարման պարան", categoryId: catAccessories.id, unitId: unitM.id, salePrice: 200, purchasePrice: 100, minStock: 300 },
      { sku: "MOT-TUB-50", name: "Տուբուլյար մոտոր 50մմ", categoryId: catMotors.id, unitId: unitPiece.id, salePrice: 45000, purchasePrice: 32000, minStock: 5 },
      { sku: "MOT-CTL-RF", name: "Ռադիո կառավարման վահանակ", categoryId: catMotors.id, unitId: unitPiece.id, salePrice: 18000, purchasePrice: 11000, minStock: 3 },
    ];
    for (const p of products) {
      await db.product.upsert({
        where: { sku: p.sku },
        update: {},
        create: { ...p, productSupplier: { create: { supplierId: sup1.id } } } as any,
      });
    }

    // Inventory seed — some RECEIVE movements
    const admin = await db.user.findUnique({ where: { email: "admin1@blinds.am" } });
    if (admin) {
      const initialStock: { sku: string; qty: number }[] = [
        { sku: "PRF-LAD-50", qty: 500 },
        { sku: "PRF-LAD-80", qty: 300 },
        { sku: "PRF-HEAD-50", qty: 80 },
        { sku: "PRF-BOT-50", qty: 80 },
        { sku: "ACC-CLIP-50", qty: 1200 },
        { sku: "ACC-SCREW", qty: 3000 },
        { sku: "ACC-CORD", qty: 600 },
        { sku: "MOT-TUB-50", qty: 8 },
        { sku: "MOT-CTL-RF", qty: 5 },
      ];
      for (const s of initialStock) {
        const prod = await db.product.findUnique({ where: { sku: s.sku } });
        if (!prod) continue;
        const existing = await db.inventoryMovement.findFirst({
          where: { productId: prod.id, type: "RECEIVE", refType: "SEED" },
        });
        if (existing) continue;
        await db.inventoryMovement.create({
          data: {
            productId: prod.id,
            type: "RECEIVE",
            qty: s.qty,
            refType: "SEED",
            refId: "seed-initial",
            byUserId: admin.id,
            note: "Սկզբնական մնացորդ",
          },
        });
        await db.inventorySnapshot.upsert({
          where: { productId: prod.id },
          update: { onHand: s.qty, reserved: 0 },
          create: { productId: prod.id, onHand: s.qty, reserved: 0 },
        });
      }
    }
  }

  // Form templates
  const orderForm = await db.formTemplate.upsert({
    where: { id: "form-order-item-v1" },
    update: {},
    create: {
      id: "form-order-item-v1",
      name: "Ջալուզիի պատվերի ձև",
      entityType: "ORDER_ITEM",
      version: 1,
      active: true,
      groups: {
        create: [
          {
            label: "Հիմնական պարամետրեր",
            sortOrder: 1,
            fields: {
              create: [
                { key: "width", label: "Լայնություն (մմ)", type: "DIMENSION", required: true, sortOrder: 1, validation: JSON.stringify({ min: 100, max: 5000 }) },
                { key: "height", label: "Բարձրություն (մմ)", type: "DIMENSION", required: true, sortOrder: 2, validation: JSON.stringify({ min: 100, max: 5000 }) },
                { key: "quantity", label: "Քանակ", type: "QUANTITY", required: true, sortOrder: 3, defaultValue: "1", validation: JSON.stringify({ min: 1, max: 999 }) },
                { key: "color", label: "Գույն", type: "SELECT", required: true, sortOrder: 4, options: JSON.stringify(["սպիտակ", "սև", "մոխրագույն", "բեժ", "ոսկեգույն"]) },
              ],
            },
          },
          {
            label: "Տեխնիկական պարամետրեր",
            sortOrder: 2,
            fields: {
              create: [
                { key: "profileType", label: "Պրոֆիլի տեսակ", type: "SELECT", required: true, sortOrder: 1, options: JSON.stringify(["50մմ", "80մմ"]) },
                { key: "material", label: "Նյութ", type: "SELECT", required: true, sortOrder: 2, options: JSON.stringify(["ալյումին", "պողպատ"]) },
                { key: "operation", label: "Կառավարում", type: "SELECT", required: true, sortOrder: 3, options: JSON.stringify(["ձեռքով", "մոտորով"]) },
                { key: "motor", label: "Մոտոր", type: "SELECT", required: false, sortOrder: 4, options: JSON.stringify(["չկա", "տուբուլյար", "շղթայակաթվածային"]), conditionExpr: "operation == 'մոտորով'" },
                { key: "guides", label: "Ուղղորդողներ", type: "SELECT", required: false, sortOrder: 5, options: JSON.stringify(["չկա", "կողային", "մալուխային"]) },
              ],
            },
          },
          {
            label: "Աքսեսուարներ և տեղադրում",
            sortOrder: 3,
            fields: {
              create: [
                { key: "accessories", label: "Լրացուցիչ աքսեսուարներ", type: "MULTISELECT", required: false, sortOrder: 1, options: JSON.stringify(["կողպեք", "ապահովիչ կաթիլ", "ռադիո կառավարման վահանակ", "հեռախոսային հավելված"]) },
                { key: "installation", label: "Տեղադրման տարբերակ", type: "SELECT", required: false, sortOrder: 2, options: JSON.stringify(["ինքնուրույն", "մեր մասնագետով", "չպահանջվում է"]) },
                { key: "note", label: "Նշում", type: "TEXTAREA", required: false, sortOrder: 3 },
              ],
            },
          },
        ],
      },
    },
  });

  // Document templates
  const docTemplates = [
    { type: "CUSTOMER_ORDER", name: "Հաճախորդի պատվեր", bodyTemplate: "ՀԱՃԱԽՈՐԴԻ ՊԱՏՎԵՐ {{orderNumber}}\n\nՀաճախորդ՝ {{clientName}}\nԱմսաթիվ՝ {{date}}\n\nՊատվերված ապրանքներ՝\n{{items}}\n\nԸնդհանուր՝ {{total}} դրամ" },
    { type: "WAREHOUSE_ORDER", name: "Պահեստի հանձնարարական", bodyTemplate: "ՊԱՀԵՍՏԻ ՀԱՆՁՆԱՐԱՐԱԿԱՆ {{orderNumber}}\n\nԱպրանքներ՝\n{{items}}\n\nԿարգավիճակ՝ ԸՆՏՐԵԼ ԵՎ ՏՐԱՄԱԴՐԵԼ" },
    { type: "INVOICE", name: "Հաշիվ-ապրանքագիր", bodyTemplate: "ՀԱՇԻՎ-ԱՊՐԱՆՔԱԳԻՐ {{orderNumber}}\n\nՀաճախորդ՝ {{clientName}}\n{{items}}\n\nԸնդհանուր՝ {{total}} դրամ\nԱԱՀ ըստ հարկային ռեժիմի՝ {{tax}}" },
    { type: "PAYMENT_RECEIPT", name: "Վճարման անդորրագիր", bodyTemplate: "ՎՃԱՐՄԱՆ ԱՆԴՈՐՐԱԳԻՐ\n\nՍտացող՝ {{companyName}}\nՎճարող՝ {{clientName}}\nԳումար՝ {{amount}} դրամ\nԱմսաթիվ՝ {{date}}\nՄեթոդ՝ {{method}}" },
  ];
  for (const t of docTemplates) {
    await db.documentTemplate.upsert({
      where: { type_version: { type: t.type as any, version: 1 } },
      update: {},
      create: { ...t, type: t.type as any, version: 1, active: true },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
