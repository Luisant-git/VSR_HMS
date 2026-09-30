import React, { useState, useEffect } from 'react';
import { Building2, Plus, SquarePen, Trash2, Calendar, IndianRupee, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CollegeAPI } from '../api/college.api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const CollegeMaster = () => {
  const [activeTab, setActiveTab] = useState<'college' | 'fine'>('college');
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;
  
  // College Modal State
  const [isCollegeModalOpen, setIsCollegeModalOpen] = useState(false);
  const [editingCollegeId, setEditingCollegeId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    address: '',
    dueDate: ''
  });

  // Fine Modal State
  const [isFineModalOpen, setIsFineModalOpen] = useState(false);
  const [editingFineId, setEditingFineId] = useState<string | null>(null);
  const [editingFineName, setEditingFineName] = useState<string>('');
  const [finePerDay, setFinePerDay] = useState<number>(0);

  const fetchColleges = async () => {
    setLoading(true);
    try {
      const response = await CollegeAPI.findAll({
        page,
        limit,
        search: searchQuery,
        dueDate: dateFilter
      });
      setColleges(response.data);
      setTotalPages(response.totalPages || 1);
    } catch (err: any) {
      toast.error('Failed to load colleges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColleges();
  }, [page, searchQuery, dateFilter]);

  const handleCollegeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('College name is required');
      return;
    }

    try {
      if (editingCollegeId) {
        await CollegeAPI.update(editingCollegeId, formData);
        toast.success('College updated successfully');
      } else {
        await CollegeAPI.create(formData);
        toast.success('College created successfully');
      }
      setIsCollegeModalOpen(false);
      fetchColleges();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleFineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFineId) return;

    try {
      await CollegeAPI.update(editingFineId, { finePerDay });
      toast.success('Fine rule updated successfully');
      setIsFineModalOpen(false);
      fetchColleges();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleCollegeEdit = (college: any) => {
    setEditingCollegeId(college.id);
    setFormData({
      name: college.name,
      shortName: college.shortName || '',
      address: college.address || '',
      dueDate: college.dueDate ? college.dueDate.split('T')[0] : ''
    });
    setIsCollegeModalOpen(true);
  };

  const handleFineEdit = (college: any) => {
    setEditingFineId(college.id);
    setEditingFineName(college.name);
    setFinePerDay(college.fineMaster?.finePerDay || 0);
    setIsFineModalOpen(true);
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

  const openNewCollegeModal = () => {
    setEditingCollegeId(null);
    setFormData({ name: '', shortName: '', address: '', dueDate: '' });
    setIsCollegeModalOpen(true);
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader 
        title="College & Fine Masters" 
        subtitle="Manage affiliated colleges and their respective late fee policies in one place"
        rightContent={
          activeTab === 'college' && (
            <button onClick={openNewCollegeModal} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'linear-gradient(135deg, var(--sidebar-active), #3b5bdb)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              <Plus size={18} /> Add College
            </button>
          )
        }
      />

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={() => { setActiveTab('college'); setPage(1); }}
            style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: activeTab === 'college' ? 'var(--sidebar-active)' : 'white', color: activeTab === 'college' ? 'white' : '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: activeTab === 'college' ? '0 4px 12px rgba(79, 70, 229, 0.2)' : '0 2px 5px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
            College Master
          </button>
          <button 
            onClick={() => { setActiveTab('fine'); setPage(1); }}
            style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: activeTab === 'fine' ? 'var(--sidebar-active)' : 'white', color: activeTab === 'fine' ? 'white' : '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: activeTab === 'fine' ? '0 4px 12px rgba(79, 70, 229, 0.2)' : '0 2px 5px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
            Fine Master
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Search College Name or Code..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', minWidth: '250px' }}
          />
          {activeTab === 'college' && (
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px' }}
            />
          )}
          {(searchQuery || dateFilter) && (
            <button 
              onClick={() => { setSearchQuery(''); setDateFilter(''); setPage(1); }}
              style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {activeTab === 'college' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
            <tr style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>College Name</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Short Name</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fine / Day</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
            ) : colleges.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No colleges found. Click 'Add College' to create one.</td></tr>
            ) : (
              colleges.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s ease' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}>
                        <Building2 size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>{c.name}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{c.address || 'No address provided'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {c.shortName ? (
                      <span style={{ padding: '4px 10px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #e2e8f0' }}>{c.shortName}</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1e40af', fontWeight: 600, background: '#eff6ff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
                      <Calendar size={14} color="#2563eb" /> {c.dueDate ? new Date(c.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                      <IndianRupee size={12} /> {c.fineMaster?.finePerDay?.toFixed(2) || '0.00'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button onClick={() => handleCollegeEdit(c)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.background = '#e0e7ff'; e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.borderColor = '#c7d2fe'; }} onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#e2e8f0'; }}><SquarePen size={15} /></button>
                      <button onClick={() => handleDelete(c.id, c.name)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.background = '#fee2e2'; }} onMouseOut={e => { e.currentTarget.style.background = '#fef2f2'; }}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>College Name</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configured Rule</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fine Amount (Per Day)</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
            ) : colleges.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No colleges found. Please add colleges in College Master first.</td></tr>
            ) : (
              colleges.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s ease' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>{c.shortName || 'No Code'}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {c.fineMaster ? (
                       <span style={{ padding: '6px 12px', background: '#ecfdf5', color: '#059669', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #a7f3d0' }}>
                         <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }}></div> Active
                       </span>
                    ) : (
                       <span style={{ padding: '6px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #fecaca' }}>
                         <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }}></div> Not Set
                       </span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#b91c1c', fontWeight: 700, background: '#fef2f2', padding: '6px 12px', borderRadius: '8px' }}>
                      <IndianRupee size={14} strokeWidth={2.5} /> {c.fineMaster?.finePerDay?.toFixed(2) || '0.00'} <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>/ day</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button onClick={() => handleFineEdit(c)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'white', color: '#4f46e5', border: '1px solid #e0e7ff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => { e.currentTarget.style.background = '#e0e7ff'; e.currentTarget.style.borderColor = '#c7d2fe'; }} onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e0e7ff'; }}>
                      <SquarePen size={14} /> Configure
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              Showing Page {page} of {totalPages}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === 1 ? '#f1f5f9' : 'white', color: page === 1 ? '#94a3b8' : '#334155', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === totalPages ? '#f1f5f9' : 'white', color: page === totalPages ? '#94a3b8' : '#334155', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isCollegeModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '520px', maxWidth: '90%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #f8fafc, #ffffff)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: '#e0e7ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={18} color="#4f46e5" />
                </div>
                {editingCollegeId ? 'Edit College Details' : 'Add New College'}
              </h3>
            </div>
            
            <form onSubmit={handleCollegeSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>College Name <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. SRM Institute of Science and Technology" required style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '14px', fontWeight: 500, transition: 'border-color 0.2s' }} onFocus={e => e.currentTarget.style.borderColor = '#4f46e5'} onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Short Name / Code</label>
                    <input type="text" value={formData.shortName} onChange={e => setFormData({...formData, shortName: e.target.value})} placeholder="e.g. SRM IST" style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '14px', fontWeight: 500, transition: 'border-color 0.2s' }} onFocus={e => e.currentTarget.style.borderColor = '#4f46e5'} onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Due Date <span style={{color: '#ef4444'}}>*</span></label>
                    <input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} required style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '14px', fontWeight: 500, transition: 'border-color 0.2s' }} onFocus={e => e.currentTarget.style.borderColor = '#4f46e5'} onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Address</label>
                  <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full campus address" rows={3} style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '14px', resize: 'vertical', fontWeight: 500, transition: 'border-color 0.2s' }} onFocus={e => e.currentTarget.style.borderColor = '#4f46e5'} onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}></textarea>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button type="button" onClick={() => setIsCollegeModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', background: 'white', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = 'white'}>Cancel</button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--sidebar-active)', border: 'none', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                  {editingCollegeId ? 'Save Changes' : 'Create College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fine Master Modal */}
      {isFineModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '420px', maxWidth: '90%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #f8fafc, #ffffff)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: '#e0e7ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={18} color="#4f46e5" />
                </div>
                Fine Configuration
              </h3>
            </div>
            
            <form onSubmit={handleFineSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>Target College</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{editingFineName}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Daily Fine Amount</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                    <IndianRupee size={16} />
                  </div>
                  <input 
                    type="number" 
                    step="1" 
                    value={finePerDay} 
                    onChange={e => setFinePerDay(parseFloat(e.target.value) || 0)} 
                    required 
                    style={{ width: '100%', padding: '12px 12px 12px 36px', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a', transition: 'border-color 0.2s' }} 
                    onFocus={e => e.currentTarget.style.borderColor = '#4f46e5'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  />
                  <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>per day</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button type="button" onClick={() => setIsFineModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', background: 'white', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = 'white'}>Cancel</button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--sidebar-active)', border: 'none', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                  Save Configuration
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
