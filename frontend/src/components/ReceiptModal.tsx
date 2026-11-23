import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, X, Printer, Phone } from 'lucide-react';
import { toast } from 'react-toastify';
import { getSystemSettings } from '../api/settings.api';
import { formatInvoiceNumber } from '../utils/invoiceNumber';
import { resolveFeeBillingMonth } from '../utils/billingCycle';
import { sendWhatsAppPdf, sendWhatsAppReceipt } from '../api/whatsapp.api';

interface ReceiptModalProps {
  fee: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ fee, onClose }) => {
  const receiptCaptureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [settings, setSettings] = useState<any>({
    hostelName: '',
    address: '',
    phone: '',
    email: '',
    gstin: ''
  });

  useEffect(() => {
    getSystemSettings().then(data => {
      if (data) setSettings(data);
    }).catch(err => console.log('Failed to load settings', err));
  }, []);

  if (!fee) return null;

  const isGrouped = Boolean(fee.isGrouped);
  const feesList =
    isGrouped && Array.isArray(fee.feesList) && fee.feesList.length
      ? fee.feesList
      : [fee];
  const firstFee = feesList[0];
  const primaryStudent = isGrouped ? fee.student : firstFee?.student;

  // Payment fields can live on the grouped receipt row or on any transaction
  // inside it, so read the first non-empty value instead of trusting the group.
  const firstValue = (key: string) => {
    const direct = String(fee?.[key] ?? '').trim();
    if (direct) return direct;
    const match = feesList.find((item: any) =>
      String(item?.[key] ?? '').trim(),
    );
    return match ? String(match[key]).trim() : '';
  };

  const razorpayPaymentId = firstValue('razorpayPaymentId');
  const razorpayOrderId = firstValue('razorpayOrderId');
  const paymentStatus = firstValue('paymentStatus');
  const paymentMethod = firstValue('paymentMethod');
  const paymentMode = firstValue('paymentMode');

  const totalAmount = Number(isGrouped ? fee.totalAmount : firstFee?.amount) || 0;

  // Payment metadata is stored in the fee descriptions so it survives a page
  // reload and is available when a receipt is opened from the fees table.
  const parseDescriptionValue = (feeItem: any, key: string) => {
    const raw = String(feeItem?.description || '');
    const match = raw.match(new RegExp(`(?:^|\\|)\\s*${key}:\\s*([^|]+)`, 'i'));
    return match && match[1].trim() ? match[1].trim() : '';
  };

  const descriptionValue = (key: string) => {
    for (const item of feesList) {
      const value = parseDescriptionValue(item, key);
      if (value) return value;
    }
    return '';
  };

  const parseMoney = (value: string) => {
    const amount = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  };

  const displayAmountFor = (feeItem: any) => {
    const original = parseMoney(parseDescriptionValue(feeItem, 'Original Amount'));
    return original > 0 ? original : Math.round((Number(feeItem?.amount) || 0) * 100) / 100;
  };

  const visibleFeesList = feesList.filter((item: any) => displayAmountFor(item) > 0);
  const detailFee = visibleFeesList[0] || firstFee;

  const grossTotalAmount = Math.round(
    visibleFeesList.reduce((sum: number, item: any) => sum + displayAmountFor(item), 0) * 100,
  ) / 100;
  const discountAmount = Math.round(
    visibleFeesList.reduce((sum: number, item: any) => sum + parseMoney(parseDescriptionValue(item, 'Discount')), 0) * 100,
  ) / 100;
  // Strip the hidden payment-group token before showing the operator's remarks.
  const rawReceiptRemarks = descriptionValue('Notes').replace(/\s*\[PAY:[^\]]+\]/g, '').trim();
  const receiptRemarks = /^(Original Amount|Discount|Pending Balance)\s*:/i.test(rawReceiptRemarks)
    ? ''
    : rawReceiptRemarks;
  const billingMonthValue = resolveFeeBillingMonth(detailFee) || '-';
  const dueDateValue = detailFee?.dueDate
    ? new Date(detailFee.dueDate).toLocaleDateString('en-GB')
    : '';
  const pendingBalance = descriptionValue('Pending Balance');
  const displayPendingBalance = parseMoney(pendingBalance);

  const hostelName = String(settings.hostelName || '').trim();
  const address = String(settings.address || '').trim();
  const phone = String(settings.phone || '').trim();

  const invoiceSource = firstFee || fee;
  const invoiceNo = fee?.invoiceNumber || formatInvoiceNumber(invoiceSource);
  
  // Supports both the new INV-YYYY-0000000001 format and the legacy
  // INV-YYYY-MM-NNN format. The sequence is the receipt number.
  const invoiceParts = /^INV-\d{4}-(?:(\d{2})-)?(\d+)$/.exec(invoiceNo);
  const invoiceSerial = invoiceParts?.[2] ?? invoiceParts?.[1];
  const receiptNo = invoiceSerial ? String(Number(invoiceSerial)) : '1';
  const receiptDate = new Date(fee.paidDate || fee.createdAt || firstFee?.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const generatePdfBlob = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    if (!receiptCaptureRef.current) return null;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const captureWidth = isMobile ? window.innerWidth : 850;
    const receiptHeight = receiptCaptureRef.current.scrollHeight;
    const canvas = await html2canvas(receiptCaptureRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowHeight: Math.max(window.innerHeight, receiptHeight),
      windowWidth: captureWidth,
      scrollY: 0,
      onclone: (clonedDocument) => {
        const modal = clonedDocument.getElementById('receipt-printable-area');
        const overlay = modal?.parentElement as HTMLElement | null;
        const receiptPad = modal?.querySelector('.receipt-pad') as HTMLElement | null;
        [overlay, modal, receiptPad].forEach((element) => {
          element?.style.setProperty('overflow', 'visible', 'important');
          element?.style.setProperty('max-height', 'none', 'important');
          element?.style.setProperty('height', 'auto', 'important');
        });
        receiptPad?.style.setProperty('flex', 'none', 'important');
        receiptPad?.style.setProperty('min-height', '0', 'important');

        if (isMobile) {
          const feeScroll = modal?.querySelector('.receipt-fee-scroll') as HTMLElement | null;
          const feeTable = modal?.querySelector('.receipt-fee-table') as HTMLTableElement | null;
          feeScroll?.style.setProperty('overflow', 'visible', 'important');
          feeScroll?.style.setProperty('width', '100%', 'important');
          feeTable?.style.setProperty('width', '100%', 'important');
          feeTable?.style.setProperty('min-width', '0', 'important');
          feeTable?.style.setProperty('table-layout', 'fixed', 'important');
          feeTable?.querySelectorAll('th, td').forEach((cell) => {
            const tableCell = cell as HTMLElement;
            tableCell.style.setProperty('min-width', '0', 'important');
            tableCell.style.setProperty('padding', '6px 4px', 'important');
            tableCell.style.setProperty('font-size', '10px', 'important');
            tableCell.style.setProperty('overflow-wrap', 'anywhere', 'important');
            tableCell.style.setProperty('word-break', 'break-word', 'important');
          });
          feeTable?.querySelectorAll('tr').forEach((row) => {
            const cells = row.querySelectorAll('th, td');
            if (cells.length === 3) {
              cells[0].setAttribute('style', `${cells[0].getAttribute('style') || ''}; width: 52% !important;`);
              cells[1].setAttribute('style', `${cells[1].getAttribute('style') || ''}; width: 20% !important;`);
              cells[2].setAttribute('style', `${cells[2].getAttribute('style') || ''}; width: 28% !important;`);
            } else {
              cells[0]?.setAttribute('style', `${cells[0].getAttribute('style') || ''}; width: 72% !important;`);
              cells[1]?.setAttribute('style', `${cells[1].getAttribute('style') || ''}; width: 28% !important;`);
            }
          });
        }
      },
    });

    const mobilePageWidth = (window.innerWidth * 25.4) / 96;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isMobile ? [mobilePageWidth, mobilePageWidth * (297 / 210)] : 'a4',
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageHeightPixels = Math.floor((pageHeight * canvas.width) / pageWidth);
    let offsetY = 0;
    while (offsetY < canvas.height) {
      const sliceHeight = Math.min(pageHeightPixels, canvas.height - offsetY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext('2d');
      if (!context) throw new Error('Could not prepare receipt for download.');
      context.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      if (offsetY > 0) pdf.addPage();
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, (sliceHeight * pageWidth) / canvas.width);
      offsetY += sliceHeight;
    }
    const fileName = (invoiceNo || receiptNo).replace(/[<>:"/\\|?*]+/g, '_');
    return { pdf, fileName };
  };

  const handleDownload = async () => {
    if (!receiptCaptureRef.current) return;
    setDownloading(true);
    try {
      const result = await generatePdfBlob();
      if (result) {
        result.pdf.save(`Receipt_${result.fileName}.pdf`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? `Could not download receipt: ${error.message}` : 'Could not download receipt.',
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsAppSend = async () => {
    let rawPhone =
      primaryStudent?.mobileNo ||
      primaryStudent?.fatherMobileNo ||
      primaryStudent?.guardianMobileNo ||
      '';

    let cleanPhone = String(rawPhone).replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      const entered = window.prompt(
        `Enter WhatsApp mobile number for ${primaryStudent?.name || 'student'}:`,
        cleanPhone || '',
      );
      if (!entered) return;
      cleanPhone = entered.replace(/\D/g, '');
    }

    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    if (cleanPhone.length < 10) {
      toast.error('Invalid mobile number. Please provide a valid 10-digit number.');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const receiptPayload = {
        studentName: primaryStudent?.name || 'Student',
        regNo: primaryStudent?.regNo || 'N/A',
        roomNo: primaryStudent?.room?.roomNumber || 'N/A',
        invoiceNo,
        receiptNo,
        receiptDate,
        hostelName: hostelName || undefined,
        address: address || undefined,
        hostelPhone: phone || undefined,
        billingMonth: billingMonthValue !== '-' ? billingMonthValue : undefined,
        dueDate: dueDateValue || undefined,
        paymentMode: paymentMode || paymentMethod || 'CASH',
        gatewayMethod: razorpayPaymentId ? `Razorpay (${razorpayPaymentId})` : (paymentMethod || 'Manual'),
        pendingBalance: displayPendingBalance,
        grossAmount: grossTotalAmount,
        discountAmount: discountAmount,
        amount: totalAmount,
        notes: receiptRemarks || undefined,
        items: visibleFeesList.map((item: any) => ({
          description: item.type ? item.type.replace(/_/g, ' ') : 'Fee',
          type: item.type || 'FEE',
          amount: displayAmountFor(item),
        })),
      };

      const res = await sendWhatsAppReceipt(cleanPhone, receiptPayload);
      if (res.success) {
        toast.success(`✅ Official PDF Receipt sent to WhatsApp: ${cleanPhone}`);
      } else {
        toast.error('WhatsApp message could not be delivered. Make sure the backend WhatsApp bot is linked.');
      }
    } catch (err: any) {
      // Fallback to sending direct canvas PDF if backend receipt route has an issue
      try {
        const result = await generatePdfBlob();
        if (result) {
          const pdfBase64 = result.pdf.output('datauristring');
          const docFileName = `Receipt_${result.fileName}.pdf`;
          const caption = `Official Fee Receipt for ${primaryStudent?.name || 'Student'} (${invoiceNo || receiptNo})`;
          await sendWhatsAppPdf(cleanPhone, pdfBase64, docFileName, caption);
          toast.success(`✅ PDF Receipt (${docFileName}) sent to WhatsApp: ${cleanPhone}`);
          return;
        }
      } catch (fallbackErr: any) {
        console.error('Fallback PDF send error:', fallbackErr);
      }

      toast.error(
        `Direct WhatsApp sending failed: ${err.message}. Make sure the backend WhatsApp bot is connected!`,
      );
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handlePrint = () => {
    const receipt = document.getElementById('receipt-printable-area');
    if (!receipt) {
      toast.error('Could not find the receipt to print.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error('Allow pop-ups to print the receipt.');
      return;
    }
    printWindow.opener = null;
    printWindow.addEventListener('afterprint', () => printWindow.close(), {
      once: true,
    });

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Fee Receipt</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; width: 100%; color: #000; background: #fff; font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif; }
            #receipt-printable-area { display: block; position: relative; width: 100%; max-width: none; height: auto; max-height: none; overflow: visible; border-radius: 0; box-shadow: none; background: #fff; }
            .receipt-pad { display: block; position: relative; width: 100%; height: auto; max-height: none; min-height: 0; padding: 10mm 8mm; overflow: visible; }
            .receipt-content { position: relative; z-index: 1; }
            .receipt-fee-scroll { width: 100%; overflow: visible; }
            .receipt-fee-table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; }
            .receipt-fee-table thead { display: table-header-group; }
            .receipt-fee-table tr, .receipt-footer { break-inside: avoid; page-break-inside: avoid; }
            .no-print, .no-print * { display: none !important; }
            .print-exact { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>${receipt.outerHTML}</body>
      </html>`);
    printWindow.document.close();
    window.setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.focus();
        printWindow.print();
      }
    }, 250);
  };

  const refNo =
    feesList
      .map((item: any) =>
        String(item?.description || '').match(/\|\s*Ref:\s*([^|]+)/)?.[1]?.trim(),
      )
      .find(Boolean) ||
    razorpayPaymentId ||
    razorpayOrderId ||
    '';

  const formatPaymentMode = (mode: string) => {
    const upper = mode.toUpperCase();
    if (upper === 'UPI') return 'UPI';
    return mode
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const displayPaymentMode = paymentMode ? formatPaymentMode(paymentMode) : '—';
  const displayGatewayMethod = paymentMethod
    ? paymentMethod.toUpperCase()
    : paymentMode && paymentMode.toUpperCase() !== 'RAZORPAY'
      ? 'Manual'
      : '—';
  // A manual reference number is not a gateway payment id. These rows are only
  // rendered when a value actually exists, so empty manual payments do not
  // show "Payment ID —" / "Transaction Ref —" on the receipt.
  const displayPaymentId = razorpayPaymentId || '—';
  const displayRefNo = refNo || razorpayPaymentId || razorpayOrderId || '—';
  const displayPaymentStatus =
    (paymentStatus || (firstFee?.status === 'COMPLETED' ? 'PAID' : '')).toUpperCase() ||
    'PAID';

  return (
    <div className="receipt-overlay">
      <style>
        {`
          .receipt-overlay {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(4px);
          }
          .receipt-modal {
            position: relative;
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 850px;
            max-height: 95vh;
            max-height: 95dvh;
            overflow: hidden;
            border-radius: 4px;
            background: #fff;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
          }
          .receipt-content {
            position: relative;
            z-index: 1;
          }
          
          /* Vintage Header Styles */
          .vintage-header {
            text-align: center;
            color: #000;
            margin-bottom: 14px;
          }
          .vintage-header .top-text {
            font-family: "Georgia", serif;
            font-size: 16px;
            font-style: italic;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          .vintage-header .temple-icon {
            width: 40px;
            height: auto;
            margin: 0 auto 6px;
            display: block;
          }
          
          .vintage-header .subtitle {
            font-family: "Times New Roman", serif;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 1.5px;
            margin-bottom: 5px;
          }
          .vintage-header .address-text {
            font-family: "Arial", sans-serif;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
            letter-spacing: 0.5px;
            line-height: 1.4;
            padding: 0 20px;
          }
          
          .vintage-header .ornament-line {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 8px auto;
            max-width: 550px;
          }
          .vintage-header .ornament-line::before,
          .vintage-header .ornament-line::after {
            content: "";
            flex: 1;
            border-bottom: 1.5px solid #000;
          }
          .vintage-header .ornament-diamond {
            width: 6px;
            height: 6px;
            background: #000;
            transform: rotate(45deg);
            margin: 0 12px;
          }

          /* Center Title Text */
          .receipt-title-text {
            text-align: center;
            font-family: "Times New Roman", serif;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-top: 14px;
            margin-bottom: 14px;
          }
          
          /* Metadata Split Layout */
          .receipt-meta-split {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            padding: 0 10px;
            align-items: flex-start;
          }
          
          .receipt-meta-col {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .receipt-meta-line {
            display: flex;
            align-items: center;
            font-family: "Arial", sans-serif;
            font-size: 14px;
            font-weight: 600;
            color: #333;
            white-space: nowrap;
          }
          .receipt-meta-line .label {
            font-family: "Times New Roman", serif;
            font-size: 16px;
            font-weight: 700;
            color: #000;
            margin-right: 8px;
          }
          .receipt-meta-line .value {
            font-weight: 700;
            color: #000;
            font-size: 15px;
          }
          .receipt-meta-line .value--regular {
            font-weight: 400;
          }
          
          .receipt-sub-line {
            font-family: "Arial", sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: #555;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .receipt-sub-line.left-align {
            justify-content: flex-start;
          }
          .receipt-sub-line.right-align {
            justify-content: flex-end;
            color: #000;
            font-size: 14px;
          }

          /* Side-by-side Flex Layout */
          .receipt-side-by-side {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
          }
          .receipt-col-half {
            flex: 1;
            width: 50%;
            min-width: 0;
          }

          /* Shared Table Styles */
          .receipt-student-details,
          .receipt-payment-details {
            width: 100%;
            border-collapse: collapse;
            color: #000;
            font-size: 13px;
            line-height: 1.4;
            table-layout: fixed;
          }
          .receipt-student-details th,
          .receipt-payment-details th {
            padding: 6px 10px 6px 0;
            border-bottom: 1px solid #ccc;
            color: #555;
            font-size: 11px;
            text-align: left;
            text-transform: uppercase;
          }
          .receipt-student-details td,
          .receipt-payment-details td {
            padding: 6px 10px 6px 0;
            word-break: break-word;
          }
          .receipt-student-details td:last-child,
          .receipt-payment-details td:last-child {
            padding: 6px 0;
            font-weight: 600;
          }

          .receipt-fee-scroll { width: 100%; overflow: visible; }
          .receipt-fee-table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; }
          .receipt-fee-table thead { display: table-header-group; }
          .receipt-fee-table tr, .receipt-footer { break-inside: avoid; page-break-inside: avoid; }

          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            html, body, #root {
              position: static !important;
              display: block !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              background: #fff !important;
            }
            body * { visibility: hidden !important; }
            .receipt-overlay,
            .receipt-overlay * { visibility: visible !important; }
            .receipt-overlay {
              position: static !important;
              inset: auto !important;
              display: block !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              box-sizing: border-box !important;
              background: #fff !important;
              backdrop-filter: none !important;
            }
            #receipt-printable-area {
              position: relative !important;
              display: block !important;
              width: 100% !important;
              max-width: none !important;
              height: auto !important;
              max-height: none !important;
              min-height: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              box-sizing: border-box !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: #fff !important;
            }
            .receipt-pad {
              position: relative !important;
              display: block !important;
              flex: none !important;
              width: 100% !important;
              height: auto !important;
              max-height: none !important;
              min-height: 0 !important;
              padding: 10mm 8mm !important;
              overflow: visible !important;
              box-sizing: border-box !important;
            }
            .receipt-content { position: relative !important; }
            .receipt-side-by-side { display: flex !important; flex-direction: row !important; gap: 20px !important; }
            .receipt-col-half { flex: 1 !important; width: 50% !important; min-width: 0 !important; }
            .receipt-fee-scroll { width: 100% !important; overflow: visible !important; }
            .receipt-fee-table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; }
            .receipt-fee-table thead { display: table-header-group; }
            .receipt-fee-table tr, .receipt-footer { break-inside: avoid; page-break-inside: avoid; }
            .no-print, .no-print * { display: none !important; visibility: hidden !important; }
            .print-exact { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          @media (max-width: 640px) {
            .receipt-overlay { align-items: stretch; padding: 8px; box-sizing: border-box; }
            .receipt-modal { width: 100%; max-width: none; height: 100%; max-height: none; min-width: 0; border-radius: 12px; }
            .receipt-pad { flex: 1 1 auto; min-width: 0; min-height: 0 !important; padding: 18px 18px 28px !important; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
            .vintage-header .top-text { font-size: 13px; }
            .vintage-header .subtitle { font-size: 16px; }
            .vintage-header .address-text { font-size: 11px; padding: 0 10px; }
            .vintage-header .ornament-line { max-width: 100%; margin: 10px 20px; }
            .vintage-header .temple-icon { width: 30px; }
            
            .receipt-meta-split { flex-direction: column; gap: 20px; }
            .receipt-sub-line.right-align { justify-content: flex-start; }
            
            .receipt-side-by-side { flex-direction: column; gap: 20px; }
            .receipt-col-half { width: 100%; }

            .receipt-billed-to { flex-direction: column; margin-bottom: 22px !important; }
            .receipt-fee-scroll { width: 100%; min-width: 0; overflow-x: auto; overflow-y: hidden; overscroll-behavior-inline: contain; -webkit-overflow-scrolling: touch; }
            .receipt-fee-table { display: table !important; width: 100% !important; min-width: 520px !important; table-layout: auto; }
            .receipt-fee-table th, .receipt-fee-table td { padding: 6px !important; font-size: 12px !important; vertical-align: top; }
            .action-bar { position: relative; z-index: 2; flex: 0 0 auto; display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 10px 12px !important; gap: 8px !important; }
            .action-bar button { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; justify-content: center; padding: 10px 8px !important; font-size: 12px !important; white-space: nowrap; }
            .action-bar button:last-child { grid-column: 1 / -1; }
          }
        `}
      </style>
      <div id="receipt-printable-area" className="receipt-modal" role="dialog" aria-modal="true" aria-label="Fee receipt">
        
        <div ref={receiptCaptureRef} className="receipt-pad" style={{ padding: '40px 50px', flex: 1, overflowY: 'auto', position: 'relative', minHeight: 0 }}>
          
          {/* PAID Watermark */}
          <div className="watermark print-exact" style={{ position: 'absolute', top: '88%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', fontSize: '120px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.04)', zIndex: 0, pointerEvents: 'none', letterSpacing: '10px' }}>
            PAID
          </div>

          <div className="receipt-content">
            
            {/* Vintage Header Section */}
            <div className="vintage-header">
              <div className="top-text">Mayanur Sri Sellandiamman Thunai</div>
              
              <svg className="temple-icon" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 5 L55 15 L60 15 L60 20 L65 25 L65 30 L70 35 L70 40 L75 45 L75 50 L80 55 L20 55 L25 50 L25 45 L30 40 L30 35 L35 30 L35 25 L40 20 L40 15 L45 15 Z" fill="#222" />
                <rect x="45" y="25" width="10" height="30" fill="#fff" />
                <path d="M45 25 L50 20 L55 25 Z" fill="#222" />
              </svg>

              {/* Arched Main Title */}
              <svg viewBox="0 0 1000 130" style={{ width: '100%', maxWidth: '800px', height: '82px', overflow: 'visible', margin: '0 auto', display: 'block' }}>
                <defs>
                  <path id="curve-title" d="M 50 100 Q 500 0 950 100" />
                </defs>
                <text style={{ fontFamily: '"Times New Roman", serif', fontSize: '44px', fontWeight: 800, fill: '#000', letterSpacing: '2px' }}>
                  <textPath href="#curve-title" startOffset="50%" textAnchor="middle">
                    {hostelName.toUpperCase()}
                  </textPath>
                </text>
              </svg>

              <div className="subtitle">( LADIES HOSTEL )</div>
              <div className="address-text">{address}</div>

              <div className="ornament-line">
                <div className="ornament-diamond"></div>
              </div>
            </div>

            {/* Center Text Title */}
            <div className="receipt-title-text">FEES RECEIPT</div>

            {/* Split Meta Row (Left & Right, Center Empty) */}
            <div className="receipt-meta-split">
              <div className="receipt-meta-col">
                <div className="receipt-meta-line">
                  <span className="label">Receipt No:</span>
                  <span className="value">{receiptNo}</span>
                </div>
                <div className="receipt-meta-line">
                  <span className="label">Invoice No:</span>
                  <span className="value value--regular">{invoiceNo}</span>
                </div>
              </div>
              
              <div className="receipt-meta-col">
                <div className="receipt-meta-line">
                  <span className="label">Date :</span>
                  <span className="value">{receiptDate}</span>
                </div>
                <div className="receipt-sub-line right-align">
                  <Phone size={14} className="text-gray-700" />
                  <span>{phone}</span>
                </div>
              </div>
            </div>

            {/* NEW: Side-by-Side Layout (Student Left, Payment Right) */}
            <div className="receipt-side-by-side">
              
              {/* Left Column: Student Details */}
              <div className="receipt-col-half">
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', margin: 0 }}>Received From</h3>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#000', marginBottom: '10px' }}>{primaryStudent?.name || 'Unknown Student'}</div>
                <table className="receipt-student-details">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Field</th>
                      <th style={{ width: '60%' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Registration No</td><td>{primaryStudent?.manualRegsiName || primaryStudent?.regNo || 'N/A'}</td></tr>
                    <tr><td>Room No</td><td>{primaryStudent?.roomNo || 'N/A'}</td></tr>
                    <tr><td>Billing Month</td><td>{billingMonthValue}</td></tr>
                    {dueDateValue && <tr><td>Due Date</td><td>{dueDateValue}</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Right Column: Payment Details */}
              <div className="receipt-col-half">
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', margin: 0 }}>Payment Details</h3>
                <div style={{ height: '24px', marginBottom: '10px' }}></div> {/* Spacer to align tables */}
                <table className="receipt-payment-details">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Field</th>
                      <th style={{ width: '60%' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Payment Mode</td><td>{displayPaymentMode}</td></tr>
                    <tr><td>Gateway Method</td><td>{displayGatewayMethod}</td></tr>
                    {displayPaymentId !== '—' && (
                      <tr><td>Payment ID</td><td>{displayPaymentId}</td></tr>
                    )}
                    {displayRefNo !== '—' && (
                      <tr><td>Transaction Ref</td><td>{displayRefNo}</td></tr>
                    )}
                    <tr><td>Payment Status</td><td style={{ color: '#16a34a' }}>{displayPaymentStatus}</td></tr>
                    {pendingBalance !== '' && (
                      <tr><td>Pending Balance</td><td>₹{displayPendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                    )}
                    {receiptRemarks && (
                      <tr><td>Remarks</td><td>{receiptRemarks}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Fee Breakup Table */}
            <div className="receipt-fee-block" style={{ marginBottom: '20px' }}>
              <div className="receipt-fee-scroll" role="region" aria-label="Fee breakup table, scroll horizontally to see all columns" tabIndex={0}>
              <table className="receipt-fee-table" aria-label="Fee breakup" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <thead>
                  <tr className="print-exact" style={{ background: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFeesList.map((f: any) => (
                    <tr key={f.id}>
                      <td style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '14px', color: '#000', fontWeight: 500 }}>
                        <div style={{ marginBottom: f.description?.includes('|') ? '4px' : '0' }}>
                          {f.description?.split('|')[0]?.trim() || 'Hostel Fee'}
                        </div>
                        {f.description?.includes('|') && f.description.split('|').slice(1)
                          .filter((part: string) => {
                            const text = part.trim();
                            return !text.startsWith('Ref:') &&
                              !text.startsWith('Notes:') &&
                              !text.startsWith('Original Amount:') &&
                              !text.startsWith('Discount:') &&
                              !text.startsWith('Pending Balance:') &&
                              !text.startsWith('[PAY:');
                          })
                          .map((descPart: string, idx: number) => {
                            const trimmed = descPart.trim();
                            const match = trimmed.match(/Paid for (\d+) Months/);
                            let extraText = '';
                            if (match && f.amount) {
                              const months = parseInt(match[1], 10);
                              if (months > 0) {
                                const originalAmount = f.amount / months;
                                extraText = ` (@ ₹${originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/month)`;
                              }
                            }
                            return (
                              <div key={idx} style={{ fontSize: '12px', color: '#555', fontWeight: 400, marginTop: idx > 0 ? '2px' : '0' }}>
                                {trimmed}{extraText}
                              </div>
                            );
                          })}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '13px', color: '#555', textAlign: 'center' }}>
                        {f.transactionType}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '14px', color: '#000', fontWeight: 600, textAlign: 'right' }}>
                        ₹{displayAmountFor(f).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {discountAmount > 0 && (
                    <>
                      <tr className="print-exact">
                        <td className="receipt-total-label" colSpan={2} style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '13px', color: '#000', fontWeight: 600, textAlign: 'right' }}>
                          Total Before Discount
                        </td>
                        <td style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '14px', color: '#000', fontWeight: 600, textAlign: 'right' }}>
                          ₹{grossTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr className="print-exact">
                        <td className="receipt-total-label" colSpan={2} style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '13px', color: '#000', fontWeight: 600, textAlign: 'right' }}>
                          Discount
                        </td>
                        <td style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '14px', color: '#b91c1c', fontWeight: 600, textAlign: 'right' }}>
                          −₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </>
                  )}
                  {/* Total Row */}
                  <tr className="print-exact" style={{ background: '#f5f5f5' }}>
                    <td className="receipt-total-label" colSpan={2} style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '14px', color: '#000', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Total Amount Paid
                    </td>
                    <td className="receipt-total-amount" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '18px', color: '#000', fontWeight: 800, textAlign: 'right' }}>
                      ₹{totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>

            {/* Footer Section */}
            <div className="receipt-footer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '50px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
              <div style={{ textAlign: 'center', color: '#555', fontSize: '12px', fontStyle: 'italic' }}>
                <strong style={{ color: '#000', display: 'block', marginBottom: '4px' }}>Payment Successful</strong>
                This is a computer generated receipt. No signature is required.
              </div>
            </div>

          </div>
        </div>

        {/* Actions (No Print) */}
        <div className="action-bar no-print" style={{ padding: '20px 40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ background: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', padding: '10px 24px', borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <X size={18} /> Close
          </button>
          <button
            onClick={handleWhatsAppSend}
            disabled={sendingWhatsApp}
            title="Send exact PDF receipt to student on WhatsApp"
            style={{
              background: '#25D366',
              border: 'none',
              cursor: sendingWhatsApp ? 'wait' : 'pointer',
              opacity: sendingWhatsApp ? 0.7 : 1,
              padding: '10px 24px',
              borderRadius: '8px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px -1px rgba(37, 211, 102, 0.25)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            {sendingWhatsApp ? 'Sending PDF to WhatsApp...' : 'Send PDF via WhatsApp'}
          </button>
          <button onClick={handleDownload} disabled={downloading} style={{ background: '#16a34a', border: 'none', cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.7 : 1, padding: '10px 24px', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)' }}>
            <Download size={18} /> {downloading ? 'Preparing PDF...' : 'Download Receipt'}
          </button>
          <button onClick={handlePrint} style={{ background: '#0f172a', border: 'none', cursor: 'pointer', padding: '10px 24px', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)' }}>
            <Printer size={18} /> Print Document
          </button>
        </div>

      </div>
    </div>
  );
};