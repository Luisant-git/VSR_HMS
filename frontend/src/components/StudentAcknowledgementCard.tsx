import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Printer, Download, ArrowLeft, Building2 } from 'lucide-react';
import { getSystemSettings } from '../api/settings.api';
import { sendWhatsAppPdf, sendStudentWhatsAppIdCard } from '../api/whatsapp.api';
import { normalizePhoneNumber } from '../utils/whatsappReceipt';
import { toast } from 'react-toastify';

interface StudentAcknowledgementCardProps {
  student: any;
  collegeName?: string;
  onBack: () => void;
  isViewOnly?: boolean;
  isEdit?: boolean;
}

export const StudentAcknowledgementCard: React.FC<StudentAcknowledgementCardProps> = ({ student, collegeName, onBack, isViewOnly, isEdit }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hostelName, setHostelName] = useState('Hostel Management System');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const autoSentRef = useRef(false);

  useEffect(() => {
    getSystemSettings().then(data => {
      if (data && data.hostelName) setHostelName(data.hostelName);
    }).catch(() => { });
  }, []);

  const generateIdCardPdf = async (): Promise<{ pdfBase64: string; fileName: string } | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 3000,
      });
      const imgData = canvas.toDataURL('image/png');
      // JS PDF CR80 format in portrait (54x85.6mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [54, 85.6],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, 54, 85.6);
      const regLabel = String(student.manualRegsiName || student.regNo || 'student').replace(/[<>:"/\\|?*]+/g, '_');
      const fileName = `StudentID_${regLabel}.pdf`;
      const rawData = pdf.output('datauristring');
      const commaIdx = rawData.indexOf(',');
      const pdfBase64 = commaIdx !== -1 ? rawData.slice(commaIdx + 1) : rawData;
      return { pdfBase64, fileName };
    } catch (e) {
      console.warn('Canvas capture fallback:', e);
      return null;
    }
  };

  const handleWhatsAppSend = async (isAuto = false) => {
    let rawPhone = student.mobileNo || student.mobile || student.fatherMobileNo || student.guardianMobileNo || '';
    let targetPhone = normalizePhoneNumber(rawPhone);

    if (!targetPhone || targetPhone.length < 10) {
      if (isAuto) return;
      const entered = window.prompt(
        `Enter WhatsApp mobile number for ${student.name || 'student'}:`,
        rawPhone || '',
      );
      if (!entered) return;
      targetPhone = normalizePhoneNumber(entered);
    }

    if (targetPhone.length < 10) {
      if (!isAuto) toast.error('Invalid mobile number. Please provide a valid 10-digit number.');
      return;
    }

    setSendingWhatsApp(true);
    const toastId = isAuto
      ? toast.loading(`Automatically sending ${isEdit ? 'updated ' : ''}ID card to ${targetPhone}...`)
      : toast.loading(`Sending ID card to ${targetPhone}...`);

    try {
      let sentSuccess = false;

      // 1. Try sending the official server-rendered vector ID card PDF directly
      try {
        const serverRes = await sendStudentWhatsAppIdCard(targetPhone, {
          ...student,
          collegeName: collegeName || student.collegeId,
        });
        if (serverRes && serverRes.success) {
          sentSuccess = true;
        }
      } catch (serverErr) {
        // Fallback to client-side rendered PDF if server endpoint had an issue
      }

      // 2. Fallback to client-rendered PDF if needed
      if (!sentSuccess) {
        const result = await generateIdCardPdf();
        if (result) {
          const caption = `Official Student ID Card - ${student.name || 'Student'}`;
          const res = await sendWhatsAppPdf(targetPhone, result.pdfBase64, result.fileName, caption);
          if (res && res.success) {
            sentSuccess = true;
          }
        }
      }

      if (sentSuccess) {
        toast.update(toastId, {
          render: `✅ ${isEdit ? 'Updated ' : ''}Student ID Card sent to WhatsApp: ${targetPhone}`,
          type: 'success',
          isLoading: false,
          autoClose: 4000,
        });
      } else {
        toast.update(toastId, {
          render: '⚠️ WhatsApp ID card could not be delivered. Make sure the backend WhatsApp bot is linked.',
          type: 'warning',
          isLoading: false,
          autoClose: 5000,
        });
      }
    } catch (err: any) {
      toast.update(toastId, {
        render: `❌ Failed to send ID card on WhatsApp: ${err.message}`,
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  useEffect(() => {
    // When newly registered (!isViewOnly), automatically send the ID card to student on WhatsApp!
    if (!isViewOnly && !autoSentRef.current) {
      autoSentRef.current = true;
      const timer = setTimeout(() => {
        handleWhatsAppSend(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isViewOnly]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 4, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    // JS PDF CR80 format in portrait (54x85.6mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [54, 85.6]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, 54, 85.6);
    pdf.save(`StudentID_${student.manualRegsiName || student.regNo || 'new'}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Handle different data shapes (StudentProfile vs raw API object)
  const rawMobile = student.mobileNo || student.mobile;
  const maskedMobile = rawMobile ? `+91 ******${rawMobile.slice(-4)}` : 'N/A';

  const rawDate = student.dateOfJoining || student.joined;
  let formattedDate = new Date().toLocaleDateString('en-GB');
  if (rawDate) {
    const parsedDate = new Date(rawDate);
    if (!isNaN(parsedDate.getTime())) {
      formattedDate = parsedDate.toLocaleDateString('en-GB');
    } else {
      formattedDate = rawDate;
    }
  }

  const displayRoom = typeof student.roomNo === 'object' && student.roomNo !== null
    ? student.roomNo.value || student.roomNo.id || student.roomNo.roomNumber || 'N/A'
    : (student.roomNo || student.room || 'N/A');
  const displayRegNo = student.manualRegsiName || student.regNo || student.id || 'N/A';

  return (
    <div className="id-card-container" style={{ animation: 'fadeIn 0.4s ease', maxWidth: '650px', padding: isViewOnly ? '4px 8px' : '12px 8px' }}>
      {!isViewOnly ? (
        <div className="id-card-header" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', marginBottom: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px' }}>
            {isEdit ? 'Profile Updated Successfully!' : 'Registration Successful!'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
            {isEdit
              ? 'The student profile has been updated. Here is their updated ID Card.'
              : 'The student profile has been created. Here is their generated ID Card.'}
          </p>
        </div>
      ) : (
        <div className="id-card-header" style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 3px' }}>
            Student ID Card
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Preview, download, or print the student ID card.
          </p>
        </div>
      )}

      <div className="id-card-stage" style={{ marginBottom: '16px' }}>
        {/* ID Card Wrapper for capturing/printing */}
        <div
          ref={cardRef}
          className="id-card-print-area"
          style={{
            width: '100%',
            maxWidth: 'min(100%, 295px)',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 16px 32px -8px rgba(0,0,0,0.14)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            position: 'relative',
            boxSizing: 'border-box'
          }}
        >
          {/* Header */}
          <div style={{ background: 'var(--sidebar-active, #0ea5e9)', padding: '14px 10px 18px', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '2px' }}>
                <Building2 size={17} />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, letterSpacing: '0.4px' }}>{hostelName}</h3>
              </div>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 600, opacity: 0.9, letterSpacing: '0.8px' }}>STUDENT IDENTITY CARD</p>
            </div>

            {/* Background design elements */}
            <div style={{ position: 'absolute', top: '-16px', right: '-16px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
            <div style={{ position: 'absolute', bottom: '-30px', left: '-16px', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
          </div>

          {/* Curved separator */}
          <svg style={{ position: 'absolute', top: '64px', left: 0, width: '100%', height: '20px', zIndex: 2 }} viewBox="0 0 100 24" preserveAspectRatio="none">
            <path d="M0,0 C50,24 100,0 100,0 L100,24 L0,24 Z" fill="#ffffff" />
          </svg>

          <div style={{ padding: '12px 14px 14px', position: 'relative', zIndex: 3, textAlign: 'center' }}>
            {/* Photo */}
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              border: '3px solid white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              margin: '0 auto 10px',
              overflow: 'hidden',
              backgroundColor: '#f1f5f9',
              position: 'relative',
              marginTop: '-24px'
            }}>
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt="Student"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
                  crossOrigin={student.photoUrl.startsWith('data:') ? undefined : 'anonymous'}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>No Photo</div>
              )}
            </div>

            <h4 style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{student.name}</h4>
            <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: 'var(--sidebar-active, #0ea5e9)' }}>{displayRegNo}</p>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 6px', textAlign: 'left', marginBottom: '10px', wordBreak: 'break-word' }}>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Room No</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>{displayRoom} {student.bedNo && student.bedNo !== 'N/A' ? `(${student.bedNo})` : ''}</span>
              </div>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Blood Group</span>
                <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '12.5px' }}>{student.bloodGroup || 'N/A'}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#475569', display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>College</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>{collegeName || student.collegeId || 'N/A'}</span>
              </div>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Mobile</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>{maskedMobile}</span>
              </div>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Joined</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>{formattedDate}</span>
              </div>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Food</span>
                <span style={{
                  fontWeight: 800,
                  color: 'white',
                  backgroundColor: student.foodType === 'Veg' ? '#16a34a' : student.foodType === 'Non-Veg' ? '#dc2626' : '#64748b',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  display: 'inline-block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}>{student.foodType || 'N/A'}</span>
              </div>
              {student.biometricId ? (
                <div>
                  <span style={{ color: '#475569', display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Bio ID</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>{student.biometricId}</span>
                </div>
              ) : (
                <div></div>
              )}
            </div>

            {/* QR Code Area */}
            <div style={{ borderTop: '1.5px dashed #f1f5f9', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/id/${student.uuid || student.id}`}
                  size={92}
                  level={"H"}
                  includeMargin={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="id-card-actions">
        <button
          onClick={onBack}
          className="id-card-btn id-card-btn-close"
        >
          <ArrowLeft size={16} /> {isViewOnly ? 'Close' : isEdit ? 'Back to Hostellers' : 'Back to Registration'}
        </button>
        <button
          onClick={handlePrint}
          className="id-card-btn id-card-btn-print"
        >
          <Printer size={16} /> Print Student ID
        </button>
        <button
          onClick={handleDownload}
          className="id-card-btn id-card-btn-download"
        >
          <Download size={16} /> Download / Save
        </button>
        <button
          onClick={() => handleWhatsAppSend(false)}
          disabled={sendingWhatsApp}
          className="id-card-btn id-card-btn-whatsapp"
          title="Send official Student ID Card directly on WhatsApp"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
          <span>{sendingWhatsApp ? 'Sending...' : 'Send on WhatsApp'}</span>
        </button>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media print {
            body * {
              visibility: hidden;
            }
            .id-card-print-area, .id-card-print-area * {
              visibility: visible;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .id-card-print-area {
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) scale(1.2) !important;
              box-shadow: none !important;
              margin: 0 !important;
            }
          }
        `}
      </style>
    </div>
  );
};
