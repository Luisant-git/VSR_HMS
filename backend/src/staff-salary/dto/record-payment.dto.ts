import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01, { message: 'Payment amount must be greater than zero' })
  paymentAmount: number;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsNotEmpty()
  @IsString()
  paymentMode: string; // "Cash", "UPI", "Bank Transfer"

  @IsOptional()
  @IsString()
  transactionRef?: string;

  @IsOptional()
  @IsString()
  paymentRemarks?: string;

  @IsOptional()
  @IsString()
  updatedBy?: string;
}
