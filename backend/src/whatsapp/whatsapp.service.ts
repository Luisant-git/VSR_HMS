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

    const topText = '_Mayanur Sri Sellandiamman Thunai_';
    const title = (hostelTitle || "SEA SINDU QUEEN'S PARADISE").toUpperCase();
    const addr = address || '291/2G2, Katheri Village, Komarapalayam, Salem DT - 638 183';
    const ph = contactPhone || '80126 55555';

    const student = data.studentName || 'Student';
    const invoice = data.invoiceNo || '—';
    const receiptNum = data.receiptNo || '1';
    const dateStr = data.receiptDate || new Date().toLocaleDateString('en-GB');

    const mode = formatPaymentModeName(data.paymentMode);
    const gatewayMethod = data.gatewayMethod || (data.paymentMode?.toUpperCase() === 'RAZORPAY' ? 'Online' : 'Manual');
    const statusStr = (data.paymentStatus || 'PAID').toUpperCase();

    const totalPaid = Number(data.amount || 0);
    const totalPaidStr = totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const discount = Number(data.discountAmount || 0);
    const discountStr = discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const gross = Number(data.grossAmount || (totalPaid + discount));
    const grossStr = gross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const pending = Number(data.pendingBalance || 0);
    const pendingStr = pending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Format fee items
    let itemsBlock = '';
    if (data.items && data.items.length > 0) {
      const lines = data.items.map((item) => {
        const desc = item.description || formatFeeTypeName(item.type);
        const cat = item.type || 'FEE';
        const amt = Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `• *${desc}*\n  Category : ${cat}\n  Amount   : ₹${amt}`;
      });
      itemsBlock = lines.join('\n\n');
    } else {
      itemsBlock = `• Hostel Fee\n  Amount   : ₹${totalPaidStr}`;
    }

    const message = [
      topText,
      ``,
      `🏛️ *${title}*`,
      `*( LADIES HOSTEL )*`,
      `📍 ${addr}`,
      `📞 ${ph}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🧾 *FEES RECEIPT*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*Receipt No :* ${receiptNum}`,
      `*Invoice No :* ${invoice}`,
      `*Date       :* ${dateStr}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *RECEIVED FROM*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*Student Name    :* ${student}`,
      `*Registration No :* ${data.regNo || 'N/A'}`,
      `*Room No         :* ${data.roomNo || 'N/A'}`,
      data.billingMonth ? `*Billing Month   :* ${data.billingMonth}` : '',
      data.dueDate ? `*Due Date        :* ${data.dueDate}` : '',
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💳 *PAYMENT DETAILS*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*Payment Mode    :* ${mode}`,
      `*Gateway Method  :* ${gatewayMethod}`,
      data.refNo && data.refNo !== '—' ? `*Transaction Ref :* ${data.refNo}` : '',
      `*Payment Status  :* ${statusStr} ✅`,
      `*Pending Balance :* ₹${pendingStr}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *FEE BREAKDOWN*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      itemsBlock,
      `────────────────────────────`,
      discount > 0 ? `Total Before Discount : ₹${grossStr}\nDiscount              : -₹${discountStr}\n────────────────────────────` : '',
      `💰 *TOTAL AMOUNT PAID : ₹${totalPaidStr}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      data.notes ? `\n📝 *NOTES:* ${data.notes}` : '',
      ``,
      `✅ *Payment Successful*`,
      `_This is a computer generated receipt. No signature is required._`,
    ]
      .filter((line) => line !== '')
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
