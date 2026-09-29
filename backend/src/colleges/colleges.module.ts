import { Module } from '@nestjs/common';
import { CollegesService } from './colleges.service';
import { CollegesController } from './colleges.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CollegesController],
  providers: [CollegesService, PrismaService],
})
export class CollegesModule {}
