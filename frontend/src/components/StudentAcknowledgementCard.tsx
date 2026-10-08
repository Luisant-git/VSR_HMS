import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Printer, Download, ArrowLeft, Building2 } from 'lucide-react';
import { getSystemSettings } from '../api/settings.api';

interface StudentAcknowledgementCardProps {
  student: any;
  collegeName?: string;
  onBack: () => void;
  isViewOnly?: boolean;
}

export const StudentAcknowledgementCard: React.FC<StudentAcknowledgementCardProps> = ({ student, collegeName, onBack, isViewOnly }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hostelName, setHostelName] = useState('Hostel Management System');

  useEffect(() => {
    getSystemSettings().then(data => {
      if (data && data.hostelName) setHostelName(data.hostelName);
    }).catch(() => {});
  }, []);

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

  const displayRoom = student.roomNo || student.room || 'N/A';
  const displayRegNo = student.manualRegsiName || student.regNo || student.id || 'N/A';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isViewOnly ? '0' : '20px 10px', animation: 'fadeIn 0.5s ease' }}>
      {!isViewOnly ? (
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', marginBottom: '16px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
            Registration Successful!
          </h2>
          <p style={{ color: '#64748b', fontSize: '16px' }}>
            The student profile has been created. Here is their generated ID Card.
          </p>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
            Student ID Card
          </h2>
          <p style={{ color: '#64748b', fontSize: '15px' }}>
            Preview, download, or print the student ID card.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
        {/* ID Card Wrapper for capturing/printing */}
        <div
          ref={cardRef}
          className="id-card-print-area"
          style={{
            width: '100%',
            maxWidth: '340px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            position: 'relative'
          }}
        >
          {/* Header */}
          <div style={{ background: 'var(--sidebar-active, #0ea5e9)', padding: '20px 12px 24px', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
                <Building2 size={20} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px' }}>{hostelName}</h3>
              </div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, opacity: 0.9, letterSpacing: '1px' }}>STUDENT IDENTITY CARD</p>
            </div>

            {/* Background design elements */}
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
            <div style={{ position: 'absolute', bottom: '-40px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
          </div>

          {/* Curved separator */}
          <svg style={{ position: 'absolute', top: '78px', left: 0, width: '100%', height: '24px', zIndex: 2 }} viewBox="0 0 100 24" preserveAspectRatio="none">
            <path d="M0,0 C50,24 100,0 100,0 L100,24 L0,24 Z" fill="#ffffff" />
          </svg>

          <div style={{ padding: '16px 16px 20px', position: 'relative', zIndex: 3, textAlign: 'center' }}>
            {/* Photo */}
            <div style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              border: '4px solid white',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              margin: '0 auto 16px',
              overflow: 'hidden',
              backgroundColor: '#f1f5f9',
              position: 'relative',
              marginTop: '-30px'
            }}>
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>No Photo</div>
              )}
            </div>

            <h4 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{student.name}</h4>
            <p style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: 'var(--sidebar-active, #0ea5e9)' }}>{displayRegNo}</p>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 8px', textAlign: 'left', marginBottom: '16px' }}>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Room No</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{displayRoom} {student.bedNo && student.bedNo !== 'N/A' ? `(${student.bedNo})` : ''}</span>
              </div>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Blood Group</span>
                <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '14px' }}>{student.bloodGroup || 'N/A'}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#475569', display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>College</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{collegeName || student.collegeId || 'N/A'}</span>
              </div>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Mobile</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{maskedMobile}</span>
              </div>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Joined</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{formattedDate}</span>
              </div>
              <div>
                <span style={{ color: '#475569', display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Food</span>
                <span style={{
                  fontWeight: 900,
                  color: 'white',
                  backgroundColor: student.foodType === 'Veg' ? '#16a34a' : student.foodType === 'Non-Veg' ? '#dc2626' : '#64748b',
                  fontSize: '13px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>{student.foodType || 'N/A'}</span>
              </div>
              {student.biometricId ? (
                <div>
                  <span style={{ color: '#475569', display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Bio ID</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{student.biometricId}</span>
                </div>
              ) : (
                <div></div>
              )}
            </div>

            {/* QR Code Area */}
            <div style={{ borderTop: '2px dashed #f1f5f9', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', overflow: 'hidden' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/id/${student.uuid || student.id}`}
                  size={120}
                  level={"H"}
                  includeMargin={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{ padding: '14px 24px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, background: 'white', border: '2px solid #e2e8f0', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
          onMouseOut={(e) => e.currentTarget.style.background = 'white'}
        >
          <ArrowLeft size={18} /> {isViewOnly ? 'Close' : 'Back to Registration'}
        </button>
        <button
          onClick={handlePrint}
          style={{ padding: '14px 24px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, background: 'white', border: '2px solid var(--sidebar-active, #0ea5e9)', color: 'var(--sidebar-active, #0ea5e9)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f0f9ff'}
          onMouseOut={(e) => e.currentTarget.style.background = 'white'}
        >
          <Printer size={18} /> Print Student ID
        </button>
        <button
          onClick={handleDownload}
          style={{ padding: '14px 24px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, background: 'var(--sidebar-active, #0ea5e9)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 16px rgba(14, 165, 233, 0.25)', transition: 'transform 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Download size={18} /> Download / Save
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
