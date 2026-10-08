import { useState, useEffect } from 'react';
import { Save, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { MessDeductionAPI } from '../api/mess-deduction.api';

const MessDeductionMaster = () => {
  const [threshold, setThreshold] = useState<number>(15);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await MessDeductionAPI.getSettings();
      setThreshold(data.messDeductionThreshold || 15);
    } catch (e) {
      console.error('Failed to fetch settings', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await MessDeductionAPI.updateSettings({ messDeductionThreshold: threshold });
      toast.success('Mess Deduction settings updated successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update settings');
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={28} color="#3b82f6" /> Mess Deduction Master
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: 0 }}>Configure the outpass duration rules for mess fee deductions</p>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>Outpass Rules</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Deduction Threshold (Days)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input 
              type="number" 
              min="0"
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value) || 0)}
              style={{ width: '120px', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', outline: 'none' }}
              disabled={loading}
            />
            <span style={{ fontSize: '13px', color: '#64748b' }}>days</span>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0', lineHeight: 1.5 }}>
            If a student is on outpass for strictly more than this number of days, the system will automatically calculate and deduct their mess fees based on their room's mess fee per day.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '30px' }}>
          <button 
            onClick={handleSave}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', opacity: loading ? 0.7 : 1 }}
            onMouseOver={e => e.currentTarget.style.background = '#0284c7'}
            onMouseOut={e => e.currentTarget.style.background = '#0ea5e9'}
          >
            <Save size={18} /> Save Settings
          </button>
        </div>

      </div>
    </div>
  );
};

export default MessDeductionMaster;
