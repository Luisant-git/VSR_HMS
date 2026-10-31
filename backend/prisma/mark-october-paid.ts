import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Marking current Month 1 / October 2026 rent & mess fees as COMPLETED in production ---');

  // Find all pending rent & mess transactions for Month 1 / October 2026 (excluding genuine historical outstanding dues)
  const pendingTxs = await prisma.feeTransaction.findMany({
    where: {
      status: 'PENDING',
      transactionType: { in: ['RENT', 'MESS'] },
      NOT: {
        description: { startsWith: 'Outstanding' }
      },
      OR: [
        { description: { contains: 'Month 1', mode: 'insensitive' } },
        { description: { contains: 'Imported', mode: 'insensitive' } },
        { description: { contains: 'October 2026', mode: 'insensitive' } }
      ]
    },
    include: { student: true }
  });

  console.log(`Found ${pendingTxs.length} pending current-month transactions to mark as COMPLETED.`);

  if (pendingTxs.length === 0) {
    console.log('No pending Month 1 / October fees to update.');
    return;
  }

  const ids = pendingTxs.map(t => t.id);

  const updateResult = await prisma.feeTransaction.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'COMPLETED',
      paymentMode: 'CASH',
      paidDate: new Date()
    }
  });

  console.log(`Successfully updated ${updateResult.count} fee transactions to COMPLETED.`);
}

main()
  .catch(err => {
    console.error('Error updating transactions:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
