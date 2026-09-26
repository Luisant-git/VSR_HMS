import React, { useState } from 'react';
import { Bed, Users, Search, Filter, Home, CheckCircle, XCircle, Plus, Zap, User, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

const RoomsDirectory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const metrics = [
    { label: 'Total Hostel Rooms', value: '10 Rooms', color: '#3b82f6', icon: <Home size={20} /> },
    { label: 'Total Bed Capacity', value: '28 Beds', color: '#8b5cf6', icon: <Bed size={20} /> },
    { label: 'Occupied Beds', value: '8 Beds', color: '#10b981', icon: <Users size={20} /> },
    { label: 'Vacant Beds', value: '20 Available', color: '#f59e0b', icon: <CheckCircle size={20} /> }
  ];

  const roomsData = [
    { id: '101', block: 'Block A | Floor 1', status: 'Full', price: '₹5,000.00/mo', type: 'double', amenities: ['AC', 'Bath'], filled: 2, total: 2, occupants: 'Aarav Sharma (HST-2026-001), Rohan Verma (HST-2026-003)' },
    { id: '102', block: 'Block A | Floor 1', status: 'Full', price: '₹4,200.00/mo', type: 'double', amenities: ['Bath'], filled: 2, total: 2, occupants: 'Kavya Patel (HST-2026-002), Meera Nair (HST-2026-006)' },
    { id: '103', block: 'Block A | Floor 1', status: 'Full', price: '₹7,500.00/mo', type: 'single', amenities: ['AC', 'Bath'], filled: 1, total: 1, occupants: 'Ananya Iyer (HST-2026-004)' },
    { id: '104', block: 'Block A | Floor 1', status: 'Full', price: '₹3,800.00/mo', type: 'triple', amenities: ['Bath'], filled: 3, total: 3, occupants: 'Vikramaditya Rao (HST-2026-005), Arunkarthick (HST-2026-008), Baskar (HST-2026-009)' },
    { id: '302', block: 'Block A | Floor 1', status: 'Fully Vacant', price: '₹4,500.00/mo', type: 'triple', amenities: ['AC', 'Bath'], filled: 0, total: 5, occupants: 'Ready for allocation' },
    { id: '201', block: 'Block B | Floor 2', status: 'Fully Vacant', price: '₹3,200.00/mo', type: 'four sharing', amenities: [], filled: 0, total: 4, occupants: 'Ready for allocation' },
    { id: '202', block: 'Block B | Floor 2', status: 'Fully Vacant', price: '₹4,500.00/mo', type: 'double', amenities: ['Bath'], filled: 0, total: 2, occupants: 'Ready for allocation' },
    { id: '203', block: 'Block B | Floor 2', status: 'Fully Vacant', price: '₹7,000.00/mo', type: 'single', amenities: ['AC', 'Bath'], filled: 0, total: 1, occupants: 'Ready for allocation' },
    { id: '204', block: 'Block B | Floor 2', status: 'Fully Vacant', price: '₹2,800.00/mo', type: 'dormitory', amenities: [], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: '301', block: 'Block A | Floor 2', status: 'Fully Vacant', price: '₹7,500.00/mo', type: 'double', amenities: ['AC', 'Bath'], filled: 0, total: 2, occupants: 'Ready for allocation' },
  ];

  const tableData = [
    { room: 'Room 101', loc: 'Block A (Floor 1)', type: 'double', cap: '2 Beds', occ: 2, vac: 0, rent: 5000, mess: 3500, tot: 8500, amen: 'AC Attached Bath', live: 'Aarav Sharma (HST-2026-001), Rohan Verma (HST-2026-003)' },
    { room: 'Room 102', loc: 'Block A (Floor 1)', type: 'double', cap: '2 Beds', occ: 2, vac: 0, rent: 4200, mess: 3500, tot: 7700, amen: 'Attached Bath', live: 'Kavya Patel (HST-2026-002), Meera Nair (HST-2026-006)' },
    { room: 'Room 103', loc: 'Block A (Floor 1)', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 7500, mess: 3500, tot: 11000, amen: 'AC Attached Bath', live: 'Ananya Iyer (HST-2026-004)' },
    { room: 'Room 104', loc: 'Block A (Floor 1)', type: 'triple', cap: '3 Beds', occ: 3, vac: 0, rent: 3800, mess: 3500, tot: 7300, amen: 'Attached Bath', live: 'Vikramaditya Rao (HST-2026-005), Arunkarthick (HST-2026-008), Baskar (HST-2026-009)' },
    { room: 'Room 302', loc: 'Block A (Floor 1)', type: 'triple', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'AC Attached Bath', live: 'None (Vacant)' },
    { room: 'Room 201', loc: 'Block B (Floor 2)', type: 'four sharing', cap: '4 Beds', occ: 0, vac: 4, rent: 3200, mess: 3500, tot: 6700, amen: 'None', live: 'None (Vacant)' },
    { room: 'Room 202', loc: 'Block B (Floor 2)', type: 'double', cap: '2 Beds', occ: 0, vac: 2, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room 203', loc: 'Block B (Floor 2)', type: 'single', cap: '1 Beds', occ: 0, vac: 1, rent: 7000, mess: 3500, tot: 10500, amen: 'AC Attached Bath', live: 'None (Vacant)' },
    { room: 'Room 204', loc: 'Block B (Floor 2)', type: 'dormitory', cap: '6 Beds', occ: 0, vac: 6, rent: 2800, mess: 3500, tot: 6300, amen: 'None', live: 'None (Vacant)' },
    { room: 'Room 301', loc: 'Block A (Floor 2)', type: 'double', cap: '2 Beds', occ: 0, vac: 2, rent: 7500, mess: 8000, tot: 15500, amen: 'AC Attached Bath', live: 'None (Vacant)' },
  ];

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Rooms & Live Occupancy Grid"
        subtitle="Dynamic room bed status strictly reflecting active resident hostellers"
        rightContent={
          <>
            <button onClick={() => navigate('/rooms/eb-bills')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#eab308', color: '#1e293b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(234, 179, 8, 0.3)' }}>
              <Zap size={16} color="#1e293b" /> Room EB Bills
            </button>
            <button style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
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

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '15px' }}>Live Room Layout Visualizer</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {roomsData.map((r, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.12)'} onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.08)'}>
              <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 4px 0' }}>Room {r.id}</h4>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>{r.block}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: r.status === 'Full' ? '#dc3545' : '#198754', color: 'white' }}>
                    {r.status}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#0d6efd' }}>{r.price}</span>
                </div>
              </div>
              
              <div style={{ padding: '0 20px', display: 'flex', gap: '8px', marginBottom: '15px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827', border: '1px solid #e5e7eb', background: 'white', padding: '4px 10px', borderRadius: '6px', textTransform: 'capitalize' }}>{r.type}</span>
                {r.amenities.includes('AC') && <span style={{ fontSize: '13px', fontWeight: 500, color: '#0369a1', background: '#cffafe', padding: '4px 10px', borderRadius: '6px' }}>AC</span>}
                {r.amenities.includes('Bath') && <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827', background: '#e5e7eb', padding: '4px 10px', borderRadius: '6px' }}>Bath</span>}
              </div>
              
              <div style={{ padding: '0 20px', marginBottom: '15px' }}>
                <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4b5563', marginBottom: '10px' }}>
                    <span>Bed Allocation:</span>
                    <span style={{ fontWeight: 700, color: '#111827' }}>{r.filled} / {r.total} Filled</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {Array.from({ length: r.total }).map((_, idx) => (
                      <div key={idx} style={{ width: '14px', height: '14px', borderRadius: '4px', background: idx < r.filled ? '#dc3545' : '#22c55e' }}></div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div style={{ padding: '0 20px 20px 20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', marginBottom: '6px' }}>CURRENT OCCUPANTS:</div>
                <div style={{ fontSize: '13px', color: r.filled > 0 ? '#111827' : '#0d9488', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {r.filled > 0 ? <User size={14} color="#0d6efd" style={{ flexShrink: 0 }} /> : <CheckCircle size={14} color="#0d9488" style={{ flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }} title={r.occupants}>{r.occupants}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
              {tableData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1e293b' }}>{row.room}</td>
                  <td style={{ padding: '16px 20px', color: '#475569' }}>{row.loc}</td>
                  <td style={{ padding: '16px 20px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: '#475569', fontWeight: 600 }}>{row.type}</span></td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{row.cap}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: row.occ > 0 ? '#0f172a' : '#94a3b8' }}>{row.occ}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: row.vac > 0 ? '#22c55e' : '#ef4444' }}>{row.vac}</td>
                  <td style={{ padding: '16px 20px', color: '#475569', fontSize: '12px' }}>
                    <div>Rent: ₹{row.rent.toFixed(2)}</div>
                    <div>Mess: ₹{row.mess.toFixed(2)}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>Total: ₹{row.tot.toFixed(2)}/mo</div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#475569' }}>{row.amen}</td>
                  <td style={{ padding: '16px 20px', color: row.occ > 0 ? '#334155' : '#94a3b8' }}>{row.live}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RoomsDirectory;
