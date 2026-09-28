import { Module } from '@nestjs/common';
import { ClearanceService } from './clearance.service';
import { ClearanceController } from './clearance.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ClearanceController],
  providers: [ClearanceService, PrismaService],
})
export class ClearanceModule {}
