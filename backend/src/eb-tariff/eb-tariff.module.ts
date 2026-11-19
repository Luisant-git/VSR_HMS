import { Module } from '@nestjs/common';
import { EbTariffController } from './eb-tariff.controller';
import { EbTariffService } from './eb-tariff.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EbTariffController],
  providers: [EbTariffService, PrismaService],
  exports: [EbTariffService],
})
export class EbTariffModule {}
