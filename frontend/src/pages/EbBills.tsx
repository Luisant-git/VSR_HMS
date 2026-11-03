import { useState, useEffect } from 'react';

import { Calculator, History, X, FileSpreadsheet, Pencil, /* Trash2, */ AlertTriangle, RotateCcw, SquarePen, Wind } from 'lucide-react';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingSpinner';
import { RoomAPI } from '../api/room.api';
import { EbBillsAPI } from '../api/eb-bill.api';
import { toast } from 'react-toastify';

const currentMonthStr = new Date().toISOString().slice(0, 7);
const formatBillingCycle = (cycle: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(cycle);
  if (!match) return cycle;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return Number.isNaN(date.getTime())
    ? cycle
    : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '6px',
};

// Reading input that shows a grey "0" placeholder when empty.
const ReadingInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <input
    type="text"
    inputMode="decimal"
    value={value === '0' ? '' : value}
    placeholder="0"
    onChange={(e) => onChange(sanitizeNumber(e.target.value) || '0')}
    style={{ ...inputStyle, color: value === '0' ? '#94a3b8' : '#1e293b' }}
  />
);

const EbBills = () => {
  // Meter readings kept as strings (plain text boxes, no steppers).
  const [acPrev, setAcPrev] = useState('0');
  const [acCurr, setAcCurr] = useState('0');
  const [normalPrev, setNormalPrev] = useState('0');
  const [normalCurr, setNormalCurr] = useState('0');
  const [hasAcMeter, setHasAcMeter] = useState(false);
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

  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('');
  const [billingCycles, setBillingCycles] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 10;

  useEffect(() => { fetchRooms(); }, []);
  useEffect(() => { fetchBillingCycles(); }, []);
  useEffect(() => { fetchBillingHistory(); }, [page, searchTerm, selectedBillingCycle]);
  useEffect(() => { fetchRoomBills(); }, [selectedRoom]);

  const fetchRooms = async () => {
    try { const data = await RoomAPI.findAll(); setRooms(data); }
    catch { setError('Failed to load rooms'); }
  };

  const fetchRoomBills = async () => {
    if (!selectedRoom) { setRoomBills([]); return; }
    try { const bills = await EbBillsAPI.findByRoom(selectedRoom.value.id); setRoomBills(Array.isArray(bills) ? bills : []); }
    catch { setRoomBills([]); }
  };

  const fetchBillingHistory = async () => {
    try {
      setIsLoading(true); setError(null);
      const res = await EbBillsAPI.findAll({
        page,
        limit,
        search: searchTerm,
        billingCycle: selectedBillingCycle || undefined,
      });
      const data = Array.isArray(res) ? res : (res.data || []);
      setBillingHistory(data);
      setTotalPages(res.totalPages || 1);
      setTotalRecords(res.total || data.length);
    } catch { setError('Failed to load EB bills history'); }
    finally { setIsLoading(false); }
  };

  const fetchBillingCycles = async () => {
    try {
      const cycles = await EbBillsAPI.findBillingCycles();
      setBillingCycles(Array.isArray(cycles) ? cycles : []);
    } catch {
      setError('Failed to load EB billing cycles');
    }
  };

  const activeStudentsInRoom = selectedRoom?.value?.students?.filter((s: any) => s.status !== 'Vacated') || [];
  const studentCount = activeStudentsInRoom.length;

  const acPrevN = parseFloat(acPrev) || 0;
  const acCurrN = parseFloat(acCurr) || 0;
  const normalPrevN = parseFloat(normalPrev) || 0;
  const normalCurrN = parseFloat(normalCurr) || 0;
  const rate = parseFloat(tariff) || 0;

  const acUnits = acCurrN >= acPrevN ? acCurrN - acPrevN : 0;
  const normalUnits = normalCurrN >= normalPrevN ? normalCurrN - normalPrevN : 0;
  const unitsConsumed = acUnits + normalUnits;
  const totalCost = unitsConsumed * rate;
  const splitPerStudent = studentCount > 0 ? totalCost / studentCount : 0;

  const existingBill = roomBills.find((b) => b.billingCycle === billingCycle) || null;
  const isDuplicate = mode === 'create' && !!existingBill;

  const roomOptions = rooms.map((room) => {
    const activeCount = room.students?.filter((s: any) => s.status !== 'Vacated').length || 0;
    return { value: room, label: `Room ${room.id} (${activeCount} hosteller${activeCount === 1 ? '' : 's'})` };
  });

  const selectStyles = {
    control: (base: any, state: any) => ({ ...base, padding: '4px', borderRadius: '8px', borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1', boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none', '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#94a3b8' }, fontSize: '13px' }),
    option: (base: any, state: any) => ({ ...base, fontSize: '13px', backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white', color: state.isSelected ? 'white' : '#334155', cursor: 'pointer' }),
  };

  const resetReadings = () => {
    setAcPrev('0'); setAcCurr('0'); setNormalPrev('0'); setNormalCurr('0'); setHasAcMeter(false); setTariff('8.5');
  };

  const loadForEdit = (bill: any) => {
    setMode('edit');
    setEditingId(bill.id);
    const opt = roomOptions.find((o) => o.value.id === bill.roomNo) || null;
    setSelectedRoom(opt);
    setBillingCycle(bill.billingCycle);
    setTariff(String(bill.tariffRate));
    setHasAcMeter(!!bill.hasAcMeter);
    // For legacy rows (no normal* fields), map prev/curr into the Normal meter.
    setAcPrev(String(bill.acPrevReading ?? 0));
    setAcCurr(String(bill.acCurrReading ?? 0));
    const nPrev = bill.normalPrevReading ?? bill.prevReading ?? 0;
    const nCurr = bill.normalCurrReading ?? bill.currReading ?? 0;
    setNormalPrev(String(nPrev));
    setNormalCurr(String(nCurr));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setMode('create'); setEditingId(null); resetReadings();
  };

  const handleSubmit = async () => {
    if (!selectedRoom) { toast.error('Please select a room'); return; }
    if (acCurrN < acPrevN || normalCurrN < normalPrevN) {
      toast.error('Current reading cannot be less than previous reading'); return;
    }
    if (mode === 'create' && existingBill) {
      toast.error(`Already entered for Room ${selectedRoom.value.id} in ${billingCycle}. Use the Edit option.`); return;
    }
    if (studentCount === 0) toast.warning('No active students in this room to split the bill');

    try {
      setIsSubmitting(true);
      const payload = {
        roomNo: selectedRoom.value.id,
        billingCycle,
        hasAcMeter,
        acPrevReading: acPrevN,
        acCurrReading: acCurrN,
        normalPrevReading: normalPrevN,
        normalCurrReading: normalCurrN,
        tariffRate: rate,
      };

      if (mode === 'edit' && editingId) {
        await EbBillsAPI.update(editingId, payload);
        toast.success('EB bill updated successfully');
      } else {
        await EbBillsAPI.create(payload);
        toast.success('EB Bill created successfully and split among students');
        // Carry readings forward for the next entry
        setAcPrev(acCurr); setAcCurr('0');
        setNormalPrev(normalCurr); setNormalCurr('0');
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

  /* const handleDelete = (bill: any) => {
    if (!window.confirm(`Delete the EB bill for Room ${bill.roomNo} (${bill.billingCycle})?\nThis removes the pending student charges created by this bill.`)) return;
    EbBillsAPI.remove(bill.id)
      .then(() => { toast.success('EB bill deleted'); fetchBillingHistory(); if (selectedRoom?.value.id === bill.roomNo) fetchRoomBills(); })
      .catch((e: any) => toast.error(e.message || 'Failed to delete EB bill'));
  }; */

  const getBillReadings = (bill: any) => {
    const acPrev = Number(bill.acPrevReading || 0);
    const acCurr = Number(bill.acCurrReading || 0);
    const normalPrev = Number(bill.normalPrevReading || bill.prevReading || 0);
    const normalCurr = Number(bill.normalCurrReading || bill.currReading || 0);
    const hasAc = !!bill.hasAcMeter || acPrev > 0 || acCurr > 0;

    return {
      previous: hasAc
        ? [{ label: 'AC', value: acPrev }, { label: 'Normal', value: normalPrev }]
        : [{ label: '', value: normalPrev }],
      current: hasAc
        ? [{ label: 'AC', value: acCurr }, { label: 'Normal', value: normalCurr }]
        : [{ label: '', value: normalCurr }],
    };
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await EbBillsAPI.findAll({
        limit: 100000,
        search: searchTerm || undefined,
        billingCycle: selectedBillingCycle || undefined,
      });
      const all = Array.isArray(res) ? res : (res.data || []);
      if (all.length === 0) { toast.info('No EB bills to export'); return; }

      const columns = ['Room', 'Cycle', 'Previous Reading', 'Current Reading', 'Units', 'Total bill', 'Per head share'];
      const rows: Array<Record<(typeof columns)[number], string>> = all.map((bill: any) => {
        const readings = getBillReadings(bill);
        const formatReadings = (values: Array<{ label: string; value: number }>) =>
          values.map(({ label, value }) => `${label ? `${label}: ` : ''}${value.toFixed(1)}`).join('; ');

        return {
          Room: bill.roomNo,
          Cycle: bill.billingCycle,
          'Previous Reading': formatReadings(readings.previous),
          'Current Reading': formatReadings(readings.current),
          Units: Number(bill.unitsConsumed || 0).toFixed(1),
          'Total bill': `₹${Number(bill.totalAmount || 0).toFixed(2)}`,
          'Per head share': `₹${Number(bill.perStudentShare || 0).toFixed(2)}`,
        };
      });

      const wb = XLSX.utils.book_new();
      const exportedCycles = Array.from(
        new Set<string>(all.map((bill: any) => String(bill.billingCycle || ''))),
      ).filter(Boolean);
      const reportCycle = selectedBillingCycle || (exportedCycles.length === 1 ? exportedCycles[0] : '');
      const reportTitle = reportCycle
        ? `EB Bills - ${formatBillingCycle(reportCycle)}`
        : 'EB Bills - All Billing Cycles';
      const worksheet = XLSX.utils.aoa_to_sheet([
        [reportTitle],
        [],
        columns,
        ...rows.map((row) => columns.map((column) => row[column as keyof typeof row])),
      ]);
      XLSX.utils.book_append_sheet(wb, worksheet, 'EB Bills');

      const cycleSuffix = reportCycle ? `_${reportCycle}` : '';
      XLSX.writeFile(wb, `EB_Bills${cycleSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Excel exported successfully');
    } catch { toast.error('Failed to export Excel'); }
    finally { setIsExporting(false); }
  };

  return (
    <div className="eb-bills-page" style={{ paddingBottom: '40px', minWidth: 0, width: '100%' }}>
      <PageHeader
        title="Rooms EB Bill Sharing Calculator"
        subtitle="Sub-meter electricity calculation and automatic equal cost distribution across room hostellers"
        icon={<Calculator size={24} color="#fff" />} iconBg="linear-gradient(135deg, #eab308 0%, #ca8a04 100%)"
      />

      <div className="eb-bills-layout" style={{ display: 'grid', gap: '25px', alignItems: 'start', minWidth: 0, width: '100%' }}>
        {/* Left Column: Form */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {mode === 'edit' ? <Pencil size={18} color="var(--sidebar-active)" /> : <Calculator size={18} color="var(--sidebar-active)" />}
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>
              {mode === 'edit' ? 'Edit Room EB Bill' : 'Calculate Room EB Bill'}
            </h3>
          </div>

          <div style={{ padding: '14px 16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Select Room</label>
              <Select options={roomOptions} value={selectedRoom} onChange={setSelectedRoom} placeholder="-- Choose Occupied Room --" styles={selectStyles} isSearchable isClearable isDisabled={mode === 'edit'} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Billing Month / Cycle</label>
              <input type="month" value={billingCycle} max={currentMonthStr} onChange={(e) => setBillingCycle(e.target.value)} style={inputStyle} />
            </div>

            {/* AC meter toggle */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                <input type="checkbox" checked={hasAcMeter} onChange={(e) => { setHasAcMeter(e.target.checked); if (!e.target.checked) { setAcPrev('0'); setAcCurr('0'); } }} style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                <Wind size={13} color="#2563eb" /> This room has a separate AC meter
              </label>
            </div>

            {isDuplicate && (
              <div style={{ marginBottom: '12px', padding: '8px 10px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fcd34d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#92400e', flex: 1 }}>
                  Already entered for Room <strong>{selectedRoom?.value?.id}</strong> in {billingCycle}.
                </span>
                <button onClick={() => existingBill && loadForEdit(existingBill)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid #d97706', borderRadius: '5px', background: 'white', fontSize: '11px', fontWeight: 600, color: '#d97706', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Pencil size={11} /> Edit
                </button>
              </div>
            )}

            {/* AC meter readings */}
            {hasAcMeter && (
              <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginBottom: '8px' }}>AC Meter</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Previous Reading (Units)</label>
                    <ReadingInput value={acPrev} onChange={setAcPrev} />
                  </div>
                  <div>
                    <label style={labelStyle}>Current Reading (Units)</label>
                    <ReadingInput value={acCurr} onChange={setAcCurr} />
                  </div>
                </div>
              </div>
            )}

            {/* Normal meter readings */}
            <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>{hasAcMeter ? 'Normal Meter' : 'Meter Readings'}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Previous Reading (Units)</label>
                  <ReadingInput value={normalPrev} onChange={setNormalPrev} />
                </div>
                <div>
                  <label style={labelStyle}>Current Reading (Units)</label>
                  <ReadingInput value={normalCurr} onChange={setNormalCurr} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Electricity Tariff Rate (₹ per Unit)</label>
              <input type="text" inputMode="decimal" value={tariff} onChange={(e) => setTariff(sanitizeNumber(e.target.value))} style={inputStyle} />
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Live Calculation Preview:</h4>
              {hasAcMeter && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#2563eb' }}>AC Units:</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{acUnits.toFixed(1)}</span>
                </div>
              )}
              {hasAcMeter && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Normal Units:</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{normalUnits.toFixed(1)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: '#475569' }}>Total Units:</span>
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

            <button onClick={handleSubmit} disabled={isSubmitting || isDuplicate} style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: isSubmitting || isDuplicate ? '#94a3b8' : 'var(--sidebar-active)', border: 'none', color: 'white', cursor: isSubmitting || isDuplicate ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: isSubmitting || isDuplicate ? 'none' : '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
              {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Bill' : isDuplicate ? 'Already Entered — Use Edit' : 'Generate Student Invoices'}
            </button>
            {mode === 'edit' && (
              <button onClick={cancelEdit} style={{ width: '100%', marginTop: '8px', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <RotateCcw size={14} /> Cancel Edit
              </button>
            )}
          </div>
        </div>

        {/* Right Column: History */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={18} color="var(--sidebar-active)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>Room EB Billing History</h3>
              </div>
              <button onClick={handleExportExcel} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--sidebar-active)', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.7 : 1 }}>
                <FileSpreadsheet size={15} /> {isExporting ? 'Exporting...' : 'Export Excel (Month-wise)'}
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                <input type="text" placeholder="Search Room..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} style={{ width: '100%', padding: '8px 30px 8px 15px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                {searchTerm && (
                  <button onClick={() => { setSearchTerm(''); setPage(1); }} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 0 }}>
                    <X size={16} />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 190px', minWidth: '180px' }}>
                <label htmlFor="eb-billing-cycle-filter" style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>Billing Month / Cycle:</label>
                <select
                  id="eb-billing-cycle-filter"
                  value={selectedBillingCycle}
                  onChange={(e) => { setSelectedBillingCycle(e.target.value); setPage(1); }}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155', minWidth: '0', background: 'white' }}
                >
                  <option value="">All Billing Cycles</option>
                  {billingCycles.map((cycle) => (
                    <option key={cycle} value={cycle}>{formatBillingCycle(cycle)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="table-responsive" style={{ flex: 1, minWidth: 0, width: '100%', overflowX: 'auto' }}>
            {isLoading ? (
              <LoadingBlock text="Loading history..." padding="20px" />
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
            ) : (
              <table className="data-table eb-bills-history-table" style={{ width: '100%', minWidth: 0, tableLayout: 'fixed', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <colgroup>
                  {Array.from({ length: 8 }, (_, index) => <col key={index} style={{ width: '12.5%' }} />)}
                </colgroup>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '12px', letterSpacing: '0.02em' }}>
                    <th style={{ padding: '6px 6px' }}>Room</th>
                    <th style={{ padding: '6px 6px' }}>Cycle</th>
                    <th style={{ padding: '4px 6px', whiteSpace: 'normal', minWidth: 0, lineHeight: 1 }}>
                      <span style={{ display: 'block' }}>Previous</span>
                      <span style={{ display: 'block' }}>Reading</span>
                    </th>
                    <th style={{ padding: '4px 6px', whiteSpace: 'normal', minWidth: 0, lineHeight: 1 }}>
                      <span style={{ display: 'block' }}>Current</span>
                      <span style={{ display: 'block' }}>Reading</span>
                    </th>
                    <th style={{ padding: '6px' }}>Units</th>
                    <th style={{ padding: '6px', whiteSpace: 'normal' }}>Total bill</th>
                    <th style={{ padding: '6px', whiteSpace: 'normal', lineHeight: 1.1 }}>
                      Per head<br />share
                    </th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((bill) => {
                    const readings = getBillReadings(bill);
                    return (
                      <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 600, color: '#1e293b', overflowWrap: 'anywhere' }}>{bill.roomNo}</td>
                        <td style={{ padding: '8px 6px', overflowWrap: 'anywhere' }}><span style={{ background: '#f1f5f9', padding: '3px 4px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{bill.billingCycle}</span></td>
                        {[readings.previous, readings.current].map((columnReadings, columnIndex) => (
                          <td key={columnIndex} style={{ padding: '8px 6px', color: '#64748b', fontSize: '11px', overflowWrap: 'anywhere' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {columnReadings.map((reading, index) => (
                                <span key={index} style={{ color: reading.label === 'AC' ? '#2563eb' : '#64748b', fontWeight: reading.label ? 600 : 400 }}>
                                  {reading.label ? `${reading.label}: ` : ''}{reading.value.toFixed(1)}
                                </span>
                              ))}
                            </div>
                          </td>
                        ))}
                        <td style={{ padding: '8px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{(bill.unitsConsumed || 0).toFixed(1)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>₹{(bill.totalAmount || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--sidebar-active)', whiteSpace: 'nowrap' }}>₹{(bill.perStudentShare || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button onClick={() => loadForEdit(bill)} title="Edit" style={{ padding: '5px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#334155', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                              <SquarePen size={14} /> Edit
                            </button>
                            {/* <button onClick={() => handleDelete(bill)} title="Delete" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', border: '1px solid #fecaca', borderRadius: '6px', background: 'white', cursor: 'pointer', color: '#dc2626' }}>
                              <Trash2 size={14} />
                            </button> */}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {billingHistory.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No billing history found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748b', background: '#f8fafc' }}>
            <div>Showing <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords === 0 ? 0 : (page - 1) * limit + 1}</span> to <span style={{ fontWeight: 600, color: '#1e293b' }}>{Math.min(page * limit, totalRecords)}</span> of <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords}</span> entries</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderRight: 'none', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '6px 0 0 6px', color: page === 1 ? '#94a3b8' : '#64748b', fontSize: '13px', transition: 'all 0.2s' }}>Previous</button>
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', minWidth: '32px', padding: '0 12px', border: '1px solid #3b82f6', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: 500, position: 'relative', zIndex: 1, cursor: 'default' }}>{page}</button>
              <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage((p) => p + 1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderLeft: 'none', background: 'white', cursor: page >= totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', borderRadius: '0 6px 6px 0', color: page >= totalPages || totalPages === 0 ? '#94a3b8' : '#0369a1', fontSize: '13px', transition: 'all 0.2s' }}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EbBills;
