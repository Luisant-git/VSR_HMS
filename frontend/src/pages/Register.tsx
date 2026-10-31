import React, { useState, useRef } from 'react';
import { Camera, Info, CheckCircle2, Upload, ArrowLeft, Calculator, UserPlus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { StudentAcknowledgementCard } from '../components/StudentAcknowledgementCard';
import { toast } from 'react-toastify';
import { StudentAPI } from '../api/student.api';
import { UploadAPI } from '../api/upload.api';
import { RoomAPI } from '../api/room.api';
import { CollegeAPI } from '../api/college.api';


const Register = () => {
  // Helper: keep only digits and limit to 10 characters
  const sanitizeMobile = (val: string) => val.replace(/\D/g, '').slice(0, 10);
  // Helper: return class based on length (valid = 10 digits)
  const mobileClass = (val: string) => {
    if (!val) return "custom-input";
    return val.length === 10 ? "custom-input valid" : "custom-input invalid";
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [doc1Url, setDoc1Url] = useState<string | null>(null);
  const [doc2Url, setDoc2Url] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingDoc1, setIsUploadingDoc1] = useState(false);
  const [isUploadingDoc2, setIsUploadingDoc2] = useState(false);

  const uploadFile = async (fileOrBlob: Blob | File, filename?: string) => {
    try {
      return await UploadAPI.uploadImage(fileOrBlob, filename);
    } catch (err) {
      console.error(err);
      toast.error('File upload failed!');
      return null;
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setIsCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera", err);
      toast.error("Unable to access camera. Please allow permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            stopCamera();
            setIsUploadingPhoto(true);
            const url = await uploadFile(blob, 'webcam-capture.jpg');
            if (url) setCapturedImage(url);
            setIsUploadingPhoto(false);
          }
        }, 'image/jpeg');
      }
    }
  };

  React.useEffect(() => {
    if (isCameraOpen && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isCameraOpen, stream]);

  const navigate = useNavigate();
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [registeredStudent, setRegisteredStudent] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '', manualRegsiName: '', mobileNo: '', gender: 'Female', emailId: '', address: '', dob: '',
    fatherName: '', fatherMobileNo: '', motherName: '', motherMobileNo: '', guardianName: '', guardianMobileNo: '',
    emergencyContact: '', collegeId: '', educationalQua: '', advance: '',
    maritalStatus: 'Single', aadharNo: '', secondaryIdNo: '', bedNo: '',
    bloodGroup: '', dateOfJoining: new Date().toLocaleDateString('en-CA'), vsrLedger1: '', pursuingYear: '',
    category: '', foodType: '', courseDuration: '', biometricId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);
  const [collegesList, setCollegesList] = useState<any[]>([]);
  const [customRent, setCustomRent] = useState<string>('');
  const [customMessFee, setCustomMessFee] = useState<string>('');

  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  React.useEffect(() => {
    CollegeAPI.findAll({ limit: 1000 }).then(response => setCollegesList(response.data || [])).catch(() => { });
    if (editId) {
      StudentAPI.findOne(editId).then(data => {
        setFormData({
          manualRegsiName: data.manualRegsiName || '',
          name: data.name || '',
          mobileNo: data.mobileNo || '',
          gender: data.gender || 'Female',
          emailId: data.emailId || '',
          address: data.address || '',
          dob: data.dob ? data.dob.split('T')[0] : '',
          fatherName: data.fatherName || '',
          fatherMobileNo: data.fatherMobileNo || '',
          motherName: data.motherName || '',
          motherMobileNo: data.motherMobileNo || '',
          guardianName: data.guardianName || '',
          guardianMobileNo: data.guardianMobileNo || '',
          emergencyContact: data.emergencyContact || '',
          collegeId: data.collegeId || '',
          educationalQua: data.educationalQua || '',
          advance: data.advance || '',
          maritalStatus: data.maritalStatus || 'Single',
          aadharNo: data.aadharNo || '',
          secondaryIdNo: data.secondaryIdNo || '',
          bedNo: data.bedNo || '',
          bloodGroup: data.bloodGroup || '',
          dateOfJoining: data.dateOfJoining ? data.dateOfJoining.split('T')[0] : '',
          vsrLedger1: data.vsrLedger1 || '',
          pursuingYear: data.pursuingYear || '',
          category: data.category || '',
          foodType: data.foodType || '',
          courseDuration: data.courseDuration || '',
          biometricId: data.biometricId || ''
        });
        if (data.photoUrl) setCapturedImage(data.photoUrl);
        if (data.doc1Url) setDoc1Url(data.doc1Url);
        if (data.doc2Url) setDoc2Url(data.doc2Url);
        if (data.room) {
          setSelectedRoom({
            value: data.room.id,
            label: `Room ${data.room.id} (${data.room.type || ''} • Rent: ₹${(data.room.rent || 0).toLocaleString('en-IN')})`,
            room: data.room
          });
        }
        if (data.rent != null && Number(data.rent) > 0) {
          setCustomRent(String(data.rent));
        } else if (data.room && data.room.rent != null) {
          setCustomRent(String(data.room.rent));
        }
        const latestMess = data.transactions?.find((t: any) => t.transactionType === 'MESS');
        if (latestMess && Number(latestMess.amount) > 0) {
          setCustomMessFee(String(latestMess.amount));
        } else {
          setCustomMessFee('2000');
        }
      }).catch(console.error);
    } else {
      StudentAPI.getNextRegsiName().then(res => {
        if (res && res.nextRegsiName) {
          setFormData(prev => ({ ...prev, manualRegsiName: res.nextRegsiName }));
        }
      }).catch(console.error);
    }
  }, [editId]);


  const submitAdmission = async () => {
    if (!formData.name.trim()) return toast.error('Please enter the Full Name');
    if (!formData.mobileNo.trim()) return toast.error('Please enter the Mobile Number');
    if (formData.mobileNo.length !== 10) return toast.error('Mobile Number must be exactly 10 digits');
    if (!formData.gender) return toast.error('Please select a Gender');
    if (!selectedRoom) return toast.error('Please assign a vacant room to the student');

    setIsSubmitting(true);
    try {
      let result;
      if (editId) {
        result = await StudentAPI.update(editId, {
          ...formData,
          roomNo: selectedRoom.id || selectedRoom.value,
          bedNo: formData.bedNo || undefined,
          rent: Number(customRent) || 0,
          messFee: Number(customMessFee) || 2000,
          photoUrl: capturedImage || undefined,
          doc1Url: doc1Url || undefined,
          doc2Url: doc2Url || undefined
        });
      } else {
        result = await StudentAPI.create({
          ...formData,
          roomNo: selectedRoom?.value || selectedRoom?.id,
          bedNo: formData.bedNo || undefined,
          advance: Number(formData.advance) || 0,
          rent: Number(customRent) || 0,
          messFee: Number(customMessFee) || 0,
          autoGenerateInvoice: autoGenerateInvoice,

          photoUrl: capturedImage || undefined,
          doc1Url: doc1Url || undefined,
          doc2Url: doc2Url || undefined
        });
      }

      toast.success(editId ? 'Update Successful!' : 'Admission Successful!');
      setRegisteredStudent(result);
      window.scrollTo(0, 0);
    } catch (e: any) {
      toast.error(e.message || 'Admission failed');
    } finally {
      setIsSubmitting(false);
    }
  };


  const [roomOptions, setRoomOptions] = useState<any[]>([]);

  React.useEffect(() => {
    RoomAPI.findAll().then((rooms) => {
      const options = rooms
        .filter((room: any) => (room.capacity - (room.occupiedCount || 0)) > 0)
        .map((room: any) => {
          const occupied = room.occupiedCount || 0;
          const freeBeds = room.capacity - occupied;

          return {
            value: room.id,
            label: `Room ${room.id} (${room.type} • Rent: ₹${(room.rent || 0).toLocaleString('en-IN')} • ${occupied} occupied / ${room.capacity} total • ${freeBeds} free)`,
            room,
          };
        });
      setRoomOptions(options);
    }).catch(console.error);
  }, []);

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



  if (registeredStudent) {
    const collegeName = collegesList.find(c => c.id === registeredStudent.collegeId)?.name;
    return (
      <StudentAcknowledgementCard
        student={registeredStudent}
        collegeName={collegeName}
        onBack={() => {
          setRegisteredStudent(null);
          if (!editId) {
            setFormData({
              name: '', manualRegsiName: '', mobileNo: '', gender: 'Female', emailId: '', address: '', dob: '',
              fatherName: '', fatherMobileNo: '', motherName: '', motherMobileNo: '', guardianName: '', guardianMobileNo: '',
              emergencyContact: '', collegeId: '', educationalQua: '', advance: '',
              maritalStatus: 'Single', aadharNo: '', secondaryIdNo: '', bedNo: '',
              bloodGroup: '', dateOfJoining: new Date().toLocaleDateString('en-CA'), vsrLedger1: '', pursuingYear: '',
              category: '', foodType: '', courseDuration: '', biometricId: ''
            });
            setCapturedImage(null);
            setDoc1Url(null);
            setDoc2Url(null);
            setSelectedRoom(null);
          } else {
            navigate('/hostellers');
          }
        }}
      />
    );
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Student Admission Registration"
        subtitle="Enroll a new hosteller, capture photo, upload KYC documents, and assign room bed"
        icon={<UserPlus size={24} color="#fff" />}
        rightContent={
          <>
            <button onClick={() => navigate(-1)} className="ui-btn ui-btn-secondary">
              <ArrowLeft size={16} /> Cancel
            </button>
            <button onClick={submitAdmission} disabled={isSubmitting} className="ui-btn ui-btn-primary">
              <CheckCircle2 size={16} /> {isSubmitting ? 'Processing...' : 'Complete Registration'}
            </button>
          </>
        }
      />

      <div className="register-layout">

        {/* Left Column */}
        <div className="register-main">
          {/* Section 1 */}
          <div className="ui-card ui-card-body">
            <h3 className="register-section-title">
              Personal & Contact Information
            </h3>

            <div className="register-flex-row">
              {/* Photo Upload */}
              <div className="register-photo">
                <div className="register-photo-frame">
                  {isCameraOpen ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline></video>
                      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                    </>
                  ) : isUploadingPhoto ? (
                    <>
                      <div className="register-spin"></div>
                      <span className="register-uploading">Uploading...</span>
                    </>
                  ) : capturedImage ? (
                    <img src={capturedImage} alt="Captured" />
                  ) : (
                    <>
                      <Camera size={32} className="register-photo-icon" />
                      <span className="register-photo-placeholder">No Photo</span>
                    </>
                  )}
                </div>

                {isCameraOpen ? (
                  <div className="register-photo-actions">
                    <button onClick={takePhoto} type="button" className="ui-btn ui-btn-success">
                      Snap!
                    </button>
                    <button onClick={stopCamera} type="button" className="ui-btn ui-btn-danger">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="register-photo-actions">
                    <button onClick={startCamera} type="button" className="ui-btn ui-btn-primary">
                      <Camera size={14} /> {capturedImage ? 'Retake' : 'Capture'}
                    </button>
                    <label className="ui-btn ui-btn-secondary">
                      <Upload size={14} /> Browse
                      <input type="file" accept="image/*" onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          setIsUploadingPhoto(true);
                          const url = await uploadFile(e.target.files[0]);
                          if (url) setCapturedImage(url);
                          setIsUploadingPhoto(false);
                        }
                      }} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}

                <div className="register-hint">Supported formats: JPG, JPEG, PNG, WEBP (Max 5MB)</div>
              </div>

              {/* Form Fields */}
              <div className="register-form-grid">

                <div>
                  <label className="ui-label">Manual Regsi Name <span className="register-required">*</span></label>
                  <input type="text" value={formData.manualRegsiName} onChange={e => setFormData({ ...formData, manualRegsiName: e.target.value })} className="ui-input register-input-muted" />
                </div>
                <div>
                  <label className="ui-label">Biometric ID</label>
                  <input value={formData.biometricId} onChange={e => setFormData({ ...formData, biometricId: e.target.value })} type="text" placeholder="e.g. Device ID" className="ui-input" />
                </div>
                <div>
                  <label className="ui-label">Full Name <span className="register-required">*</span></label>
                  <input type="text" placeholder="e.g. Ramesh Kumar" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="ui-input" />
                </div>
                <div>
                  <label className="ui-label">Gender <span className="register-required">*</span></label>
                  <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="ui-select">
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="ui-label">Marital Status</label>
                  <select value={formData.maritalStatus} onChange={e => setFormData({ ...formData, maritalStatus: e.target.value })} className="ui-select">
                    <option>Single</option>
                    <option>Married</option>
                  </select>
                </div>
                <div>
                  <label className="ui-label">Date of Birth</label>
                  <input value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} type="date" className="ui-input" />
                </div>
                <div>
                  <label className="ui-label">Mobile Number <span className="register-required">*</span></label>
                  <input type="text" placeholder="10-digit mobile" value={formData.mobileNo} onChange={e => setFormData({ ...formData, mobileNo: sanitizeMobile(e.target.value) })} maxLength={10} className={`ui-input ${mobileClass(formData.mobileNo)}`} />
                </div>
                <div>
                  <label className="ui-label">Email Address</label>
                  <input value={formData.emailId} onChange={e => setFormData({ ...formData, emailId: e.target.value })} type="email" placeholder="student@example.com" className="ui-input" />
                </div>
                <div>
                  <label className="ui-label">Blood Group</label>
                  <select value={formData.bloodGroup} onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })} className="ui-select">
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div>
                  <label className="ui-label">Aadhar Number</label>
                  <input value={formData.aadharNo} onChange={e => setFormData({ ...formData, aadharNo: e.target.value })} type="text" placeholder="12-digit Aadhar" className="ui-input" />
                </div>

                <div>
                  <label className="ui-label">Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="ui-select">
                    <option value="">Select Category</option>
                    <option value="Student">Student</option>
                    <option value="Job Seeker">Job Seeker</option>
                    <option value="Working Professional">Working Professional</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="ui-label">Food Type</label>
                  <select value={formData.foodType} onChange={e => setFormData({ ...formData, foodType: e.target.value })} className="ui-select">
                    <option value="">Select</option>
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                  </select>
                </div>
                <div className="register-span-2">
                  <label className="ui-label">Permanent Home Address</label>
                  <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Street, City, State, Pincode" rows={3} className="ui-textarea"></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="ui-card ui-card-body">
            <h3 className="register-section-title">
              Parents, Guardian & Academic Info
            </h3>
            <div className="register-grid-2">
              <div>
                <label className="ui-label">Father's Name</label>
                <input value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} type="text" placeholder="Optional" className="ui-input" />
              </div>
              <div>
                <label className="ui-label">Father's Mobile</label>
                <input value={formData.fatherMobileNo} onChange={e => setFormData({ ...formData, fatherMobileNo: sanitizeMobile(e.target.value) })} type="text" placeholder="Optional" maxLength={10} className={`ui-input ${mobileClass(formData.fatherMobileNo)}`} />
              </div>
              <div>
                <label className="ui-label">Mother's Name</label>
                <input value={formData.motherName} onChange={e => setFormData({ ...formData, motherName: e.target.value })} type="text" placeholder="Optional" className="ui-input" />
              </div>
              <div>
                <label className="ui-label">Mother's Mobile</label>
                <input value={formData.motherMobileNo} onChange={e => setFormData({ ...formData, motherMobileNo: sanitizeMobile(e.target.value) })} type="text" placeholder="Optional" maxLength={10} className={`ui-input ${mobileClass(formData.motherMobileNo)}`} />
              </div>
              <div>
                <label className="ui-label">Guardian's Name</label>
                <input value={formData.guardianName} onChange={e => setFormData({ ...formData, guardianName: e.target.value })} type="text" placeholder="Optional" className="ui-input" />
              </div>
              <div>
                <label className="ui-label">Guardian's Mobile</label>
                <input value={formData.guardianMobileNo} onChange={e => setFormData({ ...formData, guardianMobileNo: sanitizeMobile(e.target.value) })} type="text" placeholder="Optional" maxLength={10} className={`ui-input ${mobileClass(formData.guardianMobileNo)}`} />
              </div>
              <div>
                <label className="ui-label">Emergency Contact Number</label>
                <input value={formData.emergencyContact} onChange={e => setFormData({ ...formData, emergencyContact: sanitizeMobile(e.target.value) })} type="text" placeholder="Mandatory contact" maxLength={10} className={`ui-input ${mobileClass(formData.emergencyContact)}`} />
              </div>
              <div></div>
              <div className="ui-divider register-span-2"></div>
              <div>
                <label className="ui-label">College or Workplace Name</label>
                <Select
                  options={collegesList.map(c => ({ value: c.id, label: c.name }))}
                  value={formData.collegeId ? { value: formData.collegeId, label: collegesList.find(c => c.id === formData.collegeId)?.name || '' } : null}
                  onChange={(option: any) => setFormData({ ...formData, collegeId: option ? option.value : '' })}
                  isClearable
                  placeholder="Select college"
                  styles={{ control: (base) => ({ ...base, borderRadius: '6px', borderColor: '#cbd5e1', fontSize: '14px' }) }}
                />
              </div>
              <div>
                <label className="ui-label">Course / Department / Designation</label>
                <input value={formData.educationalQua} onChange={e => setFormData({ ...formData, educationalQua: e.target.value })} type="text" placeholder="e.g. B.Tech IT / Junior Developer" className="ui-input" />
              </div>
              <div>
                <label className="ui-label">Course Duration</label>
                <input value={formData.courseDuration} onChange={e => setFormData({ ...formData, courseDuration: e.target.value })} type="text" placeholder="e.g. 4 Years" className="ui-input" />
              </div>
              <div>
                <label className="ui-label">Pursuing Year / Passing Year</label>
                <input value={formData.pursuingYear} onChange={e => setFormData({ ...formData, pursuingYear: e.target.value })} type="text" placeholder="e.g. 1st Year / 2026" className="ui-input" />
              </div>
              <div>
                <label className="ui-label">VSR Ledger-1</label>
                <input value={formData.vsrLedger1} onChange={e => setFormData({ ...formData, vsrLedger1: e.target.value })} type="text" placeholder="e.g. Ledger ref" className="ui-input" />
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="ui-card ui-card-body">
            <h3 className="register-section-title">
              Verification Documents (Upload 2 ID Proofs)
            </h3>
            <p className="register-doc-hint"><Info size={14} color="#0d6efd" /> Mandatory KYC verification documents for hostel record compliance</p>

            <div className="register-doc-grid">
              {/* Doc 1 */}
              <div className="register-doc">
                <div className="register-doc-title">Document 1: Primary ID Proof</div>
                <div className="register-doc-stack">
                  <div>
                    <label className="ui-label">Document Type</label>
                    <select className="ui-select">
                      <option>Aadhar Card</option>
                      <option>PAN Card</option>
                      <option>Passport</option>
                    </select>
                  </div>
                  <div>
                    <label className="ui-label">Document / ID Number (Optional)</label>
                    <input value={formData.aadharNo} onChange={e => setFormData({ ...formData, aadharNo: e.target.value })} type="text" placeholder="e.g. 1234-5678-9012" className="ui-input" />
                  </div>
                  <div>
                    <label className="ui-label">Upload File (PDF / Image)</label>
                    <label className={`ui-dropzone${doc1Url ? ' done' : ''}`}>
                      {isUploadingDoc1 ? (
                        <span className="register-uploading">Uploading...</span>
                      ) : doc1Url ? (
                        <>
                          <CheckCircle2 size={20} />
                          <div className="register-upload-done">Uploaded Successfully</div>
                        </>
                      ) : (
                        <>
                          <Upload size={20} />
                          <div className="register-upload-cta"><strong>Click to upload</strong> or drag and drop</div>
                        </>
                      )}
                      <input type="file" accept="image/*,.pdf" onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          setIsUploadingDoc1(true);
                          const url = await uploadFile(e.target.files[0]);
                          if (url) setDoc1Url(url);
                          setIsUploadingDoc1(false);
                        }
                      }} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>
              {/* Doc 2 */}
              <div className="register-doc">
                <div className="register-doc-title">Document 2: Secondary / College Proof</div>
                <div className="register-doc-stack">
                  <div>
                    <label className="ui-label">Document Type</label>
                    <select className="ui-select">
                      <option>College Student ID</option>
                      <option>Driving License</option>
                      <option>Voter ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="ui-label">Document / ID Number (Optional)</label>
                    <input value={formData.secondaryIdNo} onChange={e => setFormData({ ...formData, secondaryIdNo: e.target.value })} type="text" placeholder="e.g. REG-7890" className="ui-input" />
                  </div>
                  <div>
                    <label className="ui-label">Upload File (PDF / Image)</label>
                    <label className={`ui-dropzone${doc2Url ? ' done' : ''}`}>
                      {isUploadingDoc2 ? (
                        <span className="register-uploading">Uploading...</span>
                      ) : doc2Url ? (
                        <>
                          <CheckCircle2 size={20} />
                          <div className="register-upload-done">Uploaded Successfully</div>
                        </>
                      ) : (
                        <>
                          <Upload size={20} />
                          <div className="register-upload-cta"><strong>Click to upload</strong> or drag and drop</div>
                        </>
                      )}
                      <input type="file" accept="image/*,.pdf" onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          setIsUploadingDoc2(true);
                          const url = await uploadFile(e.target.files[0]);
                          if (url) setDoc2Url(url);
                          setIsUploadingDoc2(false);
                        }
                      }} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="register-supported">Supported formats: PDF, JPG, PNG, WEBP (Max 5MB each).</div>
          </div>

        </div>

        {/* Right Column */}
        <div className="register-side">
          {/* Section 4 */}
          <div className="ui-card ui-card-body">
            <h3 className="register-section-title">
              Room & Bed Allotment
            </h3>
            <div className="ui-stack">
              <div>
                <label className="ui-label">Assign Vacant Room <span className="register-required">*</span></label>
                <Select
                  options={roomOptions}
                  value={selectedRoom}
                  onChange={(option) => {
                    setSelectedRoom(option);
                    if (option && option.room) {
                      setCustomRent(option.room.rent != null && Number(option.room.rent) > 0 ? String(option.room.rent) : '');
                      setCustomMessFee('2000');
                    } else {
                      setCustomRent('');
                      setCustomMessFee('2000');
                    }
                  }}
                  placeholder="-- Choose Vacant Room --"
                  styles={selectStyles}
                  isSearchable={true}
                  isClearable={true}
                />
                <div className="ui-hint">Only rooms with vacant capacity are listed.</div>
                {selectedRoom && selectedRoom.room && (
                  <div className="ui-hint">
                    <div>Occupied: <strong>{selectedRoom.room.occupiedCount || 0}</strong></div>
                    <div>Free: <strong>{selectedRoom.room.capacity - (selectedRoom.room.occupiedCount || 0)}</strong></div>
                    <div>Total: <strong>{selectedRoom.room.capacity}</strong></div>
                  </div>
                )}

                {selectedRoom && selectedRoom.room && (
                  <div className="register-calc">
                    <div className="register-calc-title">
                      <Calculator size={16} color="#3b82f6" /> Monthly Room & Mess Charges:
                    </div>
                    <div className="register-calc-row">
                      <span>Monthly Rent (₹):</span>
                      <input
                        type="number"
                        value={customRent === '0' ? '' : customRent}
                        onChange={(e) => setCustomRent(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="ui-input register-calc-input"
                        placeholder="e.g. 8500"
                      />
                    </div>
                    {selectedRoom.room.rent != null && customRent !== '' && Number(customRent) !== Number(selectedRoom.room.rent) ? (
                      <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '-4px', marginBottom: '8px' }}>
                        * Custom rent applied for this student (Room Master default: ₹{Number(selectedRoom.room.rent).toLocaleString('en-IN')})
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '-4px', marginBottom: '8px' }}>
                        Loaded from Room Master (₹{Number(selectedRoom.room.rent || 0).toLocaleString('en-IN')}). You can edit this rent for this student.
                      </div>
                    )}
                    <div className="register-calc-row">
                      <span>Standard Mess Fee (₹):</span>
                      <input
                        type="number"
                        value={customMessFee}
                        onChange={(e) => setCustomMessFee(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="ui-input register-calc-input"
                        placeholder="2000"
                      />
                    </div>

                    <div className="register-calc-total">
                      <span>Total Monthly Charge:</span>
                      <span className="register-calc-amount">₹{((Number(customRent) || 0) + (Number(customMessFee) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </div>
              <label className="register-checkbox">
                <input type="checkbox" checked={autoGenerateInvoice} onChange={(e) => setAutoGenerateInvoice(e.target.checked)} />
                <div>
                  <div><strong>Auto-generate Month 1 Invoices (Rent & Mess)</strong></div>
                </div>
              </label>

              <div>
                <label className="ui-label">Joining Date <span className="register-required">*</span></label>
                <input type="date" value={formData.dateOfJoining} onChange={e => setFormData({ ...formData, dateOfJoining: e.target.value })} className="ui-input" />
              </div>
            </div>
          </div>

          {/* Section 5 */}
          <div className="ui-card ui-card-body">
            <h3 className="register-section-title">
              Security Deposit (Advance)
            </h3>
            <div className="ui-stack">
              <div>
                <label className="ui-label">Advance Amount (₹)</label>
                <input type="number" value={formData.advance} onChange={(e) => setFormData({ ...formData, advance: e.target.value })} disabled={!!editId} className="ui-input" />
                <div className="register-note">
                  {editId ? <span className="register-note-danger">Advance amounts cannot be modified here. Please use the Fees module.</span> : 'Refundable upon exit/discontinuation settlement.'}
                </div>
              </div>
              <div>
                <label className="ui-label">Payment Mode</label>
                <select disabled={!!editId} className="ui-select">
                  <option>UPI / GPay / PhonePe</option>
                  <option>Cash</option>
                  <option>Bank Transfer / NEFT</option>
                  <option>Card</option>
                </select>
              </div>
              <div>
                <label className="ui-label">Advance Receipt #</label>
                <input type="text" defaultValue="REC-ADV-20260925-211" readOnly className="ui-input register-input-muted" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="register-actions">
            <button className="ui-btn ui-btn-secondary">Cancel</button>
            <button onClick={submitAdmission} disabled={isSubmitting} className="ui-btn ui-btn-primary">
              <CheckCircle2 size={18} /> {isSubmitting ? 'Processing...' : editId ? 'Update Admission' : 'Complete Admission'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
