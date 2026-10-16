import { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ClearanceAPI } from '../api/clearance.api';
import { StudentAPI } from '../api/student.api';
import { useNavigate } from 'react-router-dom';
import { X, FileText } from 'lucide-react';
import Select from 'react-select';

const ClearanceRecords = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [studentOptions, setStudentOptions] = useState<any[]>([]);

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

  return (
    <div className="ui-page">
      <PageHeader 
        title="Clearance Records"
        subtitle="View history of vacated students and settled dues"
        icon={<FileText size={24} color="#fff" />} iconBg="linear-gradient(135deg, #ec4899 0%, #db2777 100%)"
        rightContent={
          <button 
            onClick={() => { setIsModalOpen(true); }}
            className="ui-btn ui-btn-primary"
          >
            Process New Clearance
          </button>
        }
      />

      <div className="ui-card ui-card--flush">
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
                <tr>
                  <td colSpan={7} className="ui-empty">Loading records...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="ui-empty ui-empty--danger">{error}</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ui-empty">No clearance records found.</td>
                </tr>
              ) : (
                records.map(record => (
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
                <div className="ui-empty">Loading students...</div>
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
