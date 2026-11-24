import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { getFinePeriods, resolveFineThrough, sumFineDays } from '../common/fine-due-date';

type FineKey = 'rent' | 'mess' | 'eb';

/**
 * Fine rows created by this service carry the fee type in their description,
 * e.g. "Late fine accumulation - Rent for 7 days overdue (₹10/day)".
 * The UI uses the "- Rent|- Mess|- EB" tag to show each fine next to its
 * parent fee, so keep the format stable.
 */
const FINE_TAG_RE = /late fine accumulation\s*-\s*(rent|mess|eb)\b/i;

const isLateFine = (transaction: any) =>
  String(transaction?.transactionType || '').toUpperCase() === 'FINE' &&
  /late fine accumulation/i.test(String(transaction?.description || ''));

const fineKeyFromDescription = (description?: string | null): FineKey | null => {
  const match = String(description || '').match(FINE_TAG_RE);
  return match ? (match[1].toLowerCase() as FineKey) : null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

interface FineInfo {
  key: FineKey;
  label: string;
  rate: number;
  days: number;
  amount: number;
}

@Injectable()
export class FineCronService {
  private readonly logger = new Logger(FineCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.FINE_CRON_SCHEDULE || CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyFines() {
    this.logger.log('Running daily fine calculation cron job...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const colleges = await this.prisma.college.findMany({
      include: { fineMaster: true },
    });

    for (const college of colleges) {
      const rates: Record<FineKey, number> = {
        rent: Number(college.fineMaster?.rentFine) || 0,
        mess: Number(college.fineMaster?.messFine) || 0,
        eb: Number(college.fineMaster?.ebFine) || 0,
      };

      if (!rates.rent && !rates.mess && !rates.eb) {
        continue;
      }

      // Do not filter on Student.feeStatus here: that field is often stale
      // while the transaction ledger still has pending fees. The per-type
      // calculation below only produces a fine when a fee is actually overdue.
      const students = await this.prisma.student.findMany({
        where: {
          collegeId: college.id,
          status: { not: 'Vacated' },
        },
        include: {
          transactions: {
            where: { status: { in: ['PENDING', 'COMPLETED'] }, deletedAt: null },
          },
        },
      });

      for (const student of students) {
        try {
          await this.applyStudentFines(student, rates, today, college);
        } catch (error: any) {
          this.logger.error(
            `Failed to update fines for student ${student.regNo}: ${error.message}`,
          );
        }
      }
    }

    this.logger.log('Daily fine calculation completed.');
  }

  private async applyStudentFines(
    student: any,
    rates: Record<FineKey, number>,
    today: Date,
    college?: { dueDate?: Date | string | null; billingCycle?: string | null },
  ) {
    const transactions = student.transactions || [];
    let pending = transactions.filter((t: any) => t.status === 'PENDING');
    const completedLateFines = transactions.filter(
      (t: any) => t.status === 'COMPLETED' && isLateFine(t),
    );

    const configs: Array<{
      key: FineKey;
      label: string;
      rate: number;
      matches: (type: string) => boolean;
    }> = [
      {
        key: 'rent',
        label: 'Rent',
        rate: rates.rent,
        matches: (type) => type === 'RENT' || type === 'ADVANCE',
      },
      { key: 'mess', label: 'Mess', rate: rates.mess, matches: (type) => type === 'MESS' },
      { key: 'eb', label: 'EB', rate: rates.eb, matches: (type) => type === 'EB_BILL' },
    ];

    // Remove fine rows that have no matching fee at all. This fixes orphan
    // rows such as an EB fine on a student who never had an EB bill.
    const nonFineTransactions = transactions.filter(
      (t: any) => String(t.transactionType || '').toUpperCase() !== 'FINE',
    );
    const orphanFineIds = pending
      .filter(isLateFine)
      .filter((t: any) => {
        const key = fineKeyFromDescription(t.description);
        if (!key) return false;
        const config = configs.find((item) => item.key === key);
        if (!config) return false;
        return !nonFineTransactions.some((fee: any) =>
          config.matches(String(fee.transactionType || '').toUpperCase()),
        );
      })
      .map((t: any) => t.id);

    if (orphanFineIds.length > 0) {
      await this.prisma.feeTransaction.deleteMany({
        where: { id: { in: orphanFineIds } },
      });
      this.logger.log(`Removed ${orphanFineIds.length} orphan fine row(s) for student ${student.regNo}`);
      pending = pending.filter((t: any) => !orphanFineIds.includes(t.id));
    }

    // Payment-aware basis: include late-paid and partially settled fees, but
    // stop each one's accrual on the date it was actually cleared.
    const feeRows = transactions.filter((t: any) => {
      const type = String(t.transactionType || '').toUpperCase();
      return type !== 'FINE' && type !== 'OUTSTANDING_PAYMENT';
    });
    const paymentRows = transactions.filter(
      (t: any) =>
        String(t.transactionType || '').toUpperCase() === 'OUTSTANDING_PAYMENT' &&
        t.status === 'COMPLETED',
    );
    const fineThroughValues = resolveFineThrough(feeRows, paymentRows);
    const fineThroughByFee = new Map<any, Date | null>(
      (feeRows as any[]).map((row: any, index: number) => [row, fineThroughValues[index]]),
    );

    // Work out how much fine each fee type currently owes on its own.
    const expected = new Map<FineKey, FineInfo>();
    for (const config of configs) {
      if (config.rate <= 0) continue;

      const parents = feeRows
        .filter((t: any) => config.matches(String(t.transactionType || '').toUpperCase()))
        .map((t: any) => ({ ...t, fineThrough: fineThroughByFee.get(t) ?? null }));
      if (parents.length === 0) continue;

      // Fine Master holds a day of month, not a one-off date. Each fee is due
      // on that day of its own billing month, and counting starts the next
      // day. Unpaid fees from earlier months keep accruing until paid.
      const periods = getFinePeriods(parents, {
        collegeDueDate: college?.dueDate,
        billingCycle: college?.billingCycle,
      }, today);
      const days = sumFineDays(periods);
      if (days <= 0) continue;

      expected.set(config.key, {
        key: config.key,
        label: config.label,
        rate: config.rate,
        days,
        amount: roundMoney(days * config.rate),
      });
    }

    if (expected.size === 0) return;

    const pendingLate = pending.filter(isLateFine);
    const legacyPending = pendingLate.filter(
      (t: any) => !fineKeyFromDescription(t.description),
    );

    // Older builds stored a single aggregate fine row. Convert it to one row
    // per fee type, preserving the total already accumulated.
    if (legacyPending.length > 0) {
      const hasTypedRows = pendingLate.some((t: any) => fineKeyFromDescription(t.description));

      if (hasTypedRows) {
        await this.prisma.feeTransaction.deleteMany({
          where: { id: { in: legacyPending.map((t: any) => t.id) } },
        });
      } else {
        const legacyTotal = roundMoney(
          legacyPending.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0),
        );
        await this.prisma.feeTransaction.deleteMany({
          where: { id: { in: legacyPending.map((t: any) => t.id) } },
        });

        if (legacyTotal > 0) {
          const entries = Array.from(expected.entries());

          if (entries.length === 1) {
            const [key, info] = entries[0];
            const created = await this.prisma.feeTransaction.create({
              data: this.fineData(student.id, key, info, Math.max(legacyTotal, info.amount)),
            });
            pendingLate.push(created);
          } else {
            const totalExpected = roundMoney(
              entries.reduce((sum, [, info]) => sum + info.amount, 0),
            );
            let allocated = 0;

            for (let index = 0; index < entries.length; index++) {
              const [key, info] = entries[index];
              const isLast = index === entries.length - 1;
              const share = isLast
                ? roundMoney(legacyTotal - allocated)
                : roundMoney((legacyTotal * info.amount) / (totalExpected || 1));
              allocated = roundMoney(allocated + share);
              if (share > 0) {
                await this.createTypedFine(student.id, key, info, share, pendingLate);
              }
            }
          }
        }
      }
    }

    // Re-read pending late fines after any legacy migration.
    const typedPending = pendingLate.filter((t: any) => fineKeyFromDescription(t.description));

    for (const [key, info] of expected.entries()) {
      const rowsForType = typedPending.filter(
        (t: any) => fineKeyFromDescription(t.description) === key,
      );
      const paidForType = roundMoney(
        completedLateFines
          .filter((t: any) => fineKeyFromDescription(t.description) === key)
          .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0),
      );
      const description = this.fineDescription(info);
      // Recompute from scratch every run. This lowers stale rows when the due
      // date or Fine Master rate changes, instead of only ever increasing them.
      const targetAmount = roundMoney(Math.max(0, info.amount - paidForType));

      if (rowsForType.length > 0) {
        const primary = rowsForType[0];
        const currentAmount = roundMoney(Number(primary.amount) || 0);

        if (currentAmount === targetAmount && primary.description === description) continue;

        if (targetAmount <= 0) {
          await this.prisma.feeTransaction.deleteMany({
            where: { id: { in: rowsForType.map((row: any) => row.id) } },
          });
          this.logger.log(
            `Removed fully paid ${info.label} fine for student ${student.regNo}`,
          );
          continue;
        }

        await this.prisma.feeTransaction.update({
          where: { id: primary.id },
          data: { amount: targetAmount, description },
        });
        for (let i = 1; i < rowsForType.length; i++) {
          await this.prisma.feeTransaction.delete({ where: { id: rowsForType[i].id } });
        }
        this.logger.log(
          `Recalculated ${info.label} fine to ₹${targetAmount} for student ${student.regNo}`,
        );
      } else if (targetAmount > 0) {
        await this.createTypedFine(student.id, key, info, targetAmount, typedPending);
        this.logger.log(
          `Added ${info.label} fine of ₹${targetAmount} to student ${student.regNo}`,
        );
      }
    }
  }

  private async createTypedFine(
    studentId: string,
    key: FineKey,
    info: FineInfo,
    amount: number,
    sink: any[],
  ) {
    const created = await this.prisma.feeTransaction.create({
      data: this.fineData(studentId, key, info, amount),
    });
    sink.push(created);
    return created;
  }

  private fineData(studentId: string, key: FineKey, info: FineInfo, amount: number) {
    return {
      studentId,
      transactionType: 'FINE',
      amount: roundMoney(amount),
      status: 'PENDING',
      description: this.fineDescription({ ...info, key }),
    };
  }

  private fineDescription(info: FineInfo) {
    return `Late fine accumulation - ${info.label} for ${info.days} days overdue (₹${info.rate}/day)`;
  }
}
