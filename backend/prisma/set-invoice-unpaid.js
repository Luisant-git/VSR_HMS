/**
 * Marks the specified RENT fee unpaid in the configured database.
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
  transactionType: 'RENT',
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
      description: true,
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

  const targets = rows.filter(
    row =>
      String(row.transactionType).toUpperCase() === TARGET.transactionType &&
      Math.round(Number(row.amount || 0) * 100) ===
        Math.round(TARGET.amount * 100),
  );
  if (targets.length !== 1) {
    throw new Error(
      `Expected exactly one ${TARGET.transactionType} row of ₹${TARGET.amount.toFixed(2)} in ${TARGET.invoiceNumber}; found ${targets.length}. No changes made.`,
    );
  }
  if (String(targets[0].transactionType).toUpperCase() === 'OUTSTANDING_PAYMENT') {
    throw new Error(
      'The selected row is an outstanding-payment receipt, not a fee invoice. No changes made.',
    );
  }

  return { rows, targetRow: targets[0] };
}

function printPreview(student, { rows, targetRow }) {
  const amountToRestore =
    targetRow.status === 'COMPLETED' ? Number(targetRow.amount || 0) : 0;
  const unpaidAfterUpdate = Number(targetRow.amount || 0);
  const invoiceRowsTotal = rows.reduce(
    (total, row) => total + Number(row.amount || 0),
    0,
  );

  console.log('\nTarget identity:');
  console.log(`  Student:     ${student.name}`);
  console.log(`  Registration:${student.manualRegsiName || student.regNo}`);
  console.log(`  Invoice:     ${TARGET.invoiceNumber}`);
  console.log('\nMatching invoice ledger rows (only the marked target will change):');
  console.table(
    rows.map(row => ({
      id: row.id,
      transactionType: row.transactionType,
      amount: `₹${Number(row.amount).toFixed(2)}`,
      status: row.status,
      action: row.id === targetRow.id ? 'SET UNPAID' : 'UNCHANGED',
    })),
  );
  console.log(`Shared invoice rows total: ₹${invoiceRowsTotal.toFixed(2)}`);
  console.log(`Rows to change: ${targetRow.status === 'COMPLETED' ? 1 : 0}`);
  console.log(
    `Amount returned to unpaid fees: ₹${amountToRestore.toFixed(2)}`,
  );
  console.log(
    `Target ${TARGET.transactionType} unpaid amount after update: ₹${unpaidAfterUpdate.toFixed(2)} (expected ₹${TARGET.amount.toFixed(2)})`,
  );
}

async function markInvoiceUnpaid(client, studentId, preview) {
  return client.$transaction(
    async tx => {
      const current = await findTargetInvoice(tx, studentId);
      const expectedIds = preview.rows.map(row => row.id).sort();
      const currentIds = current.rows.map(row => row.id).sort();
      if (
        expectedIds.length !== currentIds.length ||
        expectedIds.some((id, index) => id !== currentIds[index])
      ) {
        throw new Error(
          'Invoice rows changed after preview. Transaction aborted; run the script again to review the current records.',
        );
      }

      if (
        current.targetRow.id !== preview.targetRow.id ||
        current.targetRow.status !== preview.targetRow.status ||
        Math.round(Number(current.targetRow.amount || 0) * 100) !==
          Math.round(Number(preview.targetRow.amount || 0) * 100)
      ) {
        throw new Error(
          'The target fee changed after preview. Transaction aborted; run the script again to review the current records.',
        );
      }

      if (current.targetRow.status === 'COMPLETED') {
        const result = await tx.feeTransaction.updateMany({
          where: {
            id: current.targetRow.id,
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
            'The number of updated rows did not match the preview. Transaction aborted.',
          );
        }
      }

      return {
        rows: await tx.feeTransaction.findMany({
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
        }),
        target: await tx.feeTransaction.findUnique({
          where: { id: current.targetRow.id },
          select: { id: true, transactionType: true, amount: true, status: true },
        }),
      };
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
        'After verifying the target database and preview, rerun with --apply, the exact --confirm value shown in the file header, and ALLOW_PRODUCTION_DATA_MUTATION=YES.',
      );
      return;
    }

    const result = await markInvoiceUnpaid(client, student.id, preview);
    if (
      result.target?.status !== 'PENDING' ||
      result.target.transactionType !== TARGET.transactionType ||
      Math.round(Number(result.target.amount || 0) * 100) !==
        Math.round(TARGET.amount * 100)
    ) {
      throw new Error(
        'Post-update verification failed: the target RENT row is not PENDING at the expected amount.',
      );
    }

    console.log('\nInvoice status update committed and verified:');
    console.table(
      result.rows.map(row => ({
        id: row.id,
        transactionType: row.transactionType,
        amount: `₹${Number(row.amount).toFixed(2)}`,
        status: row.status,
        action: row.id === result.target.id ? 'SET UNPAID' : 'UNCHANGED',
      })),
    );
    console.log(
      'The ₹6,000 RENT fee now appears as unpaid and can be paid through the existing Fees payment flow. Other rows sharing this invoice number and all other invoices were left unchanged. Refresh the Fees UI to reload the balance.',
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch(error => {
  console.error(`Invoice status update failed: ${error.message}`);
  process.exitCode = 1;
});
