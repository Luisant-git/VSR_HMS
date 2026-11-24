import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { PrismaService } from '../prisma.service';
import { generateReceiptPdfBuffer, generateIdCardPdfBuffer, StudentIdCardData } from './pdf-generator';

export interface FeeReceiptNotification {
  studentName?: string;
  regNo?: string;
  roomNo?: string;
  billingMonth?: string;
  dueDate?: string;
  invoiceNo?: string;
  receiptNo?: string;
  receiptDate?: string;
  amount: number;
  grossAmount?: number;
  discountAmount?: number;
  paymentMode?: string;
  gatewayMethod?: string;
  refNo?: string;
  paymentStatus?: string;
  pendingBalance?: number;
  notes?: string;
  items?: Array<{
    description?: string;
    type?: string;
    amount?: number;
  }>;
  hostelName?: string;
  address?: string;
  hostelPhone?: string;
}

export function formatFeeTypeName(type?: string): string {
  if (!type) return 'Hostel Fee';
  const clean = String(type).trim().toUpperCase();
  if (clean === 'EB_BILL' || clean === 'EB') return 'Electricity Bill (EB)';
  if (clean === 'RENT') return 'Hostel Room Rent';
  if (clean === 'MESS') return 'Mess Food Charges';
  if (clean === 'FINE' || clean.includes('FINE')) return 'Late Payment Fine';
  if (clean === 'OUTSTANDING_PAYMENT' || clean.includes('OUTSTANDING')) return 'Previous Dues Payment';
  if (clean === 'ADVANCE') return 'Caution Deposit / Advance';
  return clean.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPaymentModeName(mode?: string): string {
  if (!mode) return 'Cash';
  const clean = String(mode).trim().toUpperCase();
  if (clean === 'CASH') return 'Cash';
  if (clean === 'UPI') return 'UPI / QR Code';
  if (clean === 'RAZORPAY') return 'Online (Razorpay)';
  if (clean.includes('BANK')) return 'Bank Transfer (NEFT/IMPS)';
  if (clean === 'CHEQUE') return 'Cheque / DD';
  return clean.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sock: WASocket | null = null;
  private isConnecting = false;
  private isReady = false;
  private currentQr: string | null = null;
  private qrGeneratedAt: Date | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.connectToWhatsApp().catch((err) => {
      this.logger.error('Failed to initialize WhatsApp service:', err);
    });
  }

  onModuleDestroy() {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
    }
  }

  isConnected(): boolean {
    return this.isReady && this.sock !== null;
  }

  getStatus() {
    const isConn = this.isConnected();
    if (!isConn && !this.isConnecting && !this.currentQr) {
      this.connectToWhatsApp().catch(() => {});
    }

    const rawJid = this.sock?.user?.id || null;
    let phone: string | null = null;
    if (rawJid) {
      const clean = rawJid.split(':')[0].replace(/\D/g, '');
      phone = clean.length > 10 && clean.startsWith('91') ? `+91 ${clean.slice(2)}` : `+${clean}`;
    }
    const name = this.sock?.user?.name || (this.sock?.user as any)?.pushName || null;

    return {
      connected: isConn,
      isConnecting: this.isConnecting,
      qr: isConn ? null : this.currentQr,
      qrGeneratedAt: this.qrGeneratedAt ? this.qrGeneratedAt.toISOString() : null,
      phone,
      name,
      updatedAt: new Date().toISOString(),
    };
  }

  async reconnect() {
    this.logger.log('Manual WhatsApp reconnect requested...');
    this.currentQr = null;
    this.isReady = false;
    this.isConnecting = false;
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
    }
    await this.connectToWhatsApp();
    return this.getStatus();
  }

  async logout() {
    this.logger.log('Manual WhatsApp logout requested...');
    this.currentQr = null;
    this.isReady = false;
    this.isConnecting = false;
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {}
      try {
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
    }
    const authDir = path.join(process.cwd(), 'whatsapp_auth');
    if (fs.existsSync(authDir)) {
      try {
        fs.rmSync(authDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.error('Failed to clear WhatsApp auth dir:', err);
      }
    }
    setTimeout(() => this.connectToWhatsApp(), 1500);
    return { success: true, message: 'Disconnected. Initializing fresh QR code...' };
  }

  private async connectToWhatsApp() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      const authDir = path.join(process.cwd(), 'whatsapp_auth');
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as any,
      }));

      this.sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentQr = qr;
          this.qrGeneratedAt = new Date();
          this.logger.log('====================================================');
          this.logger.log('SCAN THIS QR CODE ONCE USING WHATSAPP (LINKED DEVICES)');
          this.logger.log('====================================================');
          try {
            qrcode.generate(qr, { small: true });
          } catch {}
        }

        if (connection === 'close') {
          this.isReady = false;
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(
            `WhatsApp connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`,
          );
          if (shouldReconnect) {
            setTimeout(() => this.connectToWhatsApp(), 5000);
          }
        } else if (connection === 'open') {
          this.isReady = true;
          this.isConnecting = false;
          this.currentQr = null;
          this.logger.log('WhatsApp Service connected! Automated PDF receipt dispatch is active.');
        }
      });
    } catch (error) {
      this.isConnecting = false;
      this.isReady = false;
      this.logger.error('Error during WhatsApp connection initialization:', error);
    }
  }

  private formatJid(rawPhone: string): string | null {
    if (!rawPhone) return null;
    let clean = String(rawPhone).replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.replace(/^0+/, '');
    if (clean.length === 10) clean = `91${clean}`;
    if (clean.length < 10) return null;
    return `${clean}@s.whatsapp.net`;
  }

  /**
   * Sends an actual PDF document file directly to the student / parent on WhatsApp.
   */
  async sendPdfDocument(
    phone: string,
    pdfBuffer: Buffer,
    fileName: string,
    caption?: string,
  ): Promise<boolean> {
    const jid = this.formatJid(phone);
    if (!jid) {
      this.logger.warn(`Cannot send WhatsApp PDF: phone number "${phone}" is invalid.`);
      return false;
    }

    if (!this.sock || !this.isReady) {
      this.logger.warn(
        `WhatsApp service is not linked yet. Scan the terminal QR code to activate WhatsApp sending.`,
      );
      return false;
    }

    try {
      const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      await this.sock.sendMessage(jid, {
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: cleanFileName,
        caption: caption || `Official Fee Receipt: ${cleanFileName}`,
      });
      this.logger.log(`PDF receipt (${cleanFileName}) successfully sent to WhatsApp: ${phone}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp PDF to ${phone}:`, error);
      return false;
    }
  }

  /**
   * Generates the official fee receipt PDF and automatically sends it as a document attachment.
   */
  async sendFeeReceipt(phone: string, data: FeeReceiptNotification): Promise<boolean> {
    const jid = this.formatJid(phone);
    if (!jid) {
      this.logger.warn(`Cannot send WhatsApp receipt: phone number "${phone}" is invalid.`);
      return false;
    }

    if (!this.sock || !this.isReady) {
      this.logger.warn(
        `WhatsApp service is not linked yet. Scan the terminal QR code to activate automatic sending.`,
      );
      return false;
    }

    let hostelTitle = data.hostelName;
    let address = data.address;
    let contactPhone = data.hostelPhone;

    if (!hostelTitle || !address || !contactPhone) {
      try {
        const settings = await this.prisma.hostelSettings.findFirst();
        if (settings?.hostelName && !hostelTitle) hostelTitle = settings.hostelName;
        if (settings?.address && !address) address = settings.address;
        if (settings?.phone && !contactPhone) contactPhone = settings.phone;
      } catch {}
    }

    const payload: FeeReceiptNotification = {
      ...data,
      hostelName: hostelTitle || "SEA SINDU QUEEN'S PARADISE",
      address: address || '291/2G2, Katheri Village, Komarapalayam, Salem DT - 638 183',
      hostelPhone: contactPhone || '80126 55555',
    };

    try {
      // 1. Generate exact PDF receipt buffer
      const pdfBuffer = await generateReceiptPdfBuffer(payload);
      const invoiceLabel = (payload.invoiceNo || payload.receiptNo || 'Receipt').replace(/[<>:"/\\|?*]+/g, '_');
      const fileName = `Receipt_${invoiceLabel}.pdf`;
      const caption = `Official Fee Receipt for ${payload.studentName || 'Student'} (${payload.invoiceNo || payload.receiptNo || ''})`;

      // 2. Send actual PDF document file directly to the student on WhatsApp
      return await this.sendPdfDocument(phone, pdfBuffer, fileName, caption);
    } catch (error) {
      this.logger.error(`Error generating/sending PDF receipt to ${phone}:`, error);
      return false;
    }
  }

  /**
   * Generates the official vector student ID card PDF and sends it as a document attachment.
   */
  async sendStudentIdCard(phone: string, student: StudentIdCardData): Promise<boolean> {
    const jid = this.formatJid(phone);
    if (!jid) {
      this.logger.warn(`Cannot send WhatsApp ID card: phone number "${phone}" is invalid.`);
      return false;
    }

    if (!this.sock || !this.isReady) {
      this.logger.warn(
        `WhatsApp service is not linked yet. Scan the terminal QR code to activate automated ID card dispatch.`,
      );
      return false;
    }

    let hostelTitle = student.hostelName;
    if (!hostelTitle) {
      try {
        const settings = await this.prisma.hostelSettings.findFirst();
        if (settings?.hostelName) hostelTitle = settings.hostelName;
      } catch {}
    }

    const payload: StudentIdCardData = {
      ...student,
      hostelName: hostelTitle || "SEA SINDU QUEEN'S PARADISE",
    };

    try {
      // 1. Generate official CR80 PDF ID card buffer
      const pdfBuffer = await generateIdCardPdfBuffer(payload);
      const regLabel = (payload.manualRegsiName || payload.regNo || payload.name || 'Student').replace(/[<>:"/\\|?*]+/g, '_');
      const fileName = `StudentID_${regLabel}.pdf`;
      const caption = `Official Student ID Card - ${payload.name || 'Student'}`;

      // 2. Send actual PDF document file directly to the student on WhatsApp
      return await this.sendPdfDocument(phone, pdfBuffer, fileName, caption);
    } catch (error) {
      this.logger.error(`Error generating/sending Student ID card to ${phone}:`, error);
      return false;
    }
  }
}
