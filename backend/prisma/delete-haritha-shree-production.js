/**
 * Permanently deletes Haritha Shree (SEASIND26347) and the student's
 * directly related database records. Room E4 and external Razorpay records
 * are preserved.
 *
 * Preview only (does not change the database):
 *   node prisma/delete-haritha-shree-production.js
 *
 * Apply only after reviewing the preview and verifying DATABASE_URL:
 *   ALLOW_PRODUCTION_STUDENT_DELETE=YES node prisma/delete-haritha-shree-production.js --apply --confirm=DELETE-HARITHA-SHREE-SEASIND26347-INV-2026-11-329
 *
 * Set DATABASE_URL via the production deployment environment or secret
 * manager. This script intentionally does not load a local .env file.
 */

const { Prisma, PrismaClient } = require('@prisma/client');

const TARGET = {
  registrationNumber: 'SEASIND26347',
  name: 'Haritha Shree',
  roomNo: 'E4',
  invoiceNumber: 'INV-2026-11-329',
  paymentAmount: 1,
};
const CONFIRMATION =
  'DELETE-HARITHA-SHREE-SEASIND26347-INV-2026-11-329';
const APPLY_ENABLED = process.argv.includes('--apply');
const CONFIRMATION_ARG = process.argv.find(arg =>
  arg.startsWith('--confirm='),
);

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function validateArguments() {
  const unknownArgs = process.argv
    .slice(2)
    .filter(arg => arg !== '--apply' && !arg.startsWith('--confirm='));
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(', ')}`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Configure the intended production database through the deployment environment or secret manager.',
    );
  }
  if (APPLY_ENABLED) {
    if (process.env.ALLOW_PRODUCTION_STUDENT_DELETE !== 'YES') {
      throw new Error(
        'Delete blocked. Set ALLOW_PRODUCTION_STUDENT_DELETE=YES only after verifying DATABASE_URL and the preview.',
      );
    }
    if (CONFIRMATION_ARG !== `--confirm=${CONFIRMATION}`) {
      throw new Error(
        `Delete blocked. Provide the exact confirmation argument: --confirm=${CONFIRMATION}`,
      );
    }
  } else if (CONFIRMATION_ARG) {
    throw new Error('--confirm can only be used together with --apply.');
  }
}

async function findTarget(client) {
  const matches = await client.student.findMany({
    where: {
      OR: [
        { manualRegsiName: TARGET.registrationNumber },
        { regNo: TARGET.registrationNumber },
      ],
    },
    select: {
      id: true,
      name: true,
      regNo: true,
      manualRegsiName: true,
      roomNo: true,
      status: true,
      feeStatus: true,
      transactions: {
        select: {
          id: true,
          transactionType: true,
          amount: true,
          status: true,
          paymentMode: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          paymentStatus: true,
          paymentMethod: true,
          invoiceNumber: true,
          description: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
      gateLogs: { select: { id: true }, orderBy: { id: 'asc' } },
      clearance: { select: { id: true } },
      outpasses: { select: { id: true }, orderBy: { id: 'asc' } },
      messAttendances: { select: { id: true }, orderBy: { id: 'asc' } },
      razorpayOrders: {
        select: {
          id: true,
          orderId: true,
          paymentId: true,
          amountPaise: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
    take: 2,
  });

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one student with registration ${TARGET.registrationNumber}; found ${matches.length}. No changes made.`,
    );
  }

  const student = matches[0];
  if (normalizeName(student.name) !== normalizeName(TARGET.name)) {
    throw new Error(
      `Registration ${TARGET.registrationNumber} belongs to "${student.name}", not "${TARGET.name}". No changes made.`,
    );
  }
  if (student.roomNo !== TARGET.roomNo) {
    throw new Error(
      `Registration ${TARGET.registrationNumber} is assigned to room "${student.roomNo || 'none'}", not ${TARGET.roomNo}. No changes made.`,
    );
  }

  const invoiceMatches = student.transactions.filter(
    transaction => transaction.invoiceNumber === TARGET.invoiceNumber,
  );
  const expectedPayments = invoiceMatches.filter(
    transaction =>
      transaction.status === 'COMPLETED' &&
      transaction.paymentMode === 'RAZORPAY' &&
      Math.round(Number(transaction.amount) * 100) ===
        TARGET.paymentAmount * 100,
  );
  if (expectedPayments.length !== 1) {
    throw new Error(
      `Expected exactly one completed Razorpay transaction of ₹${TARGET.paymentAmount.toFixed(2)} with invoice ${TARGET.invoiceNumber}; found ${expectedPayments.length} among ${invoiceMatches.length} transaction(s) sharing that invoice number. No changes made.`,
    );
  }

  return student;
}

async function getRoomSnapshot(client) {
  const room = await client.room.findUnique({
    where: { id: TARGET.roomNo },
    select: {
      id: true,
      capacity: true,
      occupiedCount: true,
      students: {
        select: { id: true, status: true },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!room) {
    throw new Error(`Room ${TARGET.roomNo} does not exist. No changes made.`);
  }
  return room;
}

function relatedCounts(student) {
  return {
    feeTransactions: student.transactions.length,
    gateLogs: student.gateLogs.length,
    clearanceRecords: student.clearance ? 1 : 0,
    outpasses: student.outpasses.length,
    messAttendanceRows: student.messAttendances.length,
    razorpayOrders: student.razorpayOrders.length,
  };
}

function printPreview(student, room) {
  console.log('\nStudent selected for permanent deletion:');
  console.table([
    {
      name: student.name,
      registration: student.manualRegsiName,
      regNo: student.regNo,
      internalId: student.id,
      mobile: student.mobileNo || '—',
      room: student.roomNo,
      status: student.status,
      feeStatus: student.feeStatus,
      ...relatedCounts(student),
    },
  ]);
  console.log('\nFee transactions that will be deleted:');
  console.table(
    student.transactions.map(transaction => ({
      id: transaction.id,
      invoiceNumber: transaction.invoiceNumber || '—',
      type: transaction.transactionType,
      amount: `₹${Number(transaction.amount).toFixed(2)}`,
      status: transaction.status,
      paymentMode: transaction.paymentMode || '—',
      paymentStatus: transaction.paymentStatus || '—',
      razorpayOrderId: transaction.razorpayOrderId || '—',
      razorpayPaymentId: transaction.razorpayPaymentId || '—',
    })),
  );
  console.log(`\nRows sharing invoice ${TARGET.invoiceNumber}:`);
  console.table(
    student.transactions
      .filter(transaction => transaction.invoiceNumber === TARGET.invoiceNumber)
      .map(transaction => ({
        id: transaction.id,
        type: transaction.transactionType,
        amount: `₹${Number(transaction.amount).toFixed(2)}`,
        status: transaction.status,
        paymentMode: transaction.paymentMode || '—',
        paymentStatus: transaction.paymentStatus || '—',
        razorpayOrderId: transaction.razorpayOrderId || '—',
        razorpayPaymentId: transaction.razorpayPaymentId || '—',
      })),
  );
  if (student.razorpayOrders.length > 0) {
    console.log('\nRelated Razorpay order records that will be deleted:');
    console.table(
      student.razorpayOrders.map(order => ({
        id: order.id,
        orderId: order.orderId || '—',
        paymentId: order.paymentId || '—',
        amount: `₹${(order.amountPaise / 100).toFixed(2)}`,
        status: order.status,
        paymentStatus: order.paymentStatus || '—',
      })),
    );
  }
  console.log(
    `\nRoom ${TARGET.roomNo} will be preserved; its occupied count will be recalculated. The student's profile, all fee/payment history, gate logs, clearance, outpasses, mess attendance, and Razorpay order references will be permanently deleted. External Razorpay Dashboard records are not deleted.`,
  );
  console.log(
    `Room ${TARGET.roomNo} occupancy before deletion: ${room.occupiedCount} stored; ${room.students.filter(studentRow => studentRow.status !== 'Vacated').length} active student record(s).`,
  );
}

function snapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function deleteTarget(client, previewStudent, previewRoom) {
  return client.$transaction(
    async tx => {
      const currentStudent = await findTarget(tx);
      const currentRoom = await getRoomSnapshot(tx);

      if (currentStudent.id !== previewStudent.id) {
        throw new Error(
          'The matched student changed after preview. Transaction aborted; run the script again.',
        );
      }
      if (
        !snapshotsEqual(relatedCounts(currentStudent), relatedCounts(previewStudent)) ||
        !snapshotsEqual(currentStudent.transactions, previewStudent.transactions) ||
        !snapshotsEqual(currentStudent.razorpayOrders, previewStudent.razorpayOrders) ||
        !snapshotsEqual(currentStudent.gateLogs, previewStudent.gateLogs) ||
        !snapshotsEqual(currentStudent.clearance, previewStudent.clearance) ||
        !snapshotsEqual(currentStudent.outpasses, previewStudent.outpasses) ||
        !snapshotsEqual(currentStudent.messAttendances, previewStudent.messAttendances)
      ) {
        throw new Error(
          'The student or related records changed after preview. Transaction aborted; run the script again.',
        );
      }
      if (
        currentRoom.id !== previewRoom.id ||
        currentRoom.capacity !== previewRoom.capacity ||
        !snapshotsEqual(currentRoom.students, previewRoom.students)
      ) {
        throw new Error(
          `Room ${TARGET.roomNo} assignments changed after preview. Transaction aborted; run the script again.`,
        );
      }

      await tx.gateLog.deleteMany({
        where: { studentId: currentStudent.id },
      });
      await tx.feeTransaction.deleteMany({
        where: { studentId: currentStudent.id },
      });
      await tx.clearanceRecord.deleteMany({
        where: { studentId: currentStudent.id },
      });
      await tx.outpass.deleteMany({
        where: { studentId: currentStudent.id },
      });
      await tx.messAttendance.deleteMany({
        where: { studentId: currentStudent.id },
      });
      await tx.razorpayOrder.deleteMany({
        where: { studentId: currentStudent.id },
      });
      await tx.student.delete({ where: { id: currentStudent.id } });

      const remainingActiveResidents = await tx.student.count({
        where: { roomNo: TARGET.roomNo, status: { not: 'Vacated' } },
      });
      await tx.room.update({
        where: { id: TARGET.roomNo },
        data: { occupiedCount: remainingActiveResidents },
      });

      const remainingTarget = await tx.student.findMany({
        where: {
          OR: [
            { manualRegsiName: TARGET.registrationNumber },
            { regNo: TARGET.registrationNumber },
          ],
        },
        select: { id: true },
        take: 1,
      });
      if (remainingTarget.length > 0) {
        throw new Error(
          'Post-delete verification failed: the target student still exists.',
        );
      }

      return remainingActiveResidents;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function main() {
  validateArguments();

  const client = new PrismaClient();
  try {
    const student = await findTarget(client);
    const room = await getRoomSnapshot(client);
    printPreview(student, room);

    if (!APPLY_ENABLED) {
      console.log('\nPreview only; no database changes were made.');
      console.log(
        `After verifying the production target and every listed related record, rerun with --apply, ALLOW_PRODUCTION_STUDENT_DELETE=YES, and --confirm=${CONFIRMATION}.`,
      );
      return;
    }

    const remainingActiveResidents = await deleteTarget(
      client,
      student,
      room,
    );
    console.log(
      `\nVerified: ${TARGET.name} (${TARGET.registrationNumber}) and the related database records listed above were deleted. Room ${TARGET.roomNo} was preserved and occupancy recalculated to ${remainingActiveResidents}.`,
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch(error => {
  console.error(`Student deletion failed: ${error.message}`);
  process.exitCode = 1;
});
