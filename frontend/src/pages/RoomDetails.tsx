import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wind, Users, Bed, Filter } from 'lucide-react';

const RoomDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');

  const getRoomsForBlock = (blockId: string) => {
    if (!blockId) return [];
    const prefix = blockId[0];
    
    if (blockId === 'Dormitory') {
      return [{ id: 'Dorm', capacity: 28, occupied: 10, isAC: false }];
    }
    
    if (prefix === 'A' || prefix === 'C') {
      return Array.from({ length: 12 }, (_, i) => ({
        id: `${prefix}${i + 1}`,
        capacity: 5,
        occupied: Math.floor(Math.random() * 6),
        isAC: [7, 8, 9].includes(i + 1)
      }));
    }
    
    if (prefix === 'B' || prefix === 'D') {
      return Array.from({ length: 12 }, (_, i) => ({
        id: `${prefix}${i + 1}`,
        capacity: 6,
        occupied: Math.floor(Math.random() * 7),
        isAC: false
      }));
    }

    if (prefix === 'E') {
      return Array.from({ length: 5 }, (_, i) => ({
        id: `${prefix}${i + 1}`,
        capacity: i === 0 ? 1 : 5, // E1 is Warden (single), others 5
        occupied: i === 0 ? 1 : Math.floor(Math.random() * 6),
        isAC: i === 0 // Assuming Warden has AC
      }));
    }

    if (prefix === 'W') {
      return Array.from({ length: 3 }, (_, i) => ({
        id: `${prefix}${i + 1}`,
        capacity: 1,
        occupied: Math.floor(Math.random() * 2),
        isAC: true
      }));
    }

    return [];
  };

  const rooms = getRoomsForBlock(id || '');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <div className="flex items-center gap-4" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            style={{ 
              background: 'white', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-main)',
              padding: '8px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }} 
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-heading" style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>{id?.replace('-', ' ')} Details</h1>
            <p className="text-muted" style={{ fontSize: '14px', margin: '4px 0 0 0' }}>Individual room occupancy and management.</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '6px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: '#64748b' }}>
            <Filter size={14} style={{ marginRight: '6px' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Filter:</span>
          </div>
          {['All', 'Available', 'Fully Vacant', 'Full'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: filter === f ? 'var(--sidebar-active)' : 'transparent',
                color: filter === f ? 'white' : '#64748b',
                transition: 'all 0.2s'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4">
        {rooms.filter(room => {
          if (filter === 'Available') return room.occupied < room.capacity;
          if (filter === 'Fully Vacant') return room.occupied === 0;
          if (filter === 'Full') return room.occupied === room.capacity;
          return true;
        }).map((room, i) => (
          <div key={i} className="content-card" style={{ marginTop: 0, position: 'relative' }}>
            {room.isAC ? (
              <span className="status-pill status-paid" style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <Wind size={14} /> AC
              </span>
            ) : (
              <span className="status-pill" style={{ position: 'absolute', top: '16px', right: '16px', border: '1px solid var(--text-muted)', color: 'var(--text-muted)' }}>
                Non-AC
              </span>
            )}
            
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Room {room.id}</h3>
            
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
                <span style={{ fontSize: '16px', fontWeight: 700, color: room.occupied === room.capacity ? '#dc3545' : 'var(--sidebar-active)' }}>
                  {room.occupied}
                </span>
                <span className="text-muted" style={{ fontSize: '13px', fontWeight: 600 }}>/ {room.capacity}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {Array.from({ length: room.capacity }).map((_, idx) => {
                const isOccupied = idx < room.occupied;
                const isFull = room.occupied === room.capacity;
                return (
                  <div key={idx} style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: isOccupied 
                      ? (isFull ? 'rgba(220, 53, 69, 0.1)' : 'rgba(74, 114, 250, 0.1)') 
                      : '#f4f6f8',
                    color: isOccupied 
                      ? (isFull ? '#dc3545' : 'var(--sidebar-active)') 
                      : '#adb5bd',
                    border: '1px solid',
                    borderColor: isOccupied
                      ? (isFull ? 'rgba(220, 53, 69, 0.2)' : 'rgba(74, 114, 250, 0.2)')
                      : '#e9ecef'
                  }}>
                    <Bed size={20} strokeWidth={isOccupied ? 2.5 : 2} />
                  </div>
                );
              })}
            </div>
            
            <button 
              className="btn-green" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              onClick={() => navigate('/hostellers', { state: { filterRoom: `Room ${room.id}` } })}
            >
              View Students
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoomDetails;
