export type FineKey = 'rent' | 'mess' | 'eb';

export const LATE_FINE_RE = /late fine accumulation/i;
export const LATE_FINE_TAG_RE = /late fine accumulation\s*-\s*(rent|mess|eb)\b/i;

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const formatBillingMonthShortLabel = (monthStr?: string | null): string => {
  const match = String(monthStr || '').trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return '';
  const m = Number(match[2]);
  if (m < 1 || m > 12) return '';
  return `${SHORT_MONTHS[m - 1]} ${match[1]}`;
};

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
 * Checks whether the student has older unpaid dues from previous cycles.
 * Kept for informational context; never triggers rate doubling.
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

  const hasBacklog = nonFinePending.some((item) =>
    /^\s*outstanding\b/i.test(String(item.description || '')),
  );
  if (hasBacklog) return true;

  const distinctMonths = new Set(
    nonFinePending.map((item) => item.billingMonth).filter(Boolean),
  );
  if (distinctMonths.size > 1) return true;

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
 * Continuous daily fine calculation (1x daily rate, never doubled).
 * Every overdue day past a month's due date accrues at the standard daily rate
 * until settled.
 */
export function calculateContinuousFine(
  days: number,
  dailyRate: number,
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

  return {
    amount: roundMoney(days * dailyRate),
    regularDays: days,
    doubledDays: 0,
    isDoubled: false,
    effectiveRate: dailyRate,
  };
}

/**
 * Preserved signature for callers; delegates to continuous 1x fine calculation
 * (rate doubling is disabled).
 */
export function calculateTieredFine(
  days: number,
  dailyRate: number,
  _hasOlderDue: boolean = false,
): TieredFineResult {
  return calculateContinuousFine(days, dailyRate);
}

export function formatFineDescription(
  label: string,
  days: number,
  rate: number,
  calc?: {
    monthLabel?: string;
    isDoubled?: boolean;
    regularDays?: number;
    doubledDays?: number;
    effectiveRate?: number;
  },
): string {
  const monthSuffix = calc?.monthLabel ? ` (${calc.monthLabel})` : '';
  return `Late fine accumulation - ${label}${monthSuffix} for ${days} days overdue (₹${rate}/day)`;
}
