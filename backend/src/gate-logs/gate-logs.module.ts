import { Module } from '@nestjs/common';
import { GateLogsService } from './gate-logs.service';
import { GateLogsController } from './gate-logs.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [GateLogsService, PrismaService],
  controllers: [GateLogsController]
})
export class GateLogsModule {}
