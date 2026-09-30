import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'admin@hostel.com', description: 'The email of the User' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'The password of the User' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'John Doe', description: 'The name of the User' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'ADMIN', description: 'The role of the User' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the user is active' })
  @IsOptional()
  isActive?: boolean;
}
