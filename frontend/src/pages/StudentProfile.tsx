import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, User, ShieldCheck, MapPin, Phone, FileText, CreditCard, Clock, Lock, CheckCircle2, Camera, Wallet, LogOut, Bed, X, Upload } from 'lucide-react';
import { UploadAPI } from '../api/upload.api';
import { StudentAPI } from '../api/student.api';
import { FeesAPI } from '../api/fees.api';
import { gateLogApi } from '../api/gatelog.api';
import { OutpassAPI } from '../api/outpass.api';
import { ReceiptModal } from '../components/ReceiptModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { toast } from 'react-toastify';

const StudentProfile = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('tab') === 'fees') return 'Fees & Receipts';
    return 'Master Profile';
  });
  const [student, setStudent] = useState<any>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [gateLogs, setGateLogs] = useState<any[]>([]);
  const [outpasses, setOutpasses] = useState<any[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  
  const displayFees = useMemo(() => {
    const pendingGroup = {
      isGrouped: true,
      id: 'pending-group',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      totalAmount: 0,
      rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
      feesList: [] as any[]
    };
    const paidByBatch = new Map();

    fees.forEach(f => {
      const type = (f.transactionType || '').toUpperCase();
      let category = 'other';
      if (type.includes('RENT')) category = 'rent';
      else if (type.includes('EB') || type.includes('ELECTRIC')) category = 'eb';
      else if (type.includes('MESS')) category = 'mess';
      else if (type.includes('FINE')) category = 'fine';
      else if (type.includes('ADVANCE')) category = 'advance';

      if (f.status === 'PENDING') {
        pendingGroup.totalAmount += f.amount;
        (pendingGroup as any)[category] += f.amount;
        pendingGroup.feesList.push(f);
        if (!pendingGroup.createdAt || new Date(f.createdAt) < new Date(pendingGroup.createdAt)) {
          pendingGroup.createdAt = f.createdAt;
        }
      } else {
        const paidTime = f.updatedAt || f.createdAt;
        const batchKey = new Date(paidTime).toISOString().slice(0, 16);
        if (!paidByBatch.has(batchKey)) {
          paidByBatch.set(batchKey, {
            isGrouped: true,
            id: `paid-${batchKey}`,
            status: f.status,
            createdAt: f.createdAt,
            paidDate: paidTime,
            paymentMode: f.paymentMode || 'N/A',
            totalAmount: 0,
            rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
            feesList: []
          });
        }
        const group = paidByBatch.get(batchKey);
        group.totalAmount += f.amount;
        group[category] += f.amount;
        group.feesList.push(f);
      }
    });

    const result = [];
    if (pendingGroup.feesList.length > 0) result.push(pendingGroup);
    result.push(...Array.from(paidByBatch.values()));
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [fees]);
  const [feeToCollect, setFeeToCollect] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [doc1File, setDoc1File] = useState<File | null>(null);
  const [doc2File, setDoc2File] = useState<File | null>(null);

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

      const updateData: any = {};
      if (photoUrl) updateData.photoUrl = photoUrl;
      if (doc1Url) updateData.doc1Url = doc1Url;
      if (doc2Url) updateData.doc2Url = doc2Url;

      if (Object.keys(updateData).length > 0) {
        if (id) await StudentAPI.update(id, updateData);
        // Refresh local state to show changes instantly
        setStudent({ ...student, ...updateData });
        toast.success('Successfully updated documents!');
      }
      setShowUpdateModal(false);
    } catch (e: any) {
      toast.error('Failed to update: ' + e.message);
    }
    setIsUpdating(false);
  };

  const fetchStudentData = () => {
    if (id) {
      StudentAPI.findOne(id).then(data => {
        setStudent({
          id: data.regNo,
          uuid: data.id,
          name: data.name,
          status: data.status || 'Active',
          room: `${data.roomNo || 'N/A'}`,
          joined: new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          gender: data.gender || 'N/A',
          dob: data.dob ? new Date(data.dob).toLocaleDateString('en-GB') : 'N/A',
          mobile: data.mobileNo,
          email: data.emailId || 'N/A',
          address: data.address || 'N/A',
          college: `${data.college?.name || data.college || 'N/A'} (${data.educationalQua || 'N/A'})`,
          fatherName: data.fatherName,
          fatherMobileNo: data.fatherMobileNo,
          motherName: data.motherName,
          motherMobileNo: data.motherMobileNo,
          guardianName: data.guardianName || 'N/A',
          guardianPhone: data.guardianMobileNo || 'N/A',
          emergencyContact: data.emergencyContact || 'N/A',
          roomType: data.room?.type || 'N/A',
          blockRoom: `Block ${data.room?.block || '-'} - Room ${data.room?.id?.replace(/^[a-zA-Z\\s_-]+/, '') || '-'}`,
          monthlyRent: `₹${data.rent || 0}`,
          photoUrl: data.photoUrl,
          doc1Url: data.doc1Url,
          doc2Url: data.doc2Url,
          doc1Type: data.doc1Type,
          doc2Type: data.doc2Type,
          doc1Number: data.doc1Number,
          doc2Number: data.doc2Number,
          aadharNo: data.aadharNo, 
          secondaryIdNo: data.secondaryIdNo, 
          clearance: data.clearance,
          bloodGroup: data.bloodGroup || 'N/A',
          maritalStatus: data.maritalStatus || 'N/A',
          vsrLedger1: data.vsrLedger1 || 'N/A',
          dateOfJoining: data.dateOfJoining ? new Date(data.dateOfJoining).toLocaleDateString('en-GB') : 'N/A',
          pursuingYear: data.pursuingYear || 'N/A',
          advance: data.advance || 0,
          category: data.category || 'N/A',
          foodType: data.foodType || 'N/A',
          courseDuration: data.courseDuration || 'N/A'
        });
        if (data.id) {
          FeesAPI.findByStudent(data.id).then(setFees).catch(console.error);
        }
        if (data.regNo) {
          gateLogApi.getAll(1, 100, data.regNo).then(res => setGateLogs(res.data || [])).catch(console.error);
        }
        if (data.id) {
          OutpassAPI.findAll().then(res => setOutpasses(res.filter((op: any) => op.studentId === data.id))).catch(console.error);
        }
      }).catch(console.error);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  if (!student) {
    return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>Loading Profile...</div>;
  }

  const renderDocPreview = (url: string, alt: string) => {
    if (url.toLowerCase().endsWith('.pdf')) {
      return (
        <iframe src={`${url}#toolbar=0`} title={alt} style={{ width: '100%', height: '100%', border: 'none', objectFit: 'contain' }} />
      );
    }
    return <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  };

  const tabs = [
    { name: 'Master Profile', icon: <User size={16} /> },
    { name: 'Gate Logs', icon: <Clock size={16} /> },
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
          {student.status !== 'Vacated' && (
            <>
              <button onClick={() => navigate('/fees')} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, background: '#198754', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(25, 135, 84, 0.2)' }}>
                <Wallet size={16} /> Collect Fee
              </button>
              <button onClick={() => navigate('/outpass')} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, background: 'white', border: '1px solid #0d6efd', color: '#0d6efd', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} /> Issue Outpass
              </button>
              <button
                onClick={() => navigate(`/hostellers/clearance/${student.uuid}`)}
                style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, background: 'white', border: '1px solid #dc3545', color: '#dc3545', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <LogOut size={16} /> Checkout Student
              </button>
            </>
          )}
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
            <span style={{ 
              background: student.status === 'Vacated' ? '#f87171' : student.status === 'Out' ? '#fef3c7' : '#dcfce7', 
              color: student.status === 'Vacated' ? 'white' : student.status === 'Out' ? '#92400e' : '#166534', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '12px', 
              fontWeight: 700, 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '4px', 
              marginBottom: '15px' 
            }}>
              <CheckCircle2 size={14} /> {student.status === 'Vacated' ? 'Inactive' : student.status === 'Out' ? 'Active (Out)' : 'Active'}
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
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Category:</span>
                <span>{student.raw?.category || 'N/A'}</span>
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
                {tab.icon} <span style={{ flex: 1 }}>{tab.name} {tab.name === 'Gate Logs' && `(${gateLogs.length})`}</span>
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
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Aadhar Number</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.aadharNo || 'N/A'}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Blood Group</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.bloodGroup}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Gender</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.gender}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Date of Birth</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.dob}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Marital Status</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.maritalStatus}</div>
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
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#8b5cf6" /> Academic & Additional Info
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px' }}>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>VSR Ledger-1</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.vsrLedger1}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Date of Joining</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.dateOfJoining}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Pursuing Year</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.pursuingYear}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Course Duration</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.courseDuration || '-'}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>College / Dept</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.college}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Category</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.category}</div>
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
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Block / Room No</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.blockRoom}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Monthly Rent</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{student.monthlyRent}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Monthly Mess Fee</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>₹{fees.find(f => f.transactionType === 'MESS')?.amount || 0}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Advance Paid</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>₹{student.advance}</div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Food Type</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{student.foodType}</div>
                </div>
              </div>

              {student.status === 'Vacated' && student.clearance && (
                <div style={{ background: '#fef2f2', padding: '25px', borderRadius: '12px', border: '1px solid #fca5a5', marginTop: '25px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                    <LogOut size={20} color="#dc2626" /> Exit & Clearance Details
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#7f1d1d', fontWeight: 600, marginBottom: '5px' }}>Clearance Date</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#450a0a' }}>{new Date(student.clearance.clearanceDate).toLocaleDateString('en-GB')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#7f1d1d', fontWeight: 600, marginBottom: '5px' }}>Exit Reason</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#450a0a' }}>{student.clearance.reason}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#7f1d1d', fontWeight: 600, marginBottom: '5px' }}>Deductions</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>₹{student.clearance.deductions.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#7f1d1d', fontWeight: 600, marginBottom: '5px' }}>Net Refund Settled</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#059669' }}>₹{student.clearance.netRefund.toFixed(2)}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: '#7f1d1d', fontWeight: 600, marginBottom: '5px' }}>Clearance Remarks</div>
                    <div style={{ fontSize: '14px', color: '#450a0a', background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                      {student.clearance.remarks || 'No remarks provided.'}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'KYC Documents' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--sidebar-active)" /> KYC Documents
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                {/* Document 1 Card */}
                {student.doc1Url ? (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    <div style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#1e293b' }}>
                        <FileText size={18} color="#0ea5e9" />
                        <span>Document 1: {student.doc1Type || 'Aadhar Card'}</span>
                      </div>
                      <span style={{ background: '#10b981', color: 'white', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px' }}>Uploaded</span>
                    </div>

                    <div style={{ padding: '20px' }}>
                      <div style={{ marginBottom: '15px' }}>
                        <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>Document Type:</span> {student.doc1Type || 'Aadhar Card'}
                        </div>
                        <div style={{ fontSize: '14px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>Document / ID Number:</span> {student.doc1Number || 'Not Provided'}
                        </div>
                      </div>

                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#f8f9fa', height: '240px', marginBottom: '15px' }}>
                        {renderDocPreview(student.doc1Url, student.doc1Type || "Aadhar Card")}
                      </div>

                      <a
                        href={student.doc1Url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: '#0d6efd', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 500, fontSize: '14px' }}
                      >
                        <Upload size={16} style={{ transform: 'rotate(180deg)' }} /> Open / Download Full Document
                      </a>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '350px', color: '#64748b' }}>
                    No Primary ID Uploaded
                  </div>
                )}

                {/* Document 2 Card */}
                {student.doc2Url ? (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    <div style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#1e293b' }}>
                        <FileText size={18} color="#0ea5e9" />
                        <span>Document 2: {student.doc2Type || 'Secondary ID'}</span>
                      </div>
                      <span style={{ background: '#10b981', color: 'white', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px' }}>Uploaded</span>
                    </div>

                    <div style={{ padding: '20px' }}>
                      <div style={{ marginBottom: '15px' }}>
                        <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>Document Type:</span> {student.doc2Type || 'Secondary ID'}
                        </div>
                        <div style={{ fontSize: '14px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>Document / ID Number:</span> {student.doc2Number || 'Not Provided'}
                        </div>
                      </div>

                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#f8f9fa', height: '240px', marginBottom: '15px' }}>
                        {renderDocPreview(student.doc2Url, student.doc2Type || "Secondary ID")}
                      </div>

                      <a
                        href={student.doc2Url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: '#0d6efd', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 500, fontSize: '14px' }}
                      >
                        <Upload size={16} style={{ transform: 'rotate(180deg)' }} /> Open / Download Full Document
                      </a>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '350px', color: '#64748b' }}>
                    No Secondary ID Uploaded
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Fees & Receipts' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <CreditCard size={20} color="#10b981" /> Fee Transactions
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>Total Paid (Receipts)</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>₹{fees.filter(f => f.status === 'COMPLETED' && f.transactionType !== 'ADVANCE').reduce((sum, f) => sum + f.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>Total Pending Dues</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>₹{fees.filter(f => f.status === 'PENDING').reduce((sum, f) => sum + f.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>

              {fees.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  No fee records found for this student.
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>Receipt No</th>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>Payment Date</th>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Advance</th>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Rent</th>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>EB</th>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Mess</th>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Fine</th>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Total Paid</th>
                        <th style={{ padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>Status</th>
                        <th style={{ textAlign: 'right', padding: '12px 15px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayFees.map(fee => (
                        <tr key={fee.id} style={{ borderBottom: '1px solid #f1f5f9', background: fee.status === 'PENDING' ? '#fff1f2' : 'transparent' }}>
                          <td style={{ padding: '15px', fontSize: '13px', color: '#0d6efd', fontWeight: 700 }}>
                            {fee.status === 'COMPLETED' ? (fee.feesList[0] ? (() => {
                              const f = fee.feesList[0];
                              const ymStr = new Date(f.createdAt).toISOString().slice(0, 7).replace('-', '');
                              const purpose = fee.feesList.length > 1 ? 'MUL' : (f.transactionType || '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'FEE';
                              const studentStr = student?.id || 'UNKN';
                              return `INV-${purpose}-${ymStr}-${studentStr}`;
                            })() : '—') : '—'}
                          </td>
                          <td style={{ padding: '15px', fontSize: '13px', color: '#334155' }}>
                            {fee.status === 'COMPLETED' ? new Date(fee.paidDate || fee.createdAt).toLocaleDateString('en-GB') : '—'}
                          </td>
                          <td style={{ padding: '15px', fontSize: '13px', color: '#198754', fontWeight: 600, textAlign: 'right' }}>₹{fee.advance.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '15px', fontSize: '13px', color: '#334155', textAlign: 'right' }}>₹{fee.rent.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '15px', fontSize: '13px', color: '#334155', textAlign: 'right' }}>₹{fee.eb.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '15px', fontSize: '13px', color: '#334155', textAlign: 'right' }}>₹{fee.mess.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '15px', fontSize: '13px', color: '#334155', textAlign: 'right' }}>₹{fee.fine.toLocaleString('en-IN')}</td>
                          
                          <td style={{ padding: '15px', fontSize: '14px', color: fee.status === 'PENDING' ? '#dc3545' : '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                            ₹{fee.totalAmount.toLocaleString('en-IN')}
                          </td>
                          
                          <td style={{ padding: '15px', fontSize: '12px' }}>
                            <span style={{
                              padding: '4px 8px', borderRadius: '4px', fontWeight: 600,
                              background: fee.status === 'COMPLETED' ? '#dcfce7' : fee.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                              color: fee.status === 'COMPLETED' ? '#166534' : fee.status === 'PENDING' ? '#92400e' : '#991b1b'
                            }}>
                              {fee.status === 'COMPLETED' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '15px' }}>
                            {fee.status === 'PENDING' ? (
                              <button onClick={() => navigate(`/fees?student=${student?.id || student?.uuid}`)} style={{ padding: '6px 14px', fontSize: '13px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Wallet size={14} /> Pay Now
                              </button>
                            ) : (
                              <button onClick={() => setSelectedReceipt({...fee, student: { name: student.name, regNo: student.id, roomNo: student.room }})} style={{ padding: '6px 14px', fontSize: '13px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={14} color="#64748b" /> View Receipt
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Gate Logs' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Clock size={20} color="#0d6efd" /> Gate Movement History
                </h3>
              </div>

              {gateLogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  No gate movements found for this student.
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e2e8f0' }}>
                      <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em' }}>
                        <th style={{ padding: '12px 15px' }}>Movement Status</th>
                        <th style={{ padding: '12px 15px' }}>Purpose</th>
                        <th style={{ padding: '12px 15px' }}>Exit Time</th>
                        <th style={{ padding: '12px 15px' }}>Expected Return</th>
                        <th style={{ padding: '12px 15px' }}>Entry Time</th>
                        <th style={{ padding: '12px 15px' }}>Return Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gateLogs.map(log => {
                        const status = log.movementType === 'ENTRY' || log.inTime ? 'Entry' : 'Exit';
                        const formatDateTime = (dateStr: string | null) => {
                          if (!dateStr) return '—';
                          const d = new Date(dateStr);
                          return <>{d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />{d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</>;
                        };

                        return (
                          <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '15px' }}>
                              {status === 'Entry' ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0d6efd', color: '#ffffff', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, minWidth: '50px' }}>
                                  Entry
                                </div>
                              ) : (
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#64748b', color: '#ffffff', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, minWidth: '50px' }}>
                                  Exit
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '15px', color: '#475569', textTransform: 'capitalize' }}>{log.reason || '—'}</td>
                            <td style={{ padding: '15px', color: '#475569' }}>{formatDateTime(log.outTime)}</td>
                            <td style={{ padding: '15px', color: '#475569' }}>{formatDateTime(log.expectedInTime)}</td>
                            <td style={{ padding: '15px', color: '#475569' }}>{formatDateTime(log.inTime)}</td>
                            <td style={{ padding: '15px', color: '#475569' }}>{log.lateRemarks || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Advance Deposit' && (
            <div style={{ animation: 'fadeIn 0.3s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <ShieldCheck size={48} color="#10b981" style={{ marginBottom: '15px' }} />
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Total Advance Deposit</div>
                <div style={{ fontSize: '42px', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.02em' }}>₹{(student.advance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          )}

          {activeTab === 'Outpasses & Travel' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <MapPin size={20} color="#0d6efd" /> Outpasses & Travel History
                </h3>
              </div>
              {outpasses.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  No outpasses found for this student.
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e2e8f0' }}>
                      <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em' }}>
                        <th style={{ padding: '12px 15px' }}>Destination</th>
                        <th style={{ padding: '12px 15px' }}>Reason</th>
                        <th style={{ padding: '12px 15px' }}>From Date</th>
                        <th style={{ padding: '12px 15px' }}>To Date</th>
                        <th style={{ padding: '12px 15px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outpasses.map(op => (
                        <tr key={op.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '15px', color: '#475569', fontWeight: 600 }}>{op.destination}</td>
                          <td style={{ padding: '15px', color: '#475569' }}>{op.reason}</td>
                          <td style={{ padding: '15px', color: '#475569' }}>{new Date(op.leaveDate).toLocaleDateString('en-GB')}</td>
                          <td style={{ padding: '15px', color: '#475569' }}>{new Date(op.returnDate).toLocaleDateString('en-GB')}</td>
                          <td style={{ padding: '15px' }}>
                            <span style={{
                              padding: '4px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '12px',
                              background: op.status === 'Approved' ? '#dcfce7' : op.status === 'Active Out' ? '#fef3c7' : op.status === 'Closed Returned' ? '#e2e8f0' : '#fee2e2',
                              color: op.status === 'Approved' ? '#166534' : op.status === 'Active Out' ? '#92400e' : op.status === 'Closed Returned' ? '#475569' : '#991b1b'
                            }}>
                              {op.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab !== 'Master Profile' && activeTab !== 'KYC Documents' && activeTab !== 'Fees & Receipts' && activeTab !== 'Gate Logs' && activeTab !== 'Outpasses & Travel' && (
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
                    <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>Primary ID Proof</label>
                    <input type="file" accept="image/*,.pdf" onChange={e => setDoc1File(e.target.files?.[0] || null)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>Secondary ID Proof</label>
                    <input type="file" accept="image/*,.pdf" onChange={e => setDoc2File(e.target.files?.[0] || null)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
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

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal fee={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {/* Collect Payment Modal */}
      {feeToCollect && (
        <CollectPaymentModal
          fee={{ ...feeToCollect, student }}
          onClose={() => setFeeToCollect(null)}
          onSuccess={() => {
            setFeeToCollect(null);
            fetchStudentData(); // Refresh data
          }}
        />
      )}
    </div>
  );
};

export default StudentProfile;
