/**
 * Recover EB meter readings that the history page currently shows as 0.0.
 *
 * Problem:
 *   Older bills stored readings only in the legacy columns `prevReading` /
 *   `currReading`. The newer dual-meter columns (`normalPrevReading` /
 *   `normalCurrReading`) were added later with a default of 0. The history
 *   code uses `??`, which treats 0 as a real value, so it never falls back to
 *   the legacy columns and displays 0.0 for both readings.
 *
 * What this script does:
 *   1. Checks that the required columns exist (adds them with --apply if not).
 *   2. Lists every affected bill (old readings present, new columns = 0).
 *   3. In --apply mode: snapshots EbBill into a backup table, copies the old
 *      readings into the new columns, and verifies that current - previous
 *      still equals the stored unitsConsumed before committing.
 *
 * Usage (from the backend folder, with production DATABASE_URL in .env):
 *   node recover-eb-readings.js                       # DRY RUN - no changes
 *   node recover-eb-readings.js --cycle=2026-10       # preview one cycle
 *   node recover-eb-readings.js --apply               # write all fixed rows
 *   node recover-eb-readings.js --apply --cycle=2026-10
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const cycleArg = process.argv.find((arg) => arg.startsWith('--cycle='));
const CYCLE = cycleArg ? cycleArg.split('=')[1] : null;

// A row needs recovery only when a NEW column is 0 while the OLD column has a
// real reading. A genuine 0 reading (prev = 0 in both columns) is left alone.
const AFFECTED_WHERE = `
  "unitsConsumed" > 0
  AND (
    ("normalPrevReading" = 0 AND "prevReading" > 0)
    OR ("normalCurrReading" = 0 AND "currReading" > 0)
  )
  ${CYCLE ? 'AND "billingCycle" = $1' : ''}
`;
const params = CYCLE ? [CYCLE] : [];

const AFFECTED_SQL = `
  SELECT "id", "roomNo", "billingCycle",
         "prevReading", "currReading",
         "normalPrevReading", "normalCurrReading",
         "unitsConsumed"
  FROM "EbBill"
  WHERE ${AFFECTED_WHERE}
  ORDER BY "billingCycle" DESC, "roomNo"
`;

async function columnExists(column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'EbBill' AND column_name = $1`,
    column,
  );
  return rows.length > 0;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Point .env at the production database first.');
  }

  console.log('=================================================================');
  console.log(`--- Recover EB readings ${APPLY ? '[APPLY]' : '[DRY RUN - NO CHANGES]'} ---`);
  console.log(`--- Target: ${process.env.DATABASE_URL.split('@').pop()} ---`);
  console.log(`--- Cycle filter: ${CYCLE || 'ALL'} ---`);
  console.log('=================================================================');

  // The generated Prisma client expects the dual-meter columns. Older DBs do
  // not have them, so check with raw SQL (works on both schemas).
  const required = ['normalPrevReading', 'normalCurrReading'];
  const missing = [];
  for (const column of required) {
    if (!(await columnExists(column))) missing.push(column);
  }

  if (missing.length > 0) {
    console.log(`\nMissing columns: ${missing.join(', ')}`);
    if (!APPLY) {
      console.log('They will be added automatically when you run with --apply.');
      return;
    }
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "EbBill"
        ADD COLUMN IF NOT EXISTS "hasAcMeter"        boolean          NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "acPrevReading"     double precision NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "acCurrReading"     double precision NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "normalPrevReading" double precision NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "normalCurrReading" double precision NOT NULL DEFAULT 0
    `);
    console.log('Added the missing dual-meter columns.');
  }

  const affected = await prisma.$queryRawUnsafe(AFFECTED_SQL, ...params);

  if (affected.length === 0) {
    console.log('\nNothing to recover - no bills have readings in the old columns only.');
    return;
  }

  console.log(`\nAffected bills: ${affected.length}`);
  console.table(affected.map((bill) => ({
    room: bill.roomNo,
    cycle: bill.billingCycle,
    'old prev': Number(bill.prevReading),
    'old curr': Number(bill.currReading),
    'new prev': Number(bill.normalPrevReading),
    'new curr': Number(bill.normalCurrReading),
    units: Number(bill.unitsConsumed),
  })));

  if (!APPLY) {
    console.log('\nDRY RUN: no database changes were made.');
    console.log('To apply, rerun with: node recover-eb-readings.js --apply');
    return;
  }

  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const backupTable = `EbBill_recovery_backup_${stamp}`;
  await prisma.$executeRawUnsafe(`CREATE TABLE "${backupTable}" AS TABLE "EbBill"`);
  console.log(`\nBackup created: ${backupTable}`);

  const updateSql = `
    UPDATE "EbBill"
    SET "normalPrevReading" = CASE WHEN "normalPrevReading" = 0 AND "prevReading" > 0 THEN "prevReading" ELSE "normalPrevReading" END,
        "normalCurrReading" = CASE WHEN "normalCurrReading" = 0 AND "currReading" > 0 THEN "currReading" ELSE "normalCurrReading" END
    WHERE ${AFFECTED_WHERE}
  `;

  const ids = affected.map((bill) => bill.id);
  const verifySql = `
    SELECT "roomNo", "billingCycle", "unitsConsumed",
           ("normalCurrReading" - "normalPrevReading") AS "recomputed"
    FROM "EbBill"
    WHERE "id" = ANY($1)
      AND ABS(("normalCurrReading" - "normalPrevReading") - "unitsConsumed") > 0.000001
  `;

  await prisma.$transaction(async (tx) => {
    const result = await tx.$executeRawUnsafe(updateSql, ...params);
    console.log(`Updated ${result} bill(s).`);

    const mismatches = await tx.$queryRawUnsafe(verifySql, ids);
    if (mismatches.length > 0) {
      console.error('Verification failed, rolling back:', mismatches);
      throw new Error('Recomputed units did not match stored unitsConsumed.');
    }
  });

  const remaining = await prisma.$queryRawUnsafe(AFFECTED_SQL, ...params);
  console.log(`\nDone. ${affected.length} bill(s) recovered; ${remaining.length} still need attention.`);
  console.log('Reload the EB Bills page (hard refresh) to see the readings.');
  console.log(`If anything looks wrong, restore from: ${backupTable}`);
}

main()
  .catch((error) => {
    console.error('\nRecovery failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
