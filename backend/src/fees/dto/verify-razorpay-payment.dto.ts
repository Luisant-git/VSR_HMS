import { IsString, MaxLength } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @IsString()
  @MaxLength(100)
  razorpay_order_id: string;

  @IsString()
  @MaxLength(100)
  razorpay_payment_id: string;

  @IsString()
  @MaxLength(256)
  razorpay_signature: string;
}
