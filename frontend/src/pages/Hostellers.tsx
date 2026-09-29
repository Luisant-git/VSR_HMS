import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Phone, Mail, MapPin, Wallet, Eye, FileText, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { StudentAPI } from '../api/student.api';
import { FeesAPI } from '../api/fees.api';
import { toast } from 'react-toastify';
const Hostellers = () => {
  const navigate = useNavigate();
  const [hostellers, setHostellers] = useState<any[]>([]);

  useEffect(() => {
    StudentAPI.findAll().then(data => {
        const mapped = data.map((h: any) => {
          const pendingFeesAmount = h.transactions?.filter((f: any) => f.status === 'PENDING').reduce((sum: number, f: any) => sum + f.amount, 0) || 0;
          return {
            id: h.regNo,
            name: h.name,
            contact: h.mobileNo,
            room: h.roomNo || 'N/A',
            bed: h.bedNo || 'N/A',
            college: h.college || 'N/A',
            dept: h.educationalQua || 'N/A',
            advance: `₹${h.advance || 0}`,
            pending: `₹${pendingFeesAmount}`,
            feeStatus: pendingFeesAmount > 0 ? 'Un-Paid' : 'Paid',
            date: new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            avatar: h.name.substring(0, 2).toUpperCase(),
            raw: h
          };
        });
        setHostellers(mapped);
      }).catch(console.error);
  }, []);

  const location = useLocation();
  const [selectedHosteller, setSelectedHosteller] = useState<any>(null);
  const [roomFilter, setRoomFilter] = useState(location.state?.filterRoom || '-- All Rooms --');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeStudent] = useState<any>(null);
  const [newFee, setNewFee] = useState({ transactionType: 'RENT', amount: 0, description: '', status: 'COMPLETED', paymentMode: 'UPI', referenceNumber: '' });
  const [isSubmittingFee, setIsSubmittingFee] = useState(false);

  const handleAddFee = async () => {
    if (!feeStudent || newFee.amount <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    setIsSubmittingFee(true);
    try {
      const uuid = feeStudent.raw.id;
      const finalDescription = `${newFee.description} | Ref: ${newFee.referenceNumber || '-'}`.trim();
      await FeesAPI.create({ ...newFee, studentId: uuid, amount: Number(newFee.amount), description: finalDescription });
      toast.success('Fee recorded successfully!');
      setShowFeeModal(false);
    } catch (e: any) {
      toast.error('Failed to add fee: ' + e.message);
    }
    setIsSubmittingFee(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const rooms = useMemo(() => {
    const uniqueRooms = new Set<string>();
    hostellers.forEach(h => {
      if (h.room && h.room !== 'N/A') {
        uniqueRooms.add(`Room ${h.room}`);
      }
    });
    return ['-- All Rooms --', ...Array.from(uniqueRooms).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [hostellers]);
  const roomOptions = rooms.map(r => ({ value: r, label: r }));

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      padding: '2px',
      borderRadius: '8px',
      borderColor: state.isFocused ? 'var(--sidebar-active)' : 'var(--border-color)',
      boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
      '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1' },
      fontSize: '13px',
      cursor: 'pointer',
      width: '200px',
      background: 'white'
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
      color: state.isSelected ? 'white' : '#334155',
      cursor: 'pointer'
    })
  };

  const filteredHostellers = hostellers.filter(h => {
    const matchesRoom = roomFilter === '-- All Rooms --' || `Room ${h.room}` === roomFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      h.name.toLowerCase().includes(q) || 
      h.id.toLowerCase().includes(q) || 
      h.contact.includes(q) || 
      h.college.toLowerCase().includes(q);
      
    return matchesRoom && matchesSearch;
  });

  return (
    <div>
      <div className="content-card" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
        <PageHeader 
          title="Active Hostellers Master" 
          subtitle="Filter by room to view enrolled students"
          rightContent={
            <>
              <button 
                onClick={() => navigate('/register')}
                style={{ 
                background: 'var(--sidebar-active)', 
                color: 'white', 
                border: 'none', 
                padding: '12px 24px', 
                borderRadius: '8px', 
                fontSize: '15px', 
                fontWeight: 600, 
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(74, 114, 250, 0.25)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                + Register New Student
              </button>
            </>
          }
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
            <input 
              type="text"
              placeholder="Search by name, ID, mobile, or college..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                outline: 'none',
                width: '280px'
              }}
            />
          </div>
          
          <Select 
            options={roomOptions}
            value={roomOptions.find(o => o.value === roomFilter)}
            onChange={(opt) => setRoomFilter(opt?.value || '-- All Rooms --')}
            styles={selectStyles}
            placeholder="Search room..."
            isSearchable={true}
          />
          
          <button onClick={() => navigate('/gate-logs')} style={{ 
            background: '#0f172a', 
            color: 'white', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '8px', 
            fontSize: '13px', 
            fontWeight: 600, 
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            Gate Logs
          </button>
        </div>

        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', padding: '0', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'white', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student ID</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name & Contact</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Room</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>College / Dept</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advance Held</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fee Status</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Fees</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Joining Date</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHostellers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    No enrolled students found in this room.
                  </td>
                </tr>
              ) : (
              filteredHostellers.map((h, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eaedf1', background: 'white' }}>
                  <td style={{ padding: '15px 20px', fontWeight: 600 }}>
                    <a href="#" style={{ color: '#0d6efd', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setSelectedHosteller(h); }}>{h.id}</a>
                  </td>
                  <td style={{ padding: '15px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0d6efd', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, overflow: 'hidden' }}>
                        {h.raw.photoUrl ? (
                          <img src={h.raw.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          h.avatar
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{h.name}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Phone size={12} /> {h.contact}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                      <span style={{ background: '#0d6efd', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: 'white' }}>Room {h.room}</span>
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px' }}>
                    <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '14px' }}>{h.college}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{h.dept}</div>
                  </td>
                  <td style={{ padding: '15px 20px', color: '#198754', fontWeight: 600, fontSize: '14px' }}>
                    {h.advance}
                  </td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ 
                      background: h.feeStatus === 'Paid' ? '#dcfce7' : h.feeStatus === 'Un-Paid' ? '#fee2e2' : '#fef3c7',
                      color: h.feeStatus === 'Paid' ? '#166534' : h.feeStatus === 'Un-Paid' ? '#991b1b' : '#92400e',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 
                    }}>
                      {h.feeStatus}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ background: '#dc3545', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                      {h.pending}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>{h.date}</td>
                  <td style={{ padding: '15px 20px', position: 'relative' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === h.id ? null : h.id);
                      }}
                      style={{ 
                        padding: '6px 12px', 
                        borderRadius: '4px', 
                        fontSize: '13px', 
                        background: 'white', 
                        border: '1px solid #cbd5e1', 
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      Manage <span style={{ fontSize: '10px' }}>▼</span>
                    </button>

                    {activeDropdown === h.id && (
                      <div 
                        ref={dropdownRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: '20px',
                          background: 'white',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                          border: '1px solid #e2e8f0',
                          width: '220px',
                          zIndex: 50,
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '8px 0',
                          marginTop: '4px'
                        }}
                      >
                        <button 
                          onClick={() => navigate(`/hostellers/profile/${h.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#334155', fontSize: '14px' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Eye size={16} color="#0d6efd" /> View 360 Profile
                        </button>
                        <button 
                          onClick={() => {
                            navigate(`/fees`);
                            setActiveDropdown(null);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#334155', fontSize: '14px' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Wallet size={16} color="#198754" /> Collect Fees
                        </button>
                        <button 
                          onClick={() => navigate('/outpass')}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#334155', fontSize: '14px' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <FileText size={16} color="#ffc107" /> Issue Outpass
                        </button>
                        <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }}></div>
                        <button 
                          onClick={() => navigate(`/hostellers/clearance/${h.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc3545', fontSize: '14px' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <LogOut size={16} color="#dc3545" /> Checkout / Exit (Free Bed)
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      {selectedHosteller && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ 
              background: 'linear-gradient(135deg, var(--sidebar-active), #3b5bdb)', 
              padding: '25px', 
              color: 'white',
              position: 'relative'
            }}>
              <button 
                onClick={() => setSelectedHosteller(null)} 
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
              >
                <X size={18} />
              </button>
              
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'white', color: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 700, overflow: 'hidden' }}>
                  {selectedHosteller.raw.photoUrl ? (
                    <img src={selectedHosteller.raw.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    selectedHosteller.name.charAt(0)
                  )}
                </div>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 5px 0' }}>{selectedHosteller.name}</h2>
                  <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>{selectedHosteller.id} • {selectedHosteller.dept}</p>
                </div>
              </div>
            </div>
            
            {/* Modal Body */}
            <div style={{ padding: '25px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Room Number</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>Room {selectedHosteller.room}</div>
                </div>
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current Status</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: selectedHosteller.raw?.status === 'In' ? '#188038' : '#d93025' }}>
                    {selectedHosteller.raw?.status || 'In'} Campus
                  </div>
                </div>
              </div>
              
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '15px' }}>Contact Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(74, 114, 250, 0.1)', color: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={16} /></div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Phone Number</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedHosteller.contact}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(74, 114, 250, 0.1)', color: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail size={16} /></div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Email Address</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedHosteller.raw?.emailId || 'N/A'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(74, 114, 250, 0.1)', color: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={16} /></div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Home Address</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedHosteller.raw?.address || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div style={{ padding: '15px 25px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8f9fa' }}>
              <button 
                onClick={() => setSelectedHosteller(null)}
                style={{ padding: '8px 16px', borderRadius: '6px', background: 'white', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Close
              </button>
              <button 
                onClick={() => navigate(`/register?edit=${selectedHosteller.id}`)}
                style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--sidebar-active)', border: 'none', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Edit Student
              </button>
            </div>
          </div>
        </div>
      )}
      {showFeeModal && feeStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '0', borderRadius: '12px', width: '450px', maxWidth: '90%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ background: '#198754', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Record Fee Payment</h3>
              <button onClick={() => setShowFeeModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>{feeStudent.name} ({feeStudent.id}){feeStudent.room && feeStudent.room !== 'N/A' ? ` - Room ${feeStudent.room}` : ''} | {feeStudent.contact}</div>
                <div style={{ color: '#64748b', fontSize: '13px' }}>Due: ₹{newFee.amount || '0.00'}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Type <span style={{color: '#dc3545'}}>*</span></label>
                  <select value={newFee.transactionType} onChange={e => setNewFee({...newFee, transactionType: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', outline: 'none' }}>
                    <option value="RENT">Rent</option>
                    <option value="MESS">Mess Fee</option>
                    <option value="EB_BILL">EB Bill</option>
                    <option value="FINE">Fine</option>
                    <option value="ADVANCE">Advance Deposit</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Amount Paid (₹) <span style={{color: '#dc3545'}}>*</span></label>
                  <input type="number" value={newFee.amount || ''} onChange={e => setNewFee({...newFee, amount: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Mode</label>
                  <select value={newFee.paymentMode} onChange={e => setNewFee({...newFee, paymentMode: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', outline: 'none' }}>
                    <option value="UPI">UPI / QR (GPay / PhonePe / Paytm)</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Transaction Reference Number</label>
                  <input type="text" placeholder="UPI Ref ID, Cheque #, or Cash Voucher" value={newFee.referenceNumber} onChange={e => setNewFee({...newFee, referenceNumber: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Notes</label>
                  <input type="text" placeholder="Optional notes" value={newFee.description} onChange={e => setNewFee({...newFee, description: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ background: '#f8f9fa', padding: '15px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setShowFeeModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', background: '#6c757d', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleAddFee} disabled={isSubmittingFee} style={{ padding: '8px 16px', borderRadius: '6px', background: '#198754', color: 'white', border: 'none', cursor: isSubmittingFee ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                {isSubmittingFee ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hostellers;
