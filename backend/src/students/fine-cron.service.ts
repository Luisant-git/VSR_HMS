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
      const rentFine = college.fineMaster?.rentFine || 0;
      const messFine = college.fineMaster?.messFine || 0;
      const ebFine = college.fineMaster?.ebFine || 0;

      if (!rentFine && !messFine && !ebFine) {
        continue;
      }

        const students = await this.prisma.student.findMany({
          where: {
            collegeId: college.id,
            status: { not: 'Vacated' },
            feeStatus: { not: 'Paid' } 
          },
          include: {
            transactions: {
              where: {
                OR: [
                  { status: 'PENDING' },
                  { status: 'COMPLETED', transactionType: 'FINE' },
                ],
              },
            }
          }
        });

        for (const student of students) {
          const pendingTransactions = student.transactions.filter(t => t.status === 'PENDING');

          // Determine which fee types are overdue based on each fee's individual dueDate.
          const hasPendingRent = pendingTransactions.some(
            t => (t.transactionType === 'RENT' || t.transactionType === 'ADVANCE') &&
              t.dueDate && new Date(t.dueDate).setHours(0, 0, 0, 0) <= today.getTime()
          );
          const hasPendingMess = pendingTransactions.some(
            t => t.transactionType === 'MESS' &&
              t.dueDate && new Date(t.dueDate).setHours(0, 0, 0, 0) <= today.getTime()
          );
          const hasPendingEb = pendingTransactions.some(
            t => t.transactionType === 'EB_BILL' &&
              t.dueDate && new Date(t.dueDate).setHours(0, 0, 0, 0) <= today.getTime()
          );

          if (!hasPendingRent && !hasPendingMess && !hasPendingEb) {
            continue;
          }

          const dailyFine = (hasPendingRent ? rentFine : 0) + (hasPendingMess ? messFine : 0) + (hasPendingEb ? ebFine : 0);

          if (dailyFine <= 0) continue;

          // Calculate max days overdue across all overdue pending fees.
          let maxDaysOverdue = 0;
          for (const tx of pendingTransactions) {
            if (tx.transactionType === 'RENT' || tx.transactionType === 'MESS' || tx.transactionType === 'EB_BILL' || tx.transactionType === 'ADVANCE') {
              if (tx.dueDate) {
                const due = new Date(tx.dueDate);
                due.setHours(0, 0, 0, 0);
                if (today >= due) {
                  const timeDiff = today.getTime() - due.getTime();
                  const days = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;
                  maxDaysOverdue = Math.max(maxDaysOverdue, days);
                }
              }
            }
          }

          if (maxDaysOverdue === 0) continue;

          const expectedTotalFine = maxDaysOverdue * dailyFine;
          const pendingFines = pendingTransactions.filter(t => t.transactionType === 'FINE');
          const existingPendingFinesTotal = pendingFines.reduce((sum, t) => sum + t.amount, 0);
          const paidFineTotal = student.transactions
            .filter(t =>
              t.status === 'COMPLETED' &&
              t.transactionType === 'FINE' &&
              /late fine accumulation/i.test(String(t.description || '')),
            )
            .reduce((sum, t) => sum + t.amount, 0);
          const fineStillDue = Math.max(0, expectedTotalFine - paidFineTotal);

          if (fineStillDue > existingPendingFinesTotal) {
            const difference = fineStillDue - existingPendingFinesTotal;
            const description = `Late fine accumulation for ${maxDaysOverdue} days overdue (₹${dailyFine}/day)`;
            
            if (pendingFines.length > 0) {
              // Consolidate into the first pending fine record
              const primaryFine = pendingFines[0];
              const newAmount = primaryFine.amount + difference;
              
              await this.prisma.feeTransaction.update({
                where: { id: primaryFine.id },
                data: { amount: newAmount, description: description }
              });

              // Remove any duplicate pending fine rows to keep UI clean
              if (pendingFines.length > 1) {
                for (let i = 1; i < pendingFines.length; i++) {
                  await this.prisma.feeTransaction.delete({ where: { id: pendingFines[i].id } });
                }
              }
              this.logger.log(`Consolidated fine to ₹${newAmount} for student ${student.regNo}`);
            } else {
              // No pending fines, create a fresh one
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
    this.logger.log('Daily fine calculation completed.');
  }
}
