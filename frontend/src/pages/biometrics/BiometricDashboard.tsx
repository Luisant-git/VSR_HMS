import React from 'react';
import { Database, ScanFace, Fingerprint, Activity, Wifi, ShieldCheck, Clock, Users, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BiometricDashboard = () => {
  const navigate = useNavigate();

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)' }}>Biometric Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '5px' }}>
            Monitor biometric registrations and external scanning devices
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '30px' }}>
        {/* Metric Cards */}
        <div className="metric-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '14px', fontWeight: 600, marginBottom: '15px' }}>
            <Users size={20} color="#3b82f6" /> Total Students
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b' }}>342</div>
        </div>

        <div className="metric-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '14px', fontWeight: 600, marginBottom: '15px' }}>
            <ScanFace size={20} color="#10b981" /> Face Registered
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b' }}>310</div>
        </div>

        <div className="metric-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '14px', fontWeight: 600, marginBottom: '15px' }}>
            <Fingerprint size={20} color="#8b5cf6" /> Print Registered
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b' }}>295</div>
        </div>

        <div className="metric-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '14px', fontWeight: 600, marginBottom: '15px' }}>
            <ShieldCheck size={20} color="#0ea5e9" /> Both Registered
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b' }}>280</div>
        </div>

        <div className="metric-card" onClick={() => navigate('/biometrics/records?status=pending')} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#be123c', fontSize: '14px', fontWeight: 600, marginBottom: '15px' }}>
            <Activity size={20} color="#e11d48" /> Pending Setup
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#9f1239' }}>32</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        {/* Device Status */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '25px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="#64748b" /> Active Biometric Devices
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '50px', height: '50px', background: '#e0f2fe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ScanFace size={24} color="#0284c7" />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Main Gate Face Scanner</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Device ID: DEV-FC-99012</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  <Wifi size={14} /> Online
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Last synced: Just now
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '50px', height: '50px', background: '#f3e8ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Fingerprint size={24} color="#9333ea" />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Reception Fingerprint Terminal</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Device ID: DEV-FP-44182</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  <Wifi size={14} /> Online
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Last synced: 2 mins ago
                </div>
              </div>
            </div>
            
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', opacity: 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '50px', height: '50px', background: '#f1f5f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Fingerprint size={24} color="#64748b" />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Backup Scanner (Library)</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Device ID: DEV-FP-44185</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  <Wifi size={14} /> Offline
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Last synced: 4 days ago
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '25px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '20px' }}>Quick Actions</h3>
            
            <button onClick={() => navigate('/biometrics/register')} style={{ width: '100%', padding: '15px', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '15px', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, color: '#0f172a' }}>
                <div style={{ background: '#e0e7ff', padding: '8px', borderRadius: '8px', color: '#4f46e5' }}><ScanFace size={18} /></div>
                Register New Biometric
              </div>
              <ArrowRight size={18} color="#94a3b8" />
            </button>

            <button onClick={() => navigate('/biometrics/identify')} style={{ width: '100%', padding: '15px', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '15px', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, color: '#0f172a' }}>
                <div style={{ background: '#dcfce7', padding: '8px', borderRadius: '8px', color: '#16a34a' }}><Fingerprint size={18} /></div>
                Scan & Identify Student
              </div>
              <ArrowRight size={18} color="#94a3b8" />
            </button>

            <button onClick={() => navigate('/biometrics/records')} style={{ width: '100%', padding: '15px', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, color: '#0f172a' }}>
                <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '8px', color: '#d97706' }}><Database size={18} /></div>
                View Registration Records
              </div>
              <ArrowRight size={18} color="#94a3b8" />
            </button>
          </div>
          
          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', padding: '20px', textAlign: 'center' }}>
             <ShieldCheck size={32} color="#94a3b8" style={{ margin: '0 auto 10px auto' }} />
             <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
               The biometric system ensures secure authentication for gate logs and meals. Hardware syncing runs automatically in the background.
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiometricDashboard;
