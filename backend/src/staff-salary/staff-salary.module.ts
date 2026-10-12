import { Module } from '@nestjs/common';
import { StaffSalaryController } from './staff-salary.controller';
import { StaffSalaryService } from './staff-salary.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [StaffSalaryController],
  providers: [StaffSalaryService, PrismaService],
  exports: [StaffSalaryService],
})
export class StaffSalaryModule {}
