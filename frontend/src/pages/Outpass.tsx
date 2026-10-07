import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, X, LogOut, Check, LogIn } from 'lucide-react';
import { StudentAPI } from '../api/student.api';
import { OutpassAPI } from '../api/outpass.api';
import { MessDeductionAPI } from '../api/mess-deduction.api';
import Select from 'react-select';

const Outpass = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [outpasses, setOutpasses] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    studentId: '',
    destination: '',
    reason: '',
    leaveDate: '',
    returnDate: '',
    parentConsent: true
  });

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [deductionThreshold, setDeductionThreshold] = useState<number>(15);

  const fetchOutpasses = () => {
    setError(null);
    OutpassAPI.findAll({ page, limit, search: searchTerm, fromDate, toDate }).then(res => {
      setOutpasses(res.data || []);
      setTotalPages(res.totalPages || 1);
      setTotalRecords(res.total || 0);
    }).catch(err => {
      console.error(err);
      setError('Failed to load outpasses');
    });
  };

  useEffect(() => {
    StudentAPI.findAll().then(res => {
      // Use res.data if available (in case StudentAPI is paginated), otherwise fallback to res array
      const sData = Array.isArray(res) ? res : (res.data || []);
      setStudents(sData.filter((s: any) => s.status !== 'Vacated'));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchOutpasses();
    MessDeductionAPI.getSettings().then(res => {
      if (res && res.messDeductionThreshold !== undefined) {
        setDeductionThreshold(res.messDeductionThreshold);
      }
    }).catch(console.error);
  }, [page, limit, searchTerm, fromDate, toDate]);

  const handleIssueOutpass = async () => {
    try {
      await OutpassAPI.create({
        studentId: formData.studentId,
        destination: formData.destination,
        reason: formData.reason,
        leaveDate: new Date(formData.leaveDate).toISOString(),
        returnDate: new Date(formData.returnDate).toISOString(),
        parentConsent: formData.parentConsent
      });
      setIsModalOpen(false);
      setFormData({ studentId: '', destination: '', reason: '', leaveDate: '', returnDate: '', parentConsent: true });
      fetchOutpasses();
    } catch (e) {
      console.error(e);
      alert('Failed to issue outpass');
    }
  };

  const updateGateAction = async (id: string, currentAction: string) => {
    try {
      if (currentAction === 'Verify Exit') {
        await OutpassAPI.updateStatus(id, { status: 'Active Out', gateAction: 'Verify Return' });
      } else if (currentAction === 'Verify Return') {
        await OutpassAPI.updateStatus(id, { status: 'Closed Returned', gateAction: 'Done' });
      }
      fetchOutpasses();
    } catch(e) {
      console.error(e);
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) throw new Error();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateStr = `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
      const hours = d.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      const timeStr = `${hours12.toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${ampm}`;
      return { dateStr, timeStr };
    } catch {
      return { dateStr: 'Invalid Date', timeStr: '' };
    }
  };

  const filteredOutpasses = outpasses; // We handle filtering on backend now

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)' }}>Digital Outpass Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '5px' }}>
            Issue, approve, and verify gate movement for student outpasses
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ padding: '10px 20px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
        >
          <FileText size={18} /> Issue Digital Outpass
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Outpasses Master Register</h3>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search outpasses..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                style={{ padding: '8px 30px 8px 15px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', width: '220px', outline: 'none' }}
              />
              {searchTerm && (
                <button 
                  onClick={() => { setSearchTerm(''); setPage(1); }}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#64748b' }}>From:</label>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#64748b' }}>To:</label>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155' }} />
            </div>
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate(''); setPage(1); }} style={{ padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: '6px', fontSize: '13px', color: '#64748b', cursor: 'pointer' }}>
                Clear Dates
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outpass #</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student & Room</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason & Destination</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled Leave</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected Return</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration & Consent</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Gate Action</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontSize: '14px' }}>
                    {error}
                  </td>
                </tr>
              ) : filteredOutpasses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    No outpasses found.
                  </td>
                </tr>
              ) : (
              filteredOutpasses.map((op, idx) => {
                const leave = formatDateTime(op.leaveDate);
                const ret = formatDateTime(op.returnDate);
                const daysOut = Math.max(1, Math.ceil((new Date(op.returnDate).getTime() - new Date(op.leaveDate).getTime()) / (1000 * 3600 * 24)));
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='#f8fafc'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '15px 20px', fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>
                      {op.outpassId}
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{op.student?.name}</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{op.student?.regNo} | <br/>{op.student?.room?.id}</div>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{op.destination}</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{op.reason}</div>
                    </td>
                    <td style={{ padding: '15px 20px', fontSize: '13px', color: '#1e293b' }}>
                      {leave.dateStr}<br/>{leave.timeStr}
                    </td>
                    <td style={{ padding: '15px 20px', fontSize: '13px', color: '#1e293b' }}>
                      {ret.dateStr}<br/>{ret.timeStr}
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                        {daysOut} {daysOut === 1 ? 'Day' : 'Days'}
                      </div>
                      {daysOut > deductionThreshold && (
                        <div style={{ marginBottom: '6px' }}>
                          <span style={{ display: 'inline-block', background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            Mess Deduction Eligible
                          </span>
                        </div>
                      )}
                      {op.parentConsent && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      {op.status === 'Approved' && (
                        <span style={{ display: 'inline-block', background: '#22c55e', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                          Approved
                        </span>
                      )}
                      {op.status === 'Active Out' && (
                        <span style={{ display: 'inline-block', background: '#ffc107', color: '#000', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                          Active Out
                        </span>
                      )}
                      {op.status === 'Closed Returned' && (
                        <span style={{ display: 'inline-block', background: '#166534', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                          Closed Returned
                        </span>
                      )}
                      {op.status === 'Pending' && (
                        <span style={{ display: 'inline-block', background: '#facc15', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                          Pending
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                      {op.gateAction === 'Verify Exit' ? (
                        <button onClick={() => updateGateAction(op.id, op.gateAction)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                          <LogOut size={14} /> Verify Exit
                        </button>
                      ) : op.gateAction === 'Verify Return' ? (
                        <button onClick={() => updateGateAction(op.id, op.gateAction)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#198754', border: '1px solid #198754', color: 'white', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                          <LogIn size={14} /> Verify Return
                        </button>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
                          <Check size={14} /> Done
                        </span>
                      )}
                    </td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
        
        <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748b', background: '#f8fafc' }}>
          <div>Showing <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords === 0 ? 0 : (page - 1) * limit + 1}</span> to <span style={{ fontWeight: 600, color: '#1e293b' }}>{Math.min(page * limit, totalRecords)}</span> of <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords}</span> entries</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderRight: 'none', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '6px 0 0 6px', color: page === 1 ? '#94a3b8' : '#64748b', fontSize: '13px', transition: 'all 0.2s' }}
            >
              Previous
            </button>
            <button
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', minWidth: '32px', padding: '0 12px', border: '1px solid #3b82f6', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: 500, position: 'relative', zIndex: 1, cursor: 'default' }}
            >
              {page}
            </button>
            <button 
              disabled={page >= totalPages || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderLeft: 'none', background: 'white', cursor: page >= totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', borderRadius: '0 6px 6px 0', color: page >= totalPages || totalPages === 0 ? '#94a3b8' : '#0369a1', fontSize: '13px', transition: 'all 0.2s' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '500px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ background: '#0d6efd', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 600, margin: 0 }}>Create & Approve Outpass</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Hosteller</label>
                <Select 
                  options={students.map(s => ({ value: s.id, label: `${s.name} (${s.regNo})` }))}
                  value={formData.studentId ? { value: formData.studentId, label: students.find(s => s.id === formData.studentId)?.name + ' (' + students.find(s => s.id === formData.studentId)?.regNo + ')' } : null}
                  onChange={(selected: any) => setFormData({...formData, studentId: selected ? selected.value : ''})}
                  placeholder="-- Search & Choose Hosteller --"
                  isSearchable={true}
                  styles={{
                    control: (base) => ({
                      ...base,
                      padding: '2px',
                      borderRadius: '6px',
                      borderColor: '#cbd5e1',
                      fontSize: '14px'
                    })
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Destination</label>
                <input value={formData.destination} onChange={(e) => setFormData({...formData, destination: e.target.value})} type="text" placeholder="City, Event, or Home" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', color: '#334155' }} />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Reason</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} placeholder="Explain purpose..." rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', resize: 'vertical', color: '#334155' }}></textarea>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Leave Date & Time</label>
                  <div style={{ position: 'relative' }}>
                    <input type="datetime-local" value={formData.leaveDate} onChange={(e) => setFormData({...formData, leaveDate: e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', color: '#334155' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Expected Return</label>
                  <div style={{ position: 'relative' }}>
                    <input type="datetime-local" value={formData.returnDate} onChange={(e) => setFormData({...formData, returnDate: e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', color: '#334155' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" checked={formData.parentConsent} onChange={(e) => setFormData({...formData, parentConsent: e.target.checked})} id="parent-consent" style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0d6efd' }} />
                <label htmlFor="parent-consent" style={{ fontSize: '14px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Parent / Guardian consent verified via call or message
                </label>
              </div>
            </div>

            <div style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', background: '#64748b', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleIssueOutpass} style={{ padding: '10px 20px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Approve & Issue Outpass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Outpass;
