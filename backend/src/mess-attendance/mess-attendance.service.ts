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

    // Enforce Cutoffs: Breakfast <= 12:00 PM, Lunch 12:00-3:00 PM, Snacks 3:00-7:00 PM, Dinner 7:00-10:00 PM
    if (mealType === 'Breakfast' && timeValue > 12.0) throw new ConflictException('Breakfast is only available until 12:00 PM');
    if (mealType === 'Lunch' && (timeValue <= 12.0 || timeValue > 15.0)) {
      throw new ConflictException(timeValue <= 12.0 ? 'Lunch is upcoming (opens after 12:00 PM)' : 'Lunch is closed (ended at 03:00 PM)');
    }
    if (mealType === 'Evening Snacks' && (timeValue <= 15.0 || timeValue > 19.0)) {
      throw new ConflictException(timeValue <= 15.0 ? 'Evening Snacks is upcoming (opens after 03:00 PM)' : 'Evening Snacks is closed (ended at 07:00 PM)');
    }
    if (mealType === 'Dinner' && (timeValue <= 19.0 || timeValue > 22.0)) {
      throw new ConflictException(timeValue <= 19.0 ? 'Dinner is upcoming (opens after 07:00 PM)' : 'Dinner is closed (ended at 10:00 PM)');
    }

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
