import { Module } from '@nestjs/common';
import { BiometricAttendanceController } from './biometric-attendance.controller';
import { BiometricAttendanceService } from './biometric-attendance.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BiometricAttendanceController],
  providers: [BiometricAttendanceService, PrismaService],
})
export class BiometricAttendanceModule {}
