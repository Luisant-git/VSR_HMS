export interface WhatsAppReceiptData {
  studentName?: string;
  regNo?: string;
  roomNo?: string;
  billingMonth?: string;
  dueDate?: string;
  phone?: string;
  invoiceNo?: string;
  receiptNo?: string;
  receiptDate?: string;
  totalAmount?: number;
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
    amount?: number | string;
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
 * Builds the exact match WhatsApp text message identical to the official Fees Receipt PDF.
 */
export function buildWhatsAppReceiptMessage(data: WhatsAppReceiptData): string {
  const topText = '_Mayanur Sri Sellandiamman Thunai_';
  const hostelTitle = (data.hostelName || "SEA SINDU QUEEN'S PARADISE").toUpperCase();
  const address = data.address || '291/2G2, Katheri Village, Komarapalayam, Salem DT - 638 183';
  const phone = data.hostelPhone || '80126 55555';

  const student = data.studentName || 'Student';
  const invoice = data.invoiceNo || '—';
  const receiptNum = data.receiptNo || '1';
  const dateStr = data.receiptDate || new Date().toLocaleDateString('en-GB');

  const mode = formatPaymentModeName(data.paymentMode);
  const gatewayMethod = data.gatewayMethod || (data.paymentMode?.toUpperCase() === 'RAZORPAY' ? 'Online' : 'Manual');
  const statusStr = (data.paymentStatus || 'PAID').toUpperCase();

  const totalPaid = Number(data.totalAmount || 0);
  const totalPaidStr = totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const discount = Number(data.discountAmount || 0);
  const discountStr = discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const gross = Number(data.grossAmount || (totalPaid + discount));
  const grossStr = gross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pending = Number(data.pendingBalance || 0);
  const pendingStr = pending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Format fee items exactly like the table
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

  const lines = [
    topText,
    ``,
    `🏛️ *${hostelTitle}*`,
    `*( LADIES HOSTEL )*`,
    `📍 ${address}`,
    `📞 ${phone}`,
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
  ];

  return lines.filter((line) => line !== '').join('\n');
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
