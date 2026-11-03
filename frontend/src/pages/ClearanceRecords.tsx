import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { LoadingRow, LoadingBlock } from '../components/LoadingSpinner';
import { ClearanceAPI } from '../api/clearance.api';
import { StudentAPI } from '../api/student.api';
import { useNavigate } from 'react-router-dom';
import { X, FileText, FileSpreadsheet, Search } from 'lucide-react';
import Select from 'react-select';

const ClearanceRecords = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [studentOptions, setStudentOptions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    if (isModalOpen && studentOptions.length === 0) {
      loadAllStudents();
    }
  }, [isModalOpen]);

  const loadAllStudents = async () => {
    setIsSearching(true);
    try {
      const data = await StudentAPI.findAll();
      // Filter out vacated students
      const activeStudents = (data.data || data).filter((s: any) => s.status !== 'VACATED');
      const options = activeStudents.map((s: any) => ({
        value: s.id,
        label: `${s.manualRegsiName || s.regNo} - ${s.name} (Room: ${s.roomNo || 'N/A'})`,
        student: s
      }));
      setStudentOptions(options);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base, padding: '4px', borderRadius: '8px', borderColor: state.isFocused ? 'var(--accent)' : 'var(--border)', boxShadow: 'none', '&:hover': { borderColor: 'var(--accent)' }, fontSize: '14px', cursor: 'pointer'
    }),
    option: (base: any, state: any) => ({
      ...base, fontSize: '14px', backgroundColor: state.isSelected ? 'var(--accent)' : state.isFocused ? '#f8f9fa' : 'white', color: state.isSelected ? 'white' : 'var(--text-main)', cursor: 'pointer', padding: '10px 14px'
    })
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const data = await ClearanceAPI.findAll();
      setRecords(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clearance records');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return records.filter(record => {
      const clearanceDate = new Date(record.clearanceDate);
      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (clearanceDate < from) return false;
      }
      if (toDate) {
        const to = new Date(`${toDate}T23:59:59.999`);
        if (clearanceDate > to) return false;
      }
      if (!query) return true;

      return [
        record.student?.name,
        record.student?.manualRegsiName,
        record.student?.regNo,
        record.reason,
        record.remarks,
      ].some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [records, searchQuery, fromDate, toDate]);

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      return;
    }

    const rows = filteredRecords.map(record => ({
      Date: new Date(record.clearanceDate).toLocaleString('en-IN'),
      Student: record.student?.name || 'Unknown',
      'Registration No': record.student?.manualRegsiName || record.student?.regNo || '',
      Reason: record.reason,
      'Pending Dues': Number(record.pendingDues) || 0,
      Deductions: Number(record.deductions) || 0,
      'Net Refund': Number(record.netRefund) || 0,
      Remarks: record.remarks || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clearance Records');
    XLSX.writeFile(workbook, `Clearance_Records_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="ui-page">
      <PageHeader 
        title="Clearance Records"
        subtitle="View history of vacated students and settled dues"
        icon={<FileText size={24} color="#fff" />} iconBg="linear-gradient(135deg, #ec4899 0%, #db2777 100%)"
        rightContent={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleExport} className="ui-btn ui-btn-success" disabled={filteredRecords.length === 0}>
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button
              onClick={() => { setIsModalOpen(true); }}
              className="ui-btn ui-btn-primary"
            >
              Process New Clearance
            </button>
          </div>
        }
      />

      <div className="ui-card ui-card--flush">
        <div className="ui-toolbar">
          <div className="ui-input-icon clearance-records-search">
            <Search size={16} />
            <input
              type="text"
              className="ui-input"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search student, registration, reason..."
              aria-label="Search clearance records"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
            From:
            <input type="date" className="ui-input ui-input--inline" value={fromDate} onChange={event => setFromDate(event.target.value)} aria-label="From date" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
            To:
            <input type="date" className="ui-input ui-input--inline" value={toDate} onChange={event => setToDate(event.target.value)} aria-label="To date" />
          </label>
          {(searchQuery || fromDate || toDate) && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setFromDate(''); setToDate(''); }}
              className="ui-btn ui-btn-secondary"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Reason</th>
                <th>Pending Dues</th>
                <th>Deductions</th>
                <th>Net Refund</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow colSpan={7} text="Loading records..." />
              ) : error ? (
                <tr>
                  <td colSpan={7} className="ui-empty ui-empty--danger">{error}</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ui-empty">{records.length === 0 ? 'No clearance records found.' : 'No records match the selected filters.'}</td>
                </tr>
              ) : (
                filteredRecords.map(record => (
                  <tr key={record.id}>
                    <td>
                      {new Date(record.clearanceDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="ui-cell-name">
                      {record.student?.name || 'Unknown'} <br/>
                      <span className="ui-cell-sub cr-reg">{record.student?.manualRegsiName || record.student?.regNo || ''}</span>
                    </td>
                    <td>{record.reason}</td>
                    <td className="cr-money--danger">₹{record.pendingDues}</td>
                    <td className="cr-money--warning">₹{record.deductions}</td>
                    <td className="cr-money--success">₹{record.netRefund}</td>
                    <td>{record.remarks || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal--md">
            <div className="ui-modal-head">
              <h2 className="ui-modal-title">
                Select Student for Clearance
              </h2>
              <button className="ui-modal-close" onClick={() => setIsModalOpen(false)}><X size={20}/></button>
            </div>
            
            <div className="ui-modal-body">
              <div className="cr-modal-hint">Select a student from the dropdown below to proceed with their clearance process.</div>
              {isSearching ? (
                <LoadingBlock text="Loading students..." />
              ) : (
                <Select 
                  options={studentOptions}
                  placeholder="Search and select student..."
                  onChange={(val: any) => {
                    if (val) navigate(`/hostellers/clearance/${val.value}`);
                  }}
                  styles={selectStyles}
                  isClearable
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClearanceRecords;
