import React, { useState, useEffect } from 'react';
import { Building2, Plus, SquarePen, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CollegeAPI } from '../api/college.api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import Select from 'react-select';

const CollegeMaster = () => {
  const [activeTab, setActiveTab] = useState<'college' | 'fine'>('college');
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
  const [fineTargetColleges, setFineTargetColleges] = useState<string[]>(['all']);
  const [fineDueDate, setFineDueDate] = useState<string>('');
  const [rentFine, setRentFine] = useState<number>(0);
  const [messFine, setMessFine] = useState<number>(0);
  const [ebFine, setEbFine] = useState<number>(0);
  const [isRentFineEnabled, setIsRentFineEnabled] = useState(false);
  const [isMessFineEnabled, setIsMessFineEnabled] = useState(false);
  const [isEbFineEnabled, setIsEbFineEnabled] = useState(false);

  const fetchColleges = async () => {
    setLoading(true);
    setError(null);
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
      setError('Failed to load colleges');
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
    const finalRentFine = isRentFineEnabled ? rentFine : 0;
    const finalMessFine = isMessFineEnabled ? messFine : 0;
    const finalEbFine = isEbFineEnabled ? ebFine : 0;

    try {
      if (fineTargetColleges.includes('all')) {
        await CollegeAPI.updateBulk({
          rentFine: finalRentFine, messFine: finalMessFine, ebFine: finalEbFine, dueDate: fineDueDate || null
        });
        toast.success('Bulk fine configuration updated');
      } else {
        await Promise.all(fineTargetColleges.map(id => 
          CollegeAPI.update(id, { 
            rentFine: finalRentFine, messFine: finalMessFine, ebFine: finalEbFine, 
            dueDate: fineDueDate || null 
          })
        ));
        toast.success('Fine configuration updated for selected colleges');
      }
      setIsFineModalOpen(false);
      fetchColleges();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const openFineModal = (college?: any) => {
    if (college) {
      setFineTargetColleges([college.id]);
      setFineDueDate(college.dueDate ? new Date(college.dueDate).toISOString().split('T')[0] : '');
      setRentFine(college.fineMaster?.rentFine || 0);
      setIsRentFineEnabled((college.fineMaster?.rentFine || 0) > 0);
      setMessFine(college.fineMaster?.messFine || 0);
      setIsMessFineEnabled((college.fineMaster?.messFine || 0) > 0);
      setEbFine(college.fineMaster?.ebFine || 0);
      setIsEbFineEnabled((college.fineMaster?.ebFine || 0) > 0);
    } else {
      setFineTargetColleges(['all']);
      setFineDueDate('');
      setRentFine(0); setIsRentFineEnabled(false);
      setMessFine(0); setIsMessFineEnabled(false);
      setEbFine(0); setIsEbFineEnabled(false);
    }
    setIsFineModalOpen(true);
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
          activeTab === 'college' ? (
            <button onClick={openNewCollegeModal} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'linear-gradient(135deg, var(--sidebar-active), #3b5bdb)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              <Plus size={18} /> Add College
            </button>
          ) : (
            <button onClick={() => openFineModal()} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'linear-gradient(135deg, var(--sidebar-active), #3b5bdb)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              <AlertCircle size={18} /> Global Fine Config
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
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fine (Rent/Mess/EB)</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>{error}</td></tr>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#475569' }}>Rent: <span style={{fontWeight: 600}}>₹{c.fineMaster?.rentFine || 0}</span>/d</div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>Mess: <span style={{fontWeight: 600}}>₹{c.fineMaster?.messFine || 0}</span>/d</div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>EB: <span style={{fontWeight: 600}}>₹{c.fineMaster?.ebFine || 0}</span>/d</div>
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
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configured Rule</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fine (Rent/Mess/EB)</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>{error}</td></tr>
            ) : colleges.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No colleges found. Please add colleges in College Master first.</td></tr>
            ) : (
              colleges.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s ease' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>{c.shortName || 'No Code'}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1e40af', fontWeight: 600, background: '#eff6ff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
                      <Calendar size={14} color="#2563eb" /> {c.dueDate ? new Date(c.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </div>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#475569' }}>Rent: <span style={{fontWeight: 600}}>₹{c.fineMaster?.rentFine || 0}</span>/d</div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>Mess: <span style={{fontWeight: 600}}>₹{c.fineMaster?.messFine || 0}</span>/d</div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>EB: <span style={{fontWeight: 600}}>₹{c.fineMaster?.ebFine || 0}</span>/d</div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button onClick={() => openFineModal(c)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'white', color: '#4f46e5', border: '1px solid #e0e7ff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => { e.currentTarget.style.background = '#e0e7ff'; e.currentTarget.style.borderColor = '#c7d2fe'; }} onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e0e7ff'; }}>
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
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
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
          <div style={{ background: 'white', borderRadius: '16px', width: '520px', maxWidth: '90%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #f8fafc, #ffffff)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: '#e0e7ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={18} color="#4f46e5" />
                </div>
                Fine Configuration
              </h3>
            </div>
            
            <form onSubmit={handleFineSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Target College(s)</label>
                <Select 
                  isMulti
                  value={
                    fineTargetColleges.includes('all') 
                      ? [{ value: 'all', label: 'All (Due date & Fine value also same)' }]
                      : fineTargetColleges.map(id => ({ value: id, label: colleges.find(c => c.id === id)?.name || '' }))
                  }
                  onChange={(options: any) => {
                    const vals = options ? options.map((o: any) => o.value) : [];
                    
                    if (vals.includes('all') && !fineTargetColleges.includes('all')) {
                      setFineTargetColleges(['all']);
                      setFineDueDate('');
                      setRentFine(0); setIsRentFineEnabled(false);
                      setMessFine(0); setIsMessFineEnabled(false);
                      setEbFine(0); setIsEbFineEnabled(false);
                      return;
                    }
                    
                    const newVals = vals.filter((v: string) => v !== 'all');
                    if (newVals.length === 0) {
                      setFineTargetColleges(['all']);
                      setFineDueDate('');
                      setRentFine(0); setIsRentFineEnabled(false);
                      setMessFine(0); setIsMessFineEnabled(false);
                      setEbFine(0); setIsEbFineEnabled(false);
                      return;
                    }
                    
                    setFineTargetColleges(newVals);
                    
                    if (newVals.length === 1 && fineTargetColleges.includes('all')) {
                      const college = colleges.find(c => c.id === newVals[0]);
                      if (college) {
                        setFineDueDate(college.dueDate ? new Date(college.dueDate).toISOString().split('T')[0] : '');
                        setRentFine(college.fineMaster?.rentFine || 0);
                        setIsRentFineEnabled((college.fineMaster?.rentFine || 0) > 0);
                        setMessFine(college.fineMaster?.messFine || 0);
                        setIsMessFineEnabled((college.fineMaster?.messFine || 0) > 0);
                        setEbFine(college.fineMaster?.ebFine || 0);
                        setIsEbFineEnabled((college.fineMaster?.ebFine || 0) > 0);
                      }
                    }
                  }}
                  options={[
                    { value: 'all', label: 'All (Due date & Fine value also same)' },
                    ...colleges.map(c => ({ value: c.id, label: c.name }))
                  ]}
                  styles={{
                    control: (base) => ({
                      ...base,
                      border: '2px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '2px',
                      boxShadow: 'none',
                      '&:hover': {
                        borderColor: '#cbd5e1'
                      }
                    })
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Due Date {fineTargetColleges.includes('all') && <span style={{fontSize: '11px', color: '#94a3b8', fontWeight: 400}}>(Applied to all)</span>}</label>
                <input type="date" value={fineDueDate} onChange={e => setFineDueDate(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '14px', fontWeight: 500, transition: 'border-color 0.2s' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: isRentFineEnabled ? '#eff6ff' : '#f8fafc', transition: 'all 0.2s' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={isRentFineEnabled} onChange={(e) => setIsRentFineEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: isRentFineEnabled ? '#1e40af' : '#64748b' }}>Daily Rent Fine</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', width: '140px', background: isRentFineEnabled ? 'white' : '#f1f5f9', opacity: isRentFineEnabled ? 1 : 0.6, boxShadow: isRentFineEnabled ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                    <div style={{ padding: '8px 14px', background: isRentFineEnabled ? '#f8fafc' : '#f1f5f9', borderRight: '1px solid #cbd5e1', color: isRentFineEnabled ? '#475569' : '#94a3b8', fontWeight: 700, fontSize: '14px' }}>₹</div>
                    <input type="number" step="1" value={rentFine} onChange={e => setRentFine(parseFloat(e.target.value) || 0)} disabled={!isRentFineEnabled} placeholder="0" style={{ width: '100%', padding: '8px 12px', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, background: 'transparent', color: isRentFineEnabled ? '#0f172a' : '#94a3b8', textAlign: 'right' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: isMessFineEnabled ? '#eff6ff' : '#f8fafc', transition: 'all 0.2s' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={isMessFineEnabled} onChange={(e) => setIsMessFineEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: isMessFineEnabled ? '#1e40af' : '#64748b' }}>Daily Mess Fine</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', width: '140px', background: isMessFineEnabled ? 'white' : '#f1f5f9', opacity: isMessFineEnabled ? 1 : 0.6, boxShadow: isMessFineEnabled ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                    <div style={{ padding: '8px 14px', background: isMessFineEnabled ? '#f8fafc' : '#f1f5f9', borderRight: '1px solid #cbd5e1', color: isMessFineEnabled ? '#475569' : '#94a3b8', fontWeight: 700, fontSize: '14px' }}>₹</div>
                    <input type="number" step="1" value={messFine} onChange={e => setMessFine(parseFloat(e.target.value) || 0)} disabled={!isMessFineEnabled} placeholder="0" style={{ width: '100%', padding: '8px 12px', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, background: 'transparent', color: isMessFineEnabled ? '#0f172a' : '#94a3b8', textAlign: 'right' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: isEbFineEnabled ? '#eff6ff' : '#f8fafc', transition: 'all 0.2s' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={isEbFineEnabled} onChange={(e) => setIsEbFineEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: isEbFineEnabled ? '#1e40af' : '#64748b' }}>Daily EB Fine</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', width: '140px', background: isEbFineEnabled ? 'white' : '#f1f5f9', opacity: isEbFineEnabled ? 1 : 0.6, boxShadow: isEbFineEnabled ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                    <div style={{ padding: '8px 14px', background: isEbFineEnabled ? '#f8fafc' : '#f1f5f9', borderRight: '1px solid #cbd5e1', color: isEbFineEnabled ? '#475569' : '#94a3b8', fontWeight: 700, fontSize: '14px' }}>₹</div>
                    <input type="number" step="1" value={ebFine} onChange={e => setEbFine(parseFloat(e.target.value) || 0)} disabled={!isEbFineEnabled} placeholder="0" style={{ width: '100%', padding: '8px 12px', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, background: 'transparent', color: isEbFineEnabled ? '#0f172a' : '#94a3b8', textAlign: 'right' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button type="button" onClick={() => setIsFineModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', background: 'white', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--sidebar-active)', border: 'none', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
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
