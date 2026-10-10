import React, { useState, useEffect } from 'react';
import { FileText, Save, Maximize2, Minimize2, Filter, Printer, Download, X } from 'lucide-react';
import { toast } from 'react-toastify';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import { CanteenAPI } from '../api/canteen.api';
import { SearchableSelect } from './SearchableSelect';
import { Pagination } from './Pagination';

interface CanteenSupplierPaymentsProps {
  suppliers: any[];
  paymentModes: any[];
}

export const CanteenSupplierPayments: React.FC<CanteenSupplierPaymentsProps> = ({ suppliers, paymentModes }) => {
  const [formData, setFormData] = useState({
    paymentNo: 'Generating...',
    date: new Date().toISOString().substring(0, 10),
    supplierId: 0,
    amount: '',
    paymentType: '',
    reference: '',
    remarks: ''
  });

  const [currentBalance, setCurrentBalance] = useState(0);
  const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [billFilter, setBillFilter] = useState<'Unpaid' | 'Cleared' | 'All'>('Unpaid');
  
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    fetchNextPaymentNo();
    loadHistory();
  }, []);

  const fetchNextPaymentNo = async () => {
    try {
      const res = await CanteenAPI.getNextSupplierPaymentNo();
      setFormData(prev => ({ ...prev, paymentNo: res.paymentNo }));
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await CanteenAPI.getSupplierPayments();
      setPaymentsHistory(data);
    } catch (err) {
      console.error(err);
    }
    setHistoryLoading(false);
  };

  // When supplier changes, fetch balance and unpaid bills
  useEffect(() => {
    const fetchBalance = async () => {
      if (formData.supplierId && formData.supplierId !== 0 && formData.supplierId !== '0') {
        try {
          const res = await CanteenAPI.getSupplierBalance(formData.supplierId.toString());
          setCurrentBalance(res.balance || 0);
          
          const billsRes = await CanteenAPI.getSupplierUnpaidBills(formData.supplierId.toString());
          setUnpaidBills(billsRes || []);
          setShowBreakdown(true); // Automatically show bills when supplier is selected
        } catch (error) {
          console.error(error);
          setCurrentBalance(0);
          setUnpaidBills([]);
          setShowBreakdown(false);
        }
      } else {
        setCurrentBalance(0);
        setUnpaidBills([]);
        setShowBreakdown(false);
      }
    };
    fetchBalance();
  }, [formData.supplierId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierId) {
      toast.error('Supplier is required');
      return;
    }
    if (!formData.paymentType) {
      toast.error('Payment Type is required');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate breakdown for remarks JSON
      let remainingForBills = Number(formData.amount) || 0;
      const billsPaid = [];
      const billsToProcess = unpaidBills.filter(b => b.pending >= 0.01);
      
      for (const bill of billsToProcess) {
        const payingNow = remainingForBills > 0 ? Math.min(bill.pending, remainingForBills) : 0;
        
        billsPaid.push({
          entryNo: bill.entryNo,
          date: bill.date,
          total: bill.total,
          received: bill.received,
          pending: bill.pending,
          payingNow: payingNow,
          balanceAfter: bill.pending - payingNow
        });
        
        if (payingNow > 0) {
           remainingForBills -= payingNow;
        }
      }
      
      const overallBalanceAfter = currentBalance - Number(formData.amount);
      const finalRemarks = JSON.stringify({ 
        userRemarks: formData.remarks, 
        bills: billsPaid,
        balanceAfter: overallBalanceAfter
      });

      await CanteenAPI.createSupplierPayment({
        ...formData,
        supplierId: formData.supplierId.toString(),
        paymentType: formData.paymentType,
        amount: Number(formData.amount),
        remarks: finalRemarks
      });
      
      toast.success('Payment recorded successfully!');
      
      // Reset form
      setFormData({
        paymentNo: 'Generating...',
        date: new Date().toISOString().substring(0, 10),
        supplierId: 0,
        amount: '',
        paymentType: '',
        reference: '',
        remarks: ''
      });
      fetchNextPaymentNo();
      loadHistory();
      setCurrentBalance(0);
      setUnpaidBills([]);
      
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    }
    setIsSubmitting(false);
  };

  // Filter history
  const filteredHistory = paymentsHistory.filter((p: any) => {
    if (filterSupplier && p.supplierId !== filterSupplier) return false;
    if (filterFromDate && new Date(p.date) < new Date(filterFromDate)) return false;
    if (filterToDate && new Date(p.date) > new Date(filterToDate)) return false;
    if (filterToDate && new Date(p.date) > new Date(filterToDate)) return false;
    return true;
  });

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + pageSize);

  const handleExportExcel = () => {
    const exportData: any[] = filteredHistory.map((p: any) => {
      let parsedRemarks = p.remarks || '';
      try {
        if (p.remarks && p.remarks.startsWith('{')) {
          const parsed = JSON.parse(p.remarks);
          if (parsed.userRemarks !== undefined) {
             parsedRemarks = parsed.userRemarks;
          }
        }
      } catch (e) {
        // Not JSON
      }

      const d = new Date(p.date);
      const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

      return {
        'Payment No': p.paymentNo,
        'Date': formattedDate,
        'Supplier': p.supplier?.name || 'Unknown',
        'Payment Type': p.paymentType || 'Unknown',
        'Amount Paid': p.amount,
        'Reference': p.reference || '',
        'Remarks': parsedRemarks
      };
    });

    const totalAmount = exportData.reduce((sum: number, row: any) => sum + (row['Amount Paid'] || 0), 0);
    exportData.push({
      'Payment No': 'TOTAL',
      'Date': '',
      'Supplier': '',
      'Payment Type': '',
      'Amount Paid': totalAmount,
      'Reference': '',
      'Remarks': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths to prevent visual overflow
    ws['!cols'] = [
      { wch: 20 }, // Payment No
      { wch: 12 }, // Date
      { wch: 30 }, // Supplier
      { wch: 15 }, // Payment Type
      { wch: 15 }, // Amount Paid
      { wch: 20 }, // Reference
      { wch: 50 }  // Remarks
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments History");
    XLSX.writeFile(wb, "Supplier_Payments_History.xlsx");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div style={{ padding: '0px' }}>
      {/* Dark overlay when expanded */}
      {isTableExpanded && (
        <div 
          onClick={() => setIsTableExpanded(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40, transition: 'opacity 0.2s' }} 
        />
      )}

      {/* Top Header */}
      {!isTableExpanded && (
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 700, color: '#E11D48', margin: 0 }}>
              <FileText size={24} /> SUPPLIER PAYMENTS & PAYOUTS
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '13px' }}>
              Record vendor credit payouts and supplier payments
            </p>
          </div>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: isTableExpanded ? '1fr' : '1fr 1fr', gap: '20px' }}>
        {/* Left Side - New Entry Form */}
        {!isTableExpanded && (
          <div style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="#334155" />
              <h2 style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>NEW SUPPLIER PAYMENT ENTRY</h2>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Payment No</label>
                  <input
                    readOnly
                    value={formData.paymentNo}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '13px', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2563EB', marginBottom: '4px' }}>Supplier Name (Searchable) *</label>
                <Select
                  options={[
                    { value: 0, label: 'Type supplier name / mobile number...' },
                    ...suppliers.map((s: any) => ({
                      value: s.id,
                      label: `${s.name} - ${s.phone || 'No Phone'}`
                    }))
                  ]}
                  value={formData.supplierId ? { value: formData.supplierId, label: suppliers.find((s: any) => s.id === formData.supplierId)?.name || 'Select...' } : null}
                  onChange={(val: any) => setFormData({ ...formData, supplierId: val?.value || 0 })}
                  styles={{
                    control: (base: any) => ({ ...base, minHeight: '38px', borderColor: '#CBD5E1', borderRadius: '4px' }),
                    singleValue: (base: any) => ({ ...base, color: '#000000', fontWeight: 'bold' }),
                    input: (base: any) => ({ ...base, color: '#000000' }),
                    option: (base: any, state: any) => ({
                      ...base,
                      color: state.isSelected ? '#ffffff' : '#000000',
                      backgroundColor: state.isSelected ? '#3B82F6' : base.backgroundColor,
                    })
                  }}
                />
              </div>

              {formData.supplierId !== 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '12px 16px', borderBottom: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="#64748B" /> Outstanding Summary
                      </span>
                      <button 
                        type="button"
                        onClick={() => setShowBreakdown(!showBreakdown)}
                        style={{ border: '1px solid #E11D48', color: '#E11D48', backgroundColor: 'white', padding: '6px 12px', borderRadius: '4px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                      >
                        Bill-by-Bill Breakdown
                      </button>
                    </div>
                    
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>Over All Outstanding Balance</span>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#E11D48' }}>
                          {formatCurrency(currentBalance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {showBreakdown && (
                    <div style={{ border: '1px solid #E11D48', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white' }}>
                      <div style={{ backgroundColor: '#E11D48', color: 'white', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={14} /> BILL-BY-BILL BREAKDOWN</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select 
                            value={billFilter}
                            onChange={(e: any) => setBillFilter(e.target.value)}
                            style={{ color: '#E11D48', backgroundColor: 'white', borderRadius: '4px', padding: '2px 8px', outline: 'none', fontSize: '10px' }}
                          >
                            <option value="Unpaid">Unpaid Bills</option>
                            <option value="Cleared">Cleared Bills</option>
                            <option value="All">All Bills</option>
                          </select>
                          <span style={{ backgroundColor: 'white', color: '#E11D48', padding: '2px 8px', borderRadius: '12px', fontSize: '10px' }}>
                            {unpaidBills.filter(b => billFilter === 'All' ? true : billFilter === 'Cleared' ? b.pending < 0.01 : b.pending >= 0.01).length} Bills
                          </span>
                        </div>
                      </div>
                      <div style={{ maxHeight: '250px', overflowY: 'auto', overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
                          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Entry / Inv No</th>
                              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Bill Date</th>
                              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>Bill Total</th>
                              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#10B981', textAlign: 'right' }}>Pur. Returns</th>
                              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>Paid Amount</th>
                              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#E11D48', textAlign: 'right' }}>Pending Balance</th>
                              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#3B82F6', textAlign: 'right' }}>Paying Now</th>
                              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#059669', textAlign: 'right' }}>Balance After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              let remainingForBills = Number(formData.amount) || 0;
                              const displayedBills = unpaidBills.filter(b => billFilter === 'All' ? true : billFilter === 'Cleared' ? b.pending < 0.01 : b.pending >= 0.01);
                              
                              return displayedBills.length > 0 ? displayedBills.map((bill, idx) => {
                                const currentPending = bill.pending;
                                const payingNow = currentPending > 0 ? Math.min(currentPending, remainingForBills) : 0;
                                remainingForBills = Math.max(0, remainingForBills - payingNow);
                                const balanceAfter = currentPending - payingNow;
                                const isCleared = currentPending === 0;
                                
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: isCleared ? '#ECFDF5' : 'transparent' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1E293B' }}>{bill.entryNo}</td>
                                    <td style={{ padding: '8px 12px', color: '#475569' }}>{new Date(bill.date).toISOString().split('T')[0]}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>{formatCurrency(bill.total)}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#10B981', fontWeight: 500 }}>{formatCurrency(0)}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#10B981' }}>{formatCurrency(bill.received)}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#E11D48' }}>{formatCurrency(bill.pending)}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{formatCurrency(payingNow)}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(balanceAfter)}</td>
                                  </tr>
                                );
                              }) : (
                                <tr>
                                  <td colSpan={8} style={{ padding: '16px 12px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>No {billFilter.toLowerCase()} bills found.</td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#E11D48', marginBottom: '4px' }}>Amount Pay Now *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '15px', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>Remaining Balance After Payment</label>
                  <div style={{ width: '100%', padding: '8px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px', fontSize: '13px', fontWeight: 700, color: '#1E293B', boxSizing: 'border-box' }}>
                    {formatCurrency(currentBalance - (Number(formData.amount) || 0))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>PAYMENT TYPE *</label>
                  <select
                    required
                    value={formData.paymentType}
                    onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '13px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box' }}
                  >
                    <option value="">Select Type</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit">Credit</option>
                    <option value="DD">DD</option>
                    <option value="NEFT">NEFT</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Reference / Cheque No</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Optional for Cash..."
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Remarks (Optional)</label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Optional remarks..."
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ backgroundColor: '#E11D48', color: 'white', padding: '8px 16px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                >
                  <Save size={14} /> SAVE PAYMENT
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Right Side - History Table */}
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #E2E8F0', 
          borderRadius: isTableExpanded ? '12px' : '8px', 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column', 
          boxShadow: isTableExpanded ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' : '0 1px 2px rgba(0,0,0,0.05)',
          ...(isTableExpanded ? { position: 'fixed', inset: '32px', zIndex: 50 } : {})
        }}>
          <div style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="#334155" />
              <h2 style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>PAYMENTS HISTORY</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ backgroundColor: '#E11D48', color: 'white', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                {filteredHistory.length} Payments
              </div>
              <button 
                type="button" 
                onClick={() => setIsTableExpanded(!isTableExpanded)}
                style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginLeft: '4px' }}
                title={isTableExpanded ? "Minimize Table" : "View Full Table"}
              >
                {isTableExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>

          <div style={{ padding: '16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>Show</label>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', cursor: 'pointer', backgroundColor: 'white' }}>
                <option value={10}>10 Entries</option>
                <option value={25}>25 Entries</option>
                <option value={50}>50 Entries</option>
                <option value={100}>100 Entries</option>
              </select>
            </div>
            <div style={{ width: '250px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>Supplier</label>
              <SearchableSelect
                options={suppliers.map((s: any) => ({ value: s.id, label: s.name }))}
                value={filterSupplier}
                onChange={setFilterSupplier}
                placeholder="All Suppliers"
              />
            </div>
            <div style={{ width: '130px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>From Date</label>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ width: '130px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>To Date</label>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(filterSupplier || filterFromDate || filterToDate) && (
                <button 
                  type="button"
                  onClick={() => {
                    setFilterSupplier('');
                    setFilterFromDate('');
                    setFilterToDate('');
                  }}
                  style={{ padding: '8px', borderRadius: '6px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', height: '34px', boxSizing: 'border-box' }}
                  title="Clear Filters"
                >
                  <X size={16} />
                </button>
              )}
              <button 
                type="button" 
                onClick={handleExportExcel}
                style={{ backgroundColor: '#1D4ED8', color: 'white', border: 'none', borderRadius: '6px', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                title="Export Excel"
              >
                <Download size={16} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#F8FAFC' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#1E293B', color: 'white', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '8px 12px', borderRight: '1px solid #444' }}>Payment No</th>
                  <th style={{ padding: '8px 12px', borderRight: '1px solid #334155' }}>Date</th>
                  <th style={{ padding: '8px 12px', borderRight: '1px solid #334155' }}>Supplier</th>
                  <th style={{ padding: '8px 12px', borderRight: '1px solid #334155' }}>Type</th>
                  <th style={{ padding: '8px 12px', borderRight: '1px solid #334155' }}>Pending Balance</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#64748B' }}>Loading history...</td></tr>
                ) : paginatedHistory.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#64748B' }}>No payment records found.</td></tr>
                ) : (
                  paginatedHistory.map((p: any, idx: number) => {
                    let userRemarks = p.remarks;
                    let billsPaid: any[] = [];
                    let balanceAfter: number | null = null;
                    if (p.remarks && p.remarks.startsWith('{"userRemarks"')) {
                      try {
                        const parsed = JSON.parse(p.remarks);
                        userRemarks = parsed.userRemarks;
                        billsPaid = parsed.bills || [];
                        if (parsed.balanceAfter !== undefined) {
                          balanceAfter = parsed.balanceAfter;
                        }
                      } catch(e) {}
                    }
                    const hasBills = billsPaid.length > 0;
                    const isExpanded = expandedPaymentId === p.id;
                    
                    return (
                      <React.Fragment key={p.id}>
                        <tr 
                          onClick={() => hasBills ? setExpandedPaymentId(isExpanded ? null : p.id) : null}
                          style={{ 
                            borderBottom: '1px solid #E2E8F0', 
                            backgroundColor: idx % 2 === 0 ? 'white' : '#F8FAFC',
                            cursor: hasBills ? 'pointer' : 'default'
                          }}
                        >
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #E5E7EB', color: '#475569', fontWeight: 'bold' }}>
                            {p.paymentNo}
                          </td>
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #E2E8F0', color: '#64748B' }}>{new Date(p.date).toISOString().split('T')[0]}</td>
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #E2E8F0', fontWeight: 500, color: '#334155' }}>{p.supplier?.name}</td>
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #E2E8F0' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: '#64748B', color: 'white' }}>
                              {p.paymentType || '-'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #E2E8F0', color: '#0F172A', fontWeight: 600 }}>
                            {balanceAfter !== null ? formatCurrency(balanceAfter) : '-'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#E11D48' }}>{formatCurrency(p.amount)}</td>
                        </tr>
                        {isExpanded && hasBills && (
                          <tr>
                            <td colSpan={6} style={{ padding: '0', backgroundColor: '#F1F5F9' }}>
                              <div style={{ padding: '12px', borderBottom: '2px solid #E2E8F0' }}>
                                <table style={{ width: '100%', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '4px', overflow: 'hidden', borderCollapse: 'collapse' }}>
                                  <thead style={{ backgroundColor: '#E11D48', color: 'white' }}>
                                    <tr>
                                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Entry / Inv No</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Bill Date</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Bill Total</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Pur. Returns</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Paid Amount</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Pending Balance</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Paying Now</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Balance After</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {billsPaid.map((b: any, bIdx: number) => (
                                      <tr key={bIdx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#1E293B' }}>{b.entryNo}</td>
                                        <td style={{ padding: '6px 8px', color: '#475569' }}>{new Date(b.date).toISOString().split('T')[0]}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>{formatCurrency(b.total)}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>₹0.00</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#10B981' }}>{formatCurrency(b.received)}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#E11D48' }}>{formatCurrency(b.pending)}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{formatCurrency(b.payingNow)}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(b.balanceAfter)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div style={{ padding: '8px 12px', borderTop: '1px solid #E2E8F0', backgroundColor: 'white' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredHistory.length / pageSize)}
              totalItems={filteredHistory.length}
              itemsPerPage={pageSize}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setPageSize}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
