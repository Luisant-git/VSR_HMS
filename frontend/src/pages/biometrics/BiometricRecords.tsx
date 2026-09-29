import { useState, useEffect } from 'react';
import { Search, Filter, Check, X, RefreshCw, Trash2, User } from 'lucide-react';
import { StudentAPI } from '../../api/student.api';

const BiometricRecords = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  useEffect(() => {
    // Fetch students and append mock biometric status
    StudentAPI.findAll().then(data => {
      const activeStudents = data.filter((s: any) => s.status !== 'Vacated');
      
      // Inject mock biometric data for UI demonstration
      const withBiometrics = activeStudents.map((s: any) => {
        // Randomly assign some to be pending, some fully registered, some partial
        const r = Math.random();
        let faceStatus = true;
        let fingerStatus = true;
        
        if (r < 0.1) {
          faceStatus = false; fingerStatus = false;
        } else if (r < 0.15) {
          faceStatus = true; fingerStatus = false;
        } else if (r < 0.2) {
          faceStatus = false; fingerStatus = true;
        }

        return {
          ...s,
          biometric: {
            faceRegistered: faceStatus,
            fingerRegistered: fingerStatus,
            registeredDate: (faceStatus || fingerStatus) ? new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString() : null,
            lastVerified: (faceStatus || fingerStatus) ? new Date(Date.now() - Math.floor(Math.random() * 100000000)).toISOString() : null,
            device: 'DEV-FC-99012'
          }
        };
      });
      setStudents(withBiometrics);
    }).catch(console.error);
  }, []);

  const filteredRecords = students.filter(student => {
    const matchesSearch = (student.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (student.regNo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (student.roomNo?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'All') return matchesSearch;
    if (statusFilter === 'Pending') return matchesSearch && (!student.biometric.faceRegistered && !student.biometric.fingerRegistered);
    if (statusFilter === 'Complete') return matchesSearch && (student.biometric.faceRegistered && student.biometric.fingerRegistered);
    if (statusFilter === 'Partial') return matchesSearch && ((student.biometric.faceRegistered && !student.biometric.fingerRegistered) || (!student.biometric.faceRegistered && student.biometric.fingerRegistered));
    
    return matchesSearch;
  });

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)' }}>Biometric Registration Records</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '5px' }}>
            View and manage biometric templates and synchronization status across all hostellers.
          </p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input 
                type="text" 
                placeholder="Search by name, ID, room..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '9px 15px 9px 36px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '280px', outline: 'none' }}
              />
            </div>
            
            <div style={{ position: 'relative' }}>
              <Filter size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '9px 15px 9px 36px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', appearance: 'none', background: 'white', cursor: 'pointer', minWidth: '150px' }}
              >
                <option value="All">All Statuses</option>
                <option value="Complete">Fully Registered</option>
                <option value="Partial">Partial Registration</option>
                <option value="Pending">Pending Setup</option>
              </select>
            </div>
          </div>
          
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
            Showing {filteredRecords.length} records
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room/Bed</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Face Data</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Fingerprint</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Verified</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No biometric records found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((student) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='#f8fafc'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt="Student" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={18} color="#64748b" />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{student.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{student.regNo}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>{student.roomNo || '-'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{student.bedNo || '-'}</div>
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                      {student.biometric.faceRegistered ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#16a34a', background: '#dcfce7', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                          <Check size={14} /> Registered
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#94a3b8', background: '#f1f5f9', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                          <X size={14} /> Pending
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                      {student.biometric.fingerRegistered ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#16a34a', background: '#dcfce7', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                          <Check size={14} /> Registered
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#94a3b8', background: '#f1f5f9', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                          <X size={14} /> Pending
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px', fontSize: '13px', color: '#475569' }}>
                      {student.biometric.lastVerified ? new Date(student.biometric.lastVerified).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      {student.biometric.faceRegistered && student.biometric.fingerRegistered ? (
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', marginRight: '8px' }}></span>
                      ) : (!student.biometric.faceRegistered && !student.biometric.fingerRegistered) ? (
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', marginRight: '8px' }}></span>
                      ) : (
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%', marginRight: '8px' }}></span>
                      )}
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                        {student.biometric.faceRegistered && student.biometric.fingerRegistered ? 'Synced' : (!student.biometric.faceRegistered && !student.biometric.fingerRegistered) ? 'Action Needed' : 'Partial Sync'}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button title="Re-register" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '5px' }}>
                          <RefreshCw size={16} />
                        </button>
                        <button title="Delete Biometric" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '5px' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination mock */}
        <div style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Showing 1 to {filteredRecords.length} of {filteredRecords.length} entries
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button style={{ padding: '5px 10px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '4px', cursor: 'not-allowed', color: '#94a3b8', fontSize: '13px' }}>Previous</button>
            <button style={{ padding: '5px 12px', border: '1px solid #3b82f6', background: '#3b82f6', borderRadius: '4px', cursor: 'pointer', color: 'white', fontSize: '13px' }}>1</button>
            <button style={{ padding: '5px 10px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '4px', cursor: 'not-allowed', color: '#94a3b8', fontSize: '13px' }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiometricRecords;
