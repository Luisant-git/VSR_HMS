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

/**
 * Normalizes phone numbers to standard international format (defaults to India 91 if 10 digits).
 */
export function normalizePhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.replace(/^0+/, '');
  }
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }
  return cleaned;
}

/**
 * Builds a clean, professional WhatsApp text message for the fee invoice receipt.
 */
export function buildWhatsAppReceiptMessage(data: WhatsAppReceiptData): string {
  const hostelTitle = (data.hostelName || 'HOSTEL MANAGEMENT').toUpperCase();
  const student = data.studentName || 'Student';
  const invoice = data.invoiceNo || data.receiptNo || '—';
  const mode = formatPaymentModeName(data.paymentMode);
  const amountStr = Number(data.totalAmount || 0).toLocaleString('en-IN');
  const dateStr = formatDatePretty(data.receiptDate);

  let breakdownStr = '';
  if (data.items && data.items.length > 0) {
    const lines = data.items.map((item) => {
      const type = formatFeeTypeName(item.type);
      const amt = Number(item.amount || 0).toLocaleString('en-IN');
      return `  • ${type} : ₹${amt}`;
    });
    breakdownStr = `📋 *FEE PARTICULARS:*\n${lines.join('\n')}`;
  }

  const lines = [
    `🧾 *OFFICIAL FEE PAYMENT RECEIPT*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏢 *${hostelTitle}*`,
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
    data.discountAmount && data.discountAmount > 0
      ? `🏷️ *Discount Applied :* ₹${Number(data.discountAmount).toLocaleString('en-IN')}\n`
      : '',
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💰 *TOTAL AMOUNT PAID :* *₹${amountStr}*`,
    data.pendingBalance && data.pendingBalance > 0
      ? `⚠️ *Pending Balance  :* ₹${Number(data.pendingBalance).toLocaleString('en-IN')}`
      : '',
    `✅ *PAYMENT STATUS   :* *PAID / VERIFIED*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `ℹ️ _This is a computer-generated digital receipt._`,
    `🙏 _Thank you for your timely payment!_`,
    data.hostelPhone ? `📞 _For queries, contact: ${data.hostelPhone}_` : '',
  ];

  return lines.filter((line) => line !== undefined && line !== null).join('\n');
}

/**
 * Opens WhatsApp Web or WhatsApp mobile app directly to the student/parent's chat.
 */
export function sendReceiptViaWhatsApp(data: WhatsAppReceiptData): boolean {
  let targetPhone = normalizePhoneNumber(data.phone);

  if (!targetPhone || targetPhone.length < 10) {
    const entered = window.prompt(
      `Enter WhatsApp mobile number for ${data.studentName || 'student'}:`,
      data.phone || '',
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
