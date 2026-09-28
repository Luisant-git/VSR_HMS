import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ClearanceService } from './clearance.service';
import { CreateClearanceDto } from './dto/create-clearance.dto';
import { UpdateClearanceDto } from './dto/update-clearance.dto';

@Controller('clearance')
export class ClearanceController {
  constructor(private readonly clearanceService: ClearanceService) {}

  @Post()
  create(@Body() createClearanceDto: CreateClearanceDto) {
    return this.clearanceService.create(createClearanceDto);
  }

  @Get()
  findAll() {
    return this.clearanceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clearanceService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClearanceDto: UpdateClearanceDto) {
    return this.clearanceService.update(id, updateClearanceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clearanceService.remove(id);
  }
}
