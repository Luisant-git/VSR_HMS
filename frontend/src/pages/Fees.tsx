import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { IndianRupee, Search, FileText, Wallet, FileSpreadsheet, X } from 'lucide-react';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { FeesAPI } from '../api/fees.api';
import { ReceiptModal } from '../components/ReceiptModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';

const formatInvoiceNumber = (fee: any) => {
  const ymStr = new Date(fee.createdAt).toISOString().slice(0, 7).replace('-', '');
  const purpose = fee.transactionType.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  const studentStr = fee.student?.regNo || 'UNKN';
  return `INV-${purpose}-${ymStr}-${studentStr}`;
};

const Fees = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentParam = searchParams.get('student');

  const [filter, setFilter] = useState('ALL');
  const [fees, setFees] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>({
    value: studentParam || 'ALL',
    label: studentParam ? `${studentParam}` : '-- All Students --'
  });
  const [collegeFilter, setCollegeFilter] = useState<any>({ value: 'ALL', label: '-- All Colleges --' });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [feeToCollect, setFeeToCollect] = useState<any>(null);
  const [feesToCollect, setFeesToCollect] = useState<any[]>([]);



  const fetchFees = () => {
    setError(null);
    FeesAPI.findAll().then(data => {
      setFees(data);
    }).catch(err => {
      console.error(err);
      setError('Failed to load fees');
    });
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

  const collegeOptions = useMemo(() => {
    const colleges = new Set<string>();
    fees.forEach(fee => {
      if (fee.student?.college) {
        const c = typeof fee.student.college === 'string' ? fee.student.college : fee.student.college.name;
        if (c) colleges.add(c);
      }
    });
    return [{ value: 'ALL', label: '-- All Colleges --' }, ...Array.from(colleges).map(c => ({ value: c, label: c }))];
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



  const statusOptions = [
    { value: 'ALL', label: '-- All Status --' },
    { value: 'PAID', label: 'Paid' },
    { value: 'UNPAID', label: 'Unpaid' }
  ];

  const filteredFees = fees.filter(fee => {
    let match = true;
    if (filter === 'UNPAID') match = fee.status === 'PENDING';
    if (filter === 'PAID') match = fee.status === 'COMPLETED';
    if (filter === 'PARTIAL') match = fee.status === 'PARTIAL';

    if (selectedStudent.value !== 'ALL' && fee.student?.regNo !== selectedStudent.value) match = false;

    if (collegeFilter.value !== 'ALL') {
      const c = typeof fee.student?.college === 'string' ? fee.student.college : fee.student?.college?.name;
      if (c !== collegeFilter.value) match = false;
    }

    if (fromDate) {
       if (new Date(fee.createdAt) < new Date(fromDate)) match = false;
    }
    if (toDate) {
       const endOfDay = new Date(toDate);
       endOfDay.setHours(23, 59, 59, 999);
       if (new Date(fee.createdAt) > endOfDay) match = false;
    }

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

  const totalInvoiced = filteredFees.reduce((sum, fee) => sum + fee.amount, 0);
  const totalCollected = filteredFees.filter(f => f.status === 'COMPLETED').reduce((sum, fee) => sum + fee.amount, 0);
  const pendingFeesAmt = filteredFees.filter(f => f.status === 'PENDING').reduce((sum, fee) => sum + fee.amount, 0);

  const displayFees = useMemo(() => {
    const pendingByStudent = new Map();
    const paidByBatch = new Map();

    filteredFees.forEach(f => {
      const studentId = f.student?.regNo || 'unknown';
      
      const type = (f.transactionType || '').toUpperCase();
      let category = 'other';
      if (type.includes('RENT')) category = 'rent';
      else if (type.includes('EB') || type.includes('ELECTRIC')) category = 'eb';
      else if (type.includes('MESS')) category = 'mess';
      else if (type.includes('FINE')) category = 'fine';
      else if (type.includes('ADVANCE')) category = 'advance';

      if (f.status === 'PENDING') {
        if (!pendingByStudent.has(studentId)) {
          pendingByStudent.set(studentId, {
            isGrouped: true,
            id: `pending-${studentId}`,
            student: f.student,
            status: 'PENDING',
            createdAt: f.createdAt,
            paymentMode: '-',
            totalAmount: 0,
            rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
            feesList: []
          });
        }
        const group = pendingByStudent.get(studentId);
        group.totalAmount += f.amount;
        group[category] += f.amount;
        group.feesList.push(f);
        if (new Date(f.createdAt) < new Date(group.createdAt)) {
          group.createdAt = f.createdAt;
        }
      } else {
        const paidTime = f.updatedAt || f.createdAt;
        // Group by student + minute of payment so batch payments appear as one receipt
        const batchKey = `${studentId}-${new Date(paidTime).toISOString().slice(0, 16)}`;
        if (!paidByBatch.has(batchKey)) {
          paidByBatch.set(batchKey, {
            isGrouped: true,
            id: `paid-${batchKey}`,
            student: f.student,
            status: f.status,
            createdAt: f.createdAt,
            paidDate: paidTime,
            paymentMode: f.paymentMode || 'N/A',
            totalAmount: 0,
            rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
            feesList: []
          });
        }
        const group = paidByBatch.get(batchKey);
        group.totalAmount += f.amount;
        group[category] += f.amount;
        group.feesList.push(f);
      }
    });

    const result = [...Array.from(pendingByStudent.values()), ...Array.from(paidByBatch.values())];
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [filteredFees]);

  const paginatedFees = useMemo(() => {
    return displayFees.slice((page - 1) * 10, page * 10);
  }, [displayFees, page]);
  
  const totalPages = Math.ceil(displayFees.length / 10);

  const closePaymentModal = () => {
    setFeeToCollect(null);
    setFeesToCollect([]);
    if (feeIdParam) {
      searchParams.delete('feeId');
      navigate(`?${searchParams.toString()}`, { replace: true });
    }
  };

  const handleExportExcel = () => {
    const data = displayFees.map(fee => ({
      'Receipt No': fee.status === 'COMPLETED' ? (fee.feesList[0] ? formatInvoiceNumber(fee.feesList[0]) : '—') : '—',
      'Reg. No': fee.student?.regNo || 'N/A',
      'Student Name': fee.student?.name || 'Unknown',
      'Room': `Room ${fee.student?.roomNo || 'N/A'}`,
      'Payment Date': fee.status === 'COMPLETED' ? new Date(fee.paidDate || fee.createdAt).toLocaleDateString('en-GB') : '—',
      'Advance': fee.advance || 0,
      'Rent': fee.rent || 0,
      'EB': fee.eb || 0,
      'Mess': fee.mess || 0,
      'Fine': fee.fine || 0,
      'Total Paid': fee.totalAmount || 0,
      'Payment Method': fee.status === 'COMPLETED' ? (fee.paymentMode || '-') : '—',
      'Status': fee.status === 'COMPLETED' ? 'Paid' : 'Unpaid'
    }));

    // Calculate totals
    const totalRow = {
      'Receipt No': 'TOTAL',
      'Reg. No': '',
      'Student Name': '',
      'Room': '',
      'Payment Date': '',
      'Advance': displayFees.reduce((sum, f) => sum + f.advance, 0),
      'Rent': displayFees.reduce((sum, f) => sum + f.rent, 0),
      'EB': displayFees.reduce((sum, f) => sum + f.eb, 0),
      'Mess': displayFees.reduce((sum, f) => sum + f.mess, 0),
      'Fine': displayFees.reduce((sum, f) => sum + f.fine, 0),
      'Total Paid': displayFees.reduce((sum, f) => sum + f.totalAmount, 0),
      'Payment Method': '',
      'Status': ''
    };

    data.push(totalRow as any);

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fees");
    XLSX.writeFile(workbook, "Fees_Report.xlsx");
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Fees Paid / Unpaid"
        subtitle="Track hostel rent, mess bills, pending dues, and issue payment receipts"
        rightContent={
          <div style={{ display: 'flex', gap: '10px' }}>

            <button onClick={handleExportExcel} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}>
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button onClick={() => setFilter('ALL')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'white', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <FileText size={16} color="#64748b" /> View All
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px', marginBottom: '25px' }}>
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
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)' }}>₹{pendingFeesAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>Hostel Fee Invoices</h3>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Select options={collegeOptions} value={collegeFilter} onChange={(val) => { setCollegeFilter(val); setPage(1); }} styles={{...selectStyles, control: (b: any, s: any) => ({...selectStyles.control(b,s), minWidth: '180px'})}} />
            <Select options={studentOptions} value={selectedStudent} onChange={(val) => { setSelectedStudent(val); setPage(1); }} styles={{...selectStyles, control: (b: any, s: any) => ({...selectStyles.control(b,s), minWidth: '180px'})}} />
            <Select options={statusOptions} value={statusOptions.find(o => o.value === filter)} onChange={(val: any) => { setFilter(val.value); setPage(1); }} styles={{...selectStyles, control: (b: any, s: any) => ({...selectStyles.control(b,s), minWidth: '150px'})}} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>From:</span>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', color: '#475569' }} />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>To:</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', color: '#475569' }} />
            </div>

            <button
              onClick={() => {
                setSelectedStudent({ value: 'ALL', label: '-- All Students --' });
                setCollegeFilter({ value: 'ALL', label: '-- All Colleges --' });
                setFilter('ALL');
                setFromDate('');
                setToDate('');
                setSearchQuery('');
                setPage(1);
              }}
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
            >
              <X size={14} /> Clear All
            </button>

            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search Invoice..." style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '200px' }} />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 12px' }}>Receipt No</th>
                <th style={{ padding: '16px 12px' }}>Reg. No</th>
                <th style={{ padding: '16px 12px' }}>Student Name</th>
                <th style={{ padding: '16px 12px' }}>Room</th>
                <th style={{ padding: '16px 12px' }}>Payment Date</th>
                <th style={{ padding: '16px 12px', textAlign: 'right' }}>Advance</th>
                <th style={{ padding: '16px 12px', textAlign: 'right' }}>Rent</th>
                <th style={{ padding: '16px 12px', textAlign: 'right' }}>EB</th>
                <th style={{ padding: '16px 12px', textAlign: 'right' }}>Mess</th>
                <th style={{ padding: '16px 12px', textAlign: 'right' }}>Fine</th>
                <th style={{ padding: '16px 12px', textAlign: 'right' }}>Total Paid</th>
                <th style={{ padding: '16px 12px' }}>Payment Method</th>
                <th style={{ padding: '16px 12px' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '16px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFees.map((fee: any) => (
                <tr key={fee.id} style={{ borderBottom: '1px solid #e2e8f0', background: fee.status === 'PENDING' ? '#fff1f2' : 'white' }}>
                  <td style={{ padding: '16px 12px', fontWeight: 700, color: '#0d6efd' }}>
                    {fee.status === 'COMPLETED' ? (fee.feesList[0] ? formatInvoiceNumber(fee.feesList[0]) : '—') : '—'}
                  </td>
                  <td style={{ padding: '16px 12px', color: '#475569', fontWeight: 600 }}>{fee.student?.regNo || 'N/A'}</td>
                  <td style={{ padding: '16px 12px', fontWeight: 700, color: '#1e293b' }}>{fee.student?.name || 'Unknown'}</td>
                  <td style={{ padding: '16px 12px', color: '#475569' }}>Room {fee.student?.roomNo || 'N/A'}</td>
                  <td style={{ padding: '16px 12px', color: '#334155' }}>{fee.status === 'COMPLETED' ? new Date(fee.paidDate || fee.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                  
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: '#198754', fontWeight: 600 }}>₹{fee.advance.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: '#334155' }}>
                    <div>₹{fee.rent.toLocaleString('en-IN')}</div>
                    {fee.status === 'COMPLETED' && (() => {
                      const rentFee = fee.feesList?.find((x: any) => (x.transactionType || '').toUpperCase().includes('RENT'));
                      const match = rentFee?.description?.match(/Paid for \d+ Months \(([^)]+)\)/);
                      if (match) {
                        const parts = match[1].split('-');
                        return <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', whiteSpace: 'nowrap' }}>Paid till {parts[parts.length - 1].trim()}</div>;
                      }
                      return null;
                    })()}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: '#334155' }}>₹{fee.eb.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: '#334155' }}>
                    <div>₹{fee.mess.toLocaleString('en-IN')}</div>
                    {fee.status === 'COMPLETED' && (() => {
                      const messFee = fee.feesList?.find((x: any) => (x.transactionType || '').toUpperCase().includes('MESS'));
                      const match = messFee?.description?.match(/Paid for \d+ Months \(([^)]+)\)/);
                      if (match) {
                        const parts = match[1].split('-');
                        return <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', whiteSpace: 'nowrap' }}>Paid till {parts[parts.length - 1].trim()}</div>;
                      }
                      return null;
                    })()}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: '#334155' }}>₹{fee.fine.toLocaleString('en-IN')}</td>
                  
                  <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: 800, color: fee.status === 'PENDING' ? '#dc3545' : '#0f172a', fontSize: '14px' }}>
                    ₹{fee.totalAmount.toLocaleString('en-IN')}
                  </td>
                  
                  <td style={{ padding: '16px 12px', color: '#475569', fontWeight: 500 }}>{fee.status === 'COMPLETED' ? fee.paymentMode : '—'}</td>
                  <td style={{ padding: '16px 12px' }}>
                    <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: fee.status === 'COMPLETED' ? '#198754' : '#e11d48', color: 'white', fontWeight: 600, fontSize: '12px' }}>
                      {fee.status === 'COMPLETED' ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                    {fee.status === 'PENDING' ? (
                      <button onClick={() => setFeesToCollect(fee.feesList)} style={{ padding: '6px 14px', fontSize: '13px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(13, 110, 253, 0.2)' }}>
                        <Wallet size={14} /> Pay Now
                      </button>
                    ) : (
                      <button onClick={() => setSelectedReceipt(fee)} style={{ padding: '6px 14px', fontSize: '13px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} color="#64748b" /> View Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {error ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>{error}</td>
                </tr>
              ) : paginatedFees.length === 0 && (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No fee transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, displayFees.length)} of {displayFees.length} entries
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === 1 ? '#f1f5f9' : 'white', color: page === 1 ? '#94a3b8' : '#334155', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Previous
              </button>
              <button 
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--sidebar-active)', background: 'var(--sidebar-active)', color: 'white', cursor: 'default', fontSize: '13px', fontWeight: 600 }}>
                {page}
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: (page === totalPages || totalPages === 0) ? '#f1f5f9' : 'white', color: (page === totalPages || totalPages === 0) ? '#94a3b8' : '#334155', cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal fee={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {/* Collect Payment Modal */}
      {(feeToCollect || feesToCollect.length > 0) && (
        <CollectPaymentModal
          fee={feeToCollect}
          fees={feesToCollect}
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
