export interface WhatsAppReceiptData {
  studentName?: string;
  regNo?: string;
  roomNo?: string;
  phone?: string;
  invoiceNo?: string;
  receiptNo?: string;
  receiptDate?: string;
  totalAmount?: number;
  paymentMode?: string;
  refNo?: string;
  items?: Array<{ type?: string; amount?: number | string }>;
  discountAmount?: number;
  pendingBalance?: number;
  hostelName?: string;
  hostelPhone?: string;
}

/**
 * Normalizes phone numbers to standard international format (defaults to India 91 if 10 digits).
 */
export function normalizePhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.replace(/^0+/, '');
  }
  // Standard Indian 10-digit mobile number
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }
  return cleaned;
}

/**
 * Builds a formatted WhatsApp text message for the fee invoice receipt.
 */
export function buildWhatsAppReceiptMessage(data: WhatsAppReceiptData): string {
  const hostelTitle = (data.hostelName || 'HOSTEL ADMINISTRATION').toUpperCase();
  const student = data.studentName || 'Student';
  const invoice = data.invoiceNo || data.receiptNo || '—';
  const mode = (data.paymentMode || 'PAID').toUpperCase();
  const amountStr = Number(data.totalAmount || 0).toLocaleString('en-IN');
  const dateStr = data.receiptDate || new Date().toLocaleDateString('en-GB');

  let breakdownStr = '';
  if (data.items && data.items.length > 0) {
    const lines = data.items.map(item => {
      const type = item.type || 'Fee';
      const amt = Number(item.amount || 0).toLocaleString('en-IN');
      return `• ${type}: ₹${amt}`;
    });
    breakdownStr = `\n📋 *Fee Breakdown:*\n${lines.join('\n')}`;
  }

  const lines = [
    `🧾 *FEE PAYMENT RECEIPT*`,
    `🏢 *${hostelTitle}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Student:* ${student}`,
    data.regNo ? `🆔 *Reg No:* ${data.regNo}` : '',
    data.roomNo ? `🚪 *Room:* ${data.roomNo}` : '',
    `📄 *Receipt / Inv No:* ${invoice}`,
    `📅 *Date:* ${dateStr}`,
    `💳 *Payment Mode:* ${mode}`,
    data.refNo && data.refNo !== '—' ? `🔢 *Txn / Ref:* ${data.refNo}` : '',
    breakdownStr,
    data.discountAmount && data.discountAmount > 0 ? `\n🏷️ *Discount Applied:* ₹${Number(data.discountAmount).toLocaleString('en-IN')}` : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `💰 *Total Amount Paid:* *₹${amountStr}*`,
    data.pendingBalance && data.pendingBalance > 0 ? `⚠️ *Pending Balance:* ₹${Number(data.pendingBalance).toLocaleString('en-IN')}` : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `✅ *Status:* SUCCESS / PAID`,
    `\n🙏 _Thank you for your payment!_`,
    data.hostelPhone ? `📞 For questions, call: ${data.hostelPhone}` : ''
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * Opens WhatsApp Web or WhatsApp mobile app directly to the student/parent's chat.
 */
export function sendReceiptViaWhatsApp(data: WhatsAppReceiptData): boolean {
  let targetPhone = normalizePhoneNumber(data.phone);

  if (!targetPhone || targetPhone.length < 10) {
    const entered = window.prompt(
      `Enter WhatsApp mobile number for ${data.studentName || 'student'}:`,
      data.phone || ''
    );
    if (!entered) return false;
    targetPhone = normalizePhoneNumber(entered);
  }

  if (targetPhone.length < 10) {
    alert('Invalid phone number. Please provide a valid 10-digit mobile number.');
    return false;
  }

  const message = buildWhatsAppReceiptMessage(data);
  const whatsappUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  return true;
}
