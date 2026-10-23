import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.feeTransaction.findMany({
    where: { invoiceNumber: { not: null } },
    orderBy: [{ paidDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });

  const counters = new Map<string, number>();

  for (const row of rows) {
    const date = row.paidDate ?? row.createdAt ?? new Date();
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const current = counters.get(period) ?? 0;
    const next = current + 1;
    counters.set(period, next);

    const invoiceNumber = `INV-${period}-${String(next).padStart(3, '0')}`;

    await prisma.feeTransaction.update({
      where: { id: row.id },
      data: { invoiceNumber },
    });

    await prisma.invoiceCounter.upsert({
      where: { period },
      create: { period, value: next },
      update: { value: next },
    });
  }

  console.log(`Repaired ${rows.length} invoice rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
