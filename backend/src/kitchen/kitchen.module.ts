import { Module } from '@nestjs/common';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [KitchenController],
  providers: [KitchenService, PrismaService],
  exports: [KitchenService],
})
export class KitchenModule {}
