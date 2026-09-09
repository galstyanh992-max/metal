/**
 * Project knowledge base — Arm Roll ERP/CRM (Armenia).
 * The assistant answers ONLY from this knowledge + live Supabase data.
 * All answers are in Armenian.
 */

export const PROJECT_OVERVIEW = {
  name: "Arm Roll ERP/CRM",
  country: "Հայաստան",
  description:
    "Արտադրության և առևտրի կառավարման համակարգ՝ ռոլետների (գլանափաթեթավոր դռների) արտադրողի համար։",
  stack: "Next.js 16, React 19, Prisma, Supabase PostgreSQL, TailwindCSS 4",
};

export const ROLES: Record<string, string> = {
  ADMIN: "Ադմինիստրատոր — լիարժեք հասանելիություն բոլոր բաժիններին, կարգավորումներին և ֆինանսներին։",
  OPERATOR: "Օպերատոր — աշխատում է հաճախորդների, պատվերների, ապրանքների և հաղորդակցության հետ։",
  WAREHOUSE: "Պահեստի աշխատակից — տեսնում է պահեստը, ընտրում է պատվերները, ստանում մատակարարումներ։",
};

export const MODULES: { key: string; label: string; description: string; roles: string[] }[] = [
  { key: "dashboard", label: "Վահանակ", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"], description: "Գլխավոր էկրան՝ վաճառքի, պատվերների, պարտքերի և պահեստի ամփոփ ցուցանիշներով։" },
  { key: "clients-orders", label: "Հաճախորդներ և Պատվերներ", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"], description: "Հաճախորդների տվյալներ, պատվերների գրանցում և պատմություն։" },
  { key: "products", label: "Ապրանքներ", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"], description: "Ապրանքների կատալոգ՝ SKU-ներով, գներով, կատեգորիաներով և միավորներով։" },
  { key: "inventory", label: "Պահեստ", roles: ["ADMIN"], description: "Պահեստի մնացորդներ, շարժումներ, ընդունում, դուրսգրում և կարգավորում։" },
  { key: "picks", label: "Ընտրում", roles: ["WAREHOUSE"], description: "Պահեստի աշխատակցի ընտրման ցուցակ՝ պատվերների հավաքման համար։" },
  { key: "procurement", label: "Մատակարարում", roles: ["ADMIN"], description: "Գնման հայտեր, գնման պատվերներ և ստացումներ։" },
  { key: "suppliers", label: "Մատակարարներ", roles: ["ADMIN"], description: "Մատակարարների տվյալներ և կոնտակտներ։" },
  { key: "finance", label: "Ֆինանսներ", roles: ["ADMIN"], description: "Վճարումներ և պարտատերեր (պարտքերի ցանկ)։" },
  { key: "loyalty", label: "Հավատարմություն", roles: ["ADMIN"], description: "Հավատարմության մակարդակներ և զեղչեր։" },
  { key: "tax", label: "Հարկեր", roles: ["ADMIN"], description: "Հայաստանի հարկային կանոններ՝ ԱԱՀ, շրջանառության հարկ, շահութահարկ։" },
  { key: "documents", label: "Փաստաթղթեր", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"], description: "Փաստաթղթերի շաբլոններ և գեներացված PDF փաստաթղթեր։" },
  { key: "reports", label: "Հաշվետվություններ", roles: ["ADMIN"], description: "Վաճառքի, շահույթի և գանձումների վերլուծություն։" },
  { key: "comms", label: "Հաղորդակցություն", roles: ["ADMIN", "OPERATOR"], description: "Էլ․ նամակների և WhatsApp հաղորդագրությունների մատյան։" },
  { key: "ai", label: "AI Օգնական", roles: ["ADMIN", "OPERATOR"], description: "Նախագծի օգնական՝ պատասխանում է համակարգի և տվյալների վերաբերյալ հարցերին։" },
  { key: "forms", label: "Դինամիկ ձևեր", roles: ["ADMIN"], description: "Դինամիկ ձևերի կառուցում՝ դաշտերով և խմբերով։" },
  { key: "settings", label: "Կարգավորումներ", roles: ["ADMIN"], description: "Համակարգի կարգավորումներ, օգտատերեր և աուդիտ։" },
];

export const ORDER_STATUSES: Record<string, string> = {
  DRAFT: "Սևագիր",
  CONFIRMED: "Հաստատված",
  PICKING: "Ընտրման մեջ",
  READY: "Պատրաստ",
  DELIVERED: "Հանձնված",
  CANCELLED: "Չեղարկված",
};

export const CLIENT_STATUSES: Record<string, string> = {
  GREEN: "Կանաչ — վստահելի",
  YELLOW: "Դեղին — ուշադրություն",
  ORANGE: "Նարնջագույն — ռիսկային",
  RED: "Կարմիր — բարձր ռիսկ",
  CRITICAL: "Կրիտիկական",
};

export const DOCUMENT_TYPES: Record<string, string> = {
  CUSTOMER_ORDER: "Հաճախորդի պատվեր",
  WAREHOUSE_ORDER: "Պահեստի հանձնարարական",
  INVOICE: "Հաշիվ-ապրանքագիր",
  PAYMENT_RECEIPT: "Վճարման անդորրագիր",
  DEBT_STATEMENT: "Պարտքի տեղեկագիր",
  DELIVERY_NOTE: "Հանձնման ակտ",
  PROCUREMENT_DOCUMENT: "Գնման փաստաթուղթ",
};

export const HELP_TEXT = `Ես Arm Roll ERP/CRM համակարգի օգնականն եմ։ Կարող եմ պատասխանել հետևյալ հարցերին՝

• Հաճախորդներ — «Քանի հաճախորդ կա», «Գտիր հաճախորդին Արամ»
• Պատվերներ — «Վերջին պատվերները», «Քանի պատվեր կա»
• Ապրանքներ — «Քանի ապրանք կա», «Ցածր մնացորդով ապրանքներ»
• Պահեստ — «Պահեստի մնացորդ»
• Պարտքեր — «Ովքեր են պարտատերերը», «Ընդհանուր պարտք»
• Վաճառք — «Այսօրվա վաճառք», «Ամսական վաճառք»
• Մատակարարներ — «Մատակարարների ցանկ»
• Փաստաթղթեր — «Փաստաթղթերի շաբլոններ»
• Ձևեր — «Դինամիկ ձևեր»
• Համակարգ — «Ինչ բաժիններ կան», «Ինչպես գրանցել պատվեր»

Գրեք հարցը հայերեն։`;
