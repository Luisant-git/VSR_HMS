import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { WhatsappService, FeeReceiptNotification } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  getStatus() {
    return this.whatsappService.getStatus();
  }

  @Post('reconnect')
  async reconnect() {
    return await this.whatsappService.reconnect();
  }

  @Post('logout')
  async logout() {
    return await this.whatsappService.logout();
  }

  @Post('send-receipt')
  async sendReceipt(
    @Body()
    body: {
      phone: string;
      data: FeeReceiptNotification;
    },
  ) {
    if (!body.phone) {
      throw new BadRequestException('Phone number is required.');
    }
    if (!body.data) {
      throw new BadRequestException('Receipt data is required.');
    }
    const sent = await this.whatsappService.sendFeeReceipt(body.phone, body.data);
    return { success: sent };
  }

  @Post('send-pdf')
  async sendPdf(
    @Body()
    body: {
      phone: string;
      pdfBase64?: string;
      fileName?: string;
      caption?: string;
    },
  ) {
    if (!body.phone) {
      throw new BadRequestException('Phone number is required.');
    }

    if (!body.pdfBase64) {
      throw new BadRequestException('PDF data is required.');
    }

    const commaIndex = body.pdfBase64.indexOf(',');
    const cleanBase64 = commaIndex !== -1 ? body.pdfBase64.slice(commaIndex + 1) : body.pdfBase64;
    const buffer = Buffer.from(cleanBase64.trim(), 'base64');
    const fileName = body.fileName || 'Fee_Receipt.pdf';
    const caption = body.caption || 'Official Fee Receipt';

    const sent = await this.whatsappService.sendPdfDocument(body.phone, buffer, fileName, caption);
    return { success: sent };
  }

  @Post('send-student-id-card')
  async sendStudentIdCard(
    @Body()
    body: {
      phone: string;
      student: any;
    },
  ) {
    if (!body.phone) {
      throw new BadRequestException('Phone number is required.');
    }
    if (!body.student) {
      throw new BadRequestException('Student data is required.');
    }
    const sent = await this.whatsappService.sendStudentIdCard(body.phone, body.student);
    return { success: sent };
  }
}
