import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MonthlyFeeCronService {
  private readonly logger = new Logger(MonthlyFeeCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyFees() {
    this.logger.log('Running monthly fee generation cron job...');

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const currentBillingMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const previousBillingMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const currentMonthYear = today.toLocaleString('default', { month: 'long', year: 'numeric' });
    const prevDate = new Date(prevYear, prevMonth - 1, 1);
    const previousMonthYear = prevDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const colleges = await this.prisma.college.findMany({
      include: { fineMaster: true },
    });

    const collegeBillingCycle = new Map<string, string>();
    for (const college of colleges) {
      collegeBillingCycle.set(college.id, college.billingCycle || 'PREPAID');
    }

    const students = await this.prisma.student.findMany({
      where: {
        status: { not: 'Vacated' },
      },
      include: {
        room: true,
        college: true,
        transactions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    for (const student of students) {
      try {
        const collegeId = student.collegeId;
        const billingCycle = collegeId ? (collegeBillingCycle.get(collegeId) || 'PREPAID') : 'PREPAID';

        // Determine billing month based on college's billing cycle
        // PREPAID: generate fees for current month (e.g., Nov 1 -> November fees)
        // POSTPAID: generate fees for previous month (e.g., Nov 1 -> October fees)
        let billingMonth: string;
        let descriptionMonthYear: string;
        let dueDate: Date | undefined;

        if (billingCycle === 'POSTPAID') {
          billingMonth = previousBillingMonth;
          descriptionMonthYear = previousMonthYear;
        } else {
          billingMonth = currentBillingMonth;
          descriptionMonthYear = currentMonthYear;
        }

        // Set due date based on college's due date and billing cycle
        // PREPAID: due date in the billing month (e.g., November fees due Nov 5)
        // POSTPAID: due date in the invoice generation month (e.g., Nov fees generated Dec 1, due Dec 5)
        if (student.college?.dueDate) {
          const collegeDueDate = new Date(student.college.dueDate);
          const dueDay = collegeDueDate.getDate();

          if (billingCycle === 'POSTPAID') {
            // For POSTPAID, due date is in the current (generation) month
            dueDate = new Date(currentYear, currentMonth - 1, dueDay);
          } else {
            // For PREPAID, due date is in the billing month
            dueDate = new Date(
              billingCycle === 'POSTPAID' ? prevYear : currentYear,
              billingCycle === 'POSTPAID' ? prevMonth - 1 : currentMonth - 1,
              dueDay,
            );
          }
        }

        // Priority for Room Rent:
        // 1. Student's specific custom rent override (if set and > 0)
        // 2. Room Master's monthly rent for the student's assigned room (if set and > 0)
        // 3. Fallback to latest RENT transaction amount
        const latestRentTx = student.transactions.find(t => t.transactionType === 'RENT');
        const rentAmount = (student.rent && student.rent > 0)
          ? student.rent
          : (student.room?.rent && student.room.rent > 0)
            ? student.room.rent
            : (latestRentTx && latestRentTx.amount > 0 ? latestRentTx.amount : 0);

        // Priority for Mess Fee:
        // 1. Latest MESS transaction amount (if set and > 0)
        // 2. Default standard mess fee (2000) for all students
        const latestMessTx = student.transactions.find(t => t.transactionType === 'MESS');
        const messAmount = (latestMessTx && latestMessTx.amount > 0) ? latestMessTx.amount : 2000;

        const transactionsToCreate = [];

        // Avoid creating duplicate invoices using billingMonth + studentId + transactionType
        const alreadyHasRentThisMonth = student.transactions.some(
          t => t.transactionType === 'RENT' && t.billingMonth === billingMonth
        );
        const alreadyHasMessThisMonth = student.transactions.some(
          t => t.transactionType === 'MESS' && t.billingMonth === billingMonth
        );

        if (!alreadyHasRentThisMonth && rentAmount > 0) {
          transactionsToCreate.push({
            studentId: student.id,
            transactionType: 'RENT',
            amount: rentAmount,
            status: 'PENDING',
            description: `Room Rent for ${descriptionMonthYear}`,
            billingMonth,
            dueDate,
          });
        }

        if (!alreadyHasMessThisMonth && messAmount > 0) {
          transactionsToCreate.push({
            studentId: student.id,
            transactionType: 'MESS',
            amount: messAmount,
            status: 'PENDING',
            description: `Mess Fee for ${descriptionMonthYear}`,
            billingMonth,
            dueDate,
          });
        }

        if (transactionsToCreate.length > 0) {
          await this.prisma.feeTransaction.createMany({
            data: transactionsToCreate,
          });
          this.logger.log(
            `Generated monthly fees for student ${student.regNo} (${billingCycle}): Rent ₹${rentAmount}, Mess ₹${messAmount}, Billing Month ${billingMonth}`,
          );
        }
      } catch (error: any) {
        this.logger.error(`Failed to generate monthly fees for student ${student.regNo}: ${error.message}`);
      }
    }

    this.logger.log('Monthly fee generation completed.');
  }
}
