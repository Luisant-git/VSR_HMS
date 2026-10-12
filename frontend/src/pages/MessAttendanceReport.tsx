import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Coffee, Sun, Sunset, Moon, FileText } from 'lucide-react';

export const MessAttendanceReport: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/mess-attendance/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(res.data);
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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="page-container" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>Daily Mess Attendance</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Live view of today's scanned meals</p>
        </div>
        <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '8px 16px', borderRadius: '12px', fontWeight: 600 }}>
          Total Meals Scanned: {reports.length}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px' }}>Time</th>
              <th style={{ padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px' }}>Student Info</th>
              <th style={{ padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px' }}>Meal Type</th>
              <th style={{ padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px' }}>Food Pref</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                  {new Date(r.scannedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.student?.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{r.student?.regNo} • Room: {r.student?.roomNo || 'N/A'}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
                    {getMealIcon(r.mealType)}
                    {r.mealType}
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px',
                    background: r.student?.foodType === 'Veg' ? '#dcfce7' : '#fee2e2',
                    color: r.student?.foodType === 'Veg' ? '#16a34a' : '#ef4444'
                  }}>
                    {r.student?.foodType?.toUpperCase() || 'N/A'}
                  </span>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  No meal attendances recorded for today yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
