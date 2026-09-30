import { Controller, Get, Post, Patch, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll() {
    return this.usersService.getAll();
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
}
