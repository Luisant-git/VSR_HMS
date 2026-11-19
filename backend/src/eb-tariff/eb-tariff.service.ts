import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateEbTariffDto } from './dto/update-eb-tariff.dto';

export const DEFAULT_EB_TARIFF = 8.12;
const MASTER_ID = 'GLOBAL';

@Injectable()
export class EbTariffService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const row = await this.prisma.ebTariffMaster.findUnique({
      where: { id: MASTER_ID },
    });
    return {
      id: MASTER_ID,
      rate: row?.rate ?? DEFAULT_EB_TARIFF,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async updateSettings(dto: UpdateEbTariffDto) {
    return this.prisma.ebTariffMaster.upsert({
      where: { id: MASTER_ID },
      update: { rate: dto.rate },
      create: { id: MASTER_ID, rate: dto.rate },
    });
  }
}
