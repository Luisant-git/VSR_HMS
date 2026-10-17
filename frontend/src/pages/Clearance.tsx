import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserMinus, AlertCircle, CheckCircle2, IndianRupee, FileText } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingSpinner';
import { StudentAPI } from '../api/student.api';
import { FeesAPI } from '../api/fees.api';
import { ClearanceAPI } from '../api/clearance.api';
import { toast } from 'react-toastify';

const Clearance = () => {
  const navigate = useNavigate();
  const { id: studentId } = useParams();

  const [student, setStudent] = useState<any>(null);
  const [pendingDues, setPendingDues] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState('Completed Course / Graduated');
  const [deductions, setDeductions] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (studentId) {
      setError(null);
      StudentAPI.findOne(studentId).then(data => {
        setStudent(data);
        FeesAPI.findByStudent(data.id).then(fees => {
          const safeFees = Array.isArray(fees) ? fees : (fees as any).data || [];
          const dues = safeFees.filter((f: any) => f.status === 'PENDING').reduce((acc: number, f: any) => acc + f.amount, 0);
          setPendingDues(dues);
        });
      }).catch(() => {
        setError('Failed to load student details');
      });
    }
  }, [studentId]);

  if (error) {
    return <div className="ui-page"><div className="ui-empty ui-empty--danger">{error}</div></div>;
  }

  if (!student) {
    return <div className="ui-page"><LoadingBlock text="Loading student data..." /></div>;
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
      <div className="ui-page">
      <PageHeader
        title="Student Discontinuation & Room Clearance"
        subtitle="Settle accounts, process security deposit refund, and automatically free room occupancy"
        icon={<UserMinus size={24} color="#fff" />} iconBg="linear-gradient(135deg, #84cc16 0%, #65a30d 100%)"
      />

      <div className="ui-split">
        {/* Left Column */}
        <div className="ui-split-main">
          
          {/* Section 1: Student Details */}
          <div className="ui-card">
            <div className="ui-card-head">
              <h3 className="ui-card-title clear-section-title">
                <UserMinus size={18} color="var(--accent)" /> Clearance Wizard: {student.name}
              </h3>
            </div>
            <div className="ui-card-body">
              <div className="ui-grid-2">
                <div className="clear-field">
                  <label className="clear-field-label">Student ID &amp; Name</label>
                  <div className="clear-field-value">{student.name} ({student.manualRegsiName || student.regNo})</div>
                </div>
                <div className="clear-field">
                  <label className="clear-field-label">Current Room (To be liberated)</label>
                  <div className="clear-field-value clear-field-value--danger">Room {student.roomNo || 'N/A'}</div>
                </div>
                <div className="clear-field">
                  <label className="clear-field-label">Course / Dept</label>
                  <div className="clear-field-value clear-field-value--muted">{student.college?.name || student.college || 'N/A'}</div>
                </div>
                <div className="clear-field">
                  <label className="clear-field-label">Hostel Admission Date</label>
                  <div className="clear-field-value clear-field-value--muted">{new Date(student.createdAt).toLocaleDateString('en-GB')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Discontinuation Form */}
          <div className="ui-card">
            <div className="ui-card-head">
              <h3 className="ui-card-title clear-section-title">
                <FileText size={18} color="var(--accent)" /> Exit Details
              </h3>
            </div>
            <div className="ui-card-body">
              <div className="clear-form">
                <div>
                  <label className="clear-form-label">Discontinuation / Exit Reason *</label>
                  <select value={reason} onChange={e => setReason(e.target.value)} className="ui-select">
                    <option>Completed Course / Graduated</option>
                    <option>Transferred to another college</option>
                    <option>Personal / Medical reasons</option>
                    <option>Disciplinary Action</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="clear-form-label">Exit Clearance Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Keys returned, cupboards verified, mess no-due certificate received..."
                    className="ui-textarea"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Financial Audit */}
        <div className="ui-split-side">
          <div className="ui-card">
            <div className="ui-card-head">
              <h3 className="ui-card-title clear-section-title">
                <IndianRupee size={18} color="#059669" /> Financial Audit &amp; Deposit Settlement
              </h3>
            </div>
            <div className="ui-card-body">
              <div className="clear-form">
                <div className="ui-summary-row">
                  <span className="clear-summary-label">Advance Deposit Held</span>
                  <span className="ui-summary-value clear-money--success">₹{advanceHeld.toFixed(2)}</span>
                </div>
                
                <div className="ui-summary-row ui-summary-row--danger">
                  <span className="clear-summary-label">Pending Unpaid Dues</span>
                  <span className="ui-summary-value clear-money--danger">₹{pendingDues.toFixed(2)}</span>
                </div>

                <div>
                  <label className="clear-form-label">Damage / Maintenance Deductions (₹)</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={e => setDeductions(e.target.value)}
                    placeholder="0.00"
                    className="ui-input"
                  />
                  <div className="ui-hint">Any room damages, lost keys, or repair costs deducted from the advance.</div>
                </div>

                <div className="ui-summary-row ui-summary-row--info">
                  <span className="clear-net-label">Net Balance Refund</span>
                  <span className="clear-net-value">₹{netBalance.toFixed(2)}</span>
                </div>

                <div>
                  <label className="clear-form-label">Refund Mode for Net Balance</label>
                  <select className="ui-select">
                    <option>UPI / GPay / PhonePe</option>
                    <option>Cash</option>
                    <option>Bank Transfer / NEFT</option>
                    <option>No Refund Applicable</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="ui-alert ui-alert-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Important:</strong> Clicking confirm will immediately mark the student as Discontinued, settle their dues, and free up room occupancy in <strong>Room {student.roomNo || 'N/A'}</strong> so it becomes available for new admissions.
            </div>
          </div>

          {/* Actions */}
          <div className="clear-actions">
            <button onClick={() => navigate(-1)} className="ui-btn ui-btn-secondary">Cancel</button>
            <button disabled={isProcessing} onClick={() => setShowConfirmModal(true)} className="ui-btn ui-btn-danger">
              <CheckCircle2 size={18} /> {isProcessing ? 'Processing...' : 'Confirm Discontinuation'}
            </button>
          </div>
        </div>
      </div>
    </div>
      
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal--sm">
            <div className="ui-modal-head">
              <div className="clear-confirm-head">
                <div className="clear-confirm-icon">
                  <AlertCircle size={24} />
                </div>
                <h3 className="ui-modal-title">Confirm Discontinuation</h3>
              </div>
            </div>
            
            <div className="ui-modal-body">
              <p className="clear-confirm-text">
                Are you sure you want to permanently discontinue <strong>{student.name}</strong>? 
                This action cannot be undone and will immediately unassign their room.
              </p>
            </div>
            
            <div className="ui-modal-foot">
              <button onClick={() => setShowConfirmModal(false)} className="ui-btn ui-btn-secondary">
                Cancel
              </button>
              <button onClick={processClearance} className="ui-btn ui-btn-danger">
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
