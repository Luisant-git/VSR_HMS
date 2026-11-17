import { buildFeeReconciliation } from './src/utils/feeReconciliation';
import {
  getBillingMonths,
  isPostpaidPayableFee,
  resolveFeeBillingMonth,
} from './src/utils/billingCycle';
import {
  getStudentKey,
  isImportedInvoice,
  isMessFee,
  isOutstandingDescription,
  isOutstandingInvoice,
  isOutstandingPayment,
  isPreviousSettledFee,
  roundMoney,
} from './src/utils/outstanding';

const NOW = new Date('2026-11-17T12:00:00');

const student = (regNo: string, cycle = 'PREPAID') => ({
  regNo,
  name: `Student ${regNo}`,
  college: { billingCycle: cycle },
});

const fee = (overrides: any) => ({
  id: Math.random().toString(36).slice(2),
  status: 'PENDING',
  transactionType: 'RENT',
  amount: 0,
  billingMonth: null,
  createdAt: '2026-11-05T00:00:00.000Z',
  description: '',
  student: student('S1'),
  ...overrides,
});

// Copy of the Fees page filter (no user filters selected).
const filterFees = (fees: any[]) =>
  fees.filter(fee => {
    const { previousMonthStr, currentMonthStr } = getBillingMonths(NOW);
    const collegeCycleForFilter = (fee.student?.college?.billingCycle || 'PREPAID').toUpperCase();
    const feeMonth = resolveFeeBillingMonth(fee);
    const feeType = String(fee.transactionType || '').toUpperCase();
    const isPostpaidPayableNow =
      fee.status === 'PENDING' &&
      (!feeMonth ||
        (collegeCycleForFilter === 'POSTPAID'
          ? (feeType.includes('FINE')
              ? isPostpaidPayableFee(fee, previousMonthStr)
              : feeMonth === previousMonthStr || feeMonth === currentMonthStr)
          : (feeType.includes('RENT') || feeType.includes('ADVANCE')
              ? feeMonth === currentMonthStr || feeMonth === previousMonthStr
              : (feeType.includes('EB') || feeType.includes('ELECTRIC') || feeType.includes('FINE'))
                ? feeMonth === previousMonthStr || feeMonth === currentMonthStr
                : feeMonth === currentMonthStr || feeMonth === previousMonthStr)));
    if (isPreviousSettledFee(fee) && !isPostpaidPayableNow) return false;
    return true;
  });

// Exact copy of the old Total Invoiced card.
const oldTotalInvoiced = (filteredFees: any[]) => {
  const { previousMonthStr, currentMonthStr } = getBillingMonths(NOW);
  return roundMoney(
    filteredFees
      .filter(f => {
        if (!['PENDING', 'COMPLETED'].includes(f.status) || isMessFee(f) || isOutstandingPayment(f)) return false;
        const collegeCycle = (f.student?.college?.billingCycle || 'PREPAID').toUpperCase();
        const feeMonth = resolveFeeBillingMonth(f);
        const feeType = String(f.transactionType || '').toUpperCase();
        const isCycleRelevantPending =
          !feeMonth ||
          (collegeCycle === 'POSTPAID'
            ? (feeType.includes('FINE')
                ? isPostpaidPayableFee(f, previousMonthStr)
                : feeMonth === previousMonthStr || feeMonth === currentMonthStr)
            : (feeType.includes('RENT') || feeType.includes('ADVANCE')
                ? feeMonth === currentMonthStr || feeMonth === previousMonthStr
                : (feeType.includes('EB') || feeType.includes('ELECTRIC') || feeType.includes('FINE'))
                  ? feeMonth === previousMonthStr || feeMonth === currentMonthStr
                  : feeMonth === currentMonthStr || feeMonth === previousMonthStr));
        if (isOutstandingInvoice(f) || (isImportedInvoice(f) && !isCycleRelevantPending)) return false;
        if (isPreviousSettledFee(f) && !isCycleRelevantPending) return false;
        return isCycleRelevantPending;
      })
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
  );
};

// Old Collected card: paid display groups only, with the pre-Nov-2026 cutoff.
const oldTotalCollected = (filteredFees: any[]) =>
  roundMoney(
    filteredFees
      .filter(f => f.status !== 'PENDING' && f.status !== 'FAILED' && !isMessFee(f))
      .filter(f => {
        const paidTime = f.paidDate || f.createdAt || f.updatedAt;
        return new Date(paidTime) >= new Date('2026-11-01T00:00:00');
      })
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
  );

// Old Pending card: displayFees Unpaid groups = payable PENDING rows plus
// outstanding remaining. No outstanding rows in the local dataset.
const oldPending = (filteredFees: any[]) => {
  const { previousMonthStr, currentMonthStr } = getBillingMonths(NOW);
  return roundMoney(
    filteredFees
      .filter(f => {
        if (f.status !== 'PENDING' || isMessFee(f) || isOutstandingInvoice(f)) return false;
        const collegeCycle = (f.student?.college?.billingCycle || 'PREPAID').toUpperCase();
        const feeMonth = resolveFeeBillingMonth(f);
        const type = String(f.transactionType || '').toUpperCase();
        let category = 'other';
        if (type.includes('RENT')) category = 'rent';
        else if (type.includes('EB') || type.includes('ELECTRIC')) category = 'eb';
        else if (type.includes('FINE')) category = 'fine';
        else if (type.includes('ADVANCE')) category = 'advance';

        const isCycleRelevant = (() => {
          if (collegeCycle === 'POSTPAID') {
            if (category === 'fine') return isPostpaidPayableFee(f, previousMonthStr);
            if (category === 'rent' || category === 'eb') {
              return !feeMonth || feeMonth === previousMonthStr || feeMonth === currentMonthStr;
            }
            return !feeMonth || feeMonth === previousMonthStr || feeMonth === currentMonthStr;
          }
          if (!feeMonth) return true;
          if (category === 'rent' || category === 'advance') return feeMonth === currentMonthStr;
          if (category === 'eb' || category === 'fine') {
            return feeMonth === previousMonthStr || feeMonth === currentMonthStr;
          }
          return feeMonth === currentMonthStr || feeMonth === previousMonthStr;
        })();

        if (isImportedInvoice(f) && !isCycleRelevant) return false;
        return isCycleRelevant;
      })
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
  );
};

const assert = (name: string, actual: any, expected: any) => {
  const a = typeof actual === 'number' ? roundMoney(actual) : actual;
  const e = typeof expected === 'number' ? roundMoney(expected) : expected;
  const ok = JSON.stringify(a) === JSON.stringify(e);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${JSON.stringify(a)}${ok ? '' : ` (expected ${JSON.stringify(e)})`}`);
  if (!ok) process.exitCode = 1;
};

const assertEquation = (name: string, r: any) => {
  const sum = roundMoney(r.totalCollected + r.pendingUnpaid + r.notDue + r.partialBalance + r.unreconciled);
  assert(`${name} equation`, sum, r.totalInvoiced);
};

const run = async () => {
  const live = await (await fetch('http://localhost:3000/fees')).json();
  const filtered = filterFees(live);

  const before = {
    invoiced: oldTotalInvoiced(filtered),
    collected: oldTotalCollected(filtered),
    pending: oldPending(filtered),
  };
  const after = buildFeeReconciliation({ allFees: live, filteredFees: filtered, now: NOW });

  console.log('\n=== LOCAL DATABASE BEFORE/AFTER ===');
  console.log('BEFORE', before, 'sum(collected+pending)=', roundMoney(before.collected + before.pending));
  console.log('AFTER ', after);
  assertEquation('live', after);
  assert('live invoiced', after.totalInvoiced, before.invoiced);
  assert('live collected', after.totalCollected, before.collected);
  assert('live pending', after.pendingUnpaid, before.pending);

  console.log('\n=== SYNTHETIC SCENARIOS ===');

  // Paid November invoice with a receipt dated before the old Nov-1 cutoff.
  const s1Fees = [
    fee({
      status: 'COMPLETED',
      transactionType: 'RENT',
      amount: 5000,
      billingMonth: '2026-11',
      description: 'Room Rent for November 2026',
      createdAt: '2026-10-30T00:00:00.000Z',
      paidDate: '2026-10-31T00:00:00.000Z',
      student: student('S1'),
    }),
  ];
  let r = buildFeeReconciliation({ allFees: s1Fees, filteredFees: filterFees(s1Fees), now: NOW });
  assert('pre-Nov receipt invoiced', r.totalInvoiced, 5000);
  assert('pre-Nov receipt collected', r.totalCollected, 5000);
  assert('pre-Nov receipt unreconciled', r.unreconciled, 0);

  // Pending October rent for a PREPAID college => Not Due (invoice still counted).
  const s2Fees = [
    fee({
      transactionType: 'RENT',
      amount: 4000,
      billingMonth: '2026-10',
      description: 'Room Rent for 2026-10',
      createdAt: '2026-10-01T00:00:00.000Z',
      student: student('S2'),
    }),
  ];
  r = buildFeeReconciliation({ allFees: s2Fees, filteredFees: filterFees(s2Fees), now: NOW });
  assert('previous-month prepaid rent invoiced', r.totalInvoiced, 4000);
  assert('previous-month prepaid rent not due', r.notDue, 4000);
  assert('previous-month prepaid rent pending', r.pendingUnpaid, 0);
  assertEquation('previous-month prepaid rent', r);

  // Pending November EB for PREPAID => payable now.
  const s3Fees = [
    fee({
      transactionType: 'EB_BILL',
      amount: 300,
      billingMonth: '2026-11',
      description: 'EB Bill for 2026-11',
      createdAt: '2026-11-02T00:00:00.000Z',
      student: student('S3'),
    }),
  ];
  r = buildFeeReconciliation({ allFees: s3Fees, filteredFees: filterFees(s3Fees), now: NOW });
  assert('prepaid eb pending', r.pendingUnpaid, 300);
  assert('prepaid eb not due', r.notDue, 0);

  // Future December rent => Not Due, still invoiced.
  const s4Fees = [
    fee({
      transactionType: 'RENT',
      amount: 6000,
      billingMonth: '2026-12',
      description: 'Room Rent for December 2026',
      createdAt: '2026-11-01T00:00:00.000Z',
      student: student('S4'),
    }),
  ];
  r = buildFeeReconciliation({ allFees: s4Fees, filteredFees: filterFees(s4Fees), now: NOW });
  assert('future rent invoiced', r.totalInvoiced, 6000);
  assert('future rent not due', r.notDue, 6000);

  // Postpaid previous month => payable now.
  const s5Fees = [
    fee({
      transactionType: 'RENT',
      amount: 4500,
      billingMonth: '2026-10',
      description: 'Room Rent for 2026-10',
      createdAt: '2026-11-01T00:00:00.000Z',
      student: student('S5', 'POSTPAID'),
    }),
  ];
  r = buildFeeReconciliation({ allFees: s5Fees, filteredFees: filterFees(s5Fees), now: NOW });
  assert('postpaid previous rent pending', r.pendingUnpaid, 4500);

  // Postpaid current month is accepted as payable by the existing Fees table.
  const s6Fees = [
    fee({
      transactionType: 'RENT',
      amount: 4500,
      billingMonth: '2026-11',
      description: 'Room Rent for 2026-11',
      createdAt: '2026-11-01T00:00:00.000Z',
      student: student('S6', 'POSTPAID'),
    }),
  ];
  r = buildFeeReconciliation({ allFees: s6Fees, filteredFees: filterFees(s6Fees), now: NOW });
  assert('postpaid current rent pending', r.pendingUnpaid, 4500);

  // Outstanding: ₹5,000 + ₹3,000 invoices with a ₹2,000 receipt.
  const s7Student = student('S7');
  const out1 = fee({
    transactionType: 'RENT',
    amount: 5000,
    description: 'Outstanding Rent for Sep 2026',
    createdAt: '2026-09-01T00:00:00.000Z',
    student: s7Student,
  });
  const out2 = fee({
    transactionType: 'EB_BILL',
    amount: 3000,
    description: 'Outstanding EB Bill for Sep 2026',
    createdAt: '2026-09-02T00:00:00.000Z',
    student: s7Student,
  });
  const outPay = fee({
    status: 'COMPLETED',
    transactionType: 'OUTSTANDING_PAYMENT',
    amount: 2000,
    description: 'Outstanding payment',
    createdAt: '2026-11-05T00:00:00.000Z',
    paidDate: '2026-11-05T00:00:00.000Z',
    student: s7Student,
  });
  const s7Fees = [out1, out2, outPay];
  r = buildFeeReconciliation({ allFees: s7Fees, filteredFees: filterFees(s7Fees), now: NOW });
  assert('outstanding invoiced', r.totalInvoiced, 8000);
  assert('outstanding collected', r.totalCollected, 2000);
  assert('outstanding pending', r.pendingUnpaid, 3000);
  assert('outstanding partial', r.partialBalance, 3000);
  assert('outstanding unreconciled', r.unreconciled, 0);
  assertEquation('outstanding partial', r);

  // Outstanding fully settled.
  const fullPay = { ...outPay, id: 'full', amount: 8000 };
  r = buildFeeReconciliation({ allFees: [out1, out2, fullPay], filteredFees: filterFees([out1, out2, fullPay]), now: NOW });
  assert('outstanding settled collected', r.totalCollected, 8000);
  assert('outstanding settled pending', r.pendingUnpaid, 0);
  assert('outstanding settled partial', r.partialBalance, 0);

  // Outstanding ledger is netted even when a status filter hides its invoice.
  r = buildFeeReconciliation({ allFees: s7Fees, filteredFees: [outPay], now: NOW });
  assert('filtered receipt invoiced', r.totalInvoiced, 8000);
  assert('filtered receipt collected', r.totalCollected, 2000);
  assert('filtered receipt pending', r.pendingUnpaid, 3000);
  assert('filtered receipt partial', r.partialBalance, 3000);

  // Mess fees stay out, imported September rows stay out.
  const s8Fees = [
    fee({ transactionType: 'MESS', amount: 2000, billingMonth: '2026-11', description: 'Mess Fee for Nov 2026', student: student('S8') }),
    fee({
      transactionType: 'RENT',
      amount: 4000,
      billingMonth: '2026-09',
      description: 'Imported September rent',
      createdAt: '2026-09-10T00:00:00.000Z',
      student: student('S8'),
    }),
  ];
  r = buildFeeReconciliation({ allFees: s8Fees, filteredFees: s8Fees, now: NOW });
  assert('mess + imported old out of scope', r.totalInvoiced, 0);

  // Legacy PARTIAL status cannot be split safely => Unreconciled.
  const s9Fees = [
    fee({ status: 'PARTIAL', transactionType: 'RENT', amount: 3000, billingMonth: '2026-11', description: 'Room Rent for Nov 2026', student: student('S9') }),
  ];
  r = buildFeeReconciliation({ allFees: s9Fees, filteredFees: s9Fees, now: NOW });
  assert('partial status invoiced', r.totalInvoiced, 3000);
  assert('partial status unreconciled', r.unreconciled, 3000);
  assert('partial status not reconciled', r.isReconciled, false);

  // Payments beyond outstanding invoices are reported as a negative residual.
  const overFees = [out1, { ...outPay, id: 'over', amount: 6000 }];
  r = buildFeeReconciliation({ allFees: overFees, filteredFees: filterFees(overFees), now: NOW });
  assert('overpayment collected', r.totalCollected, 6000);
  assert('overpayment unreconciled', r.unreconciled, -1000);
  assertEquation('overpayment', r);

  console.log('\nDone.');
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
