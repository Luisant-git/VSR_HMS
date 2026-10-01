import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { FeesAPI } from '../api/fees.api';
import { toast } from 'react-toastify';

interface CollectPaymentModalProps {
  fee?: any;
  fees?: any[];
  onClose: () => void;
  onSuccess: (paidItems?: any[], paymentMode?: string) => void;
  isStudentMode?: boolean;
}

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({ fee, fees, onClose, onSuccess, isStudentMode }) => {
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{ updatedItems: any[], paymentMode: string } | null>(null);

  const itemsToPay = fees && fees.length > 0 ? fees : fee ? [fee] : [];
  const totalAmount = itemsToPay.reduce((acc: number, f: any) => acc + f.amount, 0);
  const primaryStudent = itemsToPay.length > 0 ? itemsToPay[0].student : null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await Promise.all(itemsToPay.map(async (f: any) => {
        let finalDesc = f.description || '';
        let ref = referenceNumber;
        if (isStudentMode && !ref) {
          ref = 'TXN' + Math.floor(Math.random() * 10000000000).toString();
        }
        if (ref) finalDesc += ` | Ref: ${ref}`;
        if (notes) finalDesc += ` | Notes: ${notes}`;

        await FeesAPI.update(f.id, {
          status: 'COMPLETED',
          paymentMode,
          description: finalDesc
        });
      }));
      toast.success(`Payment collected successfully for ${itemsToPay.length} item(s)!`);
      const updatedItems = itemsToPay.map(f => ({ ...f, status: 'COMPLETED', paymentMode }));
      
      // Instead of calling onSuccess immediately, we show the success confirmation state
      setPaymentSuccessData({ updatedItems, paymentMode });
    } catch (e: any) {
      toast.error('Failed to collect payment: ' + e.message);
    }
    setIsSubmitting(false);
  };

  if (itemsToPay.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: 'white', padding: '0', borderRadius: '12px', width: '500px', maxWidth: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        
        {paymentSuccessData ? (
          <div style={{ padding: '50px 30px', textAlign: 'center' }}>
            <CheckCircle size={64} color="#16a34a" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>Payment Successful!</h2>
            <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '30px' }}>Your payment of ₹{totalAmount.toLocaleString('en-IN')} was processed successfully.</p>
            <button 
              onClick={() => onSuccess(paymentSuccessData.updatedItems, paymentSuccessData.paymentMode)} 
              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}
            >
              View Receipt
            </button>
          </div>
        ) : (
          <>
            <div style={{ background: isStudentMode ? '#2563eb' : '#198754', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{isStudentMode ? 'Complete Online Payment' : 'Collect Fee Payment'}</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>
              {primaryStudent?.name || 'Unknown'} ({primaryStudent?.regNo || 'N/A'}){primaryStudent?.roomNo ? ` - Room ${primaryStudent.roomNo}` : ''}
            </div>
            {primaryStudent?.advance !== undefined && (
              <div style={{ fontSize: '13px', color: '#198754', fontWeight: 600, marginTop: '2px' }}>
                Advance Balance: ₹{primaryStudent.advance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            )}
            
            {/* Fee Breakup Table (The split up alone) */}
            <div style={{ marginTop: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: '#e2e8f0', fontSize: '12px', fontWeight: 700, color: '#475569' }}>FEE BREAKUP</div>
              <div style={{ padding: '8px 12px' }}>
                {itemsToPay.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '13px' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{f.transactionType}</span>
                      <span style={{ color: '#64748b', marginLeft: '8px', fontSize: '12px' }}>({f.description || 'Fee'})</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>₹{f.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#dc3545' }}>
                  <span>TOTAL PAYABLE</span>
                  <span>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Amount to Collect</label>
              <input type="text" value={`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} disabled style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8f9fa', color: '#64748b', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Mode <span style={{color: '#dc3545'}}>*</span></label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', outline: 'none' }}>
                <option value="UPI">UPI / QR (GPay / PhonePe / Paytm)</option>
                {!isStudentMode && <option value="CASH">Cash</option>}
                <option value="CARD">Credit / Debit Card</option>
                <option value="NETBANKING">Net Banking</option>
                {!isStudentMode && <option value="BANK_TRANSFER">Bank Transfer</option>}
              </select>
            </div>
            
            {!isStudentMode && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Transaction Reference Number</label>
                  <input type="text" placeholder="UPI Ref ID, Cheque #, or Cash Voucher" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Notes</label>
                  <input type="text" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '15px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', background: '#6c757d', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} style={{ padding: '8px 16px', borderRadius: '6px', background: isStudentMode ? '#2563eb' : '#198754', color: 'white', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
            {isSubmitting ? 'Processing...' : (isStudentMode ? `Pay ₹${totalAmount.toLocaleString('en-IN')} Now` : 'Mark as Paid')}
          </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
