import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, User, ShieldCheck, MapPin, Phone, FileText, CreditCard, Clock, Lock, CheckCircle2, Camera, Wallet, LogOut, Bed, X, Upload, IdCard, Plus, Trash2, Save, Loader2, DollarSign, Calendar, Home, Zap, ChevronDown } from 'lucide-react';
import { UploadAPI } from '../api/upload.api';
import { StudentAPI } from '../api/student.api';
import { FeesAPI } from '../api/fees.api';
import { gateLogApi } from '../api/gatelog.api';
import { OutpassAPI } from '../api/outpass.api';
import { ReceiptModal } from '../components/ReceiptModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { StudentAcknowledgementCard } from '../components/StudentAcknowledgementCard';
import { LoadingBlock } from '../components/LoadingSpinner';
import { toast } from 'react-toastify';

const formatInvoiceNumber = (fee: any) => {
  const ymStr = new Date(fee.createdAt).toISOString().slice(0, 7).replace('-', '');
  const purpose = fee.transactionType.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  const studentStr = fee.student?.manualRegsiName || fee.student?.regNo || fee.student?.id || 'UNKN';
  return `INV-${purpose}-${ymStr}-${studentStr}`;
};



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
  const [feeToCollect, setFeeToCollect] = useState<any>(null);

  // Outstanding Payment Details state
  const [outstandingRows, setOutstandingRows] = useState<Array<{
    id: string;
    year: number;
    month: number;
    rent: number | string;
    eb: number | string;
  }>>([]);
  const [isSavingOutstanding, setIsSavingOutstanding] = useState(false);
  const [outstandingPayments, setOutstandingPayments] = useState<any[]>([]);

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
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [doc1File, setDoc1File] = useState<File | null>(null);
  const [doc2File, setDoc2File] = useState<File | null>(null);
  const [showIdCard, setShowIdCard] = useState(false);

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
          id: data.manualRegsiName || data.regNo,
          uuid: data.id,
          name: data.name,
          status: data.status || 'Active',
          room: `${data.roomNo || 'N/A'}`,
          joined: new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          gender: data.gender || 'N/A',
          dob: data.dob ? new Date(data.dob).toLocaleDateString('en-GB') : 'N/A',
          mobile: data.mobileNo,
          email: data.emailId || 'N/A',
          address: data.address || 'N/A',
          college: data.college?.name
            ? `${data.college.name}${data.educationalQua ? ` (${data.educationalQua})` : ''}`
            : (data.educationalQua || 'N/A'),
          fatherName: data.fatherName,
          fatherMobileNo: data.fatherMobileNo,
          motherName: data.motherName,
          motherMobileNo: data.motherMobileNo,
          guardianName: data.guardianName || 'N/A',
          guardianPhone: data.guardianMobileNo || 'N/A',
          emergencyContact: data.emergencyContact || 'N/A',
          roomType: data.room?.type || 'N/A',
          blockRoom: `Block ${data.room?.block || '-'} - Room ${data.room?.id?.replace(/^[a-zA-Z\s_-]+/, '') || '-'}`,
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
          biometricId: data.biometricId || 'N/A',
          manualRegsiName: data.manualRegsiName || 'N/A',
          clearance: data.clearance,
          bloodGroup: data.bloodGroup || 'N/A',
          maritalStatus: data.maritalStatus || 'N/A',
          vsrLedger1: data.vsrLedger1 || 'N/A',
          dateOfJoining: data.dateOfJoining ? new Date(data.dateOfJoining).toLocaleDateString('en-GB') : 'N/A',
          pursuingYear: data.pursuingYear || 'N/A',
          advance: data.advance || 0,
          category: data.category || 'N/A',
          foodType: data.foodType || 'N/A',
          courseDuration: data.courseDuration || 'N/A',
          monthlyMessFee: data.room?.messFee || 0
        });
        if (data.id) {
          FeesAPI.findByStudent(data.id).then(res => {
            const feesData = Array.isArray(res) ? res : (res.data || []);
            setFees(feesData);
            // Filter outstanding payments (PENDING outstanding RENT / EB_BILL rows)
            const outstanding = feesData.filter((f: any) => 
              f.status === 'PENDING' && 
              (f.transactionType === 'RENT' || f.transactionType === 'EB_BILL') &&
              /^\s*outstanding\b/i.test(f.description || '')
            );
            setOutstandingPayments(outstanding);
          }).catch(console.error);
        }
        if (data.regNo) {
          gateLogApi.getAll(1, 100, data.regNo).then(res => setGateLogs(Array.isArray(res) ? res : (res.data || []))).catch(console.error);
        }
        if (data.id) {
          OutpassAPI.findAll().then(res => {
            const arr = Array.isArray(res) ? res : (res.data || []);
            setOutpasses(arr.filter((op: any) => op.studentId === data.id));
          }).catch(console.error);
        }
      }).catch(console.error);
    }
  };

  // Outstanding Payment handlers
  const addOutstandingRow = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const newRow = {
      id: `temp-${Date.now()}`,
      year: currentYear,
      month: currentMonth,
      rent: '',
      eb: ''
    };
    setOutstandingRows(prev => [...prev, newRow]);
  };

  const removeOutstandingRow = (id: string) => {
    setOutstandingRows(prev => prev.filter(row => row.id !== id));
  };

  const updateOutstandingRow = (id: string, field: 'year' | 'month' | 'rent' | 'eb', value: string | number) => {
    setOutstandingRows(prev => prev.map(row => {
      let newValue = value;
      if (field === 'rent' || field === 'eb') {
        // Store empty string for display, but convert to number for calculations
        newValue = value === '' ? '' : Number(value);
      } else if (field === 'year' || field === 'month') {
        newValue = value === '' ? 0 : Number(value);
      }
      return row.id === id ? { ...row, [field]: newValue } : row;
    }));
  };

  const getRowRent = (row: any) => row.rent === '' ? 0 : Number(row.rent);
  const getRowEb = (row: any) => row.eb === '' ? 0 : Number(row.eb);
  const getRowYear = (row: any) => row.year === '' || row.year === 0 ? '' : row.year;

  const handleSaveOutstanding = async () => {
    if (!student?.uuid || outstandingRows.length === 0) return;
    
    setIsSavingOutstanding(true);
    try {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      for (const row of outstandingRows) {
        const rentAmount = getRowRent(row);
        const ebAmount = getRowEb(row);
        const yearVal = String(row.year).trim();
        const monthVal = String(row.month).trim();
        const year = (yearVal === '' || yearVal === '0') ? new Date().getFullYear() : Number(row.year);
        const month = (monthVal === '' || monthVal === '0') ? new Date().getMonth() + 1 : Number(row.month);
        
        if (rentAmount > 0) {
          await FeesAPI.create({
            studentId: student.uuid,
            transactionType: 'RENT',
            amount: rentAmount,
            description: `Outstanding Rent for ${monthNames[month - 1]} ${year}`,
            status: 'PENDING'
          });
        }
        if (ebAmount > 0) {
          await FeesAPI.create({
            studentId: student.uuid,
            transactionType: 'EB_BILL',
            amount: ebAmount,
            description: `Outstanding EB Bill for ${monthNames[month - 1]} ${year}`,
            status: 'PENDING'
          });
        }
      }
      
      toast.success('Outstanding payments saved successfully!');
      setOutstandingRows([]);
      fetchStudentData(); // Refresh to show new payments
    } catch (e: any) {
      toast.error('Failed to save: ' + e.message);
    }
    setIsSavingOutstanding(false);
  };

  const getMonthName = (month: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || '';
  };

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  if (!student) {
    return <LoadingBlock text="Loading Profile..." />;
  }

  const renderDocPreview = (url: string, alt: string) => {
    if (url.toLowerCase().endsWith('.pdf')) {
      return (
        <iframe src={`${url}#toolbar=0`} title={alt}></iframe>
      );
    }
    return <img src={url} alt={alt} />;
  };

  const tabs = [
    { name: 'Master Profile', icon: <User size={16} /> },
    { name: 'Outstanding Payments', icon: <DollarSign size={16} /> },
    { name: 'Gate Logs', icon: <Clock size={16} /> },
    { name: 'Fees & Receipts', icon: <CreditCard size={16} /> },
    { name: 'Advance Deposit', icon: <ShieldCheck size={16} /> },
    { name: 'Outpasses & Travel', icon: <MapPin size={16} /> },
    { name: 'KYC Documents', icon: <FileText size={16} /> },
  ];

  return (
    <div className="ui-page">
      <div className="sp-header">
        <div className="sp-header-left">
          <button
            onClick={() => navigate(-1)}
            className="ui-btn ui-btn-secondary sp-back"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <h2 className="sp-title">Student Profile - {student.name}</h2>
            <p className="sp-subtitle">
              Friday, 25 Sep 2026
            </p>
          </div>
        </div>

        <div className="sp-actions">
          <button onClick={() => setShowIdCard(true)} className="ui-btn ui-btn-primary">
            <IdCard size={16} /> View ID Card
          </button>
          <button onClick={() => navigate(`/register?edit=${student.uuid}`)} className="ui-btn ui-btn-secondary">
            <Camera size={16} /> Update Photo & KYC
          </button>
          {student.status !== 'Vacated' && (
            <>
              <button onClick={() => navigate('/fees')} className="ui-btn ui-btn-success">
                <Wallet size={16} /> Collect Fee
              </button>
              <button onClick={() => navigate('/outpass')} className="ui-btn ui-btn-secondary sp-btn-outline">
                <FileText size={16} /> Issue Outpass
              </button>
              <button
                onClick={() => navigate(`/hostellers/clearance/${student.uuid}`)}
                className="ui-btn ui-btn-outline-danger"
              >
                <LogOut size={16} /> Checkout Student
              </button>
            </>
          )}
        </div>
      </div>

      <div className="sp-layout">
        {/* Left Sidebar Profile Summary & Navigation */}
        <div className="sp-sidebar">
          {/* Profile Card */}
          <div className="sp-profile-card">
            <div className="sp-avatar">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="Student" />
              ) : (
                student.name.substring(0, 2).toUpperCase()
              )}
            </div>
            <h3 className="sp-profile-name">{student.name}</h3>
            <span className={`sp-status ${student.status === 'Vacated' ? 'is-inactive' : student.status === 'Out' ? 'is-out' : 'is-active'}`}>
              <CheckCircle2 size={14} /> {student.status === 'Vacated' ? 'Inactive' : student.status === 'Out' ? 'Active (Out)' : 'Active'}
            </span>
            <div className="sp-profile-meta">
              <div className="sp-meta-row">
                <span className="sp-meta-label">ID:</span>
                <span>{student.id}</span>
              </div>
              <div className="sp-meta-row">
                <span className="sp-meta-label">Room:</span>
                <span>{student.room}</span>
              </div>
              <div className="sp-meta-row">
                <span className="sp-meta-label">Joined:</span>
                <span>{student.joined}</span>
              </div>
              <div className="sp-meta-row">
                <span className="sp-meta-label">Category:</span>
                <span className="sp-meta-value-right">{student.category || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="sp-nav">
            {tabs.map(tab => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`sp-nav-btn${activeTab === tab.name ? ' is-active' : ''}`}
              >
                {tab.icon} <span>{tab.name} {tab.name === 'Gate Logs' && `(${gateLogs.length})`}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="sp-content">
          {activeTab === 'Master Profile' && (
            <div>
              <h3 className="sp-section-title">
                <User size={20} color="var(--sidebar-active)" /> Personal Details
              </h3>

              <div className="ui-kv-grid sp-detail-grid">
                <div className="ui-kv">
                  <div className="ui-kv-label">Manual Regsi Name</div>
                  <div className="ui-kv-value">{student.manualRegsiName}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Biometric ID</div>
                  <div className="ui-kv-value">{student.biometricId}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Aadhar Number</div>
                  <div className="ui-kv-value">{student.aadharNo || 'N/A'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Blood Group</div>
                  <div className="ui-kv-value">{student.bloodGroup}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Gender</div>
                  <div className="ui-kv-value">{student.gender}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Date of Birth</div>
                  <div className="ui-kv-value">{student.dob}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Marital Status</div>
                  <div className="ui-kv-value">{student.maritalStatus}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Mobile Phone</div>
                  <div className="ui-kv-value">{student.mobile}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Email</div>
                  <div className="ui-kv-value">{student.email || '-'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Address</div>
                  <div className="ui-kv-value">{student.address}</div>
                </div>
              </div>

              <h3 className="sp-section-title">
                <FileText size={20} color="#8b5cf6" /> Academic & Additional Info
              </h3>

              <div className="ui-kv-grid sp-detail-grid">
                <div className="ui-kv">
                  <div className="ui-kv-label">VSR Ledger-1</div>
                  <div className="ui-kv-value">{student.vsrLedger1}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Date of Joining</div>
                  <div className="ui-kv-value">{student.dateOfJoining}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Pursuing Year</div>
                  <div className="ui-kv-value">{student.pursuingYear}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Course Duration</div>
                  <div className="ui-kv-value">{student.courseDuration || '-'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">College / Dept</div>
                  <div className="ui-kv-value">{student.college}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Category</div>
                  <div className="ui-kv-value">{student.category}</div>
                </div>
              </div>

              <h3 className="sp-section-title">
                <Phone size={20} color="#f59e0b" /> Guardian & Emergency Contacts
              </h3>

              <div className="ui-kv-grid sp-detail-grid">
                <div className="ui-kv">
                  <div className="ui-kv-label">Guardian Name</div>
                  <div className="ui-kv-value">{student.guardianName}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Guardian Phone</div>
                  <div className="ui-kv-value">{student.guardianPhone || '-'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Emergency Contact</div>
                  <div className="ui-kv-value">{student.emergencyContact || '-'}</div>
                </div>
              </div>

              <h3 className="sp-section-title sp-gap-top">
                <User size={20} color="#3b82f6" /> Parent Information
              </h3>

              <div className="ui-kv-grid sp-detail-grid">
                <div className="ui-kv">
                  <div className="ui-kv-label">Father's Name</div>
                  <div className="ui-kv-value">{student.fatherName || '-'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Father's Phone</div>
                  <div className="ui-kv-value">{student.fatherMobileNo || '-'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Mother's Name</div>
                  <div className="ui-kv-value">{student.motherName || '-'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Mother's Phone</div>
                  <div className="ui-kv-value">{student.motherMobileNo || '-'}</div>
                </div>
              </div>

              <h3 className="sp-section-title">
                <Bed size={20} color="#8b5cf6" /> Room & Accommodation
              </h3>

              <div className="ui-kv-grid">
                <div className="ui-kv">
                  <div className="ui-kv-label">Room Type</div>
                  <div className="ui-kv-value">{student.roomType}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Block / Room No</div>
                  <div className="ui-kv-value">{student.blockRoom}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Monthly Rent</div>
                  <div className="ui-kv-value sp-kv-strong">{student.monthlyRent}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Monthly Mess Fee</div>
                  <div className="ui-kv-value sp-kv-strong">
                    ₹{(() => {
                      const tList = fees?.filter(f => f.transactionType === 'MESS') || [];
                      if (tList.length === 0) return (student.monthlyMessFee || 0).toLocaleString('en-IN');
                      tList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      for (const t of tList) {
                        const match = t.description?.match(/@ ₹([0-9,.]+)\/month/);
                        if (match) return match[1];
                        const match2 = t.description?.match(/Paid for (\d+) Months/);
                        if (match2) {
                          const months = parseInt(match2[1], 10);
                          if (months > 0) return (t.amount / months).toLocaleString('en-IN');
                        }
                        return t.amount?.toLocaleString('en-IN') || 0;
                      }
                      return (student.monthlyMessFee || 0).toLocaleString('en-IN');
                    })()}
                  </div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Advance Paid</div>
                  <div className="ui-kv-value sp-kv-strong">₹{student.advance}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Food Type</div>
                  <div className="ui-kv-value">{student.foodType}</div>
                </div>
              </div>

              {student.status === 'Vacated' && student.clearance && (
                <div className="sp-clearance">
                  <h3 className="sp-clearance-title">
                    <LogOut size={20} color="#dc2626" /> Exit & Clearance Details
                  </h3>

                  <div className="sp-clearance-grid">
                    <div>
                      <div className="sp-clearance-label">Clearance Date</div>
                      <div className="sp-clearance-value">{new Date(student.clearance.clearanceDate).toLocaleDateString('en-GB')}</div>
                    </div>
                    <div>
                      <div className="sp-clearance-label">Exit Reason</div>
                      <div className="sp-clearance-value">{student.clearance.reason}</div>
                    </div>
                    <div>
                      <div className="sp-clearance-label">Deductions</div>
                      <div className="sp-clearance-value is-danger">₹{student.clearance.deductions.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="sp-clearance-label">Net Refund Settled</div>
                      <div className="sp-clearance-value is-success">₹{student.clearance.netRefund.toFixed(2)}</div>
                    </div>
                  </div>

                  <div>
                    <div className="sp-clearance-label">Clearance Remarks</div>
                    <div className="sp-clearance-remarks">
                      {student.clearance.remarks || 'No remarks provided.'}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'Outstanding Payments' && (
            <div>
              <div className="sp-tab-head">
                <h3 className="sp-section-title sp-tab-title">
                  <DollarSign size={20} color="#f59e0b" /> Outstanding Payment Details
                </h3>
              </div>

              {/* Outstanding Balance Summary Card */}
              <div className="ui-card" style={{ marginBottom: '20px', border: '1px solid #fef08a', background: '#fefce8' }}>
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '56px', height: '56px', background: '#fde047', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={28} color="#a16207" />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', color: '#854d0e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Outstanding Balance</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#713f12', lineHeight: 1 }}>
                        ₹{outstandingPayments.reduce((sum: number, p: any) => {
                          const paid = p.paidAmount || 0;
                          const total = p.amount || 0;
                          return sum + Math.max(0, total - paid);
                        }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#854d0e', marginBottom: '2px' }}>{outstandingPayments.filter((p: any) => (p.amount || 0) > (p.paidAmount || 0)).length} Pending Invoice(s)</div>
                    <div style={{ fontSize: '13px', color: '#a16207', fontWeight: 600 }}>
                      {outstandingPayments.filter((p: any) => (p.amount || 0) > (p.paidAmount || 0)).reduce((sum: number, p: any) => sum + Math.max(0, (p.amount || 0) - (p.paidAmount || 0)), 0).toLocaleString('en-IN')} Balance
                    </div>
                  </div>
                </div>
              </div>

              {/* Add New Outstanding Payment Section */}
              <div className="ui-card ui-card--flush">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <h4 className="sp-section-title" style={{ fontSize: '16px', marginBottom: 0, color: '#3b82f6' }}>
                    <Plus size={18} /> Add Outstanding Payment Rows
                  </h4>
                  {outstandingRows.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={addOutstandingRow} className="ui-btn ui-btn-secondary ui-btn-sm">
                        <Plus size={14} /> Add Row
                      </button>
                      <button 
                        onClick={handleSaveOutstanding} 
                        disabled={isSavingOutstanding || outstandingRows.every(r => getRowRent(r) === 0 && getRowEb(r) === 0)}
                        className="ui-btn ui-btn-primary ui-btn-sm"
                      >
                        {isSavingOutstanding ? (
                          <>
                            <Loader2 size={14} className="sp-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Save size={14} /> Save All
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ padding: '16px 20px' }}>
                  {outstandingRows.length === 0 ? (
                    <div className="sp-empty" style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <DollarSign size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                      <p style={{ color: '#64748b', marginBottom: '16px', fontSize: '15px' }}>No outstanding payment rows added yet.</p>
                      <button onClick={addOutstandingRow} className="ui-btn ui-btn-primary">
                        <Plus size={16} /> Add First Row
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="ui-table-wrap">
                        <table className="ui-table">
                          <thead>
                            <tr>
                              <th style={{ width: '50px' }}>#</th>
                              <th style={{ width: '90px' }}>
                                <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Year
                              </th>
                              <th style={{ width: '130px' }}>
                                <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Month
                              </th>
                              <th style={{ width: '140px' }} className="num">
                                <Home size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Rent (₹)
                              </th>
                              <th style={{ width: '140px' }} className="num">
                                <Zap size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> EB Fees (₹)
                              </th>
                              <th style={{ width: '130px' }} className="num">Row Total (₹)</th>
                              <th style={{ width: '50px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {outstandingRows.map((row, index) => (
                              <tr key={row.id}>
                                <td className="sp-kv-strong" style={{ textAlign: 'center', padding: '10px 8px' }}>{index + 1}</td>
                                <td style={{ padding: '8px' }}>
                                  <input
                                    type="number"
                                    min="2020"
                                    max={new Date().getFullYear() + 2}
                                    value={getRowYear(row)}
                                    onChange={(e) => updateOutstandingRow(row.id, 'year', e.target.value)}
                                    onBlur={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val)) updateOutstandingRow(row.id, 'year', val);
                                    }}
                                    className="ui-input"
                                    style={{ width: '100%', padding: '6px 8px', textAlign: 'center', fontSize: '13px' }}
                                    placeholder="Year"
                                  />
                                </td>
                                <td style={{ padding: '8px' }}>
                                  <select
                                    value={row.month || ''}
                                    onChange={(e) => updateOutstandingRow(row.id, 'month', e.target.value ? parseInt(e.target.value) : 0)}
                                    className="ui-input"
                                    style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                                  >
                                    <option value="">Select</option>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                      <option key={m} value={m}>
                                        {getMonthName(m)}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="num" style={{ padding: '8px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={row.rent === '' ? '' : row.rent}
                                    onChange={(e) => updateOutstandingRow(row.id, 'rent', e.target.value)}
                                    className="ui-input"
                                    style={{ width: '100%', padding: '6px 8px', textAlign: 'right', fontSize: '13px' }}
                                    placeholder="Rent"
                                  />
                                </td>
                                <td className="num" style={{ padding: '8px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={row.eb === '' ? '' : row.eb}
                                    onChange={(e) => updateOutstandingRow(row.id, 'eb', e.target.value)}
                                    className="ui-input"
                                    style={{ width: '100%', padding: '6px 8px', textAlign: 'right', fontSize: '13px' }}
                                    placeholder="EB"
                                  />
                                </td>
                                <td className="num sp-kv-strong" style={{ fontSize: '13px', padding: '10px 8px' }}>
                                  ₹{(getRowRent(row) + getRowEb(row)).toLocaleString('en-IN')}
                                </td>
                                <td style={{ textAlign: 'center', padding: '8px' }}>
                                  <button
                                    onClick={() => removeOutstandingRow(row.id)}
                                    className="ui-btn ui-btn-danger ui-btn-sm"
                                    title="Remove row"
                                    style={{ padding: '6px 8px' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: '#f8fafc', fontWeight: '600' }}>
                              <td colSpan={3} style={{ textAlign: 'right', padding: '12px 8px' }}>Grand Total:</td>
                              <td className="num" style={{ padding: '12px 8px' }}>₹{outstandingRows.reduce((sum, r) => sum + getRowRent(r), 0).toLocaleString('en-IN')}</td>
                              <td className="num" style={{ padding: '12px 8px' }}>₹{outstandingRows.reduce((sum, r) => sum + getRowEb(r), 0).toLocaleString('en-IN')}</td>
                              <td className="num sp-kv-strong" style={{ padding: '12px 8px', fontSize: '14px' }}>₹{outstandingRows.reduce((sum, r) => sum + getRowRent(r) + getRowEb(r), 0).toLocaleString('en-IN')}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Existing Outstanding Payments List */}
              <div className="ui-card ui-card--flush">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                  <h4 className="sp-section-title" style={{ fontSize: '16px', marginBottom: 0, color: '#10b981' }}>
                    <Clock size={18} /> Outstanding Balance Summary
                  </h4>
                </div>
                
                {outstandingPayments.length === 0 ? (
                  <div className="sp-empty">
                    No outstanding payments found for this student.
                  </div>
                ) : (
                  <div style={{ padding: '20px' }}>
                    {/* Consolidated Outstanding Row */}
                    <div style={{ 
                      background: '#fefce8', 
                      border: '1px solid #fde047', 
                      borderRadius: '12px', 
                      padding: '24px',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '13px', color: '#854d0e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                            Total Outstanding Balance
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: 800, color: '#713f12', lineHeight: 1 }}>
                            ₹{outstandingPayments.reduce((sum: number, p: any) => {
                              const paid = p.paidAmount || 0;
                              const total = p.amount || 0;
                              return sum + Math.max(0, total - paid);
                            }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', color: '#854d0e', marginBottom: '2px' }}>
                              {outstandingPayments.filter((p: any) => (p.amount || 0) > (p.paidAmount || 0)).length} Pending Invoice(s)
                            </div>
                            <div style={{ fontSize: '14px', color: '#a16207', fontWeight: 600 }}>
                              Total Balance Due
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              const pendingFees = outstandingPayments.filter((p: any) => (p.amount || 0) > (p.paidAmount || 0));
                              if (pendingFees.length > 0) {
                                setFeeToCollect(pendingFees.map(p => ({ ...p, student: { name: student.name, regNo: student.id, roomNo: student.room } })));
                              }
                            }} 
                            className="ui-btn ui-btn-primary"
                            style={{ padding: '12px 24px', fontSize: '15px', fontWeight: 600 }}
                          >
                            <Wallet size={18} /> Pay Outstanding Balance
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Breakdown (Collapsible) */}
                    <details style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <summary style={{ 
                        padding: '16px 20px', 
                        background: '#f8fafc', 
                        cursor: 'pointer', 
                        fontWeight: 600, 
                        color: '#334155',
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center'
                      }}>
                        <span>View Detailed Breakdown ({outstandingPayments.length} invoices)</span>
                        <ChevronDown size={18} color="#64748b" />
                      </summary>
                      <div style={{ padding: '0' }}>
                        <div className="ui-table-wrap">
                          <table className="ui-table">
                            <thead>
                              <tr>
                                <th>Type</th>
                                <th>Description</th>
                                <th className="num">Total (₹)</th>
                                <th className="num">Paid (₹)</th>
                                <th className="num">Balance (₹)</th>
                                <th>Date</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {outstandingPayments.map((payment: any) => {
                                const paidAmount = payment.paidAmount || 0;
                                const totalAmount = payment.amount || 0;
                                const balance = Math.max(0, totalAmount - paidAmount);
                                const isPartial = payment.status === 'PARTIAL' || (paidAmount > 0 && paidAmount < totalAmount);
                                const isCompleted = payment.status === 'COMPLETED' || paidAmount >= totalAmount;
                                
                                return (
                                  <tr key={payment.id} className={isCompleted ? '' : 'sp-row-pending'}>
                                    <td>
                                      <span className={`ui-badge ${payment.transactionType === 'RENT' ? 'ui-badge-primary' : 'ui-badge-warning'}`}>
                                        {payment.transactionType}
                                      </span>
                                    </td>
                                    <td>{payment.description || '—'}</td>
                                    <td className="num">₹{totalAmount.toLocaleString('en-IN')}</td>
                                    <td className="num" style={{ color: '#059669' }}>₹{paidAmount.toLocaleString('en-IN')}</td>
                                    <td className="num sp-total is-pending" style={{ fontWeight: 700 }}>₹{balance.toLocaleString('en-IN')}</td>
                                    <td>
                                      {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                    </td>
                                    <td>
                                      <span className={`ui-badge ${isCompleted ? 'ui-badge-success' : isPartial ? 'ui-badge-info' : 'ui-badge-warning'}`}>
                                        {isCompleted ? 'Paid' : isPartial ? 'Partial' : 'Pending'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'KYC Documents' && (
            <div>
              <h3 className="sp-section-title">
                <FileText size={20} color="var(--sidebar-active)" /> KYC Documents
              </h3>

              <div className="sp-stat-grid">
                {/* Document 1 Card */}
                {student.doc1Url ? (
                  <div className="sp-kyc-card">
                    <div className="sp-kyc-head">
                      <div className="sp-kyc-title">
                        <FileText size={18} color="#0ea5e9" />
                        <span>Document 1: {student.doc1Type || 'Aadhar Card'}</span>
                      </div>
                      <span className="sp-kyc-badge">Uploaded</span>
                    </div>

                    <div className="sp-kyc-body">
                      <div className="sp-kyc-meta">
                        <div className="sp-kyc-meta-row">
                          <span>Document Type:</span> {student.doc1Type || 'Aadhar Card'}
                        </div>
                        <div>
                          <span>Document / ID Number:</span> {student.doc1Number || 'Not Provided'}
                        </div>
                      </div>

                      <div className="sp-kyc-preview">
                        {renderDocPreview(student.doc1Url, student.doc1Type || "Aadhar Card")}
                      </div>

                      <a
                        href={student.doc1Url}
                        target="_blank"
                        rel="noreferrer"
                        className="sp-kyc-open"
                      >
                        <Upload size={16} className="sp-icon-flip" /> Open / Download Full Document
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="sp-kyc-empty">
                    No Primary ID Uploaded
                  </div>
                )}

                {/* Document 2 Card */}
                {student.doc2Url ? (
                  <div className="sp-kyc-card">
                    <div className="sp-kyc-head">
                      <div className="sp-kyc-title">
                        <FileText size={18} color="#0ea5e9" />
                        <span>Document 2: {student.doc2Type || 'Secondary ID'}</span>
                      </div>
                      <span className="sp-kyc-badge">Uploaded</span>
                    </div>

                    <div className="sp-kyc-body">
                      <div className="sp-kyc-meta">
                        <div className="sp-kyc-meta-row">
                          <span>Document Type:</span> {student.doc2Type || 'Secondary ID'}
                        </div>
                        <div>
                          <span>Document / ID Number:</span> {student.doc2Number || 'Not Provided'}
                        </div>
                      </div>

                      <div className="sp-kyc-preview">
                        {renderDocPreview(student.doc2Url, student.doc2Type || "Secondary ID")}
                      </div>

                      <a
                        href={student.doc2Url}
                        target="_blank"
                        rel="noreferrer"
                        className="sp-kyc-open"
                      >
                        <Upload size={16} className="sp-icon-flip" /> Open / Download Full Document
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="sp-kyc-empty">
                    No Secondary ID Uploaded
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Fees & Receipts' && (
            <div>
              <div className="sp-tab-head">
                <h3 className="sp-section-title sp-tab-title">
                  <CreditCard size={20} color="#10b981" /> Fee Transactions
                </h3>
              </div>

              <div className="sp-stat-grid">
                <div className="sp-stat">
                  <div className="sp-stat-label">Total Paid (Receipts)</div>
                  <div className="sp-stat-value">₹{fees.filter(f => f.status === 'COMPLETED' && f.transactionType !== 'ADVANCE').reduce((sum, f) => sum + f.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-label">Total Pending Dues</div>
                  <div className="sp-stat-value">₹{fees.filter(f => f.status === 'PENDING').reduce((sum, f) => sum + f.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>

              {fees.length === 0 ? (
                <div className="sp-empty">
                  No fee records found for this student.
                </div>
              ) : (
                <div className="ui-card ui-card--flush">
                  <div className="ui-table-wrap">
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Invoice No</th>
                          <th>Payment Date</th>
                          <th className="num">Advance</th>
                          <th className="num">Rent</th>
                          <th className="num">EB</th>
                          <th className="num">Mess</th>
                          <th className="num">Fine</th>
                          <th className="num">Total Paid</th>
                          <th>Status</th>
                          <th className="num">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayFees.map(fee => (
                          <tr key={fee.id} className={fee.status === 'PENDING' ? 'sp-row-pending' : undefined}>
                            <td className="sp-invoice">
                              {fee.status === 'COMPLETED' ? (fee.feesList[0] ? (() => {
                                const f = fee.feesList[0];
                                const ymStr = new Date(f.createdAt).toISOString().slice(0, 7).replace('-', '');
                                const purpose = fee.feesList.length > 1 ? 'MUL' : (f.transactionType || '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'FEE';
                                const studentStr = student?.id || 'UNKN';
                                return `INV-${purpose}-${ymStr}-${studentStr}`;
                              })() : '—') : '—'}
                            </td>
                            <td>
                              {fee.status === 'COMPLETED' ? new Date(fee.paidDate || fee.createdAt).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td className="num sp-advance-amount">₹{fee.advance.toLocaleString('en-IN')}</td>
                            <td className="num">
                              <div>₹{fee.rent.toLocaleString('en-IN')}</div>
                              {fee.status === 'COMPLETED' && (() => {
                                const rentFee = fee.feesList?.find((x: any) => (x.transactionType || '').toUpperCase().includes('RENT'));
                                const match = rentFee?.description?.match(/Paid for \d+ Months \(([^)]+)\)/);
                                if (match) {
                                  const parts = match[1].split('-');
                                  return <div className="sp-paid-till">Paid till {parts[parts.length - 1].trim()}</div>;
                                }
                                return null;
                              })()}
                            </td>
                            <td className="num">₹{fee.eb.toLocaleString('en-IN')}</td>
                            <td className="num">
                              <div>₹{fee.mess.toLocaleString('en-IN')}</div>
                              {fee.status === 'COMPLETED' && (() => {
                                const messFee = fee.feesList?.find((x: any) => (x.transactionType || '').toUpperCase().includes('MESS'));
                                const match = messFee?.description?.match(/Paid for \d+ Months \(([^)]+)\)/);
                                if (match) {
                                  const parts = match[1].split('-');
                                  return <div className="sp-paid-till">Paid till {parts[parts.length - 1].trim()}</div>;
                                }
                                return null;
                              })()}
                            </td>
                            <td className="num">₹{fee.fine.toLocaleString('en-IN')}</td>

                            <td className={`num sp-total${fee.status === 'PENDING' ? ' is-pending' : ''}`}>
                              ₹{fee.totalAmount.toLocaleString('en-IN')}
                            </td>

                            <td>
                              <span className={`ui-badge ${fee.status === 'COMPLETED' ? 'ui-badge-success' : fee.status === 'PENDING' ? 'ui-badge-warning' : 'ui-badge-danger'}`}>
                                {fee.status === 'COMPLETED' ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                            <td className="num">
                              {fee.status === 'PENDING' ? (
                                <button onClick={() => navigate(`/fees?student=${student?.id || student?.uuid}`)} className="ui-btn ui-btn-primary ui-btn-sm">
                                  <Wallet size={14} /> Pay Now
                                </button>
                              ) : (
                                <button onClick={() => setSelectedReceipt({ ...fee, student: { name: student.name, regNo: student.id, roomNo: student.room } })} className="ui-btn ui-btn-secondary ui-btn-sm">
                                  <FileText size={14} color="#64748b" /> View Receipt
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Gate Logs' && (
            <div>
              <div className="sp-tab-head">
                <h3 className="sp-section-title sp-tab-title">
                  <Clock size={20} color="#0d6efd" /> Gate Movement History
                </h3>
              </div>

              {gateLogs.length === 0 ? (
                <div className="sp-empty">
                  No gate movements found for this student.
                </div>
              ) : (
                <div className="ui-card ui-card--flush">
                  <div className="ui-table-wrap">
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Movement Status</th>
                          <th>Purpose</th>
                          <th>Exit Time</th>
                          <th>Expected Return</th>
                          <th>Entry Time</th>
                          <th>Return Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gateLogs.map(log => {
                          const status = log.movementType === 'ENTRY' || log.inTime ? 'Entry' : 'Exit';

                          const formatDateTime = (dateStr: string | null) => {
                            if (!dateStr) return '—';
                            const d = new Date(dateStr);
                            return <>{d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}<br />{d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</>;
                          };

                          return (
                            <tr key={log.id}>
                              <td>
                                {status === 'Entry' ? (
                                  <div className="sp-move-badge is-entry">
                                    Entry
                                  </div>
                                ) : (
                                  <div className="sp-move-badge is-exit">
                                    Exit
                                  </div>
                                )}
                              </td>
                              <td className="sp-capitalize">{log.reason || '—'}</td>
                              <td>{formatDateTime(log.outTime)}</td>
                              <td>{formatDateTime(log.expectedInTime)}</td>
                              <td>{formatDateTime(log.inTime)}</td>
                              <td>{log.lateRemarks || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Advance Deposit' && (
            <div>
              <div className="sp-tab-head">
                <h3 className="sp-section-title sp-tab-title">
                  <ShieldCheck size={20} color="#10b981" /> Advance Deposit Details
                </h3>
              </div>
              <div className="sp-advance-wrap">
                <div className="sp-advance-hero">
                  <div className="sp-advance-label">Total Advance Deposit Held</div>
                  <div className="sp-advance-value">₹{(student.advance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>

              {(() => {
                const advanceTransactions = fees.filter(f => (f.transactionType || '').toUpperCase() === 'ADVANCE');
                return (
                  <div className="ui-card ui-card--flush">
                    <div className="ui-table-wrap">
                      <table className="ui-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Invoice No</th>
                            <th>Payment Mode</th>
                            <th className="num">Amount</th>
                            <th className="sp-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {advanceTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="ui-table-state">
                                No advance payment records found.
                              </td>
                            </tr>
                          ) : (
                            advanceTransactions.map(txn => (
                              <tr key={txn.id}>
                                <td>
                                  {new Date(txn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  <br/>
                                  <span className="ui-cell-sub">{new Date(txn.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                </td>
                                <td>
                                  {txn.status === 'COMPLETED' ? formatInvoiceNumber({ ...txn, student }) : '—'}
                                </td>
                                <td>
                                  <span className="ui-badge ui-badge-neutral">
                                    {txn.paymentMode || 'N/A'}
                                  </span>
                                </td>
                                <td className="num sp-total">
                                  ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="sp-center">
                                  <span className={`ui-badge ${txn.status === 'COMPLETED' ? 'ui-badge-success' : txn.status === 'PENDING' ? 'ui-badge-warning' : 'ui-badge-danger'}`}>
                                    {txn.status === 'COMPLETED' ? 'Paid' : 'Unpaid'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'Outpasses & Travel' && (
            <div>
              <div className="sp-tab-head">
                <h3 className="sp-section-title sp-tab-title">
                  <MapPin size={20} color="#0d6efd" /> Outpasses & Travel History
                </h3>
              </div>
              {outpasses.length === 0 ? (
                <div className="sp-empty">
                  No outpasses found for this student.
                </div>
              ) : (
                <div className="ui-card ui-card--flush">
                  <div className="ui-table-wrap">
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Destination</th>
                          <th>Reason</th>
                          <th>From Date</th>
                          <th>To Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outpasses.map(op => (
                          <tr key={op.id}>
                            <td className="sp-kv-strong">{op.destination}</td>
                            <td>{op.reason}</td>
                            <td>{new Date(op.leaveDate).toLocaleDateString('en-GB')}</td>
                            <td>{new Date(op.returnDate).toLocaleDateString('en-GB')}</td>
                            <td>
                              <span className={`ui-badge ${op.status === 'Approved' ? 'ui-badge-success' : op.status === 'Active Out' ? 'ui-badge-warning' : op.status === 'Closed Returned' ? 'ui-badge-neutral' : 'ui-badge-danger'}`}>
                                {op.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab !== 'Master Profile' && activeTab !== 'KYC Documents' && activeTab !== 'Fees & Receipts' && activeTab !== 'Gate Logs' && activeTab !== 'Outpasses & Travel' && (
            <div className="sp-placeholder">
              <Lock size={48} className="sp-placeholder-icon" />
              <div className="sp-placeholder-title">{activeTab} Data</div>
              <div className="sp-placeholder-text">This module will be connected to the database soon.</div>
            </div>
          )}

          {showUpdateModal && (
            <div className="ui-modal-overlay">
              <div className="ui-modal ui-modal--md">
                <div className="ui-modal-head">
                  <h3 className="ui-modal-title">Update Photo & KYC</h3>
                  <button onClick={() => setShowUpdateModal(false)} className="ui-modal-close"><X size={20} /></button>
                </div>

                <div className="ui-modal-body">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Profile Photo</label>
                    <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="sp-file-input" />
                  </div>
                  <div className="ui-form-group">
                    <label className="ui-form-label">Primary ID Proof</label>
                    <input type="file" accept="image/*,.pdf" onChange={e => setDoc1File(e.target.files?.[0] || null)} className="sp-file-input" />
                  </div>
                  <div className="ui-form-group">
                    <label className="ui-form-label">Secondary ID Proof</label>
                    <input type="file" accept="image/*,.pdf" onChange={e => setDoc2File(e.target.files?.[0] || null)} className="sp-file-input" />
                  </div>
                </div>

                <div className="ui-modal-foot">
                  <button onClick={() => setShowUpdateModal(false)} className="ui-btn ui-btn-soft">Cancel</button>
                  <button onClick={handleUpdateKyc} disabled={isUpdating} className="ui-btn ui-btn-primary">
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
          fee={Array.isArray(feeToCollect) ? undefined : { ...feeToCollect, student }}
          fees={Array.isArray(feeToCollect) ? feeToCollect : undefined}
          onClose={() => setFeeToCollect(null)}
          onSuccess={() => {
            setFeeToCollect(null);
            fetchStudentData(); // Refresh data
          }}
        />
      )}

      {showIdCard && (
        <div className="ui-modal-overlay sp-idcard-overlay">
          <div className="sp-idcard">
             <button onClick={() => setShowIdCard(false)} className="sp-idcard-close">
               <X size={20} />
             </button>
             <div className="sp-idcard-body">
               <StudentAcknowledgementCard 
                 student={{ ...student, regNo: student.id, collegeId: student.college }} 
                 collegeName={student.college?.split('(')[0]?.trim()}
                 onBack={() => setShowIdCard(false)} 
                 isViewOnly={true}
               />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfile;
