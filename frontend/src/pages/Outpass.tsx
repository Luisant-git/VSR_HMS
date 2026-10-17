import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, X, LogOut, Check, LogIn, FileSpreadsheet, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentAPI } from '../api/student.api';
import { OutpassAPI } from '../api/outpass.api';
import { MessDeductionAPI } from '../api/mess-deduction.api';
import { PageHeader } from '../components/PageHeader';
import Select from 'react-select';
import { LoadingRow } from '../components/LoadingSpinner';

const Outpass = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [outpasses, setOutpasses] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
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
    }).finally(() => setLoading(false));
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
      const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
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

  const handleExportExcel = () => {
    const data = filteredOutpasses.map((op: any) => {
      const leave = formatDateTime(op.leaveDate);
      const ret = formatDateTime(op.returnDate);
      const daysOut = Math.max(1, Math.ceil((new Date(op.returnDate).getTime() - new Date(op.leaveDate).getTime()) / (1000 * 3600 * 24)));
      return {
        'OUTPASS #': op.outpassId || '',
        'STUDENT NAME': op.student?.name || '',
        'REGIS NO': op.student?.manualRegsiName || op.student?.regNo || '',
        'ROOM NO': op.student?.room?.id || op.student?.roomNo || '',
        'DESTINATION': op.destination || '',
        'REASON': op.reason || '',
        'SCHEDULED LEAVE': `${leave.dateStr} ${leave.timeStr}`.trim(),
        'EXPECTED RETURN': `${ret.dateStr} ${ret.timeStr}`.trim(),
        'DURATION (DAYS)': daysOut,
        'PARENT CONSENT': op.parentConsent ? 'Verified' : 'Not Verified',
        'STATUS': op.status || '',
        'GATE ACTION': op.gateAction || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Outpasses");
    XLSX.writeFile(workbook, "Outpasses_Export.xlsx");
  };

  return (
    <div className="ui-page">
      <PageHeader
        title="Digital Outpass Management"
        subtitle="Issue, approve, and verify gate movement for student outpasses"
        icon={<FileText size={24} color="#fff" />} iconBg="linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)"
        rightContent={
          <>
            <button onClick={handleExportExcel} className="ui-btn ui-btn-success">
              <FileSpreadsheet size={18} />
              Export Excel
            </button>
            <button onClick={() => setIsModalOpen(true)} className="ui-btn ui-btn-primary">
              <FileText size={18} /> Issue Digital Outpass
            </button>
          </>
        }
      />

      <div className="ui-card ui-card--flush">
        <div className="ui-card-head">
          <h3 className="ui-card-title">Outpasses Master Register</h3>
          <div className="ui-filters">
            <div className="ui-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search outpasses..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              />
              {searchTerm && (
                <button className="ui-search-clear" onClick={() => { setSearchTerm(''); setPage(1); }}>
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="ui-field-inline">
              <label className="ui-field-label">From:</label>
              <input type="date" className="ui-input ui-input--inline" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
            </div>
            <div className="ui-field-inline">
              <label className="ui-field-label">To:</label>
              <input type="date" className="ui-input ui-input--inline" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} />
            </div>
            {(fromDate || toDate) && (
              <button className="ui-btn ui-btn-soft ui-btn-sm" onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}>
                Clear Dates
              </button>
            )}
          </div>
        </div>

        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Outpass #</th>
                <th>Student &amp; Room</th>
                <th>Reason &amp; Destination</th>
                <th>Scheduled Leave</th>
                <th>Expected Return</th>
                <th>Duration &amp; Consent</th>
                <th>Status</th>
                <th className="outpass-center">Gate Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow colSpan={8} />
              ) : error ? (
                <tr>
                  <td colSpan={8} className="ui-empty ui-empty--danger">
                    {error}
                  </td>
                </tr>
              ) : filteredOutpasses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="ui-empty">
                    No outpasses found.
                  </td>
                </tr>
              ) : (
              filteredOutpasses.map((op, idx) => {
                const leave = formatDateTime(op.leaveDate);
                const ret = formatDateTime(op.returnDate);
                const daysOut = Math.max(1, Math.ceil((new Date(op.returnDate).getTime() - new Date(op.leaveDate).getTime()) / (1000 * 3600 * 24)));
                return (
                  <tr key={idx}>
                    <td className="ui-cell-link">{op.outpassId}</td>
                    <td>
                      <div className="ui-cell-name">{op.student?.name}</div>
                      <div className="ui-cell-sub">{op.student?.manualRegsiName || op.student?.regNo} | <br/>{op.student?.room?.id}</div>
                    </td>
                    <td>
                      <div className="ui-cell-name">{op.destination}</div>
                      <div className="ui-cell-sub">{op.reason}</div>
                    </td>
                    <td>
                      {leave.dateStr}<br/>{leave.timeStr}
                    </td>
                    <td>
                      {ret.dateStr}<br/>{ret.timeStr}
                    </td>
                    <td>
                      <div className="ui-cell-name outpass-days">
                        {daysOut} {daysOut === 1 ? 'Day' : 'Days'}
                      </div>
                      {daysOut > deductionThreshold && (
                        <div className="outpass-days">
                          <span className="ui-badge ui-badge-danger">Mess Deduction Eligible</span>
                        </div>
                      )}
                      {op.parentConsent && (
                        <span className="ui-badge ui-badge-success">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      )}
                    </td>
                    <td>
                      {op.status === 'Approved' && (
                        <span className="ui-badge ui-badge-success">Approved</span>
                      )}
                      {op.status === 'Active Out' && (
                        <span className="ui-badge ui-badge-warning">Active Out</span>
                      )}
                      {op.status === 'Closed Returned' && (
                        <span className="ui-badge ui-badge-neutral">Closed Returned</span>
                      )}
                      {op.status === 'Pending' && (
                        <span className="ui-badge ui-badge-info">Pending</span>
                      )}
                    </td>
                    <td className="outpass-center">
                      {op.gateAction === 'Verify Exit' ? (
                        <button onClick={() => updateGateAction(op.id, op.gateAction)} className="ui-btn ui-btn-sm ui-btn-outline-danger">
                          <LogOut size={14} /> Verify Exit
                        </button>
                      ) : op.gateAction === 'Verify Return' ? (
                        <button onClick={() => updateGateAction(op.id, op.gateAction)} className="ui-btn ui-btn-sm ui-btn-success">
                          <LogIn size={14} /> Verify Return
                        </button>
                      ) : (
                        <span className="ui-cell-muted outpass-done">
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
        
        <div className="ui-pagination">
          <div>Showing <span className="ui-strong">{totalRecords === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="ui-strong">{Math.min(page * limit, totalRecords)}</span> of <span className="ui-strong">{totalRecords}</span> entries</div>
          <div className="ui-pager">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="ui-page-btn"
            >
              Previous
            </button>
            <button className="ui-page-btn ui-page-btn--active">
              {page}
            </button>
            <button
              disabled={page >= totalPages || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
              className="ui-page-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="ui-modal-overlay">
          <div className="ui-modal">
            <div className="ui-modal-head">
              <h3 className="ui-modal-title">Create &amp; Approve Outpass</h3>
              <button className="ui-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="ui-modal-body">
              <div>
                <label className="ui-label">Hosteller</label>
                <Select 
                  options={students.map(s => ({ value: s.id, label: `${s.name} (${s.manualRegsiName || s.regNo})` }))}
                  value={formData.studentId ? { value: formData.studentId, label: students.find(s => s.id === formData.studentId)?.name + ' (' + (students.find(s => s.id === formData.studentId)?.manualRegsiName || students.find(s => s.id === formData.studentId)?.regNo) + ')' } : null}
                  onChange={(selected: any) => setFormData({...formData, studentId: selected ? selected.value : ''})}
                  placeholder="-- Search & Choose Hosteller --"
                  isSearchable={true}
                  styles={{
                    control: (base) => ({
                      ...base,
                      padding: '2px',
                      borderRadius: '6px',
                      borderColor: 'var(--border)',
                      fontSize: '14px'
                    })
                  }}
                />
              </div>

              <div>
                <label className="ui-label">Destination</label>
                <input value={formData.destination} onChange={(e) => setFormData({...formData, destination: e.target.value})} type="text" placeholder="City, Event, or Home" className="ui-input" />
              </div>

              <div>
                <label className="ui-label">Reason</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} placeholder="Explain purpose..." rows={3} className="ui-textarea"></textarea>
              </div>

              <div className="ui-grid-2">
                <div>
                  <label className="ui-label">Leave Date &amp; Time</label>
                  <input type="datetime-local" value={formData.leaveDate} onChange={(e) => setFormData({...formData, leaveDate: e.target.value})} className="ui-input" />
                </div>
                <div>
                  <label className="ui-label">Expected Return</label>
                  <input type="datetime-local" value={formData.returnDate} onChange={(e) => setFormData({...formData, returnDate: e.target.value})} className="ui-input" />
                </div>
              </div>

              <div className="outpass-consent">
                <input type="checkbox" checked={formData.parentConsent} onChange={(e) => setFormData({...formData, parentConsent: e.target.checked})} id="parent-consent" />
                <label htmlFor="parent-consent">
                  Parent / Guardian consent verified via call or message
                </label>
              </div>
            </div>

            <div className="ui-modal-foot">
              <button className="ui-btn ui-btn-soft" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="ui-btn ui-btn-primary" onClick={handleIssueOutpass}>
                Approve &amp; Issue Outpass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Outpass;
