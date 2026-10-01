import { Controller, Post, Body, Req, UnauthorizedException, BadRequestException, UseGuards } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';

@Controller('developer')
@UseGuards(JwtAuthGuard)
export class DeveloperController {
  constructor(
    private readonly developerService: DeveloperService,
    private readonly prisma: PrismaService
  ) {}

  @Post('truncate')
  async truncateData(@Req() req: any, @Body() body: { entity: string; passwordConfirm: string }) {
    if (req.user.role !== 'DEVELOPER') {
      throw new UnauthorizedException('Only DEVELOPER can perform this action');
    }

    // Verify password
    const user = await this.prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) throw new UnauthorizedException('User not found');
    
    const isPasswordValid = await bcrypt.compare(body.passwordConfirm, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password. Truncation aborted.');
    }

    return this.developerService.truncateData(body.entity);
  }
}
