const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.feeTransaction.findMany({
    where: {
      OR: [
        { transactionType: 'OUTSTANDING_PAYMENT' },
        { description: { startsWith: 'Outstanding', mode: 'insensitive' } },
      ],
    },
    include: { student: { select: { name: true, regNo: true, manualRegsiName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  console.table(rows.map(x => ({
    id: x.id.slice(-6),
    student: x.student?.name,
    type: x.transactionType,
    amount: x.amount,
    status: x.status,
    desc: (x.description || '').slice(0, 45),
    paidDate: x.paidDate,
    createdAt: x.createdAt,
  })));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
