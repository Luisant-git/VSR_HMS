import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, FileSpreadsheet, Package, RefreshCw } from 'lucide-react';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { LoadingRow } from '../components/LoadingSpinner';
import { KitchenAPI } from '../api/kitchen.api';
import { formatDateDMY } from '../utils/date';

interface StockRow {
  productId: string;
  name: string;
  code: string | null;
  category: string;
  unit: string;
  currentStock: number;
  stockAsOn: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const allCategories = '-- All Categories --';

export default function KitchenStockReport() {
  const [asOnDate, setAsOnDate] = useState(todayStr());
  const [data, setData] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(allCategories);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const fetchReport = async (date: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await KitchenAPI.getStockReport(date);
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load stock report');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(asOnDate);
    setPage(1);
  }, [asOnDate]);

  const categoryOptions = useMemo(() => {
    const names = Array.from(new Set(data.map(d => d.category).filter(Boolean))).sort();
    return [{ value: allCategories, label: allCategories }, ...names.map(n => ({ value: n, label: n }))];
  }, [data]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.filter(d => {
      const matchesCategory = categoryFilter === allCategories || d.category === categoryFilter;
      const matchesSearch =
        q === '' ||
        d.name.toLowerCase().includes(q) ||
        (d.code || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [data, searchQuery, categoryFilter]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  const pagedData = filtered.slice((page - 1) * limit, page * limit);

  const hasFilters = searchQuery !== '' || categoryFilter !== allCategories;

  const handleExportExcel = () => {
    const rows = filtered.map((d, i) => ({
      'S.No': i + 1,
      'RAW MATERIAL': d.name,
      'CODE': d.code || '',
      'CATEGORY': d.category,
      'UNIT': d.unit,
      'CURRENT STOCK': d.currentStock,
      [`STOCK AS ON ${formatDateDMY(asOnDate)}`]: d.stockAsOn,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 8 }, { wch: 15 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
    XLSX.writeFile(wb, `kitchen_stock_${asOnDate}.xlsx`);
  };

  const stockColor = (v: number) => (v <= 0 ? '#ef4444' : v <= 5 ? '#f59e0b' : '#059669');

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
      minWidth: '190px',
    }),
    menu: (base: any) => ({ ...base, fontSize: '13px', zIndex: 20 }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      background: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
      color: state.isSelected ? 'white' : '#334155',
      cursor: 'pointer',
    }),
  };

  const thStyle: React.CSSProperties = {
    padding: '15px 20px',
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <div>
      <div className="content-card" style={{ background: 'transparent', boxShadow: 'none', marginBottom: 0, padding: 0 }}>
        <PageHeader
          title="Stock Report"
          subtitle={`Raw material stock as on ${formatDateDMY(asOnDate)}`}
          icon={<Package size={24} color="#fff" />} iconBg="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          rightContent={
            <>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '10px 18px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} />
                Total Items: {totalRecords}
              </div>
              <button
                onClick={handleExportExcel}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(16,185,129,0.2)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                <FileSpreadsheet size={18} />
                Export Excel
              </button>
            </>
          }
        />

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', padding: '15px 20px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Show</span>
            <select
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={99999}>All</option>
            </select>
            <span style={{ fontSize: '13px', color: '#64748b' }}>entries</span>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 5px' }}></div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
            <input
              type="text"
              placeholder="Search material / code..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              style={{
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                outline: 'none',
                width: '260px',
              }}
            />
          </div>

          <Select
            options={categoryOptions}
            value={categoryOptions.find(o => o.value === categoryFilter)}
            onChange={(opt) => { setCategoryFilter(opt?.value || allCategories); setPage(1); }}
            styles={selectStyles}
            placeholder="Search category..."
            isSearchable={true}
          />

          {hasFilters && (
            <button
              onClick={() => { setSearchQuery(''); setCategoryFilter(allCategories); setPage(1); }}
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
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
            >
              <X size={14} strokeWidth={3} /> Clear All
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Stock as on</span>
            <input
              type="date"
              value={asOnDate}
              onChange={(e) => { setAsOnDate(e.target.value || todayStr()); setPage(1); }}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer', background: 'white' }}
            />
          </div>

          <div style={{ flex: 1 }}></div>

          <button
            onClick={() => fetchReport(asOnDate)}
            title="Refresh"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : undefined} /> Refresh
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', padding: '0', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'white', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
                <th style={{ ...thStyle, width: '60px' }}>S.No</th>
                <th style={thStyle}>Raw Material</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Current Stock</th>
                <th style={thStyle}>Stock as on ({formatDateDMY(asOnDate)})</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow colSpan={6} />
              ) : pagedData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ marginBottom: '8px' }}><Package size={32} color="#cbd5e1" /></div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>No stock items found</div>
                  </td>
                </tr>
              ) : (
                pagedData.map((d, i) => (
                  <tr key={d.productId} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
                      {(page - 1) * limit + i + 1}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{d.name}</div>
                      {d.code && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{d.code}</div>}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569' }}>{d.category}</td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569' }}>{d.unit || '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 700, color: stockColor(d.currentStock) }}>
                      {d.currentStock} {d.unit}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 700, color: stockColor(d.stockAsOn) }}>
                      {d.stockAsOn} {d.unit}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && totalRecords > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} entries
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === 1 ? '#f1f5f9' : 'white', color: page === 1 ? '#94a3b8' : '#334155', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  Previous
                </button>
                <button
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--sidebar-active)', background: 'var(--sidebar-active)', color: 'white', cursor: 'default', fontSize: '13px', fontWeight: 600 }}>
                  {page}
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === totalPages ? '#f1f5f9' : 'white', color: page === totalPages ? '#94a3b8' : '#334155', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
