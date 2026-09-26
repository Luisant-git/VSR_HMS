import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Calendar, ShieldCheck, MapPin, Phone, FileText, CreditCard, Clock, Lock, CheckCircle2, Camera, Wallet, LogOut, Bed } from 'lucide-react';

const StudentProfile = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('Master Profile');

  // Mock data for Baskar
  const student = {
    id: id || 'HST-2026-009',
    name: 'Baskar',
    status: 'Active',
    room: '104 (Bed 1)',
    joined: '20 Sep 2026',
    gender: 'Male',
    dob: '03 Nov 1985',
    mobile: '9876543256',
    email: '',
    address: 'sdsdsds',
    college: 'Luisant (SE)',
    guardianName: 'sss',
    guardianPhone: '',
    emergencyContact: '',
    roomType: 'Triple',
    blockFloor: 'Block A - Floor 1',
    monthlyRent: '₹3,800.00'
  };

  const tabs = [
    { name: 'Master Profile', icon: <User size={16} /> },
    { name: 'Gate Logs (0)', icon: <Clock size={16} /> },
    { name: 'Fees & Receipts', icon: <CreditCard size={16} /> },
    { name: 'Advance Deposit', icon: <ShieldCheck size={16} /> },
    { name: 'Outpasses & Travel', icon: <MapPin size={16} /> },
    { name: 'KYC Documents', icon: <FileText size={16} /> },
  ];

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button 
            onClick={() => navigate(-1)} 
            style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginRight: '15px' }}
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)' }}>Student Profile - {student.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '5px' }}>
              Friday, 25 Sep 2026
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, background: 'white', border: '1px solid #334155', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera size={16} /> Update Photo & KYC
          </button>
          <button style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, background: '#198754', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(25, 135, 84, 0.2)' }}>
            <Wallet size={16} /> Collect Fee
          </button>
          <button style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, background: 'white', border: '1px solid #0d6efd', color: '#0d6efd', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} /> Issue Outpass
          </button>
          <button 
            onClick={() => navigate(`/hostellers/clearance/${student.id}`)}
            style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, background: 'white', border: '1px solid #dc3545', color: '#dc3545', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={16} /> Checkout Student
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Sidebar Profile Summary & Navigation */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Profile Card */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '25px 20px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--sidebar-active)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 700, marginBottom: '15px' }}>
              {student.name.substring(0,2).toUpperCase()}
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: '0 0 5px 0' }}>{student.name}</h3>
            <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '15px' }}>
              <CheckCircle2 size={14} /> {student.status}
            </span>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#475569', textAlign: 'left', background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>ID:</span>
                <span>{student.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Room:</span>
                <span>{student.room}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Joined:</span>
                <span>{student.joined}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
            {tabs.map(tab => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                style={{
                  width: '100%',
                  padding: '15px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: activeTab === tab.name ? '#f8f9fa' : 'white',
                  border: 'none',
                  borderBottom: '1px solid #f1f5f9',
                  borderLeft: activeTab === tab.name ? '3px solid var(--sidebar-active)' : '3px solid transparent',
                  color: activeTab === tab.name ? 'var(--sidebar-active)' : '#475569',
                  fontWeight: activeTab === tab.name ? 700 : 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                {tab.icon} {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right Content Area */}
        <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '30px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          {activeTab === 'Master Profile' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={20} color="var(--sidebar-active)" /> Personal Details
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px' }}>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Gender</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.gender}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Date of Birth</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.dob}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Mobile Phone</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.mobile}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Email</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.email || '-'}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Address</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.address}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>College / Dept</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.college}</div>
                </div>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={20} color="#f59e0b" /> Guardian & Emergency Contacts
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px' }}>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Guardian Name</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.guardianName}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Guardian Phone</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.guardianPhone || '-'}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Emergency Contact</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.emergencyContact || '-'}</div>
                </div>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bed size={20} color="#8b5cf6" /> Room & Accommodation
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Room Type</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.roomType}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Block / Floor</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.blockFloor}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Monthly Rent</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{student.monthlyRent}</div>
                </div>
              </div>

            </div>
          )}

          {activeTab !== 'Master Profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#94a3b8' }}>
              <Lock size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{activeTab} Data</div>
              <div style={{ fontSize: '14px', marginTop: '5px' }}>This module will be connected to the database soon.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
