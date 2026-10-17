import { useState, useEffect } from 'react';
import { RoomAPI } from '../api/room.api';
import { Bed } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

const Rooms = () => {
  const navigate = useNavigate();

    const [dbRooms, setDbRooms] = useState<any[]>([]);

  useEffect(() => {
    RoomAPI.findAll().then(setDbRooms).catch(console.error);
  }, []);

  const blocksMap = dbRooms.reduce((acc, room) => {
    acc[room.block] = (acc[room.block] || 0) + 1;
    return acc;
  }, {});

  const styles = ['metric-card-blue', 'metric-card-orange', 'metric-card-purple', 'metric-card-yellow', 'metric-card-green'];
  
  const roomBlocks = Object.keys(blocksMap).map((block, i) => ({
    name: block,
    count: blocksMap[block],
    style: styles[i % styles.length]
  }));


  return (
    <div className="ui-page">
      <PageHeader
        title="Hostel Blocks"
        subtitle="All hostel blocks and their room counts"
        showBack={true}
        icon={<Bed size={24} color="#fff" />}
        iconBg="linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)"
      />
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
