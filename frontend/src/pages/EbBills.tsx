import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Search, History, Zap, IndianRupee, ArrowLeft } from 'lucide-react';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { RoomAPI } from '../api/room.api';
import { EbBillsAPI } from '../api/eb-bill.api';
import { toast } from 'react-toastify';

const EbBills = () => {
  const navigate = useNavigate();
  const [prevReading, setPrevReading] = useState(0);
  const [currReading, setCurrReading] = useState(0);
  const [tariff, setTariff] = useState(8.50);
  const [billingCycle, setBillingCycle] = useState(new Date().toISOString().slice(0, 7));
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  
  const [rooms, setRooms] = useState<any[]>([]);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchBillingHistory();
  }, []);

  const fetchRooms = async () => {
    try {
      const data = await RoomAPI.findAll();
      setRooms(data);
    } catch (error) {
      toast.error('Failed to load rooms');
    }
  };

  const fetchBillingHistory = async () => {
    try {
      setIsLoading(true);
      const data = await EbBillsAPI.findAll();
      setBillingHistory(data);
    } catch (error) {
      toast.error('Failed to load EB bills history');
    } finally {
      setIsLoading(false);
    }
  };

  const activeStudentsInRoom = selectedRoom?.value?.students?.filter((s: any) => s.status === 'In') || [];
  const studentCount = activeStudentsInRoom.length;
  
  const unitsConsumed = currReading >= prevReading ? currReading - prevReading : 0;
  const totalCost = unitsConsumed * tariff;
  const splitPerStudent = studentCount > 0 ? totalCost / studentCount : 0;

  const roomOptions = rooms.map(room => {
    const activeCount = room.students?.filter((s: any) => s.status === 'In').length || 0;
    return {
      value: room,
      label: `Room ${room.id} (${activeCount} active hosteller${activeCount === 1 ? '' : 's'})`
    };
  });

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
    const matchesSearch = !searchTerm || bill.roomNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCycle = !filterCycle || bill.billingCycle === filterCycle;
    return matchesSearch && matchesCycle;
  });

  const handleGenerateInvoice = async () => {
    if (!selectedRoom) {
      toast.error('Please select a room');
      return;
    }
    if (currReading < prevReading) {
      toast.error('Current reading cannot be less than previous reading');
      return;
    }
    if (studentCount === 0) {
      toast.warning('No active students in this room to split the bill');
    }

    try {
      setIsSubmitting(true);
      await EbBillsAPI.create({
        roomNo: selectedRoom.value.id,
        billingCycle,
        prevReading,
        currReading,
        tariffRate: tariff
      });
      toast.success('EB Bill created successfully and split among students');
      fetchBillingHistory();
      setPrevReading(currReading);
      setCurrReading(0);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create EB bill');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                value={selectedRoom}
                onChange={setSelectedRoom}
                placeholder="-- Choose Occupied Room --"
                styles={selectStyles}
                isSearchable={true}
                isClearable={true}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Billing Month / Cycle</label>
              <input type="month" value={billingCycle} onChange={e => setBillingCycle(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
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
                <span style={{ color: '#0f172a', fontWeight: 600 }}>Split Per Student ({studentCount}):</span>
                <span style={{ fontWeight: 700, color: 'var(--sidebar-active)' }}>₹{splitPerStudent.toFixed(2)}</span>
              </div>
            </div>
            
            <button 
              onClick={handleGenerateInvoice}
              disabled={isSubmitting}
              style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: isSubmitting ? '#94a3b8' : 'var(--sidebar-active)', border: 'none', color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}
            >
              {isSubmitting ? 'Generating...' : 'Generate Student Invoices'}
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
            {isLoading ? (
               <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading history...</div>
            ) : (
            <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Cycle</th>
                  <th>Meter Readings</th>
                  <th>Units</th>
                  <th>Total Bill</th>
                  <th>Per Head Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((bill) => (
                  <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{bill.roomNo}</td>
                    <td><span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{bill.billingCycle}</span></td>
                    <td style={{ color: '#64748b', fontSize: '12px' }}>{bill.prevReading.toFixed(1)} &rarr; {bill.currReading.toFixed(1)}</td>
                    <td style={{ fontWeight: 600 }}>{bill.unitsConsumed.toFixed(1)}</td>
                    <td style={{ fontWeight: 700, color: '#ef4444' }}>₹{bill.totalAmount.toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--sidebar-active)' }}>₹{bill.perStudentShare.toFixed(2)}</td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No billing history found</td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EbBills;
