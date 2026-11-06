import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RazorpayFeeItemDto {
  @IsUUID()
  feeId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  months: number;
}

export class CreateRazorpayOrderDto {
  @IsUUID()
  studentId: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RazorpayFeeItemDto)
  feeItems: RazorpayFeeItemDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  outstandingAmount?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  requestId: string;
}
