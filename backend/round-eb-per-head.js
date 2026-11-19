/**
 * Round existing EB per-head amounts to whole rupees.
 *
 * The EB module now stores/charges rounded per-head shares. This one-off script
 * fixes rows created before that change:
 *   - EbBill.perStudentShare (all bills with a fractional share)
 *   - PENDING FeeTransaction rows of type EB_BILL with a fractional amount
 *
 * Paid EB fees and each bill's totalAmount are left untouched.
 *
 * Usage (from the backend folder):
 *   node round-eb-per-head.js           # DRY RUN - prints what would change
 *   node round-eb-per-head.js --apply   # writes to the DB in DATABASE_URL
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const isFractional = value => {
  const rounded = Math.round(Number(value) || 0);
  return Math.abs((Number(value) || 0) - rounded) > 0.000001;
};
const rupees = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Load the production environment before running this script.');
  }

  console.log('=================================================================');
  console.log(`--- Round EB per-head amounts ${APPLY ? '[APPLY]' : '[DRY RUN - NO CHANGES]'} ---`);
  console.log('=================================================================');

  const bills = await prisma.ebBill.findMany({
    where: { perStudentShare: { not: 0 } },
    orderBy: [{ billingCycle: 'asc' }, { roomNo: 'asc' }],
  });
  const billsToFix = bills.filter(bill => isFractional(bill.perStudentShare));

  const fees = await prisma.feeTransaction.findMany({
    where: { transactionType: 'EB_BILL', status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  const feesToFix = fees.filter(fee => isFractional(fee.amount));

  console.log(`\nBills to fix: ${billsToFix.length}`);
  console.table(
    billsToFix.map(bill => ({
      room: bill.roomNo,
      cycle: bill.billingCycle,
      old: rupees(bill.perStudentShare),
      new: rupees(Math.round(bill.perStudentShare)),
    })),
  );

  console.log(`\nPending EB fees to fix: ${feesToFix.length}`);
  console.table(
    feesToFix.map(fee => ({
      id: fee.id,
      description: fee.description,
      old: rupees(fee.amount),
      new: rupees(Math.round(fee.amount)),
    })),
  );

  if (billsToFix.length === 0 && feesToFix.length === 0) {
    console.log('\nNothing to round. All per-head amounts are already whole rupees.');
    return;
  }

  if (!APPLY) {
    console.log('\nDRY RUN: no database changes were made.');
    console.log('To apply, rerun with: node round-eb-per-head.js --apply');
    return;
  }

  await prisma.$transaction(async tx => {
    for (const bill of billsToFix) {
      const result = await tx.ebBill.updateMany({
        where: { id: bill.id, perStudentShare: bill.perStudentShare },
        data: { perStudentShare: Math.round(bill.perStudentShare) },
      });
      if (result.count !== 1) {
        throw new Error(`EB bill ${bill.id} changed since inspection. Rolling back.`);
      }
    }

    for (const fee of feesToFix) {
      const result = await tx.feeTransaction.updateMany({
        where: {
          id: fee.id,
          transactionType: 'EB_BILL',
          status: 'PENDING',
          amount: fee.amount,
        },
        data: { amount: Math.round(fee.amount) },
      });
      if (result.count !== 1) {
        throw new Error(`EB fee ${fee.id} changed since inspection. Rolling back.`);
      }
    }
  });

  console.log(`\nDone. Rounded ${billsToFix.length} bill(s) and ${feesToFix.length} pending fee row(s).`);
  console.log('Paid EB fees and room totals were not changed.');
}

main()
  .catch(error => {
    console.error('\nRounding failed:', error.message);
    console.error('No changes were made unless an APPLY run printed a success message above.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
