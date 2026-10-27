import React, { useState, useEffect, useRef } from 'react';
import { User, Upload, LogOut, Camera, FileText, Phone, CheckCircle, AlertCircle, IdCard, ArrowRight, Check, Building2, X } from 'lucide-react';
import { StudentAPI } from '../api/student.api';
import { toast } from 'react-toastify';
import { UploadAPI } from '../api/upload.api';
import Swal from 'sweetalert2';
import { StudentAcknowledgementCard } from '../components/StudentAcknowledgementCard';

const EMPTY_FORM = { 
  name: '', dob: '', bloodGroup: '', address: '', educationalQua: '', courseDuration: '',
  gender: '', emailId: '', maritalStatus: '', fatherName: '', motherName: '', guardianName: '',
  pursuingYear: '', category: '', foodType: '',
  mobileNo: '', fatherMobileNo: '', motherMobileNo: '', guardianMobileNo: '', emergencyContact: '', 
  photoUrl: '', doc1Url: '', doc2Url: '', 
  doc1Type: 'Aadhar Card', doc2Type: 'College Student ID', doc1Number: '', doc2Number: '', aadharNo: '', secondaryIdNo: '', biometricId: ''
};



const DOCS = [
  { key: 'doc1Url', typeKey: 'doc1Type', numKey: 'doc1Number', title: 'Document 1: Primary ID Proof', hint: 'Front and back in one file', options: ['Aadhar Card', 'PAN Card', 'Voter ID', 'Driving License'] },
  { key: 'doc2Url', typeKey: 'doc2Type', numKey: 'doc2Number', title: 'Document 2: Secondary / College Proof', hint: 'Any valid photo ID', options: ['College Student ID', 'Driving License', 'Voter ID', 'Passport', 'Other'] },
];

export default function StudentAdmissionForm() {
  const [mobileNo, setMobileNo] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const [showIdCard, setShowIdCard] = useState(false);

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
        <div className="sa-login">
          <div className="sa-card">
            <div className="sa-icon center"><FileText size={32} /></div>
            <h1>Welcome back</h1>
            <p className="sa-sub">Enter your registered mobile number to open your portal.</p>
            <form onSubmit={handleSearch}>
              <div>
                <label className="sa-label" htmlFor="sa-mobile">Registered mobile number</label>
                <div className="sa-field">
                  <Phone size={20} />
                  <input id="sa-mobile" className="sa-input" inputMode="numeric" value={mobileNo} onChange={e => setMobileNo(e.target.value)} placeholder="e.g. 9876543210" />
                </div>
              </div>
              {error && <div className="sa-error" role="alert"><AlertCircle size={20} /><span>{error}</span></div>}
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



  return (
    <div className="sa">
      {/* Modern Top Bar */}
      <header className="sa-topbar">
         <div className="sa-topbar-inner">
           <div className="sa-logo">
              <div><IdCard size={20} /></div>
              <span>Hostel</span>
           </div>
           <button type="button" className="sa-btn ghost sm sa-logout" onClick={logout} aria-label="Log out">
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
            <div className="sa-min0">
              <div className="sa-name-row">
                <h1 className="sa-name">{student.name}</h1>
                <button type="button" onClick={() => setShowIdCard(true)} className="sa-btn xs">
                  <IdCard size={14} /> View ID Card
                </button>
              </div>
              <div className="sa-chips">
                <span className="sa-chip">{student.manualRegsiName || student.regNo}</span>
                <span className="sa-chip green">Room {student.roomNo || 'N/A'}</span>
                {student.biometricId && (
                  <span className="sa-chip">Bio ID: {student.biometricId}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="sa-card sa-progress-card">
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
              <input className="sa-input no-icon" value={formData.name} onChange={e => setField('name', e.target.value)} />
            </div>
            <div>
              <label className="sa-label">Gender</label>
              <select className="sa-input no-icon" value={formData.gender} onChange={e => setField('gender', e.target.value)}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Marital Status</label>
              <select className="sa-input no-icon" value={formData.maritalStatus} onChange={e => setField('maritalStatus', e.target.value)}>
                <option value="">Select Status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Date of Birth</label>
              <input type="date" className="sa-input no-icon" value={formData.dob ? new Date(formData.dob).toISOString().split('T')[0] : ''} onChange={e => setField('dob', e.target.value)} />
            </div>
            <div>
              <label className="sa-label">Email Address</label>
              <input type="email" className="sa-input no-icon" value={formData.emailId} onChange={e => setField('emailId', e.target.value)} />
            </div>
            <div>
              <label className="sa-label">Aadhar Number</label>
              <input className="sa-input no-icon" value={formData.aadharNo} onChange={e => setField('aadharNo', e.target.value)} maxLength={12} placeholder="12-digit Aadhar" />
            </div>
            <div>
              <label className="sa-label">Blood Group</label>
              <select className="sa-input no-icon" value={formData.bloodGroup} onChange={e => setField('bloodGroup', e.target.value)}>
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
              <select className="sa-input no-icon" value={formData.category} onChange={e => setField('category', e.target.value)}>
                <option value="">Select Category</option>
                <option value="Student">Student</option>
                <option value="Job Seeker">Job Seeker</option>
                <option value="Working Professional">Working Professional</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Food Type</label>
              <select className="sa-input no-icon" value={formData.foodType} onChange={e => setField('foodType', e.target.value)}>
                <option value="">Select Food Type</option>
                <option value="Veg">Veg</option>
                <option value="Non-Veg">Non-Veg</option>
              </select>
            </div>
            <div className="sa-span2">
              <label className="sa-label">Permanent Home Address</label>
              <input className="sa-input no-icon" value={formData.address} onChange={e => setField('address', e.target.value)} />
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
              <input className="sa-input no-icon" value={formData.fatherName} onChange={e => setField('fatherName', e.target.value)} />
            </div>
            <div>
              <label className="sa-label">Father's Mobile</label>
              <input className="sa-input no-icon" value={formData.fatherMobileNo} onChange={e => setField('fatherMobileNo', e.target.value)} maxLength={10} />
            </div>
            <div>
              <label className="sa-label">Mother's Name</label>
              <input className="sa-input no-icon" value={formData.motherName} onChange={e => setField('motherName', e.target.value)} />
            </div>
            <div>
              <label className="sa-label">Mother's Mobile</label>
              <input className="sa-input no-icon" value={formData.motherMobileNo} onChange={e => setField('motherMobileNo', e.target.value)} maxLength={10} />
            </div>
            <div>
              <label className="sa-label">Guardian's Name</label>
              <input className="sa-input no-icon" value={formData.guardianName} onChange={e => setField('guardianName', e.target.value)} />
            </div>
            <div>
              <label className="sa-label">Guardian's Mobile</label>
              <input className="sa-input no-icon" value={formData.guardianMobileNo} onChange={e => setField('guardianMobileNo', e.target.value)} maxLength={10} />
            </div>
            <div>
              <label className="sa-label">Emergency Contact Number</label>
              <input className="sa-input no-icon" value={formData.emergencyContact} onChange={e => setField('emergencyContact', e.target.value)} maxLength={10} />
            </div>
            <div>
              <label className="sa-label">Course / Department / Designation</label>
              <input className="sa-input no-icon" value={formData.educationalQua} onChange={e => setField('educationalQua', e.target.value)} />
            </div>
            <div>
              <label className="sa-label">Course Duration</label>
              <input className="sa-input no-icon" value={formData.courseDuration} onChange={e => setField('courseDuration', e.target.value)} />
            </div>
            <div>
              <label className="sa-label">Pursuing Year / Passing Year</label>
              <input className="sa-input no-icon" value={formData.pursuingYear} onChange={e => setField('pursuingYear', e.target.value)} />
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
            <div className="sa-row"><dt>Registration no</dt><dd>{student.manualRegsiName || student.regNo}</dd></div>
            <div className="sa-row"><dt>College</dt><dd>{student.college?.name || '-'}</dd></div>
            <div className="sa-row"><dt>Date of joining</dt><dd>{student.dateOfJoining ? new Date(student.dateOfJoining).toLocaleDateString('en-GB') : '-'}</dd></div>
            <div className="sa-row"><dt>Student mobile</dt><dd>{student.mobileNo}</dd></div>
            <div className="sa-row"><dt>Room</dt><dd>{student.room ? `${student.room.block} - Room ${student.room.id ? student.room.id.replace(/^[a-zA-Z\\s_-]+/, '') : (student.roomNo || '')}` : (student.roomNo || '-')} {student.bedNo ? `(${student.bedNo})` : ''}</dd></div>
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
                  
                  <div className="sa-doc-fields">
                     <div>
                       <label className="sa-label sm">Document type</label>
                       <select className="sa-input no-icon" value={(formData as any)[doc.typeKey] || ''} onChange={e => setField(doc.typeKey, e.target.value)}>
                          {doc.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="sa-label sm">Document / ID Number (Optional)</label>
                       <input className="sa-input no-icon" placeholder="e.g. 1234 5678 9012" value={(formData as any)[doc.numKey] || ''} onChange={e => setField(doc.numKey, e.target.value)} />
                     </div>
                  </div>

                  <label htmlFor={`upload-${doc.key}`} className="sa-preview">
                    {url ? (
                      url.toLowerCase().endsWith('.pdf')
                        ? <div className="sa-doc-pdf"><FileText size={36} />PDF uploaded</div>
                        : <img src={url} alt={doc.title} />
                    ) : (
                      <div className="sa-upload-cta">
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

      {showIdCard && (
        <div className="sa-idcard-overlay">
          <div className="sa-idcard">
             <button type="button" onClick={() => setShowIdCard(false)} className="sa-idcard-close">
               <X size={20} />
             </button>
             <div className="sa-idcard-body">
               <StudentAcknowledgementCard 
                 student={{ ...student, regNo: student.manualRegsiName || student.regNo, collegeId: student.college?.name || student.college }} 
                 collegeName={student.college?.name || student.college}
                 onBack={() => setShowIdCard(false)} 
                 isViewOnly={true}
               />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
