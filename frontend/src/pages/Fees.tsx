import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IndianRupee, Search, Filter, FileText, Download, Wallet, Plus, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { FeesAPI } from '../api/fees.api';
import { ReceiptModal } from '../components/ReceiptModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';

const formatInvoiceNumber = (fee: any) => {
  const ymStr = new Date(fee.createdAt).toISOString().slice(0,7).replace('-', '');
  const purpose = fee.transactionType.replace(/[^a-zA-Z]/g, '').substring(0,3).toUpperCase();
  const studentStr = fee.student?.regNo || 'UNKN';
  return `INV-${purpose}-${ymStr}-${studentStr}`;
};

const Fees = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentParam = searchParams.get('student');

  const [filter, setFilter] = useState('ALL');
  const [fees, setFees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>({ 
    value: studentParam || 'ALL', 
    label: studentParam ? `${studentParam}` : '-- All Students --' 
  });
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [feeToCollect, setFeeToCollect] = useState<any>(null);

  const fetchFees = () => {
    FeesAPI.findAll().then(data => {
      setFees(data);
    }).catch(console.error);
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const studentOptions = useMemo(() => {
    const students = new Map();
    fees.forEach(fee => {
      if (fee.student) {
        students.set(fee.student.regNo, {
          value: fee.student.regNo,
          label: `${fee.student.name} (${fee.student.regNo})`
        });
      }
    });
    return [{ value: 'ALL', label: '-- All Students --' }, ...Array.from(students.values())];
  }, [fees]);

  useEffect(() => {
    if (studentParam && studentOptions.length > 1) {
      const option = studentOptions.find((opt: any) => opt.value === studentParam);
      if (option) {
        setSelectedStudent(option);
      }
    }
  }, [studentParam, studentOptions]);

  const feeIdParam = searchParams.get('feeId');
  useEffect(() => {
    if (feeIdParam && fees.length > 0 && !feeToCollect) {
      const fee = fees.find(f => f.id === feeIdParam);
      if (fee && fee.status === 'PENDING') {
        setFeeToCollect(fee);
      }
    }
  }, [feeIdParam, fees, feeToCollect]);

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base, padding: '2px', borderRadius: '8px', borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1', boxShadow: 'none', '&:hover': { borderColor: 'var(--sidebar-active)' }, fontSize: '13px', cursor: 'pointer', minWidth: '220px'
    }),
    option: (base: any, state: any) => ({
      ...base, fontSize: '13px', backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white', color: state.isSelected ? 'white' : '#334155', cursor: 'pointer', padding: '10px 14px'
    })
  };

  const totalInvoiced = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const totalCollected = fees.filter(f => f.status === 'COMPLETED').reduce((sum, fee) => sum + fee.amount, 0);
  const pendingFees = fees.filter(f => f.status === 'PENDING').reduce((sum, fee) => sum + fee.amount, 0);

  const filteredFees = fees.filter(fee => {
    let match = true;
    if (filter === 'UNPAID') match = fee.status === 'PENDING';
    if (filter === 'PAID') match = fee.status === 'COMPLETED';
    if (filter === 'PARTIAL') match = fee.status === 'PARTIAL';
    
    if (selectedStudent.value !== 'ALL' && fee.student?.regNo !== selectedStudent.value) match = false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      match = match && (
        formatInvoiceNumber(fee).toLowerCase().includes(q) ||
        fee.transactionType.toLowerCase().includes(q) ||
        (fee.student?.name || '').toLowerCase().includes(q) ||
        (fee.student?.regNo || '').toLowerCase().includes(q)
      );
    }
    return match;
  });

  const closePaymentModal = () => {
    setFeeToCollect(null);
    if (feeIdParam) {
      searchParams.delete('feeId');
      navigate(`?${searchParams.toString()}`, { replace: true });
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Fees Paid / Unpaid"
        subtitle="Track hostel rent, mess bills, pending dues, and issue payment receipts"
        rightContent={
          <>
            <button onClick={() => setFilter('PAID')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'white', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <FileSpreadsheet size={16} color="#64748b" /> All Receipts
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '25px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#e0e7ff', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Total Invoiced</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)' }}>₹{totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#e6f4ea', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#188038' }}>
            <IndianRupee size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Total Fees Collected</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)' }}>₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#fce8e6', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d93025' }}>
            <IndianRupee size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Pending Unpaid Fees</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)' }}>₹{pendingFees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>Hostel Fee Invoices</h3>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              {['ALL', 'UNPAID', 'PAID', 'PARTIAL'].map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', background: filter === f ? 'var(--sidebar-active)' : 'transparent', color: filter === f ? 'white' : '#64748b', boxShadow: filter === f ? '0 2px 6px rgba(74, 114, 250, 0.3)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {f === 'ALL' ? 'All Invoices' : f === 'UNPAID' ? 'Unpaid Only' : f === 'PAID' ? 'Paid Only' : 'Partially Paid'}
                </button>
              ))}
            </div>
            
            <Select options={studentOptions} value={selectedStudent} onChange={setSelectedStudent} styles={selectStyles} isSearchable={true} />
            
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Invoice..." style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '200px' }} />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 12px' }}>Invoice No</th>
                <th style={{ padding: '16px 12px' }}>Student & Room</th>
                <th style={{ padding: '16px 12px' }}>Fee Type</th>
                <th style={{ padding: '16px 12px' }}>Period</th>
                <th style={{ padding: '16px 12px' }}>Amount</th>
                <th style={{ padding: '16px 12px' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '16px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredFees.map(fee => (
                <tr key={fee.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px 12px' }}>
                    <div style={{ fontWeight: 700, color: '#0d6efd' }}>{fee.status === 'COMPLETED' ? formatInvoiceNumber(fee) : '—'}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(fee.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{fee.student?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{fee.student?.regNo || 'N/A'} | Room {fee.student?.roomNo || 'N/A'}</div>
                  </td>
                  <td style={{ padding: '16px 12px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>{fee.transactionType}</span></td>
                  <td style={{ padding: '16px 12px', color: '#334155' }}>{new Date(fee.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '16px 12px', fontWeight: 700, color: '#0f172a' }}>₹{fee.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '16px 12px' }}><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: fee.status === 'COMPLETED' ? '#198754' : '#e11d48', color: 'white', fontWeight: 600, fontSize: '12px' }}>{fee.status === 'COMPLETED' ? 'Paid' : 'Unpaid'}</span></td>
                  <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                    {fee.status === 'PENDING' ? (
                      <button onClick={() => setFeeToCollect(fee)} style={{ padding: '6px 14px', fontSize: '13px', background: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Wallet size={14} /> Collect Payment
                      </button>
                    ) : (
                      <button onClick={() => setSelectedReceipt(fee)} style={{ padding: '6px 14px', fontSize: '13px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} color="#64748b" /> View Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredFees.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No fee transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal fee={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {/* Collect Payment Modal */}
      {feeToCollect && (
        <CollectPaymentModal 
          fee={feeToCollect} 
          onClose={closePaymentModal} 
          onSuccess={() => {
            closePaymentModal();
            fetchFees();
          }} 
        />
      )}
    </div>
  );
};

export default Fees;
