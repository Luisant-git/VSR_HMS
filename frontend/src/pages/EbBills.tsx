import { useState, useEffect } from 'react';

import { Calculator, History, X, FileSpreadsheet, Pencil, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingSpinner';
import { RoomAPI } from '../api/room.api';
import { EbBillsAPI } from '../api/eb-bill.api';
import { toast } from 'react-toastify';

const currentMonthStr = new Date().toISOString().slice(0, 7);

// Keep numeric text inputs clean: digits and a single decimal point only.
const sanitizeNumber = (v: string) => {
  let s = (v || '').replace(/[^\d.]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
  return s;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  outline: 'none',
};

const EbBills = () => {

  // Readings & tariff kept as strings so the inputs behave as plain text boxes
  // (no native number stepper arrows).
  const [prevReading, setPrevReading] = useState('0');
  const [currReading, setCurrReading] = useState('0');
  const [tariff, setTariff] = useState('8.5');
  const [billingCycle, setBillingCycle] = useState(currentMonthStr);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  const [rooms, setRooms] = useState<any[]>([]);
  const [roomBills, setRoomBills] = useState<any[]>([]);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Edit mode
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Pagination & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    fetchBillingHistory();
  }, [page, searchTerm, fromDate, toDate]);

  // Whenever the selected room changes, load that room's bills so we can
  // proactively detect a duplicate for the chosen cycle.
  useEffect(() => {
    fetchRoomBills();
  }, [selectedRoom]);

  const fetchRooms = async () => {
    try {
      const data = await RoomAPI.findAll();
      setRooms(data);
    } catch (error) {
      setError('Failed to load rooms');
    }
  };

  const fetchRoomBills = async () => {
    if (!selectedRoom) {
      setRoomBills([]);
      return;
    }
    try {
      const bills = await EbBillsAPI.findByRoom(selectedRoom.value.id);
      setRoomBills(Array.isArray(bills) ? bills : []);
    } catch {
      setRoomBills([]);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await EbBillsAPI.findAll({ page, limit, search: searchTerm, fromDate, toDate });
      const data = Array.isArray(res) ? res : (res.data || []);
      setBillingHistory(data);
      setTotalPages(res.totalPages || 1);
      setTotalRecords(res.total || data.length);
    } catch (error) {
      setError('Failed to load EB bills history');
    } finally {
      setIsLoading(false);
    }
  };

  // Align the preview with the backend (status !== 'Vacated')
  const activeStudentsInRoom = selectedRoom?.value?.students?.filter((s: any) => s.status !== 'Vacated') || [];
  const studentCount = activeStudentsInRoom.length;

  const prev = parseFloat(prevReading) || 0;
  const curr = parseFloat(currReading) || 0;
  const rate = parseFloat(tariff) || 0;
  const unitsConsumed = curr >= prev ? curr - prev : 0;
  const totalCost = unitsConsumed * rate;
  const splitPerStudent = studentCount > 0 ? totalCost / studentCount : 0;

  // Is there already a bill for the selected room + cycle?
  const existingBill = roomBills.find((b) => b.billingCycle === billingCycle) || null;
  const isDuplicate = mode === 'create' && !!existingBill;

  const roomOptions = rooms.map(room => {
    const activeCount = room.students?.filter((s: any) => s.status !== 'Vacated').length || 0;
    return {
      value: room,
      label: `Room ${room.id} (${activeCount} hosteller${activeCount === 1 ? '' : 's'})`
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

  const loadForEdit = (bill: any) => {
    setMode('edit');
    setEditingId(bill.id);
    const opt = roomOptions.find((o) => o.value.id === bill.roomNo) || null;
    setSelectedRoom(opt);
    setBillingCycle(bill.billingCycle);
    setPrevReading(String(bill.prevReading));
    setCurrReading(String(bill.currReading));
    setTariff(String(bill.tariffRate));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setMode('create');
    setEditingId(null);
    setPrevReading('0');
    setCurrReading('0');
    setTariff('8.5');
  };

  const handleSubmit = async () => {
    if (!selectedRoom) {
      toast.error('Please select a room');
      return;
    }
    if (curr < prev) {
      toast.error('Current reading cannot be less than previous reading');
      return;
    }
    if (mode === 'create' && existingBill) {
      toast.error(`Already entered for Room ${selectedRoom.value.id} in ${billingCycle}. Use the Edit option.`);
      return;
    }
    if (studentCount === 0) {
      toast.warning('No active students in this room to split the bill');
    }

    try {
      setIsSubmitting(true);
      const payload = {
        roomNo: selectedRoom.value.id,
        billingCycle,
        prevReading: prev,
        currReading: curr,
        tariffRate: rate,
      };

      if (mode === 'edit' && editingId) {
        await EbBillsAPI.update(editingId, payload);
        toast.success('EB bill updated successfully');
      } else {
        await EbBillsAPI.create(payload);
        toast.success('EB Bill created successfully and split among students');
        // Carry the reading forward for the next entry
        setPrevReading(currReading);
        setCurrReading('0');
      }

      await fetchRoomBills();
      fetchBillingHistory();
      if (mode === 'edit') cancelEdit();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save EB bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (bill: any) => {
    if (!window.confirm(`Delete the EB bill for Room ${bill.roomNo} (${bill.billingCycle})?\nThis removes the pending student charges created by this bill.`)) {
      return;
    }
    EbBillsAPI.remove(bill.id)
      .then(() => {
        toast.success('EB bill deleted');
        fetchBillingHistory();
        if (selectedRoom?.value.id === bill.roomNo) fetchRoomBills();
      })
      .catch((e: any) => toast.error(e.message || 'Failed to delete EB bill'));
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await EbBillsAPI.findAll({ limit: 100000 });
      const all = Array.isArray(res) ? res : (res.data || []);
      if (all.length === 0) {
        toast.info('No EB bills to export');
        return;
      }

      // Group bills by billing cycle (month-wise)
      const byCycle: Record<string, any[]> = {};
      all.forEach((b: any) => {
        (byCycle[b.billingCycle] ||= []).push(b);
      });
      const cycles = Object.keys(byCycle).sort();

      const wb = XLSX.utils.book_new();

      // Summary sheet — one row per month
      const summary = cycles.map((c) => {
        const rows = byCycle[c];
        const totalUnits = rows.reduce((s, r) => s + (r.unitsConsumed || 0), 0);
        const totalBill = rows.reduce((s, r) => s + (r.totalAmount || 0), 0);
        return {
          Month: c,
          Rooms: rows.length,
          'Total Units': +totalUnits.toFixed(1),
          'Total Bill (₹)': +totalBill.toFixed(2),
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');

      // One sheet per billing cycle
      cycles.forEach((c) => {
        const rows = byCycle[c]
          .slice()
          .sort((a, b) => String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true }));
        const data = rows.map((r) => ({
          Room: r.roomNo,
          Cycle: r.billingCycle,
          'Previous Reading': r.prevReading,
          'Current Reading': r.currReading,
          'Meter Readings': `${Number(r.prevReading).toFixed(1)} -> ${Number(r.currReading).toFixed(1)}`,
          Units: +(r.unitsConsumed).toFixed(1),
          'Tariff Rate': r.tariffRate,
          'Total Bill (₹)': r.totalAmount,
          'Per Head Share (₹)': r.perStudentShare,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, c);
      });

      XLSX.writeFile(wb, `EB_Bills_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Excel exported successfully');
    } catch {
      toast.error('Failed to export Excel');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Rooms EB Bill Sharing Calculator"
        subtitle="Sub-meter electricity calculation and automatic equal cost distribution across room hostellers"
        icon={<Calculator size={24} color="#fff" />} iconBg="linear-gradient(135deg, #eab308 0%, #ca8a04 100%)"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(min(100%, 300px), 420px) 1fr', gap: '25px', alignItems: 'start' }}>
        {/* Left Column: Form */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {mode === 'edit' ? <Pencil size={18} color="var(--sidebar-active)" /> : <Calculator size={18} color="var(--sidebar-active)" />}
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>
              {mode === 'edit' ? 'Edit Room EB Bill' : 'Calculate Room EB Bill'}
            </h3>
            {mode === 'edit' && (
              <button onClick={cancelEdit} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '12px', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
                <RotateCcw size={14} /> Cancel Edit
              </button>
            )}
          </div>

          <div style={{ padding: '14px 16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Select Room</label>
              <Select
                options={roomOptions}
                value={selectedRoom}
                onChange={setSelectedRoom}
                placeholder="-- Choose Occupied Room --"
                styles={selectStyles}
                isSearchable={true}
                isClearable={true}
                isDisabled={mode === 'edit'}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Billing Month / Cycle</label>
              <input
                type="month"
                value={billingCycle}
                max={currentMonthStr}
                onChange={e => setBillingCycle(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Friendly duplicate warning */}
            {isDuplicate && (
              <div style={{ marginBottom: '12px', padding: '8px 10px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fcd34d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#92400e', flex: 1 }}>
                  Already entered for Room <strong>{selectedRoom?.value?.id}</strong> in {billingCycle}.
                </span>
                <button
                  onClick={() => existingBill && loadForEdit(existingBill)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid #d97706', borderRadius: '5px', background: 'white', fontSize: '11px', fontWeight: 600, color: '#d97706', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <Pencil size={11} /> Edit
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Previous Reading (Units)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={prevReading === '0' ? '' : prevReading}
                  placeholder="0"
                  onChange={(e) => setPrevReading(sanitizeNumber(e.target.value) || '0')}
                  style={{ ...inputStyle, color: prevReading === '0' ? '#94a3b8' : '#1e293b' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Current Reading (Units)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={currReading === '0' ? '' : currReading}
                  placeholder="0"
                  onChange={(e) => setCurrReading(sanitizeNumber(e.target.value) || '0')}
                  style={{ ...inputStyle, color: currReading === '0' ? '#94a3b8' : '#1e293b' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Electricity Tariff Rate (₹ per Unit)</label>
              <input
                type="text"
                inputMode="decimal"
                value={tariff}
                onChange={(e) => setTariff(sanitizeNumber(e.target.value))}
                style={inputStyle}
              />
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
              onClick={handleSubmit}
              disabled={isSubmitting || isDuplicate}
              style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: isSubmitting || isDuplicate ? '#94a3b8' : 'var(--sidebar-active)', border: 'none', color: 'white', cursor: isSubmitting || isDuplicate ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: isSubmitting || isDuplicate ? 'none' : '0 4px 10px rgba(74, 114, 250, 0.3)' }}
            >
              {isSubmitting
                ? 'Saving...'
                : mode === 'edit'
                  ? 'Update Bill'
                  : isDuplicate
                    ? 'Already Entered — Use Edit'
                    : 'Generate Student Invoices'}
            </button>
          </div>
        </div>

        {/* Right Column: History */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={18} color="var(--sidebar-active)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>Room EB Billing History</h3>
              </div>
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--sidebar-active)', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.7 : 1 }}
              >
                <FileSpreadsheet size={15} /> {isExporting ? 'Exporting...' : 'Export Excel (Month-wise)'}
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                <input
                  type="text"
                  placeholder="Search Room..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '8px 30px 8px 15px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); setPage(1); }}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 0 }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 150px', minWidth: '140px' }}>
                <label style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>From:</label>
                <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155', minWidth: '0' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 150px', minWidth: '140px' }}>
                <label style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>To:</label>
                <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155', minWidth: '0' }} />
              </div>
              {(fromDate || toDate) && (
                <button onClick={() => { setFromDate(''); setToDate(''); setPage(1); }} style={{ padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: '6px', fontSize: '13px', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Clear Dates
                </button>
              )}
            </div>
          </div>

          <div className="table-responsive" style={{ flex: 1, overflowX: 'auto' }}>
            {isLoading ? (
              <LoadingBlock text="Loading history..." padding="20px" />
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
            ) : (
              <table className="data-table" style={{ width: '100%', minWidth: '760px', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '12px', letterSpacing: '0.02em' }}>
                    <th style={{ padding: '10px 16px' }}>Room</th>
                    <th style={{ padding: '10px 16px' }}>Cycle</th>
                    <th style={{ padding: '10px 16px' }}>Meter readings</th>
                    <th style={{ padding: '10px 16px' }}>Units</th>
                    <th style={{ padding: '10px 16px' }}>Total bill</th>
                    <th style={{ padding: '10px 16px' }}>Per head share</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((bill) => (
                    <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{bill.roomNo}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{bill.billingCycle}</span></td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{bill.prevReading.toFixed(1)} &rarr; {bill.currReading.toFixed(1)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{bill.unitsConsumed.toFixed(1)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#ef4444' }}>₹{bill.totalAmount.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--sidebar-active)' }}>₹{bill.perStudentShare.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => loadForEdit(bill)}
                            title="Edit"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer', color: '#2563eb' }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(bill)}
                            title="Delete"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', border: '1px solid #fecaca', borderRadius: '6px', background: 'white', cursor: 'pointer', color: '#dc2626' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {billingHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No billing history found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748b', background: '#f8fafc' }}>
            <div>Showing <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords === 0 ? 0 : (page - 1) * limit + 1}</span> to <span style={{ fontWeight: 600, color: '#1e293b' }}>{Math.min(page * limit, totalRecords)}</span> of <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords}</span> entries</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderRight: 'none', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '6px 0 0 6px', color: page === 1 ? '#94a3b8' : '#64748b', fontSize: '13px', transition: 'all 0.2s' }}
              >
                Previous
              </button>
              <button
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', minWidth: '32px', padding: '0 12px', border: '1px solid #3b82f6', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: 500, position: 'relative', zIndex: 1, cursor: 'default' }}
              >
                {page}
              </button>
              <button
                disabled={page >= totalPages || totalPages === 0}
                onClick={() => setPage(p => p + 1)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderLeft: 'none', background: 'white', cursor: page >= totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', borderRadius: '0 6px 6px 0', color: page >= totalPages || totalPages === 0 ? '#94a3b8' : '#0369a1', fontSize: '13px', transition: 'all 0.2s' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EbBills;
