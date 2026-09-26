import React from 'react';
import { Bed, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Rooms = () => {
  const navigate = useNavigate();

  const roomBlocks = [
    { name: 'A Block', count: 12, style: 'metric-card-blue' },
    { name: 'B Block', count: 12, style: 'metric-card-orange' },
    { name: 'C Block', count: 12, style: 'metric-card-purple' },
    { name: 'D Block', count: 12, style: 'metric-card-yellow' },
    { name: 'E Block', count: 5, style: 'metric-card-green' },
    { name: 'W Block', count: 3, style: 'metric-card-purple' },
    { name: 'Dormitory', count: 1, style: 'metric-card-yellow' },
  ];

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div className="card-title">Hostel Blocks</div>
      </div>
      <div className="cards-row">
        {roomBlocks.map((block, i) => (
          <div key={i} className={`metric-card ${block.style}`} style={{ cursor: 'pointer' }} onClick={() => navigate(`/rooms/${block.name.replace(' ', '-')}`)}>
            <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {block.name} Total Rooms
              <Bed size={18} />
            </div>
            <div className="value">{block.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Rooms;
