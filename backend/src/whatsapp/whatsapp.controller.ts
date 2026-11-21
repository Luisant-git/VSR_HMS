import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { WhatsappService, FeeReceiptNotification } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  getStatus() {
    return {
      connected: this.whatsappService.isConnected(),
    };
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

    const cleanBase64 = body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const fileName = body.fileName || 'Fee_Receipt.pdf';
    const caption = body.caption || 'Official Fee Receipt';

    const sent = await this.whatsappService.sendPdfDocument(body.phone, buffer, fileName, caption);
    return { success: sent };
  }
}
