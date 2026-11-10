import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, X, Printer } from 'lucide-react';
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
    hostelName: 'HOSTEL MANAGEMENT SYSTEM',
    address: '123 University Road, City Campus\nState, ZIP 12345',
    phone: '+91 98765 43210',
    gstin: '22AAAAA0000A1Z5'
  });

  useEffect(() => {
    getSystemSettings().then(data => {
      if (data) setSettings(data);
    }).catch(err => console.log('Failed to load settings', err));
  }, []);

  if (!fee) return null;

  // Handle both grouped fee objects and raw single fees for backward compatibility
  const isGrouped = fee.isGrouped;
  const feesList = isGrouped ? fee.feesList : [fee];
  const firstFee = feesList[0];
  const primaryStudent = isGrouped ? fee.student : firstFee?.student;
  const razorpayOrderId =
    fee?.razorpayOrderId ||
    feesList.find((item: any) => item.razorpayOrderId)?.razorpayOrderId;
  const razorpayPaymentId =
    fee?.razorpayPaymentId ||
    feesList.find((item: any) => item.razorpayPaymentId)?.razorpayPaymentId;
  const paymentStatus =
    fee?.paymentStatus ||
    feesList.find((item: any) => item.paymentStatus)?.paymentStatus;
  const paymentMethod =
    fee?.paymentMethod ||
    feesList.find((item: any) => item.paymentMethod)?.paymentMethod;
  
  const totalAmount = isGrouped ? fee.totalAmount : firstFee?.amount;
  const paymentMode = isGrouped ? fee.paymentMode : firstFee?.paymentMode;
  // unused description

  const invoiceSource = firstFee || fee;
  const invoiceNo = fee?.invoiceNumber || formatInvoiceNumber(invoiceSource);
  
  const dateStr = new Date(firstFee?.createdAt || Date.now()).toISOString().slice(0,10).replace(/-/g, '');
  const count = parseInt((firstFee?.id || '0').substring(0, 8), 16) % 10000 || Math.floor(Math.random() * 9999);
  const receiptNo = `REC-${dateStr}-${count.toString().padStart(4, '0')}`;
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
            html, body { margin: 0; padding: 0; width: 100%; color: #0f172a; background: #fff; font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif; }
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

  const firstFeeDesc = firstFee?.description || '';
  const refMatch = firstFeeDesc.match(/\|\s*Ref:\s*([^|]+)/);
  const refNo = refMatch ? refMatch[1].trim() : null;
  
  const notesMatch = firstFeeDesc.match(/\|\s*Notes:\s*([^|]+)/);
  const notesText = notesMatch ? notesMatch[1].trim() : null;

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
            max-width: 750px;
            max-height: 95vh;
            max-height: 95dvh;
            overflow: hidden;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
          }
          .receipt-content {
            position: relative;
            z-index: 1;
          }
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
            .receipt-modal > .print-exact { height: 6px !important; flex: 0 0 6px; }
            .receipt-header, .receipt-footer { flex-direction: column !important; align-items: flex-start !important; gap: 12px; }
            .receipt-header > div:last-child { text-align: left !important; margin-left: 0 !important; }
            .receipt-header > div:first-child { min-width: 0; width: 100%; }
            .receipt-header h1 { font-size: 22px !important; overflow-wrap: anywhere; }
            .receipt-header .title-text { font-size: 24px !important; letter-spacing: 2px !important; margin-bottom: 8px !important; }
            .receipt-header .receipt-meta-table { display: table !important; width: auto !important; max-width: 100%; margin: 0 !important; text-align: left !important; white-space: normal !important; }
            .receipt-meta-table td { overflow-wrap: anywhere; }
            .receipt-pad { flex: 1 1 auto; min-width: 0; min-height: 0 !important; padding: 18px 18px 28px !important; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
            .receipt-header { margin-bottom: 22px !important; padding-bottom: 18px !important; }
            .receipt-billed-to { flex-direction: column; }
            .receipt-billed-to > div { min-width: 0; width: 100%; }
            .receipt-billed-to { margin-bottom: 22px !important; }
            .receipt-student-name { font-size: 16px !important; overflow-wrap: anywhere; }
            .receipt-breakable { overflow-wrap: anywhere; word-break: break-word; }
            .receipt-fee-scroll { width: 100%; min-width: 0; overflow-x: auto; overflow-y: hidden; overscroll-behavior-inline: contain; -webkit-overflow-scrolling: touch; }
            .receipt-fee-table { display: table !important; width: 100% !important; min-width: 520px !important; table-layout: auto; border-collapse: collapse; white-space: normal !important; }
            .receipt-fee-table th,
            .receipt-fee-table td { padding: 9px 8px !important; font-size: 13px !important; vertical-align: top; white-space: normal !important; overflow-wrap: anywhere; }
            .receipt-fee-table th { min-width: 110px; padding: 9px 8px !important; font-size: 12px !important; letter-spacing: 0.02em; }
            .receipt-fee-table th:first-child,
            .receipt-fee-table td:first-child:not(.receipt-total-label) { min-width: 230px; }
            .receipt-fee-table th:nth-child(2),
            .receipt-fee-table td:nth-child(2) { min-width: 120px; }
            .receipt-fee-table th:last-child,
            .receipt-fee-table td:last-child { min-width: 150px; }
            .receipt-fee-table .receipt-total-label { font-size: 12px !important; letter-spacing: 0 !important; }
            .receipt-fee-table .receipt-total-amount { font-size: 15px !important; }
            .receipt-footer { margin-top: 30px !important; }
            .receipt-signature { align-self: flex-end; max-width: 100%; }
            .receipt-signature-line { max-width: 100%; }
            .watermark { font-size: 52px !important; letter-spacing: 4px !important; }
            .action-bar { position: relative; z-index: 2; flex: 0 0 auto; display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 10px 12px !important; gap: 8px !important; }
            .action-bar button { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; justify-content: center; padding: 10px 8px !important; font-size: 12px !important; white-space: nowrap; }
            .action-bar button:last-child { grid-column: 1 / -1; }
          }
          @media (max-width: 380px) {
            .receipt-pad { padding: 12px 12px 24px !important; }
            .receipt-header { gap: 10px !important; }
            .receipt-header h1 { font-size: 20px !important; }
            .action-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .action-bar button:first-child { grid-column: 1; grid-row: 2; }
            .action-bar button:nth-child(2) { grid-column: 1 / -1; grid-row: 1; }
            .action-bar button:last-child { grid-column: 2; grid-row: 2; }
            .watermark { font-size: 44px !important; letter-spacing: 3px !important; }
          }
        `}
      </style>
      <div id="receipt-printable-area" className="receipt-modal">
        
        {/* Top Accent Bar */}
        <div className="print-exact" style={{ height: '8px', background: 'linear-gradient(90deg, #1e293b, #334155)', width: '100%' }}></div>

        <div ref={receiptCaptureRef} className="receipt-pad" style={{ padding: '40px 50px', flex: 1, overflowY: 'auto', position: 'relative', minHeight: 0 }}>
          
          {/* PAID Watermark */}
          <div className="watermark print-exact" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', fontSize: '120px', fontWeight: 900, color: 'rgba(22, 163, 74, 0.05)', zIndex: 0, pointerEvents: 'none', letterSpacing: '10px' }}>
            PAID
          </div>

          <div className="receipt-content">
            {/* Header Section */}
            <div className="receipt-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '2px solid #f1f5f9', paddingBottom: '30px' }}>
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>{settings.hostelName}</h1>
                <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                  {settings.address.split('\n').map((line: string, i: number) => <React.Fragment key={i}>{line}<br/></React.Fragment>)}
                  Phone: {settings.phone}<br/>
                  GSTIN: {settings.gstin}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="title-text" style={{ fontSize: '32px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '4px', lineHeight: 1, marginBottom: '15px' }}>RECEIPT</div>
                <table className="receipt-meta-table" style={{ fontSize: '13px', textAlign: 'right', marginLeft: 'auto', color: '#334155' }}>
                  <tbody>
                    <tr><td style={{ paddingBottom: '4px', paddingRight: '12px', fontWeight: 600 }}>Receipt No:</td><td style={{ paddingBottom: '4px', fontWeight: 700, color: '#0f172a' }}>{receiptNo}</td></tr>
                    <tr><td style={{ paddingBottom: '4px', paddingRight: '12px', fontWeight: 600 }}>Invoice No:</td><td style={{ paddingBottom: '4px', fontWeight: 700, color: '#0f172a' }}>{invoiceNo}</td></tr>
                    <tr><td style={{ paddingRight: '12px', fontWeight: 600 }}>Date:</td><td style={{ fontWeight: 700, color: '#0f172a' }}>{receiptDate}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Billed To Section */}
            <div className="receipt-billed-to" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <div>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', margin: 0 }}>Received From</h3>
                <div className="receipt-student-name" style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{primaryStudent?.name || 'Unknown Student'}</div>
                <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                  Registration No: <span className="receipt-breakable" style={{ fontWeight: 600, color: '#1e293b' }}>{primaryStudent?.manualRegsiName || primaryStudent?.regNo || 'N/A'}</span><br/>
                  Room No: <span style={{ fontWeight: 600, color: '#1e293b' }}>{primaryStudent?.roomNo || 'N/A'}</span><br/>
                  Payment Mode: <span style={{ fontWeight: 600, color: '#1e293b' }}>{paymentMode || 'N/A'}</span>
                  {paymentMethod && <><br/>Gateway Method: <span className="receipt-breakable" style={{ fontWeight: 600, color: '#1e293b' }}>{paymentMethod.toUpperCase()}</span></>}
                  {razorpayOrderId && <><br/>Razorpay Order ID: <span className="receipt-breakable" style={{ fontWeight: 600, color: '#1e293b' }}>{razorpayOrderId}</span></>}
                  {razorpayPaymentId && <><br/>Razorpay Payment ID: <span className="receipt-breakable" style={{ fontWeight: 600, color: '#1e293b' }}>{razorpayPaymentId}</span></>}
                  {paymentStatus && <><br/>Payment Status: <span className="receipt-breakable" style={{ fontWeight: 600, color: '#1e293b' }}>{paymentStatus.toUpperCase()}</span></>}
                  {refNo && <><br/>Transaction Ref: <span className="receipt-breakable" style={{ fontWeight: 600, color: '#1e293b' }}>{refNo}</span></>}
                  {notesText && <><br/>Notes: <span className="receipt-breakable" style={{ fontWeight: 600, color: '#1e293b' }}>{notesText}</span></>}
                </div>
              </div>
            </div>

            {/* Fee Breakup Table */}
            <div className="receipt-fee-block" style={{ marginBottom: '40px' }}>
              <div className="receipt-fee-scroll" role="region" aria-label="Fee breakup table, scroll horizontally to see all columns" tabIndex={0}>
              <table className="receipt-fee-table" aria-label="Fee breakup" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr className="print-exact" style={{ background: '#f8fafc' }}>
                    <th style={{ border: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {feesList.map((f: any) => (
                    <tr key={f.id}>
                      <td style={{ border: '1px solid #e2e8f0', padding: '16px', fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>
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
                              <div key={idx} style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginTop: idx > 0 ? '2px' : '0' }}>
                                {trimmed}{extraText}
                              </div>
                            );
                          })}
                      </td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '16px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                        {f.transactionType}
                      </td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>
                        ₹{f.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="print-exact" style={{ background: '#f8fafc' }}>
                    <td className="receipt-total-label" colSpan={2} style={{ border: '1px solid #e2e8f0', padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Total Amount Paid
                    </td>
                    <td className="receipt-total-amount" style={{ border: '1px solid #e2e8f0', padding: '16px', fontSize: '18px', color: '#16a34a', fontWeight: 800, textAlign: 'right' }}>
                      ₹{totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>

            {/* Signature & Footer Section */}
            <div className="receipt-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px' }}>
              <div style={{ maxWidth: '300px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6 }}>
                  <strong style={{ color: '#334155' }}>Note:</strong> This is a computer generated receipt. Payments are non-refundable and subject to hostel terms and conditions. Keep this receipt for your records.
                </div>
              </div>
              <div className="receipt-signature" style={{ textAlign: 'center' }}>
                <div className="receipt-signature-line" style={{ width: '180px', borderBottom: '1px solid #94a3b8', marginBottom: '8px', height: '40px' }}></div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Authorized Signatory</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{settings.hostelName}</div>
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
