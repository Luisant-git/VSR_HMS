/**
 * Permanently deletes the specified student and their directly related records.
 * The room itself is preserved, and its occupied count is recalculated.
 *
 * Preview (default):
 *   node prisma/delete-student-with-relations.js
 *
 * Apply only after reviewing the preview against the intended production DB:
 *   ALLOW_PRODUCTION_STUDENT_DELETE=YES node prisma/delete-student-with-relations.js --apply --confirm=DELETE-ARUN-SEASIND26347
 *
 * Set DATABASE_URL through the deployment environment/secret manager.
 * This script intentionally does not load a local .env file.
 */

const { Prisma, PrismaClient } = require('@prisma/client');

const TARGET = {
  registrationNumber: 'SEASIND26347',
  name: 'Arun',
  roomNo: 'D1',
  pendingRent: 5000,
};
const CONFIRMATION = 'DELETE-ARUN-SEASIND26347';
const APPLY_ENABLED = process.argv.includes('--apply');
const CONFIRMATION_ARG = process.argv.find(arg => arg.startsWith('--confirm='));

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
          invoiceNumber: true,
          description: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      gateLogs: { select: { id: true } },
      clearance: { select: { id: true } },
      outpasses: { select: { id: true } },
      messAttendances: { select: { id: true } },
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
        orderBy: { createdAt: 'asc' },
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
      `Registration ${TARGET.registrationNumber} is assigned to room "${student.roomNo || 'none'}", not "${TARGET.roomNo}". No changes made.`,
    );
  }

  const pendingRentRows = student.transactions.filter(
    row =>
      String(row.transactionType).toUpperCase() === 'RENT' &&
      row.status === 'PENDING' &&
      Math.round(Number(row.amount || 0) * 100) ===
        Math.round(TARGET.pendingRent * 100),
  );
  if (pendingRentRows.length !== 1) {
    throw new Error(
      `Expected exactly one PENDING RENT transaction of ₹${TARGET.pendingRent.toFixed(2)}; found ${pendingRentRows.length}. No changes made.`,
    );
  }

  return student;
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

function printPreview(student) {
  const counts = relatedCounts(student);
  console.log('\nStudent selected for permanent deletion:');
  console.log(`  Name:         ${student.name}`);
  console.log(`  Registration: ${student.manualRegsiName || student.regNo}`);
  console.log(`  Internal ID:  ${student.id}`);
  console.log(`  Room:         ${student.roomNo}`);
  console.log(`  Status:       ${student.status}`);
  console.log(`  Fee status:   ${student.feeStatus}`);
  console.log('\nFee transactions that will be deleted:');
  console.table(
    student.transactions.map(row => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber || '—',
      type: row.transactionType,
      amount: `₹${Number(row.amount).toFixed(2)}`,
      status: row.status,
      paymentMode: row.paymentMode || '—',
    })),
  );
  console.log('\nRelated records that will also be deleted:');
  console.table([counts]);
  if (student.razorpayOrders.length > 0) {
    console.log('\nRazorpay order/payment records that will be deleted:');
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
    '\nThe Student record and all listed fee/payment history, gate logs, clearance, outpasses, and mess attendance are permanently removed. Room D1 itself is preserved.',
  );
}

function sameCounts(a, b) {
  return Object.keys(a).every(key => a[key] === b[key]);
}

async function deleteTarget(client, preview) {
  return client.$transaction(
    async tx => {
      const current = await findTarget(tx);
      if (current.id !== preview.id) {
        throw new Error(
          'The matched student changed after preview. Transaction aborted; run the script again.',
        );
      }
      if (!sameCounts(relatedCounts(current), relatedCounts(preview))) {
        throw new Error(
          'The student’s related record counts changed after preview. Transaction aborted; run the script again.',
        );
      }
      if (JSON.stringify(current.transactions) !== JSON.stringify(preview.transactions)) {
        throw new Error(
          'The student’s fee ledger changed after preview. Transaction aborted; run the script again.',
        );
      }

      const activeInRoom = current.status !== 'Vacated' && current.roomNo;

      await tx.gateLog.deleteMany({ where: { studentId: current.id } });
      await tx.feeTransaction.deleteMany({ where: { studentId: current.id } });
      await tx.clearanceRecord.deleteMany({ where: { studentId: current.id } });
      await tx.outpass.deleteMany({ where: { studentId: current.id } });
      await tx.messAttendance.deleteMany({ where: { studentId: current.id } });
      await tx.student.delete({ where: { id: current.id } });

      if (activeInRoom) {
        const remainingOccupants = await tx.student.count({
          where: {
            roomNo: current.roomNo,
            status: { not: 'Vacated' },
          },
        });
        await tx.room.update({
          where: { id: current.roomNo },
          data: { occupiedCount: remainingOccupants },
        });
      }

      return tx.student.findUnique({
        where: { id: current.id },
        select: { id: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function main() {
  validateArguments();

  const client = new PrismaClient();
  try {
    const student = await findTarget(client);
    printPreview(student);

    if (!APPLY_ENABLED) {
      console.log('\nPreview only; no database changes were made.');
      console.log(
        'After verifying the production target and every listed related record, rerun with --apply, ALLOW_PRODUCTION_STUDENT_DELETE=YES, and the exact --confirm value shown in the file header.',
      );
      return;
    }

    const remainingStudent = await deleteTarget(client, student);
    if (remainingStudent !== null) {
      throw new Error(
        'Post-delete verification failed: the Student record still exists.',
      );
    }
    console.log(
      `\nVerified: ${TARGET.name} (${TARGET.registrationNumber}) and the related records listed above were deleted. Room ${TARGET.roomNo} was preserved and occupancy recalculated.`,
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch(error => {
  console.error(`Student deletion failed: ${error.message}`);
  process.exitCode = 1;
});
