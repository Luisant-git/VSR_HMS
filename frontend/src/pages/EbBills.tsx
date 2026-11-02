import { useState, useEffect } from 'react';
import { Calculator, History, X, FileSpreadsheet, Pencil, Trash2, AlertTriangle, RotateCcw, Zap, Wind } from 'lucide-react';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingSpinner';
import { RoomAPI } from '../api/room.api';
import { EbBillsAPI } from '../api/eb-bill.api';
import { toast } from 'react-toastify';

const currentMonthStr = new Date().toISOString().slice(0, 7);

const sanitizeNumber = (v: string) => {
  let s = (v || '').replace(/[^\d.]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
  return s;
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px',
};

// Plain text number input that shows grey placeholder when value is '0'
const NumInput = ({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input
      type="text"
      inputMode="decimal"
      value={value === '0' ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(sanitizeNumber(e.target.value) || '0')}
      style={{ ...inputStyle, color: value === '0' ? '#94a3b8' : '#1e293b' }}
    />
  </div>
);

const EbBills = () => {
  // Normal meter
  const [prevReading, setPrevReading] = useState('0');
  const [currReading, setCurrReading] = useState('0');
  const [tariff, setTariff] = useState('8.5');

  // AC meter
  const [hasAcMeter, setHasAcMeter] = useState(false);
  const [acPrevReading, setAcPrevReading] = useState('0');
  const [acCurrReading, setAcCurrReading] = useState('0');
  const [acTariff, setAcTariff] = useState('12');

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 10;

  useEffect(() => { fetchRooms(); }, []);
  useEffect(() => { fetchBillingHistory(); }, [page, searchTerm, fromDate, toDate]);
  useEffect(() => { fetchRoomBills(); }, [selectedRoom]);

  const fetchRooms = async () => {
    try { setRooms(await RoomAPI.findAll()); }
    catch { setError('Failed to load rooms'); }
  };

  const fetchRoomBills = async () => {
    if (!selectedRoom) { setRoomBills([]); return; }
    try {
      const bills = await EbBillsAPI.findByRoom(selectedRoom.value.id);
      setRoomBills(Array.isArray(bills) ? bills : []);
    } catch { setRoomBills([]); }
  };

  const fetchBillingHistory = async () => {
    try {
      setIsLoading(true); setError(null);
      const res = await EbBillsAPI.findAll({ page, limit, search: searchTerm, fromDate, toDate });
      const data = Array.isArray(res) ? res : (res.data || []);
      setBillingHistory(data);
      setTotalPages(res.totalPages || 1);
      setTotalRecords(res.total || data.length);
    } catch { setError('Failed to load EB bills history'); }
    finally { setIsLoading(false); }
  };

  // Live preview calculations
  const activeStudentsInRoom = selectedRoom?.value?.students?.filter((s: any) => s.status !== 'Vacated') || [];
  const studentCount = activeStudentsInRoom.length;

  const prev = parseFloat(prevReading) || 0;
  const curr = parseFloat(currReading) || 0;
  const rate = parseFloat(tariff) || 0;
  const normalUnits = curr >= prev ? curr - prev : 0;
  const normalCost = normalUnits * rate;

  const acPrev = parseFloat(acPrevReading) || 0;
  const acCurr = parseFloat(acCurrReading) || 0;
  const acRate = parseFloat(acTariff) || 0;
  const acUnits = hasAcMeter && acCurr >= acPrev ? acCurr - acPrev : 0;
  const acCost = hasAcMeter ? acUnits * acRate : 0;

  const totalUnits = normalUnits + acUnits;
  const totalCost = normalCost + acCost;
  const splitPerStudent = studentCount > 0 ? totalCost / studentCount : 0;

  const existingBill = roomBills.find((b) => b.billingCycle === billingCycle) || null;
  const isDuplicate = mode === 'create' && !!existingBill;

  const roomOptions = rooms.map(room => {
    const activeCount = room.students?.filter((s: any) => s.status !== 'Vacated').length || 0;
    return { value: room, label: `Room ${room.id} (${activeCount} hosteller${activeCount === 1 ? '' : 's'})` };
  });

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base, padding: '4px', borderRadius: '8px',
      borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1',
      boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
      '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#94a3b8' }, fontSize: '13px',
    }),
    option: (base: any, state: any) => ({
      ...base, fontSize: '13px',
      backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
      color: state.isSelected ? 'white' : '#334155', cursor: 'pointer',
    }),
  };

  const resetForm = () => {
    setPrevReading('0'); setCurrReading('0'); setTariff('8.5');
    setHasAcMeter(false); setAcPrevReading('0'); setAcCurrReading('0'); setAcTariff('12');
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
    const acPresent = bill.acPrevReading != null;
    setHasAcMeter(acPresent);
    setAcPrevReading(acPresent ? String(bill.acPrevReading) : '0');
    setAcCurrReading(acPresent ? String(bill.acCurrReading) : '0');
    setAcTariff(acPresent ? String(bill.acTariffRate) : '12');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setMode('create');
    setEditingId(null);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!selectedRoom) { toast.error('Please select a room'); return; }
    if (curr < prev) { toast.error('Normal meter: current reading cannot be less than previous reading'); return; }
    if (hasAcMeter && acCurr < acPrev) { toast.error('AC meter: current reading cannot be less than previous reading'); return; }
    if (mode === 'create' && existingBill) { toast.error(`Already entered for Room ${selectedRoom.value.id} in ${billingCycle}. Use Edit.`); return; }
    if (studentCount === 0) toast.warning('No active students in this room to split the bill');

    try {
      setIsSubmitting(true);
      const payload: any = {
        roomNo: selectedRoom.value.id,
        billingCycle,
        prevReading: prev,
        currReading: curr,
        tariffRate: rate,
      };
      if (hasAcMeter) {
        payload.acPrevReading = acPrev;
        payload.acCurrReading = acCurr;
        payload.acTariffRate = acRate;
      } else if (mode === 'edit') {
        payload.hasAcMeter = false; // explicitly remove AC data on edit
      }

      if (mode === 'edit' && editingId) {
        await EbBillsAPI.update(editingId, payload);
        toast.success('EB bill updated successfully');
      } else {
        await EbBillsAPI.create(payload);
        toast.success('EB bill created and split among students');
        setPrevReading(currReading);
        setCurrReading('0');
        if (hasAcMeter) { setAcPrevReading(acCurrReading); setAcCurrReading('0'); }
      }

      await fetchRoomBills();
      fetchBillingHistory();
      if (mode === 'edit') cancelEdit();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save EB bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (bill: any) => {
    if (!window.confirm(`Delete EB bill for Room ${bill.roomNo} (${bill.billingCycle})?\nThis removes pending student charges.`)) return;
    EbBillsAPI.remove(bill.id)
      .then(() => {
        toast.success('EB bill deleted');
        fetchBillingHistory();
        if (selectedRoom?.value.id === bill.roomNo) fetchRoomBills();
      })
      .catch((e: any) => toast.error(e.message || 'Failed to delete'));
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await EbBillsAPI.findAll({ limit: 100000 });
      const all = Array.isArray(res) ? res : (res.data || []);
      if (!all.length) { toast.info('No EB bills to export'); return; }

      const byCycle: Record<string, any[]> = {};
      all.forEach((b: any) => { (byCycle[b.billingCycle] ||= []).push(b); });
      const cycles = Object.keys(byCycle).sort();

      const wb = XLSX.utils.book_new();

      const summary = cycles.map((c) => {
        const rows = byCycle[c];
        return {
          Month: c,
          Rooms: rows.length,
          'Normal Units': +rows.reduce((s, r) => s + (r.unitsConsumed || 0), 0).toFixed(1),
          'AC Units': +rows.reduce((s, r) => s + (r.acUnitsConsumed || 0), 0).toFixed(1),
          'Total Bill (₹)': +rows.reduce((s, r) => s + (r.totalAmount || 0), 0).toFixed(2),
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');

      cycles.forEach((c) => {
        const rows = byCycle[c].slice().sort((a, b) =>
          String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true }));
        const data = rows.map((r) => {
          const row: any = {
            Room: r.roomNo,
            Cycle: r.billingCycle,
            'Normal Prev': r.prevReading,
            'Normal Curr': r.currReading,
            'Normal Units': +(r.unitsConsumed || 0).toFixed(1),
            'Normal Tariff (₹)': r.tariffRate,
          };
          if (r.acPrevReading != null) {
            row['AC Prev'] = r.acPrevReading;
            row['AC Curr'] = r.acCurrReading;
            row['AC Units'] = +(r.acUnitsConsumed || 0).toFixed(1);
            row['AC Tariff (₹)'] = r.acTariffRate;
            row['AC Bill (₹)'] = +(r.acTotalAmount || 0).toFixed(2);
          }
          row['Total Bill (₹)'] = +(r.totalAmount || 0).toFixed(2);
          row['Per Head Share (₹)'] = +(r.perStudentShare || 0).toFixed(2);
          return row;
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), c);
      });

      XLSX.writeFile(wb, `EB_Bills_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Excel exported successfully');
    } catch { toast.error('Failed to export Excel'); }
    finally { setIsExporting(false); }
  };

  // Separator used inside the meter section cards
  const MeterSection = ({
    icon, title, accent, children,
  }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) => (
    <div style={{ borderRadius: '8px', border: `1px solid ${accent}22`, background: `${accent}08`, padding: '12px 14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        {icon}
        <span style={{ fontSize: '12px', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  );

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Rooms EB Bill Sharing Calculator"
        subtitle="Sub-meter electricity calculation and automatic equal cost distribution across room hostellers"
        icon={<Calculator size={24} color="#fff" />} iconBg="linear-gradient(135deg, #eab308 0%, #ca8a04 100%)"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(min(100%, 300px), 420px) 1fr', gap: '25px', alignItems: 'start' }}>

        {/* ── Left: Form ── */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {mode === 'edit' ? <Pencil size={18} color="var(--sidebar-active)" /> : <Calculator size={18} color="var(--sidebar-active)" />}
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>
              {mode === 'edit' ? 'Edit Room EB Bill' : 'Calculate Room EB Bill'}
            </h3>
            {mode === 'edit' && (
              <button onClick={cancelEdit} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>
                <RotateCcw size={14} /> Cancel Edit
              </button>
            )}
          </div>

          <div style={{ padding: '14px 16px' }}>
            {/* Room & Cycle */}
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Select Room</label>
              <Select options={roomOptions} value={selectedRoom} onChange={setSelectedRoom}
                placeholder="-- Choose Occupied Room --" styles={selectStyles}
                isSearchable isClearable isDisabled={mode === 'edit'} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Billing Month / Cycle</label>
              <input type="month" value={billingCycle} max={currentMonthStr}
                onChange={e => setBillingCycle(e.target.value)} style={inputStyle} />
            </div>

            {/* Duplicate warning */}
            {isDuplicate && (
              <div style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fcd34d', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, fontSize: '13px', color: '#92400e' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Already entered for Room {selectedRoom?.value?.id} in {billingCycle}</div>
                  <div>A bill already exists for this room and month. Edit it instead.</div>
                  <button onClick={() => existingBill && loadForEdit(existingBill)}
                    style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #d97706', borderRadius: '6px', background: 'white', fontSize: '12px', fontWeight: 600, color: '#d97706', cursor: 'pointer' }}>
                    <Pencil size={13} /> Edit existing bill
                  </button>
                </div>
              </div>
            )}

            {/* Normal meter */}
            <MeterSection icon={<Zap size={14} color="#f59e0b" />} title="Normal Meter" accent="#f59e0b">
              <NumInput label="Previous Reading (Units)" value={prevReading} onChange={setPrevReading} />
              <NumInput label="Current Reading (Units)" value={currReading} onChange={setCurrReading} />
              <div>
                <label style={labelStyle}>Tariff Rate (₹ per Unit)</label>
                <input type="text" inputMode="decimal" value={tariff}
                  onChange={e => setTariff(sanitizeNumber(e.target.value))} style={inputStyle} />
              </div>
            </MeterSection>

            {/* AC meter toggle */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${hasAcMeter ? '#0ea5e9' : '#e2e8f0'}`, background: hasAcMeter ? '#f0f9ff' : '#fafafa' }}>
                <div
                  onClick={() => setHasAcMeter(v => !v)}
                  style={{ width: '36px', height: '20px', borderRadius: '10px', background: hasAcMeter ? '#0ea5e9' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0, cursor: 'pointer' }}
                >
                  <div style={{ position: 'absolute', top: '3px', left: hasAcMeter ? '19px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: hasAcMeter ? '#0369a1' : '#475569' }}>
                    <Wind size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                    This room has a separate AC meter
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                    {hasAcMeter ? 'AC meter fields shown below' : 'Toggle on to add AC readings'}
                  </div>
                </div>
              </label>
            </div>

            {/* AC meter fields */}
            {hasAcMeter && (
              <MeterSection icon={<Wind size={14} color="#0ea5e9" />} title="AC Meter" accent="#0ea5e9">
                <NumInput label="AC Previous Reading (Units)" value={acPrevReading} onChange={setAcPrevReading} />
                <NumInput label="AC Current Reading (Units)" value={acCurrReading} onChange={setAcCurrReading} />
                <div>
                  <label style={labelStyle}>AC Tariff Rate (₹ per Unit)</label>
                  <input type="text" inputMode="decimal" value={acTariff}
                    onChange={e => setAcTariff(sanitizeNumber(e.target.value))} style={inputStyle} />
                </div>
              </MeterSection>
            )}

            {/* Live preview */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Live Preview</h4>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}><Zap size={12} color="#f59e0b" /> Normal units:</span>
                <span style={{ fontWeight: 600 }}>{normalUnits.toFixed(1)} × ₹{rate} = <span style={{ color: '#d93025' }}>₹{normalCost.toFixed(2)}</span></span>
              </div>

              {hasAcMeter && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}><Wind size={12} color="#0ea5e9" /> AC units:</span>
                  <span style={{ fontWeight: 600 }}>{acUnits.toFixed(1)} × ₹{acRate} = <span style={{ color: '#d93025' }}>₹{acCost.toFixed(2)}</span></span>
                </div>
              )}

              {hasAcMeter && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#64748b' }}>
                  <span>Combined units:</span>
                  <span style={{ fontWeight: 600 }}>{totalUnits.toFixed(1)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #e2e8f0', marginTop: '4px', fontSize: '13px' }}>
                <span style={{ color: '#475569' }}>Total Room EB Cost:</span>
                <span style={{ fontWeight: 700, color: '#d93025' }}>₹{totalCost.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #e2e8f0', marginTop: '6px', fontSize: '14px' }}>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>Split Per Student ({studentCount}):</span>
                <span style={{ fontWeight: 700, color: 'var(--sidebar-active)' }}>₹{splitPerStudent.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={isSubmitting || isDuplicate}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: isSubmitting || isDuplicate ? '#94a3b8' : 'var(--sidebar-active)', border: 'none', color: 'white', cursor: isSubmitting || isDuplicate ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: isSubmitting || isDuplicate ? 'none' : '0 4px 10px rgba(74,114,250,0.3)' }}>
              {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Bill' : isDuplicate ? 'Already Entered — Use Edit' : 'Generate Student Invoices'}
            </button>
          </div>
        </div>

        {/* ── Right: History ── */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={18} color="var(--sidebar-active)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>Room EB Billing History</h3>
              </div>
              <button onClick={handleExportExcel} disabled={isExporting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--sidebar-active)', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.7 : 1 }}>
                <FileSpreadsheet size={15} /> {isExporting ? 'Exporting...' : 'Export Excel (Month-wise)'}
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                <input type="text" placeholder="Search Room..." value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '8px 30px 8px 15px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                {searchTerm && (
                  <button onClick={() => { setSearchTerm(''); setPage(1); }}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 0 }}>
                    <X size={16} />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 150px', minWidth: '140px' }}>
                <label style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>From:</label>
                <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155', minWidth: '0' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 150px', minWidth: '140px' }}>
                <label style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>To:</label>
                <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155', minWidth: '0' }} />
              </div>
              {(fromDate || toDate) && (
                <button onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}
                  style={{ padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: '6px', fontSize: '13px', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
              <table className="data-table" style={{ width: '100%', minWidth: '820px', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '12px', letterSpacing: '0.02em' }}>
                    <th style={{ padding: '10px 14px' }}>Room</th>
                    <th style={{ padding: '10px 14px' }}>Cycle</th>
                    <th style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={11} color="#f59e0b" /> Normal readings</span>
                    </th>
                    <th style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Wind size={11} color="#0ea5e9" /> AC readings</span>
                    </th>
                    <th style={{ padding: '10px 14px' }}>Units</th>
                    <th style={{ padding: '10px 14px' }}>Total bill</th>
                    <th style={{ padding: '10px 14px' }}>Per head share</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((bill) => (
                    <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{bill.roomNo}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{bill.billingCycle}</span>
                      </td>
                      {/* Normal meter readings */}
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                        {Number(bill.prevReading).toFixed(1)} → {Number(bill.currReading).toFixed(1)}
                        <span style={{ marginLeft: '4px', color: '#94a3b8' }}>({Number(bill.unitsConsumed).toFixed(1)} u)</span>
                      </td>
                      {/* AC meter readings */}
                      <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                        {bill.acPrevReading != null ? (
                          <span style={{ color: '#0369a1' }}>
                            {Number(bill.acPrevReading).toFixed(1)} → {Number(bill.acCurrReading).toFixed(1)}
                            <span style={{ marginLeft: '4px', color: '#94a3b8' }}>({Number(bill.acUnitsConsumed).toFixed(1)} u)</span>
                          </span>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>
                      {/* Combined units */}
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        {(Number(bill.unitsConsumed) + Number(bill.acUnitsConsumed || 0)).toFixed(1)}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#ef4444' }}>₹{Number(bill.totalAmount).toFixed(2)}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--sidebar-active)' }}>₹{Number(bill.perStudentShare).toFixed(2)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button onClick={() => loadForEdit(bill)} title="Edit"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer', color: '#2563eb' }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(bill)} title="Delete"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', border: '1px solid #fecaca', borderRadius: '6px', background: 'white', cursor: 'pointer', color: '#dc2626' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {billingHistory.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No billing history found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '13px', color: '#64748b', background: '#f8fafc' }}>
            <div>Showing <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords === 0 ? 0 : (page - 1) * limit + 1}</span> to <span style={{ fontWeight: 600, color: '#1e293b' }}>{Math.min(page * limit, totalRecords)}</span> of <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords}</span> entries</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderRight: 'none', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '6px 0 0 6px', color: page === 1 ? '#94a3b8' : '#64748b', fontSize: '13px' }}>
                Previous
              </button>
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', minWidth: '32px', padding: '0 12px', border: '1px solid #3b82f6', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: 500, cursor: 'default' }}>
                {page}
              </button>
              <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderLeft: 'none', background: 'white', cursor: page >= totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', borderRadius: '0 6px 6px 0', color: page >= totalPages || totalPages === 0 ? '#94a3b8' : '#0369a1', fontSize: '13px' }}>
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
