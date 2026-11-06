import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, RawBody } from '@nestjs/common';
import { FeesService } from './fees.service';
import { RazorpayPaymentService } from './razorpay-payment.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { PayOutstandingDto } from './dto/pay-outstanding.dto';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';

@Controller('fees')
export class FeesController {
  constructor(
    private readonly feesService: FeesService,
    private readonly razorpayPaymentService: RazorpayPaymentService,
  ) {}

  @Post()
  create(@Body() createFeeDto: CreateFeeDto) {
    return this.feesService.create(createFeeDto);
  }

  @Post('pay-outstanding')
  payOutstanding(@Body() payOutstandingDto: PayOutstandingDto) {
    return this.feesService.payOutstanding(payOutstandingDto);
  }

  @Post('razorpay/order')
  createRazorpayOrder(@Body() dto: CreateRazorpayOrderDto) {
    return this.razorpayPaymentService.createOrder(dto);
  }

  @Post('razorpay/verify')
  verifyRazorpayPayment(@Body() dto: VerifyRazorpayPaymentDto) {
    return this.razorpayPaymentService.verifyCheckout(dto);
  }

  @Post('razorpay/webhook')
  razorpayWebhook(
    @RawBody() rawBody: Buffer | undefined,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    return this.razorpayPaymentService.handleWebhook(rawBody, signature, body);
  }

  @Get()
  findAll() {
    return this.feesService.findAll();
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.feesService.findByStudent(studentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.feesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFeeDto: UpdateFeeDto) {
    return this.feesService.update(id, updateFeeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.feesService.remove(id);
  }
}
