import { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { MenuPermissionAPI } from '../api/menuPermission.api';
import { toast } from 'react-toastify';

const MenuPermission = () => {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roles = [
    'ADMIN', 
    'WARDEN',
    'SUPER_ADMIN'
  ];

  const fetchPermissions = async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await MenuPermissionAPI.getAll();
      setPermissions(data);
    } catch (err) {
      setError('Failed to load permissions');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleEdit = (role: string) => {
    const existing = permissions.find(p => p.role === role);
    setSelectedRole(role);
    setEditData(existing?.permissions || {
      dashboard: false,
      hostellers: false,
      rooms: false,
      fees: false,
      gate_logs: false,
      eb_bills: false,
      clearance: false,
      outpass: false,
      colleges: false,
      settings: false
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await MenuPermissionAPI.upsert(selectedRole!, editData);
      await fetchPermissions();
      setSelectedRole(null);
      setEditData(null);
      toast.success('Permissions updated successfully');
    } catch (err) {
      toast.error('Failed to update permissions');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (key: string) => {
    setEditData((prev: any) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader 
        title="Menu Permissions"
        subtitle="Configure access control for different roles"
        showBack={true}
        
      />

      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '20px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Dashboard</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Hostellers</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Rooms</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Fees</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
                    {error}
                  </td>
                </tr>
              ) : (
                roles.map(role => {
                  const perm = permissions.find(p => p.role === role);
                  return (
                    <tr key={role} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s ease' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                      <td style={{ padding: '16px 24px', fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{role}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        {perm?.permissions?.dashboard ? <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#cbd5e1' }}>✗</span>}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        {perm?.permissions?.hostellers ? <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#cbd5e1' }}>✗</span>}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        {perm?.permissions?.rooms ? <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#cbd5e1' }}>✗</span>}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        {perm?.permissions?.fees ? <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#cbd5e1' }}>✗</span>}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleEdit(role)}
                          style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                        >
                          Edit Config
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRole && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Edit Permissions - <span style={{ color: '#4f46e5' }}>{selectedRole}</span>
              </h2>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Select which modules this role is allowed to access.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { id: 'dashboard', label: 'Dashboard' },
                  { id: 'hostellers', label: 'Hostellers' },
                  { id: 'student_register', label: 'Student Register' },
                  { id: 'rooms', label: 'Rooms' },
                  { id: 'fees', label: 'Fees & Payments' },
                  { id: 'gate_logs', label: 'Gate Logs' },
                  { id: 'eb_bills', label: 'EB Bills' },
                  { id: 'clearance', label: 'Clearance' },
                  { id: 'outpass', label: 'Outpass' },
                  { id: 'colleges', label: 'College Master' },
                  { id: 'settings', label: 'Settings & Users' },
                ].map(module => (
                  <label key={module.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#eef2ff'} onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}>
                    <input
                      type="checkbox"
                      checked={editData[module.id] || false}
                      onChange={() => togglePermission(module.id)}
                      style={{ width: '18px', height: '18px', marginRight: '12px', accentColor: '#4f46e5', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 500, color: '#334155', fontSize: '14px' }}>{module.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button
                type="button"
                onClick={() => { setSelectedRole(null); setEditData(null); }}
                style={{ padding: '10px 20px', color: '#475569', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)' }}
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPermission;
