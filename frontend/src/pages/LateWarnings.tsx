import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { gateLogApi } from '../api/gatelog.api';
import { toast } from 'react-toastify';

const LateWarnings = () => {
  const navigate = useNavigate();
  const [missingLogs, setMissingLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [lateRemarks, setLateRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMissing();
  }, []);

  const fetchMissing = async () => {
    try {
      const data = await gateLogApi.getMissing();
      setMissingLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getDelayString = (expectedInTime: string) => {
    const diffMs = new Date().getTime() - new Date(expectedInTime).getTime();
    if (diffMs <= 0) return '';
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHrs > 0) return `Overdue by ${diffHrs}h ${diffMins}m`;
    return `Overdue by ${diffMins}m`;
  };

  const submitLateReason = async () => {
    if (!selectedStudentId) return;
    if (!lateRemarks.trim()) {
      toast.warning('Please enter a reason for returning late');
      return;
    }
    setSubmitting(true);
    try {
      await gateLogApi.create({
        studentId: selectedStudentId,
        movementType: 'ENTRY',
        time: new Date().toISOString(),
        remarks: lateRemarks
      });
      toast.success('Student marked as arrived successfully');
      setIsModalOpen(false);
      setLateRemarks('');
      setSelectedStudentId(null);
      fetchMissing();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark reached');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Late Return Warnings & Missing Alerts"
        subtitle="Automatic real-time alerts for hostellers who failed to return by the standard deadline or their stated check-in time"
        showBack={true}
        onBack={() => navigate('/gate-logs')}
      />

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: missingLogs.length > 0 ? '1px solid #fecdd3' : '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ background: missingLogs.length > 0 ? '#fff1f2' : '#f8f9fa', padding: '15px 20px', borderBottom: missingLogs.length > 0 ? '1px solid #fecdd3' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {missingLogs.length > 0 ? (
            <AlertTriangle size={20} color="#e11d48" />
          ) : (
            <CheckCircle2 size={20} color="#10b981" />
          )}
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: missingLogs.length > 0 ? '#e11d48' : '#10b981', margin: 0 }}>
            {missingLogs.length} Critical Alerts Active
          </h3>
        </div>
        
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', background: '#f8f9fa' }}>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Student & Room</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Reason</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Expected Return</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Current Delay</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Contact</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
              ) : missingLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No late warnings currently. All students are either inside or not yet overdue.
                  </td>
                </tr>
              ) : (
                missingLogs.map((log: any) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fffcfc' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{log.student.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{log.student.regNo} | Room {log.student.room?.id || '-'}</div>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#334155', textTransform: 'capitalize' }}>{log.reason || '-'}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>{new Date(log.expectedInTime).toLocaleString()}</td>
                    <td style={{ padding: '16px 20px' }}><span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '4px', background: '#e11d48', color: 'white', fontWeight: 700, fontSize: '12px' }}>{getDelayString(log.expectedInTime)}</span></td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ color: '#0d6efd', fontWeight: 500 }}>{log.student.mobileNo || '-'} (Self)</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{log.student.fatherMobileNo || '-'} (Parent)</div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button 
                        onClick={() => { setSelectedStudentId(log.studentId); setIsModalOpen(true); }} 
                        style={{ padding: '8px 16px', fontSize: '13px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Mark Reached
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px', color: '#1e293b', fontSize: '18px', fontWeight: 700 }}>Late Return Reason</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>Please provide a reason or note regarding why the student returned late. This will be permanently recorded in the master logs.</p>
            
            <textarea 
              value={lateRemarks}
              onChange={e => setLateRemarks(e.target.value)}
              placeholder="e.g. Traffic jam, bus delayed, stayed extra at college..." 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical', minHeight: '80px', marginBottom: '20px' }}
              autoFocus
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => { setIsModalOpen(false); setLateRemarks(''); setSelectedStudentId(null); }}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                onClick={submitLateReason}
                style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#e11d48', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Confirm Check-In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LateWarnings;
