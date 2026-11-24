export type FineKey = 'rent' | 'mess' | 'eb';

export const LATE_FINE_RE = /late fine accumulation/i;
export const LATE_FINE_TAG_RE = /late fine accumulation\s*-\s*(rent|mess|eb)\b/i;

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const startOfDay = (value: Date | string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const fineKeyFromDescription = (
  description?: string | null,
): FineKey | null => {
  const match = String(description || '').match(LATE_FINE_TAG_RE);
  return match ? (match[1].toLowerCase() as FineKey) : null;
};

export interface TieredFineResult {
  amount: number;
  regularDays: number;
  doubledDays: number;
  isDoubled: boolean;
  effectiveRate: number;
}

/**
 * Checks whether the student has older unpaid dues from previous cycles:
 * - Unpaid outstanding / backlog balance
 * - Dues with a dueDate strictly older than the current fee's dueDate
 * - Multiple distinct billing months pending
 */
export function hasOlderUnpaidDues(
  pendingTransactions: any[],
  currentDueDate?: Date | null,
): boolean {
  if (!pendingTransactions || pendingTransactions.length === 0) return false;
  const nonFinePending = pendingTransactions.filter(
    (item) =>
      String(item.transactionType || '').toUpperCase() !== 'FINE' &&
      item.status === 'PENDING',
  );
  if (nonFinePending.length === 0) return false;

  // Has outstanding backlog?
  const hasBacklog = nonFinePending.some((item) =>
    /^\s*outstanding\b/i.test(String(item.description || '')),
  );
  if (hasBacklog) return true;

  // Has multiple distinct billing months pending?
  const distinctMonths = new Set(
    nonFinePending.map((item) => item.billingMonth).filter(Boolean),
  );
  if (distinctMonths.size > 1) return true;

  // Has dues with a due date from a prior calendar month / cycle?
  if (currentDueDate) {
    const curDue = startOfDay(currentDueDate);
    const curMonthKey = curDue.getFullYear() * 12 + curDue.getMonth();
    const hasPriorMonthDue = nonFinePending.some((item) => {
      if (!item.dueDate) return false;
      const itemDue = startOfDay(item.dueDate);
      const itemMonthKey = itemDue.getFullYear() * 12 + itemDue.getMonth();
      return itemMonthKey < curMonthKey;
    });
    if (hasPriorMonthDue) return true;
  }

  return false;
}

/**
 * Calculates late fine with month-over-month doubling:
 * - Within first month overdue (<= 30 days past due date): standard daily rate (1x)
 * - After first month (> 30 days overdue into next month): next month's days are charged at doubled daily rate (2x)
 * - If older / prior dues are also unpaid: all overdue days are charged at doubled rate (2x)
 */
export function calculateTieredFine(
  days: number,
  dailyRate: number,
  hasOlderDue: boolean = false,
): TieredFineResult {
  if (days <= 0 || dailyRate <= 0) {
    return {
      amount: 0,
      regularDays: 0,
      doubledDays: 0,
      isDoubled: false,
      effectiveRate: dailyRate,
    };
  }

  // If older/prior cycle dues were not paid, the student is in multi-cycle default:
  // entire overdue duration is charged at doubled rate (2x daily rate).
  if (hasOlderDue) {
    const doubledRate = dailyRate * 2;
    return {
      amount: roundMoney(days * doubledRate),
      regularDays: 0,
      doubledDays: days,
      isDoubled: true,
      effectiveRate: doubledRate,
    };
  }

  // Normal cycle progression:
  // Month 1 (first 30 days past due date): regular daily rate
  // Month 2 and beyond (> 30 days past due date): doubled daily rate
  if (days <= 30) {
    return {
      amount: roundMoney(days * dailyRate),
      regularDays: days,
      doubledDays: 0,
      isDoubled: false,
      effectiveRate: dailyRate,
    };
  }

  const regularDays = 30;
  const doubledDays = days - 30;
  const doubledRate = dailyRate * 2;
  const amount = roundMoney(regularDays * dailyRate + doubledDays * doubledRate);

  return {
    amount,
    regularDays,
    doubledDays,
    isDoubled: true,
    effectiveRate: doubledRate,
  };
}

export function formatFineDescription(
  label: string,
  days: number,
  rate: number,
  calc: {
    isDoubled: boolean;
    regularDays: number;
    doubledDays: number;
    effectiveRate: number;
  },
): string {
  if (calc.isDoubled && calc.doubledDays > 0 && calc.regularDays > 0) {
    return `Late fine accumulation - ${label} for ${days} days overdue (30d @ ₹${rate}/day + ${calc.doubledDays}d @ ₹${rate * 2}/day doubled)`;
  }
  if (calc.isDoubled && calc.doubledDays > 0) {
    return `Late fine accumulation - ${label} for ${days} days overdue (₹${calc.effectiveRate}/day doubled - prior dues unpaid)`;
  }
  return `Late fine accumulation - ${label} for ${days} days overdue (₹${rate}/day)`;
}
