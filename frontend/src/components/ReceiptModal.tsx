import React from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  fee: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ fee, onClose }) => {
  if (!fee) return null;

  // Handle both grouped fee objects and raw single fees for backward compatibility
  const isGrouped = fee.isGrouped;
  const feesList = isGrouped ? fee.feesList : [fee];
  const firstFee = feesList[0];
  const primaryStudent = isGrouped ? fee.student : firstFee?.student;
  
  const totalAmount = isGrouped ? fee.totalAmount : firstFee?.amount;
  const paymentMode = isGrouped ? fee.paymentMode : firstFee?.paymentMode;
  const description = isGrouped ? (feesList.find((f: any) => f.description)?.description || '') : firstFee?.description;

  const ymStr = new Date(firstFee?.createdAt || Date.now()).toISOString().slice(0,7).replace('-', '');
  const purpose = isGrouped && feesList.length > 1 ? 'MUL' : (firstFee?.transactionType || 'FEE').replace(/[^a-zA-Z]/g, '').substring(0,3).toUpperCase();
  const studentStr = primaryStudent?.regNo || 'UNKN';
  const invoiceNo = `INV-${purpose}-${ymStr}-${studentStr}`;
  
  const dateStr = new Date(firstFee?.createdAt || Date.now()).toISOString().slice(0,10).replace(/-/g, '');
  const count = parseInt((firstFee?.id || '0').substring(0, 8), 16) % 10000 || Math.floor(Math.random() * 9999);
  const receiptNo = `REC-${dateStr}-${count.toString().padStart(4, '0')}`;
  const receiptDate = new Date(fee.paidDate || fee.createdAt || firstFee?.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #receipt-printable-area, #receipt-printable-area * { visibility: visible; }
            #receipt-printable-area { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
            .no-print { display: none !important; }
            .print-exact { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>
      <div id="receipt-printable-area" style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '750px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '95vh', fontFamily: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        
        {/* Top Accent Bar */}
        <div className="print-exact" style={{ height: '8px', background: 'linear-gradient(90deg, #1e293b, #334155)', width: '100%' }}></div>

        <div style={{ padding: '40px 50px', flex: 1, overflowY: 'auto', position: 'relative' }}>
          
          {/* PAID Watermark */}
          <div className="print-exact" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', fontSize: '120px', fontWeight: 900, color: 'rgba(22, 163, 74, 0.05)', zIndex: 0, pointerEvents: 'none', letterSpacing: '10px' }}>
            PAID
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '2px solid #f1f5f9', paddingBottom: '30px' }}>
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>VSR HOSTEL</h1>
                <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>123 University Road, City Campus<br/>State, ZIP 12345<br/>Phone: +91 98765 43210<br/>GSTIN: 22AAAAA0000A1Z5</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '4px', lineHeight: 1, marginBottom: '15px' }}>RECEIPT</div>
                <table style={{ fontSize: '13px', textAlign: 'right', marginLeft: 'auto', color: '#334155' }}>
                  <tbody>
                    <tr><td style={{ paddingBottom: '4px', paddingRight: '12px', fontWeight: 600 }}>Receipt No:</td><td style={{ paddingBottom: '4px', fontWeight: 700, color: '#0f172a' }}>{receiptNo}</td></tr>
                    <tr><td style={{ paddingBottom: '4px', paddingRight: '12px', fontWeight: 600 }}>Invoice No:</td><td style={{ paddingBottom: '4px', fontWeight: 700, color: '#0f172a' }}>{invoiceNo}</td></tr>
                    <tr><td style={{ paddingRight: '12px', fontWeight: 600 }}>Date:</td><td style={{ fontWeight: 700, color: '#0f172a' }}>{receiptDate}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Billed To Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <div>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', margin: 0 }}>Received From</h3>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{primaryStudent?.name || 'Unknown Student'}</div>
                <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                  Registration No: <span style={{ fontWeight: 600, color: '#1e293b' }}>{primaryStudent?.regNo || 'N/A'}</span><br/>
                  Room No: <span style={{ fontWeight: 600, color: '#1e293b' }}>{primaryStudent?.roomNo || 'N/A'}</span><br/>
                  Payment Mode: <span style={{ fontWeight: 600, color: '#1e293b' }}>{paymentMode || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Fee Breakup Table */}
            <div style={{ marginBottom: '40px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr className="print-exact" style={{ background: '#f8fafc' }}>
                    <th style={{ border: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {feesList.map((f: any, idx: number) => (
                    <tr key={f.id}>
                      <td style={{ border: '1px solid #e2e8f0', padding: '16px', fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>
                        {f.description?.split('|')[0]?.trim() || 'Hostel Fee'}
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
                    <td colSpan={2} style={{ border: '1px solid #e2e8f0', padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Total Amount Paid
                    </td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '16px', fontSize: '18px', color: '#16a34a', fontWeight: 800, textAlign: 'right' }}>
                      ₹{totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signature & Footer Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px' }}>
              <div style={{ maxWidth: '300px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6 }}>
                  <strong style={{ color: '#334155' }}>Note:</strong> This is a computer generated receipt. Payments are non-refundable and subject to hostel terms and conditions. Keep this receipt for your records.
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '180px', borderBottom: '1px solid #94a3b8', marginBottom: '8px', height: '40px' }}></div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Authorized Signatory</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>VSR Hostel Management</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions (No Print) */}
        <div className="no-print" style={{ padding: '20px 40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button onClick={onClose} style={{ background: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', padding: '10px 24px', borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <X size={18} /> Close
          </button>
          <button onClick={() => window.print()} style={{ background: '#0f172a', border: 'none', cursor: 'pointer', padding: '10px 24px', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)' }}>
            <Printer size={18} /> Print Document
          </button>
        </div>

      </div>
    </div>
  );
};
