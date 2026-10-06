import { useState, useEffect } from 'react';
import { RoomAPI } from '../api/room.api';
import { FeesAPI } from '../api/fees.api';
import { StudentAPI } from '../api/student.api';
import { gateLogApi } from '../api/gatelog.api';
import { OutpassAPI } from '../api/outpass.api';
import { Users, Bed, LogOut, AlertTriangle, CreditCard, ShieldCheck, List, FileText, LogIn, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [roomFilter, setRoomFilter] = useState('All');
  const [roomSearch, setRoomSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState('All');
  const [dbRooms, setDbRooms] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [missingLogs, setMissingLogs] = useState<any[]>([]);
  const [outpasses, setOutpasses] = useState<any[]>([]);

  useEffect(() => {
    RoomAPI.findAll().then(setDbRooms).catch(console.error);
    FeesAPI.findAll().then(setFees).catch(console.error);
    StudentAPI.findAll({ limit: 1000 }).then(res => setStudents(res.data || [])).catch(console.error);
    gateLogApi.getMissing().then(setMissingLogs).catch(console.error);
    OutpassAPI.findAll().then(setOutpasses).catch(console.error);
  }, []);

  const roomsData = dbRooms.map(r => ({
    id: r.id,
    type: r.type,
    ac: r.amenities ? r.amenities.includes('AC') : false,
    block: r.block,
    floor: `Room ${r.id.replace(/^[a-zA-Z\\s_-]+/, '')}`,
    rent: Number(r.rent || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    mess: Number(r.messFee || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    occ: r.occupiedCount,
    cap: r.capacity
  }));
  
  const totalBeds = dbRooms.reduce((sum, r) => sum + r.capacity, 0);
  const occupiedBeds = dbRooms.reduce((sum, r) => sum + r.occupiedCount, 0);
  const vacantBeds = totalBeds - occupiedBeds;
  const vacantPercent = totalBeds > 0 ? Math.round((vacantBeds / totalBeds) * 100) : 0;

  
  const allBlocks = ['All', ...Array.from(new Set(dbRooms.map(r => r.block).filter(Boolean))).sort()];
  let filteredRooms = roomFilter === 'Vacant' ? roomsData.filter(r => r.occ === 0) : roomsData;
  if (roomSearch) {
    const q = roomSearch.toLowerCase();
    const exactMatches = filteredRooms.filter(r => r.id.toLowerCase() === q);
    if (exactMatches.length > 0) {
      filteredRooms = exactMatches;
    } else {
      filteredRooms = filteredRooms.filter(r => r.id.toLowerCase().includes(q));
    }
  }
  if (blockFilter !== 'All') {
    filteredRooms = filteredRooms.filter(r => r.block === blockFilter);
  }

  const totalPendingFees = fees.filter(f => f.status === 'PENDING').reduce((sum, f) => sum + f.amount, 0);
  const totalAdvanceHeld = fees.filter(f => f.transactionType === 'ADVANCE' && f.status === 'COMPLETED').reduce((sum, f) => sum + f.amount, 0);

  const safeStudents = Array.isArray(students) ? students : ((students as any).data || []);
  const activeStudents = safeStudents.filter((s: any) => s.status !== 'Vacated');
  const currentlyOut = activeStudents.filter((s: any) => s.status === 'Out').length;
  const activeLateWarnings = missingLogs.filter(log => !log.inTime).length;
  const activeOutpassesCount = outpasses.filter(op => op.status === 'Approved' || op.status === 'Pending' || op.status === 'Active Out').length;
  const handleCheckIn = async (studentId: string) => {
    try {
      await gateLogApi.create({
        studentId: studentId,
        movementType: 'ENTRY',
        time: new Date().toISOString()
      });
      gateLogApi.getMissing().then(setMissingLogs).catch(console.error);
      StudentAPI.findAll().then(setStudents).catch(console.error);
    } catch (error: any) {
      console.error("Check-in failed", error);
      alert(error.message || "Failed to check in");
    }
  };

  return (
    <div>
      <div className="content-card" style={{ padding: '25px' }}>
        <div className="card-header" style={{ marginBottom: '15px' }}>
          <div className="card-title">Quick Overview</div>

        </div>

        <div className="cards-row">
          <div className="metric-card metric-card-blue" onClick={() => navigate('/hostellers')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ...({} as any) }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
            <div className="title" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={24} color="rgba(255,255,255,1)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              <span style={{ fontWeight: 600 }}>Active Students</span>
            </div>
            <div className="value" style={{ fontSize: '28px', fontWeight: 800 }}>{activeStudents.length}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>Enrolled in hostel</div>
          </div>
          
          <div className="metric-card metric-card-green" onClick={() => navigate('/rooms/directory')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ...({} as any) }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
            <div className="title" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bed size={24} color="rgba(255,255,255,1)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              <span style={{ fontWeight: 600 }}>Vacant Beds</span>
            </div>
            <div className="value" style={{ fontSize: '28px', fontWeight: 800 }}>{vacantBeds} / {totalBeds}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>{vacantPercent}% Available</div>
          </div>
          
          <div className="metric-card metric-card-orange" onClick={() => navigate('/gate-logs')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ...({} as any) }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
            <div className="title" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LogOut size={24} color="rgba(255,255,255,1)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              <span style={{ fontWeight: 600 }}>Currently Out</span>
            </div>
            <div className="value" style={{ fontSize: '28px', fontWeight: 800 }}>{currentlyOut}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>Checked out at gate</div>
          </div>
          
          <div className="metric-card metric-card-yellow" onClick={() => navigate('/late-warnings')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ...({} as any) }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
            <div className="title" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} color="rgba(255,255,255,1)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              <span style={{ fontWeight: 600 }}>Late Return Warning</span>
            </div>
            <div className="value" style={{ fontSize: '28px', fontWeight: 800 }}>{activeLateWarnings}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>Late return students</div>
          </div>

          <div className="metric-card metric-card-purple" onClick={() => navigate('/fees')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ...({} as any) }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
            <div className="title" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CreditCard size={24} color="rgba(255,255,255,1)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              <span style={{ fontWeight: 600 }}>Pending Fees</span>
            </div>
            <div className="value" style={{ fontSize: '28px', fontWeight: 800 }}>₹{totalPendingFees.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>Unpaid dues</div>
          </div>
          
          <div className="metric-card" style={{ backgroundColor: '#20c997', cursor: 'pointer', transition: 'transform 0.2s', ...({} as any) }} onClick={() => navigate('/fees')} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
            <div className="title" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={24} color="rgba(255,255,255,1)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              <span style={{ fontWeight: 600 }}>Advance Held</span>
            </div>
            <div className="value" style={{ fontSize: '28px', fontWeight: 800 }}>₹{totalAdvanceHeld.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>Security deposits</div>
          </div>

          <div className="metric-card" style={{ backgroundColor: '#0ea5e9', cursor: 'pointer', transition: 'transform 0.2s', ...({} as any) }} onClick={() => navigate('/outpass')} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
            <div className="title" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={24} color="rgba(255,255,255,1)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              <span style={{ fontWeight: 600 }}>Active Outpasses</span>
            </div>
            <div className="value" style={{ fontSize: '28px', fontWeight: 800 }}>{activeOutpassesCount}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>Pending, Approved or Active</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '25px', marginBottom: '25px' }}>
        
        {/* Late Return Warnings */}
        <div className="content-card">
          <div className="card-header" style={{ marginBottom: '15px' }}>
            <div className="card-title" style={{ color: '#ef4444' }}>Late Return Warnings</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '15px' }}>
            {missingLogs.filter(log => !log.inTime).slice(0, 5).map((log, idx) => (
              <div key={idx} style={{ border: '1px solid #fecaca', borderRadius: '10px', padding: '15px', background: '#fef2f2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px', color: '#991b1b' }}>{log.student?.name} ({log.student?.regNo})</div>
                    <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px', fontWeight: 600 }}>Room: {log.student?.room?.id || 'N/A'} | Mob: {log.student?.mobileNo || 'N/A'}</div>
                    <div style={{ fontSize: '13px', color: '#b91c1c', marginTop: '4px' }}>{log.reason || 'No reason provided'}</div>
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    background: '#fee2e2', 
                    color: '#ef4444', 
                    padding: '4px 8px', borderRadius: '4px', fontWeight: 600 
                  }}>
                    Late
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: '#991b1b', opacity: 0.8, marginBottom: '2px' }}>Exit Time:</div>
                      <div style={{ fontWeight: 600, color: '#991b1b' }}>{new Date(log.outTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#991b1b', opacity: 0.8, marginBottom: '2px' }}>Expected In:</div>
                      <div style={{ fontWeight: 600, color: '#991b1b' }}>{new Date(log.expectedInTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  <button onClick={() => handleCheckIn(log.studentId)} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'} onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}>
                    <LogIn size={16} /> Mark as Returned
                  </button>
                </div>
              </div>
            ))}
            {missingLogs.filter(log => !log.inTime).length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', gridColumn: '1 / -1' }}>
                No late returns
              </div>
            )}
          </div>
        </div>

        {/* On large screens, this grid will be styled via CSS to 2fr 1fr. For inline simplicity, I'll use a media query in CSS later, but let's just do flex here. */}
        <div className="dashboard-bottom-row" style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
          
          <div className="content-card" style={{ flex: '2 1 min(100%, 600px)', minWidth: 0 }}>
            <div className="card-header" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'nowrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ minWidth: 0, flexShrink: 1 }}>
                <div className="card-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Live Room Occupancy</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Real-time room occupancy</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '5px', background: '#f0f2f5', padding: '4px', borderRadius: '20px', alignItems: 'center', flexShrink: 0 }}>
                <button 
                  onClick={() => setRoomFilter('All')}
                  style={{ background: roomFilter === 'All' ? 'var(--sidebar-active)' : 'transparent', color: roomFilter === 'All' ? 'white' : 'var(--text-muted)', border: 'none', padding: '6px 14px', borderRadius: '15px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                  All Rooms
                </button>
                <button 
                  onClick={() => setRoomFilter('Vacant')}
                  style={{ background: roomFilter === 'Vacant' ? 'var(--sidebar-active)' : 'transparent', color: roomFilter === 'Vacant' ? 'white' : 'var(--text-muted)', border: 'none', padding: '6px 14px', borderRadius: '15px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                  Vacant Only
                </button>
                <div style={{ width: '1px', background: '#cbd5e1', height: '20px', margin: '0 4px' }}></div>
                <button 
                  onClick={() => {
                    navigate('/rooms/directory');
                    // Give a small delay for route transition then switch to table view if needed
                    setTimeout(() => window.dispatchEvent(new CustomEvent('switch-to-table')), 100);
                  }}
                  style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '6px 14px', borderRadius: '15px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <List size={14} /> Full View Table
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', padding: '0 5px' }}>
              <div style={{ flex: 1, position: 'relative', maxWidth: '300px' }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search Room Number..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer', minWidth: '150px' }}
              >
                {allBlocks.map(b => <option key={b} value={b}>{b === 'All' ? 'All Blocks' : `Block ${b}`}</option>)}
              </select>
              {(roomSearch || blockFilter !== 'All') && (
                <button
                  onClick={() => { setRoomSearch(''); setBlockFilter('All'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '4px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room #</th>
                    <th>Wing & Room No</th>
                    <th>Type</th>
                    <th>Occupancy</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room, idx) => {
                    const percent = Math.round((room.occ / room.cap) * 100);
                    const isFull = room.occ === room.cap;
                    const color = isFull ? '#dc3545' : (room.occ === 0 ? '#198754' : 'var(--sidebar-active)');
                    
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>
                          <a href={`/rooms/${room.id}`} style={{ color: 'var(--sidebar-active)', textDecoration: 'none' }}>Room {room.id}</a>
                          {room.ac && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#e3f2fd', color: '#1976d2', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>AC</span>}
                        </td>
                        <td>{room.block} - {room.floor}</td>
                        <td>{room.type}</td>
                        <td style={{ minWidth: '120px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{room.occ}/{room.cap} Beds</span>
                            <span style={{ color: color, fontWeight: 600 }}>{percent}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#f0f2f5', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: color, borderRadius: '3px' }}></div>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${isFull ? 'status-paid' : 'status-pending'}`}>
                            {isFull ? 'Full' : 'Fully Vacant'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ flex: '1 1 min(100%, 300px)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Active Outpasses */}
            <div className="content-card">
              <div className="card-header" style={{ marginBottom: '15px' }}>
                <div className="card-title">Active Outpasses</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {outpasses.filter(op => op.status === 'Pending' || op.status === 'Approved' || op.status === 'Active Out').slice(0, 5).map((op, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{op.student?.name} ({op.student?.regNo})</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>Room: {op.student?.room?.id || 'N/A'} | Mob: {op.student?.mobileNo || 'N/A'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{op.destination}</div>
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        background: op.status === 'Approved' ? 'rgba(32, 201, 151, 0.1)' : op.status === 'Active Out' ? '#ffc107' : 'rgba(242, 153, 0, 0.1)', 
                        color: op.status === 'Approved' ? '#20c997' : op.status === 'Active Out' ? '#000' : '#f29900', 
                        padding: '4px 8px', borderRadius: '4px', fontWeight: 600 
                      }}>
                        {op.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f9fa', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Leave:</div>
                        <div style={{ fontWeight: 500 }}>{new Date(op.leaveDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Return:</div>
                        <div style={{ fontWeight: 500 }}>{new Date(op.returnDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {outpasses.filter(op => op.status === 'Pending' || op.status === 'Approved' || op.status === 'Active Out').length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                    No active outpasses
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
