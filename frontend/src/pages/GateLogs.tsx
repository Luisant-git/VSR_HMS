import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, CheckCircle2, Search, AlertTriangle, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { StudentAPI } from '../api/student.api';
import { gateLogApi } from '../api/gatelog.api';
import { toast } from 'react-toastify';

const getLocalNow = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

const getDefaultExpectedReturn = () => {
  const now = new Date();
  now.setHours(20, 30, 0, 0); // 8:30 PM
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

const GateLogs = () => {
  const navigate = useNavigate();
  const [movementType, setMovementType] = useState('EXIT');
  const [students, setStudents] = useState<any[]>([]);
  const [gateLogs, setGateLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters for "Currently Outside Campus"
  const [outsideSearch, setOutsideSearch] = useState('');
  const [outsideRoom, setOutsideRoom] = useState('-- All Rooms --');
  const [outsideCollege, setOutsideCollege] = useState('-- All Colleges --');

  
  // Form State
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [time, setTime] = useState(getLocalNow());
  const [purpose, setPurpose] = useState<any>(null);
  const [expectedReturnTime, setExpectedReturnTime] = useState(getDefaultExpectedReturn());
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [page, searchQuery, fromDate, toDate, statusFilter]);

  const fetchData = async () => {
    try {
      setError(null);
      const [studentsRes, logsRes] = await Promise.all([
        StudentAPI.findAll({ limit: 5000 }),
        gateLogApi.getAll(page, 5, searchQuery, fromDate, toDate, statusFilter)
      ]);
      setStudents(studentsRes);
      setGateLogs(logsRes.data || []);
      setTotalPages(logsRes.totalPages || 1);
      setTotalRecords(logsRes.total || 0);
    } catch (err) {
      console.error('Failed to fetch data', err);
      setError('Failed to load gate logs');
    }
  };

  const safeStudents = Array.isArray(students) ? students : ((students as any).data || []);
  const activeStudents = safeStudents.filter((s: any) => s.status !== 'Vacated');
  
  const allRooms = ['-- All Rooms --', ...Array.from(new Set(activeStudents.map((s: any) => s.room?.id ? `Room ${s.room.id}` : null).filter(Boolean))).sort((a: any, b: any) => a.localeCompare(b, undefined, { numeric: true }))];
  const allColleges = ['-- All Colleges --', ...Array.from(new Set(activeStudents.map((s: any) => s.college?.name || (typeof s.college === 'string' ? s.college : null)).filter(Boolean))).sort()];


  // If EXIT, only show students who are 'In'. If ENTRY, only 'Out' or 'Missing'.
  const availableStudents = activeStudents.filter((s: any) => 
    movementType === 'EXIT' ? s.status === 'In' : (s.status === 'Out' || s.status === 'Missing')
  );

  const studentOptions = availableStudents.map((s: any) => ({
    value: s.id,
    label: `${s.name} (${s.regNo} - Room ${s.room?.id || 'N/A'} - ${s.mobileNo || 'No Mobile'})`,
    student: s
  }));

  const purposeOptions = [
    { value: 'college', label: 'College / Classes / Lab' },
    { value: 'market', label: 'Market / Shopping / Stationery' },
    { value: 'job', label: 'Job / Internship / Office' },
    { value: 'home', label: 'Going Home / Family' },
    { value: 'hospital', label: 'Hospital / Medical Clinic' },
    { value: 'other', label: 'Other / Personal' }
  ];

  const handleQuickCheckIn = async (studentId: string) => {
    try {
      await gateLogApi.create({
        studentId,
        movementType: 'ENTRY',
        time: new Date().toISOString(),
        remarks: 'Quick Check-In from Dashboard'
      });
      toast.success('Student checked in successfully!');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to check in student');
    }
  };

  const handleSubmit = async () => {
    if (!selectedStudent) {
      toast.warning('Please select a student');
      return;
    }
    if (!time) {
      toast.warning('Please select a movement time');
      return;
    }
    if (movementType === 'EXIT' && !purpose) {
      toast.warning('Please select a purpose for leaving');
      return;
    }

    setLoading(true);
    try {
      await gateLogApi.create({
        studentId: selectedStudent.value,
        movementType,
        time,
        purpose: purpose ? purpose.value : undefined,
        expectedReturnTime: expectedReturnTime ? expectedReturnTime : undefined,
        remarks: remarks ? remarks : undefined
      });
      toast.success('Gate log recorded successfully!');
      // Reset form
      setSelectedStudent(null);
      setPurpose(null);
      setExpectedReturnTime(getDefaultExpectedReturn());
      setRemarks('');
      setTime(getLocalNow());
      // Refresh
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record movement');
    } finally {
      setLoading(false);
    }
  };

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      padding: '4px',
      borderRadius: '6px',
      borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1',
      boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
      '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#94a3b8' },
      fontSize: '14px',
      cursor: 'pointer'
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '14px',
      backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
      color: state.isSelected ? 'white' : '#334155',
      cursor: 'pointer',
      padding: '12px 16px',
      '&:active': { backgroundColor: state.isSelected ? 'var(--sidebar-active)' : '#e2e8f0' }
    })
  };

  const currentlyOutRaw = activeStudents.filter((s: any) => s.status === 'Out' || s.status === 'Missing');
  const currentlyOut = currentlyOutRaw.filter((s: any) => {
    let match = true;
    if (outsideSearch) {
      const q = outsideSearch.toLowerCase();
      const n = s.name?.toLowerCase() || '';
      const r = s.regNo?.toLowerCase() || '';
      const m = s.mobileNo?.toLowerCase() || '';
      if (!n.includes(q) && !r.includes(q) && !m.includes(q)) match = false;
    }
    if (outsideRoom !== '-- All Rooms --') {
      const rId = `Room ${s.room?.id}`;
      if (rId !== outsideRoom) match = false;
    }
    if (outsideCollege !== '-- All Colleges --') {
      const cName = s.college?.name || (typeof s.college === 'string' ? s.college : '');
      if (cName !== outsideCollege) match = false;
    }
    return match;
  });

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Gate In / Out Movement Tracking"
        subtitle="Record real-time gate exits and entries for hostel students"
        showBack={false}
        rightContent={
          <>
            <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} onMouseOut={(e) => e.currentTarget.style.background = 'white'}>
               <ArrowLeft size={16} /> Back
            </button>
            <button onClick={() => navigate('/late-warnings')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#e11d48', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(225, 29, 72, 0.3)' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(225, 29, 72, 0.4)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(225, 29, 72, 0.3)'; }}>
              <AlertTriangle size={16} /> Check Missing Alerts
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '25px', alignItems: 'flex-start' }}>
        
        {/* Left Column: Form & Current Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', position: 'sticky', top: '20px' }}>
          
          {/* Log Movement Form */}
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
              Log Student Movement
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Movement Type *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => { setMovementType('EXIT'); setSelectedStudent(null); }}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: movementType === 'EXIT' ? '1px solid #dc3545' : '1px solid #cbd5e1', background: movementType === 'EXIT' ? '#dc3545' : 'white', color: movementType === 'EXIT' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', boxShadow: movementType === 'EXIT' ? '0 4px 10px rgba(220, 53, 69, 0.3)' : 'none' }}
                  >
                    <LogOut size={16} /> EXIT (Going Out)
                  </button>
                  <button 
                    onClick={() => { setMovementType('ENTRY'); setSelectedStudent(null); }}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: movementType === 'ENTRY' ? '1px solid #198754' : '1px solid #cbd5e1', background: movementType === 'ENTRY' ? '#198754' : 'white', color: movementType === 'ENTRY' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', boxShadow: movementType === 'ENTRY' ? '0 4px 10px rgba(25, 135, 84, 0.3)' : 'none' }}
                  >
                    <LogIn size={16} /> ENTRY (Returning In)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Select Student *</label>
                <Select 
                  options={studentOptions}
                  value={selectedStudent}
                  onChange={setSelectedStudent}
                  placeholder={`-- Choose Student to ${movementType} --`}
                  styles={selectStyles}
                  isSearchable={true}
                  isClearable={true}
                  noOptionsMessage={() => `No students currently ${movementType === 'EXIT' ? 'Inside' : 'Outside'}`}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Movement Time</label>
                <input 
                  type="datetime-local" 
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} 
                />
              </div>

              {movementType === 'EXIT' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Purpose</label>
                    <Select 
                      options={purposeOptions}
                      value={purpose}
                      onChange={setPurpose}
                      placeholder="Select Purpose"
                      styles={selectStyles}
                      isSearchable={true}
                      isClearable={true}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Expected Return Time</label>
                    <input 
                      type="datetime-local" 
                      value={expectedReturnTime}
                      onChange={e => setExpectedReturnTime(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} 
                    />
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Hostel standard curfew is 8:30 PM.</div>
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Remarks / Gate Note</label>
                <textarea 
                  rows={2} 
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Optional notes" 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                ></textarea>
              </div>

              <button 
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)', marginTop: '5px', opacity: loading ? 0.7 : 1 }}
              >
                <CheckCircle2 size={18} /> {loading ? 'Saving...' : `Record ${movementType}`}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: History Table & Currently Outside */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* Currently Outside Campus */}
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ padding: '25px 25px 15px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: '#eab308' }}>🚶</span> Currently Outside Campus
              </h3>
              <div style={{ fontSize: '13px', color: '#64748b' }}>{currentlyOut.length} student(s) currently marked as OUT</div>
            </div>
            
            <div style={{ padding: '15px 25px', borderBottom: '1px solid var(--border-color)', background: '#f8fafc', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Search Name, Reg No or Mobile..." 
                  value={outsideSearch}
                  onChange={e => setOutsideSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <select 
                value={outsideRoom}
                onChange={e => setOutsideRoom(e.target.value)}
                style={{ width: '150px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer' }}
              >
                {allRooms.map((r: any) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select 
                value={outsideCollege}
                onChange={e => setOutsideCollege(e.target.value)}
                style={{ width: '180px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer' }}
              >
                {allColleges.map((c: any) => <option key={c} value={c}>{c}</option>)}
              </select>
              {(outsideSearch || outsideRoom !== '-- All Rooms --' || outsideCollege !== '-- All Colleges --') && (
                <button
                  onClick={() => {
                    setOutsideSearch('');
                    setOutsideRoom('-- All Rooms --');
                    setOutsideCollege('-- All Colleges --');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '4px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#fef2f2'}
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>
            
            {currentlyOut.length === 0 ? (
              <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textAlign: 'center' }}>
                <Clock size={32} style={{ marginBottom: '10px', color: '#cbd5e1' }} />
                <div style={{ fontSize: '13px', fontWeight: 500 }}>All hostellers are currently inside campus.</div>
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#475569', fontWeight: 600, letterSpacing: '0.05em', background: '#f8fafc' }}>
                    <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Student</th>
                    <th style={{ padding: '16px 10px', borderBottom: '1px solid #e2e8f0' }}>Room</th>
                    <th style={{ padding: '16px 10px', borderBottom: '1px solid #e2e8f0' }}>Exit<br/>Time</th>
                    <th style={{ padding: '16px 10px', borderBottom: '1px solid #e2e8f0' }}>Expected Return</th>
                    <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Quick<br/>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentlyOut.map((s: any) => {
                    const latestExit = gateLogs.find(log => log.studentId === s.id && log.movementType === 'EXIT');
                    const isOverdue = latestExit && latestExit.expectedInTime && new Date(latestExit.expectedInTime) < new Date();
                    
                    const formatTimeOnly = (dateStr: string | null) => {
                      if (!dateStr) return '-';
                      const d = new Date(dateStr);
                      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                      const [time, period] = timeStr.split(' ');
                      return <>{time}<br/>{period}</>;
                    };
                    
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: isOverdue ? '#fce8eb' : 'white' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{s.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                            {s.regNo} | <br/>
                            {latestExit?.reason || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '16px 10px' }}>
                          <span style={{ display: 'inline-block', background: '#64748b', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                            {s.room?.id || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 10px', color: '#1e293b' }}>
                          {formatTimeOnly(latestExit?.outTime)}
                        </td>
                        <td style={{ padding: '16px 10px' }}>
                          <div style={{ fontWeight: 600, color: isOverdue ? '#e11d48' : '#1e293b' }}>
                            {formatTimeOnly(latestExit?.expectedInTime)}
                          </div>
                          {isOverdue && (
                            <span style={{ display: 'inline-block', background: '#e11d48', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, marginTop: '4px' }}>
                              OVERDUE
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleQuickCheckIn(s.id)}
                            style={{ padding: '8px 14px', fontSize: '13px', background: '#198754', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#157347'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#198754'}
                          >
                            <LogIn size={14} /> Check-In
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Full Width: Master Gate Movement Log History */}
      <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', marginTop: '25px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Clock size={20} color="#0d6efd" /> Master Gate Movement Log History
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                  style={{ padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', color: '#64748b' }}
                />
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                  style={{ padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', color: '#64748b' }}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{ padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', color: '#64748b', background: 'white' }}
                >
                  <option value="">All Statuses</option>
                  <option value="Entry">Entry</option>
                  <option value="Exit">Exit</option>
                </select>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    placeholder="Search Name, Reg No, Room, Mobile..." 
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    style={{ padding: '8px 10px 8px 30px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', width: '220px', color: '#64748b' }} 
                  />
                </div>
                {(fromDate || toDate || statusFilter || searchQuery) && (
                  <button
                    onClick={() => {
                      setFromDate('');
                      setToDate('');
                      setStatusFilter('');
                      setSearchQuery('');
                      setPage(1);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '4px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  >
                    <X size={14} /> Clear
                  </button>
                )}
              </div>
            </div>

            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left', color: '#1e293b' }}>
                <thead>
                  <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', background: '#f8fafc' }}>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>#</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Movement Status</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Student Details</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Room</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Purpose</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Exit Time</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Expected Return</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Entry Time</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Return Note</th>
                    <th style={{ padding: '16px 15px', borderBottom: '1px solid #e2e8f0' }}>Security Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {error ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>{error}</td>
                    </tr>
                  ) : gateLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No gate movements found</td>
                    </tr>
                  ) : (
                    gateLogs.map((log: any, index: number) => {
                      // Determine status based on whether the student has returned (has inTime)
                      // Legacy ENTRY logs (from before the update) will also be rendered gracefully since they have inTime.
                      const status = log.movementType === 'ENTRY' || log.inTime ? 'Entry' : 'Exit';
                      const formatDateTime = (dateStr: string | null) => {
                        if (!dateStr) return '—';
                        const d = new Date(dateStr);
                        const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        return <>{datePart}<br/>{timePart}</>;
                      };
                      


                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: 'white', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                          <td style={{ padding: '20px 15px', color: '#64748b', fontWeight: 500 }}>{index + 1}</td>
                          <td style={{ padding: '20px 15px' }}>
                            {status === 'Entry' ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0d6efd', color: '#ffffff', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, minWidth: '50px' }}>
                                Entry
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#64748b', color: '#ffffff', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, minWidth: '50px' }}>
                                Exit
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '20px 15px' }}>
                            <a href={`/students/${log.student.regNo}`} style={{ color: '#2563eb', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>{log.student.name}</a>
                            <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{log.student.regNo}</div>
                          </td>
                          <td style={{ padding: '20px 15px', color: '#475569', fontWeight: 500 }}>{log.student.room?.id || '-'}</td>
                          <td style={{ padding: '20px 15px', color: '#475569', textTransform: 'capitalize' }}>{log.reason || '—'}</td>
                          <td style={{ padding: '20px 15px', color: '#475569' }}>{formatDateTime(log.outTime)}</td>
                          <td style={{ padding: '20px 15px', color: '#475569' }}>{formatDateTime(log.expectedInTime)}</td>
                          <td style={{ padding: '20px 15px', color: '#475569' }}>{formatDateTime(log.inTime)}</td>
                          <td style={{ padding: '20px 15px', color: '#475569' }}>{log.lateRemarks || '—'}</td>
                          <td style={{ padding: '20px 15px', color: '#475569' }}>Main Gate<br/>Security</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', fontSize: '13px', color: '#64748b' }}>
              <div>Showing <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords === 0 ? 0 : (page - 1) * 5 + 1}</span> to <span style={{ fontWeight: 600, color: '#1e293b' }}>{Math.min(page * 5, totalRecords)}</span> of <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords}</span> entries</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '36px', padding: '0 15px', border: '1px solid #e2e8f0', borderRight: 'none', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '6px 0 0 6px', color: page === 1 ? '#94a3b8' : '#64748b', fontSize: '14px', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { if(page !== 1) { e.currentTarget.style.background = '#f8fafc'; } }}
                  onMouseOut={(e) => { if(page !== 1) { e.currentTarget.style.background = 'white'; } }}
                >
                  Previous
                </button>
                
                <button
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '36px', minWidth: '36px', padding: '0 12px', border: '1px solid #3b82f6', background: '#3b82f6', color: 'white', fontSize: '14px', fontWeight: 500, position: 'relative', zIndex: 1, cursor: 'default' }}
                >
                  {page}
                </button>

                <button 
                  disabled={page >= totalPages || totalPages === 0}
                  onClick={() => setPage(p => p + 1)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '36px', padding: '0 15px', border: '1px solid #e2e8f0', borderLeft: 'none', background: 'white', cursor: page >= totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', borderRadius: '0 6px 6px 0', color: page >= totalPages || totalPages === 0 ? '#94a3b8' : '#0369a1', fontSize: '14px', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { if(page < totalPages) { e.currentTarget.style.background = '#f8fafc'; } }}
                  onMouseOut={(e) => { if(page < totalPages) { e.currentTarget.style.background = 'white'; } }}
                >
                  Next
                </button>
              </div>
            </div>
      </div>
    </div>
  );
};

export default GateLogs;
