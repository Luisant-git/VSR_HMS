import React, { useState, useRef } from 'react';
import { Camera, Info, CheckCircle2, Upload, ArrowLeft, Calculator } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { toast } from 'react-toastify';
import { StudentAPI } from '../api/student.api';
import { UploadAPI } from '../api/upload.api';
import { RoomAPI } from '../api/room.api';
import { CollegeAPI } from '../api/college.api';
import Swal from 'sweetalert2';

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
  const [formData, setFormData] = useState({
    name: '', mobileNo: '', gender: 'Female', emailId: '', address: '', dob: '',
    fatherName: '', fatherMobileNo: '', motherName: '', motherMobileNo: '', guardianName: '', guardianMobileNo: '',
    emergencyContact: '', collegeId: '', educationalQua: '', advance: '',
    maritalStatus: 'Single', aadharNo: '', secondaryIdNo: '', bedNo: '',
    bloodGroup: '', dateOfJoining: new Date().toLocaleDateString('en-CA'), vsrLedger1: '', pursuingYear: '',
    category: '', foodType: '', courseDuration: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);
  const [collegesList, setCollegesList] = useState<any[]>([]);
  const [customRent, setCustomRent] = useState<string>('');
  const [customMessFee, setCustomMessFee] = useState<string>('');

  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  React.useEffect(() => {
    CollegeAPI.findAll({ limit: 1000 }).then(response => setCollegesList(response.data || [])).catch(() => {});
    if (editId) {
      StudentAPI.findOne(editId).then(data => {
        setFormData({
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
          courseDuration: data.courseDuration || ''
        });
        if (data.photoUrl) setCapturedImage(data.photoUrl);
        if (data.doc1Url) setDoc1Url(data.doc1Url);
        if (data.doc2Url) setDoc2Url(data.doc2Url);
        if (data.room) {
          setSelectedRoom({
            value: data.room.id,
            label: `Room ${data.room.id} (${data.room.type || ''})`
          });
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
      if (editId) {
        await StudentAPI.update(editId, {
          ...formData,
          roomNo: selectedRoom.id || selectedRoom.value,
          bedNo: formData.bedNo || undefined,
          photoUrl: capturedImage || undefined,
          doc1Url: doc1Url || undefined,
          doc2Url: doc2Url || undefined
        });
      } else {
        await StudentAPI.create({
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

      await Swal.fire({
        title: editId ? 'Update Successful!' : 'Admission Successful!',
        text: editId
          ? `Hosteller ${formData.name}'s details have been updated.`
          : `Hosteller ${formData.name} has been assigned to Room ${selectedRoom?.label?.split('(')[0]?.trim() || selectedRoom?.roomNo}.`,
        icon: 'success',
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Go to Hostellers Directory',
        timer: 4000,
        timerProgressBar: true,
        showClass: { popup: 'animate__animated animate__zoomIn' },
        hideClass: { popup: 'animate__animated animate__fadeOut' }
      });
      navigate('/hostellers');
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
            label: `Room ${room.id} (${room.type} • ${occupied} occupied / ${room.capacity} total • ${freeBeds} free)`,
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
            <button onClick={submitAdmission} disabled={isSubmitting} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)', opacity: isSubmitting ? 0.7 : 1 }}>
              <CheckCircle2 size={16} /> {isSubmitting ? 'Processing...' : 'Complete Registration'}
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
                <div style={{ width: '150px', height: '150px', background: '#f8f9fa', borderRadius: '12px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', marginBottom: '15px', overflow: 'hidden', position: 'relative' }}>
                  {isCameraOpen ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
                      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                    </>
                  ) : isUploadingPhoto ? (
                    <>
                      <div style={{ width: '24px', height: '24px', border: '3px solid #cbd5e1', borderTopColor: 'var(--sidebar-active)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '8px' }}></div>
                      <style>{'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'}</style>
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>Uploading...</span>
                    </>
                  ) : capturedImage ? (
                    <img src={capturedImage} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <Camera size={32} style={{ marginBottom: '8px', color: '#94a3b8' }} />
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>No Photo</span>
                    </>
                  )}
                </div>

                {isCameraOpen ? (
                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: '10px' }}>
                    <button onClick={takePhoto} type="button" style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      Snap!
                    </button>
                    <button onClick={stopCamera} type="button" style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: '10px' }}>
                    <button onClick={startCamera} type="button" style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: 'var(--sidebar-active)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Camera size={14} /> {capturedImage ? 'Retake' : 'Capture'}
                    </button>
                    <label style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: 'white', color: 'var(--sidebar-active)', border: '1px solid var(--sidebar-active)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
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

                <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>Supported formats: JPG, JPEG, PNG, WEBP (Max 5MB)</div>
              </div>

              {/* Form Fields */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Student ID <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" defaultValue="HST-2026-015" readOnly style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8f9fa', color: '#64748b', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" placeholder="e.g. Ramesh Kumar" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Gender <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Marital Status</label>
                  <select value={formData.maritalStatus} onChange={e => setFormData({ ...formData, maritalStatus: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
                    <option>Single</option>
                    <option>Married</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Date of Birth</label>
                  <input value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} type="date" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" placeholder="10-digit mobile" value={formData.mobileNo} onChange={e => setFormData({ ...formData, mobileNo: sanitizeMobile(e.target.value) })} maxLength={10} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none' }} className={mobileClass(formData.mobileNo)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address</label>
                  <input value={formData.emailId} onChange={e => setFormData({ ...formData, emailId: e.target.value })} type="email" placeholder="student@example.com" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Blood Group</label>
                  <select value={formData.bloodGroup} onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Aadhar Number</label>
                  <input value={formData.aadharNo} onChange={e => setFormData({ ...formData, aadharNo: e.target.value })} type="text" placeholder="12-digit Aadhar" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
                    <option value="">Select Category</option>
                    <option value="Student">Student</option>
                    <option value="Job Seeker">Job Seeker</option>
                    <option value="Working Professional">Working Professional</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Food Type</label>
                  <select value={formData.foodType} onChange={e => setFormData({ ...formData, foodType: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}>
                    <option value="">Select</option>
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Permanent Home Address</label>
                  <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Street, City, State, Pincode" rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Parents, Guardian & Academic Info
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Father's Name</label>
                <input value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} type="text" placeholder="Optional" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Father's Mobile</label>
                <input value={formData.fatherMobileNo} onChange={e => setFormData({ ...formData, fatherMobileNo: sanitizeMobile(e.target.value) })} type="text" placeholder="Optional" maxLength={10} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none' }} className={mobileClass(formData.fatherMobileNo)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Mother's Name</label>
                <input value={formData.motherName} onChange={e => setFormData({ ...formData, motherName: e.target.value })} type="text" placeholder="Optional" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Mother's Mobile</label>
                <input value={formData.motherMobileNo} onChange={e => setFormData({ ...formData, motherMobileNo: sanitizeMobile(e.target.value) })} type="text" placeholder="Optional" maxLength={10} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none' }} className={mobileClass(formData.motherMobileNo)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Guardian's Name</label>
                <input value={formData.guardianName} onChange={e => setFormData({ ...formData, guardianName: e.target.value })} type="text" placeholder="Optional" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Guardian's Mobile</label>
                <input value={formData.guardianMobileNo} onChange={e => setFormData({ ...formData, guardianMobileNo: sanitizeMobile(e.target.value) })} type="text" placeholder="Optional" maxLength={10} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none' }} className={mobileClass(formData.guardianMobileNo)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Emergency Contact Number</label>
                <input value={formData.emergencyContact} onChange={e => setFormData({ ...formData, emergencyContact: sanitizeMobile(e.target.value) })} type="text" placeholder="Mandatory contact" maxLength={10} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none' }} className={mobileClass(formData.emergencyContact)} />
              </div>
              <div></div>
              <div style={{ gridColumn: 'span 2', height: '1px', background: 'var(--border-color)', margin: '5px 0' }}></div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>College or Workplace Name</label>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Course / Department / Designation</label>
                <input value={formData.educationalQua} onChange={e => setFormData({ ...formData, educationalQua: e.target.value })} type="text" placeholder="e.g. B.Tech IT / Junior Developer" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Course Duration</label>
                <input value={formData.courseDuration} onChange={e => setFormData({ ...formData, courseDuration: e.target.value })} type="text" placeholder="e.g. 4 Years" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Pursuing Year / Passing Year</label>
                <input value={formData.pursuingYear} onChange={e => setFormData({ ...formData, pursuingYear: e.target.value })} type="text" placeholder="e.g. 1st Year / 2026" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>VSR Ledger-1</label>
                <input value={formData.vsrLedger1} onChange={e => setFormData({ ...formData, vsrLedger1: e.target.value })} type="text" placeholder="e.g. Ledger ref" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
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
                    <input value={formData.aadharNo} onChange={e => setFormData({ ...formData, aadharNo: e.target.value })} type="text" placeholder="e.g. 1234-5678-9012" style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Upload File (PDF / Image)</label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', border: doc1Url ? '1.5px solid #10b981' : '1.5px dashed #cbd5e1', borderRadius: '6px', background: doc1Url ? '#f0fdf4' : 'white', cursor: 'pointer', transition: 'border 0.2s, background 0.2s' }}>
                      {isUploadingDoc1 ? (
                        <span style={{ fontSize: '13px', color: '#0d6efd', fontWeight: 600 }}>Uploading...</span>
                      ) : doc1Url ? (
                        <>
                          <CheckCircle2 size={20} color="#10b981" />
                          <div style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>Uploaded Successfully</div>
                        </>
                      ) : (
                        <>
                          <Upload size={20} color="#64748b" />
                          <div style={{ fontSize: '13px', color: '#64748b' }}><span style={{ color: '#0d6efd', fontWeight: 600 }}>Click to upload</span> or drag and drop</div>
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
                    <input value={formData.secondaryIdNo} onChange={e => setFormData({ ...formData, secondaryIdNo: e.target.value })} type="text" placeholder="e.g. REG-7890" style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Upload File (PDF / Image)</label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', border: doc2Url ? '1.5px solid #10b981' : '1.5px dashed #cbd5e1', borderRadius: '6px', background: doc2Url ? '#f0fdf4' : 'white', cursor: 'pointer', transition: 'border 0.2s, background 0.2s' }}>
                      {isUploadingDoc2 ? (
                        <span style={{ fontSize: '13px', color: '#0d6efd', fontWeight: 600 }}>Uploading...</span>
                      ) : doc2Url ? (
                        <>
                          <CheckCircle2 size={20} color="#10b981" />
                          <div style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>Uploaded Successfully</div>
                        </>
                      ) : (
                        <>
                          <Upload size={20} color="#64748b" />
                          <div style={{ fontSize: '13px', color: '#64748b' }}><span style={{ color: '#0d6efd', fontWeight: 600 }}>Click to upload</span> or drag and drop</div>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Assign Vacant Room <span style={{ color: '#ef4444' }}>*</span></label>
                <Select
                  options={roomOptions}
                  value={selectedRoom}
                  onChange={(option) => {
                    setSelectedRoom(option);
                    if (option && option.room) {
                      setCustomRent('0');
                      setCustomMessFee('2000');
                    } else {
                      setCustomRent('');
                      setCustomMessFee('');
                    }
                  }}
                  placeholder="-- Choose Vacant Room --"
                  styles={selectStyles}
                  isSearchable={true}
                  isClearable={true}
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Only rooms with vacant capacity are listed.</div>
{selectedRoom && selectedRoom.room && (
    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
      <div>Occupied: <strong>{selectedRoom.room.occupiedCount || 0}</strong></div>
      <div>Free: <strong>{selectedRoom.room.capacity - (selectedRoom.room.occupiedCount || 0)}</strong></div>
      <div>Total: <strong>{selectedRoom.room.capacity}</strong></div>
    </div>
)}

                {selectedRoom && selectedRoom.room && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>
                      <Calculator size={16} color="#3b82f6" /> Monthly Room & Mess Charges:
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>Base Room Rent:</span>
                      <input type="number" value={customRent} onChange={(e) => setCustomRent(e.target.value)} style={{ width: '120px', padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>Standard Mess Fee:</span>
                      <input type="number" value={customMessFee} onChange={(e) => setCustomMessFee(e.target.value)} style={{ width: '120px', padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>

                    <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: '#0f172a', flexWrap: 'wrap' }}>
                      <span>Total Monthly Charge:</span>
                      <span style={{ color: '#0d6efd' }}>₹{((Number(customRent) || 0) + (Number(customMessFee) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoGenerateInvoice} onChange={(e) => setAutoGenerateInvoice(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0d6efd' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Auto-generate Month 1 Invoices (Rent & Mess)</div>
                  </div>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Joining Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="date" value={formData.dateOfJoining} onChange={e => setFormData({ ...formData, dateOfJoining: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }} />
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
                <input type="number" value={formData.advance} onChange={(e) => setFormData({ ...formData, advance: e.target.value })} disabled={!!editId} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: editId ? '#f1f5f9' : 'white', cursor: editId ? 'not-allowed' : 'text' }} />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {editId ? <span style={{ color: '#ef4444' }}>Advance amounts cannot be modified here. Please use the Fees module.</span> : 'Refundable upon exit/discontinuation settlement.'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Mode</label>
                <select disabled={!!editId} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: editId ? '#f1f5f9' : 'white', cursor: editId ? 'not-allowed' : 'pointer' }}>
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
            <button onClick={submitAdmission} disabled={isSubmitting} style={{ padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)', opacity: isSubmitting ? 0.7 : 1 }}>
              <CheckCircle2 size={18} /> {isSubmitting ? 'Processing...' : editId ? 'Update Admission' : 'Complete Admission'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
