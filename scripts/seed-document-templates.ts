import { db } from '@/lib/db';

/**
 * Seed missing document templates (Armenia best-practice).
 * Adds the 3 templates missing from the base seed:
 *  - DEBT_STATEMENT (Պարտքի տեղեկագիր)
 *  - DELIVERY_NOTE (Հանձնման ակտ)
 *  - PROCUREMENT_DOCUMENT (Գնման փաստաթուղթ)
 */
const TEMPLATES = [
  {
    type: 'DEBT_STATEMENT',
    name: 'Պարտքի տեղեկագիր',
    bodyTemplate: [
      'ՊԱՐՏՔԻ ՏԵՂԵԿԱԳԻՐ',
      '',
      'Հաճախորդ՝ {{clientName}}',
      'ՀՎՀՀ՝ {{taxId}}',
      'Հեռախոս՝ {{phone}}',
      'Հասցե՝ {{address}}',
      'Ամսաթիվ՝ {{date}}',
      '',
      'Չվճարված պատվերներ՝',
      '{{items}}',
      '',
      'Ընդհանուր պարտք՝ {{totalDebt}} դրամ',
      'Վճարված՝ {{totalPaid}} դրամ',
      '',
      'Խնդրում ենք մարել պարտքը մինչև {{dueDate}}։',
    ].join('\n'),
  },
  {
    type: 'DELIVERY_NOTE',
    name: 'Հանձնման ակտ',
    bodyTemplate: [
      'ՀԱՆՁՆՄԱՆ ԱԿՏ',
      '',
      'Պատվեր՝ {{orderNumber}}',
      'Հաճախորդ՝ {{clientName}}',
      'Հասցե՝ {{address}}',
      'Ամսաթիվ՝ {{date}}',
      '',
      'Հանձնված ապրանքներ՝',
      '{{items}}',
      '',
      'Ստացող՝ ____________________',
      'Հանձնող՝ ____________________',
    ].join('\n'),
  },
  {
    type: 'PROCUREMENT_DOCUMENT',
    name: 'Գնման փաստաթուղթ',
    bodyTemplate: [
      'ԳՆՄԱՆ ՓԱՍՏԱԹՈՒՂԹ',
      '',
      'Մատակարար՝ {{supplierName}}',
      'ՀՎՀՀ՝ {{supplierTaxId}}',
      'Ամսաթիվ՝ {{date}}',
      '',
      'Ապրանքներ՝',
      '{{items}}',
      '',
      'Ընդհանուր՝ {{total}} դրամ',
      'ԱԱՀ՝ {{tax}} դրամ',
    ].join('\n'),
  },
];

async function main() {
  for (const t of TEMPLATES) {
    const existing = await db.documentTemplate.findFirst({ where: { type: t.type as any, version: 1 } });
    if (existing) {
      console.log(`SKIP (exists): ${t.type}`);
      continue;
    }
    await db.documentTemplate.create({
      data: { ...t, type: t.type as any, version: 1, active: true },
    });
    console.log(`CREATED: ${t.type}`);
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
