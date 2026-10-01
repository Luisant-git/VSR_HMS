import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserMinus, AlertCircle, CheckCircle2, IndianRupee, FileText } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { StudentAPI } from '../api/student.api';
import { FeesAPI } from '../api/fees.api';
import { ClearanceAPI } from '../api/clearance.api';
import { toast } from 'react-toastify';

const Clearance = () => {
  const navigate = useNavigate();
  const { id: studentId } = useParams();

  const [student, setStudent] = useState<any>(null);
  const [pendingDues, setPendingDues] = useState(0);

  const [reason, setReason] = useState('Completed Course / Graduated');
  const [deductions, setDeductions] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (studentId) {
      StudentAPI.findOne(studentId).then(data => {
        setStudent(data);
        FeesAPI.findByStudent(data.id).then(fees => {
          const dues = fees.filter((f: any) => f.status === 'PENDING').reduce((acc: number, f: any) => acc + f.amount, 0);
          setPendingDues(dues);
        });
      }).catch(() => {
        toast.error('Failed to load student details');
      });
    }
  }, [studentId]);

  if (!student) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading student data...</div>;
  }

  const advanceHeld = student.advance || 0;
  const netBalance = Math.max(0, advanceHeld - pendingDues - parseFloat(deductions || '0'));

  const processClearance = async () => {
    setIsProcessing(true);
    setShowConfirmModal(false);
    try {
      await ClearanceAPI.create({
        studentId: student.id,
        reason,
        deductions: parseFloat(deductions || '0'),
        remarks
      });
      toast.success('Clearance processed successfully! Student has been vacated.');
      navigate('/hostellers');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to process clearance');
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Student Discontinuation & Room Clearance"
        subtitle="Settle accounts, process security deposit refund, and automatically free room occupancy"
      />

      <div style={{ display: 'flex', gap: '25px', alignItems: 'flex-start' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', flex: 1.2 }}>
          
          {/* Section 1: Student Details */}
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserMinus size={18} color="var(--sidebar-active)" /> Clearance Wizard: {student.name}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Student ID & Name</label>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{student.name} ({student.regNo})</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Current Room & Bed (To be liberated)</label>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc3545' }}>Room {student.roomNo || 'N/A'} ({student.bedNo?.includes('Bed') ? student.bedNo : `Bed ${student.bedNo || 'N/A'}`})</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Course / Dept</label>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{student.college?.name || student.college || 'N/A'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Hostel Admission Date</label>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{new Date(student.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          {/* Section 2: Discontinuation Form */}
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--sidebar-active)" /> Exit Details
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Discontinuation / Exit Reason *</label>
                <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
                  <option>Completed Course / Graduated</option>
                  <option>Transferred to another college</option>
                  <option>Personal / Medical reasons</option>
                  <option>Disciplinary Action</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Exit Clearance Remarks</label>
                <textarea 
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Keys returned, cupboards verified, mess no-due certificate received..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Financial Audit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', flex: 1, position: 'sticky', top: '20px' }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IndianRupee size={18} color="#059669" /> Financial Audit & Deposit Settlement
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>Advance Deposit Held</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#059669' }}>₹{advanceHeld.toFixed(2)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>Pending Unpaid Dues</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#dc3545' }}>₹{pendingDues.toFixed(2)}</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Damage / Maintenance Deductions (₹)</label>
                <input 
                  type="number" 
                  value={deductions}
                  onChange={e => setDeductions(e.target.value)}
                  placeholder="0.00" 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} 
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Any room damages, lost keys, or repair costs deducted from the advance.</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e3a8a' }}>Net Balance Refund</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8' }}>₹{netBalance.toFixed(2)}</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Refund Mode for Net Balance</label>
                <select style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
                  <option>UPI / GPay / PhonePe</option>
                  <option>Cash</option>
                  <option>Bank Transfer / NEFT</option>
                  <option>No Refund Applicable</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '8px', border: '1px solid #fef3c7', display: 'flex', gap: '12px' }}>
            <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
              <strong>Important:</strong> Clicking confirm will immediately mark the student as Discontinued, settle their dues, and free up bed occupancy in <strong>Room {student.roomNo || 'N/A'}</strong> so it becomes available for new admissions.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
            <button onClick={() => navigate(-1)} style={{ padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer' }}>Cancel</button>
            <button disabled={isProcessing} onClick={() => setShowConfirmModal(true)} style={{ opacity: isProcessing ? 0.7 : 1, padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: '#dc3545', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(220, 53, 69, 0.3)' }}>
              <CheckCircle2 size={18} /> {isProcessing ? 'Processing...' : 'Confirm Discontinuation'}
            </button>
          </div>
        </div>
      </div>
    </div>
      
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
              <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '50%', color: '#dc3545' }}>
                <AlertCircle size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#1e293b' }}>Confirm Discontinuation</h3>
            </div>
            
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.5', marginBottom: '25px' }}>
              Are you sure you want to permanently discontinue <strong>{student.name}</strong>? 
              This action cannot be undone and will immediately unassign their room.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setShowConfirmModal(false)}
                style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={processClearance}
                style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#dc3545', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={16} /> Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Clearance;
