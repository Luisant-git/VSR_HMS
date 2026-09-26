import { IsString, IsNotEmpty, IsInt, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 'A101', description: 'Unique Room ID (e.g., A1, 101)' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 'Block A', description: 'The building block' })
  @IsString()
  @IsNotEmpty()
  block!: string;

  @ApiPropertyOptional({ example: 1, description: 'Floor number' })
  @IsInt()
  @IsOptional()
  floor?: number;

  @ApiProperty({ example: 2, description: 'Total beds capacity' })
  @IsInt()
  @IsNotEmpty()
  capacity!: number;

  @ApiProperty({ example: 'Double', description: 'Room Type (Single, Double, etc)' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({ example: 5000, description: 'Room Rent' })
  @IsNumber()
  @IsOptional()
  rent?: number;

  @ApiPropertyOptional({ example: 3000, description: 'Mess Fee' })
  @IsNumber()
  @IsOptional()
  messFee?: number;

  @ApiPropertyOptional({ example: 'AC, Attached Bath', description: 'Amenities' })
  @IsString()
  @IsOptional()
  amenities?: string;
}
