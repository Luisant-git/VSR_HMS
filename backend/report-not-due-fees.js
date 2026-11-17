require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;

const getBillingMonths = (now = new Date()) => {
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthStr = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
  return { currentMonthStr, previousMonthStr };
};

const resolveFeeBillingMonth = fee => {
  const explicit = String(fee.billingMonth || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(explicit)) return explicit;

  const description = String(fee.description || '');
  const isoMatch = description.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const namedMatch = description.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*(20\d{2})\b/i,
  );
  if (namedMatch) {
    const monthIndex = MONTH_NAMES.indexOf(namedMatch[1].toLowerCase());
    if (monthIndex >= 0) {
      return `${namedMatch[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
    }
  }

  const created = new Date(fee.paidDate || fee.createdAt || '');
  if (!Number.isNaN(created.getTime())) {
    return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
  }
  return null;
};

const isMessFee = fee =>
  String(fee.transactionType || '').trim().toUpperCase().startsWith('MESS');

const isOutstandingInvoice = fee =>
  fee.status === 'PENDING' &&
  !isMessFee(fee) &&
  String(fee.transactionType || '').toUpperCase() !== 'OUTSTANDING_PAYMENT' &&
  /^\s*outstanding\b/i.test(String(fee.description || ''));

const isOctoberEbBill = fee =>
  String(fee.transactionType || '').toUpperCase() === 'EB_BILL' &&
  /(?:\b2026-10\b|\boct(?:ober)?\s*2026\b)/i.test(String(fee.description || ''));

const isPreviousSettledFee = fee => {
  if (isOutstandingInvoice(fee) || isOctoberEbBill(fee)) return false;

  const description = String(fee.description || '');
  if (/november|december|2027/i.test(description)) return false;

  const dateValue = fee.paidDate || fee.createdAt;
  if (!dateValue) return true;
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) || date < new Date('2026-11-01T00:00:00');
};

const isImportedInvoice = fee => {
  if (isOutstandingInvoice(fee) || isOctoberEbBill(fee)) return false;

  const description = String(fee.description || '');
  if (/imported/i.test(description) || /october\s*2026\b/i.test(description)) return true;

  if (/november|december|2027/i.test(description)) return false;

  const created = new Date(fee.createdAt || '');
  return !Number.isNaN(created.getTime()) && created < new Date('2026-11-01T00:00:00');
};

const categoryOf = fee => {
  const type = String(fee.transactionType || '').toUpperCase();
  if (type.includes('RENT')) return 'rent';
  if (type.includes('EB') || type.includes('ELECTRIC')) return 'eb';
  if (type.includes('MESS')) return 'mess';
  if (type.includes('FINE')) return 'fine';
  if (type.includes('ADVANCE')) return 'advance';
  return 'other';
};

const isCycleRelevant = (fee, category, billingCycle, currentMonth, previousMonth) => {
  const feeMonth = resolveFeeBillingMonth(fee);
  if (!feeMonth) return true;

  if (billingCycle === 'POSTPAID') {
    if (category === 'fine') return true;
    return feeMonth === previousMonth || feeMonth === currentMonth;
  }

  if (category === 'rent' || category === 'advance') return feeMonth === currentMonth;
  if (category === 'eb' || category === 'fine') {
    return feeMonth === previousMonth || feeMonth === currentMonth;
  }
  return feeMonth === currentMonth || feeMonth === previousMonth;
};

const studentKeyOf = fee =>
  fee.student?.regNo || fee.student?.manualRegsiName || fee.studentId || 'unknown';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Load the production environment before running this report.');
  }

  const { currentMonthStr, previousMonthStr } = getBillingMonths();
  const rows = await prisma.feeTransaction.findMany({
    where: { status: 'PENDING' },
    select: {
      id: true,
      studentId: true,
      transactionType: true,
      amount: true,
      description: true,
      billingMonth: true,
      paidDate: true,
      createdAt: true,
      student: {
        select: {
          name: true,
          regNo: true,
          manualRegsiName: true,
          college: { select: { name: true, billingCycle: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const notDueByStudent = new Map();
  const payableStudents = new Set();

  for (const fee of rows) {
    if (isMessFee(fee)) continue;

    const category = categoryOf(fee);
    const billingCycle =
      String(fee.student?.college?.billingCycle || 'PREPAID').toUpperCase();
    const relevant = isCycleRelevant(
      fee,
      category,
      billingCycle,
      currentMonthStr,
      previousMonthStr,
    );

    if (isOutstandingInvoice(fee) || (isImportedInvoice(fee) && !relevant)) continue;
    if (isPreviousSettledFee(fee) && !relevant) continue;

    const studentKey = studentKeyOf(fee);
    if (relevant) {
      payableStudents.add(studentKey);
      continue;
    }

    if (!notDueByStudent.has(studentKey)) {
      notDueByStudent.set(studentKey, {
        student: fee.student,
        studentId: fee.studentId,
        total: 0,
        fees: [],
      });
    }

    const group = notDueByStudent.get(studentKey);
    const amount = Number(fee.amount) || 0;
    group.total += amount;
    group.fees.push({
      id: fee.id,
      type: fee.transactionType,
      amount,
      billingMonth: resolveFeeBillingMonth(fee) || 'Unknown',
      description: fee.description || '',
    });
  }

  const report = [...notDueByStudent.entries()]
    .filter(([studentKey, group]) => !payableStudents.has(studentKey) && group.total > 0.005)
    .map(([studentKey, group]) => ({
      studentKey,
      studentName: group.student?.name || 'Unknown',
      college: group.student?.college?.name || 'Unknown',
      billingCycle: group.student?.college?.billingCycle || 'PREPAID',
      total: roundMoney(group.total),
      fees: group.fees,
    }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  const total = roundMoney(report.reduce((sum, student) => sum + student.total, 0));
  const detailRows = report.flatMap(student =>
    student.fees.map(fee => ({
      student: student.studentName,
      studentKey: student.studentKey,
      college: student.college,
      billingCycle: student.billingCycle,
      type: fee.type,
      amount: roundMoney(fee.amount),
      billingMonth: fee.billingMonth,
      description: fee.description,
      feeId: fee.id,
    })),
  );

  console.log(`Billing months: previous=${previousMonthStr}, current=${currentMonthStr}`);
  console.log(`Students with a visible "Not Due" row: ${report.length}`);
  console.log(`Visible "Not Due" total: ₹${total.toFixed(2)}`);
  console.log('Per-student totals:');
  console.table(report.map(({ studentKey, studentName, college, billingCycle, total: amount }) => ({
    studentKey, studentName, college, billingCycle, total: `₹${amount.toFixed(2)}`,
  })));
  console.log('Fee details included in those rows:');
  console.table(detailRows);
}

main()
  .catch(error => {
    console.error('Could not generate the Not Due fees report:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });