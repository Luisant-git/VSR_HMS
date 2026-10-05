import React, { useState, useEffect } from 'react';
import { CheckCircle, Wallet, ArrowLeft, IdCard, Building, GraduationCap, Phone, AlertCircle } from 'lucide-react';
import { StudentAPI } from '../api/student.api';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';

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


  const pendingFees = student?.transactions?.filter((t: any) => t.status === 'PENDING') || [];

  if (!student) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: '"Inter", sans-serif', padding: '20px' }}>
        <div style={{ background: 'white', width: '100%', maxWidth: '440px', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ width: '64px', height: '64px', background: '#eff6ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Wallet size={32} />
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Fee Portal</h2>
            <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Enter your registered mobile number to securely pay your fees.</p>
          </div>

          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#334155', fontSize: '14px', fontWeight: 600 }}>Registered Mobile Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  placeholder="e.g. 9876543210"
                  style={{
                    width: '100%', padding: '14px 16px 14px 48px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '16px', outline: 'none', transition: 'all 0.2s ease', background: '#f8fafc', color: '#1e293b'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>
            
            {error && (
              <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#ef4444', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} /> <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#2563eb', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
              onMouseOver={(e) => { if(!loading) { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.4)'; } }}
              onMouseOut={(e) => { if(!loading) { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } }}
            >
              {loading ? 'Searching...' : 'Continue to Fee Portal →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            .student-header-box { flex-direction: column; text-align: center; }
          }
          .history-cards { display: none; }
          .history-cards::-webkit-scrollbar { width: 4px; }
          .history-cards::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        `}
      </style>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 className="portal-title" style={{ fontSize: '32px', fontWeight: 900, margin: '0 0 8px 0', background: 'linear-gradient(to right, #1e3a8a, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hostel Student Portal</h1>
          <p className="portal-subtitle" style={{ color: '#64748b', fontSize: '16px', margin: 0, fontWeight: 500 }}>View your details and securely pay your fees online.</p>
        </div>
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

            {/* Room & Accommodation */}
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>Room & Accommodation</h3>
            <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', padding: '24px' }}>
              <div className="room-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px' }}>
                <style>{`
                  @media (max-width: 640px) {
                    .room-grid { grid-template-columns: 1fr 1fr !important; }
                  }
                `}</style>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Room Type</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>{student.room?.type || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Block / Room No</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>{student.room ? `Block ${student.room.block} - Room ${student.room.id.replace(/^[a-zA-Z\\s_-]+/, '')}` : 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Monthly Rent</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>₹{student.rent?.toLocaleString('en-IN') || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Monthly Mess Fee</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>
                    ₹{(() => {
                      const tList = student.transactions?.filter((f: any) => f.transactionType === 'MESS') || [];
                      if (tList.length === 0) return (student.room?.messFee || 0).toLocaleString('en-IN');
                      tList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      for (const t of tList) {
                        const match = t.description?.match(/@ ₹([0-9,.]+)\/month/);
                        if (match) return match[1];
                        const match2 = t.description?.match(/Paid for (\d+) Months/);
                        if (match2) {
                          const months = parseInt(match2[1], 10);
                          if (months > 0) return (t.amount / months).toLocaleString('en-IN');
                        }
                        return t.amount?.toLocaleString('en-IN') || 0;
                      }
                      return (student.room?.messFee || 0).toLocaleString('en-IN');
                    })()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Advance Paid</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>₹{student.advance?.toLocaleString('en-IN') || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Food Type</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>{student.foodType || 'N/A'}</div>
                </div>
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
