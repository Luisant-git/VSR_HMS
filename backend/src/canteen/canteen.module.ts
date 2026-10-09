import { Module } from '@nestjs/common';
import { CanteenController } from './canteen.controller';
import { CanteenService } from './canteen.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CanteenController],
  providers: [CanteenService, PrismaService],
  exports: [CanteenService]
})
export class CanteenModule {}
