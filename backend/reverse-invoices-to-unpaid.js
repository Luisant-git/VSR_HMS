/**
 * Reverse two specific paid invoices back to Un-Paid (PENDING) in production.
 *
 * Target: Mohana priya.V (SEASIND25134, Room A1)
 *   INV-2026-11-863  ₹720   (late fine, 18/11/2026)
 *   INV-2026-11-076  ₹6,000 (monthly fee, 01/11/2026)
 *
 * Usage (from the backend folder):
 *   node reverse-invoices-to-unpaid.js                       # DRY RUN - prints changes only
 *   node reverse-invoices-to-unpaid.js --apply               # writes to the DB pointed to by DATABASE_URL
 *   node reverse-invoices-to-unpaid.js --apply --allow-razorpay  # only if you have already refunded/settled the gateway payment
 *
 * What it does:
 *   - changes ONLY FeeTransaction.status: COMPLETED -> PENDING
 *   - keeps invoiceNumber, amount, billingMonth, dueDate and description untouched
 *   - keeps paidDate / paymentMode / paymentStatus / Razorpay IDs as an audit trail
 *     (the Fees page hides those columns for PENDING rows anyway)
 *   - does NOT delete rows, does NOT touch InvoiceCounter, does NOT refund money
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const ALLOW_RAZORPAY = process.argv.includes('--allow-razorpay');

const TARGET = {
  regNo: 'SEASIND25134',
  nameFragment: 'mohana',
  room: 'A1',
  invoices: [
    { number: 'INV-2026-11-863', amount: 720, label: 'late fine' },
    { number: 'INV-2026-11-076', amount: 6000, label: 'monthly fee' },
  ],
};

const money = value => Math.round((Number(value) || 0) * 100);
const rupees = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

function showDatabase(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname || '/'}`;
  } catch {
    return '(could not parse DATABASE_URL)';
  }
}

function printStudents(title, students) {
  console.log(`\n${title}`);
  console.table(
    students.map(student => ({
      id: student.id,
      name: student.name,
      regNo: student.regNo,
      manualReg: student.manualRegsiName || '—',
      room: student.roomNo || '—',
    })),
  );
}

function printRows(title, rows) {
  console.log(`\n${title}`);
  console.table(
    rows.map(row => ({
      invoice: row.invoiceNumber || '—',
      id: row.id,
      type: row.transactionType,
      amount: rupees(row.amount),
      status: row.status,
      paidDate: row.paidDate ? new Date(row.paidDate).toISOString().slice(0, 10) : '—',
      mode: row.paymentMode || '—',
      gatewayPayment: row.razorpayPaymentId || '—',
    })),
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Load the production environment before running this script.');
  }

  console.log('=================================================================');
  console.log(`--- Reverse invoices to Un-Paid ${APPLY ? '[APPLY]' : '[DRY RUN - NO CHANGES]'} ---`);
  console.log('=================================================================');
  console.log(`Target database: ${showDatabase(url)}  (credentials hidden)`);
  console.log(`Mode: ${APPLY ? 'APPLY - database will be modified' : 'DRY RUN - nothing will be written'}`);

  // 1. Resolve the student. Exact regNo / manualRegsiName wins over a name match,
  //    since other students can share the same name. Abort if still ambiguous.
  const selectStudent = {
    id: true,
    name: true,
    regNo: true,
    manualRegsiName: true,
    roomNo: true,
    feeStatus: true,
  };

  const exactMatches = await prisma.student.findMany({
    where: {
      OR: [
        { regNo: { equals: TARGET.regNo, mode: 'insensitive' } },
        { manualRegsiName: { equals: TARGET.regNo, mode: 'insensitive' } },
      ],
    },
    select: selectStudent,
  });

  let students = exactMatches;
  if (students.length === 0) {
    students = await prisma.student.findMany({
      where: { name: { contains: TARGET.nameFragment, mode: 'insensitive' } },
      select: selectStudent,
    });
  }

  if (students.length === 0) {
    throw new Error(`Student ${TARGET.regNo} / ${TARGET.nameFragment} was not found. Nothing was changed.`);
  }
  if (students.length > 1) {
    printStudents(`Ambiguous student matches (${students.length}):`, students);
    throw new Error('Student identifier is ambiguous. Nothing was changed.');
  }

  const student = students[0];
  if (!String(student.name || '').toLowerCase().includes(TARGET.nameFragment)) {
    throw new Error(`Resolved student "${student.name}" does not match "${TARGET.nameFragment}". Nothing was changed.`);
  }

  console.log('\nStudent:');
  console.log(`  Name:        ${student.name}`);
  console.log(`  Reg No:      ${student.regNo} / ${student.manualRegsiName || '—'}`);
  console.log(`  Room:        ${student.roomNo || '—'}`);
  console.log(`  Fee status:  ${student.feeStatus}`);
  if (student.roomNo && student.roomNo !== TARGET.room) {
    console.warn(`  WARNING: room is ${student.roomNo}, expected ${TARGET.room}. Check that this is the right student.`);
  }

  // 2. Load every fee row carrying one of the two invoice numbers.
  const invoiceNumbers = TARGET.invoices.map(item => item.number);
  const rows = await prisma.feeTransaction.findMany({
    where: {
      studentId: student.id,
      invoiceNumber: { in: invoiceNumbers },
    },
    orderBy: [{ invoiceNumber: 'asc' }, { createdAt: 'asc' }],
  });

  printRows(`Fee rows found for the target invoices (${rows.length}):`, rows);

  // 3. Validate each invoice before touching anything.
  const toReverse = [];
  for (const target of TARGET.invoices) {
    const group = rows.filter(row => row.invoiceNumber === target.number);

    if (group.length === 0) {
      throw new Error(`No fee rows found for ${target.number}. Nothing was changed.`);
    }

    const total = group.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    if (money(total) !== money(target.amount)) {
      throw new Error(
        `${target.number} totals ${rupees(total)}, expected ${rupees(target.amount)}. Nothing was changed.`,
      );
    }

    const completed = group.filter(row => row.status === 'COMPLETED');
    if (completed.length === 0) {
      throw new Error(`${target.number} has no COMPLETED rows left; it may already be reversed. Nothing was changed.`);
    }

    const gatewayRows = group.filter(row => row.razorpayPaymentId);
    if (gatewayRows.length > 0 && !ALLOW_RAZORPAY) {
      throw new Error(
        `${target.number} has a Razorpay payment (${gatewayRows.map(row => row.razorpayPaymentId).join(', ')}). ` +
          'Refund/settle it in the Razorpay Dashboard first, then rerun with --allow-razorpay. Nothing was changed.',
      );
    }

    console.log(
      `\n${target.number} (${target.label}): ${group.length} row(s), ${rupees(total)}, ` +
        `${completed.length} COMPLETED, ${group.length - completed.length} already PENDING${gatewayRows.length ? ' [RAZORPAY]' : ''}`,
    );
    completed.forEach(row => toReverse.push({ row, target }));
  }

  console.log(`\nRows to reverse: ${toReverse.length}`);
  toReverse.forEach(({ row, target }) => {
    console.log(`  ${target.number} | ${row.id} | ${row.transactionType} | ${rupees(row.amount)} | COMPLETED -> PENDING`);
  });

  if (!APPLY) {
    console.log('\nDRY RUN: no database changes were made.');
    console.logReviewNotes();
    console.log('\nTo apply, rerun with: node reverse-invoices-to-unpaid.js --apply');
    return;
  }

  // 4. Apply all guarded updates in one transaction. Any mismatch rolls everything back.
  await prisma.$transaction(async tx => {
    for (const { row, target } of toReverse) {
      const result = await tx.feeTransaction.updateMany({
        where: {
          id: row.id,
          studentId: student.id,
          invoiceNumber: target.number,
          status: 'COMPLETED',
          amount: row.amount,
        },
        data: { status: 'PENDING' },
      });

      if (result.count !== 1) {
        throw new Error(
          `${target.number} / ${row.id} changed since inspection (${result.count} rows updated). Rolling back without partial changes.`,
        );
      }
    }
  });

  // 5. Verify from the database.
  const verified = await prisma.feeTransaction.findMany({
    where: {
      id: { in: toReverse.map(item => item.row.id) },
      studentId: student.id,
    },
    orderBy: [{ invoiceNumber: 'asc' }, { createdAt: 'asc' }],
  });
  printRows('\nAfter reversal:', verified);

  const stillPaid = verified.filter(row => row.status === 'COMPLETED');
  if (stillPaid.length > 0) {
    throw new Error(`Verification failed: ${stillPaid.length} row(s) are still COMPLETED.`);
  }

  console.log(`\nDone. ${verified.length} fee row(s) are now PENDING / Un-Paid.`);
  consoleReviewNotes();
}

function consoleReviewNotes() {
  console.log('\nNotes:');
  console.log('  - Invoice numbers are preserved and InvoiceCounter is untouched.');
  console.log('  - No payment was refunded; settle any real UPI/Razorpay collection separately.');
  console.log('  - Student.feeStatus was not changed; the Fees page follows transaction status.');
  console.log('  - The reversed ₹720 fine may be re-quoted by the fine job as unpaid.');
  console.log('  - Refresh the Fees page to see Unpaid / Pay Now instead of View Receipt.');
}

main()
  .catch(error => {
    console.error('\nReversal failed:', error.message);
    console.error('No changes were made unless an APPLY run printed a success message above.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
