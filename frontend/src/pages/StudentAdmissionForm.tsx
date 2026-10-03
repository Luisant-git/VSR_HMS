import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Upload, ArrowLeft, Camera, FileText, Phone, CheckCircle, AlertCircle, IdCard } from 'lucide-react';
import { StudentAPI } from '../api/student.api';
import { toast } from 'react-toastify';
import { UploadAPI } from '../api/upload.api';
import Swal from 'sweetalert2';

export default function StudentAdmissionForm() {
  const [mobileNo, setMobileNo] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    mobileNo: '',
    fatherMobileNo: '',
    motherMobileNo: '',
    guardianMobileNo: '',
    emergencyContact: '',
    photoUrl: '',
    doc1Url: '',
    doc2Url: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState('');

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error('Failed to access camera.');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        
        setUploadingField('photoUrl');
        canvasRef.current.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
            try {
              const res = await UploadAPI.uploadFile(file);
              if (res && res.url) {
                 setFormData({ ...formData, photoUrl: res.url });
                 toast.success('Photo captured and uploaded!');
              }
            } catch (err) {
              toast.error('Failed to upload captured photo');
            }
            setUploadingField('');
            stopCamera();
          }
        }, 'image/jpeg');
      }
    }
  };

  const loadStudent = async (searchMobile: string) => {
    setLoading(true);
    try {
      const data = await StudentAPI.findByMobile(searchMobile);
      if (!data) {
        setError("No student registered with this mobile number.");
        setStudent(null);
      } else {
        setStudent(data);
        setFormData({
          mobileNo: data.mobileNo || '',
          fatherMobileNo: data.fatherMobileNo || '',
          motherMobileNo: data.motherMobileNo || '',
          guardianMobileNo: data.guardianMobileNo || '',
          emergencyContact: data.emergencyContact || '',
          photoUrl: data.photoUrl || '',
          doc1Url: data.doc1Url || '',
          doc2Url: data.doc2Url || ''
        });
        sessionStorage.setItem('student_admission_mobile', searchMobile);
      }
    } catch (err: any) {
      setError(err.message || "Failed to find student");
    }
    setLoading(false);
  };

  useEffect(() => {
    const savedMobile = sessionStorage.getItem('student_admission_mobile');
    if (savedMobile) {
      setMobileNo(savedMobile);
      loadStudent(savedMobile);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanMobile = mobileNo.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    await loadStudent(cleanMobile);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingField(fieldName);
    
    try {
      const res = await UploadAPI.uploadFile(file);
      if (res && res.url) {
        setFormData({ ...formData, [fieldName]: res.url });
        toast.success('File uploaded successfully!');
      }
    } catch (err) {
      toast.error('Failed to upload file');
    } finally {
      setUploadingField('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    
    setSaving(true);
    try {
      await StudentAPI.update(student.id, {
        ...formData,
        profileUpdatedAt: new Date()
      });
      Swal.fire({
        title: 'Updated Successfully!',
        text: 'Your profile and KYC documents have been saved.',
        icon: 'success',
        confirmButtonColor: '#0ea5e9'
      });
      // Reload student
      await loadStudent(formData.mobileNo || mobileNo);
    } catch (err: any) {
      Swal.fire({
        title: 'Update Failed',
        text: err.message || 'Failed to update profile. Please try again.',
        icon: 'error',
        confirmButtonColor: '#e11d48'
      });
    }
    setSaving(false);
  };

  if (!student) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: '"Inter", sans-serif', padding: '20px' }}>
        <div style={{ background: 'white', width: '100%', maxWidth: '440px', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ width: '64px', height: '64px', background: '#f0f9ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
              <FileText size={32} />
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Welcome Back</h2>
            <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Enter your registered mobile number to access your portal.</p>
          </div>

          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#334155', fontSize: '14px', fontWeight: 600 }}>Registered Mobile Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  placeholder="e.g. 9876543210"
                  style={{
                    width: '100%', padding: '14px 16px 14px 48px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '16px', outline: 'none', transition: 'all 0.2s ease', background: '#f8fafc', color: '#1e293b'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#0ea5e9'; e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 4px rgba(14, 165, 233, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>
            
            {error && (
              <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#ef4444', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} /> <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#0ea5e9', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
              onMouseOver={(e) => { if(!loading) { e.currentTarget.style.background = '#0284c7'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(14, 165, 233, 0.4)'; } }}
              onMouseOut={(e) => { if(!loading) { e.currentTarget.style.background = '#0ea5e9'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } }}
            >
              {loading ? 'Searching...' : 'Continue to Portal →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="student-form-container" style={{ height: '100vh', overflowY: 'auto', background: '#f8fafc', padding: '40px 20px', fontFamily: '"Inter", sans-serif' }}>
      <style>{`
        @media (max-width: 768px) {
          .student-form-container { padding: 20px 10px !important; }
          .header-title h1 { font-size: 24px !important; }
          .header-title p { font-size: 13px !important; }
          .details-grid { grid-template-columns: 1fr 1fr !important; }
          .contact-grid { grid-template-columns: 1fr !important; }
          .kyc-grid { grid-template-columns: 1fr !important; }
          .header-row { flex-direction: column; align-items: flex-start !important; gap: 15px; }
        }
        @media (max-width: 480px) {
          .details-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', borderRadius: '20px', marginBottom: '16px', boxShadow: '0 10px 25px -5px rgba(59,130,246,0.3)' }}>
            <FileText color="white" size={32} />
          </div>
          <div className="header-title">
            <h1 style={{ margin: 0, fontSize: '32px', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.5px' }}>Student Admission Form</h1>
            <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '16px' }}>Complete your profile details and upload necessary KYC documents</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Profile Header Card */}
          <div className="header-row" style={{ background: 'white', borderRadius: '20px', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                {formData.photoUrl ? (
                  <img src={formData.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={32} color="#94a3b8" />
                )}
              </div>
              <div>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: 700 }}>{student.name}</h2>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600 }}>{student.regNo}</span>
                  <span style={{ background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600 }}>Room {student.roomNo || 'N/A'}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => { setStudent(null); setFormData({} as any); sessionStorage.removeItem('student_admission_mobile'); }}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, padding: '10px 16px', borderRadius: '12px', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#334155'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
            >
              <ArrowLeft size={16} /> Logout
            </button>
          </div>

          {/* Read Only Details Card */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <IdCard size={20} color="#3b82f6" /> Student Details
            </h3>
            <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {[
                { label: 'Registration No', value: student.regNo },
                { label: 'Full Name', value: student.name },
                { label: 'Date of Birth', value: student.dob ? new Date(student.dob).toLocaleDateString() : '-' },
                { label: 'Blood Group', value: student.bloodGroup },
                { label: 'Aadhar Number', value: student.aadharNo },
                { label: 'Address', value: student.address },
                { label: 'College Name', value: student.college?.name },
                { label: 'Educational Qual.', value: student.educationalQua },
                { label: 'Course Duration', value: student.courseDuration },
                { label: 'Date of Joining', value: student.dateOfJoining ? new Date(student.dateOfJoining).toLocaleDateString() : '-' }
              ].map((item, idx) => (
                <div key={idx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>{item.value || '-'}</div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
            {/* Profile Photo Card */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Camera size={20} color="#3b82f6" /> Profile Photo
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ width: '160px', height: '160px', background: '#f8fafc', borderRadius: '24px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', marginBottom: '20px', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                    {isCameraOpen ? (
                      <>
                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
                        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                      </>
                    ) : uploadingField === 'photoUrl' ? (
                      <>
                        <div style={{ width: '24px', height: '24px', border: '3px solid #cbd5e1', borderTopColor: 'var(--sidebar-active)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '8px' }}></div>
                        <style>{'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'}</style>
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>Uploading...</span>
                      </>
                    ) : formData.photoUrl ? (
                      <img src={formData.photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <User size={32} style={{ marginBottom: '8px', color: '#94a3b8' }} />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>No Photo</span>
                      </>
                    )}
                  </div>

                {isCameraOpen ? (
                  <div style={{ display: 'flex', gap: '10px', width: '160px', marginBottom: '10px' }}>
                    <button onClick={takePhoto} type="button" style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600, background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(16,185,129,0.3)' }}>
                      Snap!
                    </button>
                    <button onClick={stopCamera} type="button" style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600, background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(239,68,68,0.3)' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', width: '160px', marginBottom: '12px' }}>
                    <button onClick={startCamera} type="button" style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(59,130,246,0.3)' }}>
                      <Camera size={14} /> {formData.photoUrl ? 'Retake' : 'Capture'}
                    </button>
                    <label style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600, background: 'white', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' }}>
                      <Upload size={14} /> Browse
                      <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, 'photoUrl')} disabled={uploadingField === 'photoUrl'} />
                    </label>
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#94a3b8', width: '160px', textAlign: 'center', fontWeight: 500 }}>Supported: JPG, PNG (Max 5MB)</div>
              </div>
            </div>

            {/* Contact Numbers Card */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={20} color="#3b82f6" /> Contact Numbers
              </h3>
              <div className="contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {[
                  { label: "Student Mobile No", key: "mobileNo" },
                  { label: "Father's Mobile No", key: "fatherMobileNo" },
                  { label: "Mother's Mobile No", key: "motherMobileNo" },
                  { label: "Guardian's Mobile No", key: "guardianMobileNo" },
                  { label: "Emergency Contact", key: "emergencyContact" },
                ].map((inputItem) => (
                  <div key={inputItem.key}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontSize: '14px', fontWeight: 600 }}>{inputItem.label}</label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input 
                        type="text" 
                        value={(formData as any)[inputItem.key]} 
                        onChange={e => setFormData({...formData, [inputItem.key]: e.target.value})} 
                        style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '15px', outline: 'none', transition: 'all 0.2s', background: '#f8fafc', color: '#1e293b' }} 
                        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* KYC Documents Card */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} color="#3b82f6" /> KYC Documents
              </h3>
              <div className="kyc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Document 1 */}
                <div style={{ border: '2px solid #e2e8f0', borderRadius: '16px', padding: '24px', background: '#f8fafc', transition: 'all 0.2s', position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '16px', color: '#0f172a', fontSize: '15px', fontWeight: 700 }}>Aadhar Card (Front/Back)</label>
                  <div style={{ height: '160px', background: 'white', border: '2px dashed #cbd5e1', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                    {formData.doc1Url ? (
                        formData.doc1Url.toLowerCase().endsWith('.pdf') ? (
                          <div style={{ textAlign: 'center', color: '#3b82f6' }}><FileText size={40} /><p style={{margin:'8px 0 0 0', fontSize:'13px', fontWeight: 600}}>PDF Uploaded</p></div>
                        ) : (
                          <img src={formData.doc1Url} alt="Doc 1" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )
                    ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8' }}><Upload size={40} /><p style={{margin:'8px 0 0 0', fontSize:'13px', fontWeight: 500}}>No document</p></div>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'white', border: '2px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#3b82f6', fontSize: '14px', fontWeight: 600, width: '100%', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                  >
                    {uploadingField === 'doc1Url' ? 'Uploading...' : 'Upload Document 1'}
                    <input type="file" style={{ display: 'none' }} accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'doc1Url')} disabled={uploadingField === 'doc1Url'} />
                  </label>
                </div>

                {/* Document 2 */}
                <div style={{ border: '2px solid #e2e8f0', borderRadius: '16px', padding: '24px', background: '#f8fafc', transition: 'all 0.2s', position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '16px', color: '#0f172a', fontSize: '15px', fontWeight: 700 }}>Other ID / College ID</label>
                  <div style={{ height: '160px', background: 'white', border: '2px dashed #cbd5e1', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                    {formData.doc2Url ? (
                        formData.doc2Url.toLowerCase().endsWith('.pdf') ? (
                          <div style={{ textAlign: 'center', color: '#3b82f6' }}><FileText size={40} /><p style={{margin:'8px 0 0 0', fontSize:'13px', fontWeight: 600}}>PDF Uploaded</p></div>
                        ) : (
                          <img src={formData.doc2Url} alt="Doc 2" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )
                    ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8' }}><Upload size={40} /><p style={{margin:'8px 0 0 0', fontSize:'13px', fontWeight: 500}}>No document</p></div>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'white', border: '2px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#3b82f6', fontSize: '14px', fontWeight: 600, width: '100%', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                  >
                    {uploadingField === 'doc2Url' ? 'Uploading...' : 'Upload Document 2'}
                    <input type="file" style={{ display: 'none' }} accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'doc2Url')} disabled={uploadingField === 'doc2Url'} />
                  </label>
                </div>

              </div>
            </div>

            {/* Submit Button Row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', paddingBottom: '40px' }}>
              <button
                type="submit"
                disabled={saving || uploadingField !== ''}
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', color: 'white', padding: '16px 40px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: 700, cursor: (saving || uploadingField !== '') ? 'not-allowed' : 'pointer', opacity: (saving || uploadingField !== '') ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 25px -5px rgba(59,130,246,0.4)', transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { if(!saving && uploadingField === '') { e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                onMouseOut={(e) => { if(!saving && uploadingField === '') { e.currentTarget.style.transform = 'translateY(0)'; } }}
              >
                {saving ? 'Saving...' : <><CheckCircle size={20} /> Save & Submit Updates</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
