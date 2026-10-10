import React, { useState, useEffect } from 'react';
import { Plus, SquarePen, CheckCircle, XCircle, X, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { UserAPI } from '../api/user.api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const UserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Pagination & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'ADMIN',
    isActive: true
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await UserAPI.getAll({ page, limit, search: searchQuery });
      setUsers(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, limit, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const payload = { ...formData };
        if (!payload.password) delete (payload as any).password;
        await UserAPI.update(editingId, payload);
        toast.success('User updated successfully');
      } else {
        await UserAPI.create(formData);
        toast.success('User created successfully');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Operation failed');
    }
  };

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      isActive: user.isActive
    });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (user: any) => {
    try {
      await UserAPI.toggleActive(user.id);
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (user: any) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete ${user.name} (${user.email})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await UserAPI.delete(user.id);
        toast.success('User deleted successfully');
        fetchUsers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete user');
      }
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader 
        title="User Management"
        subtitle="Manage administrators and wardens"
        showBack={true}
        
        rightContent={
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ email: '', name: '', password: '', role: 'ADMIN', isActive: true });
              setIsModalOpen(true);
            }}
            style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#4f46e5', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)' }}
          >
            <Plus size={16} /> Add User
          </button>
        }
      />

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search User Name or Email..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            style={{ padding: '8px 30px 8px 15px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', width: '220px', outline: 'none' }}
          />
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setPage(1); }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 0 }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '20px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
                    {error}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                users.filter(u => u.email !== 'developer@gmail.com').map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s ease' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{user.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#334155' }}>{user.email}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ padding: '4px 10px', background: user.role === 'ADMIN' ? '#f3e8ff' : '#e0f2fe', color: user.role === 'ADMIN' ? '#7e22ce' : '#0369a1', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <button
                        onClick={() => handleToggleActive(user)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: user.isActive ? '#d1fae5' : '#fee2e2', color: user.isActive ? '#065f46' : '#991b1b' }}
                      >
                        {user.isActive ? <><CheckCircle size={14} /> Active</> : <><XCircle size={14} /> Inactive</>}
                      </button>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleEdit(user)}
                        title="Edit User"
                        style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#f8fafc', color: '#4f46e5', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s', marginRight: '8px' }}
                      >
                        <SquarePen size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        title="Delete User"
                        style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748b', background: '#f8fafc' }}>
          <div>Showing <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords === 0 ? 0 : (page - 1) * limit + 1}</span> to <span style={{ fontWeight: 600, color: '#1e293b' }}>{Math.min(page * limit, totalRecords)}</span> of <span style={{ fontWeight: 600, color: '#1e293b' }}>{totalRecords}</span> entries</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderRight: 'none', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '6px 0 0 6px', color: page === 1 ? '#94a3b8' : '#64748b', fontSize: '13px', transition: 'all 0.2s' }}
            >
              Previous
            </button>
            <button
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', minWidth: '32px', padding: '0 12px', border: '1px solid #3b82f6', background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: 500, position: 'relative', zIndex: 1, cursor: 'default' }}
            >
              {page}
            </button>
            <button 
              disabled={page >= totalPages || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', padding: '0 12px', border: '1px solid #e2e8f0', borderLeft: 'none', background: 'white', cursor: page >= totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', borderRadius: '0 6px 6px 0', color: page >= totalPages || totalPages === 0 ? '#94a3b8' : '#0369a1', fontSize: '13px', transition: 'all 0.2s' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {editingId ? 'Edit User' : 'Add User'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Password {editingId && <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>(Leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Role *</label>
                <select
                  required
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="WARDEN">Warden</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '10px 20px', color: '#475569', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)' }}
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
