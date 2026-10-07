import { Module } from '@nestjs/common';
import { MessDeductionController } from './mess-deduction.controller';
import { MessDeductionService } from './mess-deduction.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MessDeductionController],
  providers: [MessDeductionService, PrismaService],
})
export class MessDeductionModule {}
