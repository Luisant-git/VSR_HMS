import { Module } from '@nestjs/common';
import { FeesService } from './fees.service';
import { FeesController } from './fees.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [FeesService, PrismaService],
  controllers: [FeesController]
})
export class FeesModule {}
