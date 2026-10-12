import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSalaryDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsNotEmpty()
  month: string; // e.g. "October"

  @IsNumber()
  @IsNotEmpty()
  year: number; // e.g. 2026

  @IsNumber()
  @Min(0)
  baseSalary: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string; // Direct Bank Transfer, Cash, UPI

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
