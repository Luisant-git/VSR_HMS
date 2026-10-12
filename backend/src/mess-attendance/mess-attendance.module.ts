import { Module } from '@nestjs/common';
import { MessAttendanceController } from './mess-attendance.controller';
import { MessAttendanceService } from './mess-attendance.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MessAttendanceController],
  providers: [MessAttendanceService, PrismaService]
})
export class MessAttendanceModule {}
