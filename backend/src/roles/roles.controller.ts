import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  private ensureDeveloper(req: any) {
    if (req.user?.role !== 'DEVELOPER') {
      throw new UnauthorizedException('Only DEVELOPER can manage roles');
    }
  }

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.rolesService.findAll(activeOnly === 'true');
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { name: string; label?: string; description?: string; isActive?: boolean },
  ) {
    this.ensureDeveloper(req);
    return this.rolesService.create(body);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; label?: string; description?: string; isActive?: boolean },
  ) {
    this.ensureDeveloper(req);
    return this.rolesService.update(id, body);
  }

  @Patch(':id/toggle-active')
  toggleActive(@Req() req: any, @Param('id') id: string) {
    this.ensureDeveloper(req);
    return this.rolesService.toggleActive(id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    this.ensureDeveloper(req);
    return this.rolesService.remove(id);
  }
}
