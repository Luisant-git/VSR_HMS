import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { FeesAPI } from '../api/fees.api';
import { StudentAPI } from '../api/student.api';
import { toast } from 'react-toastify';

interface CollectPaymentModalProps {
  fee?: any;
  fees?: any[];
  /**
   * Confirmed payments already made against the outstanding invoices passed in
   * `fee` / `fees`. The modal shows only the remaining balance, and the backend
   * re-validates it again before confirming a new payment.
   */
  outstandingPaid?: number;
  onClose: () => void;
  onSuccess: (paidItems?: any[], paymentMode?: string) => void;
  isStudentMode?: boolean;
}

const isOutstandingFee = (fee: any) =>
  /^\s*outstanding\b/i.test(fee?.description || '');

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({ fee, fees, outstandingPaid = 0, onClose, onSuccess, isStudentMode }) => {
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{ updatedItems: any[], paymentMode: string } | null>(null);

  const itemsToPay = fees && fees.length > 0 ? fees : fee ? [fee] : [];
  const primaryStudent = itemsToPay.length > 0 ? itemsToPay[0].student : null;

  // Current-month invoices stay exactly as before. Previous outstanding
  // invoices are consolidated into a single OUTSTANDING item.
  const outstandingItems = itemsToPay.filter(isOutstandingFee);
  const currentItems = itemsToPay.filter((f: any) => !isOutstandingFee(f));

  // Original outstanding invoice amounts minus payments already confirmed by
  // the backend. Invoices are never mutated, so this is the only safe way to
  // show the true remaining balance.
  const outstandingBalance = roundMoney(
    Math.max(
      0,
      outstandingItems.reduce(
        (sum: number, f: any) => sum + (Number(f.amount) || 0),
        0,
      ) - (Number(outstandingPaid) || 0),
    ),
  );

  // A stable id makes retries / double-submits idempotent on the backend.
  const [requestId] = useState(
    () => `OP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const [months, setMonths] = useState(1);
  // When previous outstanding dues exist, start on the OUTSTANDING item and
  // leave current-month rent / mess / EB unchecked. Paying an outstanding
  // amount must not mark current invoices as paid.
  const hasOutstandingItems = outstandingItems.length > 0 && outstandingBalance > 0;
  const [outstandingSelected, setOutstandingSelected] = useState<boolean>(hasOutstandingItems);
  const [outstandingAmountInput, setOutstandingAmountInput] = useState('');
  const [feeStates, setFeeStates] = useState<Record<string, { selected: boolean }>>(() => {
    const initialState: Record<string, { selected: boolean }> = {};
    currentItems.forEach((f: any) => {
      initialState[f.id] = { selected: !hasOutstandingItems };
    });
    return initialState;
  });

  const activeItemsToPay = currentItems.filter(f => feeStates[f.id]?.selected !== false);

  const getMultiplier = (type: string) => {
    const t = (type || '').toUpperCase().trim();
    if (t !== 'RENT' && t !== 'MESS') return 1;
    return months;
  };

  const currentMonthTotal = activeItemsToPay.reduce((acc: number, f: any) => acc + f.amount * getMultiplier(f.transactionType), 0);

  // Outstanding amount validation
  const outstandingInputTrimmed = outstandingAmountInput.trim();
  let outstandingError: string | null = null;
  if (outstandingSelected && outstandingInputTrimmed !== '') {
    const parsed = Number(outstandingInputTrimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      outstandingError = 'Enter an amount greater than ₹0.';
    } else if (parsed > outstandingBalance + 0.001) {
      outstandingError = `Amount cannot exceed the remaining outstanding balance of ₹${outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;
    }
  }

  const outstandingAmount =
    outstandingSelected && !outstandingError && outstandingInputTrimmed !== ''
      ? Math.min(roundMoney(Number(outstandingInputTrimmed)), outstandingBalance)
      : 0;

  const hasOutstandingPayment = outstandingAmount > 0;
  const totalAmount = roundMoney(currentMonthTotal + outstandingAmount);
  const remainingOutstanding = roundMoney(Math.max(0, outstandingBalance - outstandingAmount));

  const getMonthNames = (count: number, startDesc: string) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let startMonthIndex = new Date().getMonth();
    let startYear = new Date().getFullYear();

    const yearMatch = startDesc.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      startYear = parseInt(yearMatch[1], 10);
    }

    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    for (let i = 0; i < fullMonthNames.length; i++) {
      if (startDesc.includes(fullMonthNames[i])) {
        startMonthIndex = i;
        break;
      }
    }

    if (count === 1) {
      return `${monthNames[startMonthIndex]} ${startYear}`;
    }

    const endMonthIndex = (startMonthIndex + count - 1) % 12;
    const endYear = startYear + Math.floor((startMonthIndex + count - 1) / 12);

    return `${monthNames[startMonthIndex]} - ${monthNames[endMonthIndex]} ${endYear}`;
  };

  const handleOutstandingAmountChange = (value: string) => {
    if (value === '') {
      setOutstandingAmountInput('');
      return;
    }
    // Only non-negative amounts with at most two decimal places are allowed.
    if (!/^\d*\.?\d{0,2}$/.test(value)) return;
    setOutstandingAmountInput(value);
  };

  const handleSubmit = async () => {
    if (outstandingSelected && outstandingError) {
      toast.error(outstandingError);
      return;
    }
    if (activeItemsToPay.length === 0 && !hasOutstandingPayment) {
      toast.error('Please select at least one fee or enter an outstanding amount.');
      return;
    }

    const studentId =
      primaryStudent?.id ||
      primaryStudent?.uuid ||
      itemsToPay[0]?.studentId ||
      itemsToPay[0]?.student?.id;

    if (hasOutstandingPayment && !studentId) {
      toast.error('Unable to identify the student for this payment.');
      return;
    }

    setIsSubmitting(true);
    try {
      let studentUpdates: any = {};

      const effectiveRef = isStudentMode && !referenceNumber
        ? 'TXN' + Math.floor(Math.random() * 10000000000).toString()
        : referenceNumber;

      await Promise.all(activeItemsToPay.map(async (f: any) => {
        let finalDesc = f.description || '';
        const ref = effectiveRef;
        if (ref) finalDesc += ` | Ref: ${ref}`;
        if (notes) finalDesc += ` | Notes: ${notes}`;
        const currentMultiplier = getMultiplier(f.transactionType);
        if (currentMultiplier > 1) {
          const coveredMonths = getMonthNames(currentMultiplier, f.description || '');
          finalDesc += ` | Paid for ${currentMultiplier} Months (${coveredMonths})`;
        }

        const tType = (f.transactionType || '').toUpperCase();
        if (tType.includes('RENT') || tType.includes('MESS')) {
          let startMonthIndex = new Date().getMonth();
          let startYear = new Date().getFullYear();
          const yearMatch = (f.description || '').match(/\b(20\d{2})\b/);
          if (yearMatch) startYear = parseInt(yearMatch[1], 10);
          const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          for (let i = 0; i < fullMonthNames.length; i++) {
            if ((f.description || '').includes(fullMonthNames[i])) {
              startMonthIndex = i;
              break;
            }
          }

          const endMonthIndex = startMonthIndex + currentMultiplier - 1;
          const endYear = startYear + Math.floor(endMonthIndex / 12);
          const finalEndMonth = endMonthIndex % 12;

          // Use noon of the last day of the month to avoid timezone shifts
          const paidUntil = new Date(endYear, finalEndMonth + 1, 0, 12, 0, 0);

          if (tType.includes('RENT')) {
             studentUpdates.rentPaidUntil = paidUntil;
          }
          if (tType.includes('MESS')) {
             studentUpdates.messPaidUntil = paidUntil;
          }
        }

        await FeesAPI.update(f.id, {
          status: 'COMPLETED',
          paymentMode,
          amount: f.amount * currentMultiplier,
          description: finalDesc
        });
      }));

      // Apply the outstanding payment through the dedicated backend endpoint.
      // The backend re-validates the amount against the live balance inside a
      // serializable transaction before anything is changed.
      let outstandingRecords: any[] = [];
      if (hasOutstandingPayment) {
        const response = await FeesAPI.payOutstanding({
          studentId,
          amount: outstandingAmount,
          paymentMode,
          referenceNumber: effectiveRef || undefined,
          notes: notes || undefined,
          requestId,
        });

        const studentForReceipt = primaryStudent || itemsToPay[0]?.student;
        outstandingRecords = (response?.payments || []).map((p: any) => ({
          ...p,
          student: p.student || studentForReceipt,
        }));
      }

      if (primaryStudent?.id && Object.keys(studentUpdates).length > 0) {
        await StudentAPI.update(primaryStudent.id, studentUpdates);
      }

      const paidCount = activeItemsToPay.length + (hasOutstandingPayment ? 1 : 0);
      toast.success(`Payment collected successfully for ${paidCount} item(s)!`);

      const currentUpdatedItems = activeItemsToPay.map(f => {
        const currentMultiplier = getMultiplier(f.transactionType);
        const covered = currentMultiplier > 1 ? getMonthNames(currentMultiplier, f.description || '') : '';
        return {
          ...f,
          status: 'COMPLETED',
          paymentMode,
          amount: f.amount * currentMultiplier,
          description: (f.description || '') + (currentMultiplier > 1 ? ` | Paid for ${currentMultiplier} Months (${covered})` : '')
        };
      });

      // Instead of calling onSuccess immediately, we show the success confirmation state
      setPaymentSuccessData({ updatedItems: [...currentUpdatedItems, ...outstandingRecords], paymentMode });
    } catch (e: any) {
      toast.error('Failed to collect payment: ' + e.message);
    }
    setIsSubmitting(false);
  };

  const monthSourceDesc = currentItems[0]?.description || itemsToPay[0]?.description || '';
  const currentMonthStr = itemsToPay.length > 0 ? getMonthNames(1, monthSourceDesc) : '';
  const coveredPeriodStr = itemsToPay.length > 0 ? getMonthNames(months, monthSourceDesc) : '';

  const selectedTypes = activeItemsToPay.map(f => {
    const t = (f.transactionType || '').toUpperCase();
    if (t.includes('RENT')) return 'Rent';
    if (t.includes('MESS')) return 'Mess';
    if (t.includes('FINE')) return 'Fine';
    if (t.includes('ADVANCE')) return 'Advance';
    return f.transactionType;
  });
  if (hasOutstandingPayment) selectedTypes.push('Outstanding');
  const uniqueTypes = Array.from(new Set(selectedTypes));
  const summaryText = uniqueTypes.length > 0 ? `Selected: ${uniqueTypes.join(' + ')}` : 'No fees selected';

  const selectAll = () => setFeeStates(prev => {
    const next = { ...prev };
    Object.keys(next).forEach(k => next[k].selected = true);
    return next;
  });

  const selectRentOnly = () => setFeeStates(prev => {
    const next = { ...prev };
    currentItems.forEach(f => {
      next[f.id] = { selected: (f.transactionType || '').toUpperCase().includes('RENT') };
    });
    return next;
  });

  const selectMessOnly = () => setFeeStates(prev => {
    const next = { ...prev };
    currentItems.forEach(f => {
      next[f.id] = { selected: (f.transactionType || '').toUpperCase().includes('MESS') };
    });
    return next;
  });

  const outstandingInvalid = outstandingSelected && outstandingInputTrimmed !== '' && outstandingError !== null;
  const canSubmit =
    !isSubmitting &&
    !outstandingInvalid &&
    (activeItemsToPay.length > 0 || hasOutstandingPayment);

  if (itemsToPay.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#ffffff', padding: '0', borderRadius: '16px', width: '520px', maxWidth: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

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
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {primaryStudent?.name || 'Unknown'} <span style={{ color: '#64748b', fontWeight: 500, fontSize: '15px' }}>({primaryStudent?.manualRegsiName || primaryStudent?.regNo || 'N/A'})</span>
                </h2>
                <div style={{ fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Room: {primaryStudent?.roomNo || 'N/A'}</span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <span>Current: {currentMonthStr}</span>
                </div>
              </div>
              <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto' }}>

              {/* Duration Section */}
              {currentItems.some(f => (f.transactionType || '').toUpperCase().trim() === 'RENT' || (f.transactionType || '').toUpperCase().trim() === 'MESS') && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Duration</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={months}
                      onChange={e => setMonths(Number(e.target.value))}
                      style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', outline: 'none', fontSize: '15px', fontWeight: 500, color: '#1e293b', appearance: 'none', cursor: 'pointer', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                        <option key={m} value={m}>{m} Month{m > 1 ? 's' : ''} ({getMonthNames(m, monthSourceDesc)})</option>
                      ))}
                    </select>
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5l3 3 3-3" /></svg>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                    Period: <span style={{ color: '#0f172a', fontWeight: 600 }}>{coveredPeriodStr}</span>
                  </div>
                </div>
              )}

              {/* Fees List */}
              <div style={{ marginBottom: '24px' }}>
                {currentItems.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Fees to Pay</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={selectAll} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>[All]</button>
                        <button onClick={selectRentOnly} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>[Rent Only]</button>
                        <button onClick={selectMessOnly} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>[Mess]</button>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      {currentItems.map((f, index) => {
                        const state = feeStates[f.id] || { selected: true };
                        const currentMultiplier = getMultiplier(f.transactionType);
                        const isLast = index === currentItems.length - 1;
                        const calculatedAmount = f.amount * currentMultiplier;

                        return (
                          <div key={f.id} onClick={() => setFeeStates(prev => ({ ...prev, [f.id]: { selected: !state.selected } }))} style={{ display: 'flex', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #e2e8f0', background: state.selected ? '#ffffff' : '#f8fafc', cursor: 'pointer', transition: 'background 0.2s', alignItems: 'flex-start' }}>
                            <div style={{ marginRight: '12px', marginTop: '2px' }}>
                              <input
                                type="checkbox"
                                checked={state.selected}
                                onChange={(e) => { e.stopPropagation(); setFeeStates(prev => ({ ...prev, [f.id]: { selected: e.target.checked } }))}}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, color: state.selected ? '#0f172a' : '#64748b', fontSize: '14px' }}>
                                  {f.transactionType} {state.selected ? '' : <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Unchecked)</span>}
                                </span>
                                <span style={{ fontWeight: 700, color: state.selected ? '#0f172a' : '#94a3b8', fontSize: '14px', textDecoration: state.selected ? 'none' : 'line-through' }}>
                                  ₹{calculatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div style={{ color: '#64748b', fontSize: '13px' }}>
                                {currentMultiplier > 1 ? `${currentMultiplier} months × ₹${f.amount.toLocaleString('en-IN')}` : (f.description || 'One-time fee')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* OUTSTANDING item: one consolidated previous balance */}
                {outstandingBalance > 0 && (
                  <div style={{ marginTop: currentItems.length > 0 ? '12px' : '0' }}>
                    {currentItems.length === 0 && (
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding</label>
                    )}
                    <div style={{ border: '1px solid #fde68a', borderRadius: '8px', overflow: 'hidden', background: '#fffbeb' }}>
                      <div
                        onClick={() => setOutstandingSelected(prev => !prev)}
                        style={{ display: 'flex', padding: '12px 16px', alignItems: 'flex-start', cursor: 'pointer', background: outstandingSelected ? '#ffffff' : '#fffbeb', transition: 'background 0.2s' }}
                      >
                        <div style={{ marginRight: '12px', marginTop: '2px' }}>
                          <input
                            type="checkbox"
                            checked={outstandingSelected}
                            onChange={(e) => { e.stopPropagation(); setOutstandingSelected(e.target.checked); }}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#d97706' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: outstandingSelected ? '#0f172a' : '#64748b', fontSize: '14px', letterSpacing: '0.3px' }}>
                              OUTSTANDING {outstandingSelected ? '' : <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Unchecked)</span>}
                            </span>
                            <span style={{ fontWeight: 700, color: outstandingSelected ? '#b45309' : '#94a3b8', fontSize: '14px' }}>
                              ₹{outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div style={{ color: '#92400e', fontSize: '13px' }}>
                            Previous unpaid balance
                          </div>
                        </div>
                      </div>

                      {outstandingSelected && (
                        <div style={{ padding: '12px 16px 16px', borderTop: '1px dashed #fde68a', background: '#ffffff' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Enter Amount to Pay</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 600, fontSize: '15px' }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              max={outstandingBalance}
                              step="0.01"
                              inputMode="decimal"
                              value={outstandingAmountInput}
                              onChange={(e) => handleOutstandingAmountChange(e.target.value)}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '12px 12px 12px 28px', border: `1px solid ${outstandingError ? '#f87171' : '#cbd5e1'}`, borderRadius: '8px', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              Enter any amount up to ₹{outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 600 }}>
                              This reduces only previous outstanding dues. Current Rent / Mess / EB stay unpaid unless ticked above.
                            </span>
                          </div>

                          {outstandingError ? (
                            <div style={{ marginTop: '8px', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                              {outstandingError}
                            </div>
                          ) : (
                            <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569' }}>
                              Remaining after payment: <span style={{ color: '#0f172a', fontWeight: 700 }}>₹{remainingOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: !isStudentMode ? '16px' : '0' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode <span style={{color: '#ef4444'}}>*</span></label>
                    <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', outline: 'none', fontSize: '14px', color: '#1e293b' }}>
                      <option value="UPI">UPI / QR (GPay / PhonePe / Paytm)</option>
                      {!isStudentMode && <option value="CASH">Cash</option>}
                      <option value="CARD">Credit / Debit Card</option>
                      <option value="NETBANKING">Net Banking</option>
                      {!isStudentMode && <option value="BANK_TRANSFER">Bank Transfer</option>}
                    </select>
                  </div>
                  {!isStudentMode && (
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reference #</label>
                      <input type="text" placeholder="UPI Ref ID or Cheque #" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }} />
                    </div>
                  )}
                </div>

                {!isStudentMode && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>
                    <input type="text" placeholder="Optional notes (e.g. Paid by father)" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }} />
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div style={{ background: '#f8fafc', padding: '24px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Payable</div>
                  <div style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{summaryText}</div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{ width: '100%', padding: '16px', borderRadius: '10px', background: !canSubmit ? '#94a3b8' : (isStudentMode ? '#2563eb' : '#10b981'), color: 'white', border: 'none', cursor: !canSubmit ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: canSubmit ? '0 4px 6px -1px rgba(16, 185, 129, 0.2), 0 2px 4px -1px rgba(16, 185, 129, 0.1)' : 'none', transition: 'all 0.2s' }}
              >
                {isSubmitting ? 'Processing Payment...' : `Proceed to Pay ₹${totalAmount.toLocaleString('en-IN')}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
