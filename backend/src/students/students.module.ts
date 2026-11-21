import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { PrismaService } from '../prisma.service';
import { FineCronService } from './fine-cron.service';
import { MonthlyFeeCronService } from './monthly-fee-cron.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  controllers: [StudentsController],
  providers: [StudentsService, PrismaService, FineCronService, MonthlyFeeCronService],
})
export class StudentsModule {}
