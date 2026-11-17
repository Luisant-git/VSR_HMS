require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const feeId = '5972a210-d56f-407e-80ae-3a86cbe85f25';
const expectedAmount = 177.6;

async function main() {
  const fee = await prisma.feeTransaction.findUnique({
    where: { id: feeId },
    select: {
      id: true,
      status: true,
      transactionType: true,
      amount: true,
      description: true,
    },
  });

  if (!fee) {
    throw new Error('Fee record not found. Nothing was changed.');
  }

  if (
    fee.status !== 'COMPLETED' ||
    fee.transactionType !== 'EB_BILL' ||
    Math.round(Number(fee.amount) * 100) !== Math.round(expectedAmount * 100) ||
    !String(fee.description || '').includes('2026-10')
  ) {
    throw new Error(
      'Fee does not match the expected completed October 2026 EB bill. Nothing was changed.',
    );
  }

  const result = await prisma.feeTransaction.updateMany({
    where: {
      id: feeId,
      status: 'COMPLETED',
      transactionType: 'EB_BILL',
      amount: expectedAmount,
      description: { contains: '2026-10' },
    },
    data: { status: 'PENDING' },
  });

  if (result.count !== 1) {
    throw new Error('Fee was not updated; it may have changed already. Check its current status.');
  }

  console.log(`Updated fee ${feeId} to PENDING.`);
  console.log('Refresh the Fees page to see the updated totals.');
}

main()
  .catch(error => {
    console.error('Fee status update failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });