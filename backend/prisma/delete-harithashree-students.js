/**
 * Permanently deletes only Haritha shree (SEASIND26347) and Harithashree2
 * (SEASIND26348), including their fee/payment history and direct relations.
 * Room E4 is never deleted; its occupied count is recalculated from remaining
 * active residents after the two student records are removed.
 *
 * Preview only:
 *   node prisma/delete-harithashree-students.js
 *
 * Apply only after reviewing the preview against the intended production DB:
 *   ALLOW_PRODUCTION_STUDENT_DELETE=YES node prisma/delete-harithashree-students.js --apply --confirm=DELETE-HARITHASHREE-SEASIND26347-26348
 *
 * Set DATABASE_URL through the deployment environment/secret manager.
 * This script intentionally does not load a local .env file.
 */

const { Prisma, PrismaClient } = require('@prisma/client');

const TARGETS = [
  {
    registrationNumber: 'SEASIND26347',
    name: 'Haritha shree',
    roomNo: 'E4',
  },
  {
    registrationNumber: 'SEASIND26348',
    name: 'Harithashree2',
    roomNo: 'E4',
  },
];
const ROOM_ID = 'E4';
const CONFIRMATION = 'DELETE-HARITHASHREE-SEASIND26347-26348';
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

async function findTarget(client, target) {
  const matches = await client.student.findMany({
    where: {
      OR: [
        { manualRegsiName: target.registrationNumber },
        { regNo: target.registrationNumber },
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
      `Expected exactly one student with registration ${target.registrationNumber}; found ${matches.length}. No changes made.`,
    );
  }

  const student = matches[0];
  if (normalizeName(student.name) !== normalizeName(target.name)) {
    throw new Error(
      `Registration ${target.registrationNumber} belongs to "${student.name}", not "${target.name}". No changes made.`,
    );
  }
  if (student.roomNo !== target.roomNo || student.roomNo !== ROOM_ID) {
    throw new Error(
      `Registration ${target.registrationNumber} is assigned to room "${student.roomNo || 'none'}", not ${ROOM_ID}. No changes made.`,
    );
  }

  return student;
}

async function findTargets(client) {
  const students = [];
  for (const target of TARGETS) {
    students.push(await findTarget(client, target));
  }
  if (new Set(students.map(student => student.id)).size !== TARGETS.length) {
    throw new Error('The target registrations matched duplicate student records. No changes made.');
  }
  return students;
}

async function getRoomSnapshot(client) {
  const room = await client.room.findUnique({
    where: { id: ROOM_ID },
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
    throw new Error(`Room ${ROOM_ID} does not exist. No changes made.`);
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

function printPreview(students, room) {
  console.log('\nStudents selected for permanent deletion:');
  console.table(
    students.map(student => ({
      name: student.name,
      registration: student.manualRegsiName || student.regNo,
      internalId: student.id,
      room: student.roomNo,
      status: student.status,
      feeStatus: student.feeStatus,
      ...relatedCounts(student),
    })),
  );

  for (const student of students) {
    console.log(`\nFee transactions to be deleted for ${student.name}:`);
    console.table(
      student.transactions.map(row => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber || '—',
        type: row.transactionType,
        amount: `₹${Number(row.amount).toFixed(2)}`,
        status: row.status,
        paymentMode: row.paymentMode || '—',
        paymentStatus: row.paymentStatus || '—',
        razorpayOrderId: row.razorpayOrderId || '—',
        razorpayPaymentId: row.razorpayPaymentId || '—',
      })),
    );
    if (student.razorpayOrders.length > 0) {
      console.log(`Razorpay order/payment records to be deleted for ${student.name}:`);
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
  }

  console.log(`\nRoom ${ROOM_ID} will NOT be deleted or reassigned.`);
  console.log(
    `Room occupancy before deletion: ${room.occupiedCount} stored; ${room.students.filter(student => student.status !== 'Vacated').length} active student record(s).`,
  );
  console.log(
    '\nThis removes the two Student records and their listed fee/payment history, Razorpay order references, gate logs, clearance, outpasses, and mess attendance. Other students and room assignments are preserved. Razorpay records in the external Razorpay Dashboard are not deleted.',
  );
}

function snapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertUnchanged(currentStudents, previewStudents, currentRoom, previewRoom) {
  if (!snapshotsEqual(currentRoom.students, previewRoom.students)) {
    throw new Error(
      `Room ${ROOM_ID} assignments changed after preview. Transaction aborted; run the script again.`,
    );
  }
  if (
    currentRoom.id !== previewRoom.id ||
    currentRoom.capacity !== previewRoom.capacity
  ) {
    throw new Error(
      `Room ${ROOM_ID} details changed after preview. Transaction aborted; run the script again.`,
    );
  }
  for (let index = 0; index < currentStudents.length; index += 1) {
    const current = currentStudents[index];
    const preview = previewStudents[index];
    if (current.id !== preview.id) {
      throw new Error(
        `Registration ${TARGETS[index].registrationNumber} matched a different student after preview. Transaction aborted.`,
      );
    }
    if (
      !snapshotsEqual(relatedCounts(current), relatedCounts(preview)) ||
      !snapshotsEqual(current.transactions, preview.transactions) ||
      !snapshotsEqual(current.razorpayOrders, preview.razorpayOrders) ||
      !snapshotsEqual(current.gateLogs, preview.gateLogs) ||
      !snapshotsEqual(current.clearance, preview.clearance) ||
      !snapshotsEqual(current.outpasses, preview.outpasses) ||
      !snapshotsEqual(current.messAttendances, preview.messAttendances)
    ) {
      throw new Error(
        `Related records for ${TARGETS[index].registrationNumber} changed after preview. Transaction aborted; run the script again.`,
      );
    }
  }
}

async function deleteTargets(client, previewStudents, previewRoom) {
  return client.$transaction(
    async tx => {
      const currentStudents = await findTargets(tx);
      const currentRoom = await getRoomSnapshot(tx);
      assertUnchanged(currentStudents, previewStudents, currentRoom, previewRoom);

      for (const student of currentStudents) {
        await tx.gateLog.deleteMany({ where: { studentId: student.id } });
        await tx.feeTransaction.deleteMany({ where: { studentId: student.id } });
        await tx.clearanceRecord.deleteMany({ where: { studentId: student.id } });
        await tx.outpass.deleteMany({ where: { studentId: student.id } });
        await tx.messAttendance.deleteMany({ where: { studentId: student.id } });
        await tx.razorpayOrder.deleteMany({ where: { studentId: student.id } });
        await tx.student.delete({ where: { id: student.id } });
      }

      const remainingActiveResidents = await tx.student.count({
        where: { roomNo: ROOM_ID, status: { not: 'Vacated' } },
      });
      await tx.room.update({
        where: { id: ROOM_ID },
        data: { occupiedCount: remainingActiveResidents },
      });

      const remainingRoomSnapshot = await getRoomSnapshot(tx);
      const expectedRemainingStudents = previewRoom.students
        .filter(student => !currentStudents.some(target => target.id === student.id))
        .sort((a, b) => a.id.localeCompare(b.id));
      if (!snapshotsEqual(remainingRoomSnapshot.students, expectedRemainingStudents)) {
        throw new Error(
          `Room ${ROOM_ID} student assignments changed during deletion. Transaction aborted.`,
        );
      }

      const remainingTargets = await tx.student.findMany({
        where: {
          OR: TARGETS.flatMap(target => [
            { manualRegsiName: target.registrationNumber },
            { regNo: target.registrationNumber },
          ]),
        },
        select: { id: true },
      });
      if (remainingTargets.length !== 0) {
        throw new Error('Post-delete verification failed: a target Student record remains.');
      }

      return {
        remainingActiveResidents,
        remainingStudentIds: remainingRoomSnapshot.students.map(student => student.id),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function main() {
  validateArguments();

  const client = new PrismaClient();
  try {
    const students = await findTargets(client);
    const room = await getRoomSnapshot(client);
    printPreview(students, room);

    if (!APPLY_ENABLED) {
      console.log('\nPreview only; no database changes were made.');
      console.log(
        `After verifying the production target and every listed record, rerun with --apply, ALLOW_PRODUCTION_STUDENT_DELETE=YES, and --confirm=${CONFIRMATION}.`,
      );
      return;
    }

    const result = await deleteTargets(client, students, room);
    console.log(
      `\nVerified: only ${TARGETS.map(target => target.registrationNumber).join(' and ')} and their direct related records were deleted. Room ${ROOM_ID} remains; ${result.remainingActiveResidents} active occupant(s) remain, and all other room assignments were preserved.`,
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch(error => {
  console.error(`Student deletion failed: ${error.message}`);
  process.exitCode = 1;
});
