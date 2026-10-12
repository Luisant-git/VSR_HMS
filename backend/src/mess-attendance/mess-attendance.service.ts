import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import moment from 'moment-timezone';

@Injectable()
export class MessAttendanceService {
  constructor(private prisma: PrismaService) {}

  async getTodayAttendance(studentId: string) {
    const todayStr = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    return this.prisma.messAttendance.findMany({
      where: {
        studentId,
        dateStr: todayStr
      }
    });
  }

  async getAllTodayAttendance(dateFilter?: string) {
    const dateStr = dateFilter || moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    return this.prisma.messAttendance.findMany({
      where: { dateStr },
      include: {
        student: {
          select: { name: true, regNo: true, roomNo: true, foodType: true }
        }
      },
      orderBy: { scannedAt: 'desc' }
    });
  }

  async markAttendance(studentId: string, mealType: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const todayStr = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const now = moment().tz('Asia/Kolkata');
    const hour = now.hours();
    const minute = now.minutes();
    const timeValue = hour + (minute / 60);

    // Enforce Cutoffs (using 24hr format)
    if (mealType === 'Breakfast' && (timeValue < 7.5 || timeValue > 11.5)) throw new ConflictException('Breakfast is only available from 7:30 AM to 11:30 AM');
    if (mealType === 'Lunch' && (timeValue < 13.0 || timeValue > 15.0)) throw new ConflictException('Lunch is only available from 1:00 PM to 3:00 PM');
    if (mealType === 'Evening Snacks' && (timeValue < 16.5 || timeValue > 18.5)) throw new ConflictException('Snacks are only available from 4:30 PM to 6:30 PM');
    if (mealType === 'Dinner' && (timeValue < 20.0 || timeValue > 21.5)) throw new ConflictException('Dinner is only available from 8:00 PM to 9:30 PM');

    const existing = await this.prisma.messAttendance.findFirst({
      where: { studentId, dateStr: todayStr, mealType }
    });

    if (existing) {
      throw new ConflictException(`${mealType} is already marked for today`);
    }

    return this.prisma.messAttendance.create({
      data: {
        studentId,
        dateStr: todayStr,
        mealType
      }
    });
  }
}
