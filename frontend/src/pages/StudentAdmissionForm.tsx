import React, { useState, useEffect, useRef } from 'react';
import { User, Upload, LogOut, Camera, FileText, Phone, CheckCircle, AlertCircle, IdCard, ArrowRight, Check, ChevronRight, Building2 } from 'lucide-react';
import { StudentAPI } from '../api/student.api';
import { toast } from 'react-toastify';
import { UploadAPI } from '../api/upload.api';
import Swal from 'sweetalert2';

const EMPTY_FORM = { 
  name: '', dob: '', bloodGroup: '', address: '', educationalQua: '', courseDuration: '',
  gender: '', emailId: '', maritalStatus: '', fatherName: '', motherName: '', guardianName: '',
  pursuingYear: '', category: '', foodType: '',
  mobileNo: '', fatherMobileNo: '', motherMobileNo: '', guardianMobileNo: '', emergencyContact: '', 
  photoUrl: '', doc1Url: '', doc2Url: '', 
  doc1Type: 'Aadhar Card', doc2Type: 'College Student ID', doc1Number: '', doc2Number: '', aadharNo: '', secondaryIdNo: '' 
};



const DOCS = [
  { key: 'doc1Url', typeKey: 'doc1Type', numKey: 'doc1Number', title: 'Document 1: Primary ID Proof', hint: 'Front and back in one file', options: ['Aadhar Card', 'PAN Card', 'Voter ID', 'Driving License'] },
  { key: 'doc2Url', typeKey: 'doc2Type', numKey: 'doc2Number', title: 'Document 2: Secondary / College Proof', hint: 'Any valid photo ID', options: ['College Student ID', 'Driving License', 'Voter ID', 'Passport', 'Other'] },
];

const CSS = `
.sa{--primary:#0ea5e9;--primary-d:#0284c7;--primary-soft:#f0f9ff;--ink:#0f172a;--text:#334155;--muted:#64748b;--line:#e2e8f0;--bg:#f8fafc;
  min-height:100vh;height:100vh;overflow-y:auto;background:var(--bg);font-family:"Inter",system-ui,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
.sa *{box-sizing:border-box}
.sa-wrap{max-width:960px;margin:0 auto;padding:100px 20px 120px}
.sa-card{background:#fff;border:1px solid #f1f5f9;border-radius:24px;box-shadow:0 20px 40px -15px rgba(0,0,0,.05);padding:28px}
.sa-stack{display:flex;flex-direction:column;gap:20px}
.sa-icon{width:64px;height:64px;border-radius:16px;background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center}
.sa-icon.sm{width:40px;height:40px;border-radius:12px}
.sa h1{font-size:28px;font-weight:800;letter-spacing:-.5px;margin:0}
.sa h2{font-size:17px;font-weight:700;margin:0}
.sa p{margin:0}
.sa-sub{color:var(--muted);font-size:15px}
.sa-label{display:block;margin-bottom:8px;color:var(--text);font-size:14px;font-weight:600}
.sa-field{position:relative}
.sa-field svg{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none}
.sa-input{width:100%;padding:14px 16px 14px 48px;border-radius:12px;border:2px solid var(--line);background:var(--bg);font:inherit;font-size:16px;color:#1e293b;outline:none;transition:all .2s ease}
.sa-input:focus{border-color:var(--primary);background:#fff;box-shadow:0 0 0 4px rgba(14,165,233,.1)}
.sa-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 24px;border:none;border-radius:12px;background:var(--primary);color:#fff;font:inherit;font-size:16px;font-weight:600;cursor:pointer;transition:all .2s ease;white-space:nowrap}
.sa-btn:hover:not(:disabled){background:var(--primary-d);transform:translateY(-2px);box-shadow:0 10px 25px -5px rgba(14,165,233,.4)}
.sa-btn:disabled{opacity:.6;cursor:not-allowed}
.sa-btn.block{width:100%}
.sa-btn.ghost{background:#fff;color:var(--primary-d);border:2px solid var(--line);padding:10px 16px;font-size:14px}
.sa-btn.ghost:hover:not(:disabled){background:var(--primary-soft);border-color:var(--primary);box-shadow:none;transform:none}
.sa-btn.sm{padding:10px 16px;font-size:14px}
.sa-btn.danger{background:#fff;color:#e11d48;border:2px solid #fecdd3}
.sa-btn.danger:hover:not(:disabled){background:#fff1f2;box-shadow:none;transform:none}
.sa :focus-visible:not(.sa-input){outline:3px solid rgba(14,165,233,.45);outline-offset:2px}
.sa-error{display:flex;gap:10px;align-items:center;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;color:#ef4444;font-size:14px}

/* login */
.sa-login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.sa-login .sa-card{width:100%;max-width:440px;padding:40px;text-align:center}
.sa-login form{text-align:left;display:flex;flex-direction:column;gap:20px;margin-top:32px}

/* page title */
.sa-title { margin-bottom: 8px; padding: 0 4px; }
.sa-title h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; margin: 0; color: var(--ink); }
.sa-title p { margin-top: 8px; color: var(--muted); font-size: 16px; }

/* topbar */
.sa-topbar { position: fixed; top: 0; left: 0; right: 0; height: 72px; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.05); z-index: 40; display: flex; align-items: center; justify-content: center; }
.sa-topbar-inner { width: 100%; max-width: 960px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; }
.sa-logo { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 18px; color: var(--ink); }
.sa-logo div { width: 36px; height: 36px; background: var(--primary); color: #fff; border-radius: 10px; display: flex; align-items: center; justify-content: center; }

/* top */
.sa-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.sa-who{display:flex;align-items:center;gap:16px;min-width:0}
.sa-avatar{width:64px;height:64px;border-radius:50%;background:var(--bg);border:2px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;color:#94a3b8}
.sa-avatar img{width:100%;height:100%;object-fit:cover}
.sa-chips{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}
.sa-chip{padding:4px 10px;border-radius:999px;font-size:13px;font-weight:600;background:#f1f5f9;color:#475569}
.sa-chip.green{background:#f0fdf4;color:#166534}

/* progress */
.sa-progress{display:flex;align-items:center;gap:16px}
.sa-bar{flex:1;height:8px;border-radius:99px;background:#f1f5f9;overflow:hidden}
.sa-bar i{display:block;height:100%;background:var(--primary);border-radius:99px;transition:width .4s ease}
.sa-progress span{font-size:14px;font-weight:600;color:var(--text);white-space:nowrap}

/* sections */
.sa-head{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.sa-head p{font-size:13px;color:var(--muted);margin-top:2px}
.sa-dl{display:grid;grid-template-columns:1fr 1fr;column-gap:48px;margin:0}
.sa-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:14px 0;border-bottom:1px solid #f1f5f9}
.sa-row dt{font-size:14px;color:var(--muted);flex-shrink:0}
.sa-row dd{margin:0;font-size:14px;font-weight:600;color:var(--ink);text-align:right;word-break:break-word}
.sa-row.wide{grid-column:1/-1}
.sa-dl .sa-row:nth-last-child(-n+2):not(.wide){border-bottom:none}
.sa-dl .sa-row.wide:last-child{border-bottom:none}
.sa-grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}

/* photo */
.sa-photo{display:flex;gap:24px;align-items:center;flex-wrap:wrap}
.sa-frame{width:160px;height:160px;border-radius:24px;border:2px dashed #cbd5e1;background:var(--bg);overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);font-size:12px;font-weight:500;gap:8px}
.sa-frame img,.sa-frame video{width:100%;height:100%;object-fit:cover}
.sa-frame.filled{border-style:solid;border-color:var(--line)}
.sa-spin{width:24px;height:24px;border:3px solid #cbd5e1;border-top-color:var(--primary);border-radius:50%;animation:sa-spin 1s linear infinite}
@keyframes sa-spin{to{transform:rotate(360deg)}}
.sa-actions{display:flex;gap:10px;flex-wrap:wrap}
.sa-note{font-size:12px;color:#94a3b8;margin-top:10px}

/* docs */
.sa-doc{border:2px solid var(--line);border-radius:18px;padding:20px;background:var(--bg)}
.sa-doc.done{border-color:#bae6fd;background:var(--primary-soft)}
.sa-doc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:8px}
.sa-doc-top b{display:block;font-size:15px}
.sa-doc-top small{color:var(--muted);font-size:13px}
.sa-tick{width:22px;height:22px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-preview{height:150px;background:#fff;border:2px dashed #cbd5e1;border-radius:14px;margin-bottom:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#94a3b8;text-align:center;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s ease;width:100%}
.sa-preview:hover{border-color:var(--primary);background:var(--primary-soft)}
.sa-preview img{width:100%;height:100%;object-fit:contain}
.sa-preview svg{display:block;margin:0 auto 6px}

/* save bar */
.sa-save{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:14px 20px;z-index:10}
.sa-save div{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px}
.sa-save p{font-size:14px;color:var(--muted)}

@media (max-width:720px){
  .sa-wrap{padding:92px 12px calc(96px + env(safe-area-inset-bottom));gap:12px}
  .sa-card{padding:16px;border-radius:18px;box-shadow:0 8px 20px -12px rgba(0,0,0,.08)}
  .sa-title h1{font-size:22px}.sa-title p{font-size:13px}
  .sa h1{font-size:24px}.sa h2{font-size:16px}
  .sa-login .sa-card{padding:28px 20px}
  .sa-top{flex-wrap:nowrap;gap:10px}
  .sa-top h1{font-size:18px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sa-avatar{width:52px;height:52px}
  .sa-chip{font-size:12px;padding:3px 8px}
  .sa-lo{display:none}
  .sa-top .sa-btn.ghost{padding:10px;border-radius:12px;flex-shrink:0}
  .sa-progress-card{padding:14px 16px!important}
  .sa-head{margin-bottom:16px;gap:10px}
  .sa-head p{font-size:12px}
  .sa-icon.sm{width:36px;height:36px;border-radius:10px}
  .sa-dl{grid-template-columns:1fr}
  .sa-row,.sa-row.wide{padding:12px 0;grid-column:auto}
  .sa-dl .sa-row:nth-last-child(2):not(.wide){border-bottom:1px solid #f1f5f9}
  .sa-dl .sa-row:last-child{border-bottom:none}
  .sa-row dt,.sa-row dd{font-size:13px}
  .sa-grid2{grid-template-columns:1fr;gap:14px}
  .sa-photo{flex-direction:column;align-items:center;gap:16px;text-align:center}
  .sa-actions{width:100%}
  .sa-actions .sa-btn{flex:1;padding:12px 6px;font-size:13px}
  .sa-note{margin-top:16px;text-align:center;width:100%}
  .sa-doc{padding:14px;border-radius:16px}
  .sa-preview{height:120px;margin-bottom:12px}
  .sa-input{padding:13px 14px 13px 44px;border-radius:12px}
  .sa-save{padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
  .sa-save p{display:none}.sa-save .sa-btn{width:100%}
}
@media (prefers-reduced-motion:reduce){.sa *{transition:none!important;animation:none!important}}
`;

export default function StudentAdmissionForm() {
  const [mobileNo, setMobileNo] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState('');

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setField = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }));

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error('Could not access the camera. Check your browser permissions.');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    const video = videoRef.current, canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!video || !canvas || !ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setUploadingField('photoUrl');
    canvas.toBlob(async blob => {
      if (blob) {
        try {
          const url = await UploadAPI.uploadImage(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
          if (url) { setField('photoUrl', url); toast.success('Photo uploaded'); }
        } catch {
          toast.error('Photo upload failed. Try again.');
        }
      }
      setUploadingField('');
      stopCamera();
    }, 'image/jpeg');
  };

  const loadStudent = async (searchMobile: string) => {
    setLoading(true);
    try {
      const data = await StudentAPI.findByMobile(searchMobile);
      if (!data) {
        setError('No student is registered with this mobile number.');
        setStudent(null);
      } else {
        setStudent(data);
        setFormData(Object.fromEntries(Object.keys(EMPTY_FORM).map(k => {
          let val = data[k];
          if (k === 'doc1Number' && !val && data.aadharNo) val = data.aadharNo;
          if (k === 'doc2Number' && !val && data.secondaryIdNo) val = data.secondaryIdNo;
          return [k, val || (EMPTY_FORM as any)[k]];
        })) as typeof EMPTY_FORM);
        sessionStorage.setItem('student_admission_mobile', searchMobile);
      }
    } catch (err: any) {
      setError(err.message || 'Could not find the student. Try again.');
    }
    setLoading(false);
  };

  // Mobile styles only apply when the page has a viewport meta tag
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('student_admission_mobile');
    if (saved) { setMobileNo(saved); loadStudent(saved); }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = mobileNo.trim().replace(/\D/g, '');
    if (clean.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    await loadStudent(clean);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(fieldName);
    try {
      const url = await UploadAPI.uploadImage(file);
      if (url) { setField(fieldName, url); toast.success('File uploaded'); }
    } catch {
      toast.error('Upload failed. Try again.');
    } finally {
      setUploadingField('');
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    const confirm = await Swal.fire({
      title: 'Save these changes?',
      text: 'Your profile details and KYC documents will be updated.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, save',
      cancelButtonText: 'Review again',
      confirmButtonColor: '#0ea5e9',
      cancelButtonColor: '#94a3b8',
    });
    if (!confirm.isConfirmed) return;
    setSaving(true);
    try {
      await StudentAPI.update(student.id, { ...formData, profileUpdatedAt: new Date() });
      await Swal.fire({ title: 'Changes saved', text: 'Your profile and KYC documents are up to date.', icon: 'success', confirmButtonColor: '#0ea5e9' });
      logout();
    } catch (err: any) {
      Swal.fire({ title: 'Could not save changes', text: err.message || 'Check your connection and try again.', icon: 'error', confirmButtonColor: '#e11d48' });
    }
    setSaving(false);
  };

  const logout = () => {
    stopCamera();
    setStudent(null);
    setFormData({ ...EMPTY_FORM });
    sessionStorage.removeItem('student_admission_mobile');
  };

  /* ---------- Login ---------- */
  if (!student) {
    return (
      <div className="sa">
        <style>{CSS}</style>
        <div className="sa-login">
          <div className="sa-card">
            <div className="sa-icon" style={{ margin: '0 auto 24px' }}><FileText size={32} /></div>
            <h1>Welcome back</h1>
            <p className="sa-sub" style={{ marginTop: 8 }}>Enter your registered mobile number to open your portal.</p>
            <form onSubmit={handleSearch}>
              <div>
                <label className="sa-label" htmlFor="sa-mobile">Registered mobile number</label>
                <div className="sa-field">
                  <Phone size={20} />
                  <input id="sa-mobile" className="sa-input" inputMode="numeric" value={mobileNo} onChange={e => setMobileNo(e.target.value)} placeholder="e.g. 9876543210" />
                </div>
              </div>
              {error && <div className="sa-error" role="alert"><AlertCircle size={20} style={{ flexShrink: 0 }} /><span>{error}</span></div>}
              <button type="submit" className="sa-btn block" disabled={loading}>
                {loading ? 'Searching…' : <>Continue to portal <ArrowRight size={18} /></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Portal ---------- */
  const steps = [formData.photoUrl, formData.doc1Url, formData.doc2Url, formData.fatherMobileNo || formData.motherMobileNo || formData.guardianMobileNo, formData.emergencyContact];
  const done = steps.filter(Boolean).length;
  const busy = saving || uploadingField !== '';

  const details = [
    { label: 'Registration no', value: student.regNo },
    { label: 'Full name', value: student.name },
    { label: 'Date of birth', value: student.dob ? new Date(student.dob).toLocaleDateString() : '' },
    { label: 'Blood group', value: student.bloodGroup },
    { label: 'Aadhar number', value: student.aadharNo },
    { label: 'College', value: student.college?.name },
    { label: 'Educational qualification', value: student.educationalQua },
    { label: 'Course duration', value: student.courseDuration },
    { label: 'Date of joining', value: student.dateOfJoining ? new Date(student.dateOfJoining).toLocaleDateString() : '' },
    { label: 'Address', value: student.address },
    { label: 'Student mobile', value: student.mobileNo },
    { label: "Father's mobile", value: student.fatherMobileNo },
    { label: "Mother's mobile", value: student.motherMobileNo },
    { label: "Guardian's mobile", value: student.guardianMobileNo },
    { label: 'Emergency contact', value: student.emergencyContact },
  ];

  return (
    <div className="sa">
      <style>{CSS}</style>
      {/* Modern Top Bar */}
      <header className="sa-topbar">
         <div className="sa-topbar-inner">
           <div className="sa-logo">
              <div><IdCard size={20} /></div>
              <span>VSR Hostels</span>
           </div>
           <button type="button" className="sa-btn ghost sm" style={{ border: 'none', background: 'transparent' }} onClick={logout} aria-label="Log out">
             <LogOut size={16} /> <span className="sa-lo">Log out</span>
           </button>
         </div>
      </header>

      <form className="sa-wrap sa-stack" onSubmit={handleSubmit}>

        {/* Title */}
        <div className="sa-title">
          <h1>Student admission form</h1>
          <p>Complete your profile and upload your KYC documents.</p>
        </div>

        {/* Profile header */}
        <div className="sa-card sa-top">
          <div className="sa-who">
            <div className="sa-avatar">{formData.photoUrl ? <img src={formData.photoUrl} alt="Profile" /> : <User size={30} />}</div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 22 }}>{student.name}</h1>
              <div className="sa-chips">
                <span className="sa-chip">{student.regNo}</span>
                <span className="sa-chip green">Room {student.roomNo || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="sa-card sa-progress-card" style={{ padding: '20px 28px' }}>
          <div className="sa-progress">
            <div className="sa-bar"><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
            <span>{done} of {steps.length} complete</span>
          </div>
        </div>

        {/* Personal & Contact Information */}
        <div className="sa-card">
          <div className="sa-head">
            <div className="sa-icon sm"><IdCard size={20} /></div>
            <div><h2>Personal & Contact Information</h2><p>Update your personal and contact details.</p></div>
          </div>
          <div className="sa-grid2">
            <div>
              <label className="sa-label">Full Name</label>
              <input className="sa-input" value={formData.name} onChange={e => setField('name', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div>
              <label className="sa-label">Gender</label>
              <select className="sa-input" value={formData.gender} onChange={e => setField('gender', e.target.value)} style={{ paddingLeft: '16px' }}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Marital Status</label>
              <select className="sa-input" value={formData.maritalStatus} onChange={e => setField('maritalStatus', e.target.value)} style={{ paddingLeft: '16px' }}>
                <option value="">Select Status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Date of Birth</label>
              <input type="date" className="sa-input" value={formData.dob ? new Date(formData.dob).toISOString().split('T')[0] : ''} onChange={e => setField('dob', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div>
              <label className="sa-label">Email Address</label>
              <input type="email" className="sa-input" value={formData.emailId} onChange={e => setField('emailId', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div>
              <label className="sa-label">Aadhar Number</label>
              <input className="sa-input" value={formData.aadharNo} onChange={e => setField('aadharNo', e.target.value)} style={{ paddingLeft: '16px' }} maxLength={12} placeholder="12-digit Aadhar" />
            </div>
            <div>
              <label className="sa-label">Blood Group</label>
              <select className="sa-input" value={formData.bloodGroup} onChange={e => setField('bloodGroup', e.target.value)} style={{ paddingLeft: '16px' }}>
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Category</label>
              <select className="sa-input" value={formData.category} onChange={e => setField('category', e.target.value)} style={{ paddingLeft: '16px' }}>
                <option value="">Select Category</option>
                <option value="Student">Student</option>
                <option value="Job Seeker">Job Seeker</option>
                <option value="Working Professional">Working Professional</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Food Type</label>
              <select className="sa-input" value={formData.foodType} onChange={e => setField('foodType', e.target.value)} style={{ paddingLeft: '16px' }}>
                <option value="">Select Food Type</option>
                <option value="Veg">Veg</option>
                <option value="Non-Veg">Non-Veg</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="sa-label">Permanent Home Address</label>
              <input className="sa-input" value={formData.address} onChange={e => setField('address', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
          </div>
        </div>

        {/* Parents, Guardian & Academic Info */}
        <div className="sa-card">
          <div className="sa-head">
            <div className="sa-icon sm"><Phone size={20} /></div>
            <div><h2>Parents, Guardian & Academic Info</h2><p>Contact numbers and course details.</p></div>
          </div>
          <div className="sa-grid2">
            <div>
              <label className="sa-label">Father's Name</label>
              <input className="sa-input" value={formData.fatherName} onChange={e => setField('fatherName', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div>
              <label className="sa-label">Father's Mobile</label>
              <input className="sa-input" value={formData.fatherMobileNo} onChange={e => setField('fatherMobileNo', e.target.value)} style={{ paddingLeft: '16px' }} maxLength={10} />
            </div>
            <div>
              <label className="sa-label">Mother's Name</label>
              <input className="sa-input" value={formData.motherName} onChange={e => setField('motherName', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div>
              <label className="sa-label">Mother's Mobile</label>
              <input className="sa-input" value={formData.motherMobileNo} onChange={e => setField('motherMobileNo', e.target.value)} style={{ paddingLeft: '16px' }} maxLength={10} />
            </div>
            <div>
              <label className="sa-label">Guardian's Name</label>
              <input className="sa-input" value={formData.guardianName} onChange={e => setField('guardianName', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div>
              <label className="sa-label">Guardian's Mobile</label>
              <input className="sa-input" value={formData.guardianMobileNo} onChange={e => setField('guardianMobileNo', e.target.value)} style={{ paddingLeft: '16px' }} maxLength={10} />
            </div>
            <div>
              <label className="sa-label">Emergency Contact Number</label>
              <input className="sa-input" value={formData.emergencyContact} onChange={e => setField('emergencyContact', e.target.value)} style={{ paddingLeft: '16px' }} maxLength={10} />
            </div>
            <div>
              <label className="sa-label">Course / Department / Designation</label>
              <input className="sa-input" value={formData.educationalQua} onChange={e => setField('educationalQua', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div>
              <label className="sa-label">Course Duration</label>
              <input className="sa-input" value={formData.courseDuration} onChange={e => setField('courseDuration', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div>
              <label className="sa-label">Pursuing Year / Passing Year</label>
              <input className="sa-input" value={formData.pursuingYear} onChange={e => setField('pursuingYear', e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
          </div>
        </div>

        {/* Hostel details */}
        <div className="sa-card">
          <div className="sa-head">
            <div className="sa-icon sm"><Building2 size={20} /></div>
            <div><h2>Hostel Registration (Read-only)</h2><p>Registered with the hostel. Contact the office to change these.</p></div>
          </div>
          <dl className="sa-dl">
            <div className="sa-row"><dt>Registration no</dt><dd>{student.regNo}</dd></div>
            <div className="sa-row"><dt>College</dt><dd>{student.college?.name || '-'}</dd></div>
            <div className="sa-row"><dt>Date of joining</dt><dd>{student.dateOfJoining ? new Date(student.dateOfJoining).toLocaleDateString() : '-'}</dd></div>
            <div className="sa-row"><dt>Student mobile</dt><dd>{student.mobileNo}</dd></div>
            <div className="sa-row"><dt>Room</dt><dd>{student.room ? `${student.room.block} - Room ${student.room.id.replace(/^[a-zA-Z\\s_-]+/, '')}` : (student.roomNo || '-')} {student.bedNo ? `(${student.bedNo})` : ''}</dd></div>
            <div className="sa-row"><dt>Monthly Rent</dt><dd>₹{student.rent || 0}</dd></div>
            <div className="sa-row"><dt>Advance Paid</dt><dd>₹{student.advance || 0}</dd></div>
          </dl>
        </div>

        {/* Photo */}
        <div className="sa-card">
          <div className="sa-head">
            <div className="sa-icon sm"><Camera size={20} /></div>
            <div><h2>Profile photo</h2><p>A clear, front-facing photo.</p></div>
          </div>
          <div className="sa-photo">
            <div className={`sa-frame ${formData.photoUrl && !isCameraOpen ? 'filled' : ''}`}>
              {isCameraOpen ? (
                <><video ref={videoRef} autoPlay playsInline muted /><canvas ref={canvasRef} style={{ display: 'none' }} /></>
              ) : uploadingField === 'photoUrl' ? (
                <><div className="sa-spin" /><span>Uploading…</span></>
              ) : formData.photoUrl ? (
                <img src={formData.photoUrl} alt="Preview" />
              ) : (
                <><User size={32} color="#94a3b8" /><span>No photo yet</span></>
              )}
            </div>
            <div>
              {isCameraOpen ? (
                <div className="sa-actions">
                  <button type="button" className="sa-btn sm" onClick={takePhoto}><Camera size={16} /> Take photo</button>
                  <button type="button" className="sa-btn sm danger" onClick={stopCamera}>Cancel</button>
                </div>
              ) : (
                <div className="sa-actions">
                  <button type="button" className="sa-btn sm" onClick={startCamera}><Camera size={16} /> {formData.photoUrl ? 'Retake photo' : 'Use camera'}</button>
                  <label className="sa-btn ghost sm">
                    <Upload size={16} /> Upload file
                    <input type="file" hidden accept="image/*" onChange={e => handleFileUpload(e, 'photoUrl')} disabled={uploadingField === 'photoUrl'} />
                  </label>
                </div>
              )}
              <p className="sa-note">JPG or PNG, up to 5 MB.</p>
            </div>
          </div>
        </div>



        {/* KYC */}
        <div className="sa-card">
          <div className="sa-head">
            <div className="sa-icon sm"><FileText size={20} /></div>
            <div><h2>KYC documents</h2><p>Upload a clear image or PDF of each document.</p></div>
          </div>
          <div className="sa-grid2">
            {DOCS.map(doc => {
              const url = (formData as any)[doc.key] as string;
              return (
                <div key={doc.key} className={`sa-doc ${url ? 'done' : ''}`}>
                  <div className="sa-doc-top">
                    <div><b>{doc.title}</b><small>{doc.hint}</small></div>
                    {url && <span className="sa-tick"><Check size={14} /></span>}
                  </div>
                  
                  <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <div>
                       <label className="sa-label" style={{ fontSize: '13px' }}>Document type</label>
                       <select className="sa-input" style={{ paddingLeft: '16px' }} value={(formData as any)[doc.typeKey] || ''} onChange={e => setField(doc.typeKey, e.target.value)}>
                          {doc.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="sa-label" style={{ fontSize: '13px' }}>Document / ID Number (Optional)</label>
                       <input className="sa-input" style={{ paddingLeft: '16px' }} placeholder="e.g. 1234 5678 9012" value={(formData as any)[doc.numKey] || ''} onChange={e => setField(doc.numKey, e.target.value)} />
                     </div>
                  </div>

                  <label htmlFor={`upload-${doc.key}`} className="sa-preview">
                    {url ? (
                      url.toLowerCase().endsWith('.pdf')
                        ? <div style={{ color: 'var(--primary)' }}><FileText size={36} />PDF uploaded</div>
                        : <img src={url} alt={doc.title} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Upload size={32} />
                        <span>Click to upload document</span>
                      </div>
                    )}
                  </label>
                  <label htmlFor={`upload-${doc.key}`} className="sa-btn ghost block">
                    {uploadingField === doc.key ? 'Uploading…' : url ? 'Replace document' : 'Upload document'}
                    <input id={`upload-${doc.key}`} type="file" hidden accept="image/*,.pdf" onChange={e => handleFileUpload(e, doc.key)} disabled={uploadingField === doc.key} />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky save bar */}
        <div className="sa-save">
          <div>
            <p>{done === steps.length ? 'Everything is filled in.' : 'You can save now and finish later.'}</p>
            <button type="submit" className="sa-btn" disabled={busy}>
              {saving ? 'Saving…' : <><CheckCircle size={18} /> Save changes</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
