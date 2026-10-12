import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private get staffModel() {
    return (this.prisma as any).staff;
  }

  async getNextStaffCode(): Promise<{ nextCode: string }> {
    const allStaff = await this.staffModel.findMany({
      select: { staffCode: true },
      orderBy: { createdAt: 'desc' }
    });

    let maxNum = 0;
    const prefix = 'STF-';

    for (const s of allStaff) {
      if (s.staffCode && s.staffCode.startsWith(prefix)) {
        const numPart = s.staffCode.substring(prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }

    const nextNum = maxNum + 1;
    const nextCode = `${prefix}${String(nextNum).padStart(3, '0')}`;
    return { nextCode };
  }

  async create(dto: CreateStaffDto) {
    let code = dto.staffCode ? dto.staffCode.trim() : '';
    if (!code) {
      const { nextCode } = await this.getNextStaffCode();
      code = nextCode;
    }

    const existing = await this.staffModel.findUnique({
      where: { staffCode: code }
    });
    if (existing) {
      throw new BadRequestException(`Staff code "${code}" already exists.`);
    }

    let joiningDate = new Date();
    if (dto.joiningDate) {
      const parsed = new Date(dto.joiningDate);
      if (!isNaN(parsed.getTime())) {
        joiningDate = parsed;
      }
    }

    return this.staffModel.create({
      data: {
        staffCode: code,
        name: dto.name.trim(),
        joiningDate,
        role: dto.role.trim(),
        phone: dto.phone ? dto.phone.trim() : null,
        email: dto.email ? dto.email.trim() : null,
        salaryBasis: dto.salaryBasis || 'Monthly Fixed',
        baseSalary: dto.baseSalary !== undefined ? Number(dto.baseSalary) : 0.0,
        status: dto.status || 'Active',
        notes: dto.notes || null,
      }
    });
  }

  async findAll(query?: { search?: string; role?: string; salaryBasis?: string; status?: string }) {
    const where: any = {};

    if (query?.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { staffCode: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { role: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query?.role && query.role !== 'ALL') {
      where.role = query.role;
    }

    if (query?.salaryBasis && query.salaryBasis !== 'ALL') {
      where.salaryBasis = query.salaryBasis;
    }

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    return this.staffModel.findMany({
      where,
      orderBy: { staffCode: 'asc' }
    });
  }

  async findOne(id: string) {
    const staff = await this.staffModel.findUnique({
      where: { id }
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    return staff;
  }

  async update(id: string, dto: UpdateStaffDto) {
    const staff = await this.findOne(id);

    if (dto.staffCode && dto.staffCode.trim() !== staff.staffCode) {
      const clash = await this.staffModel.findUnique({
        where: { staffCode: dto.staffCode.trim() }
      });
      if (clash && clash.id !== id) {
        throw new BadRequestException(`Staff code "${dto.staffCode}" already in use.`);
      }
    }

    const data: any = {};
    if (dto.staffCode !== undefined) data.staffCode = dto.staffCode.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.role !== undefined) data.role = dto.role.trim();
    if (dto.phone !== undefined) data.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.email !== undefined) data.email = dto.email ? dto.email.trim() : null;
    if (dto.salaryBasis !== undefined) data.salaryBasis = dto.salaryBasis;
    if (dto.baseSalary !== undefined) data.baseSalary = Number(dto.baseSalary);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (dto.joiningDate) {
      const parsed = new Date(dto.joiningDate);
      if (!isNaN(parsed.getTime())) {
        data.joiningDate = parsed;
      }
    }

    return this.staffModel.update({
      where: { id },
      data
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.staffModel.delete({
      where: { id }
    });
  }

  async toggleStatus(id: string) {
    const staff = await this.findOne(id);
    const newStatus = staff.status === 'Active' ? 'Inactive' : 'Active';
    return this.staffModel.update({
      where: { id },
      data: { status: newStatus }
    });
  }
}
