// Check RLS status across all tables in the public schema
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$queryRaw<{ 
    tablename: string; 
    rowsecurity: boolean; 
    forcerowsecurity: boolean;
    policies: bigint;
  }[]>`
    SELECT 
      c.relname AS tablename,
      c.relrowsecurity AS rowsecurity,
      c.relforcerowsecurity AS forcerowsecurity,
      COALESCE(p.policy_count, 0) AS policies
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN (
      SELECT polrelid, COUNT(*) AS policy_count
      FROM pg_policy
      GROUP BY polrelid
    ) p ON p.polrelid = c.oid
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
    ORDER BY c.relname;
  `
  
  console.log('TABLE NAME'.padEnd(40), 'RLS ENABLED'.padEnd(15), 'FORCED'.padEnd(10), 'POLICIES')
  console.log('-'.repeat(80))
  for (const row of result) {
    console.log(
      String(row.tablename).padEnd(40),
      String(row.rowsecurity).padEnd(15),
      String(row.forcerowsecurity).padEnd(10),
      String(row.policies)
    )
  }
  
  const rlsEnabled = result.filter(r => r.rowsecurity)
  const rlsDisabled = result.filter(r => !r.rowsecurity)
  console.log('\n=== SUMMARY ===')
  console.log(`Total tables: ${result.length}`)
  console.log(`RLS enabled:  ${rlsEnabled.length}`)
  console.log(`RLS disabled: ${rlsDisabled.length}`)
  if (rlsDisabled.length > 0) {
    console.log(`\nTables WITHOUT RLS:`)
    rlsDisabled.forEach(r => console.log(`  - ${r.tablename}`))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())