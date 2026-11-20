/**
 * Remove fee transaction rows for discontinued students.
 *
 * This deletes fee rows only. It does not delete students, clearance records,
 * Razorpay orders, or invoice counters, and it does not issue refunds.
 *
 * Run from the backend folder:
 *   node remove-discontinued-student-fees.js --student=SEASIND25032
 *                                                               # preview Catharine's rows
 *   node remove-discontinued-student-fees.js --student=SEASIND25032 --apply
 *                                                               # delete Catharine's rows
 *   node remove-discontinued-student-fees.js --student=SEASIND25032 --apply --allow-gateway-records
 *                                                               # only after reviewing Razorpay references
 *   node remove-discontinued-student-fees.js                    # preview all configured students
 *   node remove-discontinued-student-fees.js --apply --all-targets
 *                                                               # delete all configured students' rows
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const ALLOW_GATEWAY_RECORDS = process.argv.includes('--allow-gateway-records');
const ALL_TARGETS = process.argv.includes('--all-targets');
const studentArg = process.argv.find(arg => arg.startsWith('--student='));
const SELECTED_STUDENT = studentArg ? studentArg.split('=').slice(1).join('=').trim().toUpperCase() : null;

const TARGETS = [
  { regNo: 'SEASIND25193', nameFragment: 'arthi' },
  { regNo: 'SEASIND26325', nameFragment: 'sweethika' },
  { regNo: 'SEASIND25032', nameFragment: 'bershiya' },
];

const rupees = value => `₹${Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function showDatabase(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname || '/'}`;
  } catch {
    return '(could not parse DATABASE_URL)';
  }
}

function printTransactions(rows) {
  console.table(rows.map(row => ({
    id: row.id,
    studentId: row.studentId,
    invoiceNumber: row.invoiceNumber || '—',
    type: row.transactionType,
    amount: rupees(row.amount),
    status: row.status,
    billingMonth: row.billingMonth || '—',
    razorpayOrder: row.razorpayOrderId || '—',
    razorpayPayment: row.razorpayPaymentId || '—',
  })));
}

async function findTargetStudent(target) {
  const students = await prisma.student.findMany({
    where: {
      OR: [
        { regNo: { equals: target.regNo, mode: 'insensitive' } },
        { manualRegsiName: { equals: target.regNo, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      regNo: true,
      manualRegsiName: true,
      status: true,
    },
  });

  if (students.length !== 1) {
    throw new Error(
      `${target.regNo}: expected exactly one matching student, found ${students.length}. Nothing was changed.`,
    );
  }

  const student = students[0];
  if (!String(student.name || '').toLowerCase().includes(target.nameFragment)) {
    throw new Error(
      `${target.regNo} resolved to "${student.name}", which does not match the expected name. Nothing was changed.`,
    );
  }

  return student;
}

async function main() {
  if (SELECTED_STUDENT && ALL_TARGETS) {
    throw new Error('Use either --student=REG_NO or --all-targets, not both.');
  }
  if (APPLY && !SELECTED_STUDENT && !ALL_TARGETS) {
    throw new Error('For safety, specify --student=REG_NO or --all-targets when using --apply.');
  }

  const targets = SELECTED_STUDENT
    ? TARGETS.filter(target => target.regNo === SELECTED_STUDENT)
    : TARGETS;
  if (SELECTED_STUDENT && targets.length !== 1) {
    throw new Error(`Unknown target ${SELECTED_STUDENT}. No database changes were made.`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Load the intended database environment before running this script.');
  }

  console.log('=================================================================');
  console.log(`--- Remove discontinued students' fee rows ${APPLY ? '[APPLY]' : '[DRY RUN - NO CHANGES]'} ---`);
  console.log('=================================================================');
  console.log(`Target database: ${showDatabase(url)} (credentials hidden)`);
  console.log(`Targets: ${targets.map(target => `${target.regNo} (${target.nameFragment})`).join(', ')}`);
  console.log('Only FeeTransaction rows are in scope; student and Razorpay order records are retained.');

  const students = await Promise.all(targets.map(findTargetStudent));
  console.log('\nMatched students:');
  console.table(students.map(student => ({
    id: student.id,
    name: student.name,
    regNo: student.regNo,
    manualRegsiName: student.manualRegsiName || '—',
    status: student.status,
  })));

  const studentIds = students.map(student => student.id);
  const rows = await prisma.feeTransaction.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: [{ studentId: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      studentId: true,
      invoiceNumber: true,
      transactionType: true,
      amount: true,
      status: true,
      billingMonth: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
    },
  });

  console.log(`\nFee transaction rows found: ${rows.length}`);
  printTransactions(rows);

  if (rows.length === 0) {
    console.log('\nNo fee transaction rows found. Nothing to remove.');
    return;
  }

  const gatewayRows = rows.filter(row => row.razorpayOrderId || row.razorpayPaymentId);
  if (gatewayRows.length > 0) {
    console.warn(
      `\nWARNING: ${gatewayRows.length} row(s) reference Razorpay. Deleting fee rows does not cancel or refund gateway payments.`,
    );
    if (APPLY && !ALLOW_GATEWAY_RECORDS) {
      throw new Error(
        'No rows were deleted. Review the Razorpay references, then rerun with --apply --allow-gateway-records only if this deletion is intended.',
      );
    }
  }

  if (!APPLY) {
    console.log('\nDRY RUN: no database changes were made.');
    console.log('Review the exact rows above. To delete only this student, rerun with --student=REG_NO --apply.');
    if (gatewayRows.length > 0) {
      console.log('For rows with Razorpay references, use --student=REG_NO --apply --allow-gateway-records only after review.');
    }
    return;
  }

  const rowIds = rows.map(row => row.id);
  await prisma.$transaction(async tx => {
    const currentRows = await tx.feeTransaction.findMany({
      where: { id: { in: rowIds }, studentId: { in: studentIds } },
      select: { id: true },
    });
    if (currentRows.length !== rowIds.length) {
      throw new Error('The fee rows changed after preview. Nothing was deleted; rerun the script to review the latest rows.');
    }

    const deleted = await tx.feeTransaction.deleteMany({
      where: { id: { in: rowIds }, studentId: { in: studentIds } },
    });
    if (deleted.count !== rowIds.length) {
      throw new Error(
        `Expected to delete ${rowIds.length} fee rows but deleted ${deleted.count}. Transaction rolled back.`,
      );
    }
  });

  const remaining = await prisma.feeTransaction.count({
    where: { id: { in: rowIds }, studentId: { in: studentIds } },
  });
  if (remaining !== 0) {
    throw new Error(`Deletion verification failed: ${remaining} targeted fee row(s) remain.`);
  }

  console.log(`\nDeleted and verified ${rowIds.length} fee transaction row(s). Student records were not deleted.`);
}

main()
  .catch(error => {
    console.error('\nFee cleanup failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
