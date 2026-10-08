import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getSystemSettings, updateSystemSettings } from '../api/settings.api';
import { Save } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

const SystemSettings = () => {
  const [settings, setSettings] = useState({
    hostelName: '',
    address: '',
    phone: '',
    email: '',
    gstin: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await getSystemSettings();
      setSettings(data);
    } catch (err) {
      toast.error('Failed to fetch system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSystemSettings(settings);
      toast.success('Settings updated successfully');
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading settings...</div>;

  return (
    <div>
      <PageHeader
        title="System Settings"
        subtitle="Configure hostel details shown on receipts, ID cards, and login pages"
      />

      <div style={{ maxWidth: '900px', margin: '0 auto', background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSave}>
          
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Hostel / Organization Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={settings.hostelName}
                onChange={(e) => setSettings({...settings, hostelName: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8f9fa', color: '#334155', fontSize: '14px', outline: 'none' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Phone Number</label>
              <input 
                type="text" 
                value={settings.phone}
                onChange={(e) => setSettings({...settings, phone: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8f9fa', color: '#334155', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address</label>
              <input 
                type="email" 
                value={settings.email}
                onChange={(e) => setSettings({...settings, email: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8f9fa', color: '#334155', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>GSTIN / Tax ID</label>
              <input 
                type="text" 
                value={settings.gstin}
                onChange={(e) => setSettings({...settings, gstin: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8f9fa', color: '#334155', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Full Address (Supports multiple lines) <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea 
                rows={3}
                value={settings.address}
                onChange={(e) => setSettings({...settings, address: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8f9fa', color: '#334155', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '20px' }}>
            <button 
              type="submit" 
              disabled={saving}
              style={{ 
                background: 'var(--sidebar-active)', 
                color: 'white', 
                border: 'none', 
                padding: '10px 24px', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: 600, 
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: saving ? 0.7 : 1,
                boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)'
              }}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SystemSettings;
