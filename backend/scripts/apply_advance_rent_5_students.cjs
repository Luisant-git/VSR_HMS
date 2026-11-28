const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Each entry specifies the last FULL month covered (YYYY-MM) and any partial
// advance balance (in INR) to be auto-deducted from the following month's rent.
const UPDATES = [
  {
    name: 'Devananda Dipin',
    mobileNo: '8848462856',
    paidThroughFullMonth: '2027-09', // Paid till Sep 2027
    advanceRentBalance: 0,
  },
  {
    name: 'Sana Fathima',
    mobileNo: '8848858006',
    paidThroughFullMonth: '2027-02', // Full months through Feb 2027; ₹4,250 toward Mar 2027
    advanceRentBalance: 4250,
  },
  {
    name: 'J Jusro',
    mobileNo: '6282569437',
    paidThroughFullMonth: '2027-01', // Full months through Jan 2027; ₹7,750 toward Feb 2027
    advanceRentBalance: 7750,
  },
  {
    name: 'Nazrin T R',
    mobileNo: '7736767688',
    paidThroughFullMonth: '2027-01', // Full months through Jan 2027; ₹7,750 toward Feb 2027
    advanceRentBalance: 7750,
  },
  {
    name: 'FIDHA MOL M',
    mobileNo: '9361054039',
    paidThroughFullMonth: '2026-12', // Full months through Dec 2026; ₹3,750 toward Jan 2027
    advanceRentBalance: 3750,
  },
];

function endOfMonthNoon(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0, 12, 0, 0);
}

async function main() {
  for (const item of UPDATES) {
    const student = await prisma.student.findFirst({
      where: { mobileNo: item.mobileNo },
      select: { id: true, name: true, mobileNo: true, manualRegsiName: true, rent: true },
    });

    if (!student) {
      console.warn(`NOT FOUND: ${item.name} (${item.mobileNo})`);
      continue;
    }

    const rentPaidUntil = endOfMonthNoon(item.paidThroughFullMonth);

    await prisma.student.update({
      where: { id: student.id },
      data: {
        rentPaidUntil,
        advanceRentBalance: item.advanceRentBalance,
      },
    });

    console.log(
      `UPDATED: ${student.name} (${student.manualRegsiName || student.mobileNo}) -> rentPaidUntil=${item.paidThroughFullMonth} (${rentPaidUntil.toISOString().slice(0, 10)}), advanceRentBalance=₹${item.advanceRentBalance}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
