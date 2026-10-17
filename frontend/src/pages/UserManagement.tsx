import React, { useState, useEffect } from 'react';
import { Plus, SquarePen, CheckCircle, XCircle, X, Trash2, Users, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingRow } from '../components/LoadingSpinner';
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
    <div className="ui-page">
      <PageHeader 
        title="User Management"
        subtitle="Manage administrators and wardens"
        showBack={true}
        icon={<Users size={24} color="#fff" />} iconBg="linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
        
        rightContent={
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ email: '', name: '', password: '', role: 'ADMIN', isActive: true });
              setIsModalOpen(true);
            }}
            className="ui-btn ui-btn-primary"
          >
            <Plus size={16} /> Add User
          </button>
        }
      />

      <div className="ui-toolbar">
        <div className="ui-search">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Search User Name or Email..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setPage(1); }}
              className="ui-search-clear"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th className="is-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow colSpan={5} />
            ) : error ? (
              <tr>
                <td colSpan={5}>
                  <div className="ui-empty ui-empty-danger">{error}</div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="ui-empty">
                    <Users size={36} />
                    <div className="ui-empty-title">No users found</div>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="um-user">
                      <div className="ui-avatar">{user.name.charAt(0).toUpperCase()}</div>
                      <span className="ui-cell-title">{user.name}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`ui-badge ${user.role === 'ADMIN' ? 'ui-badge-purple' : 'ui-badge-info'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleActive(user)}
                      className="ui-status-toggle"
                    >
                      <span className={`ui-badge ${user.isActive ? 'ui-badge-success' : 'ui-badge-danger'}`}>
                        {user.isActive ? <><CheckCircle size={14} /> Active</> : <><XCircle size={14} /> Inactive</>}
                      </span>
                    </button>
                  </td>
                  <td className="is-right">
                    <div className="um-actions">
                      <button
                        onClick={() => handleEdit(user)}
                        title="Edit User"
                        className="ui-btn ui-btn-icon"
                      >
                        <SquarePen size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        title="Delete User"
                        className="ui-btn ui-btn-icon ui-btn-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div className="ui-pagination">
          <div className="ui-page-info">Showing <span className="um-strong">{totalRecords === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="um-strong">{Math.min(page * limit, totalRecords)}</span> of <span className="um-strong">{totalRecords}</span> entries</div>
          <div className="ui-page-controls">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="ui-page-btn"
            >
              Previous
            </button>
            <button
              className="ui-page-btn is-current"
            >
              {page}
            </button>
            <button 
              disabled={page >= totalPages || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
              className="ui-page-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal-sm">
            <div className="ui-modal-head">
              <h2 className="ui-modal-title">
                {editingId ? 'Edit User' : 'Add User'}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="ui-modal-body">
                <div className="ui-form-group">
                  <label className="ui-form-label">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="ui-form-control"
                  />
                </div>
                <div className="ui-form-group">
                  <label className="ui-form-label">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="ui-form-control"
                  />
                </div>
                <div className="ui-form-group">
                  <label className="ui-form-label">
                    Password {editingId && <span className="um-hint">(Leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingId}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="ui-form-control"
                  />
                </div>
                <div className="ui-form-group">
                  <label className="ui-form-label">Role *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="ui-select"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="WARDEN">Warden</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="CANTEEN_MANAGER">Canteen Manager</option>
                  </select>
                </div>
              </div>

              <div className="ui-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn-primary"
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
