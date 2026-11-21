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

export interface FeeReceiptNotification {
  studentName?: string;
  regNo?: string;
  roomNo?: string;
  invoiceNo?: string;
  receiptDate?: string;
  amount: number;
  paymentMode?: string;
  refNo?: string;
  items?: Array<{ type?: string; amount?: number }>;
  hostelName?: string;
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

export function formatDatePretty(rawDate?: string): string {
  if (!rawDate) {
    return new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return rawDate;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sock: WASocket | null = null;
  private isConnecting = false;
  private isReady = false;

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
          this.logger.log('====================================================');
          this.logger.log('SCAN THIS QR CODE ONCE USING WHATSAPP (LINKED DEVICES)');
          this.logger.log('====================================================');
          qrcode.generate(qr, { small: true });
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
          this.logger.log('WhatsApp Service connected! Zero-click automated receipt sending is active.');
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

  async sendFeeReceipt(phone: string, data: FeeReceiptNotification): Promise<boolean> {
    const jid = this.formatJid(phone);
    if (!jid) {
      this.logger.warn(`Cannot send WhatsApp receipt: phone number "${phone}" is invalid.`);
      return false;
    }

    if (!this.sock || !this.isReady) {
      this.logger.warn(`WhatsApp service is not linked yet. Scan the terminal QR code to activate automatic sending.`);
      return false;
    }

    let hostelTitle = data.hostelName;
    let contactPhone = data.hostelPhone;

    if (!hostelTitle) {
      try {
        const settings = await this.prisma.hostelSettings.findFirst();
        if (settings?.hostelName) hostelTitle = settings.hostelName;
        if (settings?.phone && !contactPhone) contactPhone = settings.phone;
      } catch {}
    }

    const title = (hostelTitle || 'HOSTEL MANAGEMENT').toUpperCase();
    const student = data.studentName || 'Student';
    const invoice = data.invoiceNo || '—';
    const mode = formatPaymentModeName(data.paymentMode);
    const amountStr = Number(data.amount || 0).toLocaleString('en-IN');
    const dateStr = formatDatePretty(data.receiptDate);

    let breakdownStr = '';
    if (data.items && data.items.length > 0) {
      const lines = data.items.map(
        (item) => `  • ${formatFeeTypeName(item.type)} : ₹${Number(item.amount || 0).toLocaleString('en-IN')}`,
      );
      breakdownStr = `📋 *FEE PARTICULARS:*\n${lines.join('\n')}`;
    }

    const message = [
      `🧾 *OFFICIAL FEE PAYMENT RECEIPT*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏢 *${title}*`,
      `_Payment Confirmation & Acknowledgment_`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `👤 *Student Name :* ${student}`,
      data.regNo ? `🆔 *Register No   :* ${data.regNo}` : '',
      data.roomNo ? `🚪 *Room Number  :* ${data.roomNo}` : '',
      `📄 *Receipt / Inv :* ${invoice}`,
      `📅 *Payment Date  :* ${dateStr}`,
      `💳 *Payment Mode  :* ${mode}`,
      data.refNo && data.refNo !== '—' ? `🔢 *Transaction ID:* ${data.refNo}` : '',
      ``,
      breakdownStr ? `━━━━━━━━━━━━━━━━━━━━━━━━━━\n${breakdownStr}` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💰 *TOTAL AMOUNT PAID :* *₹${amountStr}*`,
      `✅ *PAYMENT STATUS   :* *PAID / VERIFIED*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `ℹ️ _This is a computer-generated digital receipt._`,
      `🙏 _Thank you for your timely payment!_`,
      contactPhone ? `📞 _For queries, contact: ${contactPhone}_` : '',
    ]
      .filter((line) => line !== undefined && line !== null)
      .join('\n');

    try {
      await this.sock.sendMessage(jid, { text: message });
      this.logger.log(`Automated WhatsApp fee receipt successfully sent to ${phone} (${student})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to ${phone}:`, error);
      return false;
    }
  }
}
