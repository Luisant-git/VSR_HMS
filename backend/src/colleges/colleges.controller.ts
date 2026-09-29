import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
  findAll() {
    return this.collegesService.findAll();
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
