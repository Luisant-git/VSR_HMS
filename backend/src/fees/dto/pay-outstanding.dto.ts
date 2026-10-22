import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PayOutstandingDto {
  @IsString()
  studentId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  paymentMode: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Optional client generated id used to make retries / double submits idempotent.
   */
  @IsOptional()
  @IsString()
  requestId?: string;
}
