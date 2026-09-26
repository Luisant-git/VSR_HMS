import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Search, History, Zap, IndianRupee, ArrowLeft } from 'lucide-react';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';

const EbBills = () => {
  const navigate = useNavigate();
  const [prevReading, setPrevReading] = useState(1240.0);
  const [currReading, setCurrReading] = useState(1385.0);
  const [tariff, setTariff] = useState(8.50);
  const studentCount = 4; // Mock student count for a full room
  
  const billingHistory = [
    { id: 1, room: 'Room 101', cycle: '2026-08', prev: 1100.0, curr: 1240.0, units: 140.0, total: 1190.00, students: 2, perHead: 595.00 },
    { id: 2, room: 'Room 102', cycle: '2026-08', prev: 850.0, curr: 925.0, units: 75.0, total: 637.50, students: 2, perHead: 318.75 },
    { id: 3, room: 'Room 103', cycle: '2026-08', prev: 2100.0, curr: 2320.0, units: 220.0, total: 1870.00, students: 1, perHead: 1870.00 },
    { id: 4, room: 'Room 201', cycle: '2026-08', prev: 400.0, curr: 490.0, units: 90.0, total: 765.00, students: 4, perHead: 191.25 },
    { id: 5, room: 'Room 104', cycle: '2026-08', prev: 1540.0, curr: 1680.0, units: 140.0, total: 1190.00, students: 3, perHead: 396.67 }
  ];

  const unitsConsumed = currReading >= prevReading ? currReading - prevReading : 0;
  const totalCost = unitsConsumed * tariff;
  const splitPerStudent = studentCount > 0 ? totalCost / studentCount : 0;

  const roomOptions = [
    { value: '101', label: 'Room 101 (4/4 Occupied)' },
    { value: '102', label: 'Room 102 (3/4 Occupied)' },
    { value: '103', label: 'Room 103 (2/4 Occupied)' },
    { value: '104', label: 'Room 104 (4/4 Occupied)' }
  ];

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base, padding: '4px', borderRadius: '8px', borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1', boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none', '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#94a3b8' }, fontSize: '13px'
    }),
    option: (base: any, state: any) => ({
      ...base, fontSize: '13px', backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white', color: state.isSelected ? 'white' : '#334155', cursor: 'pointer'
    })
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCycle, setFilterCycle] = useState('');

  const filteredHistory = billingHistory.filter(bill => {
    const matchesSearch = !searchTerm || bill.room.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCycle = !filterCycle || bill.cycle === filterCycle;
    return matchesSearch && matchesCycle;
  });

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Rooms EB Bill Sharing Calculator"
        subtitle="Sub-meter electricity calculation and automatic equal cost distribution across room hostellers"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '25px' }}>
        {/* Left Column: Form */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calculator size={18} color="var(--sidebar-active)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>Calculate Room EB Bill</h3>
          </div>
          
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select Room</label>
              <Select 
                options={roomOptions}
                placeholder="-- Choose Occupied Room --"
                styles={selectStyles}
                isSearchable={true}
                isClearable={true}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Billing Month / Cycle</label>
              <input type="month" defaultValue="2026-09" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Previous Reading (Units)</label>
                <input type="number" value={prevReading} onChange={(e) => setPrevReading(Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Current Reading (Units)</label>
                <input type="number" value={currReading} onChange={(e) => setCurrReading(Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Electricity Tariff Rate (₹ per Unit)</label>
              <input type="number" step="0.1" value={tariff} onChange={(e) => setTariff(Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
            </div>

            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '15px' }}>Live Calculation Preview:</h4>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: '#475569' }}>Units Consumed:</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{unitsConsumed.toFixed(1)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: '#475569' }}>Total Room EB Cost:</span>
                <span style={{ fontWeight: 600, color: '#d93025' }}>₹{totalCost.toFixed(2)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '14px' }}>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>Split Per Student:</span>
                <span style={{ fontWeight: 700, color: 'var(--sidebar-active)' }}>₹{splitPerStudent.toFixed(2)}</span>
              </div>
            </div>
            
            <button style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
              Generate Student Invoices
            </button>
          </div>
        </div>

        {/* Right Column: History */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={18} color="var(--sidebar-active)" />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>Room EB Billing History</h3>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="month" value={filterCycle} onChange={e => setFilterCycle(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '140px', color: '#64748b', cursor: 'pointer' }} />
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search Room..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '160px' }} />
              </div>
            </div>
          </div>
          
          <div className="table-responsive" style={{ flex: 1, overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Cycle</th>
                  <th>Meter Readings</th>
                  <th>Units</th>
                  <th>Total Bill</th>
                  <th>Students</th>
                  <th>Per Head Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((bill) => (
                  <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{bill.room}</td>
                    <td><span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{bill.cycle}</span></td>
                    <td style={{ color: '#64748b', fontSize: '12px' }}>{bill.prev.toFixed(1)} &rarr; {bill.curr.toFixed(1)}</td>
                    <td style={{ fontWeight: 600 }}>{bill.units.toFixed(1)}</td>
                    <td style={{ fontWeight: 700, color: '#ef4444' }}>₹{bill.total.toFixed(2)}</td>
                    <td>{bill.students}</td>
                    <td style={{ fontWeight: 700, color: 'var(--sidebar-active)' }}>₹{bill.perHead.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EbBills;
