/**
 * Script to delete tested / unwanted outstanding balance transactions for a student in production.
 *
 * Usage:
 *   node delete-student-outstanding.js
 *
 * Optional arguments:
 *   node delete-student-outstanding.js --dry-run             (Preview without deleting)
 *   node delete-student-outstanding.js SEASIND24044          (Specify a custom Reg No)
 *   node delete-student-outstanding.js SEASIND24044 --dry-run
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const customTarget = process.argv.find(arg => !arg.startsWith('--') && !arg.endsWith('.js'));

const TARGET_IDENTIFIER = customTarget || 'SEASIND24044';
const TARGET_NAME = 'Yogana';

async function main() {
  console.log('=================================================================');
  console.log(`--- Delete Outstanding Balance Script ${isDryRun ? '[DRY RUN - NO CHANGES]' : ''} ---`);
  console.log('=================================================================\n');

  // 1. Locate the student
  const student = await prisma.student.findFirst({
    where: {
      OR: [
        { manualRegsiName: { equals: TARGET_IDENTIFIER, mode: 'insensitive' } },
        { regNo: { equals: TARGET_IDENTIFIER, mode: 'insensitive' } },
        { manualRegsiName: { contains: TARGET_IDENTIFIER, mode: 'insensitive' } },
        { regNo: { contains: TARGET_IDENTIFIER, mode: 'insensitive' } },
        { name: { contains: TARGET_NAME, mode: 'insensitive' } },
      ],
    },
  });

  if (!student) {
    console.error(`❌ Student matching "${TARGET_IDENTIFIER}" or "${TARGET_NAME}" was not found in the database.`);
    process.exit(1);
  }

  console.log('Found Student:');
  console.log(` - ID:        ${student.id}`);
  console.log(` - Name:      ${student.name}`);
  console.log(` - Reg No:    ${student.regNo}`);
  console.log(` - Manual Reg:${student.manualRegsiName || 'N/A'}`);
  console.log(` - Room:      ${student.roomNo || 'N/A'}`);
  console.log(` - Fee Status:${student.feeStatus}\n`);

  // 2. Find all outstanding transactions for this student
  // In VSR HMS, outstanding invoices have description starting with "Outstanding"
  // and payments have transactionType === "OUTSTANDING_PAYMENT".
  const outstandingTxs = await prisma.feeTransaction.findMany({
    where: {
      studentId: student.id,
      OR: [
        { description: { startsWith: 'Outstanding', mode: 'insensitive' } },
        { transactionType: 'OUTSTANDING_PAYMENT' },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (outstandingTxs.length === 0) {
    console.log(`ℹ️  No outstanding balance transactions found for student ${student.name} (${student.manualRegsiName || student.regNo}).`);
    console.log('There is nothing to delete.');
    return;
  }

  console.log(`Found ${outstandingTxs.length} outstanding transaction(s) to remove:`);
  console.table(
    outstandingTxs.map(t => ({
      id: t.id,
      type: t.transactionType,
      amount: `₹${t.amount}`,
      status: t.status,
      invoiceNumber: t.invoiceNumber || '—',
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    }))
  );

  const totalOutstandingToDelete = outstandingTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  console.log(`Total amount in outstanding transactions: ₹${totalOutstandingToDelete}\n`);

  if (isDryRun) {
    console.log('🔍 DRY RUN active: No database changes were made.');
    console.log('Run without "--dry-run" to perform the deletion.');
    return;
  }

  // 3. Delete ONLY the outstanding transactions for this student
  const txIdsToDelete = outstandingTxs.map(t => t.id);

  const deleteResult = await prisma.feeTransaction.deleteMany({
    where: {
      id: { in: txIdsToDelete },
      studentId: student.id, // Double safety check: ensure studentId matches
    },
  });

  console.log(`✅ Successfully deleted ${deleteResult.count} outstanding transaction(s) for ${student.name}.`);

  // 4. Verification: check remaining transactions for the student
  const remainingTxs = await prisma.feeTransaction.findMany({
    where: { studentId: student.id },
  });

  console.log(`\nRemaining transactions for this student: ${remainingTxs.length}`);
  if (remainingTxs.length > 0) {
    console.table(
      remainingTxs.map(t => ({
        id: t.id,
        type: t.transactionType,
        amount: `₹${t.amount}`,
        status: t.status,
        description: t.description,
      }))
    );
  } else {
    console.log('All outstanding test entries have been removed. Outstanding balance is now ₹0.');
  }

  console.log('\n=================================================================');
  console.log('--- Cleanup Finished Successfully ---');
  console.log('=================================================================');
}

main()
  .catch(err => {
    console.error('❌ Error executing deletion script:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
