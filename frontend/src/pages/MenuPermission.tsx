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
    setEditData({
      dashboard: false,
      hostellers: false,
      student_register: false,
      hostel_blocks: false,
      rooms_master: false,
      fees: false,
      gate_logs: false,
      eb_bills: false,
      clearance: false,
      outpass: false,
      late_warnings: false,
      colleges: false,
      fine_master: false,
      mess_deduction: false,
      user_management: false,
      menu_permission: false,
      ...(existing?.permissions || {})
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

  const toggleGroup = (moduleIds: string[]) => {
    const allChecked = moduleIds.every(id => editData[id] === true);
    setEditData((prev: any) => {
      const next = { ...prev };
      moduleIds.forEach(id => {
        next[id] = !allChecked;
      });
      return next;
    });
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader 
        title="Menu Permission"
        subtitle="Configure access control for different roles"
        showBack={true}
        
      />

      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '20px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allowed Modules</th>
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
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(() => {
                            if (!perm?.permissions) return <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>No modules allowed</span>;
                            
                            const moduleMap: any = {
                              dashboard: 'Dashboard', hostellers: 'Hostellers', student_register: 'Student Register',
                              hostel_blocks: 'Hostel Blocks', rooms_master: 'Rooms Directory', fees: 'Fees', gate_logs: 'Gate Logs', eb_bills: 'EB Bills',
                              clearance: 'Clearance', outpass: 'Outpass', late_warnings: 'Late Warnings',
                              colleges: 'College Master', fine_master: 'Fine Master', mess_deduction: 'Mess Deduction', 
                              user_management: 'User Management', menu_permission: 'Menu Config'
                            };

                            const allowed = Object.entries(perm.permissions).filter(([key, val]) => val === true && moduleMap[key]);
                            
                            if (allowed.length === Object.keys(moduleMap).length) {
                              return <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>All Modules Access</span>;
                            }

                            if (allowed.length === 0) {
                              return <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>No modules allowed</span>;
                            }

                            return allowed.map(([key]) => (
                              <span key={key} style={{ background: '#eef2ff', color: '#4f46e5', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                                {moduleMap[key]}
                              </span>
                            ));
                          })()}
                        </div>
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
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingLeft: '8px' }}>
                
                {/* General */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={['dashboard'].every(id => editData[id])} onChange={() => toggleGroup(['dashboard'])} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#0f172a' }}>General</span>
                  </label>
                  <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { id: 'dashboard', label: 'Dashboard' }
                    ].map(module => (
                      <label key={module.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editData[module.id] || false} onChange={() => togglePermission(module.id)} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                        <span style={{ fontWeight: 400, color: '#334155', fontSize: '14px' }}>{module.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Hostellers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={['hostellers', 'student_register', 'gate_logs', 'outpass', 'late_warnings', 'clearance', 'fees'].every(id => editData[id])} onChange={() => toggleGroup(['hostellers', 'student_register', 'gate_logs', 'outpass', 'late_warnings', 'clearance', 'fees'])} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#0f172a' }}>Hostellers</span>
                  </label>
                  <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { id: 'hostellers', label: 'Hostellers' },
                      { id: 'student_register', label: 'Student Register' },
                      { id: 'gate_logs', label: 'Gate Logs' },
                      { id: 'outpass', label: 'Outpasses' },
                      { id: 'late_warnings', label: 'Late Warnings' },
                      { id: 'clearance', label: 'Clearance' },
                      { id: 'fees', label: 'Fees & Payments' },
                    ].map(module => (
                      <label key={module.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editData[module.id] || false} onChange={() => togglePermission(module.id)} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                        <span style={{ fontWeight: 400, color: '#334155', fontSize: '14px' }}>{module.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Rooms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={['hostel_blocks', 'rooms_master', 'eb_bills'].every(id => editData[id])} onChange={() => toggleGroup(['hostel_blocks', 'rooms_master', 'eb_bills'])} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#0f172a' }}>Rooms</span>
                  </label>
                  <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { id: 'hostel_blocks', label: 'Hostel Blocks' },
                      { id: 'rooms_master', label: 'Rooms Master Directory' },
                      { id: 'eb_bills', label: 'Room EB Bill Sharing' }
                    ].map(module => (
                      <label key={module.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editData[module.id] || false} onChange={() => togglePermission(module.id)} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                        <span style={{ fontWeight: 400, color: '#334155', fontSize: '14px' }}>{module.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Administration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={['colleges'].every(id => editData[id])} onChange={() => toggleGroup(['colleges'])} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#0f172a' }}>Administration</span>
                  </label>
                  <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { id: 'colleges', label: 'College Master' }
                    ].map(module => (
                      <label key={module.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editData[module.id] || false} onChange={() => togglePermission(module.id)} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                        <span style={{ fontWeight: 400, color: '#334155', fontSize: '14px' }}>{module.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={['fine_master', 'mess_deduction', 'user_management', 'menu_permission'].every(id => editData[id])} onChange={() => toggleGroup(['fine_master', 'mess_deduction', 'user_management', 'menu_permission'])} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#0f172a' }}>Settings</span>
                  </label>
                  <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { id: 'fine_master', label: 'Fine Master' },
                      { id: 'mess_deduction', label: 'Mess Deduction Master' },
                      { id: 'user_management', label: 'User Management' },
                      { id: 'menu_permission', label: 'Menu Permission' }
                    ].map(module => (
                      <label key={module.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editData[module.id] || false} onChange={() => togglePermission(module.id)} style={{ width: '16px', height: '16px', accentColor: '#0066ff', cursor: 'pointer', margin: 0, marginRight: '8px' }} />
                        <span style={{ fontWeight: 400, color: '#334155', fontSize: '14px' }}>{module.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

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
