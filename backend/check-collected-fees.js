require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const target = 177.60;

async function main() {
  const rows = await prisma.feeTransaction.findMany({
    where: { status: 'COMPLETED' },
    select: {
      id: true,
      studentId: true,
      transactionType: true,
      amount: true,
      description: true,
      billingMonth: true,
      paidDate: true,
      createdAt: true,
      student: {
        select: {
          name: true,
          regNo: true,
          manualRegsiName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // These are candidate records, not proof that payment was received.
  const relevantRows = rows.filter(row => {
    const type = String(row.transactionType || '').toUpperCase();
    return !type.startsWith('MESS');
  });

  const total = relevantRows.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );

  console.log(`Completed non-Mess transactions found: ${relevantRows.length}`);
  console.log(`Their total (not necessarily the dashboard's scoped total): ₹${total.toFixed(2)}`);
  console.log(`Rows exactly equal to ₹${target.toFixed(2)}:`);

  const exactMatches = relevantRows.filter(
    row => Math.round((Number(row.amount) || 0) * 100) === Math.round(target * 100),
  );

  if (exactMatches.length === 0) {
    console.log('No individual transaction equals ₹177.60. Review the rows below for a combination.');
  } else {
    console.table(exactMatches.map(row => ({
      id: row.id,
      student: row.student?.name,
      regNo: row.student?.manualRegsiName || row.student?.regNo,
      type: row.transactionType,
      amount: Number(row.amount),
      billingMonth: row.billingMonth,
      description: row.description,
      paidDate: row.paidDate?.toISOString() || '',
      createdAt: row.createdAt.toISOString(),
    })));
  }

  console.log('All completed non-Mess rows for verification:');
  console.table(relevantRows.map(row => ({
    id: row.id,
    student: row.student?.name,
    regNo: row.student?.manualRegsiName || row.student?.regNo,
    type: row.transactionType,
    amount: Number(row.amount),
    billingMonth: row.billingMonth,
    description: row.description,
    paidDate: row.paidDate?.toISOString() || '',
    createdAt: row.createdAt.toISOString(),
  })));
}

main()
  .catch(error => {
    console.error('Could not inspect completed fee transactions:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });