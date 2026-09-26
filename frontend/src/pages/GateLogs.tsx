import React, { useState } from 'react';
import { ArrowLeft, Clock, LogIn, LogOut, CheckCircle2, Search, Filter, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';

const GateLogs = () => {
  const navigate = useNavigate();
  const [movementType, setMovementType] = useState('EXIT');

  const studentOptions = [
    { value: 'HST-2026-001', label: 'Aarav Sharma (HST-2026-001 - Room 101)' },
    { value: 'HST-2026-004', label: 'Ananya Iyer (HST-2026-004 - Room 103)' },
    { value: 'HST-2026-008', label: 'Arunkarthick (HST-2026-008 - Room 104)' },
    { value: 'HST-2026-009', label: 'Baskar (HST-2026-009 - Room 104)' },
    { value: 'HST-2026-002', label: 'Kavya Patel (HST-2026-002 - Room 102)' },
    { value: 'HST-2026-006', label: 'Meera Nair (HST-2026-006 - Room 102)' },
    { value: 'HST-2026-003', label: 'Rohan Verma (HST-2026-003 - Room 101)' },
    { value: 'HST-2026-005', label: 'Vikramaditya Rao (HST-2026-005 - Room 104)' }
  ];

  const purposeOptions = [
    { value: 'college', label: 'College / Classes / Lab' },
    { value: 'market', label: 'Market / Shopping / Stationery' },
    { value: 'job', label: 'Job / Internship / Office' },
    { value: 'home', label: 'Going Home / Family' },
    { value: 'hospital', label: 'Hospital / Medical Clinic' },
    { value: 'other', label: 'Other / Personal' }
  ];

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
    }),
    placeholder: (base: any) => ({ ...base, color: '#94a3b8' }),
    singleValue: (base: any) => ({ ...base, color: '#1e293b' }),
    menu: (base: any) => ({ ...base, zIndex: 50, borderRadius: '6px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' })
  };

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

      <div style={{ display: 'grid', gridTemplateColumns: '3.5fr 6.5fr', gap: '25px', alignItems: 'flex-start' }}>
        
        {/* Left Column: Form & Current Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', position: 'sticky', top: '20px' }}>
          
          {/* Log Movement Form */}
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
              Log Student Movement
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Select Student *</label>
                <Select 
                  options={studentOptions}
                  placeholder="-- Choose Active Student --"
                  styles={selectStyles}
                  isSearchable={true}
                  isClearable={true}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Movement Type *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => setMovementType('EXIT')}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: movementType === 'EXIT' ? '1px solid #dc3545' : '1px solid #cbd5e1', background: movementType === 'EXIT' ? '#dc3545' : 'white', color: movementType === 'EXIT' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', boxShadow: movementType === 'EXIT' ? '0 4px 10px rgba(220, 53, 69, 0.3)' : 'none' }}
                  >
                    <LogOut size={16} /> EXIT (Going Out)
                  </button>
                  <button 
                    onClick={() => setMovementType('ENTRY')}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: movementType === 'ENTRY' ? '1px solid #198754' : '1px solid #cbd5e1', background: movementType === 'ENTRY' ? '#198754' : 'white', color: movementType === 'ENTRY' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', boxShadow: movementType === 'ENTRY' ? '0 4px 10px rgba(25, 135, 84, 0.3)' : 'none' }}
                  >
                    <LogIn size={16} /> ENTRY (Returning In)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Movement Time</label>
                <input type="datetime-local" defaultValue="2026-09-25T11:52" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>

              {movementType === 'EXIT' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Purpose</label>
                    <Select 
                      options={purposeOptions}
                      placeholder="Select Purpose"
                      styles={selectStyles}
                      isSearchable={true}
                      isClearable={true}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Expected Return Time</label>
                    <input type="datetime-local" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Hostel standard curfew is 8:30 PM.</div>
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Remarks / Gate Note</label>
                <textarea rows={2} placeholder="Optional notes" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}></textarea>
              </div>

              <button style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)', marginTop: '5px' }}>
                <CheckCircle2 size={18} /> Record {movementType}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: History Table & Currently Outside */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* Currently Outside Campus */}
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '15px' }}>
              Currently Outside Campus
            </h3>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '15px' }}>0 student(s) currently marked as OUT</div>
            
            <div style={{ background: '#f8f9fa', padding: '30px', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textAlign: 'center' }}>
              <Clock size={32} style={{ marginBottom: '10px', color: '#cbd5e1' }} />
              <div style={{ fontSize: '13px', fontWeight: 500 }}>All hostellers are currently inside campus.</div>
            </div>
          </div>
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>
              Master Gate Movement Log History
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search logs..." style={{ padding: '6px 10px 6px 30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', width: '200px' }} />
              </div>
              <button style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <Filter size={14} /> Filter
              </button>
            </div>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Movement</th>
                  <th>Timestamp</th>
                  <th>Student ID & Name</th>
                  <th>Room</th>
                  <th>Purpose</th>
                  <th>Expected Return</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#dc3545', color: 'white', fontWeight: 600, fontSize: '11px' }}>EXIT</span></td>
                  <td>25 Sep 2026, 11:52 AM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Aarav Sharma (HST-2026-001)</a></td>
                  <td>101</td>
                  <td>college</td>
                  <td>25 Sep 2026, 05:00 PM</td>
                  <td><span style={{ color: '#64748b' }}>-</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#198754', color: 'white', fontWeight: 600, fontSize: '11px' }}>ENTRY</span></td>
                  <td>25 Sep 2026, 11:53 AM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Aarav Sharma (HST-2026-001)</a></td>
                  <td>101</td>
                  <td>college</td>
                  <td>-</td>
                  <td><span style={{ color: '#64748b' }}>Returned and checked in safely</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#198754', color: 'white', fontWeight: 600, fontSize: '11px' }}>ENTRY</span></td>
                  <td>24 Sep 2026, 03:24 PM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Arunkarthick (HST-2026-008)</a></td>
                  <td>104</td>
                  <td>college</td>
                  <td>-</td>
                  <td><span style={{ color: '#64748b' }}>Returned and checked in safely</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#198754', color: 'white', fontWeight: 600, fontSize: '11px' }}>ENTRY</span></td>
                  <td>24 Sep 2026, 06:08 AM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Kavya Patel (HST-2026-002)</a></td>
                  <td>102</td>
                  <td>other</td>
                  <td>-</td>
                  <td><span style={{ color: '#64748b' }}>Outpass Return</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#dc3545', color: 'white', fontWeight: 600, fontSize: '11px' }}>EXIT</span></td>
                  <td>24 Sep 2026, 06:08 AM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Kavya Patel (HST-2026-002)</a></td>
                  <td>102</td>
                  <td>other</td>
                  <td>22 Sep 2026, 06:22 PM</td>
                  <td><span style={{ color: '#64748b' }}>Outpass Exit</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#dc3545', color: 'white', fontWeight: 600, fontSize: '11px' }}>EXIT</span></td>
                  <td>20 Sep 2026, 10:23 PM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Arunkarthick (HST-2026-008)</a></td>
                  <td>104</td>
                  <td>college</td>
                  <td>21 Sep 2026, 08:30 PM</td>
                  <td><span style={{ color: '#64748b' }}>-</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#198754', color: 'white', fontWeight: 600, fontSize: '11px' }}>ENTRY</span></td>
                  <td>20 Sep 2026, 10:23 PM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Rohan Verma (HST-2026-003)</a></td>
                  <td>101</td>
                  <td>college</td>
                  <td>-</td>
                  <td><span style={{ color: '#64748b' }}>Returned and checked in safely</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#198754', color: 'white', fontWeight: 600, fontSize: '11px' }}>ENTRY</span></td>
                  <td>20 Sep 2026, 04:45 PM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Aarav Sharma (HST-2026-001)</a></td>
                  <td>101</td>
                  <td>college</td>
                  <td>-</td>
                  <td><span style={{ color: '#64748b' }}>Returned safely</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#dc3545', color: 'white', fontWeight: 600, fontSize: '11px' }}>EXIT</span></td>
                  <td>20 Sep 2026, 02:00 PM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Rohan Verma (HST-2026-003)</a></td>
                  <td>101</td>
                  <td>market</td>
                  <td>20 Sep 2026, 04:00 PM</td>
                  <td><span style={{ color: '#64748b' }}>Stationery & personal shopping</span></td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#dc3545', color: 'white', fontWeight: 600, fontSize: '11px' }}>EXIT</span></td>
                  <td>20 Sep 2026, 08:30 AM</td>
                  <td><a href="#" style={{ color: '#0d6efd', fontWeight: 500, textDecoration: 'none' }}>Aarav Sharma (HST-2026-001)</a></td>
                  <td>101</td>
                  <td>college</td>
                  <td>20 Sep 2026, 05:00 PM</td>
                  <td><span style={{ color: '#64748b' }}>Attending lab sessions</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default GateLogs;
