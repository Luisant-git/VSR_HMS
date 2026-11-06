/**
 * Marks the specified invoice unpaid in the configured database.
 *
 * Preview (default):
 *   node prisma/set-invoice-unpaid.js
 *
 * Apply (after confirming the preview and production DATABASE_URL):
 *   ALLOW_PRODUCTION_DATA_MUTATION=YES node prisma/set-invoice-unpaid.js --apply --confirm=SET-INV-2026-11-003-UNPAID-SEASIND26332
 *
 * Set DATABASE_URL through the deployment environment/secret manager.
 * This script intentionally does not load a local .env file.
 */

const { Prisma, PrismaClient } = require('@prisma/client');

const TARGET = {
  invoiceNumber: 'INV-2026-11-003',
  registrationNumber: 'SEASIND26332',
  studentName: 'V. Sakthi',
  amount: 6000,
};
const CONFIRMATION = 'SET-INV-2026-11-003-UNPAID-SEASIND26332';
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
        'Apply blocked. Set ALLOW_PRODUCTION_DATA_MUTATION=YES in the deployment environment after verifying DATABASE_URL.',
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

  return student;
}

async function findTargetInvoice(client, studentId) {
  const rows = await client.feeTransaction.findMany({
    where: {
      studentId,
      invoiceNumber: TARGET.invoiceNumber,
    },
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

  if (rows.length === 0) {
    throw new Error(
      `Invoice ${TARGET.invoiceNumber} was not found for ${TARGET.studentName} (${TARGET.registrationNumber}). No changes made.`,
    );
  }
  if (rows.some(row => !['PENDING', 'COMPLETED'].includes(row.status))) {
    throw new Error(
      `Invoice has an unexpected transaction status. No changes made. Statuses: ${rows.map(row => row.status).join(', ')}`,
    );
  }
  if (
    rows.some(
      row => String(row.transactionType).toUpperCase() === 'OUTSTANDING_PAYMENT',
    )
  ) {
    throw new Error(
      'The invoice contains an outstanding-payment receipt, not a fee invoice. No changes made.',
    );
  }
  const invoiceAmountInPaise = rows.reduce(
    (total, row) => total + Math.round(Number(row.amount || 0) * 100),
    0,
  );
  if (invoiceAmountInPaise !== Math.round(TARGET.amount * 100)) {
    throw new Error(
      `Expected invoice rows totaling ₹${TARGET.amount.toFixed(2)}, found ₹${(invoiceAmountInPaise / 100).toFixed(2)}. No changes made.`,
    );
  }

  return rows;
}

function printPreview(student, rows) {
  const rowsToChange = rows.filter(row => row.status === 'COMPLETED');
  const amountToRestore = rowsToChange.reduce(
    (total, row) => total + Number(row.amount || 0),
    0,
  );
  const unpaidAfterUpdate = rows.reduce(
    (total, row) => total + Number(row.amount || 0),
    0,
  );

  console.log('\nTarget identity:');
  console.log(`  Student:     ${student.name}`);
  console.log(`  Registration:${student.manualRegsiName || student.regNo}`);
  console.log(`  Invoice:     ${TARGET.invoiceNumber}`);
  console.log('\nMatching invoice ledger rows:');
  console.table(
    rows.map(row => ({
      id: row.id,
      transactionType: row.transactionType,
      amount: `₹${Number(row.amount).toFixed(2)}`,
      status: row.status,
    })),
  );
  console.log(`Rows to change: ${rowsToChange.length}`);
  console.log(
    `Amount returned to unpaid fees: ₹${amountToRestore.toFixed(2)}`,
  );
  console.log(
    `Unpaid amount after update: ₹${unpaidAfterUpdate.toFixed(2)} (expected ₹${TARGET.amount.toFixed(2)})`,
  );
}

async function markInvoiceUnpaid(client, studentId, previewRows) {
  return client.$transaction(
    async tx => {
      const currentRows = await findTargetInvoice(tx, studentId);
      const expectedIds = previewRows.map(row => row.id).sort();
      const currentIds = currentRows.map(row => row.id).sort();
      if (
        expectedIds.length !== currentIds.length ||
        expectedIds.some((id, index) => id !== currentIds[index])
      ) {
        throw new Error(
          'Invoice rows changed after preview. Transaction aborted; run the script again to review the current records.',
        );
      }

      const completedRows = currentRows.filter(row => row.status === 'COMPLETED');
      if (completedRows.length > 0) {
        const result = await tx.feeTransaction.updateMany({
          where: {
            id: { in: completedRows.map(row => row.id) },
            studentId,
            invoiceNumber: TARGET.invoiceNumber,
            status: 'COMPLETED',
          },
          data: {
            status: 'PENDING',
            paymentMode: null,
            paidDate: null,
          },
        });

        if (result.count !== completedRows.length) {
          throw new Error(
            'The number of updated rows did not match the preview. Transaction aborted.',
          );
        }
      }

      return tx.feeTransaction.findMany({
        where: {
          studentId,
          invoiceNumber: TARGET.invoiceNumber,
        },
        select: {
          id: true,
          transactionType: true,
          amount: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
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
    const rows = await findTargetInvoice(client, student.id);
    printPreview(student, rows);

    if (!APPLY_ENABLED) {
      console.log('\nPreview only; no database changes were made.');
      console.log(
        'After verifying the target database and preview, rerun with --apply, the exact --confirm value shown in the file header, and ALLOW_PRODUCTION_DATA_MUTATION=YES.',
      );
      return;
    }

    const updatedRows = await markInvoiceUnpaid(client, student.id, rows);
    if (updatedRows.some(row => row.status !== 'PENDING')) {
      throw new Error(
        'Post-update verification failed: not all invoice rows are PENDING.',
      );
    }
    const unpaidAmountInPaise = updatedRows.reduce(
      (total, row) => total + Math.round(Number(row.amount || 0) * 100),
      0,
    );
    if (unpaidAmountInPaise !== Math.round(TARGET.amount * 100)) {
      throw new Error(
        `Post-update verification failed: unpaid invoice total is ₹${(unpaidAmountInPaise / 100).toFixed(2)}, expected ₹${TARGET.amount.toFixed(2)}.`,
      );
    }

    console.log('\nInvoice status update committed and verified:');
    console.table(
      updatedRows.map(row => ({
        id: row.id,
        transactionType: row.transactionType,
        amount: `₹${Number(row.amount).toFixed(2)}`,
        status: row.status,
      })),
    );
    console.log(
      '₹6,000 now appears as unpaid and can be paid through the existing Fees payment flow. The original fee amounts and other invoices were not changed. Refresh the Fees UI to reload the balance.',
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch(error => {
  console.error(`Invoice status update failed: ${error.message}`);
  process.exitCode = 1;
});
