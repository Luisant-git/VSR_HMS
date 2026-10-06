import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CollegesService } from './colleges.service';
import { CreateCollegeDto } from './dto/create-college.dto';
import { UpdateCollegeDto } from './dto/update-college.dto';

@ApiTags('Colleges')
@Controller('colleges')
export class CollegesController {
  constructor(private readonly collegesService: CollegesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new college' })
  @ApiResponse({ status: 201, description: 'College successfully created.' })
  create(@Body() createCollegeDto: CreateCollegeDto) {
    return this.collegesService.create(createCollegeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all colleges' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.collegesService.findAll(
      page ? parseInt(page) : 1, 
      limit ? parseInt(limit) : 10, 
      search, 
      fromDate,
      toDate
    );
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update fines for all colleges' })
  updateBulk(@Body() payload: { rentFine?: number, messFine?: number, ebFine?: number, dueDate?: string | null }) {
    return this.collegesService.updateBulk(payload);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a college by ID' })
  findOne(@Param('id') id: string) {
    return this.collegesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a college' })
  update(@Param('id') id: string, @Body() updateCollegeDto: UpdateCollegeDto) {
    return this.collegesService.update(id, updateCollegeDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a college' })
  remove(@Param('id') id: string) {
    return this.collegesService.remove(id);
  }
}
