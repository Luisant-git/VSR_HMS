import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { FeeReceiptNotification, formatFeeTypeName, formatPaymentModeName } from './whatsapp.service';

// @ts-ignore
const QRCode = require('qrcode-terminal/vendor/QRCode');
// @ts-ignore
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

export interface StudentIdCardData {
  id?: string | null;
  uuid?: string | null;
  name: string;
  regNo?: string | null;
  manualRegsiName?: string | null;
  roomNo?: any;
  bedNo?: string | null;
  bloodGroup?: string | null;
  collegeName?: string | null;
  mobileNo?: string | null;
  dateOfJoining?: string | Date | null;
  foodType?: string | null;
  biometricId?: string | null;
  photoUrl?: string | null;
  hostelName?: string | null;
}

/**
 * Generates an exact PDF receipt buffer matching the official hostel receipt design.
 */
export function generateReceiptPdfBuffer(data: FeeReceiptNotification): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Fee Receipt - ${data.invoiceNo || 'Receipt'}`,
          Author: data.hostelName || "SEA SINDU QUEEN'S PARADISE",
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      // 1. Watermark "PAID"
      doc.save();
      doc.rotate(-30, { origin: [pageWidth / 2, 450] });
      doc
        .font('Helvetica-Bold')
        .fontSize(90)
        .fillColor('#000000', 0.04)
        .text('PAID', pageWidth / 2 - 140, 420, { align: 'center' });
      doc.restore();

      // Top devotional text
      doc
        .font('Times-Italic')
        .fontSize(11)
        .fillColor('#222222')
        .text('Mayanur Sri Sellandiamman Thunai', margin, 40, {
          width: contentWidth,
          align: 'center',
        });

      doc.moveDown(0.4);

      // Main Hostel Title
      const hostelTitle = (data.hostelName || "SEA SINDU QUEEN'S PARADISE").toUpperCase();
      doc
        .font('Times-Bold')
        .fontSize(20)
        .fillColor('#000000')
        .text(hostelTitle, margin, doc.y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 1.2,
        });

      doc.moveDown(0.2);

      // Subtitle
      doc
        .font('Times-Bold')
        .fontSize(12)
        .fillColor('#111111')
        .text('( LADIES HOSTEL )', margin, doc.y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 1,
        });

      doc.moveDown(0.2);

      // Address
      const address =
        data.address ||
        '291/2G2, Katheri Village, Komarapalayam, Salem DT - 638 183';
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#333333')
        .text(address, margin, doc.y, {
          width: contentWidth,
          align: 'center',
        });

      doc.moveDown(0.5);

      // Decorative divider
      const lineY = doc.y;
      doc.strokeColor('#222222').lineWidth(0.75);
      doc.moveTo(margin + 50, lineY).lineTo(margin + contentWidth - 50, lineY).stroke();

      // Small diamond in center
      const centerX = margin + contentWidth / 2;
      doc
        .save()
        .translate(centerX, lineY)
        .rotate(45)
        .rect(-3, -3, 6, 6)
        .fillColor('#000000')
        .fill()
        .restore();

      doc.moveDown(0.8);

      // Title: FEES RECEIPT
      doc
        .font('Times-Bold')
        .fontSize(13)
        .fillColor('#000000')
        .text('FEES RECEIPT', margin, doc.y + 4, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 2,
        });

      doc.moveDown(0.6);

      // Metadata split row
      const metaY = doc.y;
      const receiptNo = data.receiptNo || '1';
      const invoiceNo = data.invoiceNo || '—';
      const receiptDate = data.receiptDate || new Date().toLocaleDateString('en-GB');
      const phone = data.hostelPhone || '80126 55555';

      // Left Meta
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Receipt No: ', margin, metaY, { continued: true });
      doc.font('Helvetica').text(receiptNo);
      doc.font('Helvetica-Bold').fontSize(10).text('Invoice No: ', margin, metaY + 16, { continued: true });
      doc.font('Helvetica').text(invoiceNo);

      // Right Meta
      const rightX = margin + contentWidth - 180;
      doc.font('Helvetica-Bold').fontSize(10).text('Date : ', rightX, metaY, { continued: true });
      doc.font('Helvetica').text(receiptDate);
      doc.font('Helvetica-Bold').fontSize(10).text('Phone : ', rightX, metaY + 16, { continued: true });
      doc.font('Helvetica').text(phone);

      const afterMetaY = metaY + 38;

      // Two side-by-side tables
      const colWidth = (contentWidth - 16) / 2;
      const leftColX = margin;
      const rightColX = margin + colWidth + 16;

      // Headers for columns
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555').text('RECEIVED FROM', leftColX, afterMetaY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555').text('PAYMENT DETAILS', rightColX, afterMetaY);

      // Student Name
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000').text(data.studentName || 'Student', leftColX, afterMetaY + 12);

      const tableStartY = afterMetaY + 30;

      // Draw table row helper
      const drawInfoTable = (
        startX: number,
        startY: number,
        width: number,
        rows: Array<[string, string, string?]>
      ) => {
        let currentY = startY;
        const labelWidth = width * 0.45;
        const valWidth = width * 0.55;
        const rowHeight = 18;

        // Table header
        doc.fillColor('#f5f5f5').rect(startX, currentY, width, rowHeight).fill();
        doc.strokeColor('#dddddd').lineWidth(0.5).rect(startX, currentY, width, rowHeight).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#333333');
        doc.text('FIELD', startX + 6, currentY + 5, { width: labelWidth - 12 });
        doc.text('DETAILS', startX + labelWidth + 6, currentY + 5, { width: valWidth - 12 });

        currentY += rowHeight;

        // Table rows
        for (const [label, val, customColor] of rows) {
          doc.strokeColor('#eeeeee').lineWidth(0.5).rect(startX, currentY, width, rowHeight).stroke();
          doc.font('Helvetica').fontSize(8.5).fillColor('#333333');
          doc.text(label, startX + 6, currentY + 5, { width: labelWidth - 12 });
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(customColor || '#000000');
          doc.text(val, startX + labelWidth + 6, currentY + 5, { width: valWidth - 12 });
          currentY += rowHeight;
        }

        return currentY;
      };

      const leftRows: Array<[string, string]> = [
        ['Registration No', data.regNo || 'N/A'],
        ['Room No', data.roomNo || 'N/A'],
        ['Billing Month', data.billingMonth || '—'],
        ['Due Date', data.dueDate || '—'],
      ];

      const rightRows: Array<[string, string, string?]> = [
        ['Payment Mode', formatPaymentModeName(data.paymentMode)],
        ['Gateway Method', data.gatewayMethod || 'Manual'],
        ['Payment Status', 'PAID', '#16a34a'],
        [
          'Pending Balance',
          `Rs. ${Number(data.pendingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        ],
      ];

      const leftEnd = drawInfoTable(leftColX, tableStartY, colWidth, leftRows);
      const rightEnd = drawInfoTable(rightColX, tableStartY, colWidth, rightRows);

      const feeTableStartY = Math.max(leftEnd, rightEnd) + 16;

      // Fee Breakdown Table
      const col1Width = contentWidth * 0.52;
      const col2Width = contentWidth * 0.22;
      const col3Width = contentWidth * 0.26;
      const headerH = 20;

      // Header
      doc.fillColor('#f5f5f5').rect(margin, feeTableStartY, contentWidth, headerH).fill();
      doc.strokeColor('#000000').lineWidth(0.75).rect(margin, feeTableStartY, contentWidth, headerH).stroke();

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
      doc.text('DESCRIPTION', margin + 8, feeTableStartY + 6, { width: col1Width - 16, align: 'left' });
      doc.text('CATEGORY', margin + col1Width + 8, feeTableStartY + 6, { width: col2Width - 16, align: 'center' });
      doc.text('AMOUNT', margin + col1Width + col2Width + 8, feeTableStartY + 6, { width: col3Width - 16, align: 'right' });

      let currentFeeY = feeTableStartY + headerH;

      const items =
        data.items && data.items.length > 0
          ? data.items
          : [{ description: 'Hostel Fee', type: 'FEE', amount: data.amount }];

      for (const item of items) {
        const itemH = 22;
        doc.strokeColor('#000000').lineWidth(0.5).rect(margin, currentFeeY, contentWidth, itemH).stroke();

        doc.font('Helvetica').fontSize(9).fillColor('#000000');
        doc.text(item.description || formatFeeTypeName(item.type), margin + 8, currentFeeY + 6, {
          width: col1Width - 16,
          align: 'left',
        });

        doc.font('Helvetica').fontSize(8.5).fillColor('#444444');
        doc.text(item.type || 'FEE', margin + col1Width + 8, currentFeeY + 6, {
          width: col2Width - 16,
          align: 'center',
        });

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
        doc.text(
          `Rs. ${Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          margin + col1Width + col2Width + 8,
          currentFeeY + 6,
          { width: col3Width - 16, align: 'right' },
        );

        currentFeeY += itemH;
      }

      const totalPaid = Number(data.amount || 0);
      const discount = Number(data.discountAmount || 0);
      const gross = Number(data.grossAmount || totalPaid + discount);

      // If discount applied, show subtotal rows
      if (discount > 0) {
        const subRowH = 20;
        // Total Before Discount
        doc.strokeColor('#000000').lineWidth(0.5).rect(margin, currentFeeY, contentWidth, subRowH).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
        doc.text('Total Before Discount', margin + 8, currentFeeY + 6, {
          width: col1Width + col2Width - 16,
          align: 'right',
        });
        doc.text(
          `Rs. ${gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          margin + col1Width + col2Width + 8,
          currentFeeY + 6,
          { width: col3Width - 16, align: 'right' },
        );
        currentFeeY += subRowH;

        // Discount
        doc.strokeColor('#000000').lineWidth(0.5).rect(margin, currentFeeY, contentWidth, subRowH).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
        doc.text('Discount', margin + 8, currentFeeY + 6, {
          width: col1Width + col2Width - 16,
          align: 'right',
        });
        doc.fillColor('#dc2626').text(
          `-Rs. ${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          margin + col1Width + col2Width + 8,
          currentFeeY + 6,
          { width: col3Width - 16, align: 'right' },
        );
        currentFeeY += subRowH;
      }

      // TOTAL AMOUNT PAID ROW
      const totalRowH = 24;
      doc.strokeColor('#000000').lineWidth(1).rect(margin, currentFeeY, contentWidth, totalRowH).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      doc.text('TOTAL AMOUNT PAID', margin + 8, currentFeeY + 7, {
        width: col1Width + col2Width - 16,
        align: 'right',
        characterSpacing: 0.5,
      });
      doc.fontSize(11).text(
        `Rs. ${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        margin + col1Width + col2Width + 8,
        currentFeeY + 6,
        { width: col3Width - 16, align: 'right' },
      );

      currentFeeY += totalRowH + 12;

      // Notes
      if (data.notes) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('NOTES: ', margin, currentFeeY, { continued: true });
        doc.font('Helvetica').fontSize(9).fillColor('#333333').text(data.notes);
        currentFeeY += 20;
      }

      // Footer
      const footerY = Math.max(currentFeeY + 20, 750);
      doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(margin + 40, footerY).lineTo(margin + contentWidth - 40, footerY).stroke();

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Payment Successful', margin, footerY + 10, {
        width: contentWidth,
        align: 'center',
      });

      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#555555').text('This is a computer generated receipt. No signature is required.', margin, footerY + 24, {
        width: contentWidth,
        align: 'center',
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates an official vector PDF ID card matching the CR80 card specifications.
 */
export async function generateIdCardPdfBuffer(data: StudentIdCardData): Promise<Buffer> {
  // 1. Resolve photo buffer if provided
  let photoBuffer: Buffer | null = null;
  if (data.photoUrl) {
    try {
      if (data.photoUrl.startsWith('data:image/')) {
        const commaIdx = data.photoUrl.indexOf(',');
        if (commaIdx !== -1) {
          photoBuffer = Buffer.from(data.photoUrl.slice(commaIdx + 1), 'base64');
        }
      } else {
        let relativePath = data.photoUrl;
        const match = data.photoUrl.match(/\/uploads\/(.+)$/);
        if (match) {
          relativePath = match[1];
        }
        const candidatePaths = [
          path.join(process.cwd(), 'uploads', relativePath),
          path.join(process.cwd(), '..', 'uploads', relativePath),
          path.join(process.cwd(), 'backend', 'uploads', relativePath),
          path.join(process.cwd(), relativePath),
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            photoBuffer = fs.readFileSync(p);
            break;
          }
        }
      }
      if (photoBuffer && photoBuffer.length > 0) {
        photoBuffer = await sharp(photoBuffer)
          .resize(160, 160, { fit: 'cover' })
          .jpeg({ quality: 90 })
          .toBuffer();
      }
    } catch {
      photoBuffer = null;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [240, 380],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Student ID Card - ${data.name || 'Student'}`,
          Author: data.hostelName || "SEA SINDU QUEEN'S PARADISE",
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Outer border with rounded corners
      doc.roundedRect(3, 3, 234, 374, 10).lineWidth(1).strokeColor('#e2e8f0').stroke();

      // Top banner
      doc.save();
      doc.roundedRect(3, 3, 234, 58, 10).fill('#0ea5e9');
      doc.rect(3, 40, 234, 21).fill('#0ea5e9');
      doc.restore();

      // Hostel title and subtitle
      const title = (data.hostelName || "SEA SINDU QUEEN'S PARADISE").toUpperCase();
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#ffffff')
        .text(title, 10, 14, { width: 220, align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor('#e0f2fe')
        .text('STUDENT IDENTITY CARD', 10, 27, { width: 220, align: 'center', characterSpacing: 1 });

      // Circular photo / avatar
      const photoCenterX = 120;
      const photoCenterY = 68;
      const radius = 26;

      doc.circle(photoCenterX, photoCenterY, radius + 2).fillAndStroke('#ffffff', '#cbd5e1');

      if (photoBuffer) {
        doc.save();
        doc.circle(photoCenterX, photoCenterY, radius).clip();
        doc.image(photoBuffer, photoCenterX - radius, photoCenterY - radius, {
          width: radius * 2,
          height: radius * 2,
        });
        doc.restore();
      } else {
        doc.circle(photoCenterX, photoCenterY, radius).fill('#f1f5f9');
        const initial = (data.name || 'S').trim().charAt(0).toUpperCase();
        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor('#64748b')
          .text(initial, photoCenterX - 15, photoCenterY - 7, { width: 30, align: 'center' });
      }

      // Name & RegNo
      const displayRegNo = data.manualRegsiName || data.regNo || data.id || 'N/A';
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#0f172a')
        .text(data.name || 'Student', 10, 101, { width: 220, align: 'center' });
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#0284c7')
        .text(displayRegNo, 10, 116, { width: 220, align: 'center' });

      // Field display data
      const displayRoom =
        typeof data.roomNo === 'object' && data.roomNo !== null
          ? data.roomNo.value || data.roomNo.id || data.roomNo.roomNumber || 'N/A'
          : data.roomNo || 'N/A';
      const roomWithBed =
        data.bedNo && data.bedNo !== 'N/A' ? `${displayRoom} (${data.bedNo})` : String(displayRoom);

      const rawMobile = data.mobileNo ? String(data.mobileNo).replace(/\D/g, '') : '';
      const displayMobile = rawMobile ? `+91 ******${rawMobile.slice(-4)}` : 'N/A';

      let displayDate = new Date().toLocaleDateString('en-GB');
      if (data.dateOfJoining) {
        const d = new Date(data.dateOfJoining);
        if (!isNaN(d.getTime())) {
          displayDate = d.toLocaleDateString('en-GB');
        } else {
          displayDate = String(data.dateOfJoining);
        }
      }

      const displayFood = data.foodType || 'N/A';
      const foodBadgeColor =
        displayFood === 'Veg' ? '#16a34a' : displayFood === 'Non-Veg' ? '#dc2626' : '#64748b';

      const leftX = 18;
      const rightX = 125;
      const colW = 95;

      const drawField = (
        label: string,
        val: string,
        x: number,
        y: number,
        isBadge = false,
        badgeColor = '#dc2626',
        valColor = '#1e293b',
      ) => {
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748b').text(label.toUpperCase(), x, y);
        if (isBadge) {
          doc.roundedRect(x, y + 9, 55, 13, 3).fill(badgeColor);
          doc
            .font('Helvetica-Bold')
            .fontSize(7.5)
            .fillColor('#ffffff')
            .text(val, x, y + 11.5, { width: 55, align: 'center' });
        } else {
          doc
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .fillColor(valColor)
            .text(val, x, y + 9, { width: colW, lineBreak: false });
        }
      };

      drawField('Room No', roomWithBed, leftX, 135);
      drawField('Blood Group', data.bloodGroup || 'N/A', rightX, 135, false, undefined, '#dc2626');

      // College
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748b').text('COLLEGE', leftX, 162);
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#1e293b')
        .text(data.collegeName || 'N/A', leftX, 171, { width: 200, lineBreak: false });

      drawField('Mobile', displayMobile, leftX, 189);
      drawField('Joined', displayDate, rightX, 189);

      drawField('Food Type', displayFood.toUpperCase(), leftX, 216, true, foodBadgeColor);
      drawField('Bio ID', data.biometricId || 'N/A', rightX, 216);

      // Separator before QR
      doc.strokeColor('#e2e8f0').lineWidth(0.75).moveTo(18, 244).lineTo(222, 244).stroke();

      // Vector QR Code
      const qrValue = `http://localhost:5173/id/${data.uuid || data.id || displayRegNo}`;
      const qr = new QRCode(0, QRErrorCorrectLevel.M);
      qr.addData(qrValue);
      qr.make();
      const count = qr.getModuleCount();
      const qrSize = 65;
      const cellSize = qrSize / count;
      const qrX = (240 - qrSize) / 2;
      const qrY = 252;

      doc.fillColor('#000000');
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            doc.rect(qrX + c * cellSize, qrY + r * cellSize, cellSize + 0.1, cellSize + 0.1).fill();
          }
        }
      }

      doc
        .font('Helvetica')
        .fontSize(6)
        .fillColor('#94a3b8')
        .text('Scan to Verify Student ID', 10, 323, { width: 220, align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(5.5)
        .fillColor('#cbd5e1')
        .text('Official Hosteller Document', 10, 355, { width: 220, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
