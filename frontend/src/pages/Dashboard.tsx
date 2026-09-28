import React, { useState, useEffect } from 'react';
import { RoomAPI } from '../api/room.api';
import { FeesAPI } from '../api/fees.api';
import { StudentAPI } from '../api/student.api';
import { gateLogApi } from '../api/gatelog.api';
import { Users, Bed, LogOut, AlertTriangle, CreditCard, ShieldCheck, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [roomFilter, setRoomFilter] = useState('All');
  const [dbRooms, setDbRooms] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [missingLogs, setMissingLogs] = useState<any[]>([]);

  useEffect(() => {
    RoomAPI.findAll().then(setDbRooms).catch(console.error);
    FeesAPI.findAll().then(setFees).catch(console.error);
    StudentAPI.findAll().then(setStudents).catch(console.error);
    gateLogApi.getMissing().then(setMissingLogs).catch(console.error);
  }, []);

  const roomsData = dbRooms.map(r => ({
    id: r.id,
    type: r.type,
    ac: r.amenities ? r.amenities.includes('AC') : false,
    block: r.block,
    floor: `Floor ${r.floor || 1}`,
    rent: Number(r.rent || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    mess: Number(r.messFee || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    occ: r.occupiedCount,
    cap: r.capacity
  }));
  
  const totalBeds = dbRooms.reduce((sum, r) => sum + r.capacity, 0);
  const occupiedBeds = dbRooms.reduce((sum, r) => sum + r.occupiedCount, 0);
  const vacantBeds = totalBeds - occupiedBeds;
  const vacantPercent = totalBeds > 0 ? Math.round((vacantBeds / totalBeds) * 100) : 0;

  
  const filteredRooms = roomFilter === 'Vacant' ? roomsData.filter(r => r.occ === 0) : roomsData;

  const totalPendingFees = fees.filter(f => f.status === 'PENDING').reduce((sum, f) => sum + f.amount, 0);
  const totalAdvanceHeld = fees.filter(f => f.transactionType === 'ADVANCE' && f.status === 'COMPLETED').reduce((sum, f) => sum + f.amount, 0);

  const currentlyOut = students.filter(s => s.status === 'Out').length;
  const activeLateWarnings = missingLogs.filter(log => !log.inTime).length;

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
            <div className="value" style={{ fontSize: '28px', fontWeight: 800 }}>{students.length}</div>
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
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '25px', marginBottom: '25px' }}>
        
        {/* On large screens, this grid will be styled via CSS to 2fr 1fr. For inline simplicity, I'll use a media query in CSS later, but let's just do flex here. */}
        <div className="dashboard-bottom-row" style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
          
          <div className="content-card" style={{ flex: '2 1 600px' }}>
            <div className="card-header" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'nowrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ minWidth: 0, flexShrink: 1 }}>
                <div className="card-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Live Room Occupancy & Pricing</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Real-time room occupancy and predefined rate structures</div>
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

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room #</th>
                    <th>Wing & Floor</th>
                    <th>Type</th>
                    <th>Monthly Fee Structure</th>
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
                        <td>
                          <div style={{ fontSize: '13px' }}>Rent: <span style={{ fontWeight: 600 }}>₹{room.rent}</span></div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mess: ₹{room.mess}</div>
                        </td>
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

          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Today's Meal In/Out */}
            {/* 
            <div className="content-card">
              <div className="card-header" style={{ marginBottom: '15px' }}>
                <div className="card-title">Today's Meal In/Out</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: 'white', padding: '15px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--card-blue)' }}>0</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '5px' }}>Breakfast</div>
                </div>
                <div style={{ background: 'white', padding: '15px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--card-orange)' }}>0</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '5px' }}>Lunch</div>
                </div>
                <div style={{ background: 'white', padding: '15px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--card-yellow)' }}>0</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '5px' }}>Snacks</div>
                </div>
                <div style={{ background: 'white', padding: '15px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--card-purple)' }}>0</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '5px' }}>Dinner</div>
                </div>
              </div>
            </div>
            */}

            {/* Active Outpasses */}
            <div className="content-card">
              <div className="card-header" style={{ marginBottom: '15px' }}>
                <div className="card-title">Active Outpasses</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>Ananya Iyer (103)</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chennai</div>
                    </div>
                    <span style={{ fontSize: '11px', background: 'rgba(242, 153, 0, 0.1)', color: '#f29900', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Pending</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f9fa', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Leave:</div>
                      <div style={{ fontWeight: 500 }}>21 Sep 2026</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-muted)' }}>Return:</div>
                      <div style={{ fontWeight: 500 }}>24 Sep 2026</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
