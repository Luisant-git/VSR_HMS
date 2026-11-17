node <<'NODE'
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const id = '5972a210-d56f-407e-80ae-3a86cbe85f25';

async function main() {
  const fee = await prisma.feeTransaction.findUnique({
    where: { id },
    select: { id: true, status: true, transactionType: true, amount: true, description: true },
  });

  if (
    !fee ||
    fee.status !== 'COMPLETED' ||
    fee.transactionType !== 'EB_BILL' ||
    Math.round(Number(fee.amount) * 100) !== 17760 ||
    !String(fee.description || '').includes('2026-10')
  ) {
    throw new Error('Record did not match the expected completed October EB bill; nothing changed.');
  }

  const updated = await prisma.feeTransaction.update({
    where: { id },
    data: { status: 'PENDING' },
    select: { id: true, status: true, transactionType: true, amount: true },
  });

  console.log('Updated fee:', updated);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
NODE