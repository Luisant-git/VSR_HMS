import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = ''
  ) {
    return this.usersService.getAll({ 
      page: parseInt(page), 
      limit: parseInt(limit), 
      search 
    });
  }

  @Post()
  async create(@Body() createUserDto: any) {
    try {
      return await this.usersService.create(createUserDto);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: any) {
    try {
      return await this.usersService.update(id, updateUserDto);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Patch(':id/toggle-active')
  async toggleActive(@Param('id') id: string) {
    try {
      return await this.usersService.toggleActive(id);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      return await this.usersService.delete(id);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
