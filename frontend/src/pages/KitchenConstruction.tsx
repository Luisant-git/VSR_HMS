import React, { useState, useEffect } from 'react';
import {
  ChefHat, Plus, Trash2, Search, Edit, X, Download, Filter,
  Package, AlertTriangle, RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { KitchenAPI } from '../api/kitchen.api';
import { Pagination } from '../components/Pagination';
import { SearchableSelect, type SelectOption } from '../components/SearchableSelect';
import * as XLSX from 'xlsx';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Evening Snacks', 'Dinner'];

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

export default function KitchenConstruction() {
  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    dateStr: new Date().toISOString().split('T')[0],
    mealType: '',
    productId: '',
    quantityTaken: '',
    wastage: '',
    remarks: '',
  });

  // Filters
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterMeal, setFilterMeal] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected product info
  const selectedProduct = products.find(p => p.id === formData.productId);
  const unitLabel = selectedProduct?.unit?.symbol || selectedProduct?.unit?.name || 'Kg';
  const availableStock = selectedProduct?.availableStock ?? 0;

  // Searchable product options for the Raw Material dropdown
  const productOptions: SelectOption[] = products.map(p => ({
    value: p.id,
    label: `${p.name}${p.category ? ` (${p.category.name})` : ''}`,
    sublabel: `Stock: ${p.availableStock}`,
  }));

  // Auto-calculate net consumed
  const grossQty = parseFloat(formData.quantityTaken) || 0;
  const wastageQty = parseFloat(formData.wastage) || 0;
  const netConsumed = Math.max(0, grossQty - wastageQty);

  useEffect(() => {
    loadProducts();
    loadConsumptions();
  }, []);

  useEffect(() => {
    loadConsumptions();
    setCurrentPage(1);
  }, [filterDate, filterMeal]);

  const loadProducts = async () => {
    try {
      const data = await KitchenAPI.getProducts();
      setProducts(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load products');
    }
  };

  const loadConsumptions = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (filterDate) filters.dateStr = filterDate;
      if (filterMeal) filters.mealType = filterMeal;
      const data = await KitchenAPI.getConsumptions(filters);
      setConsumptions(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load consumption entries');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      dateStr: filterDate || new Date().toISOString().split('T')[0],
      mealType: '',
      productId: '',
      quantityTaken: '',
      wastage: '',
      remarks: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formData.mealType) return toast.error('Please select Meal Type');
    if (!formData.productId) return toast.error('Please select Raw Material Item');
    if (!formData.quantityTaken || grossQty <= 0) return toast.error('Please enter Quantity Taken');
    if (grossQty > availableStock && !editingId) return toast.error(`Insufficient stock! Available: ${availableStock} ${unitLabel}`);

    try {
      if (editingId) {
        await KitchenAPI.updateConsumption(editingId, {
          mealType: formData.mealType,
          productId: formData.productId,
          dateStr: formData.dateStr,
          quantityTaken: grossQty,
          wastage: wastageQty,
          remarks: formData.remarks || undefined,
        });
        toast.success('Consumption entry updated');
      } else {
        await KitchenAPI.createConsumption({
          dateStr: formData.dateStr,
          mealType: formData.mealType,
          productId: formData.productId,
          quantityTaken: grossQty,
          wastage: wastageQty,
          remarks: formData.remarks || undefined,
        });
        toast.success('Consumption entry added');
      }
      resetForm();
      loadConsumptions();
      loadProducts(); // Refresh stock
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleEdit = (c: Consumption) => {
    setFormData({
      dateStr: c.dateStr,
      mealType: c.mealType,
      productId: c.productId,
      quantityTaken: String(c.quantityTaken),
      wastage: String(c.wastage),
      remarks: c.remarks || '',
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (c: Consumption) => {
    const result = await Swal.fire({
      title: 'Delete Entry?',
      html: `<b>${c.product?.name}</b> — ${c.mealType} on ${c.dateStr}<br/>Qty: ${c.quantityTaken} ${c.unit} will be restored to stock.`,
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
      'Date': c.dateStr,
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
    XLSX.writeFile(wb, `kitchen_consumption_${filterDate || 'all'}.xlsx`);
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

  const helperStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '4px',
    lineHeight: 1.3,
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
          <button onClick={handleExport} style={btnSecondary}>
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
        <div style={{ ...cardStyle, marginBottom: '24px', borderTop: '3px solid #4a72fa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
              {editingId ? '✏️ Edit Consumption Entry' : '➕ New Consumption Entry'}
            </h3>
            <button onClick={resetForm} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
            {/* Date */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                style={inputStyle}
                value={formData.dateStr}
                onChange={e => setFormData({ ...formData, dateStr: e.target.value })}
              />
            </div>

            {/* Meal Type */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Meal Type <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                style={selectStyle}
                value={formData.mealType}
                onChange={e => setFormData({ ...formData, mealType: e.target.value })}
              >
                <option value="">— Select Meal —</option>
                {MEAL_TYPES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Raw Material Item */}
            <div style={{ ...fieldWrap, flex: '1.6 0 220px', minWidth: '220px' }}>
              <label style={labelStyle}>Raw Material Item <span style={{ color: '#ef4444' }}>*</span></label>
              <SearchableSelect
                options={productOptions}
                value={formData.productId}
                onChange={val => setFormData({ ...formData, productId: val })}
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
                  color: availableStock <= 0 ? '#ef4444' : availableStock <= 5 ? '#f59e0b' : '#059669',
                }}
                value={selectedProduct ? `${availableStock} ${unitLabel}` : '—'}
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
                  placeholder="e.g. 10"
                  value={formData.quantityTaken}
                  onChange={e => setFormData({ ...formData, quantityTaken: e.target.value })}
                />
                <span style={suffixStyle}>{unitLabel}</span>
              </div>
              
            </div>

            {/* Unit (Auto-filled) */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Unit</label>
              <input type="text" style={readOnlyStyle} value={unitLabel} readOnly />
              
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
                  placeholder="e.g. 0.5"
                  value={formData.wastage}
                  onChange={e => setFormData({ ...formData, wastage: e.target.value })}
                />
                <span style={suffixStyle}>{unitLabel}</span>
              </div>
              
            </div>

            {/* Net Consumed (Auto-calculated) */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Net Consumed</label>
              <input
                type="text"
                style={{
                  ...readOnlyStyle,
                  color: netConsumed > 0 ? '#059669' : '#64748b',
                  fontSize: '15px',
                }}
                value={grossQty > 0 ? `${netConsumed} ${unitLabel}` : '—'}
                readOnly
              />
             
            </div>

            {/* Remarks */}
            <div style={fieldWrapWide}>
              <label style={labelStyle}>Remarks</label>
              <input
                type="text"
                style={inputStyle}
                placeholder='e.g. "Tomatoes were overripe"'
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>
          </div>

          {/* Submit buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <button onClick={resetForm} style={btnSecondary}>Cancel</button>
            <button onClick={handleSubmit} style={btnPrimary}>
              {editingId ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}

      {/* Filters + Table */}
      <div style={cardStyle}>
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Date filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="#64748b" />
              <input
                type="date"
                style={{ ...inputStyle, width: '160px', padding: '8px 12px' }}
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>

            {/* Meal filter */}
            <select
              style={{ ...selectStyle, width: '160px', padding: '8px 12px' }}
              value={filterMeal}
              onChange={e => setFilterMeal(e.target.value)}
            >
              <option value="">All Meals</option>
              {MEAL_TYPES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search items..."
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: '#1e293b', width: '140px' }}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => { loadConsumptions(); loadProducts(); }} style={{ ...btnSecondary, padding: '8px 14px' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              {filteredConsumptions.length} entries
            </span>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
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
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Click "Add Consumption" to start recording</div>
                  </td>
                </tr>
              ) : paginatedData.map((c) => {
                const mealColors = mealBadgeColors[c.mealType] || { bg: '#f1f5f9', color: '#475569' };
                return (
                  <tr key={c.id} style={{ transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#fafbfd')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '12px 10px', fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>
                      {c.dateStr}
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

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
