import React, { useState, useEffect } from 'react';
import { Search, User, FileText, CheckCircle, Wallet, ArrowLeft, IdCard, Building, GraduationCap } from 'lucide-react';
import { StudentAPI } from '../api/student.api';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { toast } from 'react-toastify';

export default function StudentPortal() {
  const [mobileNo, setMobileNo] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feesToPay, setFeesToPay] = useState<any[]>([]);
  const [receiptToShow, setReceiptToShow] = useState<any>(null);
  const [error, setError] = useState('');

  const loadStudent = async (searchMobile: string) => {
    setLoading(true);
    try {
      const data = await StudentAPI.findByMobile(searchMobile);
      if (!data) {
        setError("No student registered with this mobile number. Please check the number and try again.");
        setStudent(null);
        sessionStorage.removeItem('student_portal_mobile');
      } else {
        if (data.transactions) {
          data.transactions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        setStudent(data);
        sessionStorage.setItem('student_portal_mobile', searchMobile);
        const pending = data.transactions?.filter((t: any) => t.status === 'PENDING') || [];
        if (pending.length > 0) {
          setFeesToPay(pending.map((p: any) => ({ ...p, student: data })));
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to find student");
    }
    setLoading(false);
  };

  useEffect(() => {
    const savedMobile = sessionStorage.getItem('student_portal_mobile');
    if (savedMobile) {
      setMobileNo(savedMobile);
      loadStudent(savedMobile);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanMobile = mobileNo.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    
    await loadStudent(cleanMobile);
  };

  const handlePaymentSuccess = (paidItems?: any[], paymentMode?: string) => {
    setFeesToPay([]);
    // Update local student object to reflect completed fees
    if (student && paidItems) {
      const updatedTransactions = student.transactions.map((t: any) => {
        const paidItem = paidItems.find(p => p.id === t.id);
        if (paidItem) return paidItem;
        return t;
      });
      setStudent({ ...student, transactions: updatedTransactions });

      // Generate a grouped fee object to show the receipt immediately
      const totalAmount = paidItems.reduce((acc, curr) => acc + curr.amount, 0);
      const groupedFee = {
        isGrouped: true,
        feesList: paidItems,
        student: student,
        totalAmount,
        paymentMode: paymentMode || 'ONLINE',
        paidDate: new Date().toISOString()
      };
      setReceiptToShow(groupedFee);
    }
  };

  const groupedCompletedFees = React.useMemo(() => {
    if (!student?.transactions) return [];
    const paidByBatch = new Map();
    student.transactions.forEach((f: any) => {
      if (f.status !== 'COMPLETED') return;
      const type = (f.transactionType || '').toUpperCase();
      let category = 'other';
      if (type.includes('RENT')) category = 'rent';
      else if (type.includes('EB') || type.includes('ELECTRIC')) category = 'eb';
      else if (type.includes('MESS')) category = 'mess';
      else if (type.includes('FINE')) category = 'fine';
      else if (type.includes('ADVANCE')) category = 'advance';

      const paidTime = f.updatedAt || f.createdAt;
      const batchKey = `${student.id}-${new Date(paidTime).toISOString().slice(0, 16)}`;
      
      if (!paidByBatch.has(batchKey)) {
        paidByBatch.set(batchKey, {
          isGrouped: true,
          id: `paid-${batchKey}`,
          student: student,
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
    });
    return Array.from(paidByBatch.values()).sort((a: any, b: any) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime());
  }, [student]);

  const pendingFees = student?.transactions?.filter((t: any) => t.status === 'PENDING') || [];

  return (
    <div className="portal-container" style={{ height: '100vh', overflowY: 'auto', background: '#f8fafc', padding: '40px 20px', fontFamily: '"Inter", sans-serif' }}>
      <style>
        {`
          @media (max-width: 640px) {
            .profile-card { flex-direction: column !important; align-items: flex-start !important; gap: 15px; }
            .profile-details { flex-direction: column !important; gap: 8px !important; }
            .pending-block { flex-direction: column !important; align-items: flex-start !important; gap: 15px; }
            .pending-block button { width: 100%; justify-content: center; }
            .history-table { display: none !important; }
            .history-cards { display: flex !important; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 5px; -webkit-overflow-scrolling: touch; }
            .portal-title { font-size: 24px !important; }
            .portal-subtitle { font-size: 14px !important; }
            .login-card { padding: 24px !important; }
            .portal-container { padding: 20px 15px !important; }
          }
          .history-cards { display: none; }
          .history-cards::-webkit-scrollbar { width: 4px; }
          .history-cards::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        `}
      </style>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 className="portal-title" style={{ fontSize: '32px', fontWeight: 900, margin: '0 0 8px 0', background: 'linear-gradient(to right, #1e3a8a, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>VSR Hostel Student Portal</h1>
          <p className="portal-subtitle" style={{ color: '#64748b', fontSize: '16px', margin: 0, fontWeight: 500 }}>View your details and securely pay your fees online.</p>
        </div>

        {!student ? (
          <div className="login-card" style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <User size={32} color="#2563eb" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '24px' }}>Enter Mobile Number</h2>
            
            <form onSubmit={handleSearch}>
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <div style={{ position: 'absolute', left: '2px', top: '2px', bottom: '2px', width: '50px', background: '#f8fafc', borderRight: `1px solid ${error ? '#ef4444' : '#e2e8f0'}`, borderRadius: '10px 0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 700, fontSize: '15px' }}>+91</span>
                </div>
                <input 
                  type="tel" 
                  value={mobileNo}
                  onChange={(e) => {
                    setMobileNo(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="10-digit mobile number"
                  style={{ width: '100%', padding: '14px 16px 14px 65px', borderRadius: '12px', border: `2px solid ${error ? '#ef4444' : '#e2e8f0'}`, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s', fontWeight: 600, color: '#0f172a' }}
                />
              </div>
              
              {error && (
                <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: 500, marginBottom: '20px', textAlign: 'left', padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                  {error}
                </div>
              )}
              <button 
                type="submit" 
                disabled={loading}
                style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
              >
                {loading ? 'Searching...' : <><Search size={18} /> Find My Record</>}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <button 
              onClick={() => { 
                setStudent(null); 
                setMobileNo(''); 
                sessionStorage.removeItem('student_portal_mobile');
              }} 
              style={{ background: 'transparent', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '20px', padding: 0 }}
            >
              <ArrowLeft size={16} /> Back to Search
            </button>

            {/* Profile Card */}
            <div className="profile-card" style={{ background: 'white', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>{student.name}</h2>
                <div className="profile-details" style={{ display: 'flex', gap: '20px', color: '#475569', fontSize: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IdCard size={16} color="#94a3b8" /><strong style={{ color: '#1e293b' }}>Reg No:</strong> {student.regNo}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building size={16} color="#94a3b8" /><strong style={{ color: '#1e293b' }}>Room:</strong> {student.roomNo || 'N/A'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><GraduationCap size={16} color="#94a3b8" /><strong style={{ color: '#1e293b' }}>College:</strong> {student.college?.name || 'N/A'}</span>
                </div>
              </div>
              <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={14} /> Active Resident
              </div>
            </div>

            {/* Pending Fees */}
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>Pending Fees</h3>
            {pendingFees.length > 0 ? (
              <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '40px', padding: '30px' }}>
                <div className="pending-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', margin: '0 0 8px 0' }}>{pendingFees.length} Pending Invoice(s)</h4>
                    <div style={{ color: '#64748b', fontSize: '14px' }}>
                      You have outstanding dues totaling <strong style={{ color: '#0f172a' }}>₹{pendingFees.reduce((acc: number, f: any) => acc + f.amount, 0).toLocaleString('en-IN')}</strong>. Please clear them to avoid late fines.
                    </div>
                  </div>
                  <button 
                    onClick={() => setFeesToPay(pendingFees.map((p: any) => ({ ...p, student })))}
                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}
                  >
                    <Wallet size={18} /> Pay All Dues Now
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#64748b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '40px' }}>
                <CheckCircle size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>You're all caught up!</div>
                <div style={{ fontSize: '14px' }}>There are no outstanding fees to be paid at the moment.</div>
              </div>
            )}


          </div>
        )}

      </div>

      {feesToPay.length > 0 && (
        <CollectPaymentModal 
          fees={feesToPay} 
          onClose={() => setFeesToPay([])} 
          onSuccess={handlePaymentSuccess} 
          isStudentMode={true}
        />
      )}

      {receiptToShow && (
        <ReceiptModal fee={receiptToShow} onClose={() => setReceiptToShow(null)} />
      )}
    </div>
  );
}
