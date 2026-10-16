import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import {
  ChefHat, Plus, Trash2, Search, Edit, X, Download,
  Package, AlertTriangle, RefreshCw, Eye
} from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { KitchenAPI } from '../api/kitchen.api';
import { Pagination } from '../components/Pagination';
import { SearchableSelect, type SelectOption } from '../components/SearchableSelect';
import { formatDateDMY } from '../utils/date';
import * as XLSX from 'xlsx';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Evening Snacks', 'Dinner'];

// Exact copy of Hostellers react-select styles
const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    padding: '2px',
    borderRadius: '8px',
    borderColor: state.isFocused ? 'var(--sidebar-active)' : 'var(--border-color)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1' },
    fontSize: '13px',
    cursor: 'pointer',
    width: '200px',
    background: 'white'
  }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: '13px',
    backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
    color: state.isSelected ? 'white' : '#334155',
    cursor: 'pointer'
  }),
  menu: (base: any) => ({ ...base, zIndex: 50 }),
};

interface Product {
  id: string;
  name: string;
  availableStock: number;
  unit?: { name: string; symbol?: string };
  category?: { name: string };
}

interface Consumption {
  id: string;
  dateStr: string;
  mealType: string;
  productId: string;
  product: Product;
  availableStock: number;
  quantityTaken: number;
  unit: string;
  wastage: number;
  netConsumed: number;
  remarks?: string;
  createdAt: string;
}

// ---------- View-modal building blocks (module scope so they don't remount) ----------

export default function KitchenConstruction() {
  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [loading, setLoading] = useState(false);

  // Form (multi-row: one meal + date can have many product items)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  interface FormRow {
    key: number;
    productId: string;
    quantityTaken: string;
    wastage: string;
    remarks: string;
  }
  const emptyRow = (key: number): FormRow => ({ key, productId: '', quantityTaken: '', wastage: '', remarks: '' });

  const [formHeader, setFormHeader] = useState({
    dateStr: new Date().toISOString().split('T')[0],
    mealType: '',
  });
  const [formRows, setFormRows] = useState<FormRow[]>([emptyRow(Date.now())]);

  const rowProduct = (row: FormRow) => products.find(p => p.id === row.productId);
  const rowUnit = (row: FormRow) => rowProduct(row)?.unit?.symbol || rowProduct(row)?.unit?.name || 'Kg';
  const rowStock = (row: FormRow) => rowProduct(row)?.availableStock ?? 0;
  const rowNet = (row: FormRow) => Math.max(0, (parseFloat(row.quantityTaken) || 0) - (parseFloat(row.wastage) || 0));

  // Filters (Hostellers style: '-- All --' sentinels)
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterMeal, setFilterMeal] = useState('-- All Meals --');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // View modal state — neat popup for a single consumption entry
  const [viewRecord, setViewRecord] = useState<Consumption | null>(null);
  const openViewModal = (c: Consumption) => setViewRecord(c);
  const closeViewModal = () => setViewRecord(null);

  const mealOptions = ['-- All Meals --', ...MEAL_TYPES].map(m => ({ value: m, label: m }));
  // Searchable product options (for the entry form rows)
  const productOptions: SelectOption[] = products.map(p => ({
    value: p.id,
    label: `${p.name}${p.category ? ` (${p.category.name})` : ''}`,
    sublabel: `Stock: ${p.availableStock}`,
  }));

  useEffect(() => {
    loadProducts();
    loadConsumptions();
  }, []);

  useEffect(() => {
    loadConsumptions();
    setCurrentPage(1);
  }, [filterFromDate, filterToDate, filterMeal]);

  // Close the view popup with ESC
  useEffect(() => {
    if (!viewRecord) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeViewModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewRecord]);

  const loadProducts = async () => {
    try {
      const data = await KitchenAPI.getProducts();
      setProducts(data);
    } catch (err: any) {
      console.error(err.message || 'Failed to load products');
    }
  };

  const loadConsumptions = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (filterFromDate && filterToDate && filterFromDate === filterToDate) filters.dateStr = filterFromDate;
      else {
        if (filterFromDate) filters.fromDate = filterFromDate;
        if (filterToDate) filters.toDate = filterToDate;
      }
      if (filterMeal && filterMeal !== '-- All Meals --') filters.mealType = filterMeal;
      const data = await KitchenAPI.getConsumptions(filters);
      setConsumptions(data);
    } catch (err: any) {
      console.error(err.message || 'Failed to load consumption entries');
    } finally {
      setLoading(false);
    }
  };

  // Edit-group tracking: when editing, ALL entries of that date+meal load into the form
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  // ids of existing entries currently loaded in the form (for update vs create decision)
  const [rowEntryIds, setRowEntryIds] = useState<Record<number, string>>({});
  // ids removed from the group during edit → delete on save
  const [removedEntryIds, setRemovedEntryIds] = useState<string[]>([]);

  const updateRow = (key: number, patch: Partial<FormRow>) =>
    setFormRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => setFormRows(prev => [...prev, emptyRow(Date.now() + Math.random())]);

  const removeRow = (key: number) => {
    const linkedId = rowEntryIds[key];
    if (linkedId) {
      setRemovedEntryIds(prev => [...prev, linkedId]);
      setRowEntryIds(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setFormRows(prev => {
      if (prev.length <= 1 && !editingGroupKey) return prev; // keep 1 row in create mode
      if (prev.length <= 1 && editingGroupKey) return [emptyRow(Date.now())]; // allow clearing group
      return prev.filter(r => r.key !== key);
    });
  };

  const resetForm = () => {
    setFormHeader({
      dateStr: filterFromDate || new Date().toISOString().split('T')[0],
      mealType: '',
    });
    setFormRows([emptyRow(Date.now())]);
    setEditingId(null);
    setEditingGroupKey(null);
    setRowEntryIds({});
    setRemovedEntryIds([]);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formHeader.mealType) return toast.error('Please select Meal Type');

    // ---- EDIT-GROUP MODE: update existing, create new rows, delete removed ----
    if (editingGroupKey) {
      const valid = formRows.filter(r => r.productId && (parseFloat(r.quantityTaken) || 0) > 0);
      // stock check for rows that grow qty (best-effort: check against current stock + own taken)
      try {
        for (const [idx, r] of valid.entries()) {
          const gross = parseFloat(r.quantityTaken) || 0;
          const waste = parseFloat(r.wastage) || 0;
          if (rowEntryIds[r.key]) {
            await KitchenAPI.updateConsumption(rowEntryIds[r.key], {
              mealType: formHeader.mealType,
              productId: r.productId,
              dateStr: formHeader.dateStr,
              quantityTaken: gross,
              wastage: waste,
              remarks: r.remarks || undefined,
            });
          } else {
            await KitchenAPI.createConsumption({
              dateStr: formHeader.dateStr,
              mealType: formHeader.mealType,
              productId: r.productId,
              quantityTaken: gross,
              wastage: waste,
              remarks: r.remarks || undefined,
            });
          }
          void idx;
        }
        for (const id of removedEntryIds) {
          await KitchenAPI.deleteConsumption(id);
        }
        toast.success('Meal entries updated');
        resetForm();
        loadConsumptions();
        loadProducts();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save');
      }
      return;
    }

    // ---- Single legacy edit (kept for safety, normally unused now) ----
    if (editingId) {
      const r = formRows[0];
      const gross = parseFloat(r.quantityTaken) || 0;
      const waste = parseFloat(r.wastage) || 0;
      if (!r.productId) return toast.error('Please select Raw Material Item');
      if (gross <= 0) return toast.error('Please enter Quantity Taken');
      try {
        await KitchenAPI.updateConsumption(editingId, {
          mealType: formHeader.mealType,
          productId: r.productId,
          dateStr: formHeader.dateStr,
          quantityTaken: gross,
          wastage: waste,
          remarks: r.remarks || undefined,
        });
        toast.success('Consumption entry updated');
        resetForm();
        loadConsumptions();
        loadProducts();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save');
      }
      return;
    }
    // Create mode = save ALL rows for this date + meal
    const valid = formRows.filter(r => r.productId && (parseFloat(r.quantityTaken) || 0) > 0);
    if (valid.length === 0) return toast.error('Add at least one item with product + quantity');
    // stock check per row
    for (const r of valid) {
      const stock = rowStock(r);
      if ((parseFloat(r.quantityTaken) || 0) > stock)
        return toast.error(`Insufficient stock for ${rowProduct(r)?.name}! Available: ${stock} ${rowUnit(r)}`);
    }
    try {
      for (const r of valid) {
        await KitchenAPI.createConsumption({
          dateStr: formHeader.dateStr,
          mealType: formHeader.mealType,
          productId: r.productId,
          quantityTaken: parseFloat(r.quantityTaken) || 0,
          wastage: parseFloat(r.wastage) || 0,
          remarks: r.remarks || undefined,
        });
      }
      toast.success(`${valid.length} item(s) added for ${formHeader.mealType}`);
      resetForm();
      loadConsumptions();
      loadProducts(); // Refresh stock
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const groupKey = (c: Consumption) => `${c.dateStr}__${c.mealType}`;

  // Edit = load the WHOLE date+meal group into the form (all items)
  const handleEditGroup = (c: Consumption) => {
    const key = groupKey(c);
    const group = consumptions.filter(x => groupKey(x) === key);
    const rows: FormRow[] = group.map((g, i) => ({
      key: Date.now() + i,
      productId: g.productId,
      quantityTaken: String(g.quantityTaken),
      wastage: String(g.wastage),
      remarks: g.remarks || '',
    }));
    const ids: Record<number, string> = {};
    rows.forEach((r, i) => { ids[r.key] = group[i].id; });
    setFormHeader({ dateStr: c.dateStr, mealType: c.mealType });
    setFormRows(rows.length ? rows : [emptyRow(Date.now())]);
    setRowEntryIds(ids);
    setRemovedEntryIds([]);
    setEditingGroupKey(key);
    setEditingId(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (c: Consumption) => handleEditGroup(c);

  const handleDelete = async (c: Consumption) => {
    const result = await Swal.fire({
      title: 'Delete Entry?',
      html: `<b>${c.product?.name}</b> — ${c.mealType} on ${formatDateDMY(c.dateStr)}<br/>Qty: ${c.quantityTaken} ${c.unit} will be restored to stock.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete',
    });
    if (!result.isConfirmed) return;

    try {
      await KitchenAPI.deleteConsumption(c.id);
      toast.success('Entry deleted, stock restored');
      loadConsumptions();
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleExport = () => {
    const exportData = filteredConsumptions.map((c, i) => ({
      '#': i + 1,
      'Date': formatDateDMY(c.dateStr),
      'Meal Type': c.mealType,
      'Raw Material': c.product?.name || '',
      'Stock (Available)': c.availableStock,
      'Quantity Taken': c.quantityTaken,
      'Unit': c.unit,
      'Wastage': c.wastage,
      'Net Consumed': c.netConsumed,
      'Remarks': c.remarks || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kitchen Consumption');
    XLSX.writeFile(wb, `kitchen_consumption_${filterFromDate || 'all'}.xlsx`);
  };

  // Search + filter
  const filteredConsumptions = consumptions.filter(c => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        c.product?.name?.toLowerCase().includes(q) ||
        c.mealType.toLowerCase().includes(q) ||
        c.remarks?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredConsumptions.length / pageSize);
  const paginatedData = filteredConsumptions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Low stock items
  const lowStockProducts = products.filter(p => p.availableStock <= 5 && p.availableStock > 0);
  const outOfStockProducts = products.filter(p => p.availableStock <= 0);

  // Styles
  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
    border: '1px solid #f0f2f5',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    color: '#1e293b',
    transition: 'all 0.2s',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'auto' as any,
  };

  const readOnlyStyle: React.CSSProperties = {
    ...inputStyle,
    background: '#f8fafc',
    color: '#64748b',
    cursor: 'not-allowed',
    fontWeight: 600,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 700,
    color: '#475569',
    marginBottom: '6px',
    display: 'block',
    whiteSpace: 'nowrap',
  };

  const fieldWrap: React.CSSProperties = {
    flex: '1 0 130px',
    minWidth: '130px',
  };

  const fieldWrapWide: React.CSSProperties = {
    flex: '1.6 0 200px',
    minWidth: '200px',
  };

  const suffixStyle: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 600,
  };

  const btnPrimary: React.CSSProperties = {
    background: 'linear-gradient(135deg, #4a72fa 0%, #3b5bdb 100%)',
    color: '#fff',
    padding: '10px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(74, 114, 250, 0.3)',
    transition: 'all 0.2s',
  };

  const btnSecondary: React.CSSProperties = {
    background: '#fff',
    color: '#475569',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  };

  const mealBadgeColors: Record<string, { bg: string; color: string }> = {
    'Breakfast': { bg: '#fef3c7', color: '#92400e' },
    'Lunch': { bg: '#dbeafe', color: '#1e40af' },
    'Evening Snacks': { bg: '#fce7f3', color: '#9d174d' },
    'Dinner': { bg: '#d1fae5', color: '#065f46' },
  };

  // Detail rows for the view popup — same layout as CanteenMaster "Product Details"
  const viewRows: { label: string; value: React.ReactNode; color?: string; bold?: boolean; align?: 'center' | 'flex-start' }[] = viewRecord ? [
    { label: 'Raw Material', value: viewRecord.product?.name || '-' },
    { label: 'Stock (Available)', value: `${viewRecord.availableStock} ${viewRecord.unit}`, color: '#0369A1', bold: true },
    { label: 'Quantity Taken', value: `${viewRecord.quantityTaken} ${viewRecord.unit}` },
    { label: 'Wastage', value: `${viewRecord.wastage} ${viewRecord.unit}`, color: viewRecord.wastage > 0 ? '#EF4444' : undefined },
    { label: 'Net Consumed', value: `${viewRecord.netConsumed} ${viewRecord.unit}`, color: '#16a34a', bold: true },
    ...(viewRecord.remarks ? [{ label: 'Remarks', value: viewRecord.remarks, align: 'flex-start' as const }] : []),
  ] : [];

  return (
    <div>
      {/* Page Header */}
      <div style={{ ...cardStyle, marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
          }}>
            <ChefHat size={24} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>Kitchen Construction</h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Canteen Kitchen Inventory — Daily Raw Material Consumption</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleExport} style={{ ...btnSecondary, background: '#10b981', color: '#fff', border: 'none', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}>
            <Download size={16} /> Export
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
            <Plus size={16} /> Add Consumption
          </button>
        </div>
      </div>

      {/* Stock Alert Cards */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {outOfStockProducts.length > 0 && (
            <div style={{ ...cardStyle, borderLeft: '4px solid #ef4444', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '13px' }}>OUT OF STOCK ({outOfStockProducts.length})</span>
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {outOfStockProducts.slice(0, 5).map(p => p.name).join(', ')}
                {outOfStockProducts.length > 5 && ` +${outOfStockProducts.length - 5} more`}
              </div>
            </div>
          )}
          {lowStockProducts.length > 0 && (
            <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Package size={18} color="#f59e0b" />
                <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '13px' }}>LOW STOCK ({lowStockProducts.length})</span>
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.availableStock})`).join(', ')}
                {lowStockProducts.length > 5 && ` +${lowStockProducts.length - 5} more`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Consumption Entry Form (Expandable) */}
      {showForm && (
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
              {editingGroupKey ? `Edit ${formHeader.mealType} — ${formatDateDMY(formHeader.dateStr)} (${formRows.length} item(s))` : editingId ? 'Edit Consumption Entry' : 'New Consumption Entry'}
            </h3>
            <button onClick={resetForm} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b' }}>
              <X size={18} />
            </button>
          </div>

          {/* Shared Date + Meal for all rows */}
          <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ ...fieldWrap, maxWidth: '200px' }}>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                style={inputStyle}
                value={formHeader.dateStr}
                onChange={e => setFormHeader({ ...formHeader, dateStr: e.target.value })}
              />
            </div>
            <div style={{ ...fieldWrap, maxWidth: '240px' }}>
              <label style={labelStyle}>Meal Type <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                style={selectStyle}
                value={formHeader.mealType}
                onChange={e => setFormHeader({ ...formHeader, mealType: e.target.value })}
              >
                <option value="">— Select Meal —</option>
                {MEAL_TYPES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Item rows — one row per raw material */}
          {formRows.map((row, idx) => (
          <div key={row.key} style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '14px', overflowX: 'auto', padding: '12px', marginBottom: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #eef2f7' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', paddingTop: '32px', minWidth: '24px' }}>#{idx + 1}</span>
            {/* Raw Material Item */}
            <div style={{ ...fieldWrap, flex: '1.6 0 220px', minWidth: '220px' }}>
              <label style={labelStyle}>Raw Material Item <span style={{ color: '#ef4444' }}>*</span></label>
              <SearchableSelect
                options={productOptions}
                value={row.productId}
                onChange={val => updateRow(row.key, { productId: val })}
                placeholder="Search item..."
              />
            </div>

            {/* Available Stock (Read-only) */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Available Stock</label>
              <input
                type="text"
                style={{
                  ...readOnlyStyle,
                  color: rowStock(row) <= 0 ? '#ef4444' : rowStock(row) <= 5 ? '#f59e0b' : '#059669',
                }}
                value={rowProduct(row) ? `${rowStock(row)} ${rowUnit(row)}` : '—'}
                readOnly
              />
            </div>

            {/* Quantity Taken (Gross) */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Qty Taken (Gross) <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  style={{ ...inputStyle, paddingRight: '45px' }}
                  placeholder="0"
                  value={row.quantityTaken}
                  onChange={e => updateRow(row.key, { quantityTaken: e.target.value })}
                />
                <span style={suffixStyle}>{rowUnit(row)}</span>
              </div>
              
            </div>

            {/* Wastage */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Wastage</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  style={{ ...inputStyle, paddingRight: '45px' }}
                  placeholder="0"
                  value={row.wastage}
                  onChange={e => updateRow(row.key, { wastage: e.target.value })}
                />
                <span style={suffixStyle}>{rowUnit(row)}</span>
              </div>
              
            </div>

            {/* Net Consumed (Auto-calculated) */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Net Consumed</label>
              <input
                type="text"
                style={{
                  ...readOnlyStyle,
                  color: rowNet(row) > 0 ? '#059669' : '#64748b',
                  fontSize: '15px',
                }}
                value={(parseFloat(row.quantityTaken) || 0) > 0 ? `${rowNet(row)} ${rowUnit(row)}` : '—'}
                readOnly
              />
             
            </div>

            {/* Remarks — description box (multi-line), original width */}
            <div style={fieldWrapWide}>
              <label style={labelStyle}>
                Remarks <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span>
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: '68px', height: 'auto', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                placeholder="Add any notes…"
                value={row.remarks}
                onChange={e => updateRow(row.key, { remarks: e.target.value })}
              />
            </div>

            {(!editingId || editingGroupKey) && (
              <button
                onClick={() => removeRow(row.key)}
                disabled={formRows.length <= 1 && !editingGroupKey}
                title="Remove row"
                style={{ marginTop: '26px', background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          ))}

          {/* Add Row + Submit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            {(!editingId || editingGroupKey) ? (
              <button onClick={addRow} style={{ ...btnSecondary, borderStyle: 'dashed' }}>
                <Plus size={16} /> Add Row
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={resetForm} style={btnSecondary}>Cancel</button>
              <button onClick={handleSubmit} style={btnPrimary}>
                {editingGroupKey ? `Update ${formRows.length} Item(s)` : editingId ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters + Table — EXACT Hostellers filter-bar copy */}
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', padding: '15px 20px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Show</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={99999}>All</option>
            </select>
            <span style={{ fontSize: '13px', color: '#64748b' }}>entries</span>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 5px' }}></div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                outline: 'none',
                width: '280px'
              }}
            />
          </div>

          <Select
            options={mealOptions}
            value={mealOptions.find(o => o.value === filterMeal)}
            onChange={(opt) => { setFilterMeal(opt?.value || '-- All Meals --'); setCurrentPage(1); }}
            styles={selectStyles}
            placeholder="Search meal..."
            isSearchable={true}
          />

          <input
            type="date"
            value={filterFromDate}
            onChange={e => setFilterFromDate(e.target.value)}
            title="From Date"
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '13px', color: '#64748b' }}>to</span>
          <input
            type="date"
            value={filterToDate}
            onChange={e => setFilterToDate(e.target.value)}
            title="To Date"
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
          />

          {(searchTerm !== '' || filterMeal !== '-- All Meals --' || filterFromDate !== '' || filterToDate !== '') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterMeal('-- All Meals --');
                setFilterFromDate('');
                setFilterToDate('');
                setCurrentPage(1);
              }}
              title="Clear all filters"
              style={{
                background: '#f1f5f9',
                color: '#64748b',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
            >
              <X size={14} strokeWidth={3} /> Clear All
            </button>
          )}
          <div style={{ flex: 1 }}></div>

          <button onClick={() => { loadConsumptions(); loadProducts(); }} style={{ padding: '8px 14px', borderRadius: '8px', background: 'white', border: '1px solid var(--border-color)', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div style={{ padding: '0 20px 12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            {filteredConsumptions.length} entries
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', padding: '0', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <table className="data-table" style={{ minWidth: '900px' }}>
            <thead>
              <tr style={{ background: 'white', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meal Type</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Raw Material</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stock (Available)</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty Taken</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wastage</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Consumed</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remarks</th>
                <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
                    <div style={{ marginBottom: '8px' }}><ChefHat size={32} color="#cbd5e1" /></div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>No consumption entries found</div>

                  </td>
                </tr>
              ) : paginatedData.map((c) => {
                const mealColors = mealBadgeColors[c.mealType] || { bg: '#f1f5f9', color: '#475569' };
                return (
                  <tr key={c.id} style={{ transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#fafbfd')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '12px 10px', fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>
                      {formatDateDMY(c.dateStr)}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
                        fontSize: '12px', fontWeight: 600,
                        background: mealColors.bg, color: mealColors.color,
                      }}>
                        {c.mealType}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      {c.product?.name || '—'}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>
                      {c.availableStock} {c.unit}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      {c.quantityTaken}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>
                      {c.unit}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '13px', color: c.wastage > 0 ? '#ef4444' : '#94a3b8', fontWeight: c.wastage > 0 ? 600 : 400 }}>
                      {c.wastage > 0 ? c.wastage : '—'}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '13px', fontWeight: 700, color: '#059669' }}>
                      {c.netConsumed} {c.unit}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '12px', color: '#64748b', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.remarks || ''}>
                      {c.remarks || '—'}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => openViewModal(c)}
                          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#16a34a', transition: 'all 0.15s' }}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleEdit(c)}
                          style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#3b82f6', transition: 'all 0.15s' }}
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#ef4444', transition: 'all 0.15s' }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredConsumptions.length > pageSize && (
          <div style={{ marginTop: '16px' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={pageSize}
              onItemsPerPageChange={(s: number) => { setPageSize(s); setCurrentPage(1); }}
              totalItems={filteredConsumptions.length}
            />
          </div>
        )}
      </div>

      {/* VIEW CONSUMPTION DETAILS — same layout as CanteenMaster "Product Details" modal */}
      {viewRecord && (
        <div className="modal-overlay" onClick={closeViewModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', borderRadius: '12px' }}>
            {/* Header */}
            <div style={{
              background: '#3B82F6',
              color: 'white',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Consumption Details</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: '999px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap'
                }}>
                  {viewRecord.mealType}
                  <span style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.35)' }} />
                  <span style={{ color: '#dbeafe', fontWeight: 500 }}>{formatDateDMY(viewRecord.dateStr)}</span>
                </span>
                <button
                  onClick={closeViewModal}
                  title="Close"
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {viewRows.map(row => (
                  <div
                    key={row.label}
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px', alignItems: row.align || 'center' }}
                  >
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ color: row.color || '#0f172a', fontSize: '14px', fontWeight: row.bold ? 800 : 700, wordBreak: 'break-word' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeViewModal}
                  style={{ padding: '8px 20px', borderRadius: '6px', background: '#334155', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 12px;
          width: 100%;
          max-width: 580px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: modalAppear 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes modalAppear {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

      `}</style>
    </div>
  );
}
