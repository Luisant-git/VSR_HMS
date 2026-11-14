import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, X, Printer, Phone } from 'lucide-react';
import { toast } from 'react-toastify';
import { getSystemSettings } from '../api/settings.api';
import { formatInvoiceNumber } from '../utils/invoiceNumber';

interface ReceiptModalProps {
  fee: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ fee, onClose }) => {
  const receiptCaptureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
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

  const totalAmount = isGrouped ? fee.totalAmount : firstFee?.amount;

  const hostelName = String(settings.hostelName || '').trim();
  const address = String(settings.address || '').trim();
  const phone = String(settings.phone || '').trim();

  const invoiceSource = firstFee || fee;
  const invoiceNo = fee?.invoiceNumber || formatInvoiceNumber(invoiceSource);
  
  const invoiceSerial = /^INV-\d{4}-\d{2}-(\d+)$/.exec(invoiceNo)?.[1];
  const receiptNo = invoiceSerial ? String(Number(invoiceSerial)) : '1';
  const receiptDate = new Date(fee.paidDate || fee.createdAt || firstFee?.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleDownload = async () => {
    if (!receiptCaptureRef.current) return;
    setDownloading(true);
    try {
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
        onclone: clonedDocument => {
          const modal = clonedDocument.getElementById('receipt-printable-area');
          const overlay = modal?.parentElement as HTMLElement | null;
          const receiptPad = modal?.querySelector('.receipt-pad') as HTMLElement | null;
          [overlay, modal, receiptPad].forEach(element => {
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
            feeTable?.querySelectorAll('th, td').forEach(cell => {
              const tableCell = cell as HTMLElement;
              tableCell.style.setProperty('min-width', '0', 'important');
              tableCell.style.setProperty('padding', '6px 4px', 'important');
              tableCell.style.setProperty('font-size', '10px', 'important');
              tableCell.style.setProperty('overflow-wrap', 'anywhere', 'important');
              tableCell.style.setProperty('word-break', 'break-word', 'important');
            });
            feeTable?.querySelectorAll('tr').forEach(row => {
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
        format: isMobile
          ? [mobilePageWidth, mobilePageWidth * (297 / 210)]
          : 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageHeightPixels = Math.floor(
        (pageHeight * canvas.width) / pageWidth,
      );
      let offsetY = 0;
      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(pageHeightPixels, canvas.height - offsetY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Could not prepare receipt for download.');
        context.drawImage(
          canvas,
          0,
          offsetY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );
        if (offsetY > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL('image/png'),
          'PNG',
          0,
          0,
          pageWidth,
          (sliceHeight * pageWidth) / canvas.width,
        );
        offsetY += sliceHeight;
      }
      const fileName = (invoiceNo || receiptNo).replace(/[<>:"/\\|?*]+/g, '_');
      pdf.save(`Receipt_${fileName}.pdf`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Could not download receipt: ${error.message}`
          : 'Could not download receipt.',
      );
    } finally {
      setDownloading(false);
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
  const displayPaymentId = razorpayPaymentId || refNo || '—';
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
            margin-bottom: 25px;
          }
          .vintage-header .top-text {
            font-family: "Georgia", serif;
            font-size: 16px;
            font-style: italic;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          .vintage-header .temple-icon {
            width: 40px;
            height: auto;
            margin: 0 auto 12px;
            display: block;
          }
          
          .vintage-header .subtitle {
            font-family: "Times New Roman", serif;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 1.5px;
            margin-bottom: 8px;
          }
          .vintage-header .address-text {
            font-family: "Arial", sans-serif;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            letter-spacing: 0.5px;
            line-height: 1.4;
            padding: 0 20px;
          }
          
          .vintage-header .ornament-line {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 15px auto;
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
            margin-top: 25px;
            margin-bottom: 25px;
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
            .receipt-fee-table th, .receipt-fee-table td { padding: 9px 8px !important; font-size: 12px !important; vertical-align: top; }
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
              <svg viewBox="0 0 1000 130" style={{ width: '100%', maxWidth: '800px', height: '110px', overflow: 'visible', margin: '0 auto', display: 'block' }}>
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
                    <tr><td>Payment ID</td><td>{displayPaymentId}</td></tr>
                    <tr><td>Transaction Ref</td><td>{displayRefNo}</td></tr>
                    <tr><td>Payment Status</td><td style={{ color: '#16a34a' }}>{displayPaymentStatus}</td></tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Fee Breakup Table */}
            <div className="receipt-fee-block" style={{ marginBottom: '40px' }}>
              <div className="receipt-fee-scroll" role="region" aria-label="Fee breakup table, scroll horizontally to see all columns" tabIndex={0}>
              <table className="receipt-fee-table" aria-label="Fee breakup" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <thead>
                  <tr className="print-exact" style={{ background: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #000', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ border: '1px solid #000', padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ border: '1px solid #000', padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {feesList.map((f: any) => (
                    <tr key={f.id}>
                      <td style={{ border: '1px solid #000', padding: '16px', fontSize: '14px', color: '#000', fontWeight: 500 }}>
                        <div style={{ marginBottom: f.description?.includes('|') ? '4px' : '0' }}>
                          {f.description?.split('|')[0]?.trim() || 'Hostel Fee'}
                        </div>
                        {f.description?.includes('|') && f.description.split('|').slice(1)
                          .filter((part: string) => !part.trim().startsWith('Ref:') && !part.trim().startsWith('Notes:'))
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
                      <td style={{ border: '1px solid #000', padding: '16px', fontSize: '13px', color: '#555', textAlign: 'center' }}>
                        {f.transactionType}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '16px', fontSize: '14px', color: '#000', fontWeight: 600, textAlign: 'right' }}>
                        ₹{f.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="print-exact" style={{ background: '#f5f5f5' }}>
                    <td className="receipt-total-label" colSpan={2} style={{ border: '1px solid #000', padding: '16px', fontSize: '14px', color: '#000', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Total Amount Paid
                    </td>
                    <td className="receipt-total-amount" style={{ border: '1px solid #000', padding: '16px', fontSize: '18px', color: '#000', fontWeight: 800, textAlign: 'right' }}>
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
        <div className="action-bar no-print" style={{ padding: '20px 40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button onClick={onClose} style={{ background: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', padding: '10px 24px', borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <X size={18} /> Close
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