import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { StudentsService } from './students.service';
import { FineCronService } from './fine-cron.service';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly fineCronService: FineCronService
  ) {}

  @Post()
  create(@Body() createStudentDto: any) {
    return this.studentsService.create(createStudentDto);
  }

  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStudentDto: any) {
    return this.studentsService.update(id, updateStudentDto);
  }

  @Post('actions/trigger-fines')
  async triggerFines() {
    await this.fineCronService.handleDailyFines();
    return { message: 'Fines calculation triggered successfully' };
  }
}
