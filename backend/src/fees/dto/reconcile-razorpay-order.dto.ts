import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReconcileRazorpayOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  orderId: string;
}
