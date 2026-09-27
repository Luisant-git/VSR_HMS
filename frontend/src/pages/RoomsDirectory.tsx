import React, { useState } from 'react';
import { Bed, Users, Search, Filter, Home, CheckCircle, XCircle, Plus, Zap, User, ArrowLeft, LayoutGrid, List, Wind } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { RoomAPI } from '../api/room.api';
import { toast } from 'react-toastify';

const RoomsDirectory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filterStatus, setFilterStatus] = useState('All');
  const [dbRooms, setDbRooms] = useState<any[]>([]);
  const [newRoom, setNewRoom] = useState({
    id: '', block: '', floor: 1, type: 'Single', capacity: 1, rent: 0, messFee: 0, amenities: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await RoomAPI.create({
        ...newRoom,
        capacity: parseInt(newRoom.capacity as any) || 1,
        rent: parseInt(newRoom.rent as any) || 0,
        messFee: parseInt(newRoom.messFee as any) || 0,
        floor: parseInt(newRoom.floor as any) || 1
      });
      toast.success('Room created successfully!');
      setNewRoom({ id: '', block: '', floor: 1, type: 'Single', capacity: 1, rent: 0, messFee: 0, amenities: '' });
      setIsModalOpen(false);
      fetchRooms();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const data = await RoomAPI.findAll();
      setDbRooms(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load rooms');
    }
  };

  React.useEffect(() => {
    fetchRooms();
    const handleSwitch = () => setViewMode('table');
    window.addEventListener('switch-to-table', handleSwitch);
    return () => window.removeEventListener('switch-to-table', handleSwitch);
  }, []);

  const totalBeds = dbRooms.reduce((sum, r) => sum + r.capacity, 0);
  const occupiedBeds = dbRooms.reduce((sum, r) => sum + r.occupiedCount, 0);
  const vacantBeds = totalBeds - occupiedBeds;

  const metrics = [
    { label: 'Total Hostel Rooms', value: `${dbRooms.length} Rooms`, color: '#3b82f6', icon: <Home size={20} /> },
    { label: 'Total Bed Capacity', value: `${totalBeds} Beds`, color: '#8b5cf6', icon: <Bed size={20} /> },
    { label: 'Occupied Beds', value: `${occupiedBeds} Beds`, color: '#10b981', icon: <Users size={20} /> },
    { label: 'Vacant Beds', value: `${vacantBeds} Available`, color: '#f59e0b', icon: <CheckCircle size={20} /> }
  ];


  const roomsData = dbRooms.map(r => ({
    id: r.id,
    block: `${r.block} | ${r.type}`,
    status: r.occupiedCount === r.capacity ? 'Full' : r.occupiedCount === 0 ? 'Fully Vacant' : 'Partially Filled',
    price: `₹${(Number(r.rent || 0) + Number(r.messFee || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`,
    type: r.type,
    amenities: r.amenities ? r.amenities.split(',').map((a) => a.trim()) : [],
    filled: r.occupiedCount,
    total: r.capacity,
    occupants: r.occupiedCount > 0 ? `${r.occupiedCount} Students` : 'Ready for allocation'
  }));

  const tableData = dbRooms.map(r => ({
    room: `Room ${r.id}`,
    loc: r.block,
    type: r.type,
    cap: `${r.capacity} Beds`,
    occ: r.occupiedCount,
    vac: r.capacity - r.occupiedCount,
    rent: r.rent || 0,
    mess: r.messFee || 0,
    tot: (r.rent || 0) + (r.messFee || 0),
    amen: r.amenities || 'None',
    live: r.occupiedCount > 0 ? `${r.occupiedCount} Students` : 'None (Vacant)'
  }));



  const filteredGridData = roomsData.filter(room => {
    if (filterStatus === 'Available') return room.filled < room.total;
    if (filterStatus === 'Fully Vacant') return room.filled === 0;
    if (filterStatus === 'Full') return room.filled === room.total;
    return true;
  });

  const filteredTableData = tableData.filter(row => {
    const matchesSearch = row.room.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'Available') return row.vac > 0;
    if (filterStatus === 'Fully Vacant') return row.occ === 0;
    if (filterStatus === 'Full') return row.vac === 0;
    return true;
  });

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Rooms & Live Occupancy Grid"
        subtitle="Dynamic room bed status strictly reflecting active resident hostellers"
        rightContent={
          <>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginRight: '10px' }}>
              <button onClick={() => setViewMode('grid')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, background: viewMode === 'grid' ? 'white' : 'transparent', color: viewMode === 'grid' ? '#0f172a' : '#64748b', boxShadow: viewMode === 'grid' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}><LayoutGrid size={16} /> Grid</button>
              <button onClick={() => setViewMode('table')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, background: viewMode === 'table' ? 'white' : 'transparent', color: viewMode === 'table' ? '#0f172a' : '#64748b', boxShadow: viewMode === 'table' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}><List size={16} /> Table</button>
            </div>
            <button onClick={() => navigate('/rooms/eb-bills')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#eab308', color: '#1e293b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(234, 179, 8, 0.3)' }}>
              <Zap size={16} color="#1e293b" /> Room EB Bills
            </button>
            <button onClick={() => setIsModalOpen(true)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
              <Plus size={16} /> Add New Room
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${m.color}15`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.icon}
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '10px 15px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', width: 'fit-content' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: '#64748b' }}>
          <Filter size={16} style={{ marginRight: '6px' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>Filter:</span>
        </div>
        {['All', 'Available', 'Fully Vacant', 'Full'].map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: filterStatus === f ? 'var(--sidebar-active)' : 'transparent',
              color: filterStatus === f ? 'white' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            {f}
          </button>
        ))}
      </div>


      {viewMode === 'grid' && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '15px' }}>Live Room Layout Visualizer</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {filteredGridData.map((r, i) => (

              <div key={i} className="content-card" style={{ marginTop: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {r.amenities.includes('AC') ? (
                  <span className="status-pill status-paid" style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <Wind size={14} /> AC
                  </span>
                ) : (
                  <span className="status-pill" style={{ position: 'absolute', top: '16px', right: '16px', border: '1px solid var(--text-muted)', color: 'var(--text-muted)' }}>
                    Non-AC
                  </span>
                )}

                <h3 className="card-title" style={{ marginBottom: '8px' }}>Room {r.id}</h3>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>{r.block} &bull; {r.price}</div>

                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2 text-muted">
                    <Users size={16} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Occupied</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#f8f9fa',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: r.filled === r.total ? '#dc3545' : 'var(--sidebar-active)' }}>
                      {r.filled}
                    </span>
                    <span className="text-muted" style={{ fontSize: '13px', fontWeight: 600 }}>/ {r.total}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {Array.from({ length: r.total }).map((_, idx) => {
                    const isOccupied = idx < r.filled;
                    const isFull = r.filled === r.total;

                    const filteredGridData = roomsData.filter(room => {
                      if (filterStatus === 'Available') return room.filled < room.total;
                      if (filterStatus === 'Fully Vacant') return room.filled === 0;
                      if (filterStatus === 'Full') return room.filled === room.total;
                      return true;
                    });

                    const filteredTableData = tableData.filter(row => {
                      const matchesSearch = row.room.toLowerCase().includes(searchTerm.toLowerCase());
                      if (!matchesSearch) return false;
                      if (filterStatus === 'Available') return row.vac > 0;
                      if (filterStatus === 'Fully Vacant') return row.occ === 0;
                      if (filterStatus === 'Full') return row.vac === 0;
                      return true;
                    });

                    return (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '38px', height: '38px', borderRadius: '10px',
                        backgroundColor: isOccupied ? (isFull ? 'rgba(220, 53, 69, 0.1)' : 'rgba(74, 114, 250, 0.1)') : '#f4f6f8',
                        color: isOccupied ? (isFull ? '#dc3545' : 'var(--sidebar-active)') : '#adb5bd',
                        border: '1px solid',
                        borderColor: isOccupied ? (isFull ? 'rgba(220, 53, 69, 0.2)' : 'rgba(74, 114, 250, 0.2)') : '#e9ecef'
                      }}>
                        <Bed size={20} strokeWidth={isOccupied ? 2.5 : 2} />
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 'auto' }}>
                  {r.filled > 0 && (
                    <div style={{ fontSize: '12px', color: '#64748b', background: '#f8f9fa', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>CURRENT OCCUPANTS:</div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.occupants}</div>
                    </div>
                  )}

                  <button
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '10px', borderRadius: '8px', background: r.filled === r.total ? '#f8f9fa' : 'var(--sidebar-active)', color: r.filled === r.total ? '#64748b' : 'white', border: r.filled === r.total ? '1px solid #cbd5e1' : 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => navigate('/hostellers', { state: { filterRoom: `Room ${r.id}` } })}
                  >
                    {r.filled === r.total ? 'View Students' : 'Assign Student'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'table' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>Rooms Master Directory</h3>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Filter rooms..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '200px' }} />
            </div>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                  <th style={{ padding: '16px 20px' }}>Room #</th>
                  <th style={{ padding: '16px 20px' }}>Location</th>
                  <th style={{ padding: '16px 20px' }}>Type</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center' }}>Capacity</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center' }}>Occupied</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center' }}>Vacant</th>
                  <th style={{ padding: '16px 20px' }}>Monthly Fee Rates</th>
                  <th style={{ padding: '16px 20px' }}>Amenities</th>
                  <th style={{ padding: '16px 20px' }}>Live Occupants</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1e293b' }}>{row.room}</td>
                    <td style={{ padding: '16px 20px', color: '#475569' }}>{row.loc}</td>
                    <td style={{ padding: '16px 20px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: '#475569', fontWeight: 600 }}>{row.type}</span></td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{row.cap}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: row.occ > 0 ? '#0f172a' : '#94a3b8' }}>{row.occ}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: row.vac > 0 ? '#22c55e' : '#ef4444' }}>{row.vac}</td>
                    <td style={{ padding: '16px 20px', color: '#475569', fontSize: '12px' }}>
                      <div>Rent: ₹{Number(row.rent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div>Mess: ₹{Number(row.mess || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>Total: ₹{Number(row.tot || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</div>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#475569' }}>{row.amen}</td>
                    <td style={{ padding: '16px 20px', color: row.occ > 0 ? '#334155' : '#94a3b8' }}>{row.live}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Add Room Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)' }}>Add New Room</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleAddRoom} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Room Number</label>
                  <input type="text" placeholder="e.g. 101" required value={newRoom.id} onChange={e => setNewRoom({ ...newRoom, id: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Block & Floor</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="Block (e.g. A)" required value={newRoom.block} onChange={e => setNewRoom({ ...newRoom, block: e.target.value })} style={{ width: '60%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                    <input type="number" placeholder="Floor" value={newRoom.floor} onChange={e => setNewRoom({ ...newRoom, floor: e.target.value === '' ? '' : parseInt(e.target.value) })} style={{ width: '40%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Room Type</label>
                  <select value={newRoom.type} onChange={e => setNewRoom({ ...newRoom, type: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: 'white' }}>
                    <option value="Single">Single</option>
                    <option value="Double">Double</option>
                    <option value="Triple">Triple</option>
                    <option value="Four Sharing">Four Sharing</option>
                    <option value="Dormitory">Dormitory</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Total Beds</label>
                  <input type="number" required value={newRoom.capacity} onChange={e => setNewRoom({ ...newRoom, capacity: e.target.value === '' ? '' : parseInt(e.target.value) })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Monthly Rent (₹)</label>
                  <input type="number" required value={newRoom.rent} onChange={e => setNewRoom({ ...newRoom, rent: e.target.value === '' ? '' : parseInt(e.target.value) })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Mess Fee (₹)</label>
                  <input type="number" required value={newRoom.messFee} onChange={e => setNewRoom({ ...newRoom, messFee: e.target.value === '' ? '' : parseInt(e.target.value) })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Amenities</label>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newRoom.amenities.includes('AC')}
                      onChange={(e) => {
                        let ams = newRoom.amenities ? newRoom.amenities.split(',').map(a => a.trim()).filter(Boolean) : [];
                        if (e.target.checked && !ams.includes('AC')) ams.push('AC');
                        else if (!e.target.checked) ams = ams.filter(a => a !== 'AC');
                        setNewRoom({ ...newRoom, amenities: ams.join(', ') });
                      }}
                    /> AC
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newRoom.amenities.includes('Attached Bath')}
                      onChange={(e) => {
                        let ams = newRoom.amenities ? newRoom.amenities.split(',').map(a => a.trim()).filter(Boolean) : [];
                        if (e.target.checked && !ams.includes('Attached Bath')) ams.push('Attached Bath');
                        else if (!e.target.checked) ams = ams.filter(a => a !== 'Attached Bath');
                        setNewRoom({ ...newRoom, amenities: ams.join(', ') });
                      }}
                    /> Attached Bath
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
                  {isSubmitting ? 'Saving...' : 'Save Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default RoomsDirectory;
