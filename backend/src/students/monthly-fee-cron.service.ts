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

    // Find all active students
    const students = await this.prisma.student.findMany({
      where: {
        status: { not: 'Vacated' }
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    for (const student of students) {
      try {
        // Find the latest RENT transaction to get the rent amount
        const latestRentTx = student.transactions.find(t => t.transactionType === 'RENT');
        // Find the latest MESS transaction to get the mess amount
        const latestMessTx = student.transactions.find(t => t.transactionType === 'MESS');

        const transactionsToCreate = [];

        if (latestRentTx && latestRentTx.amount > 0) {
          transactionsToCreate.push({
            studentId: student.id,
            transactionType: 'RENT',
            amount: latestRentTx.amount,
            status: 'PENDING',
            description: `Room Rent for ${currentMonthYear}`,
          });
        }

        if (latestMessTx && latestMessTx.amount > 0) {
          transactionsToCreate.push({
            studentId: student.id,
            transactionType: 'MESS',
            amount: latestMessTx.amount,
            status: 'PENDING',
            description: `Mess Fee for ${currentMonthYear}`,
          });
        }

        if (transactionsToCreate.length > 0) {
          await this.prisma.feeTransaction.createMany({
            data: transactionsToCreate
          });
          this.logger.log(`Generated monthly fees for student ${student.regNo}`);
        }
      } catch (error: any) {
        this.logger.error(`Failed to generate monthly fees for student ${student.regNo}: ${error.message}`);
      }
    }

    this.logger.log('Monthly fee generation completed.');
  }
}
