import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { getFinePeriods, resolveFineThrough } from '../common/fine-due-date';
import {
  FineKey,
  roundMoney,
  fineKeyFromDescription,
  calculateContinuousFine,
  formatBillingMonthShortLabel,
  formatFineDescription,
} from '../fees/fine-calculator';

const isLateFine = (transaction: any) =>
  String(transaction?.transactionType || '').toUpperCase() === 'FINE' &&
  /late fine accumulation/i.test(String(transaction?.description || ''));

interface MonthlyFineInfo {
  key: FineKey;
  billingMonth: string;
  monthLabel: string;
  dueDate: Date;
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

    // Work out how much fine each (fee type, billing month) owes continuously
    // at 1x daily rate (no doubling).
    const expectedByType = new Map<FineKey, MonthlyFineInfo[]>();
    for (const config of configs) {
      if (config.rate <= 0) continue;

      const parents = feeRows
        .filter((t: any) => config.matches(String(t.transactionType || '').toUpperCase()))
        .map((t: any) => ({ ...t, fineThrough: fineThroughByFee.get(t) ?? null }));
      if (parents.length === 0) continue;

      const periods = getFinePeriods(
        parents,
        {
          collegeDueDate: college?.dueDate,
          billingCycle: college?.billingCycle,
        },
        today,
      ).filter((p) => p.days > 0);
      if (periods.length === 0) continue;

      const entries: MonthlyFineInfo[] = periods.map((period) => {
        const calc = calculateContinuousFine(period.days, config.rate);
        return {
          key: config.key,
          billingMonth: period.billingMonth,
          monthLabel: formatBillingMonthShortLabel(period.billingMonth) || period.billingMonth,
          dueDate: period.dueDate,
          label: config.label,
          rate: config.rate,
          days: period.days,
          amount: calc.amount,
        };
      });
      expectedByType.set(config.key, entries);
    }

    if (expectedByType.size === 0) return;

    const pendingLate = pending.filter(isLateFine);
    const legacyPending = pendingLate.filter(
      (t: any) => !fineKeyFromDescription(t.description),
    );

    // Older builds stored a single aggregate fine row. Convert it to separate
    // monthly fine rows per fee type, preserving the total already accumulated.
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
          const allEntries = Array.from(expectedByType.values()).flat();
          if (allEntries.length === 1) {
            const info = allEntries[0];
            const created = await this.prisma.feeTransaction.create({
              data: this.fineData(student.id, info, Math.max(legacyTotal, info.amount)),
            });
            pendingLate.push(created);
          } else {
            const totalExpected = roundMoney(
              allEntries.reduce((sum, info) => sum + info.amount, 0),
            );
            let allocated = 0;

            for (let index = 0; index < allEntries.length; index++) {
              const info = allEntries[index];
              const isLast = index === allEntries.length - 1;
              const share = isLast
                ? roundMoney(legacyTotal - allocated)
                : roundMoney((legacyTotal * info.amount) / (totalExpected || 1));
              allocated = roundMoney(allocated + share);
              if (share > 0) {
                await this.createTypedFine(student.id, info, share, pendingLate);
              }
            }
          }
        }
      }
    }

    // Re-read pending late fines after any legacy migration.
    const typedPending = pendingLate.filter((t: any) => fineKeyFromDescription(t.description));

    for (const [key, entries] of expectedByType.entries()) {
      const allPendingForType = typedPending.filter(
        (t: any) => fineKeyFromDescription(t.description) === key,
      );
      const completedForType = completedLateFines.filter(
        (t: any) => fineKeyFromDescription(t.description) === key,
      );

      // Separate explicit month-tagged paid fines from untagged legacy paid fines.
      const paidByMonth = new Map<string, number>();
      let untaggedPaidPool = 0;
      for (const paidRow of completedForType) {
        const amt = Number(paidRow.amount) || 0;
        const bm = String(paidRow.billingMonth || '').trim();
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(bm)) {
          paidByMonth.set(bm, roundMoney((paidByMonth.get(bm) || 0) + amt));
        } else {
          untaggedPaidPool = roundMoney(untaggedPaidPool + amt);
        }
      }

      const claimedRowIds = new Set<string>();

      for (const info of entries) {
        const explicitPaid = paidByMonth.get(info.billingMonth) || 0;
        const afterExplicit = roundMoney(Math.max(0, info.amount - explicitPaid));
        const untaggedUsed = roundMoney(Math.min(untaggedPaidPool, afterExplicit));
        untaggedPaidPool = roundMoney(untaggedPaidPool - untaggedUsed);
        const targetAmount = roundMoney(Math.max(0, afterExplicit - untaggedUsed));

        const description = this.fineDescription(info);

        // Find matching pending row for this (type, billingMonth). If none has
        // an explicit billingMonth yet (migrating from pre-monthly rows), reuse
        // an unclaimed untagged pending row.
        const matchingRows = allPendingForType.filter((t: any) => {
          if (claimedRowIds.has(t.id)) return false;
          if (t.billingMonth) return String(t.billingMonth).trim() === info.billingMonth;
          if (info.monthLabel && String(t.description || '').includes(`(${info.monthLabel})`)) {
            return true;
          }
          return false;
        });

        let primary = matchingRows[0];
        if (!primary) {
          primary = allPendingForType.find(
            (t: any) => !claimedRowIds.has(t.id) && !t.billingMonth,
          );
        }

        if (primary) {
          claimedRowIds.add(primary.id);
          // Claim any duplicates for the exact same month to delete them cleanly
          for (let i = 1; i < matchingRows.length; i++) {
            claimedRowIds.add(matchingRows[i].id);
            await this.prisma.feeTransaction.delete({ where: { id: matchingRows[i].id } });
          }

          if (targetAmount <= 0) {
            await this.prisma.feeTransaction.deleteMany({
              where: { id: { in: [primary.id] } },
            });
            this.logger.log(
              `Removed fully paid ${info.label} (${info.monthLabel}) fine for student ${student.regNo}`,
            );
            continue;
          }

          const currentAmount = roundMoney(Number(primary.amount) || 0);
          const sameMonth = String(primary.billingMonth || '') === info.billingMonth;
          if (
            currentAmount === targetAmount &&
            primary.description === description &&
            sameMonth
          ) {
            continue;
          }

          await this.prisma.feeTransaction.update({
            where: { id: primary.id },
            data: {
              amount: targetAmount,
              description,
              billingMonth: info.billingMonth,
              dueDate: info.dueDate,
            },
          });
          this.logger.log(
            `Recalculated ${info.label} (${info.monthLabel}) fine to ₹${targetAmount} for student ${student.regNo}`,
          );
        } else if (targetAmount > 0) {
          const created = await this.createTypedFine(
            student.id,
            info,
            targetAmount,
            typedPending,
          );
          if (created?.id) claimedRowIds.add(created.id);
          this.logger.log(
            `Added ${info.label} (${info.monthLabel}) fine of ₹${targetAmount} to student ${student.regNo}`,
          );
        }
      }

      // Remove any leftover stale pending rows for this type that aren't claimed
      const staleIds = allPendingForType
        .filter((t: any) => t.id && !claimedRowIds.has(t.id))
        .map((t: any) => t.id);
      if (staleIds.length > 0) {
        await this.prisma.feeTransaction.deleteMany({
          where: { id: { in: staleIds } },
        });
      }
    }
  }

  private async createTypedFine(
    studentId: string,
    info: MonthlyFineInfo,
    amount: number,
    sink: any[],
  ) {
    const created = await this.prisma.feeTransaction.create({
      data: this.fineData(studentId, info, amount),
    });
    sink.push(created);
    return created;
  }

  private fineData(studentId: string, info: MonthlyFineInfo, amount: number) {
    return {
      studentId,
      transactionType: 'FINE',
      amount: roundMoney(amount),
      status: 'PENDING',
      billingMonth: info.billingMonth,
      dueDate: info.dueDate,
      description: this.fineDescription(info),
    };
  }

  private fineDescription(info: MonthlyFineInfo) {
    return formatFineDescription(info.label, info.days, info.rate, {
      monthLabel: info.monthLabel,
    });
  }
}
