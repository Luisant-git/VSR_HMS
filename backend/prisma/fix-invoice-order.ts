import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allRows = await prisma.feeTransaction.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const rows = allRows.filter(
    row => row.invoiceNumber !== null && (row.paidDate !== null || row.createdAt !== null),
  );

  const counterByPeriod = new Map<string, number>();

  for (const row of rows) {
    const date = row.paidDate ?? row.createdAt ?? new Date();
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const next = (counterByPeriod.get(period) ?? 0) + 1;
    counterByPeriod.set(period, next);

    const invoiceNumber = `INV-${period}-${String(next).padStart(3, '0')}`;

    await prisma.feeTransaction.update({
      where: { id: row.id },
      data: { invoiceNumber },
    });
  }

  for (const [period, value] of counterByPeriod.entries()) {
    await prisma.invoiceCounter.upsert({
      where: { period },
      create: { period, value },
      update: { value },
    });
  }

  console.log(`Rebuilt invoice numbers for ${rows.length} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
