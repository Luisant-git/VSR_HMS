import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateStaffDto {
  @IsOptional()
  @IsString()
  staffCode?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  joiningDate?: string | Date;

  @IsNotEmpty()
  @IsString()
  role: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  salaryBasis?: string;

  @IsOptional()
  @IsNumber()
  baseSalary?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
