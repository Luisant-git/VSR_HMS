import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
const LateWarnings = () => {
  const navigate = useNavigate();
  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Late Return Warnings & Missing Alerts"
        subtitle="Automatic real-time alerts for hostellers who failed to return by the standard deadline (20:30) or their stated check-in time"
      />

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #fecdd3', overflow: 'hidden' }}>
        <div style={{ background: '#fff1f2', padding: '15px 20px', borderBottom: '1px solid #fecdd3', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={20} color="#e11d48" />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e11d48', margin: 0 }}>
            2 Critical Alerts Active
          </h3>
        </div>
        
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', background: '#f8f9fa' }}>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Student & Room</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Outpass / Reason</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Expected Return</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Current Delay</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Contact</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fffcfc' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>Vikram Singh</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>HST-2026-015 | Room 201</div>
                </td>
                <td style={{ padding: '16px 20px', color: '#334155' }}>Weekend Outpass (Home)</td>
                <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>25 Sep 2026, 18:00</td>
                <td style={{ padding: '16px 20px' }}><span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '4px', background: '#e11d48', color: 'white', fontWeight: 700, fontSize: '12px' }}>Overdue by 1h 45m</span></td>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ color: '#0d6efd', fontWeight: 500 }}>9876543210 (Self)</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>9876543211 (Parent)</div>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                  <button style={{ padding: '8px 16px', fontSize: '13px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Mark Reached</button>
                </td>
              </tr>
              <tr style={{ background: '#fffcfc' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>Karthik Raja</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>HST-2026-022 | Room 103</div>
                </td>
                <td style={{ padding: '16px 20px', color: '#334155' }}>Evening Shopping</td>
                <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>25 Sep 2026, 19:30</td>
                <td style={{ padding: '16px 20px' }}><span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '4px', background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: '12px' }}>Overdue by 15m</span></td>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ color: '#0d6efd', fontWeight: 500 }}>9988776655 (Self)</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>9988776654 (Parent)</div>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                  <button style={{ padding: '8px 16px', fontSize: '13px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Mark Reached</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LateWarnings;
