import { useState, useEffect } from 'react';
import { RoomAPI } from '../api/room.api';
import { FeesAPI } from '../api/fees.api';
import { StudentAPI } from '../api/student.api';
import { gateLogApi } from '../api/gatelog.api';
import { OutpassAPI } from '../api/outpass.api';
import { Users, Bed, LogOut, AlertTriangle, CreditCard, ShieldCheck, List, FileText, LogIn, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingBlock } from '../components/LoadingSpinner';

const Dashboard = () => {
  const navigate = useNavigate();
  const [roomFilter, setRoomFilter] = useState('All'); // 'All' | 'FullyVacant'
  const [roomSearch, setRoomSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState('All');
  const [dbRooms, setDbRooms] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [missingLogs, setMissingLogs] = useState<any[]>([]);
  const [outpasses, setOutpasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      RoomAPI.findAll().then(setDbRooms).catch(console.error),
      FeesAPI.findAll().then(setFees).catch(console.error),
      StudentAPI.findAll({ limit: 1000 }).then(res => setStudents(res.data || [])).catch(console.error),
      gateLogApi.getMissing().then(res => setMissingLogs(Array.isArray(res) ? res : (res.data || []))).catch(console.error),
      OutpassAPI.findAll().then(res => setOutpasses(res.data)).catch(console.error),
    ]).then(() => setLoading(false));
  }, []);

  const roomsData = dbRooms.map(r => ({
    id: r.id,
    type: r.type,
    ac: r.amenities ? r.amenities.includes('AC') : false,
    block: r.block,
    floor: `Room ${r.id.replace(/^[a-zA-Z\s_-]+/, '')}`,
    rent: Number(r.rent || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    mess: Number(r.messFee || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    occ: r.occupiedCount,
    cap: r.capacity
  }));

  const totalBeds = dbRooms.reduce((sum, r) => sum + r.capacity, 0);
  const occupiedBeds = dbRooms.reduce((sum, r) => sum + r.occupiedCount, 0);
  const vacantBeds = totalBeds - occupiedBeds;


  const allBlocks = ['All', ...Array.from(new Set(dbRooms.map(r => r.block).filter(Boolean))).sort()];
  // "FullyVacant" = rooms with zero occupants (all beds empty), matching the
  // Rooms Directory vocabulary. It is NOT the same as the "Vacant Beds" metric,
  // which counts free beds (capacity - occupied).
  let filteredRooms = roomFilter === 'FullyVacant' ? roomsData.filter(r => r.occ === 0) : roomsData;
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

  // The API returns rooms in arbitrary order. Sort by block, then naturally by
  // room number so "A2" comes before "A10" instead of a jumbled list.
  filteredRooms = [...filteredRooms].sort((a, b) => {
    const byBlock = String(a.block || '').localeCompare(String(b.block || ''), undefined, { numeric: true, sensitivity: 'base' });
    if (byBlock !== 0) return byBlock;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' });
  });

  const safeFees = Array.isArray(fees) ? fees : ((fees as any).data || []);
  const totalPendingFees = safeFees.filter((f: any) => f.status === 'PENDING').reduce((sum: number, f: any) => sum + f.amount, 0);
  const totalAdvanceHeld = safeFees.filter((f: any) => f.transactionType === 'ADVANCE' && f.status === 'COMPLETED').reduce((sum: number, f: any) => sum + f.amount, 0);

  const safeStudents = Array.isArray(students) ? students : ((students as any).data || []);
  const activeStudents = safeStudents.filter((s: any) => s.status !== 'Vacated');
  const currentlyOut = activeStudents.filter((s: any) => s.status === 'Out').length;

  const safeMissingLogs = Array.isArray(missingLogs) ? missingLogs : ((missingLogs as any).data || []);
  const activeLateWarnings = safeMissingLogs.filter((log: any) => !log.inTime).length;

  const safeOutpasses = Array.isArray(outpasses) ? outpasses : ((outpasses as any).data || []);
  const activeOutpassesCount = safeOutpasses.filter((op: any) => op.status === 'Approved' || op.status === 'Pending' || op.status === 'Active Out').length;

  // Keep the occupancy widget compact — the full list lives in Rooms Directory.
  // Once the user filters (search / block / fully-vacant), show every matching
  // room so nothing that matched their filter stays hidden.
  const OCCUPANCY_PREVIEW_ROWS = 6;
  const isOccupancyFiltered = roomSearch.trim() !== '' || blockFilter !== 'All' || roomFilter !== 'All';
  const visibleRooms = isOccupancyFiltered ? filteredRooms : filteredRooms.slice(0, OCCUPANCY_PREVIEW_ROWS);
  const hiddenRoomsCount = filteredRooms.length - visibleRooms.length;

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

  if (loading) {
    return (
      <div className="ui-page ui-stack">
        <LoadingBlock text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="ui-page ui-stack">

      {/* ---------- Quick overview ---------- */}
      <div className="cards-row">
        <div className="metric-card metric-card-blue" style={{ cursor: 'pointer' }} onClick={() => navigate('/hostellers')}>
          <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Active Students
            <Users size={18} />
          </div>
          <div className="value">{activeStudents.length}</div>
        </div>

        <div className="metric-card metric-card-green" style={{ cursor: 'pointer' }} onClick={() => navigate('/rooms/directory')}>
          <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Vacant Beds
            <Bed size={18} />
          </div>
          <div className="value">{vacantBeds} / {totalBeds}</div>
        </div>

        <div className="metric-card metric-card-orange" style={{ cursor: 'pointer' }} onClick={() => navigate('/gate-logs')}>
          <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Currently Out
            <LogOut size={18} />
          </div>
          <div className="value">{currentlyOut}</div>
        </div>

        <div className="metric-card metric-card-yellow" style={{ cursor: 'pointer' }} onClick={() => navigate('/late-warnings')}>
          <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Late Return Warning
            <AlertTriangle size={18} />
          </div>
          <div className="value">{activeLateWarnings}</div>
        </div>

        <div className="metric-card metric-card-purple" style={{ cursor: 'pointer' }} onClick={() => navigate('/fees')}>
          <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Pending Fees
            <CreditCard size={18} />
          </div>
          <div className="value">₹{totalPendingFees.toLocaleString('en-IN')}</div>
        </div>

        <div className="metric-card" style={{ background: '#20c997', cursor: 'pointer' }} onClick={() => navigate('/fees')}>
          <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Advance Held
            <ShieldCheck size={18} />
          </div>
          <div className="value">₹{totalAdvanceHeld.toLocaleString('en-IN')}</div>
        </div>

        <div className="metric-card" style={{ background: '#0ea5e9', cursor: 'pointer' }} onClick={() => navigate('/outpass')}>
          <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Active Outpasses
            <FileText size={18} />
          </div>
          <div className="value">{activeOutpassesCount}</div>
        </div>
      </div>

      {/* ---------- Late Return Warnings ---------- */}
      <div className="ui-card">
        <div className="ui-card-head">
          <div className="ui-card-title dash-warn-title">Late Return Warnings</div>
        </div>
        <div className="ui-card-body">
          <div className="dash-warn-grid">
            {safeMissingLogs.filter((log: any) => !log.inTime).slice(0, 5).map((log: any, idx: number) => (
              <div key={idx} className="dash-warn">
                <div className="dash-warn-head">
                  <div>
                    <div className="dash-warn-name">{log.student?.name} ({log.student?.manualRegsiName || log.student?.regNo})</div>
                    <div className="dash-warn-meta">Room: {log.student?.room?.id || 'N/A'} | Mob: {log.student?.mobileNo || 'N/A'}</div>
                    <div className="dash-warn-reason">{log.reason || 'No reason provided'}</div>
                  </div>
                  <span className="ui-badge ui-badge-danger">Late</span>
                </div>
                <div className="dash-warn-times">
                  <div>
                    <div className="dash-time-label">Exit Time:</div>
                    <div className="dash-time-value">{new Date(log.outTime).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="dash-time-right">
                    <div className="dash-time-label">Expected In:</div>
                    <div className="dash-time-value">{new Date(log.expectedInTime).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <button className="ui-btn ui-btn-danger ui-btn-block dash-return-btn" onClick={() => handleCheckIn(log.studentId)}>
                  <LogIn size={16} /> Mark as Returned
                </button>
              </div>
            ))}
            {safeMissingLogs.filter((log: any) => !log.inTime).length === 0 && (
              <div className="ui-empty dash-warn-empty">No late returns</div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Occupancy + outpasses ---------- */}
      <div className="dash-cols">

        <div className="ui-card">
          <div className="ui-card-head">
            <div className="dash-card-heading">
              <div className="ui-card-title">Live Room Occupancy</div>
              <div className="ui-card-sub">Real-time room occupancy</div>
            </div>
            <div className="dash-seg">
              <button className={`dash-seg-btn ${roomFilter === 'All' ? 'is-active' : ''}`} onClick={() => setRoomFilter('All')}>
                All Rooms
              </button>
              <button
                className={`dash-seg-btn ${roomFilter === 'FullyVacant' ? 'is-active' : ''}`}
                onClick={() => setRoomFilter('FullyVacant')}
                title="Rooms with no occupants at all"
              >
                Fully Vacant
              </button>
              <span className="dash-seg-divider"></span>
              <button
                className="dash-seg-btn dash-seg-link"
                onClick={() => {
                  navigate('/rooms/directory');
                  // Give a small delay for route transition then switch to table view if needed
                  setTimeout(() => window.dispatchEvent(new CustomEvent('switch-to-table')), 100);
                }}
              >
                <List size={14} /> Full View Table
              </button>
            </div>
          </div>

          <div className="ui-card-body">
            <div className="dash-filters">
              <div className="ui-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search Room Number..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                />
              </div>
              <select
                className="ui-select dash-block-select"
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
              >
                {allBlocks.map(b => <option key={b} value={b}>{b === 'All' ? 'All Blocks' : `Block ${b}`}</option>)}
              </select>
              {(roomSearch || blockFilter !== 'All') && (
                <button
                  className="ui-btn ui-btn-outline-danger ui-btn-sm"
                  onClick={() => { setRoomSearch(''); setBlockFilter('All'); }}
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            <div className="ui-table-scroll">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Room #</th>
                    <th>Wing &amp; Room No</th>
                    <th>Type</th>
                    <th>Occupancy</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRooms.map((room, idx) => {
                    const percent = Math.round((room.occ / room.cap) * 100);
                    const isEmpty = room.occ === 0;
                    const isFull = room.occ >= room.cap;
                    const status = isFull ? 'Full' : (isEmpty ? 'Fully Vacant' : 'Partially Filled');
                    const statusClass = isFull ? 'ui-badge-danger' : (isEmpty ? 'ui-badge-success' : 'ui-badge-warning');
                    const color = isFull ? '#dc3545' : (isEmpty ? '#198754' : 'var(--accent)');

                    return (
                      <tr key={idx}>
                        <td className="dash-room-cell">
                          <a href={`/rooms/${room.id}`} className="dash-room-link">Room {room.id}</a>
                          {room.ac && <span className="ui-badge ui-badge-info dash-ac">AC</span>}
                        </td>
                        <td>{room.block} - {room.floor}</td>
                        <td>{room.type}</td>
                        <td className="dash-occ-cell">
                          <div className="dash-occ-top">
                            <span className="dash-occ-count">{room.occ}/{room.cap} Beds</span>
                            <span className="dash-occ-pct" style={{ color: color }}>{percent}%</span>
                          </div>
                          <div className="dash-progress">
                            <div className="dash-progress-bar" style={{ width: `${Math.min(percent, 100)}%`, background: color }}></div>
                          </div>
                        </td>
                        <td>
                          <span className={`ui-badge ${statusClass}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRooms.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div className="ui-empty">No rooms match the current filters</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {hiddenRoomsCount > 0 && (
              <div className="dash-occ-foot">
                <span className="dash-occ-more">
                  Showing {visibleRooms.length} of {filteredRooms.length} rooms
                </span>
                <button
                  type="button"
                  className="ui-btn ui-btn-soft ui-btn-sm"
                  onClick={() => navigate('/rooms/directory')}
                >
                  View all rooms
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="dash-side">
          <div className="ui-card">
            <div className="ui-card-head">
              <div className="ui-card-title">Active Outpasses</div>
            </div>
            <div className="ui-card-body">
              <div className="dash-list">
                {outpasses.filter(op => op.status === 'Pending' || op.status === 'Approved' || op.status === 'Active Out').slice(0, 5).map((op, idx) => (
                  <div key={idx} className="dash-list-item">
                    <div className="dash-list-head">
                      <div>
                        <div className="dash-list-name">{op.student?.name} ({op.student?.manualRegsiName || op.student?.regNo})</div>
                        <div className="dash-list-meta">Room: {op.student?.room?.id || 'N/A'} | Mob: {op.student?.mobileNo || 'N/A'}</div>
                        <div className="dash-list-dest">{op.destination}</div>
                      </div>
                      <span className={`ui-badge ${op.status === 'Approved' ? 'ui-badge-success' : op.status === 'Active Out' ? 'ui-badge-warning' : 'ui-badge-accent'}`}>
                        {op.status}
                      </span>
                    </div>
                    <div className="dash-list-foot">
                      <div>
                        <div className="dash-time-label">Leave:</div>
                        <div className="dash-time-value">{new Date(op.leaveDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                      </div>
                      <div className="dash-time-right">
                        <div className="dash-time-label">Return:</div>
                        <div className="dash-time-value">{new Date(op.returnDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {outpasses.filter(op => op.status === 'Pending' || op.status === 'Approved' || op.status === 'Active Out').length === 0 && (
                  <div className="ui-empty">No active outpasses</div>
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
