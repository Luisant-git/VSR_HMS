import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OutpassService } from './outpass.service';
import { CreateOutpassDto } from './dto/create-outpass.dto';
import { UpdateOutpassDto } from './dto/update-outpass.dto';

@Controller('outpass')
export class OutpassController {
  constructor(private readonly outpassService: OutpassService) {}

  @Post()
  create(@Body() createOutpassDto: CreateOutpassDto) {
    return this.outpassService.create(createOutpassDto);
  }

  @Get()
  findAll() {
    return this.outpassService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.outpassService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOutpassDto: UpdateOutpassDto) {
    return this.outpassService.update(id, updateOutpassDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() data: { status: string, gateAction: string }) {
    return this.outpassService.updateStatus(id, data.status, data.gateAction);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.outpassService.remove(id);
  }
}
