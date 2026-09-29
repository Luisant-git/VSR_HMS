import React, { useState } from 'react';
import { X } from 'lucide-react';
import { FeesAPI } from '../api/fees.api';
import { toast } from 'react-toastify';

interface CollectPaymentModalProps {
  fee: any;
  onClose: () => void;
  onSuccess: () => void;
}


export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({ fee, onClose, onSuccess }) => {
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let finalDesc = fee.description;
      if (referenceNumber) finalDesc += ` | Ref: ${referenceNumber}`;
      if (notes) finalDesc += ` | Notes: ${notes}`;

      await FeesAPI.update(fee.id, {
        status: 'COMPLETED',
        paymentMode,
        description: finalDesc
      });
      toast.success('Payment collected successfully!');
      onSuccess();
    } catch (e: any) {
      toast.error('Failed to collect payment: ' + e.message);
    }
    setIsSubmitting(false);
  };

  if (!fee) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', padding: '0', borderRadius: '12px', width: '450px', maxWidth: '90%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
        <div style={{ background: '#198754', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Collect Fee Payment</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
        </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>{fee.student?.name || 'Unknown'} ({fee.student?.regNo || 'N/A'}){fee.student?.roomNo ? ` - Room ${fee.student.roomNo}` : ''}</div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>Due: ₹{fee.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Amount to Collect</label>
              <input type="text" value={`₹${fee.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} disabled style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8f9fa', color: '#64748b', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Mode <span style={{color: '#dc3545'}}>*</span></label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', outline: 'none' }}>
                <option value="UPI">UPI / QR (GPay / PhonePe / Paytm)</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Transaction Reference Number</label>
              <input type="text" placeholder="UPI Ref ID, Cheque #, or Cash Voucher" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Notes</label>
              <input type="text" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '15px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', background: '#6c757d', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} style={{ padding: '8px 16px', borderRadius: '6px', background: '#198754', color: 'white', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
            {isSubmitting ? 'Processing...' : 'Mark as Paid'}
          </button>
        </div>
      </div>
    </div>
  );
};
