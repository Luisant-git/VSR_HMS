import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateMessDeductionDto } from './dto/update-mess-deduction.dto';

@Injectable()
export class MessDeductionService {
  constructor(private prisma: PrismaService) { }

  async getSettings() {
    const res = await this.prisma.messDeductionMaster.findUnique({
      where: { id: 'GLOBAL' }
    });
    if (res) {
      return res;
    }
    return { id: 'GLOBAL', messDeductionThreshold: 15 };
  }

  async updateSettings(dto: UpdateMessDeductionDto) {
    return this.prisma.messDeductionMaster.upsert({
      where: { id: 'GLOBAL' },
      update: { messDeductionThreshold: dto.messDeductionThreshold },
      create: { id: 'GLOBAL', messDeductionThreshold: dto.messDeductionThreshold }
    });
  }
}
