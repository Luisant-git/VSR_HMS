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

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sock: WASocket | null = null;
  private isConnecting = false;
  private isReady = false;

  async onModuleInit() {
    this.connectToWhatsApp().catch(err => {
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

          this.logger.warn(`WhatsApp connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
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

    const title = (data.hostelName || 'HOSTEL ADMINISTRATION').toUpperCase();
    const student = data.studentName || 'Student';
    const invoice = data.invoiceNo || '—';
    const mode = (data.paymentMode || 'PAID').toUpperCase();
    const amountStr = Number(data.amount || 0).toLocaleString('en-IN');
    const dateStr = data.receiptDate || new Date().toLocaleDateString('en-GB');

    let breakdownStr = '';
    if (data.items && data.items.length > 0) {
      const lines = data.items.map(item => `• ${item.type || 'Fee'}: ₹${Number(item.amount || 0).toLocaleString('en-IN')}`);
      breakdownStr = `\n📋 *Fee Breakdown:*\n${lines.join('\n')}`;
    }

    const message = [
      `🧾 *FEE PAYMENT RECEIPT*`,
      `🏢 *${title}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Student:* ${student}`,
      data.regNo ? `🆔 *Reg No:* ${data.regNo}` : '',
      data.roomNo ? `🚪 *Room:* ${data.roomNo}` : '',
      `📄 *Receipt / Inv No:* ${invoice}`,
      `📅 *Date:* ${dateStr}`,
      `💳 *Payment Mode:* ${mode}`,
      data.refNo && data.refNo !== '—' ? `🔢 *Txn / Ref:* ${data.refNo}` : '',
      breakdownStr,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *Total Amount Paid:* *₹${amountStr}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ *Status:* SUCCESS / PAID`,
      `\n🙏 _Thank you for your payment!_`,
      data.hostelPhone ? `📞 For queries, contact: ${data.hostelPhone}` : '',
    ].filter(Boolean).join('\n');

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

