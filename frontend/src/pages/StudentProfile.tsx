import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Calendar, ShieldCheck, MapPin, Phone, FileText, CreditCard, Clock, Lock, CheckCircle2, Camera, Wallet, LogOut, Bed, X, Upload } from 'lucide-react';
import { UploadAPI } from '../api/upload.api';

const StudentProfile = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('Master Profile');
  const [student, setStudent] = useState<any>(null);

  
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [doc1File, setDoc1File] = useState(null);
  const [doc2File, setDoc2File] = useState(null);

  const handleUpdateKyc = async () => {
    setIsUpdating(true);
    try {
      const upload = async (file: File | null) => {
        if (!file) return null;
        return await UploadAPI.uploadImage(file);
      };
      
      const photoUrl = await upload(photoFile);
      const doc1Url = await upload(doc1File);
      const doc2Url = await upload(doc2File);

      const updateData = {};
      if (photoUrl) updateData.photoUrl = photoUrl;
      if (doc1Url) updateData.doc1Url = doc1Url;
      if (doc2Url) updateData.doc2Url = doc2Url;

      if (Object.keys(updateData).length > 0) {
        const { StudentAPI } = await import('../api/student.api');
        await StudentAPI.update(id, updateData);
        // Refresh local state to show changes instantly
        setStudent({ ...student, ...updateData });
        alert('Successfully updated documents!');
      }
      setShowUpdateModal(false);
    } catch (e) {
      alert('Failed to update: ' + e.message);
    }
    setIsUpdating(false);
  };

  useEffect(() => {
    if (id) {
      import('../api/student.api').then(({ StudentAPI }) => {
        StudentAPI.findOne(id).then(data => {
          setStudent({
            id: data.regNo,
            name: data.name,
            status: data.status || 'Active',
            room: `${data.roomNo || 'N/A'} (${data.bedNo || 'N/A'})`,
            joined: new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            gender: data.gender || 'N/A',
            dob: data.dob ? new Date(data.dob).toLocaleDateString('en-GB') : 'N/A',
            mobile: data.mobileNo,
            email: data.emailId || 'N/A',
            address: data.address || 'N/A',
            college: `${data.college || 'N/A'} (${data.educationalQua || 'N/A'})`,
            fatherName: data.fatherName,
            fatherMobileNo: data.fatherMobileNo,
            motherName: data.motherName,
            motherMobileNo: data.motherMobileNo,
            guardianName: data.guardianName || 'N/A',
            guardianPhone: data.guardianMobileNo || 'N/A',
            emergencyContact: data.emergencyContact || 'N/A',
            roomType: data.room?.type || 'N/A',
            blockFloor: `Block ${data.room?.block || '-'} - Floor ${data.room?.floor || '-'}`,
            monthlyRent: `₹${data.rent || 0}`,
            photoUrl: data.photoUrl,
            doc1Url: data.doc1Url,
            doc2Url: data.doc2Url
          , aadharNo: data.aadharNo, secondaryIdNo: data.secondaryIdNo });
        }).catch(console.error);
      });
    }
  }, [id]);

  if (!student) {
    return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>Loading Profile...</div>;
  }

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
          <button onClick={() => navigate(`/register?edit=${student.id}`)} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, background: 'white', border: '1px solid #334155', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--sidebar-active)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 700, marginBottom: '15px', overflow: 'hidden' }}>
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                student.name.substring(0, 2).toUpperCase()
              )}
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

              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '30px' }}>
                <User size={20} color="#3b82f6" /> Parent Information
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px' }}>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Father's Name</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.fatherName || '-'}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Father's Phone</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.fatherMobileNo || '-'}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Mother's Name</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.motherName || '-'}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Mother's Phone</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.motherMobileNo || '-'}</div>
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

          {activeTab === 'KYC Documents' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--sidebar-active)" /> KYC Documents
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                {student.doc1Url ? (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', background: '#f8f9fa' }}>
                    <div style={{ fontWeight: 600, marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Primary ID Proof</span>
                      {student.aadharNo && <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>ID: {student.aadharNo}</span>}
                    </div>
                    <a href={student.doc1Url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', background: '#e2e8f0' }}>
                      <img src={student.doc1Url} alt="Document 1" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </a>
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '245px', color: '#64748b' }}>
                    No Primary ID Uploaded
                  </div>
                )}

                {student.doc2Url ? (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', background: '#f8f9fa' }}>
                    <div style={{ fontWeight: 600, marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Secondary ID Proof</span>
                      {student.secondaryIdNo && <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>ID: {student.secondaryIdNo}</span>}
                    </div>
                    <a href={student.doc2Url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', background: '#e2e8f0' }}>
                      <img src={student.doc2Url} alt="Document 2" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </a>
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '245px', color: '#64748b' }}>
                    No Secondary ID Uploaded
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab !== 'Master Profile' && activeTab !== 'KYC Documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#94a3b8' }}>
              <Lock size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{activeTab} Data</div>
              <div style={{ fontSize: '14px', marginTop: '5px' }}>This module will be connected to the database soon.</div>
            </div>
          )}
        
      {showUpdateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Update Photo & KYC</h3>
              <button onClick={() => setShowUpdateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>Profile Photo</label>
                <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>Primary ID Proof</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setDoc1File(e.target.files[0])} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>Secondary ID Proof</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setDoc2File(e.target.files[0])} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
              <button onClick={() => setShowUpdateModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', background: 'white', border: '1px solid #cbd5e1', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleUpdateKyc} disabled={isUpdating} style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--sidebar-active)', color: 'white', border: 'none', cursor: isUpdating ? 'not-allowed' : 'pointer' }}>
                {isUpdating ? 'Uploading...' : 'Upload & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

</div>
      </div>
    </div>
  );
};

export default StudentProfile;
