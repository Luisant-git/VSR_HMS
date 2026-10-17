import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getSystemSettings, updateSystemSettings } from '../api/settings.api';
import { Save, Settings } from 'lucide-react';
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
      console.error('Failed to load system settings', err);
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

  if (loading) return (
    <div className="ui-page">
      <div className="ui-empty">Loading settings...</div>
    </div>
  );

  return (
    <div className="ui-page">
      <PageHeader
        title="System Settings"
        subtitle="Configure hostel details shown on receipts, ID cards, and login pages"
        icon={<Settings size={24} color="#fff" />} iconBg="linear-gradient(135deg, #64748b 0%, #475569 100%)"
      />

      <div className="ui-card ui-card-body ss-card">
        <form onSubmit={handleSave}>
          <div className="ui-form-row ss-row-gap">
            <div className="ui-form-group">
              <label className="ui-form-label">Hostel / Organization Name <span className="ss-req">*</span></label>
              <input
                type="text"
                value={settings.hostelName}
                onChange={(e) => setSettings({...settings, hostelName: e.target.value})}
                className="ui-form-control"
                required
              />
            </div>

            <div className="ui-form-group">
              <label className="ui-form-label">Phone Number</label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({...settings, phone: e.target.value})}
                className="ui-form-control"
              />
            </div>
          </div>

          <div className="ui-form-row ss-row-gap">
            <div className="ui-form-group">
              <label className="ui-form-label">Email Address</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({...settings, email: e.target.value})}
                className="ui-form-control"
              />
            </div>

            <div className="ui-form-group">
              <label className="ui-form-label">GSTIN / Tax ID</label>
              <input
                type="text"
                value={settings.gstin}
                onChange={(e) => setSettings({...settings, gstin: e.target.value})}
                className="ui-form-control"
              />
            </div>
          </div>

          <div className="ui-form-group ss-address">
            <label className="ui-form-label">Full Address (Supports multiple lines) <span className="ss-req">*</span></label>
            <textarea
              rows={3}
              value={settings.address}
              onChange={(e) => setSettings({...settings, address: e.target.value})}
              className="ui-form-control"
              required
            />
          </div>

          <div className="ss-footer">
            <button
              type="submit"
              disabled={saving}
              className="ui-btn ui-btn-primary"
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
