import { useState, useEffect, useRef } from 'react';
import { ScanFace, Fingerprint, RefreshCw, CheckCircle2, User, Eye, LogIn, LogOut, X, Camera } from 'lucide-react';
import { StudentAPI } from '../../api/student.api';
import { useNavigate } from 'react-router-dom';

const BiometricIdentify = () => {
  const navigate = useNavigate();
  const [scanState, setScanState] = useState<'idle' | 'scanning_face' | 'scanning_finger' | 'success' | 'error'>('idle');
  const [identifiedStudent, setIdentifiedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [scanState, mediaStream]);

  useEffect(() => {
    // We fetch students to randomly pick one for the simulation
    StudentAPI.findAll().then(data => {
      setStudents(data.filter((s: any) => s.status !== 'Vacated'));
    }).catch(console.error);

    // Initialize Camera
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setMediaStream(stream);
      setCameraActive(true);
      setCameraError(null);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setCameraActive(false);
      setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied' : 'Camera not found or blocked');
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
      setCameraActive(false);
    }
  };

  const simulateScan = (type: 'face' | 'finger') => {
    setScanState(type === 'face' ? 'scanning_face' : 'scanning_finger');
    setIdentifiedStudent(null);

    setTimeout(() => {
      // 80% success rate simulation
      if (Math.random() > 0.2 && students.length > 0) {
        // Pick a random student
        const randomStudent = students[Math.floor(Math.random() * students.length)];
        setIdentifiedStudent(randomStudent);
        setScanState('success');
      } else {
        setScanState('error');
      }
    }, 3000);
  };

  const resetScanner = () => {
    setScanState('idle');
    setIdentifiedStudent(null);
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '25px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)' }}>Biometric Identification</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '5px' }}>
          Simulate a gate scan to identify hostellers instantly via connected biometric devices.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '30px' }}>
        {/* Scanner Terminal UI */}
        <div style={{ background: '#0f172a', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '15px 20px', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
            <div style={{ color: 'white', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 8px #22c55e' }}></div>
              Terminal Ready
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>Biometric Gateway</div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 30px', minHeight: '400px', position: 'relative' }}>
            
            {scanState === 'idle' && (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s', width: '100%' }}>
                <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto 20px auto', borderRadius: '50%', overflow: 'hidden', border: '4px solid #334155', background: '#1e293b' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: cameraActive ? 'block' : 'none' }} 
                  />
                  {!cameraActive && (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={60} color="#475569" />
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '50%', margin: '15px', pointerEvents: 'none' }}></div>
                </div>
                
                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>Ready to Scan</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '300px', margin: '0 auto 20px auto' }}>
                  Position the student in front of the camera or use the fingerprint scanner.
                </p>

                {cameraError && (
                  <div style={{ color: '#f87171', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '6px', maxWidth: '280px', margin: '0 auto 20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <X size={14} /> {cameraError} (using fallback UI)
                  </div>
                )}

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button onClick={() => simulateScan('face')} style={{ padding: '12px 20px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(59, 130, 246, 0.2)'} onMouseOut={e => e.currentTarget.style.background='rgba(59, 130, 246, 0.1)'}>
                    <ScanFace size={18} /> Simulate Face
                  </button>
                  <button onClick={() => simulateScan('finger')} style={{ padding: '12px 20px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c084fc', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(139, 92, 246, 0.2)'} onMouseOut={e => e.currentTarget.style.background='rgba(139, 92, 246, 0.1)'}>
                    <Fingerprint size={18} /> Simulate Finger
                  </button>
                </div>
              </div>
            )}

            {(scanState === 'scanning_face' || scanState === 'scanning_finger') && (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 30px auto' }}>
                  {scanState === 'scanning_face' ? (
                    cameraActive ? (
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', opacity: 0.5 }}>
                         <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                        />
                      </div>
                    ) : <ScanFace size={120} color="#3b82f6" opacity={0.2} />
                  ) : <Fingerprint size={120} color="#8b5cf6" opacity={0.2} />}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: scanState === 'scanning_face' ? '#60a5fa' : '#c084fc', boxShadow: `0 0 15px ${scanState === 'scanning_face' ? '#60a5fa' : '#c084fc'}`, animation: 'scan 1.5s infinite linear' }} />
                  <style>{`@keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }`}</style>
                </div>
                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                  <RefreshCw className="animate-spin" size={20} color="#94a3b8" /> Processing Data...
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                  Matching against database records.
                </p>
              </div>
            )}

            {scanState === 'success' && (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s' }}>
                <div style={{ width: '100px', height: '100px', background: 'rgba(34, 197, 94, 0.1)', border: '2px solid #22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)' }}>
                  <CheckCircle2 size={50} color="#22c55e" />
                </div>
                <h3 style={{ color: '#4ade80', fontSize: '24px', fontWeight: 700, marginBottom: '10px' }}>Student Identified</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '30px' }}>Match confidence: 98.7%</p>
                <button onClick={resetScanner} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'} onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}>
                  Reset Scanner
                </button>
              </div>
            )}

            {scanState === 'error' && (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s' }}>
                <div style={{ width: '100px', height: '100px', background: 'rgba(239, 68, 68, 0.1)', border: '2px solid #ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)' }}>
                  <X size={50} color="#ef4444" />
                </div>
                <h3 style={{ color: '#f87171', fontSize: '24px', fontWeight: 700, marginBottom: '10px' }}>Unrecognized</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '30px', maxWidth: '280px', margin: '0 auto 30px auto' }}>The biometric data did not match any active student in the database.</p>
                <button onClick={resetScanner} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'} onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}>
                  Scan Again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Identified Student Card */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)', padding: '30px', display: 'flex', flexDirection: 'column', opacity: identifiedStudent ? 1 : 0.4, pointerEvents: identifiedStudent ? 'auto' : 'none', transition: 'all 0.3s' }}>
          
          {!identifiedStudent ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <User size={60} style={{ marginBottom: '15px', opacity: 0.5 }} />
              <div style={{ fontSize: '16px', fontWeight: 500 }}>Waiting for identification...</div>
            </div>
          ) : (
            <div style={{ animation: 'fadeIn 0.3s', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', paddingBottom: '25px', borderBottom: '1px solid #f1f5f9' }}>
                {identifiedStudent.photoUrl ? (
                  <img src={identifiedStudent.photoUrl} alt="Student" style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f8fafc', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />
                ) : (
                  <div style={{ width: '90px', height: '90px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #e2e8f0' }}>
                    <User size={40} color="#94a3b8" />
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>{identifiedStudent.name}</h3>
                  <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500, marginBottom: '8px' }}>{identifiedStudent.manualRegsiName || identifiedStudent.regNo}</div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ display: 'inline-block', padding: '4px 10px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                      {identifiedStudent.status}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                      <CheckCircle2 size={12} /> Biometric Verified
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px', marginBottom: '30px', flex: 1 }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>Room / Bed</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 600 }}>{identifiedStudent.roomNo || 'N/A'} - {identifiedStudent.bedNo || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>Block</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 600 }}>{identifiedStudent.blockFloor || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>College</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 600 }}>{identifiedStudent.college || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>Contact</div>
                  <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 600 }}>{identifiedStudent.mobileNo || '-'}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Last Gate In</div>
                  <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>25 Sep 2026, 06:45 PM</div>
                </div>
                <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Last Gate Out</div>
                  <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>26 Sep 2026, 08:30 AM</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <button 
                  onClick={() => navigate(`/hostellers/profile/${identifiedStudent.id}`)}
                  style={{ padding: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background='#e2e8f0'} 
                  onMouseOut={e => e.currentTarget.style.background='#f1f5f9'}
                >
                  <Eye size={18} /> View Profile
                </button>
                <button 
                  style={{ padding: '12px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background='#bbf7d0'} 
                  onMouseOut={e => e.currentTarget.style.background='#dcfce7'}
                >
                  <LogIn size={18} /> Gate In
                </button>
                <button 
                  style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background='#fecaca'} 
                  onMouseOut={e => e.currentTarget.style.background='#fee2e2'}
                >
                  <LogOut size={18} /> Gate Out
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BiometricIdentify;
