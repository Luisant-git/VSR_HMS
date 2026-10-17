import { useState, useEffect } from 'react';
import { Save, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { MessDeductionAPI } from '../api/mess-deduction.api';
import { PageHeader } from '../components/PageHeader';

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
    <div className="ui-page">
      <PageHeader
        title="Mess Deduction Master"
        subtitle="Configure the outpass duration rules for mess fee deductions"
        showBack={true}
        icon={<FileText size={24} color="#fff" />} iconBg="linear-gradient(135deg, #78716c 0%, #57534e 100%)"
      />

      <div className="ui-card ui-card-body mdm-card">
        <h3 className="mdm-section-title">Outpass Rules</h3>

        <div className="ui-form-group mdm-field">
          <label className="ui-form-label">Deduction Threshold (Days)</label>
          <div className="mdm-inline">
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value) || 0)}
              className="ui-input mdm-number"
              disabled={loading}
            />
            <span className="mdm-unit">days</span>
          </div>
          <p className="mdm-note">
            If a student is on outpass for strictly more than this number of days, the system will automatically calculate and deduct their mess fees based on their room's mess fee per day.
          </p>
        </div>

        <div className="mdm-actions">
          <button
            onClick={handleSave}
            disabled={loading}
            className="ui-btn ui-btn-primary"
          >
            <Save size={18} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessDeductionMaster;
