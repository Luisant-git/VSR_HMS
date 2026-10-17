import React, { useEffect, useMemo, useState } from 'react';
import { Coffee, Sun, Sunset, Moon, FileText, Search, X, FileSpreadsheet } from 'lucide-react';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingSpinner';
import { MessAttendanceAPI, type MessAttendanceReportItem } from '../api/mess-attendance.api';
import { formatDateDMY } from '../utils/date';

const MEAL_OPTIONS = [
  { value: '-- All Meals --', label: '-- All Meals --' },
  { value: 'Breakfast', label: 'Breakfast' },
  { value: 'Lunch', label: 'Lunch' },
  { value: 'Evening Snacks', label: 'Evening Snacks' },
  { value: 'Dinner', label: 'Dinner' }
];

export const MessAttendanceReport: React.FC = () => {
  const [reports, setReports] = useState<MessAttendanceReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [mealFilter, setMealFilter] = useState('-- All Meals --');
  const [sortFilter, setSortFilter] = useState('latest');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const fetchReports = async () => {
    try {
      const data = await MessAttendanceAPI.getReports();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getMealIcon = (meal: string) => {
    if (meal === 'Breakfast') return <Coffee size={16} color="#f59e0b" />;
    if (meal === 'Lunch') return <Sun size={16} color="#ef4444" />;
    if (meal === 'Evening Snacks') return <Sunset size={16} color="#f97316" />;
    if (meal === 'Dinner') return <Moon size={16} color="#3b82f6" />;
    return <FileText size={16} />;
  };

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
    })
  };

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = reports.filter(r => {
      const matchesMeal = mealFilter === '-- All Meals --' || r.mealType === mealFilter;
      const matchesSearch = q === '' ||
        (r.student?.name || '').toLowerCase().includes(q) ||
        (r.student?.regNo || '').toLowerCase().includes(q) ||
        String(r.student?.roomNo || '').toLowerCase().includes(q);
      return matchesMeal && matchesSearch;
    });
    list = [...list].sort((a, b) => {
      const ta = new Date(a.scannedAt).getTime();
      const tb = new Date(b.scannedAt).getTime();
      return sortFilter === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }, [reports, searchQuery, mealFilter, sortFilter]);

  const totalRecords = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  const pagedReports = filteredReports.slice((page - 1) * limit, page * limit);

  const handleExportExcel = () => {
    const data = filteredReports.map(r => ({
      'TIME': new Date(r.scannedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      'REGIS NO': r.student?.regNo || '',
      'NAME': r.student?.name || '',
      'ROOM NO': r.student?.roomNo || '',
      'MEAL TYPE': r.mealType,
      'FOOD TYPE': r.student?.foodType || '',
      'DATE': formatDateDMY(r.date),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mess Attendance');
    XLSX.writeFile(workbook, 'Mess_Attendance_Export.xlsx');
  };

  if (loading) return <LoadingBlock />;

  return (
    <div>
      <div className="content-card" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
        <PageHeader
          title="Daily Mess Attendance"
          subtitle="Live view of today's scanned meals"
          icon={<Coffee size={24} color="#fff" />} iconBg="linear-gradient(135deg, #f97316 0%, #ea580c 100%)"
          rightContent={
            <>
              <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '10px 18px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Total Meals Scanned: {filteredReports.length}
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
                  gap: '8px'
                }}>
                <FileSpreadsheet size={18} />
                Export Excel
              </button>
            </>
          }
        />

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
              placeholder="Search by name, reg no, room..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
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
            options={MEAL_OPTIONS}
            value={MEAL_OPTIONS.find(o => o.value === mealFilter)}
            onChange={(opt) => { setMealFilter(opt?.value || '-- All Meals --'); setPage(1); }}
            styles={selectStyles}
            isSearchable={false}
          />

          <Select
            options={[
              { value: 'latest', label: 'Latest First' },
              { value: 'oldest', label: 'Oldest First' }
            ]}
            value={{ value: sortFilter, label: sortFilter === 'oldest' ? 'Oldest First' : 'Latest First' }}
            onChange={(opt) => { setSortFilter(opt?.value || 'latest'); setPage(1); }}
            styles={selectStyles}
            isSearchable={false}
          />

          {(searchQuery !== '' || mealFilter !== '-- All Meals --') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setMealFilter('-- All Meals --');
                setSortFilter('latest');
                setPage(1);
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
        </div>

        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', padding: '0', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'white', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student ID</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Room</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meal Type</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Food Pref</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scanned Time</th>
              </tr>
            </thead>
            <tbody>
              {pagedReports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    No meal attendances recorded for today yet.
                  </td>
                </tr>
              ) : (
                pagedReports.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eaedf1', background: 'white' }}>
                    <td style={{ padding: '15px 20px', fontWeight: 600 }}>
                      <span style={{ color: '#0d6efd' }}>{r.student?.regNo || 'N/A'}</span>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{r.student?.name || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ background: '#0d6efd', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: 'white' }}>Room {r.student?.roomNo || 'N/A'}</span>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        {getMealIcon(r.mealType)}
                        {r.mealType}
                      </div>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{
                        background: r.student?.foodType === 'Veg' ? '#dcfce7' : '#fee2e2',
                        color: r.student?.foodType === 'Veg' ? '#166534' : '#991b1b',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600
                      }}>
                        {r.student?.foodType?.toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                      {new Date(r.scannedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalRecords > 0 && (
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
    </div>
  );
};
