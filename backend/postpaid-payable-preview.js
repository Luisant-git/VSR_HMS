/**
 * POSTPAID payable preview / test helper.
 *
 * POSTPAID colleges bill the PREVIOUS calendar month. The frontend therefore
 * shows a fee as payable only when:
 *
 *   college.billingCycle === 'POSTPAID'
 *   && fee.status === 'PENDING'
 *   && resolvedBillingMonth(fee) === previousMonth
 *   && fee is not a FINE
 *
 * Everything else (current-month rent/EB, fines, mess, advance) is shown as
 * "Not Due" and has no Pay Now action.
 *
 * Default is READ-ONLY: it prints the student's pending fees and whether each
 * one is payable right now.
 *
 * Usage (run from the backend folder):
 *
 *   node postpaid-payable-preview.js jalsa
 *   node postpaid-payable-preview.js SEASIND26003
 *   node postpaid-payable-preview.js 7654323456
 *
 * To create a previous-month RENT fee so the UI shows a real Pay Now row:
 *
 *   node postpaid-payable-preview.js jalsa --seed
 *   node postpaid-payable-preview.js jalsa --seed --amount=6500
 *
 * Remove all preview rows created by --seed:
 *
 *   node postpaid-payable-preview.js jalsa --cleanup
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PREVIEW_TAG = '[POSTPAID-PREVIEW]';

const getBillingMonths = (now = new Date()) => {
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const previousMonthStr = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}`;
  return { currentMonthStr, previousMonthStr };
};

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const resolveFeeBillingMonth = fee => {
  const explicit = String(fee?.billingMonth || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(explicit)) return explicit;

  const description = String(fee?.description || '');

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

  const created = new Date(fee?.paidDate || fee?.createdAt || '');
  if (!Number.isNaN(created.getTime())) {
    return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
  }

  return null;
};

const isPostpaidPayableFee = (fee, previousMonthStr) => {
  const type = String(fee?.transactionType || '').toUpperCase();
  if (type.includes('FINE')) return false;
  return resolveFeeBillingMonth(fee) === previousMonthStr;
};

const isOutstandingInvoice = fee =>
  String(fee?.status || '') === 'PENDING' &&
  /^\s*outstanding\b/i.test(String(fee?.description || ''));

const parseArgs = argv => {
  const args = argv.slice(2);
  const query = args.find(arg => !arg.startsWith('--'));
  const flags = new Set(
    args
      .filter(arg => arg.startsWith('--') && !arg.includes('='))
      .map(arg => arg.slice(2).toLowerCase()),
  );
  const amountArg = args.find(arg => arg.startsWith('--amount='));
  const amount = amountArg ? Number(amountArg.split('=')[1]) : null;
  return { query, flags, amount };
};

const money = value =>
  `Rs.${(Number(value) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const printFeeTable = (fees, previousMonthStr, isPostpaid) => {
  const rows = fees
    .filter(fee => fee.status === 'PENDING' && !isOutstandingInvoice(fee))
    .sort((a, b) => {
      const aMonth = resolveFeeBillingMonth(a) || '';
      const bMonth = resolveFeeBillingMonth(b) || '';
      return aMonth.localeCompare(bMonth) || String(a.transactionType).localeCompare(String(b.transactionType));
    });

  const payableTotal = rows
    .filter(fee => !isPostpaid || isPostpaidPayableFee(fee, previousMonthStr))
    .reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);

  const notDueTotal = rows
    .filter(fee => isPostpaid && !isPostpaidPayableFee(fee, previousMonthStr))
    .reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);

  console.log('');
  console.log('  Type        Amount        Status    BillingMonth   Payable now?');
  console.log('  ----------  ------------  --------  -------------  ------------');

  if (rows.length === 0) {
    console.log('  (no pending fees)');
  }

  rows.forEach(fee => {
    const payable = !isPostpaid || isPostpaidPayableFee(fee, previousMonthStr);
    const type = String(fee.transactionType || 'UNKNOWN').padEnd(10);
    const amount = money(fee.amount).padEnd(12);
    const status = String(fee.status || '').padEnd(8);
    const month = String(resolveFeeBillingMonth(fee) || '-').padEnd(13);
    console.log(`  ${type}  ${amount}  ${status}  ${month}  ${payable ? 'YES' : 'no'}`);
  });

  console.log('  ------------------------------------------------------------------');
  console.log(`  Payable now:                 ${money(payableTotal)}`);
  if (isPostpaid) {
    console.log(`  Not due (current/future):    ${money(notDueTotal)}`);
  }
};

async function findStudent(query) {
  return prisma.student.findFirst({
    where: {
      OR: [
        { id: { equals: query } },
        { regNo: { equals: query, mode: 'insensitive' } },
        { manualRegsiName: { equals: query, mode: 'insensitive' } },
        { mobileNo: { equals: query } },
        { name: { equals: query, mode: 'insensitive' } },
      ],
    },
    include: {
      college: true,
      transactions: { orderBy: { createdAt: 'desc' } },
    },
  });
}

async function main() {
  const { query, flags, amount } = parseArgs(process.argv);
  const now = new Date();
  const { currentMonthStr, previousMonthStr } = getBillingMonths(now);

  if (!query) {
    console.error('Usage: node postpaid-payable-preview.js <student-id|regNo|manualRegsiName|mobile|name> [--seed] [--cleanup] [--amount=6500]');
    process.exitCode = 1;
    return;
  }

  const student = await findStudent(query);
  if (!student) {
    console.error(`Student not found: ${query}`);
    process.exitCode = 1;
    return;
  }

  const billingCycle = String(student.college?.billingCycle || 'PREPAID').toUpperCase();
  const isPostpaid = billingCycle === 'POSTPAID';

  console.log('============================================================');
  console.log(' POSTPAID payable preview');
  console.log('============================================================');
  console.log(` Student      : ${student.name} (${student.manualRegsiName || student.regNo})`);
  console.log(` Student id   : ${student.id}`);
  console.log(` College      : ${student.college?.name || '-'} / ${billingCycle}`);
  console.log(` Current month: ${currentMonthStr}`);
  console.log(` Previous month: ${previousMonthStr}`);
  console.log(` Rule         : payable only when billingMonth = ${previousMonthStr} (and not FINE)`);

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
  console.log(` Next cycle   : ${currentMonthStr} fees become payable on ${nextMonth.toLocaleDateString('en-GB')} (when ${nextMonthStr} starts).`);

  if (!isPostpaid) {
    console.log('');
    console.log(' NOTE: this student belongs to a PREPAID college, so all pending fees are payable.');
    console.log('       Set the college billing cycle to POSTPAID to use the postpaid rule.');
  }

  if (flags.has('cleanup')) {
    const result = await prisma.feeTransaction.deleteMany({
      where: {
        studentId: student.id,
        description: { contains: PREVIEW_TAG },
      },
    });
    console.log('');
    console.log(` Cleanup: deleted ${result.count} preview fee row(s).`);
    return;
  }

  if (flags.has('seed')) {
    if (!isPostpaid) {
      console.error('');
      console.error(' Cannot seed: the student college is not POSTPAID.');
      process.exitCode = 1;
      return;
    }

    const previewRows = student.transactions.filter(fee =>
      String(fee.description || '').includes(PREVIEW_TAG),
    );
    const existing = previewRows.find(
      fee =>
        fee.status === 'PENDING' &&
        fee.billingMonth === previousMonthStr &&
        String(fee.transactionType || '').toUpperCase() === 'RENT',
    );

    if (existing) {
      console.log('');
      console.log(` Preview RENT for ${previousMonthStr} already exists (${existing.id}) - nothing created.`);
    } else {
      const latestRent = student.transactions.find(
        fee => String(fee.transactionType || '').toUpperCase() === 'RENT',
      );
      const feeAmount =
        amount && amount > 0
          ? amount
          : Number(latestRent?.amount || student.rent || 0);

      if (!feeAmount || feeAmount <= 0) {
        console.error('');
        console.error(' Could not determine a rent amount. Pass --amount=<number>.');
        process.exitCode = 1;
        return;
      }

      // Due date is deliberately in the future so the fine cron does not start
      // accruing a fine against this preview fee.
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 10);
      dueDate.setHours(0, 0, 0, 0);

      const created = await prisma.feeTransaction.create({
        data: {
          studentId: student.id,
          transactionType: 'RENT',
          amount: feeAmount,
          status: 'PENDING',
          billingMonth: previousMonthStr,
          dueDate,
          description: `Postpaid previous-month rent preview ${PREVIEW_TAG}`,
        },
      });

      console.log('');
      console.log(` Seeded RENT ${money(feeAmount)} for ${previousMonthStr} (${created.id}).`);
      console.log(' Open the student profile or Fees page now - this row should show Pay Now.');
    }
  }

  const fees = await prisma.feeTransaction.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
  });

  printFeeTable(fees, previousMonthStr, isPostpaid);

  if (flags.has('seed')) {
    console.log('');
    console.log(' Remove the seeded row later with:');
    console.log(`   node postpaid-payable-preview.js ${student.manualRegsiName || student.regNo} --cleanup`);
  }
}

main()
  .catch(error => {
    console.error('Error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
