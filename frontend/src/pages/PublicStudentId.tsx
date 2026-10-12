import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentAPI } from '../api/student.api';
import { MessAttendanceCheckin } from '../components/MessAttendanceCheckin';
import { AlertCircle, LogOut, Calendar } from 'lucide-react';

export default function PublicStudentId() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      StudentAPI.findOne(id)
        .then(data => {
          if (!data) throw new Error('Student not found');
          setStudent(data);
        })
        .catch(err => {
          console.error(err);
          setError('Invalid or expired Student ID.');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>Loading Digital ID...</div>;
  }

  if (error || !student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc', padding: '20px', textAlign: 'center' }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h2 style={{ color: '#0f172a', margin: '0 0 8px' }}>Verification Failed</h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={() => navigate('/login')}
          style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
        >
          Go to Home
        </button>
      </div>
    );
  }

  const displayRegNo = student.manualRegsiName || student.regNo || student.id || 'N/A';
  const displayRoom = student.roomNo || student.room || 'N/A';

  // Format today's date
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
  const formattedDate = today.toLocaleDateString('en-GB', dateOptions);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        /* Exact Student Admission Form Topbar Style */
        .sa-topbar { 
          position: fixed; 
          top: 0; 
          left: 0; 
          right: 0; 
          height: 72px; 
          background: rgba(255, 255, 255, 0.85); 
          backdrop-filter: blur(12px); 
          -webkit-backdrop-filter: blur(12px); 
          border-bottom: 1px solid rgba(0, 0, 0, 0.05); 
          z-index: 40; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
        }

        .sa-topbar-inner { 
          width: 100%; 
          max-width: 600px; 
          padding: 0 20px; 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
        }

        .sa-logo { 
          display: flex; 
          align-items: center; 
          gap: 12px; 
          font-weight: 700; 
          font-size: 18px; 
          color: #0f172a; 
          white-space: nowrap;
        }

        .sa-logo div { 
          width: 36px; 
          height: 36px; 
          background: #0ea5e9; 
          color: #fff; 
          border-radius: 10px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          flex-shrink: 0;
        }

        .sa-btn.ghost.sm {
          background: transparent;
          color: #0284c7;
          border: none;
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 10px;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .sa-btn.ghost.sm:hover {
          background: #f0f9ff;
        }

        .sa-date-pill {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 5px 11px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Page wrapper below fixed topbar */
        .profile-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 88px 16px 40px;
        }

        @media (max-width: 480px) {
          .sa-topbar {
            height: 64px;
          }
          .sa-topbar-inner {
            padding: 0 16px;
          }
          .sa-logo {
            font-size: 17px;
            gap: 10px;
            white-space: nowrap;
          }
          .sa-logo div {
            width: 34px;
            height: 34px;
            border-radius: 8px;
          }
          .sa-lo {
            display: none;
          }
          .sa-date-pill {
            font-size: 11px;
            padding: 4px 8px;
            white-space: nowrap;
          }

          .profile-container { 
            padding: 76px 14px 32px !important; 
          }

          .profile-card { 
            padding: 16px 18px !important; 
            gap: 16px !important; 
            margin-bottom: 20px !important; 
            border-radius: 20px !important;
            box-shadow: 0 10px 30px -5px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04) !important;
          }
          .anti-cheat-banner { 
            margin: -16px -18px 0 -18px !important; 
            font-size: 13.5px !important; 
            padding: 10px 12px !important; 
            letter-spacing: 2px !important; 
            border-radius: 20px 20px 0 0 !important; 
          }
          .profile-top { 
            flex-direction: row !important; 
            text-align: left !important; 
            gap: 16px !important; 
            align-items: center !important; 
          }
          .profile-pic { 
            width: 68px !important; 
            height: 68px !important; 
            border-width: 2.5px !important; 
          }
          .student-info-col { flex: 1; }
          .student-name { 
            font-size: 19px !important; 
            margin-bottom: 2px !important; 
            line-height: 1.25 !important;
          }
          .profile-name { 
            justify-content: flex-start !important; 
            margin-top: 0 !important; 
            font-size: 13.5px !important; 
          }
          .badges-row { 
            justify-content: flex-start !important; 
            margin-top: 10px !important; 
            gap: 8px !important; 
          }
          .badge-item { 
            padding: 5px 12px !important; 
            font-size: 12px !important; 
            border-radius: 100px !important;
          }
          
          .section-title { 
            padding: 0 4px 14px !important; 
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 6px !important;
          }
          .section-title h2 { 
            font-size: 18px !important; 
            margin-bottom: 2px !important; 
            letter-spacing: -0.3px !important;
          }
          .section-title p { 
            display: block !important; 
            font-size: 13px !important;
            color: #64748b !important;
          } 
          .attendance-date-badge {
            padding: 4px 10px !important;
            font-size: 11px !important;
          }
        }
      `}</style>

      {/* Modern Top Bar - Exactly identical to Student Admission Form */}
      <header className="sa-topbar">
        <div className="sa-topbar-inner">
          <div className="sa-logo">
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 7h10" />
                <path d="M7 12h10" />
                <path d="M7 17h6" />
              </svg>
            </div>
            <span>Hostel</span>
          </div>

          <button
            type="button"
            className="sa-btn ghost sm"
            style={{ border: 'none', background: 'transparent' }}
            onClick={() => navigate('/login')}
            aria-label="Log out"
          >
            <LogOut size={16} /> <span className="sa-lo">Log out</span>
          </button>
        </div>
      </header>

      <div className="profile-container">

        {/* Profile Card */}
        <div className="profile-card" style={{
          background: 'white',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 0 1px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginBottom: '24px'
        }}>

          {/* MASSIVE ANTI-CHEAT FOOD TYPE BANNER */}
          <div className="anti-cheat-banner" style={{
            background: student.foodType === 'Veg' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : student.foodType === 'Non-Veg' ? 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' : '#64748b',
            color: 'white',
            margin: '-20px -20px 0 -20px',
            padding: '12px',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            textAlign: 'center',
            fontWeight: 900,
            fontSize: '18px',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}>
            {student.foodType === 'Veg' ? 'PURE VEGETARIAN' : student.foodType === 'Non-Veg' ? 'NON-VEGETARIAN' : 'NO FOOD TYPE'}
          </div>

          {/* Top Half: Photo & Basic Info */}
          <div className="profile-top" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="profile-pic" style={{
              width: '85px', height: '85px', borderRadius: '50%', overflow: 'hidden',
              boxShadow: '0 4px 15px rgba(0,0,0,0.08)', border: '3px solid #f8fafc',
              flexShrink: 0, background: '#e2e8f0'
            }}>
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>No Photo</div>
              )}
            </div>

            <div className="student-info-col" style={{ flex: 1 }}>
              <h2 className="student-name" style={{ margin: '0 0 4px', fontSize: '22px', color: '#0f172a', fontWeight: 700, letterSpacing: '-0.5px' }}>{student.name}</h2>
              <div className="profile-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: 600, fontSize: '15px' }}>
                {displayRegNo}
                <svg onClick={() => navigator.clipboard.writeText(displayRegNo)} style={{ cursor: 'pointer', opacity: 0.7 }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
              </div>

              {/* Unified Badges Row */}
              <div className="badges-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>

                {/* Room No Badge */}
                <div className="badge-item" style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontWeight: 700, color: '#1d4ed8',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                  padding: '6px 14px', borderRadius: '100px',
                  fontSize: '13px', border: 'none'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></svg>
                  Room {displayRoom}
                </div>

                {/* Status Badge */}
                <div className="badge-item" style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontWeight: 700,
                  color: student.status !== 'Vacated' ? '#0f766e' : '#475569',
                  background: student.status !== 'Vacated' ? 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)' : '#f1f5f9',
                  boxShadow: student.status !== 'Vacated' ? '0 4px 12px rgba(20, 184, 166, 0.15)' : 'none',
                  padding: '6px 14px', borderRadius: '100px',
                  fontSize: '13px', border: 'none'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: student.status !== 'Vacated' ? '#0d9488' : '#64748b' }}></span>
                  {student.status !== 'Vacated' ? 'Active' : 'Inactive'}
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div className="section-title" style={{ padding: '0 4px 16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.3px' }}>Today&apos;s Mess Attendance</h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Mark your attendance for today&apos;s meals</p>
          </div>
          <div className="attendance-date-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: '#475569', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)', whiteSpace: 'nowrap' }}>
            <Calendar size={13} strokeWidth={2.4} color="#0ea5e9" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Mess Attendance UI */}
        <MessAttendanceCheckin studentId={student.id} />
      </div>
    </div>
  );
}
