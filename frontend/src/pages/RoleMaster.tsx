import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  SquarePen,
  CheckCircle,
  XCircle,
  Trash2,
  KeyRound,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { PageHeader } from '../components/PageHeader';
import { LoadingRow } from '../components/LoadingSpinner';
import { RoleAPI, type RoleItem } from '../api/role.api';

const toRoleCode = (value: string) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const RoleMaster = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    label: '',
    name: '',
    description: '',
    isActive: true,
  });

  const isDeveloper = useMemo(() => {
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      if (!token) return false;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.role === 'DEVELOPER';
    } catch {
      return false;
    }
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await RoleAPI.getAll();
      setRoles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q),
    );
  }, [roles, searchQuery]);

  const openCreateModal = () => {
    setEditingRole(null);
    setCodeManuallyEdited(false);
    setFormData({
      label: '',
      name: '',
      description: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (role: RoleItem) => {
    setEditingRole(role);
    setCodeManuallyEdited(true);
    setFormData({
      label: role.label,
      name: role.name,
      description: role.description || '',
      isActive: role.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingRole) {
        await RoleAPI.update(editingRole.id, {
          label: formData.label,
          ...(editingRole.name === 'DEVELOPER' ? {} : { name: formData.name }),
          description: formData.description,
          isActive: formData.isActive,
        });
        toast.success('Role updated successfully');
      } else {
        await RoleAPI.create({
          label: formData.label,
          name: formData.name || toRoleCode(formData.label),
          description: formData.description,
          isActive: formData.isActive,
        });
        toast.success('Role created successfully');
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (err: any) {
      toast.error(err?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (role: RoleItem) => {
    try {
      await RoleAPI.toggleActive(role.id);
      toast.success(`Role ${role.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchRoles();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update role status');
    }
  };

  const handleDelete = async (role: RoleItem) => {
    const result = await Swal.fire({
      title: 'Delete Role?',
      text: `Do you want to delete "${role.label}" (${role.name})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      try {
        await RoleAPI.delete(role.id);
        toast.success('Role deleted successfully');
        fetchRoles();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to delete role');
      }
    }
  };

  if (!isDeveloper) {
    return (
      <div className="ui-page">
        <div
          className="ui-card"
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            maxWidth: '480px',
            margin: '40px auto',
          }}
        >
          <ShieldAlert size={40} color="#ef4444" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
            Developer Access Only
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Role Master is restricted to users signed in with the Developer role.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Role Master"
        subtitle="Create and manage user roles for User Management and Menu Permissions"
        showBack={true}
        icon={<KeyRound size={24} color="#fff" />}
        iconBg="linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)"
        rightContent={
          <button onClick={openCreateModal} className="ui-btn ui-btn-primary">
            <Plus size={18} /> Add Role
          </button>
        }
      />

      <div className="ui-toolbar">
        <div className="ui-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search role code, name, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
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
              <th>Role Name</th>
              <th>Role Code</th>
              <th>Description</th>
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
            ) : filteredRoles.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="ui-empty">
                    <KeyRound size={36} />
                    <div className="ui-empty-title">No roles found</div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <div className="um-user">
                      <div className="ui-avatar">{role.label.charAt(0).toUpperCase()}</div>
                      <span className="ui-cell-title">{role.label}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`ui-badge ${role.name === 'ADMIN' ? 'ui-badge-purple' : 'ui-badge-info'}`}>
                      {role.name}
                    </span>
                  </td>
                  <td>{role.description || '—'}</td>
                  <td>
                    <button
                      onClick={() => role.name !== 'DEVELOPER' && handleToggleActive(role)}
                      disabled={role.name === 'DEVELOPER'}
                      className="ui-status-toggle"
                      title={
                        role.name === 'DEVELOPER'
                          ? 'Developer role is always active'
                          : role.isActive
                            ? 'Click to deactivate'
                            : 'Click to activate'
                      }
                    >
                      <span className={`ui-badge ${role.isActive ? 'ui-badge-success' : 'ui-badge-danger'}`}>
                        {role.isActive ? (
                          <><CheckCircle size={14} /> Active</>
                        ) : (
                          <><XCircle size={14} /> Inactive</>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="is-right">
                    <div className="um-actions">
                      <button
                        onClick={() => openEditModal(role)}
                        title="Edit Role"
                        className="ui-btn ui-btn-icon"
                      >
                        <SquarePen size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(role)}
                        title="Delete Role"
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
      </div>

      {isModalOpen && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal-sm">
            <div className="ui-modal-head">
              <h2 className="ui-modal-title">
                {editingRole ? 'Edit Role' : 'Add Role'}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="ui-modal-body">
                <div className="ui-form-group">
                  <label className="ui-form-label">Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Accountant"
                    value={formData.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        label,
                        name:
                          !editingRole && !codeManuallyEdited
                            ? toRoleCode(label)
                            : prev.name,
                      }));
                    }}
                    className="ui-form-control"
                  />
                </div>
                <div className="ui-form-group">
                  <label className="ui-form-label">
                    Role Code *{' '}
                    {editingRole?.name === 'DEVELOPER' && (
                      <span className="um-hint">(Developer role code is locked)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingRole?.name === 'DEVELOPER'}
                    placeholder="e.g. ACCOUNTANT"
                    value={formData.name}
                    onChange={(e) => {
                      setCodeManuallyEdited(true);
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
                      }));
                    }}
                    className="ui-form-control"
                  />
                </div>
                <div className="ui-form-group">
                  <label className="ui-form-label">Description</label>
                  <input
                    type="text"
                    placeholder="Optional description of role responsibilities"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="ui-form-control"
                  />
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
                  disabled={submitting}
                  className="ui-btn ui-btn-primary"
                >
                  {submitting ? 'Saving...' : editingRole ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleMaster;
