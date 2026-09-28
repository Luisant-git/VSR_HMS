import { Module } from '@nestjs/common';
import { EbBillsService } from './eb-bills.service';
import { EbBillsController } from './eb-bills.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EbBillsController],
  providers: [EbBillsService, PrismaService],
})
export class EbBillsModule {}
