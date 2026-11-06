/**
 * Marks Jasmine S.'s specified RENT fee unpaid in the configured database.
 *
 * Preview (default):
 *   node prisma/set-jasmine-invoice-unpaid.js
 *
 * Apply only after reviewing the preview against the intended production DB:
 *   ALLOW_PRODUCTION_DATA_MUTATION=YES node prisma/set-jasmine-invoice-unpaid.js --apply --confirm=SET-INV-2026-11-310-UNPAID-SEASIND25183
 *
 * Set DATABASE_URL through the deployment environment/secret manager.
 * This script intentionally does not load a local .env file.
 */

const { Prisma, PrismaClient } = require('@prisma/client');

const TARGET = {
  invoiceNumber: 'INV-2026-11-310',
  registrationNumber: 'SEASIND25183',
  studentName: 'Jasmine.S',
  roomNo: 'E5',
  transactionType: 'RENT',
  amount: 5000,
};
const CONFIRMATION = 'SET-INV-2026-11-310-UNPAID-SEASIND25183';
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
    if (process.env.ALLOW_PRODUCTION_DATA_MUTATION !== 'YES') {
      throw new Error(
        'Apply blocked. Set ALLOW_PRODUCTION_DATA_MUTATION=YES only after verifying DATABASE_URL and the preview.',
      );
    }
    if (CONFIRMATION_ARG !== `--confirm=${CONFIRMATION}`) {
      throw new Error(
        `Apply blocked. Provide the exact confirmation argument: --confirm=${CONFIRMATION}`,
      );
    }
  } else if (CONFIRMATION_ARG) {
    throw new Error('--confirm can only be used together with --apply.');
  }
}

async function findTargetStudent(client) {
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
    },
    take: 2,
  });

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one student with registration ${TARGET.registrationNumber}; found ${matches.length}. No changes made.`,
    );
  }

  const student = matches[0];
  if (normalizeName(student.name) !== normalizeName(TARGET.studentName)) {
    throw new Error(
      `Registration ${TARGET.registrationNumber} belongs to "${student.name}", not "${TARGET.studentName}". No changes made.`,
    );
  }
  if (student.roomNo !== TARGET.roomNo) {
    throw new Error(
      `Registration ${TARGET.registrationNumber} is assigned to room "${student.roomNo || 'none'}", not "${TARGET.roomNo}". No changes made.`,
    );
  }

  return student;
}

async function findTargetInvoice(client, studentId) {
  const rows = await client.feeTransaction.findMany({
    where: { studentId, invoiceNumber: TARGET.invoiceNumber },
    select: {
      id: true,
      transactionType: true,
      amount: true,
      status: true,
      paymentMode: true,
      paidDate: true,
      invoiceNumber: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const targetRows = rows.filter(
    row =>
      String(row.transactionType).toUpperCase() === TARGET.transactionType &&
      Math.round(Number(row.amount || 0) * 100) ===
        Math.round(TARGET.amount * 100),
  );
  if (targetRows.length !== 1) {
    throw new Error(
      `Expected exactly one ${TARGET.transactionType} row of ₹${TARGET.amount.toFixed(2)} in ${TARGET.invoiceNumber}; found ${targetRows.length}. No changes made.`,
    );
  }
  if (!['PENDING', 'COMPLETED'].includes(targetRows[0].status)) {
    throw new Error(
      `The target fee has unexpected status "${targetRows[0].status}". No changes made.`,
    );
  }

  return { rows, targetRow: targetRows[0] };
}

function printPreview(student, invoice) {
  console.log('\nTarget identity:');
  console.log(`  Student:      ${student.name}`);
  console.log(`  Registration: ${student.manualRegsiName || student.regNo}`);
  console.log(`  Room:         ${student.roomNo}`);
  console.log(`  Invoice:      ${TARGET.invoiceNumber}`);
  console.log('\nInvoice ledger rows (only the marked target will change):');
  console.table(
    invoice.rows.map(row => ({
      id: row.id,
      transactionType: row.transactionType,
      amount: `₹${Number(row.amount).toFixed(2)}`,
      status: row.status,
      paymentMode: row.paymentMode || '—',
      action: row.id === invoice.targetRow.id ? 'SET UNPAID' : 'UNCHANGED',
    })),
  );
  console.log(
    `Target unpaid amount after update: ₹${Number(invoice.targetRow.amount).toFixed(2)}`,
  );
}

async function setTargetUnpaid(client, studentId, preview) {
  return client.$transaction(
    async tx => {
      const current = await findTargetInvoice(tx, studentId);
      if (
        current.rows.length !== preview.rows.length ||
        current.rows.some((row, index) => {
          const previous = preview.rows[index];
          return (
            row.id !== previous.id ||
            row.status !== previous.status ||
            Math.round(Number(row.amount || 0) * 100) !==
              Math.round(Number(previous.amount || 0) * 100)
          );
        })
      ) {
        throw new Error(
          'Invoice rows changed after preview. Transaction aborted; run the script again.',
        );
      }

      const target = current.targetRow;
      if (target.id !== preview.targetRow.id) {
        throw new Error(
          'The target fee changed after preview. Transaction aborted; run the script again.',
        );
      }

      if (target.status === 'COMPLETED') {
        const result = await tx.feeTransaction.updateMany({
          where: {
            id: target.id,
            studentId,
            invoiceNumber: TARGET.invoiceNumber,
            transactionType: TARGET.transactionType,
            amount: TARGET.amount,
            status: 'COMPLETED',
          },
          data: {
            status: 'PENDING',
            paymentMode: null,
            paidDate: null,
          },
        });
        if (result.count !== 1) {
          throw new Error(
            'The updated row count did not match the preview. Transaction aborted.',
          );
        }
      }

      return tx.feeTransaction.findUnique({
        where: { id: target.id },
        select: {
          id: true,
          transactionType: true,
          amount: true,
          status: true,
          paymentMode: true,
          paidDate: true,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function main() {
  validateArguments();

  const client = new PrismaClient();
  try {
    const student = await findTargetStudent(client);
    const preview = await findTargetInvoice(client, student.id);
    printPreview(student, preview);

    if (!APPLY_ENABLED) {
      console.log('\nPreview only; no database changes were made.');
      console.log(
        `After verifying the target, rerun with --apply, ALLOW_PRODUCTION_DATA_MUTATION=YES, and --confirm=${CONFIRMATION}.`,
      );
      return;
    }

    const updated = await setTargetUnpaid(client, student.id, preview);
    if (
      !updated ||
      updated.status !== 'PENDING' ||
      updated.transactionType !== TARGET.transactionType ||
      Math.round(Number(updated.amount || 0) * 100) !==
        Math.round(TARGET.amount * 100)
    ) {
      throw new Error(
        'Post-update verification failed: target fee is not PENDING at the expected amount.',
      );
    }

    console.log('\nUpdated target fee, verified:');
    console.table([
      {
        id: updated.id,
        transactionType: updated.transactionType,
        amount: `₹${Number(updated.amount).toFixed(2)}`,
        status: updated.status,
        paymentMode: updated.paymentMode || '—',
      },
    ]);
    console.log(
      'The ₹5,000 RENT fee is now unpaid and can be paid through the existing Fees payment flow. Refresh the Fees UI to reload the balance.',
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch(error => {
  console.error(`Invoice status update failed: ${error.message}`);
  process.exitCode = 1;
});
