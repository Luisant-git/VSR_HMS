require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const TARGET_REG_NO = 'SEASIND26332';
const APPLY_CHANGES = process.argv.includes('--apply');

const cents = amount => Math.round(Number(amount) * 100);
const referenceFrom = description =>
  String(description || '').match(/\bRef:\s*([A-Za-z0-9_-]+)/i)?.[1] || null;
const hasBillingPeriod = fee =>
  Boolean(
    fee.billingMonth ||
    /\b20\d{2}-(0[1-9]|1[0-2])\b/.test(String(fee.description || '')) ||
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*20\d{2}\b/i.test(
      String(fee.description || ''),
    ),
  );
const displayFee = fee => ({
  id: fee.id,
  type: fee.transactionType,
  amount: fee.amount,
  status: fee.status,
  description: fee.description,
  billingMonth: fee.billingMonth,
  createdAt: fee.createdAt,
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Load the production environment before running this script.');
  }

  const students = await prisma.student.findMany({
    where: {
      OR: [{ regNo: TARGET_REG_NO }, { manualRegsiName: TARGET_REG_NO }],
    },
    take: 2,
    select: {
      id: true,
      regNo: true,
      name: true,
      transactions: {
        where: {
          transactionType: { in: ['EB_BILL', 'FINE'] },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          studentId: true,
          transactionType: true,
          amount: true,
          description: true,
          status: true,
          billingMonth: true,
          createdAt: true,
        },
      },
    },
  });

  if (students.length === 0) {
    throw new Error(`Student ${TARGET_REG_NO} was not found. Nothing was changed.`);
  }
  if (students.length > 1) {
    throw new Error(`Student identifier ${TARGET_REG_NO} is ambiguous. Nothing was changed.`);
  }
  const student = students[0];

  const relevantFees = student.transactions.filter(
    fee =>
      fee.transactionType === 'EB_BILL' ||
      fee.transactionType === 'FINE',
  );
  const pendingFees = relevantFees.filter(fee => fee.status === 'PENDING');
  const pendingEbBills = pendingFees.filter(
    fee => fee.transactionType === 'EB_BILL',
  );
  const sheetRows = pendingEbBills.filter(fee =>
    /adjusted from fees sheet/i.test(String(fee.description || '')),
  );
  const monthlyRows = pendingEbBills.filter(
    fee =>
      !/adjusted from fees sheet/i.test(String(fee.description || '')) &&
      hasBillingPeriod(fee),
  );

  const duplicateIds = new Set();
  const duplicateGroups = [];

  for (const sheetFee of sheetRows) {
    const reference = referenceFrom(sheetFee.description);
    if (!reference) continue;

    const matches = monthlyRows.filter(
      fee =>
        cents(fee.amount) === cents(sheetFee.amount) &&
        referenceFrom(fee.description) === reference,
    );

    if (matches.length === 1) {
      const sheetMatches = sheetRows.filter(
        fee =>
          cents(fee.amount) === cents(matches[0].amount) &&
          referenceFrom(fee.description) === referenceFrom(matches[0].description),
      );
      if (sheetMatches.length === 1) {
        duplicateIds.add(sheetFee.id);
        duplicateGroups.push({
          reason: 'EB sheet-adjustment row duplicates a period-specific bill with the same amount and reference',
          keep: matches[0],
          remove: sheetFee,
        });
      } else {
        console.warn(
          `Skipping EB sheet row ${sheetFee.id}: another sheet row shares its amount and reference.`,
        );
      }
    } else if (matches.length > 1) {
      console.warn(
        `Skipping EB sheet row ${sheetFee.id}: its matching period bill is ambiguous or shared with another sheet row.`,
      );
    }
  }

  const ebFineRows = pendingFees.filter(
    fee =>
      fee.transactionType === 'FINE' &&
      /^late fine accumulation\s*-\s*eb\b/i.test(String(fee.description || '')),
  );
  if (ebFineRows.length > 1) {
    const [keep, ...duplicates] = [...ebFineRows].sort(
      (left, right) =>
        cents(right.amount) - cents(left.amount) ||
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
        left.id.localeCompare(right.id),
    );
    for (const fee of duplicates) duplicateIds.add(fee.id);
    duplicateGroups.push({
      reason: 'multiple pending late-fine rows tagged EB; the portal calculates one EB fine per student',
      keep,
      remove: duplicates,
    });
  }

  console.log(`Student: ${student.name} (${student.regNo})`);
  console.log(`Mode: ${APPLY_CHANGES ? 'APPLY' : 'DRY RUN — no database changes'}`);
  console.log('EB bills and typed late-fine records:');
  if (relevantFees.length === 0) {
    console.log('  No EB bill or late-fine transaction records found.');
  } else {
    for (const fee of relevantFees) {
      console.log(`  ${JSON.stringify(displayFee(fee))}`);
    }
  }

  if (duplicateGroups.length === 0) {
    console.log(
      '\nNo duplicate matched the automatic repair rules. No database rows were changed.',
    );
    return;
  }

  console.log('Duplicate groups:');
  for (const group of duplicateGroups) {
    console.log(`\n- ${group.reason}`);
    console.log(`  Keep: ${JSON.stringify(displayFee(group.keep))}`);
    const removed = Array.isArray(group.remove) ? group.remove : [group.remove];
    for (const fee of removed) {
      console.log(`  Remove: ${JSON.stringify(displayFee(fee))}`);
    }
  }

  if (!APPLY_CHANGES) {
    console.log('\nReview the rows above. Run with --apply only to remove these exact pending duplicates.');
    return;
  }

  const duplicateFees = student.transactions.filter(fee => duplicateIds.has(fee.id));
  await prisma.$transaction(async tx => {
    for (const fee of duplicateFees) {
      const result = await tx.feeTransaction.deleteMany({
        where: {
          id: fee.id,
          studentId: student.id,
          status: 'PENDING',
          transactionType: fee.transactionType,
          amount: fee.amount,
          description: fee.description,
        },
      });
      if (result.count !== 1) {
        throw new Error(
          `Fee ${fee.id} changed since inspection; transaction rolled back without deleting any rows.`,
        );
      }
    }
  });

  console.log(`\nRemoved ${duplicateFees.length} exact duplicate pending EB fee row(s) for ${TARGET_REG_NO}.`);
}

main()
  .catch(error => {
    console.error('Duplicate EB fee repair failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
