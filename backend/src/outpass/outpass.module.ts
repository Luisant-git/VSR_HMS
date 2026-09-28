import { Module } from '@nestjs/common';
import { OutpassService } from './outpass.service';
import { OutpassController } from './outpass.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OutpassController],
  providers: [OutpassService, PrismaService],
})
export class OutpassModule {}
