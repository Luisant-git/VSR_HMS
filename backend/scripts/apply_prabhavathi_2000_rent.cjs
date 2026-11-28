const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MOBILE_NO = '6369799049';
const SPECIAL_RENT_AMOUNT = 2000;
const TARGET_MONTHS = [
  { ym: '2026-11', label: 'November 2026' },
  { ym: '2026-12', label: 'December 2026' },
  { ym: '2027-01', label: 'January 2027' },
  { ym: '2027-02', label: 'February 2027' },
  { ym: '2027-03', label: 'March 2027' },
];

async function main() {
  const student = await prisma.student.findFirst({
    where: { mobileNo: MOBILE_NO },
    include: {
      college: true,
      transactions: {
        where: { deletedAt: null, transactionType: 'RENT' },
      },
    },
  });

  if (!student) {
    console.error(`Student with mobile ${MOBILE_NO} not found.`);
    process.exit(1);
  }

  const dueDay = student.college?.dueDate ? new Date(student.college.dueDate).getDate() : 5;

  for (const { ym, label } of TARGET_MONTHS) {
    const existing = student.transactions.find((t) => t.billingMonth === ym);
    if (existing) {
      if (existing.status === 'PENDING' && Number(existing.amount) !== SPECIAL_RENT_AMOUNT) {
        await prisma.feeTransaction.update({
          where: { id: existing.id },
          data: { amount: SPECIAL_RENT_AMOUNT },
        });
        console.log(`UPDATED ${ym}: existing PENDING RENT adjusted to ₹${SPECIAL_RENT_AMOUNT}`);
      } else {
        console.log(`SKIPPED ${ym}: already has RENT (${existing.status}, ₹${existing.amount})`);
      }
      continue;
    }

    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const clampedDay = Math.min(dueDay, lastDay);
    const dueDate = new Date(y, m - 1, clampedDay, 12, 0, 0);

    await prisma.feeTransaction.create({
      data: {
        studentId: student.id,
        transactionType: 'RENT',
        amount: SPECIAL_RENT_AMOUNT,
        status: 'PENDING',
        billingMonth: ym,
        dueDate,
        description: `Room Rent for ${label}`,
      },
    });
    console.log(`CREATED ${ym}: PENDING RENT ₹${SPECIAL_RENT_AMOUNT} (due ${dueDate.toISOString().slice(0, 10)})`);
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { feeStatus: 'Un-Paid' },
  });

  console.log(
    `Done for ${student.name} (${student.manualRegsiName || student.mobileNo}). From 2027-04 (April 2027) onwards, full rent ₹${student.rent} will be billed automatically.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
