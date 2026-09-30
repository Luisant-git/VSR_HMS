import { Module } from '@nestjs/common';
import { MenuPermissionService } from './menu-permission.service';
import { MenuPermissionController } from './menu-permission.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MenuPermissionController],
  providers: [MenuPermissionService, PrismaService],
})
export class MenuPermissionModule {}
