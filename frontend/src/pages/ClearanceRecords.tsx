import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ClearanceAPI } from '../api/clearance.api';
import { StudentAPI } from '../api/student.api';
import { useNavigate } from 'react-router-dom';
import { Search, X, User } from 'lucide-react';
import Select from 'react-select';

const ClearanceRecords = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
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
        label: `${s.regNo} - ${s.name} (Room: ${s.roomNo || 'N/A'})`,
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
      ...base, padding: '4px', borderRadius: '8px', borderColor: state.isFocused ? '#4f46e5' : '#e2e8f0', boxShadow: 'none', '&:hover': { borderColor: '#4f46e5' }, fontSize: '14px', cursor: 'pointer'
    }),
    option: (base: any, state: any) => ({
      ...base, fontSize: '14px', backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#f8f9fa' : 'white', color: state.isSelected ? 'white' : '#334155', cursor: 'pointer', padding: '10px 14px'
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
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader 
        title="Clearance Records"
        subtitle="View history of vacated students and settled dues"
        rightContent={
          <button 
            onClick={() => { setIsModalOpen(true); setSearchQuery(''); setSearchResults([]); }}
            style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#4f46e5', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)' }}
          >
            Process New Clearance
          </button>
        }
      />

      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '20px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Student</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Reason</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Pending Dues</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Deductions</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Net Refund</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading records...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No clearance records found.</td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#334155' }}>
                      {new Date(record.clearanceDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                      {record.student?.name || 'Unknown'} <br/>
                      <span style={{ fontWeight: 'normal', color: '#64748b', fontSize: '12px' }}>{record.student?.regNo || ''}</span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#334155' }}>{record.reason}</td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#ef4444', fontWeight: 600 }}>₹{record.pendingDues}</td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#f59e0b', fontWeight: 600 }}>₹{record.deductions}</td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#10b981', fontWeight: 600 }}>₹{record.netRefund}</td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#334155' }}>{record.remarks || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Select Student for Clearance
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ color: '#64748b', fontSize: '13px' }}>Select a student from the dropdown below to proceed with their clearance process.</div>
                {isSearching ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>Loading students...</div>
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
        </div>
      )}
    </div>
  );
};

export default ClearanceRecords;
