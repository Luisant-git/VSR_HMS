import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

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
      include: { fineMaster: true }
    });

    for (const college of colleges) {
      if (!college.dueDate || !college.fineMaster || college.fineMaster.finePerDay <= 0) {
        continue;
      }

      const dueDate = new Date(college.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      // If the due date has passed
      if (today > dueDate) {
        const timeDiff = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(timeDiff / (1000 * 3600 * 24));
        const expectedTotalFine = daysOverdue * college.fineMaster.finePerDay;

        this.logger.log(`College ${college.name} is ${daysOverdue} days overdue. Expected total fine per student: ₹${expectedTotalFine}`);

        const students = await this.prisma.student.findMany({
          where: {
            collegeId: college.id,
            status: { not: 'Vacated' },
            feeStatus: { not: 'Paid' } 
          },
          include: {
            transactions: {
              where: { status: 'PENDING' }
            }
          }
        });

        for (const student of students) {
          // Verify they have pending base fees (not just previous fines)
          const hasPendingBaseFees = student.transactions.some(t => t.transactionType !== 'FINE');
          
          if (hasPendingBaseFees) {
            // Sum all currently pending fines
            const existingPendingFines = student.transactions
              .filter(t => t.transactionType === 'FINE')
              .reduce((sum, t) => sum + t.amount, 0);

            if (expectedTotalFine > existingPendingFines) {
              const difference = expectedTotalFine - existingPendingFines;
              const description = `Late fine accumulation for ${daysOverdue} days overdue (₹${college.fineMaster.finePerDay}/day)`;
              
              await this.prisma.feeTransaction.create({
                data: {
                  studentId: student.id,
                  transactionType: 'FINE',
                  amount: difference,
                  status: 'PENDING',
                  description: description
                }
              });
              this.logger.log(`Added catch-up fine of ₹${difference} to student ${student.regNo}`);
            }
          }
        }
      }
    }
    this.logger.log('Daily fine calculation completed.');
  }
}
