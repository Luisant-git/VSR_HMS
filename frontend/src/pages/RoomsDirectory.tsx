import React, { useState } from 'react';
import { Bed, Users, Search, Filter, Home, CheckCircle, XCircle, Plus, Zap, LayoutGrid, List, Wind, SquarePen } from 'lucide-react';
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
  const [filterType, setFilterType] = useState('All Types');
  const [dbRooms, setDbRooms] = useState<any[]>([]);
  const [newRoom, setNewRoom] = useState({
    id: '', block: '', floor: 1, type: 'Single', capacity: 1, rent: 0, messFee: 0, amenities: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 12;

  const getTypeStyle = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('single')) return { background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' };
    if (t.includes('double')) return { background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' };
    if (t.includes('triple')) return { background: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' };
    if (t.includes('dorm')) return { background: '#f3e8ff', color: '#7e22ce', borderColor: '#e9d5ff' };
    return { background: '#e2e8f0', color: '#334155', borderColor: '#cbd5e1' };
  };

  const handleEditClick = (room: any) => {
    setNewRoom({
      id: room.id || room.room?.replace('Room ', ''),
      block: room.block?.split(' | ')[0] || room.loc,
      floor: room.floor || 1,
      type: room.type,
      capacity: room.total || room.cap ? parseInt(room.total || room.cap) : 1,
      rent: room.rent || 0,
      messFee: room.messFee || room.mess || 0,
      amenities: room.amenities ? (Array.isArray(room.amenities) ? room.amenities.join(', ') : room.amenities) : (room.amen === 'None' ? '' : room.amen || '')
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        block: newRoom.block,
        type: newRoom.type,
        capacity: parseInt(newRoom.capacity as any) || 1,
        rent: parseInt(newRoom.rent as any) || 0,
        messFee: parseInt(newRoom.messFee as any) || 0,
        floor: parseInt(newRoom.floor as any) || 1,
        amenities: newRoom.amenities
      };

      if (isEditing) {
        await RoomAPI.update(newRoom.id, payload);
        toast.success('Room updated successfully!');
      } else {
        await RoomAPI.create({ ...payload, id: newRoom.id });
        toast.success('Room created successfully!');
      }

      setNewRoom({ id: '', block: '', floor: 1, type: 'Single', capacity: 1, rent: 0, messFee: 0, amenities: '' });
      setIsModalOpen(false);
      setIsEditing(false);
      fetchRooms();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchRooms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await RoomAPI.findAll();
      setDbRooms(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load rooms');
    } finally {
      setIsLoading(false);
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


  const sortedDbRooms = [...dbRooms].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  const roomsData = sortedDbRooms.map(r => ({
    id: r.id,
    block: `${r.block} | ${r.type}`,
    status: r.occupiedCount === r.capacity ? 'Full' : r.occupiedCount === 0 ? 'Fully Vacant' : 'Partially Filled',
    price: `₹${(Number(r.rent || 0) + Number(r.messFee || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`,
    type: r.type,
    amenities: r.amenities ? r.amenities.split(',').map((a: string) => a.trim()) : [],
    filled: r.occupiedCount,
    total: r.capacity,
    occupants: r.occupiedCount > 0 ? `${r.occupiedCount} Students` : 'Ready for allocation',
    rent: r.rent,
    messFee: r.messFee,
    floor: r.floor
  }));

  const tableData = sortedDbRooms.map(r => ({
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
    live: r.occupiedCount > 0 ? `${r.occupiedCount} Students` : 'None (Vacant)',
    floor: r.floor
  }));

  const filteredGridDataRaw = roomsData.filter(room => {
    const matchesSearch = room.id.toLowerCase().includes(searchTerm.toLowerCase()) || room.block.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType !== 'All Types' && !room.type.toLowerCase().includes(filterType.toLowerCase())) return false;
    if (filterStatus === 'Available') return room.filled < room.total;
    if (filterStatus === 'Fully Vacant') return room.filled === 0;
    if (filterStatus === 'Full') return room.filled === room.total;
    return true;
  });
  const totalGridPages = Math.ceil(filteredGridDataRaw.length / limit) || 1;
  const filteredGridData = filteredGridDataRaw.slice((page - 1) * limit, page * limit);

  const filteredTableDataRaw = tableData.filter(row => {
    const matchesSearch = row.room.toLowerCase().includes(searchTerm.toLowerCase()) || row.loc.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType !== 'All Types' && !row.type.toLowerCase().includes(filterType.toLowerCase())) return false;
    if (filterStatus === 'Available') return row.vac > 0;
    if (filterStatus === 'Fully Vacant') return row.occ === 0;
    if (filterStatus === 'Full') return row.vac === 0;
    return true;
  });
  const totalTablePages = Math.ceil(filteredTableDataRaw.length / limit) || 1;
  const filteredTableData = filteredTableDataRaw.slice((page - 1) * limit, page * limit);

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
            <button onClick={() => { setIsEditing(false); setNewRoom({ id: '', block: '', floor: 1, type: 'Single', capacity: 1, rent: 0, messFee: 0, amenities: '' }); setIsModalOpen(true); }} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
              <Plus size={16} /> Add New Room
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '20px', marginBottom: '30px' }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '10px 15px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: '#64748b' }}>
          <Filter size={16} style={{ marginRight: '6px' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>Filter:</span>
        </div>
        {['All', 'Available', 'Fully Vacant', 'Full'].map(f => (
          <button
            key={f}
            onClick={() => { setFilterStatus(f); setPage(1); }}
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

        <div style={{ marginLeft: '10px', paddingLeft: '10px', borderLeft: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
          <select 
            value={filterType} 
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
          >
            <option value="All Types">All Types</option>
            <option value="Single">Single</option>
            <option value="Double">Double</option>
            <option value="Triple">Triple</option>
            <option value="Four Sharing">Four Sharing</option>
            <option value="Dormitory">Dormitory</option>
          </select>
        </div>

        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search by Room / Block..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '220px' }} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
      ) : (
        <>
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
                  <span className="status-pill" style={{ position: 'absolute', top: '16px', right: '16px', border: '1px solid #cbd5e1', color: '#334155', background: '#e2e8f0' }}>
                    Non-AC
                  </span>
                )}

                <button onClick={() => handleEditClick(r)} style={{ position: 'absolute', top: '48px', right: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', boxShadow: '0 1px 2px rgba(59, 130, 246, 0.1)' }} title="Edit Room">
                  <SquarePen size={14} />
                </button>

                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <h3 className="card-title" style={{ margin: 0 }}>Room {r.id}</h3>
                </div>
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

          {totalGridPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '30px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: page === 1 ? '#f8f9fa' : 'white', color: page === 1 ? '#94a3b8' : '#334155', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalGridPages}</span>
              <button onClick={() => setPage(p => Math.min(totalGridPages, p + 1))} disabled={page === totalGridPages} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: page === totalGridPages ? '#f8f9fa' : 'white', color: page === totalGridPages ? '#94a3b8' : '#334155', cursor: page === totalGridPages ? 'not-allowed' : 'pointer' }}>Next</button>
            </div>
          )}

        </div>
      )}

      {viewMode === 'table' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>Rooms Master Directory</h3>
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
                  <th style={{ padding: '16px 20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1e293b' }}>{row.room}</td>
                    <td style={{ padding: '16px 20px', color: '#475569' }}>{row.loc}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ border: `1px solid ${getTypeStyle(row.type).borderColor}`, background: getTypeStyle(row.type).background, padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: getTypeStyle(row.type).color, fontWeight: 600 }}>{row.type}</span>
                    </td>
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
                    <td style={{ padding: '16px 20px' }}>
                      <button onClick={() => handleEditClick(row)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#334155', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <SquarePen size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, filteredTableDataRaw.length)} of {filteredTableDataRaw.length} entries</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === 1 ? '#f8f9fa' : 'white', color: page === 1 ? '#94a3b8' : '#334155', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Prev</button>
              <button onClick={() => setPage(p => Math.min(totalTablePages, p + 1))} disabled={page === totalTablePages} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === totalTablePages ? '#f8f9fa' : 'white', color: page === totalTablePages ? '#94a3b8' : '#334155', cursor: page === totalTablePages ? 'not-allowed' : 'pointer' }}>Next</button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
      {/* Add Room Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)' }}>{isEditing ? 'Edit Room' : 'Add New Room'}</h3>
              <button onClick={() => { setIsModalOpen(false); setIsEditing(false); setNewRoom({ id: '', block: '', floor: 1, type: 'Single', capacity: 1, rent: 0, messFee: 0, amenities: '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleAddRoom} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Room Number</label>
                  <input type="text" placeholder="e.g. 101" required value={newRoom.id} onChange={e => setNewRoom({ ...newRoom, id: e.target.value })} disabled={isEditing} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: isEditing ? '#f8f9fa' : 'white', cursor: isEditing ? 'not-allowed' : 'text' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Block</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="Block (e.g. A)" required value={newRoom.block} onChange={e => setNewRoom({ ...newRoom, block: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
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
                  <input type="number" required value={newRoom.capacity} onChange={e => setNewRoom({ ...newRoom, capacity: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Monthly Rent (₹)</label>
                  <input type="number" required value={newRoom.rent} onChange={e => setNewRoom({ ...newRoom, rent: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Mess Fee (₹)</label>
                  <input type="number" required value={newRoom.messFee} onChange={e => setNewRoom({ ...newRoom, messFee: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
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
                <button type="button" onClick={() => { setIsModalOpen(false); setIsEditing(false); setNewRoom({ id: '', block: '', floor: 1, type: 'Single', capacity: 1, rent: 0, messFee: 0, amenities: '' }); }} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
                  {isSubmitting ? 'Saving...' : (isEditing ? 'Update Room' : 'Save Room')}
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
