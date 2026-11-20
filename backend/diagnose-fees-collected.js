/**
 * Diagnose why "Total Fees Collected" on the Fees page differs from the sum of
 * the receipts you actually issued.
 *
 * It mirrors frontend/src/utils/feeReconciliation.ts + outstanding.ts:
 *   totalCollected = in-scope COMPLETED invoices
 *                  + confirmed OUTSTANDING_PAYMENT receipts
 *
 * Usage (from the backend folder, with production DATABASE_URL in .env):
 *   node diagnose-fees-collected.js
 *   node diagnose-fees-collected.js --expected=11202
 *   node diagnose-fees-collected.js --student=HST-2026-001
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
};
const EXPECTED = Number(arg('expected', 11202));
const STUDENT = arg('student', null);

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const typeOf = (fee) => String(fee?.transactionType || '').toUpperCase();
const descOf = (fee) => String(fee?.description || '');
const isMessFee = (fee) => typeOf(fee).startsWith('MESS');
const isOutstandingDescription = (fee) => /^\s*outstanding\b/i.test(descOf(fee));
const isOctoberEbBill = (fee) =>
  typeOf(fee) === 'EB_BILL' && /(?:\b2026-10\b|\boct(?:ober)?\s*2026\b)/i.test(descOf(fee));
const isOutstandingPayment = (fee) =>
  !!fee && fee.status === 'COMPLETED' && typeOf(fee) === 'OUTSTANDING_PAYMENT';
const isOutstandingInvoice = (fee) =>
  !!fee && fee.status === 'PENDING' && !isMessFee(fee) &&
  typeOf(fee) !== 'OUTSTANDING_PAYMENT' && isOutstandingDescription(fee);

const isImportedInvoice = (fee) => {
  if (isOutstandingDescription(fee) || isOctoberEbBill(fee)) return false;
  const desc = descOf(fee);
  if (/imported/i.test(desc)) return true;
  if (/october\s*2026\b/i.test(desc)) return true;
  if (/november|december|2027/i.test(desc)) return false;
  const created = new Date(fee.createdAt);
  return !isNaN(created.getTime()) && created < new Date('2026-11-01T00:00:00');
};

const isPreviousSettledFee = (fee) => {
  if (!fee) return false;
  if (isOutstandingDescription(fee) || isOutstandingPayment(fee) || isOctoberEbBill(fee)) return false;
  const desc = descOf(fee);
  if (/november|december|2027/i.test(desc)) return false;
  const dateVal = fee.paidDate || fee.createdAt;
  if (!dateVal) return true;
  const d = new Date(dateVal);
  return isNaN(d.getTime()) || d < new Date('2026-11-01T00:00:00');
};

const categoryOf = (fee) => {
  const type = typeOf(fee);
  if (type.includes('RENT')) return 'rent';
  if (type.includes('EB') || type.includes('ELECTRIC')) return 'eb';
  if (type.includes('FINE')) return 'fine';
  if (type.includes('ADVANCE')) return 'advance';
  return 'other';
};

const resolveFeeBillingMonth = (fee) => {
  const explicit = String(fee?.billingMonth || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(explicit)) return explicit;
  const desc = descOf(fee);
  const iso = desc.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const named = desc.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*(20\d{2})\b/i,
  );
  if (named) {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const index = months.indexOf(named[1].toLowerCase());
    if (index >= 0) return `${named[2]}-${String(index + 1).padStart(2, '0')}`;
  }
  const created = new Date(fee?.paidDate || fee?.createdAt || '');
  return isNaN(created.getTime()) ? null : `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
};

const isFreshCycleApplicable = (fee, currentMonthStr, previousMonthStr) => {
  const feeMonth = resolveFeeBillingMonth(fee);
  const relevant = !feeMonth || feeMonth === currentMonthStr || feeMonth === previousMonthStr;
  if (isImportedInvoice(fee) && !relevant) return false;
  if (isPreviousSettledFee(fee) && !relevant) return false;
  return true;
};

const studentKey = (fee) =>
  fee?.student?.regNo || fee?.student?.manualRegsiName || fee?.studentId || 'unknown';

const money = (value) => `₹${roundMoney(value).toLocaleString('en-IN')}`;
const dateLabel = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10);
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const previousMonthStr = `${prevYear}-${String(prevIndex + 1).padStart(2, '0')}`;

  const allFees = await prisma.feeTransaction.findMany({
    where: STUDENT ? { student: { regNo: STUDENT } } : undefined,
    include: { student: { include: { college: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const filteredFees = STUDENT
    ? allFees.filter((fee) => studentKey(fee).toUpperCase() === STUDENT.toUpperCase())
    : allFees;

  console.log('=================================================================');
  console.log('--- Fees: Total Collected diagnostic ---');
  console.log(`--- DB: ${process.env.DATABASE_URL.split('@').pop()} ---`);
  console.log(`--- Window: ${previousMonthStr} / ${currentMonthStr} ---`);
  console.log(`--- Student: ${STUDENT || 'ALL'} ---`);
  console.log('=================================================================');

  let collected = 0;
  const counted = [];

  for (const fee of filteredFees) {
    if (isMessFee(fee)) continue;
    if (fee.status === 'PENDING' && typeOf(fee) === 'ADVANCE') continue;
    if (isOutstandingDescription(fee) || isOutstandingPayment(fee)) continue;
    if (!isFreshCycleApplicable(fee, currentMonthStr, previousMonthStr)) continue;
    const amount = roundMoney(fee.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    if (fee.status !== 'COMPLETED' && fee.status !== 'PENDING') continue;

    if (fee.status === 'COMPLETED') {
      collected = roundMoney(collected + amount);
      counted.push({
        date: dateLabel(fee.paidDate || fee.createdAt),
        student: studentKey(fee),
        type: typeOf(fee),
        amount: roundMoney(amount),
        source: 'regular',
        description: descOf(fee).slice(0, 70),
        id: fee.id,
      });
    }
  }

  // Historical outstanding ledger (payments are counted as collections).
  const visibleStudents = new Set(filteredFees.map(studentKey));
  const ledgerByStudent = new Map();
  for (const fee of allFees) {
    if (!isOutstandingInvoice(fee) && !isOutstandingPayment(fee)) continue;
    const key = studentKey(fee);
    if (!visibleStudents.has(key)) continue;
    if (!ledgerByStudent.has(key)) ledgerByStudent.set(key, []);
    ledgerByStudent.get(key).push(fee);
  }

  for (const [key, rows] of ledgerByStudent) {
    const payments = rows.filter(isOutstandingPayment);
    const paid = roundMoney(payments.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0));
    collected = roundMoney(collected + paid);
    for (const fee of payments) {
      counted.push({
        date: dateLabel(fee.paidDate || fee.createdAt),
        student: key,
        type: typeOf(fee),
        amount: roundMoney(fee.amount),
        source: 'outstanding',
        description: descOf(fee).slice(0, 70),
        id: fee.id,
      });
    }
  }

  counted.sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);

  console.log(`\nReceipts counted toward Total Fees Collected: ${counted.length}`);
  console.table(counted);

  const byType = {};
  for (const row of counted) byType[row.type] = roundMoney((byType[row.type] || 0) + row.amount);
  console.log('\nBreakdown by transaction type:');
  console.table(Object.entries(byType).map(([type, amount]) => ({ type, amount: money(amount) })));

  const delta = roundMoney(collected - EXPECTED);
  console.log(`\nComputed Total Fees Collected : ${money(collected)}`);
  console.log(`Expected (receipts you issued): ${money(EXPECTED)}`);
  console.log(`Difference                     : ${money(delta)}${delta === 0 ? '  ✅ matches' : '  <-- investigate'}`);

  // Find suspicious extra rows of the exact difference amount.
  if (Math.abs(delta) > 0.005) {
    const target = Math.abs(delta);
    const matches = counted.filter((row) => Math.abs(row.amount - target) < 0.005);
    if (matches.length > 0) {
      console.log(`\n>>> Found ${matches.length} counted receipt(s) of exactly ${money(target)} - likely the cause:`);
      console.table(matches);
    }
  }

  // COMPLETED rows excluded from the total - useful when the extra money is
  // being counted by the UI but should not be (or vice versa).
  const countedIds = new Set(counted.map((row) => row.id));
  const excluded = filteredFees
    .filter((fee) => fee.status === 'COMPLETED' && !countedIds.has(fee.id) && (Number(fee.amount) || 0) > 0)
    .map((fee) => ({
      date: dateLabel(fee.paidDate || fee.createdAt),
      student: studentKey(fee),
      type: typeOf(fee),
      amount: roundMoney(fee.amount),
      reason: isMessFee(fee) ? 'MESS excluded'
        : isOutstandingDescription(fee) ? 'outstanding invoice'
        : isPreviousSettledFee(fee) ? 'previous settled (before 2026-11-01)'
        : isImportedInvoice(fee) ? 'imported / October fee'
        : 'other scope rule',
      description: descOf(fee).slice(0, 70),
    }));
  console.log('\nCompleted receipts NOT counted in the total:');
  console.table(excluded.slice(0, 60));

  // Duplicate receipt check.
  const signature = (fee) =>
    [fee.studentId, typeOf(fee), roundMoney(fee.amount), descOf(fee), dateLabel(fee.paidDate || fee.createdAt)].join('|');
  const groups = new Map();
  for (const fee of filteredFees) {
    if (fee.status !== 'COMPLETED') continue;
    const key = signature(fee);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fee);
  }
  const duplicates = Array.from(groups.values())
    .filter((rows) => rows.length > 1)
    .map((rows) => ({
      student: studentKey(rows[0]),
      type: typeOf(rows[0]),
      amount: roundMoney(rows[0].amount),
      copies: rows.length,
      description: descOf(rows[0]).slice(0, 70),
      ids: rows.map((row) => row.id).join(', '),
    }));
  console.log('\nPossible duplicate completed receipts:');
  console.table(duplicates);
}

main()
  .catch((error) => {
    console.error('\nDiagnostic failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
