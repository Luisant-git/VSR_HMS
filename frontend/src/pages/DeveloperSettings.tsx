import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Zap, AlertTriangle, ShieldAlert } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { DeveloperAPI } from '../api/developer.api';

export default function DeveloperSettings() {
  const [loading, setLoading] = useState(false);

  const requestTruncate = async (entity: string, display: string) => {
    const { value: confirmText } = await Swal.fire({
      title: 'DANGER ZONE',
      html: `You are about to permanently truncate <b>${display}</b>. This action CANNOT be undone.<br/><br/>Type <b>TRUNCATE-${entity}</b> to confirm:`,
      input: 'text',
      icon: 'warning',
      inputPlaceholder: `TRUNCATE-${entity}`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Confirm'
    });

    if (confirmText !== `TRUNCATE-${entity}`) {
      if (confirmText) Swal.fire('Aborted', 'Captcha did not match.', 'info');
      return;
    }

    const { value: password } = await Swal.fire({
      title: 'Authentication Required',
      text: 'Enter your password to execute this truncation.',
      input: 'password',
      icon: 'info',
      inputPlaceholder: 'Enter your password',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'EXECUTE TRUNCATE'
    });

    if (!password) {
      return;
    }

    setLoading(true);
    try {
      const res = await DeveloperAPI.truncate({ entity, passwordConfirm: password });
      Swal.fire('Truncated!', res.message, 'success');
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || e.message || 'Truncation failed';
      Swal.fire('Error', errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '0px' }}>
      <PageHeader 
        title="Developer Tools" 
        subtitle="System administrative functions and dangerous operations"
      />
      
      <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px' }}>
          <AlertTriangle size={24} color="#dc2626" />
          <div>
            <div style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '15px' }}>WARNING: Extreme Data Loss</div>
            <div style={{ fontSize: '13px', color: '#7f1d1d' }}>The actions below directly wipe data from the database. Do not proceed unless you are absolutely sure.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          
          <TruncateCard 
            title="Truncate All Students" 
            desc="Wipe all registered students, fees, logs, outpasses, and clearance records."
            btnText="Wipe Students"
            onClick={() => requestTruncate('STUDENTS', 'All Students & Related Data')}
          />
          <TruncateCard 
            title="Truncate Colleges" 
            desc="Wipe all college masters and fine masters."
            btnText="Wipe Colleges"
            onClick={() => requestTruncate('COLLEGES', 'Colleges & Fine Masters')}
          />
          <TruncateCard 
            title="Truncate Financials" 
            desc="Wipe all fee transactions and EB bills."
            btnText="Wipe Fees"
            onClick={() => requestTruncate('FEES', 'All Financial Transactions')}
          />
          <TruncateCard 
            title="Truncate Outpasses" 
            desc="Wipe all pending, active, and completed outpasses."
            btnText="Wipe Outpasses"
            onClick={() => requestTruncate('OUTPASSES', 'All Outpasses')}
          />
          <TruncateCard 
            title="Truncate Gate Logs" 
            desc="Wipe all entry and exit logs from the gate."
            btnText="Wipe Gate Logs"
            onClick={() => requestTruncate('GATELOGS', 'All Gate Logs')}
          />

        </div>

        <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #dc2626', borderRadius: '12px', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <ShieldAlert size={28} color="#dc2626" />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>NUCLEAR OPTION: Truncate Entire Database</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>This will wipe everything EXCEPT the User Accounts and System Configs.</div>
            </div>
          </div>
          <button
            onClick={() => requestTruncate('ALL', 'ENTIRE DATABASE')}
            disabled={loading}
            style={{ padding: '12px 24px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Processing...' : 'TRUNCATE ALL DATA'}
          </button>
        </div>

      </div>
    </div>
  );
}

function TruncateCard({ title, desc, btnText, onClick }: { title: string, desc: string, btnText: string, onClick: () => void }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#64748b', flex: 1 }}>{desc}</div>
      <button 
        onClick={onClick}
        style={{ marginTop: '10px', width: '100%', padding: '10px', border: '1px solid #ef4444', color: '#ef4444', background: 'white', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
        onMouseOver={e => { e.currentTarget.style.background = '#fef2f2'; }}
        onMouseOut={e => { e.currentTarget.style.background = 'white'; }}
      >
        {btnText}
      </button>
    </div>
  );
}
