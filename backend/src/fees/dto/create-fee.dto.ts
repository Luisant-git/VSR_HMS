import { IsString, IsNumber, IsOptional, IsEnum, IsUUID } from 'class-validator';

export class CreateFeeDto {
  @IsUUID()
  studentId: string;

  @IsString()
  transactionType: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;
}
