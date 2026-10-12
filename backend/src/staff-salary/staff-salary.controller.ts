import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req
} from '@nestjs/common';
import { StaffSalaryService } from './staff-salary.service';
import { CreateSalaryDto } from './dto/create-salary.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';

@Controller('staff-salary')
export class StaffSalaryController {
  constructor(private readonly salaryService: StaffSalaryService) {}

  @Get('attendance-stats')
  getAttendanceStats(
    @Query('staffId') staffId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.salaryService.getAttendanceStats(
      staffId,
      month,
      parseInt(year, 10) || new Date().getFullYear()
    );
  }

  @Post()
  create(@Body() createSalaryDto: CreateSalaryDto, @Req() req: any) {
    return this.salaryService.create(createSalaryDto, req?.user);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('staffId') staffId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.salaryService.findAll({
      search,
      month,
      year,
      staffId,
      page,
      limit
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salaryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSalaryDto: UpdateSalaryDto,
    @Req() req: any
  ) {
    return this.salaryService.update(id, updateSalaryDto, req?.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.salaryService.remove(id);
  }
}
