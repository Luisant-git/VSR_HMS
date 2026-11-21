import PDFDocument from 'pdfkit';
import { FeeReceiptNotification, formatFeeTypeName, formatPaymentModeName } from './whatsapp.service';

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
