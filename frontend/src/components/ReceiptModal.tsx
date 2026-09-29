import React from 'react';
import { X, Printer } from 'lucide-react';

interface ReceiptModalProps {
  fee: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ fee, onClose }) => {
  if (!fee) return null;

  const ymStr = new Date(fee.createdAt).toISOString().slice(0,7).replace('-', '');
  const purpose = fee.transactionType.replace(/[^a-zA-Z]/g, '').substring(0,3).toUpperCase();
  const studentStr = fee.student?.regNo || 'UNKN';
  const invoiceNo = `INV-${purpose}-${ymStr}-${studentStr}`;
  
  const dateStr = new Date(fee.createdAt).toISOString().slice(0,10).replace(/-/g, '');
  const count = parseInt(fee.id.substring(0, 8), 16) % 10000;
  const receiptNo = `REC-${dateStr}-${count.toString().padStart(4, '0')}`;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #receipt-printable-area, #receipt-printable-area * { visibility: visible; }
            #receipt-printable-area { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
            .no-print { display: none !important; }
          }
        `}
      </style>
      <div id="receipt-printable-area" style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '600px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden' }}>
        
        <div style={{ padding: '40px', border: '1px solid #1e293b', margin: '20px', borderRadius: '8px', position: 'relative' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>HOSTEL RESIDENCY</h2>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Official Money Receipt • Authorized Voucher</div>
            <div style={{ width: '100%', height: '1px', background: '#e2e8f0', marginTop: '20px' }}></div>
          </div>

          {/* Top Details */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '13px' }}>
            <div>
              <div style={{ marginBottom: '6px' }}><span style={{ fontWeight: 700, color: '#0f172a' }}>Invoice No:</span> <span style={{ color: '#334155', fontWeight: 500 }}>{invoiceNo}</span></div>
              <div style={{ marginBottom: '6px' }}><span style={{ fontWeight: 700, color: '#0f172a' }}>Receipt No:</span> <span style={{ color: '#334155', fontWeight: 500 }}>{receiptNo}</span></div>
              <div><span style={{ fontWeight: 700, color: '#0f172a' }}>Date:</span> <span style={{ color: '#334155', fontWeight: 500 }}>{new Date(fee.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Category:</span> 
                <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, marginLeft: '6px', color: '#475569' }}>{fee.transactionType}</span>
              </div>
              <div><span style={{ fontWeight: 700, color: '#0f172a' }}>Mode:</span> <span style={{ color: '#334155', fontWeight: 600 }}>{fee.paymentMode || 'N/A'}</span></div>
            </div>
          </div>

          {/* Core Info Box */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '30px', background: '#fafafa' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', fontSize: '13px' }}>
              <div style={{ color: '#64748b' }}>Received From:</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{fee.student?.name || 'Unknown'} <span style={{ color: '#64748b', fontWeight: 500 }}>({fee.student?.regNo || fee.student?.id || 'N/A'})</span></div>
              
              <div style={{ color: '#64748b' }}>Room Allotment:</div>
              <div style={{ color: '#334155', fontWeight: 500 }}>Room {fee.student?.roomNo || fee.student?.room || 'N/A'}</div>

              <div style={{ color: '#64748b' }}>Reference / Trans ID:</div>
              <div style={{ color: '#334155', fontWeight: 500 }}>
                {(() => {
                  const refId = fee.description?.includes('Ref:') ? fee.description.split('Ref:')[1]?.trim() : '';
                  return (refId === '' || refId === '-') ? 'Direct / Cash' : refId;
                })()}
              </div>

              <div style={{ color: '#64748b' }}>Notes / Purpose:</div>
              <div style={{ color: '#334155', fontWeight: 500 }}>{fee.description?.split('|')[0]?.trim() || 'Hostel accommodation & amenities'}</div>
            </div>
          </div>

          {/* Total Amount */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Total Amount Paid:</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a' }}>₹{fee.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11px', color: '#94a3b8' }}>
            <div>
              <div>Computer Generated Voucher</div>
              <div>Issued on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px', fontWeight: 600, color: '#475569', marginTop: '30px', width: '120px' }}>Warden Signature</div>
              <div style={{ color: '#94a3b8' }}>Authorized Seal</div>
            </div>
          </div>

        </div>

        {/* Actions (No Print) */}
        <div className="no-print" style={{ padding: '15px 20px', background: '#f8f9fa', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ background: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <X size={16} /> Close
          </button>
          <button onClick={() => window.print()} style={{ background: '#0d6efd', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <Printer size={16} /> Print Receipt
          </button>
        </div>

      </div>
    </div>
  );
};
