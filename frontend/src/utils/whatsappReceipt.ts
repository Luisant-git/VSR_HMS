import { sendWhatsAppReceipt } from '../api/whatsapp.api';
import { toast } from 'react-toastify';

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
    data.notes ? `*Remarks         :* ${data.notes}` : '',
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *FEE BREAKDOWN*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    itemsBlock,
    `────────────────────────────`,
    discount > 0 ? `Total Before Discount : ₹${grossStr}\nDiscount              : -₹${discountStr}\n────────────────────────────` : '',
    `💰 *TOTAL AMOUNT PAID : ₹${totalPaidStr}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `✅ *Payment Successful*`,
    `_This is a computer generated receipt. No signature is required._`,
  ];

  return lines.filter((line) => line !== '').join('\n');
}

/**
 * Sends the official fee receipt PDF directly to the student / parent on WhatsApp.
 */
export async function sendReceiptViaWhatsApp(data: WhatsAppReceiptData): Promise<boolean> {
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
    toast.error('Invalid mobile number. Please provide a valid 10-digit number.');
    return false;
  }

  const toastId = toast.loading(`Sending official PDF receipt to ${targetPhone}...`);

  try {
    const invoiceLabel = data.invoiceNo || data.receiptNo || 'Receipt';
    const invoiceParts = /^INV-\d{4}-(?:(\d{2})-)?(\d+)$/.exec(invoiceLabel);
    const invoiceSerial = invoiceParts?.[2] ?? invoiceParts?.[1];
    const receiptNo = invoiceSerial ? String(Number(invoiceSerial)) : (data.receiptNo || '1');

    const receiptPayload = {
      studentName: data.studentName || 'Student',
      regNo: data.regNo || 'N/A',
      roomNo: data.roomNo || 'N/A',
      invoiceNo: data.invoiceNo,
      receiptNo,
      receiptDate: data.receiptDate || new Date().toLocaleDateString('en-GB'),
      hostelName: data.hostelName,
      address: data.address,
      hostelPhone: data.hostelPhone,
      billingMonth: data.billingMonth,
      dueDate: data.dueDate,
      paymentMode: data.paymentMode || 'CASH',
      gatewayMethod: data.gatewayMethod || (data.paymentMode?.toUpperCase() === 'RAZORPAY' ? 'Online' : 'Manual'),
      pendingBalance: data.pendingBalance,
      grossAmount: data.grossAmount || data.totalAmount,
      discountAmount: data.discountAmount,
      amount: data.totalAmount,
      notes: data.notes,
      items:
        data.items && data.items.length > 0
          ? data.items.map((item) => ({
              description: item.description || formatFeeTypeName(item.type),
              type: item.type || 'FEE',
              amount: Number(item.amount || 0),
            }))
          : [{ description: 'Hostel Fee', type: 'FEE', amount: Number(data.totalAmount || 0) }],
    };

    const res = await sendWhatsAppReceipt(targetPhone, receiptPayload);
    if (res && res.success) {
      toast.update(toastId, {
        render: `✅ Official PDF Receipt sent to WhatsApp: ${targetPhone}`,
        type: 'success',
        isLoading: false,
        autoClose: 3500,
      });
      return true;
    } else {
      toast.update(toastId, {
        render: '⚠️ WhatsApp message could not be delivered. Make sure the backend WhatsApp bot is linked.',
        type: 'warning',
        isLoading: false,
        autoClose: 5000,
      });
      return false;
    }
  } catch (err: any) {
    toast.update(toastId, {
      render: `❌ Failed to send PDF receipt: ${err?.message || 'Error occurred'}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });
    return false;
  }
}
