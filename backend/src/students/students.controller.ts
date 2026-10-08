import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { StudentsService } from './students.service';
import { FineCronService } from './fine-cron.service';

import { MonthlyFeeCronService } from './monthly-fee-cron.service';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly fineCronService: FineCronService,
    private readonly monthlyFeeCronService: MonthlyFeeCronService
  ) {}

  @Post()
  create(@Body() createStudentDto: any) {
    return this.studentsService.create(createStudentDto);
  }

  @Get('next-regsi')
  getNextRegsiName() {
    return this.studentsService.getNextRegsiName();
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('roomFilter') roomFilter?: string,
    @Query('collegeFilter') collegeFilter?: string,
    @Query('sortFilter') sortFilter?: string,
    @Query('feeFilter') feeFilter?: string,
  ) {
    return this.studentsService.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      roomFilter,
      collegeFilter,
      sortFilter,
      feeFilter
    });
  }

  @Get('mobile/:mobileNo')
  findByMobile(@Param('mobileNo') mobileNo: string) {
    return this.studentsService.findByMobile(mobileNo);
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

  @Post('actions/trigger-monthly-fees')
  async triggerMonthlyFees() {
    await this.monthlyFeeCronService.handleMonthlyFees();
    return { message: 'Monthly fees generated successfully' };
  }
}
