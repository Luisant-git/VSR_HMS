import React, { useState, useEffect, useRef } from 'react';
import { AlignLeft, Filter, Search, Download, Columns, X, Phone, Mail, MapPin, GraduationCap, Bed, Wallet, ArrowRight, Eye, FileText, LogOut, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
const Hostellers = () => {
  const navigate = useNavigate();
  const [hostellers] = useState([
    { id: 'HST-2026-009', name: 'Baskar', contact: '9876543256', room: '104', bed: 'Bed 1', college: 'Luisant', dept: 'SE', advance: '₹10,000', pending: '₹21,900', date: '20 Sep 2026', avatar: 'BA' },
    { id: 'HST-2026-008', name: 'Arunkarthick', contact: '9994683263', room: '104', bed: 'N/A', college: 'JKKN College', dept: 'MBA', advance: '₹0', pending: '₹18,400', date: '20 Sep 2026', avatar: 'AR' },
    { id: 'HST-2026-006', name: 'Meera Nair', contact: '9876543215', room: '102', bed: '102-B', college: 'Medical University', dept: 'MBBS 2nd Yr', advance: '₹10,000', pending: '₹23,100', date: '05 Mar 2026', avatar: 'ME' },
    { id: 'HST-2026-005', name: 'Vikramaditya Rao', contact: '9876543214', room: '104', bed: '104-A', college: 'City Tech College', dept: 'B.Tech ECE', advance: '₹8,000', pending: '₹21,900', date: '01 Mar 2026', avatar: 'VI' },
    { id: 'HST-2026-004', name: 'Ananya Iyer', contact: '9876543213', room: '103', bed: '103-A', college: 'Arts & Science', dept: 'B.Com CA', advance: '₹15,000', pending: '₹40,500', date: '10 Feb 2026', avatar: 'AN' },
    { id: 'HST-2026-003', name: 'Rohan Verma', contact: '9876543212', room: '101', bed: '101-B', college: 'City Tech College', dept: 'B.Tech Mech', advance: '₹10,000', pending: '₹34,000', date: '01 Feb 2026', avatar: 'RO' },
    { id: 'HST-2026-002', name: 'Kavya Patel', contact: '9876543211', room: '102', bed: '102-A', college: 'Natl Inst Design', dept: 'UX Design', advance: '₹10,000', pending: '₹23,100', date: '15 Jan 2026', avatar: 'KA' },
    { id: 'HST-2026-001', name: 'Aarav Sharma', contact: '9876543210', room: '101', bed: '101-A', college: 'City Tech College', dept: 'B.Tech CSE', advance: '₹10,000', pending: '₹25,500', date: '10 Jan 2026', avatar: 'AA' },
  ]);

  const location = useLocation();
  const [selectedHosteller, setSelectedHosteller] = useState<any>(null);
  const [roomFilter, setRoomFilter] = useState(location.state?.filterRoom || '-- All Rooms --');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const rooms = ['-- All Rooms --', 'Room 101', 'Room 102', 'Room 103', 'Room 104', 'Room 201', 'Room 202', 'Room 203', 'Room 204', 'Room 301', 'Room 302'];

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
              
              <select 
                value={roomFilter} 
                onChange={(e) => setRoomFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              
              <button onClick={() => navigate('/gate-logs')} style={{ 
                background: 'white', 
                color: 'var(--text-main)', 
                border: '1px solid var(--border-color)', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                fontSize: '13px', 
                fontWeight: 600, 
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                Gate Logs
              </button>

              <button 
                onClick={() => navigate('/register')}
                style={{ 
                background: 'var(--sidebar-active)', 
                color: 'white', 
                border: 'none', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                fontSize: '13px', 
                fontWeight: 600, 
                cursor: 'pointer',
                boxShadow: '0 4px 8px rgba(74, 114, 250, 0.2)'
              }}>
                + Register New Student
              </button>
            </>
          }
        />

        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', padding: '0', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'white', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student ID</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name & Contact</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Room & Bed</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>College / Dept</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advance Held</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Fees</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Joining Date</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHostellers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
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
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0d6efd', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>
                        {h.avatar}
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
                      <span style={{ fontSize: '13px', color: '#64748b' }}>{h.bed}</span>
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
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#334155', fontSize: '14px' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Wallet size={16} color="#198754" /> Collect Fees
                        </button>
                        <button 
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
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'white', color: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 700 }}>
                  {selectedHosteller.name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 5px 0' }}>{selectedHosteller.name}</h2>
                  <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>{selectedHosteller.regNo} • {selectedHosteller.course}</p>
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
                  <div style={{ fontSize: '16px', fontWeight: 600, color: selectedHosteller.status === 'In' ? '#188038' : '#d93025' }}>
                    {selectedHosteller.status} Campus
                  </div>
                </div>
              </div>
              
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '15px' }}>Contact Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(74, 114, 250, 0.1)', color: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={16} /></div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Phone Number</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedHosteller.phone}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(74, 114, 250, 0.1)', color: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail size={16} /></div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Email Address</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedHosteller.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(74, 114, 250, 0.1)', color: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={16} /></div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Home Address</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedHosteller.address}</div>
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
                style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--sidebar-active)', border: 'none', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Edit Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hostellers;
