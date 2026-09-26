import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IndianRupee, Search, Filter, FileText, Download, Wallet, Plus, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';

const Fees = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');

  const studentOptions = [
    { value: 'ALL', label: '-- All Students --' },
    { value: 'HST-2026-001', label: 'Aarav Sharma (HST-2026-001)' },
    { value: 'HST-2026-004', label: 'Ananya Iyer (HST-2026-004)' },
    { value: 'HST-2026-008', label: 'Arunkarthick (HST-2026-008)' },
    { value: 'HST-2026-009', label: 'Baskar (HST-2026-009)' },
    { value: 'HST-2026-002', label: 'Kavya Patel (HST-2026-002)' },
    { value: 'HST-2026-006', label: 'Meera Nair (HST-2026-006)' },
    { value: 'HST-2026-003', label: 'Rohan Verma (HST-2026-003)' },
    { value: 'HST-2026-005', label: 'Vikramaditya Rao (HST-2026-005)' }
  ];

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base, padding: '2px', borderRadius: '8px', borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1', boxShadow: 'none', '&:hover': { borderColor: 'var(--sidebar-active)' }, fontSize: '13px', cursor: 'pointer', minWidth: '220px'
    }),
    option: (base: any, state: any) => ({
      ...base, fontSize: '13px', backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white', color: state.isSelected ? 'white' : '#334155', cursor: 'pointer', padding: '10px 14px'
    })
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Fees Paid / Unpaid"
        subtitle="Track hostel rent, mess bills, pending dues, and issue payment receipts"
        rightContent={
          <>
            <button style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'white', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <FileSpreadsheet size={16} color="#64748b" /> All Receipts
            </button>
            <button style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
              <Plus size={16} /> Bulk Generate Invoices
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '25px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#e0e7ff', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Total Invoiced</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)' }}>₹253,900.00</div>
          </div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#e6f4ea', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#188038' }}>
            <IndianRupee size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Total Fees Collected</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)' }}>₹41,500.00</div>
          </div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#fce8e6', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d93025' }}>
            <IndianRupee size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Pending Unpaid Fees</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)' }}>₹208,400.00</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>Hostel Fee Invoices</h3>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              {['ALL', 'UNPAID', 'PAID', 'PARTIAL'].map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', background: filter === f ? 'var(--sidebar-active)' : 'transparent', color: filter === f ? 'white' : '#64748b', boxShadow: filter === f ? '0 2px 6px rgba(74, 114, 250, 0.3)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {f === 'ALL' ? 'All Invoices' : f === 'UNPAID' ? 'Unpaid Only' : f === 'PAID' ? 'Paid Only' : 'Partially Paid'}
                </button>
              ))}
            </div>
            
            <Select options={studentOptions} defaultValue={studentOptions[0]} styles={selectStyles} isSearchable={true} />
            
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Search Invoice..." style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '200px' }} />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 12px' }}>Invoice #</th>
                <th style={{ padding: '16px 12px' }}>Student & Room</th>
                <th style={{ padding: '16px 12px' }}>Fee Type</th>
                <th style={{ padding: '16px 12px' }}>Period</th>
                <th style={{ padding: '16px 12px' }}>Amount</th>
                <th style={{ padding: '16px 12px' }}>Due Date</th>
                <th style={{ padding: '16px 12px' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '16px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px 12px' }}>
                  <a href="#" style={{ color: '#0d6efd', fontWeight: 700, textDecoration: 'none' }}>INV-MSS-202612-HST2026009-26</a>
                </td>
                <td style={{ padding: '16px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>Baskar</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>HST-2026-009 | Room 104</div>
                </td>
                <td style={{ padding: '16px 12px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>Mess Fee</span></td>
                <td style={{ padding: '16px 12px', color: '#334155' }}>2026-12</td>
                <td style={{ padding: '16px 12px', fontWeight: 700, color: '#0f172a' }}>₹3,500.00</td>
                <td style={{ padding: '16px 12px', color: '#475569' }}>10 Dec 2026</td>
                <td style={{ padding: '16px 12px' }}><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#e11d48', color: 'white', fontWeight: 600, fontSize: '12px' }}>Unpaid</span></td>
                <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                  <button style={{ padding: '6px 14px', fontSize: '13px', background: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Wallet size={14} /> Collect Payment
                  </button>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px 12px' }}>
                  <a href="#" style={{ color: '#0d6efd', fontWeight: 700, textDecoration: 'none' }}>INV-RNT-202612-HST2026008-68</a>
                </td>
                <td style={{ padding: '16px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>Arunkarthick</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>HST-2026-008 | Room 104</div>
                </td>
                <td style={{ padding: '16px 12px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>Room Rent</span></td>
                <td style={{ padding: '16px 12px', color: '#334155' }}>2026-12</td>
                <td style={{ padding: '16px 12px', fontWeight: 700, color: '#0f172a' }}>₹3,800.00</td>
                <td style={{ padding: '16px 12px', color: '#475569' }}>10 Dec 2026</td>
                <td style={{ padding: '16px 12px' }}><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#198754', color: 'white', fontWeight: 600, fontSize: '12px' }}>Paid</span></td>
                <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                  <button style={{ padding: '6px 14px', fontSize: '13px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} color="#64748b" /> View Receipt
                  </button>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px 12px' }}>
                  <a href="#" style={{ color: '#0d6efd', fontWeight: 700, textDecoration: 'none' }}>INV-RNT-202612-HST2026006-48</a>
                </td>
                <td style={{ padding: '16px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>Meera Nair</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>HST-2026-006 | Room 102</div>
                </td>
                <td style={{ padding: '16px 12px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>Room Rent</span></td>
                <td style={{ padding: '16px 12px', color: '#334155' }}>2026-12</td>
                <td style={{ padding: '16px 12px', fontWeight: 700, color: '#0f172a' }}>₹4,200.00</td>
                <td style={{ padding: '16px 12px', color: '#475569' }}>10 Dec 2026</td>
                <td style={{ padding: '16px 12px' }}><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#e11d48', color: 'white', fontWeight: 600, fontSize: '12px' }}>Unpaid</span></td>
                <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                  <button style={{ padding: '6px 14px', fontSize: '13px', background: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Wallet size={14} /> Collect Payment
                  </button>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px 12px' }}>
                  <a href="#" style={{ color: '#0d6efd', fontWeight: 700, textDecoration: 'none' }}>INV-2026-0906</a>
                </td>
                <td style={{ padding: '16px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>Ananya Iyer</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>HST-2026-004 | Room 103</div>
                </td>
                <td style={{ padding: '16px 12px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>Room Rent</span></td>
                <td style={{ padding: '16px 12px', color: '#334155' }}>2026-09</td>
                <td style={{ padding: '16px 12px', fontWeight: 700, color: '#0f172a' }}>₹7,500.00</td>
                <td style={{ padding: '16px 12px', color: '#d93025', fontWeight: 600 }}>10 Sep 2026 (Overdue)</td>
                <td style={{ padding: '16px 12px' }}><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#e11d48', color: 'white', fontWeight: 600, fontSize: '12px' }}>Unpaid</span></td>
                <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                  <button style={{ padding: '6px 14px', fontSize: '13px', background: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Wallet size={14} /> Collect Payment
                  </button>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '16px 12px' }}>
                  <a href="#" style={{ color: '#0d6efd', fontWeight: 700, textDecoration: 'none' }}>INV-2026-0902</a>
                </td>
                <td style={{ padding: '16px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>Aarav Sharma</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>HST-2026-001 | Room 101</div>
                </td>
                <td style={{ padding: '16px 12px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>Mess Fee</span></td>
                <td style={{ padding: '16px 12px', color: '#334155' }}>2026-09</td>
                <td style={{ padding: '16px 12px', fontWeight: 700, color: '#0f172a' }}>₹3,500.00</td>
                <td style={{ padding: '16px 12px', color: '#475569' }}>10 Sep 2026</td>
                <td style={{ padding: '16px 12px' }}><span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '4px', background: '#198754', color: 'white', fontWeight: 600, fontSize: '12px' }}>Paid</span></td>
                <td style={{ textAlign: 'right', padding: '16px 12px' }}>
                  <button style={{ padding: '6px 14px', fontSize: '13px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} color="#64748b" /> View Receipt
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Fees;
