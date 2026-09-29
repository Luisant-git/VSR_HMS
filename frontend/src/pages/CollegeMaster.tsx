import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Calendar, IndianRupee } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CollegeAPI } from '../api/college.api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const CollegeMaster = () => {
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    address: '',
    lastDate: '',
    finePerDay: 50.0
  });

  const fetchColleges = async () => {
    setLoading(true);
    try {
      const data = await CollegeAPI.findAll();
      setColleges(data);
    } catch (err: any) {
      toast.error('Failed to load colleges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColleges();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('College name is required');
      return;
    }

    try {
      if (editingId) {
        await CollegeAPI.update(editingId, formData);
        toast.success('College updated successfully');
      } else {
        await CollegeAPI.create(formData);
        toast.success('College created successfully');
      }
      setIsModalOpen(false);
      fetchColleges();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleEdit = (college: any) => {
    setEditingId(college.id);
    setFormData({
      name: college.name,
      shortName: college.shortName || '',
      address: college.address || '',
      lastDate: college.lastDate || '',
      finePerDay: college.finePerDay || 50.0
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you really want to delete ${name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await CollegeAPI.remove(id);
        toast.success('College deleted successfully');
        fetchColleges();
      } catch (err: any) {
        toast.error('Failed to delete college');
      }
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ name: '', shortName: '', address: '', lastDate: '', finePerDay: 50.0 });
    setIsModalOpen(true);
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader 
        title="College Master" 
        subtitle="Manage affiliated colleges, their fee last dates, and daily fines"
        rightContent={
          <button onClick={openNewModal} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
            <Plus size={18} /> Add College
          </button>
        }
      />

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
              <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>College Name</th>
              <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Short Name</th>
              <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Last Date</th>
              <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Fine / Day</th>
              <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
            ) : colleges.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No colleges found. Click 'Add College' to create one.</td></tr>
            ) : (
              colleges.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #eaedf1', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '15px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{c.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{c.address || 'No address provided'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px', fontSize: '14px', color: '#334155', fontWeight: 500 }}>{c.shortName || '-'}</td>
                  <td style={{ padding: '15px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>
                      <Calendar size={14} color="#0d6efd" /> {c.lastDate ? new Date(c.lastDate).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                      <IndianRupee size={12} /> {c.finePerDay?.toFixed(2) || '0.00'}
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button onClick={() => handleEdit(c)} style={{ padding: '6px', borderRadius: '6px', background: '#e2e8f0', color: '#475569', border: 'none', cursor: 'pointer' }}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(c.id, c.name)} style={{ padding: '6px', borderRadius: '6px', background: '#fee2e2', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '500px', maxWidth: '90%', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #eaedf1', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} color="var(--sidebar-active)" /> {editingId ? 'Edit College' : 'Add New College'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>College Name <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. SRM Institute of Science and Technology" required style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '14px' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Short Name / Code</label>
                  <input type="text" value={formData.shortName} onChange={e => setFormData({...formData, shortName: e.target.value})} placeholder="e.g. SRM IST" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '14px' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Last Date</label>
                    <input type="date" value={formData.lastDate} onChange={e => setFormData({...formData, lastDate: e.target.value})} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '14px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Fine Per Day (₹)</label>
                    <input type="number" step="1" value={formData.finePerDay} onChange={e => setFormData({...formData, finePerDay: parseFloat(e.target.value) || 0})} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '14px' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Address</label>
                  <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="College address details" rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '14px', resize: 'vertical' }}></textarea>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #eaedf1' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', background: 'white', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--sidebar-active)', border: 'none', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {editingId ? 'Update College' : 'Save College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeMaster;
