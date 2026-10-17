import React, { useState, useEffect } from 'react';
import { Building2, SquarePen, Trash2, AlertCircle, X, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CollegeAPI } from '../api/college.api';
import { rowBadgeVariant } from '../utils/badge';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import Select from 'react-select';

const fineSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '40px',
    borderRadius: 'var(--radius)',
    borderColor: state.isFocused ? 'var(--accent)' : 'var(--border-strong)',
    boxShadow: state.isFocused ? '0 0 0 3px var(--accent-soft)' : 'none',
    fontSize: '13px',
    cursor: 'pointer',
    background: 'var(--surface)'
  }),
  valueContainer: (base: any) => ({ ...base, padding: '0 4px' }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: '13px',
    backgroundColor: state.isSelected ? 'var(--accent)' : state.isFocused ? 'var(--surface-sunken)' : 'white',
    color: state.isSelected ? 'white' : '#334155',
    cursor: 'pointer'
  })
};

const FineMaster = () => {
  const [activeTab] = useState<'fine' | 'college'>('fine');
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ruleFilter, setRuleFilter] = useState<'All' | 'set' | 'not-set'>('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
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
        fromDate,
        toDate,
        ruleStatus: ruleFilter === 'All' ? undefined : ruleFilter
      });
      const data = Array.isArray(response) ? response : (response.data || []);
      setColleges(data);
      setTotalPages(response.totalPages || 1);
      setTotalRecords(response.total || data.length);
    } catch (err: any) {
      setError('Failed to load colleges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColleges();
  }, [page, searchQuery, fromDate, toDate, ruleFilter]);

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

  return (
    <div className="ui-page">
      <PageHeader 
        title="Fine Master" 
        subtitle="Configure daily fine settings for colleges"
        icon={<AlertCircle size={24} color="#fff" />} iconBg="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
        rightContent={
          <button onClick={() => openFineModal()} className="ui-btn ui-btn-primary">
            <AlertCircle size={18} /> Global Fine Config
          </button>
        }
      />

      <div className="ui-toolbar">
        <div className="ui-search">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Search College Name or Code..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="ui-input"
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
        <div className="ui-toolbar-group">
          <span className="ui-toolbar-label">Due From:</span>
          <input 
            type="date" 
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="ui-input fm-date"
          />
        </div>
        <div className="ui-toolbar-group">
          <span className="ui-toolbar-label">Due To:</span>
          <input 
            type="date" 
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="ui-input fm-date"
          />
        </div>
        <div className="ui-toolbar-group">
          <span className="ui-toolbar-label">Rule:</span>
          <select
            value={ruleFilter}
            onChange={(e) => { setRuleFilter(e.target.value as typeof ruleFilter); setPage(1); }}
            className="ui-select fm-rule-filter"
            title="Filter colleges by whether a fine rule is configured"
          >
            <option value="All">All Rules</option>
            <option value="set">Rule Configured</option>
            <option value="not-set">Rule Not Configured</option>
          </select>
        </div>
        {(searchQuery || fromDate || toDate || ruleFilter !== 'All') && (
          <button 
            onClick={() => { setSearchQuery(''); setFromDate(''); setToDate(''); setRuleFilter('All'); setPage(1); }}
            className="ui-btn ui-btn-soft ui-btn-sm">
            Clear Filters
          </button>
        )}
      </div>

      <div className="ui-table-wrap">
        {activeTab === 'college' ? (
          <table className="ui-table">
            <thead>
            <tr>
              <th className="fm-sno">S.No</th>
              <th>College Name</th>
              <th>Short Name</th>
              <th>Due Date</th>
              <th>Fine (Rent/Mess/EB)</th>
              <th className="is-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="ui-table-state">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={6}><div className="ui-empty ui-empty-danger">{error}</div></td></tr>
            ) : colleges.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="ui-empty">
                  <Building2 size={36} />
                  <div className="ui-empty-title">No colleges found</div>
                  <div className="ui-empty-text">Click &lsquo;Add College&rsquo; to create one.</div>
                </div>
              </td></tr>
            ) : (
              colleges.map((c, idx) => (
                <tr key={c.id}>
                  <td className="fm-sno">{(page - 1) * limit + idx + 1}</td>
                  <td>
                    <div className="ui-cell-title">{c.name}</div>
                    <div className="ui-cell-sub">{c.address || 'No address provided'}</div>
                  </td>
                  <td>
                    {c.shortName ? (
                      <span className={`ui-badge ${rowBadgeVariant((page - 1) * limit + idx)}`}>{c.shortName}</span>
                    ) : (
                      <span className="ui-cell-muted">-</span>
                    )}
                  </td>
                  <td>
                    <span className="fm-date-text">
                      {c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </span>
                  </td>
                  <td>
                    <div className="fm-fine-list">
                      <div className="fm-fine-row">Rent: <strong>₹{c.fineMaster?.rentFine || 0}</strong>/d</div>
                      <div className="fm-fine-row">Mess: <strong>₹{c.fineMaster?.messFine || 0}</strong>/d</div>
                      <div className="fm-fine-row">EB: <strong>₹{c.fineMaster?.ebFine || 0}</strong>/d</div>
                    </div>
                  </td>
                  <td className="is-right">
                    <div className="fm-actions">
                      <button onClick={() => handleCollegeEdit(c)} title="Edit College" className="ui-btn ui-btn-icon is-primary"><SquarePen size={15} /></button>
                      <button onClick={() => handleDelete(c.id, c.name)} title="Delete College" className="ui-btn ui-btn-icon ui-btn-danger"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        ) : (
        <table className="ui-table">
          <thead>
            <tr>
              <th className="fm-sno">S.No</th>
              <th>College Name</th>
              <th>Short Name</th>
              <th>Due Date</th>
              <th>Configured Rule</th>
              <th>Fine (Rent/Mess/EB)</th>
              <th className="is-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="ui-table-state">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={7}><div className="ui-empty ui-empty-danger">{error}</div></td></tr>
            ) : colleges.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="ui-empty">
                  <Building2 size={36} />
                  <div className="ui-empty-title">No colleges found</div>
                  <div className="ui-empty-text">Please add colleges in College Master first.</div>
                </div>
              </td></tr>
            ) : (
              colleges.map((c, idx) => (
                <tr key={c.id}>
                  <td className="fm-sno">{(page - 1) * limit + idx + 1}</td>
                  <td>
                    <div className="ui-cell-title">{c.name}</div>
                  </td>
                  <td>
                    {c.shortName ? (
                      <span className={`ui-badge ${rowBadgeVariant((page - 1) * limit + idx)}`}>{c.shortName}</span>
                    ) : (
                      <span className="ui-cell-muted">-</span>
                    )}
                  </td>
                  <td>
                    <span className="fm-date-text">
                      {c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </span>
                  </td>
                  <td>
                    {c.fineMaster ? (
                      <span className="ui-badge ui-badge-success">Active</span>
                    ) : (
                      <span className="ui-badge ui-badge-danger">Not Set</span>
                    )}
                  </td>
                  <td>
                    <div className="fm-fine-list">
                      <div className="fm-fine-row">Rent: <strong>₹{c.fineMaster?.rentFine || 0}</strong>/d</div>
                      <div className="fm-fine-row">Mess: <strong>₹{c.fineMaster?.messFine || 0}</strong>/d</div>
                      <div className="fm-fine-row">EB: <strong>₹{c.fineMaster?.ebFine || 0}</strong>/d</div>
                    </div>
                  </td>
                  <td className="is-right">
                    <button onClick={() => openFineModal(c)} className="ui-btn ui-btn-outline-primary ui-btn-sm">
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
        <div className="ui-pagination">
          <div className="ui-page-info">Showing <span className="fm-strong">{totalRecords === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="fm-strong">{Math.min(page * limit, totalRecords)}</span> of <span className="fm-strong">{totalRecords}</span> entries</div>
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

      {isCollegeModalOpen && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal-sm">
            <div className="ui-modal-head">
              <h3 className="fm-modal-title">
                <span className="fm-modal-icon"><Building2 size={18} /></span>
                {editingCollegeId ? 'Edit College Details' : 'Add New College'}
              </h3>
            </div>
            
            <form onSubmit={handleCollegeSubmit}>
              <div className="ui-modal-body">
                <div className="ui-form-group">
                  <label className="ui-form-label">College Name <span className="fm-req">*</span></label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. SRM Institute of Science and Technology" required className="ui-form-control" />
                </div>
                
                <div className="ui-form-row">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Short Name / Code</label>
                    <input type="text" value={formData.shortName} onChange={e => setFormData({...formData, shortName: e.target.value})} placeholder="e.g. SRM IST" className="ui-form-control" />
                  </div>
                  <div className="ui-form-group">
                    <label className="ui-form-label">Due Date <span className="fm-req">*</span></label>
                    <input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} required className="ui-form-control" />
                  </div>
                </div>

                <div className="ui-form-group">
                  <label className="ui-form-label">Address</label>
                  <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full campus address" rows={3} className="ui-form-control"></textarea>
                </div>
              </div>

              <div className="ui-modal-footer">
                <button type="button" onClick={() => setIsCollegeModalOpen(false)} className="ui-btn ui-btn-secondary">Cancel</button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  {editingCollegeId ? 'Save Changes' : 'Create College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fine Master Modal */}
      {isFineModalOpen && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal-sm">
            <div className="ui-modal-head">
              <h3 className="fm-modal-title">
                <span className="fm-modal-icon"><AlertCircle size={18} /></span>
                Fine Configuration
              </h3>
            </div>
            
            <form onSubmit={handleFineSubmit}>
              <div className="ui-modal-body">
                <div className="ui-form-group">
                  <label className="ui-form-label">Target College(s)</label>
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
                    styles={fineSelectStyles}
                  />
                </div>

                <div className="ui-form-group">
                  <label className="ui-form-label">Due Date {fineTargetColleges.includes('all') && <span className="fm-optional">(Applied to all)</span>}</label>
                  <input type="date" value={fineDueDate} onChange={e => setFineDueDate(e.target.value)} className="ui-form-control" />
                </div>

                <div className="fm-fine-toggles">
                  <div className={`fm-toggle-row ${isRentFineEnabled ? 'is-on' : ''}`}>
                    <label className="fm-fine-check">
                      <input type="checkbox" checked={isRentFineEnabled} onChange={(e) => setIsRentFineEnabled(e.target.checked)} />
                      <span className="fm-fine-name">Daily Rent Fine</span>
                    </label>
                    <div className="fm-fine-amount">
                      <div className="fm-fine-currency">₹</div>
                      <input type="number" step="1" value={rentFine} onChange={e => setRentFine(parseFloat(e.target.value) || 0)} disabled={!isRentFineEnabled} placeholder="0" />
                    </div>
                  </div>
                  <div className={`fm-toggle-row ${isMessFineEnabled ? 'is-on' : ''}`}>
                    <label className="fm-fine-check">
                      <input type="checkbox" checked={isMessFineEnabled} onChange={(e) => setIsMessFineEnabled(e.target.checked)} />
                      <span className="fm-fine-name">Daily Mess Fine</span>
                    </label>
                    <div className="fm-fine-amount">
                      <div className="fm-fine-currency">₹</div>
                      <input type="number" step="1" value={messFine} onChange={e => setMessFine(parseFloat(e.target.value) || 0)} disabled={!isMessFineEnabled} placeholder="0" />
                    </div>
                  </div>
                  <div className={`fm-toggle-row ${isEbFineEnabled ? 'is-on' : ''}`}>
                    <label className="fm-fine-check">
                      <input type="checkbox" checked={isEbFineEnabled} onChange={(e) => setIsEbFineEnabled(e.target.checked)} />
                      <span className="fm-fine-name">Daily EB Fine</span>
                    </label>
                    <div className="fm-fine-amount">
                      <div className="fm-fine-currency">₹</div>
                      <input type="number" step="1" value={ebFine} onChange={e => setEbFine(parseFloat(e.target.value) || 0)} disabled={!isEbFineEnabled} placeholder="0" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="ui-modal-footer">
                <button type="button" onClick={() => setIsFineModalOpen(false)} className="ui-btn ui-btn-secondary">Cancel</button>
                <button type="submit" className="ui-btn ui-btn-primary">
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

export default FineMaster;
