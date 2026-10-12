import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('next-code')
  getNextStaffCode() {
    return this.staffService.getNextStaffCode();
  }

  @Post()
  create(@Body() createStaffDto: CreateStaffDto) {
    return this.staffService.create(createStaffDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('salaryBasis') salaryBasis?: string,
    @Query('status') status?: string,
  ) {
    return this.staffService.findAll({ search, role, salaryBasis, status });
  }

  @Get('attendance/roster')
  getAttendanceRoster(@Query('date') date?: string) {
    return this.staffService.getAttendanceRoster(date);
  }

  @Post('attendance')
  saveAttendance(@Body() body: any) {
    return this.staffService.saveAttendance(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) {
    return this.staffService.update(id, updateStaffDto);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) {
    return this.staffService.toggleStatus(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
