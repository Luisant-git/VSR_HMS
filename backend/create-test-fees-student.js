/**
 * Creates ONE test student with PENDING Rent + EB + separate Rent/EB fine rows,
 * so the Fees page and the Pay Now modal can be checked without touching any
 * React/frontend file.
 *
 * Run from the backend folder (uses backend/.env -> DATABASE_URL):
 *
 *   node create-test-fees-student.js
 *   node create-test-fees-student.js --delete   // remove the test data again
 *
 * The script is safe to re-run: it removes the previous demo student first,
 * then recreates it. It only touches rows whose ids/names start with "TEST".
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEMO = {
  studentId: 'test-fees-demo-student',
  regNo: 'TEST-FEE-DEMO-001',
  manualRegsiName: 'TESTFEE001',
  name: 'V. Sakthi (TEST)',
  mobileNo: '9012345678',
  roomId: 'TEST-FEES-ROOM',
  collegeName: 'TEST COLLEGE (Fees Demo)',
  rent: 6000,
  eb: 177.6,
  rentFinePerDay: 60,
  ebFinePerDay: 20,
  overdueDays: 12,
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const roundMoney = (value) => Math.round(value * 100) / 100;

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const daysAgo = (days) =>
  new Date(startOfToday().getTime() - days * 24 * 60 * 60 * 1000);

const getBillingInfo = () => {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  return { currentMonthStr, monthLabel };
};

async function removeDemoData() {
  const demoStudents = await prisma.student.findMany({
    where: {
      OR: [
        { id: DEMO.studentId },
        { regNo: DEMO.regNo },
        { manualRegsiName: DEMO.manualRegsiName },
      ],
    },
    select: { id: true },
  });

  const studentIds = demoStudents.map((student) => student.id);

  if (studentIds.length > 0) {
    await prisma.razorpayOrder.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.feeTransaction.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.gateLog.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.messAttendance.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.outpass.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.clearanceRecord.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    console.log(`Removed ${studentIds.length} demo student(s) and their fees.`);
  }

  const demoRoom = await prisma.room.findUnique({
    where: { id: DEMO.roomId },
    select: { id: true },
  });
  if (demoRoom) {
    const linkedStudents = await prisma.student.count({
      where: { roomNo: DEMO.roomId },
    });
    if (linkedStudents === 0) {
      await prisma.room.delete({ where: { id: DEMO.roomId } });
      console.log('Removed demo room.');
    }
  }

  const demoCollege = await prisma.college.findUnique({
    where: { name: DEMO.collegeName },
    select: { id: true },
  });
  if (demoCollege) {
    const linkedStudents = await prisma.student.count({
      where: { collegeId: demoCollege.id },
    });
    if (linkedStudents === 0) {
      await prisma.fineMaster.deleteMany({
        where: { collegeId: demoCollege.id },
      });
      await prisma.college.delete({ where: { id: demoCollege.id } });
      console.log('Removed demo college + fine master.');
    } else {
      console.log(
        `Demo college kept because ${linkedStudents} other student(s) still use it.`,
      );
    }
  }
}

async function createDemoData() {
  const { currentMonthStr, monthLabel } = getBillingInfo();
  // The fine cron counts the due date itself as day 1, so 12 days overdue
  // means the due date is 11 days before today.
  const dueDate = daysAgo(DEMO.overdueDays - 1);

  const room = await prisma.room.upsert({
    where: { id: DEMO.roomId },
    update: { occupiedCount: 1 },
    create: {
      id: DEMO.roomId,
      block: 'TEST',
      floor: 1,
      capacity: 1,
      type: 'Single',
      rent: DEMO.rent,
      messFee: 2000,
      occupiedCount: 1,
    },
  });

  const college = await prisma.college.upsert({
    where: { name: DEMO.collegeName },
    update: { dueDate, billingCycle: 'PREPAID' },
    create: {
      name: DEMO.collegeName,
      shortName: 'TEST',
      address: 'Demo college for fees testing',
      dueDate,
      billingCycle: 'PREPAID',
    },
  });

  await prisma.fineMaster.upsert({
    where: { collegeId: college.id },
    update: {
      rentFine: DEMO.rentFinePerDay,
      ebFine: DEMO.ebFinePerDay,
      messFine: 0,
    },
    create: {
      collegeId: college.id,
      rentFine: DEMO.rentFinePerDay,
      ebFine: DEMO.ebFinePerDay,
      messFine: 0,
    },
  });

  const student = await prisma.student.create({
    data: {
      id: DEMO.studentId,
      regNo: DEMO.regNo,
      manualRegsiName: DEMO.manualRegsiName,
      name: DEMO.name,
      mobileNo: DEMO.mobileNo,
      gender: 'Male',
      collegeId: college.id,
      roomNo: room.id,
      rent: DEMO.rent,
      advance: 0,
      status: 'In',
      feeStatus: 'Un-Paid',
      dateOfJoining: new Date(),
    },
  });

  const rentFine = roundMoney(DEMO.overdueDays * DEMO.rentFinePerDay);
  const ebFine = roundMoney(DEMO.overdueDays * DEMO.ebFinePerDay);

  await prisma.feeTransaction.createMany({
    data: [
      {
        studentId: student.id,
        transactionType: 'EB_BILL',
        amount: DEMO.eb,
        description: 'EB Bill (adjusted from fees sheet)',
        status: 'PENDING',
        billingMonth: currentMonthStr,
        dueDate,
      },
      {
        studentId: student.id,
        transactionType: 'RENT',
        amount: DEMO.rent,
        description: `Room Rent for ${monthLabel} | Ref: TXN4953537267`,
        status: 'PENDING',
        billingMonth: currentMonthStr,
        dueDate,
      },
      {
        studentId: student.id,
        transactionType: 'FINE',
        amount: rentFine,
        description: `Late fine accumulation - Rent for ${DEMO.overdueDays} days overdue (₹${DEMO.rentFinePerDay}/day)`,
        status: 'PENDING',
        billingMonth: currentMonthStr,
        dueDate,
      },
      {
        studentId: student.id,
        transactionType: 'FINE',
        amount: ebFine,
        description: `Late fine accumulation - EB for ${DEMO.overdueDays} days overdue (₹${DEMO.ebFinePerDay}/day)`,
        status: 'PENDING',
        billingMonth: currentMonthStr,
        dueDate,
      },
    ],
  });

  console.log('');
  console.log('✅ Test student created successfully');
  console.log('-----------------------------------');
  console.log(`Name      : ${student.name}`);
  console.log(`Reg No    : ${student.regNo}`);
  console.log(`Mobile No : ${student.mobileNo}  (use this in Student Portal)`);
  console.log(`Room      : ${room.id}`);
  console.log(`College   : ${college.name} (PREPAID)`);
  console.log(`Billing   : ${monthLabel} (${currentMonthStr})`);
  console.log('');
  console.log('Pending fee rows:');
  console.log(`  EB_BILL  ₹${DEMO.eb.toFixed(2)}  → EB FINE   ₹${ebFine.toFixed(2)}`);
  console.log(`  RENT     ₹${DEMO.rent.toFixed(2)}  → RENT FINE ₹${rentFine.toFixed(2)}`);
  console.log(`  Total fine: ₹${roundMoney(rentFine + ebFine).toFixed(2)}`);
  console.log('');
  console.log('Now open the Fees page, search for "TEST-FEE-DEMO-001"');
  console.log('(or "V. Sakthi (TEST)") and click Pay Now.');
  console.log('');
  console.log('Student Portal:');
  console.log(`  Open /student-portal and enter mobile number ${DEMO.mobileNo}`);
  console.log('  (accept the Terms and Conditions, then Continue).');
  console.log('');
  console.log('Expected in the Pay Now modal:');
  console.log('  EB_BILL  ₹177.60');
  console.log('    EB FINE   ₹240.00');
  console.log('  RENT     ₹6,000.00');
  console.log('    RENT FINE ₹720.00');
  console.log('');
  console.log('To remove this test data again:');
  console.log('  node create-test-fees-student.js --delete');
}

async function main() {
  const shouldDelete = process.argv.includes('--delete');

  if (shouldDelete) {
    await removeDemoData();
    return;
  }

  console.log('Resetting any previous demo data...');
  await removeDemoData();
  await createDemoData();
}

main()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
