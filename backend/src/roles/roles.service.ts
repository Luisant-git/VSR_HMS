import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const DEFAULT_SYSTEM_ROLES = [
  {
    name: 'ADMIN',
    label: 'Admin',
    description: 'Hostel Administrator',
    isSystem: true,
  },
  {
    name: 'WARDEN',
    label: 'Warden',
    description: 'Hostel Warden',
    isSystem: true,
  },
  {
    name: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'Super Administrator',
    isSystem: true,
  },
  {
    name: 'DEVELOPER',
    label: 'Developer',
    description: 'System Developer',
    isSystem: true,
  },
  {
    name: 'CANTEEN_MANAGER',
    label: 'Canteen Manager',
    description: 'Canteen & Mess Manager',
    isSystem: true,
  },
];

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const role of DEFAULT_SYSTEM_ROLES) {
      await (this.prisma as any).role.upsert({
        where: { name: role.name },
        update: {},
        create: role,
      });
    }
  }

  private normalizeRoleName(raw: string): string {
    const normalized = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!normalized) {
      throw new BadRequestException('Role code is required');
    }
    return normalized;
  }

  async findAll(activeOnly = false) {
    return (this.prisma as any).role.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: { name: string; label?: string; description?: string; isActive?: boolean }) {
    const name = this.normalizeRoleName(dto.name || dto.label || '');
    const label = String(dto.label || dto.name || '').trim();
    if (!label) {
      throw new BadRequestException('Role display name is required');
    }

    const existing = await (this.prisma as any).role.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException(`Role "${name}" already exists`);
    }

    return (this.prisma as any).role.create({
      data: {
        name,
        label,
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
        isSystem: false,
      },
    });
  }

  async update(
    id: string,
    dto: { name?: string; label?: string; description?: string; isActive?: boolean },
  ) {
    const existing = await (this.prisma as any).role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    const label = dto.label !== undefined ? String(dto.label).trim() : existing.label;
    if (!label) {
      throw new BadRequestException('Role display name is required');
    }

    let nextName = existing.name;
    if (existing.name !== 'DEVELOPER' && dto.name !== undefined) {
      nextName = this.normalizeRoleName(dto.name);
      if (nextName !== existing.name) {
        const conflict = await (this.prisma as any).role.findUnique({ where: { name: nextName } });
        if (conflict) {
          throw new BadRequestException(`Role "${nextName}" already exists`);
        }
      }
    }

    if (existing.name === 'DEVELOPER' && dto.isActive === false) {
      throw new BadRequestException('Developer role cannot be deactivated');
    }

    return this.prisma.$transaction(async (tx) => {
      if (nextName !== existing.name) {
        await tx.user.updateMany({
          where: { role: existing.name },
          data: { role: nextName },
        });
        await tx.menuPermission.updateMany({
          where: { role: existing.name },
          data: { role: nextName },
        });
      }

      return (tx as any).role.update({
        where: { id },
        data: {
          name: nextName,
          label,
          description:
            dto.description !== undefined
              ? dto.description?.trim() || null
              : existing.description,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
        },
      });
    });
  }

  async toggleActive(id: string) {
    const existing = await (this.prisma as any).role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }
    if (existing.name === 'DEVELOPER' && existing.isActive) {
      throw new BadRequestException('Developer role cannot be deactivated');
    }
    return (this.prisma as any).role.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  async remove(id: string) {
    const existing = await (this.prisma as any).role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }
    if (existing.name === 'DEVELOPER') {
      throw new BadRequestException('Developer role cannot be deleted');
    }

    const assignedUsers = await this.prisma.user.count({
      where: { role: existing.name },
    });
    if (assignedUsers > 0) {
      throw new BadRequestException(
        `Cannot delete role "${existing.label}" because ${assignedUsers} user(s) are assigned to it`,
      );
    }

    await this.prisma.menuPermission.deleteMany({
      where: { role: existing.name },
    });

    return (this.prisma as any).role.delete({ where: { id } });
  }
}
