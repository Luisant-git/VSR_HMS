import React, { useState } from 'react';
import { Camera, Info, CheckCircle2, Upload, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';

const Register = () => {
  const navigate = useNavigate();
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  const roomOptions = [
    { value: '201', label: 'Room 201 (Four Sharing • 4 bed(s) free • Rent: ₹3,200.00 + Mess: ₹3,500.00)' },
    { value: '202', label: 'Room 202 (Double • 2 bed(s) free • Rent: ₹4,500.00 + Mess: ₹3,500.00)' },
    { value: '203', label: 'Room 203 (Single • 1 bed(s) free • Rent: ₹7,000.00 + Mess: ₹3,500.00)' },
    { value: '204', label: 'Room 204 (Dormitory • 6 bed(s) free • Rent: ₹2,800.00 + Mess: ₹3,500.00)' },
    { value: '301', label: 'Room 301 (Double • 2 bed(s) free • Rent: ₹7,500.00 + Mess: ₹8,000.00)' },
    { value: '302', label: 'Room 302 (Triple • 5 bed(s) free • Rent: ₹4,500.00 + Mess: ₹3,500.00)' }
  ];

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      padding: '4px',
      borderRadius: '6px',
      borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1',
      boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--sidebar-active)' : '#94a3b8'
      },
      fontSize: '14px',
      cursor: 'pointer'
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '14px',
      backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
      color: state.isSelected ? 'white' : '#334155',
      cursor: 'pointer',
      padding: '12px 16px',
      '&:active': {
        backgroundColor: state.isSelected ? 'var(--sidebar-active)' : '#e2e8f0'
      }
    }),
    placeholder: (base: any) => ({ ...base, color: '#94a3b8' }),
    singleValue: (base: any) => ({ ...base, color: '#1e293b' }),
    menu: (base: any) => ({ ...base, zIndex: 50, borderRadius: '6px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' })
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Student Admission Registration"
        subtitle="Enroll a new hosteller, capture photo, upload KYC documents, and assign room bed"
        rightContent={
          <>
            <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} onMouseOut={(e) => e.currentTarget.style.background = 'white'}>
               <ArrowLeft size={16} /> Cancel
            </button>
            <button style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
              <CheckCircle2 size={16} /> Complete Registration
            </button>
          </>
        }
      />

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', flex: 1.8 }}>
        {/* Section 1 */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Personal & Contact Information
          </h3>
          
          <div style={{ display: 'flex', gap: '30px' }}>
            {/* Photo Upload */}
            <div style={{ width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <div style={{ width: '150px', height: '150px', background: '#f8f9fa', borderRadius: '12px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', marginBottom: '15px' }}>
                 <Camera size={32} style={{ marginBottom: '8px', color: '#94a3b8' }} />
                 <span style={{ fontSize: '12px', fontWeight: 500 }}>No Photo</span>
               </div>
               <div style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: '10px' }}>
                 <button style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: 'var(--sidebar-active)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                   <Camera size={14} /> Capture
                 </button>
                 <label style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: 'white', color: 'var(--sidebar-active)', border: '1px solid var(--sidebar-active)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                   <Upload size={14} /> Browse
                   <input type="file" style={{ display: 'none' }} accept="image/*" />
                 </label>
               </div>
               <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>Supported formats: JPG, JPEG, PNG, WEBP (Max 5MB)</div>
            </div>

            {/* Form Fields */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Student ID *</label>
                <input type="text" defaultValue="HST-2026-015" readOnly style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8f9fa', color: '#64748b', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Full Name *</label>
                <input type="text" placeholder="e.g. Ramesh Kumar" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Gender *</label>
                <select style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Date of Birth</label>
                <input type="date" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Mobile Number *</label>
                <input type="text" placeholder="10-digit mobile" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address</label>
                <input type="email" placeholder="student@example.com" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Permanent Home Address</label>
                <textarea placeholder="Street, City, State, Pincode" rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Guardian & Academic Info
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Parent / Guardian Name *</label>
                <input type="text" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
             </div>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Parent Phone *</label>
                <input type="text" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
             </div>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Emergency Contact</label>
                <input type="text" placeholder="Secondary contact number" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
             </div>
             <div></div>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>College or Workplace Name</label>
                <input type="text" placeholder="e.g. City Engineering College" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
             </div>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Course / Department / Designation</label>
                <input type="text" placeholder="e.g. B.Tech IT / Junior Developer" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
             </div>
          </div>
        </div>

        {/* Section 3 */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Verification Documents (Upload 2 ID Proofs)
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}><Info size={14} color="#0d6efd" /> Mandatory KYC verification documents for hostel record compliance</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            {/* Doc 1 */}
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '15px', color: '#1e293b' }}>Document 1: Primary ID Proof</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Document Type</label>
                  <select style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white' }}>
                    <option>Aadhar Card</option>
                    <option>PAN Card</option>
                    <option>Passport</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Document / ID Number (Optional)</label>
                  <input type="text" placeholder="e.g. 1234-5678-9012" style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Upload File (PDF / Image)</label>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', border: '1.5px dashed #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer', transition: 'border 0.2s, background 0.2s' }}>
                    <Upload size={20} color="#64748b" />
                    <div style={{ fontSize: '13px', color: '#64748b' }}><span style={{ color: '#0d6efd', fontWeight: 600 }}>Click to upload</span> or drag and drop</div>
                    <input type="file" style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>
            {/* Doc 2 */}
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '15px', color: '#1e293b' }}>Document 2: Secondary / College Proof</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Document Type</label>
                  <select style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white' }}>
                    <option>College Student ID</option>
                    <option>Driving License</option>
                    <option>Voter ID</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Document / ID Number (Optional)</label>
                  <input type="text" placeholder="e.g. REG-7890" style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Upload File (PDF / Image)</label>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', border: '1.5px dashed #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer', transition: 'border 0.2s, background 0.2s' }}>
                    <Upload size={20} color="#64748b" />
                    <div style={{ fontSize: '13px', color: '#64748b' }}><span style={{ color: '#0d6efd', fontWeight: 600 }}>Click to upload</span> or drag and drop</div>
                    <input type="file" style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px' }}>Supported formats: PDF, JPG, PNG, WEBP (Max 5MB each).</div>
        </div>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', flex: 1, position: 'sticky', top: '20px' }}>
          {/* Section 4 */}
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Room & Bed Allotment
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Assign Vacant Room *</label>
                <Select 
                  options={roomOptions}
                  value={selectedRoom}
                  onChange={setSelectedRoom}
                  placeholder="-- Choose Vacant Room --"
                  styles={selectStyles}
                  isSearchable={true}
                  isClearable={true}
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Only rooms with vacant capacity are listed.</div>
             </div>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Bed Tag / Number</label>
                <input type="text" placeholder="e.g. 101-A, Bed-1" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
             </div>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Joining Date *</label>
                <input type="date" defaultValue="2026-09-25" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
             </div>
             <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Auto-generate Month 1 Invoices (Rent & Mess)</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Creates recurring unpaid invoices automatically based on above room rates.</div>
                  </div>
                </label>
             </div>
          </div>
        </div>

        {/* Section 5 */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Security Deposit (Advance)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Advance Amount (₹)</label>
                <input type="number" defaultValue="10000.00" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Refundable upon exit/discontinuation settlement.</div>
             </div>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Mode</label>
                <select style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
                  <option>UPI / GPay / PhonePe</option>
                  <option>Cash</option>
                  <option>Bank Transfer / NEFT</option>
                  <option>Card</option>
                </select>
             </div>
             <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Advance Receipt #</label>
                <input type="text" defaultValue="REC-ADV-20260925-211" readOnly style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8f9fa', color: '#64748b', fontSize: '14px', outline: 'none' }} />
             </div>
          </div>
        </div>
        
        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '10px' }}>
          <button style={{ padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer' }}>Cancel</button>
          <button style={{ padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
            <CheckCircle2 size={18} /> Complete Admission
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
