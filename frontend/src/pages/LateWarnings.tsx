import { useState, useEffect } from 'react';

import { AlertTriangle, CheckCircle2, X, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { gateLogApi } from '../api/gatelog.api';
import { toast } from 'react-toastify';

const LateWarnings = () => {
  const [missingLogs, setMissingLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [lateRemarks, setLateRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchMissing();
  }, [page, limit, searchTerm, fromDate, toDate]);

  const fetchMissing = async () => {
    try {
      setError(null);
      const res = await gateLogApi.getMissing({ page, limit, search: searchTerm, fromDate, toDate });
      const data = Array.isArray(res) ? res : (res.data || []);
      setMissingLogs(data);
      setTotalPages(res.totalPages || 1);
      setTotalRecords(res.total || data.length);
    } catch (err) {
      console.error(err);
      setError('Failed to load missing alerts');
    } finally {
      setLoading(false);
    }
  };

  const getDelayString = (expectedInTime: string, inTime?: string) => {
    const end = inTime ? new Date(inTime).getTime() : new Date().getTime();
    const diffMs = end - new Date(expectedInTime).getTime();
    if (diffMs <= 0) return '';
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHrs > 0) return `Late by ${diffHrs}h ${diffMins}m`;
    return `Late by ${diffMins}m`;
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

  const safeMissingLogs = Array.isArray(missingLogs) ? missingLogs : (missingLogs as any).data || [];
  const hasCritical = safeMissingLogs.filter((l: any) => !l.inTime).length > 0;
  
  return (
    <div className="ui-page">
      <PageHeader
        title="Late Return Warnings & Missing Alerts"
        subtitle="Automatic real-time alerts for hostellers who failed to return by the standard deadline or their stated check-in time"
        showBack={true}
        icon={<AlertTriangle size={24} color="#fff" />} iconBg="linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)"
      />

      <div className={`ui-card ui-card--flush${hasCritical ? ' latewarn-card--critical' : ''}`}>
        <div className={`ui-toolbar latewarn-head${hasCritical ? ' latewarn-head--critical' : ''}`}>
          <div className="latewarn-status">
            {hasCritical ? (
              <AlertTriangle size={20} color="#e11d48" />
            ) : (
              <CheckCircle2 size={20} color="#10b981" />
            )}
            <h3 className={`latewarn-title${hasCritical ? ' latewarn-title--critical' : ''}`}>
              {safeMissingLogs.filter((l: any) => !l.inTime).length} Critical Alerts Active
            </h3>
          </div>
          <div className="ui-filters ui-spacer">
            <div className="ui-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search alerts..."
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
        
        <div className="table-responsive">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Student &amp; Room</th>
                <th>Reason</th>
                <th>Expected Return</th>
                <th>Current Delay</th>
                <th>Contact</th>
                <th className="latewarn-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="ui-empty">Loading...</td></tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="ui-empty ui-empty--danger">
                    {error}
                  </td>
                </tr>
              ) : safeMissingLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ui-empty">
                    No late warnings currently. All students are either inside or not yet overdue.
                  </td>
                </tr>
              ) : (
                safeMissingLogs.map((log: any) => {
                  const isHistorical = !!log.inTime;
                  return (
                    <tr key={log.id} className={isHistorical ? 'latewarn-row--history' : ''}>
                      <td>
                        <div className="ui-cell-name">{log.student.name}</div>
                        <div className="ui-cell-sub">{log.student.manualRegsiName || log.student.regNo} | Room {log.student.room?.id || '-'}</div>
                      </td>
                      <td className="latewarn-capitalize">{log.reason || '-'}</td>
                      <td className="ui-cell-name">{new Date(log.expectedInTime).toLocaleString('en-GB')}</td>
                      <td><span className={`ui-badge ${isHistorical ? 'ui-badge-warning' : 'ui-badge-danger'}`}>{getDelayString(log.expectedInTime, log.inTime)}</span></td>
                      <td>
                        <div className="ui-cell-link">{log.student.mobileNo || '-'} (Self)</div>
                        <div className="ui-cell-sub">{log.student.fatherMobileNo || '-'} (Parent)</div>
                      </td>
                      <td className="latewarn-right">
                        {isHistorical ? (
                          <span className="ui-badge ui-badge-success">Returned</span>
                        ) : (
                          <button
                            onClick={() => { setSelectedStudentId(log.studentId); setIsModalOpen(true); }}
                            className="ui-btn ui-btn-danger ui-btn-sm"
                          >
                            Mark Reached
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
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

      {isModalOpen && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal--sm">
            <div className="ui-modal-head">
              <h3 className="ui-modal-title">Late Return Reason</h3>
            </div>
            <div className="ui-modal-body">
              <p className="latewarn-modal-text">Please provide a reason or note regarding why the student returned late. This will be permanently recorded in the master logs.</p>
              <textarea
                value={lateRemarks}
                onChange={e => setLateRemarks(e.target.value)}
                placeholder="e.g. Traffic jam, bus delayed, stayed extra at college..."
                className="ui-textarea"
                autoFocus
              />
            </div>
            <div className="ui-modal-foot">
              <button
                className="ui-btn ui-btn-soft"
                onClick={() => { setIsModalOpen(false); setLateRemarks(''); setSelectedStudentId(null); }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="ui-btn ui-btn-danger"
                onClick={submitLateReason}
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
