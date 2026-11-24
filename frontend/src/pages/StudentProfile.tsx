import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, User, ShieldCheck, MapPin, Phone, FileText, CreditCard, Clock, Lock, CheckCircle2, Camera, Wallet, LogOut, Bed, X, Upload, IdCard, IndianRupee, Calendar, FileSpreadsheet } from 'lucide-react';
import { UploadAPI } from '../api/upload.api';
import { StudentAPI } from '../api/student.api';
import { FeesAPI } from '../api/fees.api';
import { gateLogApi } from '../api/gatelog.api';
import { OutpassAPI } from '../api/outpass.api';
import { ReceiptModal } from '../components/ReceiptModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { FeeGenerationNotice } from '../components/FeeGenerationNotice';
import { buildOutstandingSummary, cleanPaymentDescription, isCurrentCycleFee, isImportedInvoice, isMessFee, isOutstandingDescription, isOutstandingInvoice, isOutstandingPayment, isPreviousSettledFee, roundMoney } from '../utils/outstanding';
import { formatInvoiceNumber } from '../utils/invoiceNumber';
import { getBillingMonths, isPostpaidPayableFee, formatBillingMonth } from '../utils/billingCycle';
import { StudentAcknowledgementCard } from '../components/StudentAcknowledgementCard';
import { LoadingBlock } from '../components/LoadingSpinner';
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
  const [feeToCollect, setFeeToCollect] = useState<any>(null);

  // Outstanding ledger: original invoices stay untouched; confirmed
  // OUTSTANDING_PAYMENT rows reduce the remaining balance.
  const outstandingSummary = useMemo(() => buildOutstandingSummary(fees), [fees]);
  const outstandingAllocations = outstandingSummary.allocations;

  // Current cycle pending dues (Rent / EB / Fine)
  const currentPendingFees = useMemo(() => {
    return fees.filter(f => isCurrentCycleFee(f, student?.billingCycle));
  }, [fees, student?.billingCycle]);

  const currentPendingTotal = useMemo(() => {
    return roundMoney(currentPendingFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0));
  }, [currentPendingFees]);

  const currentRentPending = useMemo(() => {
    return roundMoney(
      currentPendingFees
        .filter(f => String(f.transactionType || '').toUpperCase().includes('RENT'))
        .reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
    );
  }, [currentPendingFees]);

  const currentEbPending = useMemo(() => {
    return roundMoney(
      currentPendingFees
        .filter(f => {
          const t = String(f.transactionType || '').toUpperCase();
          return t.includes('EB') || t.includes('ELECTRIC');
        })
        .reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
    );
  }, [currentPendingFees]);

  const currentFinePending = useMemo(() => {
    return roundMoney(
      currentPendingFees
        .filter(f => String(f.transactionType || '').toUpperCase().includes('FINE'))
        .reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
    );
  }, [currentPendingFees]);

  const grandTotalOutstanding = useMemo(() => {
    return roundMoney(currentPendingTotal + outstandingSummary.remaining);
  }, [currentPendingTotal, outstandingSummary.remaining]);

  const getDueDateForMonth = (monthStr?: string): string => {
    if (!monthStr) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 5);
      return nextMonth.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const match = String(monthStr).match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (!match) return '05th of next month';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const dueDate = new Date(year, month, 5);
    return dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const displayFees = useMemo(() => {
    const billingCycle = student?.billingCycle || 'PREPAID';
    const { previousMonthStr } = getBillingMonths();
    const isPostpaidPayableNowFee = (fee: any) =>
      billingCycle === 'POSTPAID' &&
      fee?.status === 'PENDING' &&
      isPostpaidPayableFee(fee, previousMonthStr);
    const pendingGroup: any = {
      isGrouped: true,
      id: 'pending-group',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      totalAmount: 0,
      displayPaid: 0,
      displayBalance: 0,
      displayStatus: 'Unpaid',
      invoiceFee: null,
      rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
      feesList: [] as any[]
    };
    // POSTPAID colleges bill the previous month. Current-month fees are still
    // listed for reference but must not be payable, so they get a separate
    // "Not Due" row with no Pay Now action.
    const notDueGroup: any = {
      isGrouped: true,
      id: 'not-due-group',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      totalAmount: 0,
      displayPaid: 0,
      displayBalance: 0,
      displayStatus: 'Not Due',
      invoiceFee: null,
      invoiceNumber: '—',
      rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
      feesList: [] as any[]
    };
    const paidByBatch = new Map();

    // Running balance shown on each receipt. Use the actual payment sequence,
    // not the payment amount, so the outstanding balance matches the real
    // receipt history. If payment amounts are mixed (₹500, ₹1,000, ₹2,000),
    // the running balance must follow createdAt, not sort by amount.
    const balanceBeforeReceipt = new Map<string, number>();
    const receiptOrder = new Map<string, number>();
    let remainingBeforeReceipt = outstandingSummary.original;
    outstandingSummary.payments
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
          new Date(a.paidDate || 0).getTime() - new Date(b.paidDate || 0).getTime() ||
          String(a.id).localeCompare(String(b.id)),
      )
      .forEach((payment: any, index: number) => {
        balanceBeforeReceipt.set(payment.id, remainingBeforeReceipt);
        receiptOrder.set(payment.id, index);
        remainingBeforeReceipt = roundMoney(
          Math.max(0, remainingBeforeReceipt - (Number(payment.amount) || 0)),
        );
      });

    fees.forEach(f => {
      if (isMessFee(f)) return;

      // Pre-November fees are settled prior to the fresh billing cycle and should not be displayed in active fee transactions.
      // Exception: for POSTPAID colleges, pending previous-month dues are the
      // current payable cycle and must remain visible.
      if (isPreviousSettledFee(f) && !isPostpaidPayableNowFee(f)) return;

      const type = (f.transactionType || '').toUpperCase();
      // Outstanding amounts stay in the Outstanding Balance column only; they
      // must not be counted as Rent / EB / Mess / Fine / Advance.
      let category = 'other';
      if (isOutstandingDescription(f) || isOutstandingPayment(f)) category = 'other';
      else if (type.includes('RENT')) category = 'rent';
      else if (type.includes('EB') || type.includes('ELECTRIC')) category = 'eb';
      else if (type.includes('MESS')) category = 'mess';
      else if (type.includes('FINE')) category = 'fine';
      else if (type.includes('ADVANCE')) category = 'advance';

      if (f.status === 'PENDING') {
        // Original outstanding invoices are handled separately (shown as an
        // unpaid row only while no payment exists). Do not fold them into the
        // current-month pending row.
        if (isOutstandingInvoice(f) || (isImportedInvoice(f) && !isPostpaidPayableNowFee(f))) return;

        if (billingCycle === 'POSTPAID') {
          // Current/future-month fees are not due yet for postpaid colleges.
          // Fines (e.g. late-fine accumulation on overdue dues) remain payable.
          if (!isPostpaidPayableFee(f, previousMonthStr)) {
            notDueGroup.totalAmount += Number(f.amount) || 0;
            notDueGroup[category] += Number(f.amount) || 0;
            notDueGroup.feesList.push(f);
            if (new Date(f.createdAt) < new Date(notDueGroup.createdAt)) {
              notDueGroup.createdAt = f.createdAt;
            }
            return;
          }
        }

        pendingGroup.totalAmount += Number(f.amount) || 0;
        pendingGroup[category] += Number(f.amount) || 0;
        pendingGroup.feesList.push(f);
        if (!pendingGroup.createdAt || new Date(f.createdAt) < new Date(pendingGroup.createdAt)) {
          pendingGroup.createdAt = f.createdAt;
        }
      } else {
        const paidTime = f.paidDate || f.createdAt || f.updatedAt;
        const isOutstandingPay = isOutstandingPayment(f);
        // Each outstanding payment must keep its own receipt/invoice entry so
        // a second payment does not reuse the first payment's invoice number.
        const batchKey = isOutstandingPay
          ? `outstanding-${f.id}`
          : new Date(paidTime).toISOString().slice(0, 16);
        if (!paidByBatch.has(batchKey)) {
          paidByBatch.set(batchKey, {
            isGrouped: true,
            id: `paid-${batchKey}`,
            status: f.status,
            createdAt: f.createdAt,
            paidDate: paidTime,
            paymentMode: f.paymentMode || 'N/A',
            totalAmount: 0,
            displayPaid: 0,
            displayBalance: 0,
            displayStatus: 'Paid',
            invoiceFee: null,
            rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
            feesList: []
          });
        }
        const group = paidByBatch.get(batchKey);
        group.totalAmount += Number(f.amount) || 0;
        group[category] += Number(f.amount) || 0;
        group.feesList.push(f);
        if (isOutstandingPay && new Date(paidTime) > new Date(group.paidDate)) {
          group.paidDate = paidTime;
        }
      }
    });

    // Current-month pending dues are shown separately from the historical
    // outstanding ledger. Outstanding payments only settle outstanding
    // invoices, so they must not reduce these current dues.
    const currentPendingDue = roundMoney(Math.max(0, pendingGroup.totalAmount));
    pendingGroup.displayPaid = 0;
    // Current dues are shown in the Rent / Mess / EB / Fine columns. They are
    // not historical outstanding balance, so that column stays zero. It is
    // populated only for outstanding invoices / receipts.
    pendingGroup.displayBalance = 0;
    pendingGroup.displayStatus = 'Unpaid';
    pendingGroup.invoiceFee = null;

    const result: any[] = [];
    // If student has a remaining outstanding balance, show an unpaid row with Pay Now and no invoice number
    if (outstandingSummary.remaining > 0.005 && outstandingSummary.invoices.length > 0) {
      const firstInvoice = outstandingSummary.invoices[0];
      result.push({
        isGrouped: true,
        id: `outstanding-unpaid-${firstInvoice.id}`,
        status: 'PENDING',
        createdAt: firstInvoice.createdAt,
        paidDate: null,
        paymentMode: '-',
        totalAmount: outstandingSummary.remaining,
        displayPaid: 0,
        displayBalance: outstandingSummary.remaining,
        displayStatus: 'Unpaid',
        invoiceFee: null,
        invoiceNumber: '—',
        rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
        feesList: outstandingSummary.invoices,
      });
    }

    paidByBatch.forEach((group: any) => {
      // Do not display previous paid receipts prior to November 1, 2026
      const isPreNov = new Date(group.paidDate || group.createdAt) < new Date('2026-11-01T00:00:00');
      if (isPreNov) return;

      const hasOutstandingPayment = group.feesList.some(isOutstandingPayment);
      if (hasOutstandingPayment) {
        const currentOutstandingPayment = group.feesList.find((item: any) => isOutstandingPayment(item)) || group.feesList[0];

        group.displayPaid = Number(currentOutstandingPayment?.amount || 0);
        group.displayBalance =
          balanceBeforeReceipt.get(currentOutstandingPayment.id) ??
          outstandingSummary.original;
        group.outstandingSequence = receiptOrder.get(currentOutstandingPayment.id) ?? 0;
        // Status reflects the student's overall outstanding ledger, so a
        // receipt stays "Partial" until the last rupee is settled.
        group.displayStatus = outstandingSummary.remaining > 0.005 ? 'Partial' : 'Paid';
        group.invoiceFee = currentOutstandingPayment;
        group.invoiceNumber = formatInvoiceNumber(currentOutstandingPayment, fees);
      } else {
        group.displayPaid = group.totalAmount;
        group.displayBalance = 0;
        group.displayStatus = 'Paid';
        group.invoiceFee = group.feesList[0];
        group.invoiceNumber = formatInvoiceNumber(group.feesList[0]);
      }
      result.push(group);
    });

    if (currentPendingDue > 0.005) {
      pendingGroup.invoiceFee = null;
      pendingGroup.invoiceNumber = '—';
      result.push(pendingGroup);
    }

    // Show upcoming POSTPAID charges without making them payable.
    if (notDueGroup.totalAmount > 0.005) {
      result.push(notDueGroup);
    }

    // Outstanding receipts read in payment order (smallest first) so the
    // running balance steps down from the original amount to the remainder.
    // Everything else stays newest-first.
    result.sort((a, b) => {
      const aIsReceipt = a.feesList?.some(isOutstandingPayment);
      const bIsReceipt = b.feesList?.some(isOutstandingPayment);
      if (aIsReceipt && bIsReceipt) {
        // Show the newest outstanding payment first while keeping the running
        // balance computed from the real chronological ledger order.
        return (b.outstandingSequence ?? 0) - (a.outstandingSequence ?? 0);
      }
      if (aIsReceipt) return -1;
      if (bIsReceipt) return 1;
      // Latest invoice number first (descending).
      // Compare only the YYYY-MM-### serial suffix so prefix inconsistencies
      // ("INV-" vs "V-") don't break the ordering.
      const invSuffix = (inv: string) => {
        const m = inv.match(/(\d{4}-\d{2}-\d{3})$/);
        return m ? m[1] : inv;
      };
      return invSuffix(b.invoiceNumber || '').localeCompare(invSuffix(a.invoiceNumber || ''));
    });

    return result;
  }, [fees, outstandingSummary, student?.billingCycle]);
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
          billingCycle: data.college?.billingCycle || 'PREPAID',
          fatherName: data.fatherName,
          fatherMobileNo: data.fatherMobileNo,
          motherName: data.motherName,
          motherMobileNo: data.motherMobileNo,
          guardianName: data.guardianName || 'N/A',
          guardianPhone: data.guardianMobileNo || 'N/A',
          emergencyContact: data.emergencyContact || 'N/A',
          roomType: data.room?.type || 'N/A',
          blockRoom: `Block ${data.room?.block || '-'} - Room ${data.room?.id ? data.room.id.replace(/^[a-zA-Z\s_-]+/, '') : '-'}`,
          monthlyRent: `₹${((data.rent && data.rent > 0) ? data.rent : (data.room?.rent || 0)).toLocaleString('en-IN')}`,
          assignedRent: Number(data.rent) || 0,
          originalRoomRent: Number(data.room?.rent) || 0,
          hasCustomRent: Boolean(data.rent && data.room?.rent && Number(data.rent) > 0 && Number(data.rent) !== Number(data.room.rent)),
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
    {
      name: 'Outstanding Payments',
      icon: <IndianRupee size={16} />,
      badge: grandTotalOutstanding > 0 ? `₹${grandTotalOutstanding.toLocaleString('en-IN')}` : undefined,
    },
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
                onClick={() => navigate(`/hostellers/vacated/${student.uuid}`)}
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
              <div className="sp-meta-row" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '6px' }}>
                <span className="sp-meta-label">Current Due:</span>
                <span style={{ fontWeight: 700, color: currentPendingTotal > 0 ? '#dc2626' : '#16a34a' }}>
                  ₹{currentPendingTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="sp-meta-row">
                <span className="sp-meta-label">Imported Due:</span>
                <span style={{ fontWeight: 700, color: outstandingSummary.remaining > 0 ? '#d97706' : '#16a34a' }}>
                  ₹{outstandingSummary.remaining.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="sp-meta-row" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', fontWeight: 800 }}>
                <span className="sp-meta-label" style={{ color: '#0f172a' }}>Total Due:</span>
                <span style={{ color: grandTotalOutstanding > 0 ? '#dc2626' : '#16a34a', fontSize: '13px' }}>
                  ₹{grandTotalOutstanding.toLocaleString('en-IN')}
                </span>
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
                {tab.icon}
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                  <span>{tab.name} {tab.name === 'Gate Logs' && `(${gateLogs.length})`}</span>
                  {(tab as any).badge && (
                    <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>
                      {(tab as any).badge}
                    </span>
                  )}
                </span>
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
                  <div className="ui-kv-value sp-kv-strong">
                    <div>{student.monthlyRent}</div>
                    {student.hasCustomRent && (
                      <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span className="ui-badge ui-badge-info" style={{ fontSize: '10px', padding: '1px 5px', lineHeight: 1.2 }}>Assigned Rent</span>
                        <span style={{ color: '#64748b', fontWeight: 500 }}>(Original Room Rent: ₹{student.originalRoomRent.toLocaleString('en-IN')})</span>
                      </div>
                    )}
                  </div>
                </div>
                {/*
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
                */}
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
                <div className="sp-vacated">
                  <h3 className="sp-vacated-title">
                    <LogOut size={20} color="#dc2626" /> Exit & Vacate Details
                  </h3>

                  <div className="sp-vacated-grid">
                    <div>
                      <div className="sp-vacated-label">Vacated Date</div>
                      <div className="sp-vacated-value">{new Date(student.clearance.clearanceDate).toLocaleDateString('en-GB')}</div>
                    </div>
                    <div>
                      <div className="sp-vacated-label">Exit Reason</div>
                      <div className="sp-vacated-value">{student.clearance.reason}</div>
                    </div>
                    <div>
                      <div className="sp-vacated-label">Deductions</div>
                      <div className="sp-vacated-value is-danger">₹{student.clearance.deductions.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="sp-vacated-label">Net Refund Settled</div>
                      <div className="sp-vacated-value is-success">₹{student.clearance.netRefund.toFixed(2)}</div>
                    </div>
                  </div>

                  <div>
                    <div className="sp-vacated-label">Vacate Remarks</div>
                    <div className="sp-vacated-remarks">
                      {student.clearance.remarks || 'No remarks provided.'}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'Outstanding Payments' && (
            <div>
              <div className="sp-tab-head" style={{ marginBottom: '20px' }}>
                <div>
                  <h3 className="sp-section-title sp-tab-title" style={{ marginBottom: '4px' }}>
                    <IndianRupee size={22} color="#f59e0b" /> Outstanding & Pending Dues
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Separate breakdown of current monthly cycle dues vs imported historical backlog balances
                  </p>
                </div>
                {grandTotalOutstanding > 0 && (
                  <button
                    onClick={() => {
                      if (currentPendingFees.length > 0) {
                        setFeeToCollect(currentPendingFees[0]);
                      } else if (outstandingSummary.remaining > 0 && outstandingSummary.invoices.length > 0) {
                        setFeeToCollect(outstandingSummary.invoices[0]);
                      } else {
                        navigate(`/fees?student=${student?.id || student?.uuid}`);
                      }
                    }}
                    className="ui-btn ui-btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Wallet size={16} /> Pay Outstanding Dues
                  </button>
                )}
              </div>

              {/* Three-Card Overview Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* 1. Current Month Outstanding Card */}
                <div className="ui-card" style={{ padding: '20px', border: '1px solid #bae6fd', background: '#f0f9ff', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '40px', height: '40px', background: '#0ea5e9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Calendar size={20} color="#ffffff" />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Outstanding</span>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0c4a6e' }}>Monthly Billing Dues</h4>
                        </div>
                      </div>
                      <span className={`ui-badge ${currentPendingTotal > 0 ? 'ui-badge-danger' : 'ui-badge-success'}`}>
                        {currentPendingTotal > 0 ? 'Unpaid' : 'Clear'}
                      </span>
                    </div>

                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#0369a1', lineHeight: 1.2, marginBottom: '6px' }}>
                      ₹{currentPendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>

                    <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600, marginBottom: '10px' }}>
                      Cycle: {formatBillingMonth(getBillingMonths().currentMonthStr) || 'Current Month'} • Due: {getDueDateForMonth(getBillingMonths().currentMonthStr)}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e0f2fe', paddingTop: '10px', fontSize: '12px', color: '#0369a1', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span>Rent: <strong>₹{currentRentPending.toLocaleString('en-IN')}</strong></span>
                    <span>EB: <strong>₹{currentEbPending.toLocaleString('en-IN')}</strong></span>
                    {currentFinePending > 0 && <span>Fine: <strong>₹{currentFinePending.toLocaleString('en-IN')}</strong></span>}
                  </div>
                </div>

                {/* 2. Imported Outstanding Card */}
                <div className="ui-card" style={{ padding: '20px', border: '1px solid #fde68a', background: '#fefce8', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '40px', height: '40px', background: '#eab308', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileSpreadsheet size={20} color="#ffffff" />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#a16207', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Imported Outstanding</span>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#713f12' }}>Excel Backlog Ledger</h4>
                        </div>
                      </div>
                      <span className={`ui-badge ${outstandingSummary.remaining > 0 ? 'ui-badge-warning' : 'ui-badge-success'}`}>
                        {outstandingSummary.remaining > 0 ? 'Backlog Due' : 'Fully Settled'}
                      </span>
                    </div>

                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#a16207', lineHeight: 1.2, marginBottom: '6px' }}>
                      ₹{outstandingSummary.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>

                    <div style={{ fontSize: '12px', color: '#854d0e', fontWeight: 600, marginBottom: '10px' }}>
                      Imported from sheet • {outstandingSummary.invoices.length} invoice record(s)
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #fef08a', paddingTop: '10px', fontSize: '12px', color: '#854d0e', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span>Original: <strong>₹{outstandingSummary.original.toLocaleString('en-IN')}</strong></span>
                    <span>Paid: <strong style={{ color: '#16a34a' }}>₹{outstandingSummary.paid.toLocaleString('en-IN')}</strong></span>
                    <span>Balance: <strong style={{ color: '#b45309' }}>₹{outstandingSummary.remaining.toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>

                {/* 3. Grand Total Card */}
                <div className="ui-card" style={{ padding: '20px', border: '1px solid #ddd6fe', background: '#faf5ff', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '40px', height: '40px', background: '#8b5cf6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Wallet size={20} color="#ffffff" />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Combined Total</span>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#4c1d95' }}>Grand Total Outstanding</h4>
                        </div>
                      </div>
                      <span className={`ui-badge ${grandTotalOutstanding > 0 ? 'ui-badge-purple' : 'ui-badge-success'}`}>
                        {grandTotalOutstanding > 0 ? 'Total Due' : 'All Clear'}
                      </span>
                    </div>

                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#5b21b6', lineHeight: 1.2, marginBottom: '6px' }}>
                      ₹{grandTotalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>

                    <div style={{ fontSize: '12px', color: '#6d28d9', fontWeight: 600, marginBottom: '10px' }}>
                      Current (₹{currentPendingTotal.toLocaleString('en-IN')}) + Backlog (₹{outstandingSummary.remaining.toLocaleString('en-IN')})
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #ede9fe', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#6d28d9' }}>Total Payable by Student</span>
                    {grandTotalOutstanding > 0 && (
                      <button
                        onClick={() => {
                          if (currentPendingFees.length > 0) {
                            setFeeToCollect(currentPendingFees[0]);
                          } else if (outstandingSummary.invoices.length > 0) {
                            setFeeToCollect(outstandingSummary.invoices[0]);
                          } else {
                            navigate(`/fees?student=${student?.id || student?.uuid}`);
                          }
                        }}
                        className="ui-btn ui-btn-primary ui-btn-sm"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        <Wallet size={12} /> Collect Now
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 1: Current Month Outstanding Details */}
              <div className="ui-card ui-card--flush" style={{ marginBottom: '24px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} color="#0284c7" /> 1. Current Month Billing Dues
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Hostel room rent, EB, and fine invoices for the current billing cycle
                    </p>
                  </div>
                  <span className={`ui-badge ${currentPendingTotal > 0 ? 'ui-badge-danger' : 'ui-badge-success'}`}>
                    Total: ₹{currentPendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={{ padding: currentPendingFees.length === 0 ? '30px 20px' : '0' }}>
                  {currentPendingFees.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#16a34a' }}>
                      <CheckCircle2 size={36} style={{ margin: '0 auto 8px', color: '#16a34a' }} />
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>No Current Month Dues Pending</div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                        All monthly fees for {formatBillingMonth(getBillingMonths().currentMonthStr) || 'the current cycle'} are settled.
                      </p>
                    </div>
                  ) : (
                    <div className="ui-table-wrap">
                      <table className="ui-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th>Fee Description</th>
                            <th>Category</th>
                            <th>Billing Month</th>
                            <th>Due Date</th>
                            <th className="num">Amount (₹)</th>
                            <th>Status</th>
                            <th className="num">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPendingFees.map((fee, idx) => {
                            const feeType = String(fee.transactionType || '').toUpperCase();
                            const typeBadge = feeType.includes('RENT')
                              ? 'ui-badge-blue'
                              : feeType.includes('EB')
                                ? 'ui-badge-warning'
                                : feeType.includes('FINE')
                                  ? 'ui-badge-danger'
                                  : 'ui-badge-secondary';
                            const billingMonth = fee.billingMonth || (fee.description?.match(/(\d{4}-\d{2})/)?.[1]) || getBillingMonths().currentMonthStr;

                            return (
                              <tr key={fee.id || idx}>
                                <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{fee.description || 'Monthly Fee'}</div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>Generated on {new Date(fee.createdAt).toLocaleDateString('en-GB')}</div>
                                </td>
                                <td>
                                  <span className={`ui-badge ${typeBadge}`}>
                                    {feeType.replace('_', ' ')}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600, color: '#334155' }}>
                                    {formatBillingMonth(billingMonth) || billingMonth}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '12px' }}>
                                    {getDueDateForMonth(billingMonth)}
                                  </span>
                                </td>
                                <td className="num sp-kv-strong" style={{ color: '#dc2626', fontSize: '14px' }}>
                                  ₹{Number(fee.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td>
                                  <span className="ui-badge ui-badge-danger">Unpaid</span>
                                </td>
                                <td className="num">
                                  <button
                                    onClick={() => setFeeToCollect(fee)}
                                    className="ui-btn ui-btn-primary ui-btn-sm"
                                    style={{ padding: '5px 12px', fontSize: '12px' }}
                                  >
                                    <Wallet size={12} /> Pay Now
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                            <td colSpan={5} style={{ textAlign: 'right', padding: '12px 16px' }}>Current Month Dues Subtotal:</td>
                            <td className="num" style={{ color: '#dc2626', fontSize: '14px', padding: '12px 16px' }}>
                              ₹{currentPendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Imported Outstanding Details (From Excel) */}
              <div className="ui-card ui-card--flush" style={{ marginBottom: '24px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fefce8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#713f12', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileSpreadsheet size={18} color="#eab308" /> 2. Imported Outstanding Ledger (Excel Backlog)
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#854d0e' }}>
                      Historical dues imported in bulk from client Excel sheets or opening balance records
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`ui-badge ${outstandingSummary.remaining > 0 ? 'ui-badge-warning' : 'ui-badge-success'}`}>
                      Remaining Backlog: ₹{outstandingSummary.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {outstandingSummary.remaining > 0 && outstandingSummary.invoices.length > 0 && (
                      <button
                        onClick={() => setFeeToCollect(outstandingSummary.invoices[0])}
                        className="ui-btn ui-btn-primary ui-btn-sm"
                        style={{ padding: '5px 12px', fontSize: '12px' }}
                      >
                        <Wallet size={12} /> Pay Backlog
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ padding: outstandingSummary.invoices.length === 0 ? '30px 20px' : '0' }}>
                  {outstandingSummary.invoices.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b' }}>
                      <CheckCircle2 size={36} style={{ margin: '0 auto 8px', color: '#16a34a' }} />
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>No Imported Backlog Outstanding</div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                        This student has no historical or Excel-imported backlog balance.
                      </p>
                    </div>
                  ) : (
                    <div className="ui-table-wrap">
                      <table className="ui-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th>Import Date</th>
                            <th>Description</th>
                            <th className="num">Original Amount (₹)</th>
                            <th className="num">Amount Paid (₹)</th>
                            <th className="num">Remaining Due (₹)</th>
                            <th>Status</th>
                            <th className="num">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outstandingAllocations.map((item: any, idx: number) => {
                            const isFullyPaid = item.remainingAmount <= 0.005;
                            const isPartial = !isFullyPaid && item.paidAmount > 0;
                            return (
                              <tr key={item.invoiceId || idx} style={{ background: isFullyPaid ? '#f8fafc' : undefined }}>
                                <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                                <td>{new Date(item.invoice?.createdAt).toLocaleDateString('en-GB')}</td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                    {cleanPaymentDescription(item.invoice?.description) || 'Outstanding Balance'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    Type: {item.invoice?.transactionType || 'OUTSTANDING'}
                                  </div>
                                </td>
                                <td className="num">₹{Number(item.originalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="num" style={{ color: '#16a34a', fontWeight: 600 }}>
                                  ₹{Number(item.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num sp-kv-strong" style={{ color: isFullyPaid ? '#16a34a' : '#b45309', fontSize: '14px' }}>
                                  ₹{Number(item.remainingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td>
                                  <span className={`ui-badge ${isFullyPaid ? 'ui-badge-success' : isPartial ? 'ui-badge-warning' : 'ui-badge-danger'}`}>
                                    {isFullyPaid ? 'Settled' : isPartial ? 'Partial' : 'Unpaid'}
                                  </span>
                                </td>
                                <td className="num">
                                  {!isFullyPaid ? (
                                    <button
                                      onClick={() => setFeeToCollect(item.invoice)}
                                      className="ui-btn ui-btn-primary ui-btn-sm"
                                      style={{ padding: '5px 12px', fontSize: '12px' }}
                                    >
                                      <Wallet size={12} /> Pay
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Cleared</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#fefce8', fontWeight: 700 }}>
                            <td colSpan={3} style={{ textAlign: 'right', padding: '12px 16px', color: '#713f12' }}>Imported Backlog Totals:</td>
                            <td className="num" style={{ padding: '12px 16px', color: '#713f12' }}>
                              ₹{outstandingSummary.original.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="num" style={{ padding: '12px 16px', color: '#16a34a' }}>
                              ₹{outstandingSummary.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="num sp-kv-strong" style={{ padding: '12px 16px', color: '#b45309', fontSize: '14px' }}>
                              ₹{outstandingSummary.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Outstanding Payment Receipts */}
              {outstandingSummary.payments.length > 0 && (
                <div className="ui-card ui-card--flush">
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={18} color="#16a34a" /> 3. Confirmed Payments Towards Outstanding Backlog
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Receipts issued for payments made against the historical backlog
                    </p>
                  </div>

                  <div className="ui-table-wrap">
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th>Invoice / Receipt No</th>
                          <th>Payment Date</th>
                          <th>Payment Mode</th>
                          <th className="num">Amount Paid (₹)</th>
                          <th className="num">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outstandingSummary.payments.map((pmt, idx) => (
                          <tr key={pmt.id || idx}>
                            <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>
                              {pmt.invoiceNumber || formatInvoiceNumber(pmt, fees)}
                            </td>
                            <td>{new Date(pmt.paidDate || pmt.createdAt).toLocaleDateString('en-GB')}</td>
                            <td>
                              <span className="ui-badge ui-badge-secondary">{pmt.paymentMode || 'Cash'}</span>
                            </td>
                            <td className="num sp-kv-strong" style={{ color: '#16a34a', fontSize: '14px' }}>
                              ₹{Number(pmt.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="num">
                              <button
                                onClick={() => setSelectedReceipt({ ...pmt, student: { name: student.name, regNo: student.id, roomNo: student.room } })}
                                className="ui-btn ui-btn-secondary ui-btn-sm"
                                style={{ padding: '5px 12px', fontSize: '12px' }}
                              >
                                <FileText size={12} color="#64748b" /> View Receipt
                              </button>
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

              <div className="sp-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="sp-stat">
                  <div className="sp-stat-label">Total Paid (Receipts)</div>
                  <div className="sp-stat-value" style={{ color: '#16a34a' }}>₹{roundMoney(
                    displayFees
                      .filter(f => f.displayStatus === 'Paid' || f.displayStatus === 'Partial')
                      .reduce((sum, f) => sum + Number(f.displayPaid || 0), 0)
                  ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-label">Current Month Due</div>
                  <div className="sp-stat-value" style={{ color: currentPendingTotal > 0 ? '#0284c7' : undefined }}>
                    ₹{currentPendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-label">Imported Backlog Due</div>
                  <div className="sp-stat-value" style={{ color: outstandingSummary.remaining > 0 ? '#b45309' : undefined }}>
                    ₹{outstandingSummary.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-label">Total Outstanding Dues</div>
                  <div className="sp-stat-value" style={{ color: grandTotalOutstanding > 0 ? '#dc2626' : '#16a34a' }}>
                    ₹{grandTotalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <FeeGenerationNotice billingCycle={student?.billingCycle} compact />

              {displayFees.length === 0 ? (
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
                          {/* <th className="num">Mess</th> */}
                          <th className="num">Fine</th>
                          <th className="num">Outstanding Balance</th>
                          <th className="num">Total Paid</th>
                          <th>Status</th>
                          <th className="num">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayFees.map(fee => (
                          <tr key={fee.id} className={fee.status === 'PENDING' ? 'sp-row-pending' : undefined}>
                            <td className="sp-invoice">
                              {fee.displayStatus !== 'Unpaid' && fee.status === 'COMPLETED'
                                ? (fee.invoiceNumber || (fee.invoiceFee ? formatInvoiceNumber(fee.invoiceFee, fees) : '—'))
                                : '—'}
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
                            {/*
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
                            */}
                            <td className="num">₹{fee.fine.toLocaleString('en-IN')}</td>

                            <td className={`num sp-outstanding${(fee.displayBalance || 0) > 0 ? ' is-due' : ' is-clear'}`}>
                              ₹{Number(fee.displayBalance || 0).toLocaleString('en-IN')}
                            </td>

                            <td className={`num sp-total${fee.displayStatus === 'Unpaid' ? ' is-pending' : ''}`}>
                              ₹{Number(fee.displayPaid || 0).toLocaleString('en-IN')}
                            </td>

                            <td>
                              <span className={`ui-badge ${fee.displayStatus === 'Paid' ? 'ui-badge-success' : fee.displayStatus === 'Partial' ? 'ui-badge-warning' : fee.displayStatus === 'Not Due' ? 'ui-badge-blue' : 'ui-badge-danger'}`}>
                                {fee.displayStatus}
                              </span>
                            </td>
                            <td className="num">
                              {fee.displayStatus === 'Unpaid' ? (
                                <button onClick={() => navigate(`/fees?student=${student?.id || student?.uuid}`)} className="ui-btn ui-btn-primary ui-btn-sm">
                                  <Wallet size={14} /> Pay Now
                                </button>
                              ) : fee.displayStatus === 'Not Due' ? (
                                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                  Not due yet
                                </span>
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
                                  <br />
                                  <span className="ui-cell-sub">{new Date(txn.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                </td>
                                <td>
                                  {txn.status === 'COMPLETED' ? formatInvoiceNumber({ ...txn, student }, fees) : '—'}
                                </td>
                                <td>
                                  <span
                                    className="ui-badge ui-badge-neutral"
                                    title={
                                      txn.razorpayPaymentId
                                        ? `Razorpay Order: ${txn.razorpayOrderId || 'N/A'} | Payment: ${txn.razorpayPaymentId} | Status: ${txn.paymentStatus || 'N/A'}`
                                        : undefined
                                    }
                                  >
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

          {activeTab !== 'Master Profile' && activeTab !== 'KYC Documents' && activeTab !== 'Fees & Receipts' && activeTab !== 'Gate Logs' && activeTab !== 'Outpasses & Travel' && activeTab !== 'Outstanding Payments' && activeTab !== 'Advance Deposit' && (
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
          outstandingPaid={outstandingSummary.paid}
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
