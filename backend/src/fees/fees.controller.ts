import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, RawBody, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { FeesService } from './fees.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RazorpayPaymentService } from './razorpay-payment.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { PayOutstandingDto } from './dto/pay-outstanding.dto';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { ReconcileRazorpayOrderDto } from './dto/reconcile-razorpay-order.dto';
import { ReconcileRazorpayStudentDto } from './dto/reconcile-razorpay-student.dto';
import { ImportFeesDto } from './dto/import-fees.dto';

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

  @Post('import')
  importFees(@Body() dto: ImportFeesDto) {
    return this.feesService.importFeeEdits(dto);
  }

  @Post('pay-outstanding')
  payOutstanding(@Body() payOutstandingDto: PayOutstandingDto) {
    return this.feesService.payOutstanding(payOutstandingDto);
  }

  @Post('advance-rent')
  addAdvanceRent(
    @Body()
    body: {
      studentId: string;
      amount: number;
      paymentMode?: string;
      referenceNumber?: string;
      notes?: string;
      paidDate?: string;
      invoiceNumber?: string;
    },
  ) {
    return this.feesService.addAdvanceRent(body);
  }

  @Post('consume-advance-rent')
  consumeAdvanceRent(@Body() body: { studentId: string; amount: number }) {
    return this.feesService.consumeAdvanceRent(body);
  }

  @Post('razorpay/order')
  createRazorpayOrder(@Body() dto: CreateRazorpayOrderDto) {
    return this.razorpayPaymentService.createOrder(dto);
  }

  @Post('razorpay/verify')
  verifyRazorpayPayment(@Body() dto: VerifyRazorpayPaymentDto) {
    return this.razorpayPaymentService.verifyCheckout(dto);
  }

  @Post('razorpay/reconcile')
  reconcileRazorpayOrder(@Body() dto: ReconcileRazorpayOrderDto) {
    return this.razorpayPaymentService.reconcileOrder(dto.orderId);
  }

  @Post('razorpay/reconcile-student')
  reconcileRazorpayStudent(@Body() dto: ReconcileRazorpayStudentDto) {
    return this.razorpayPaymentService.reconcileStudentOrders(dto.studentId);
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

  @Get('trash')
  @UseGuards(JwtAuthGuard)
  findTrash(@Req() req: any) {
    this.assertDeveloper(req);
    return this.feesService.findTrash();
  }

  @Post('trash')
  @UseGuards(JwtAuthGuard)
  moveToTrash(@Req() req: any, @Body() body: { ids: string[] }) {
    this.assertDeveloper(req);
    return this.feesService.moveToTrash(Array.isArray(body?.ids) ? body.ids : [], req.user.userId);
  }

  @Post('trash/restore')
  @UseGuards(JwtAuthGuard)
  restoreTrashRows(@Req() req: any, @Body() body: { ids: string[] }) {
    this.assertDeveloper(req);
    return this.feesService.restoreFromTrash(Array.isArray(body?.ids) ? body.ids : []);
  }

  @Patch(':id/restore')
  @UseGuards(JwtAuthGuard)
  restoreFromTrash(@Req() req: any, @Param('id') id: string) {
    this.assertDeveloper(req);
    return this.feesService.restoreFromTrash([id]);
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.feesService.findByStudent(studentId);
  }

  @Get('fine-preview/:studentId')
  finePreview(
    @Param('studentId') studentId: string,
    @Query('asOfDate') asOfDate: string,
  ) {
    return this.feesService.previewFine(studentId, asOfDate);
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
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('id') id: string) {
    this.assertDeveloper(req);
    return this.feesService.remove(id, req.user.userId);
  }

  private assertDeveloper(req: any) {
    if (req.user?.role !== 'DEVELOPER') {
      throw new UnauthorizedException('Only DEVELOPER can manage the fee trash.');
    }
  }
}
