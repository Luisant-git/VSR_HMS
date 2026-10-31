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
    const currentMonthYear = today.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Find all active students with their assigned room and transactions
    const students = await this.prisma.student.findMany({
      where: {
        status: { not: 'Vacated' }
      },
      include: {
        room: true,
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    for (const student of students) {
      try {
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
        // 1. Room Master's mess fee (if set and > 0)
        // 2. Latest MESS transaction amount
        // 3. Default standard mess fee (2000)
        const latestMessTx = student.transactions.find(t => t.transactionType === 'MESS');
        const messAmount = (student.room?.messFee && student.room.messFee > 0)
          ? student.room.messFee
          : (latestMessTx && latestMessTx.amount > 0 ? latestMessTx.amount : 2000);

        const transactionsToCreate = [];

        // Avoid creating duplicate invoices if the cron runs more than once in the same month
        const alreadyHasRentThisMonth = student.transactions.some(
          t => t.transactionType === 'RENT' && t.description?.includes(currentMonthYear)
        );
        const alreadyHasMessThisMonth = student.transactions.some(
          t => t.transactionType === 'MESS' && t.description?.includes(currentMonthYear)
        );

        if (!alreadyHasRentThisMonth && rentAmount > 0) {
          transactionsToCreate.push({
            studentId: student.id,
            transactionType: 'RENT',
            amount: rentAmount,
            status: 'PENDING',
            description: `Room Rent for ${currentMonthYear}`,
          });
        }

        if (!alreadyHasMessThisMonth && messAmount > 0) {
          transactionsToCreate.push({
            studentId: student.id,
            transactionType: 'MESS',
            amount: messAmount,
            status: 'PENDING',
            description: `Mess Fee for ${currentMonthYear}`,
          });
        }

        if (transactionsToCreate.length > 0) {
          await this.prisma.feeTransaction.createMany({
            data: transactionsToCreate
          });
          this.logger.log(`Generated monthly fees for student ${student.regNo}: Rent ₹${rentAmount}, Mess ₹${messAmount}`);
        }
      } catch (error: any) {
        this.logger.error(`Failed to generate monthly fees for student ${student.regNo}: ${error.message}`);
      }
    }

    this.logger.log('Monthly fee generation completed.');
  }
}
