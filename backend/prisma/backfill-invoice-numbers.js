/* eslint-disable no-console */
/**
 * One-time / safe backfill for fee invoice numbers.
 *
 * Only rows with a NULL invoiceNumber are touched, so running this again never
 * renumbers an existing invoice. The production database has already been
 * backfilled; this script is kept for fresh deployments or for rows created by
 * paths that do not allocate a number immediately.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const periodOf = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatInvoiceNumber = (date, serial) =>
  `INV-${periodOf(date)}-${String(serial).padStart(3, '0')}`;

(async () => {
  const rows = await prisma.feeTransaction.findMany({
    where: { invoiceNumber: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  if (rows.length === 0) {
    console.log('No rows need an invoice number.');
    await prisma.$disconnect();
    return;
  }

  const counters = new Map();

  for (const row of rows) {
    const date = row.paidDate || row.createdAt;
    const period = periodOf(date);

    let current = counters.get(period);
    if (current === undefined) {
      const counter = await prisma.invoiceCounter.findUnique({
        where: { period },
      });
      current = counter?.value || 0;
    }

    const next = current + 1;
    counters.set(period, next);

    const invoiceNumber = formatInvoiceNumber(date, next);
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

  console.log(`Backfilled ${rows.length} invoice number(s).`);
  console.log('Counters:', Object.fromEntries(counters));
  await prisma.$disconnect();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
