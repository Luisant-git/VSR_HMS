import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MenuPermissionService } from './menu-permission.service';

@Controller('menu-permission')
export class MenuPermissionController {
  constructor(private readonly menuPermissionService: MenuPermissionService) {}

  @Get('role/:role')
  async getByRole(@Param('role') role: string) {
    return this.menuPermissionService.getByRole(role);
  }

  @Get('all')
  async getAll() {
    return this.menuPermissionService.getAll();
  }

  @Post()
  async upsert(@Body() body: { role: string; permissions: any }) {
    return this.menuPermissionService.upsert(body.role, body.permissions);
  }
}
