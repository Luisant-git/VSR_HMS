import { useState, useEffect, useRef } from 'react';
import { Search, User, CheckCircle2, ScanFace, Fingerprint, AlertCircle, RefreshCw, Camera, X, Smartphone } from 'lucide-react';
import { StudentAPI } from '../../api/student.api';

const BiometricRegistration = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  
  // Scanning states
  const [faceScanState, setFaceScanState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [fingerScanState, setFingerScanState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [faceScanState, mediaStream]);

  useEffect(() => {
    // Initial fetch to make searching instant (if desired, or just use real API search)
    StudentAPI.findAll().then(data => {
      setStudents(data.filter((s: any) => s.status !== 'Vacated'));
    }).catch(console.error);

    startCamera();
    return () => stopCamera();
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

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      const found = students.find(s => 
        s.regNo?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (found) {
        setSelectedStudent(found);
      } else {
        alert("Student not found");
      }
      setIsSearching(false);
    }, 500);
  };

  const simulateFaceScan = () => {
    setFaceScanState('scanning');
    setTimeout(() => {
      // 90% chance of success for simulation
      if (Math.random() > 0.1) setFaceScanState('success');
      else setFaceScanState('error');
    }, 2500);
  };

  const simulateFingerScan = () => {
    setFingerScanState('scanning');
    setTimeout(() => {
      if (Math.random() > 0.1) setFingerScanState('success');
      else setFingerScanState('error');
    }, 2500);
  };

  const saveRegistration = () => {
    if (faceScanState === 'success' || fingerScanState === 'success') {
      alert(`Biometric data successfully saved for ${selectedStudent.name}.`);
      setSelectedStudent(null);
      setSearchQuery('');
      setFaceScanState('idle');
      setFingerScanState('idle');
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '25px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)' }}>Register Biometric Data</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '5px' }}>
          Scan and register student fingerprints and facial recognition data.
        </p>
      </div>

      {!selectedStudent ? (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '30px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <div style={{ width: '60px', height: '60px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}>
              <Search size={28} color="#64748b" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Search Student</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginTop: '5px' }}>Enter Student ID, Registration Number, or Name</p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. HST-2026-001 or John Doe" 
              style={{ flex: 1, padding: '12px 15px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }}
            />
            <button 
              onClick={handleSearch}
              disabled={isSearching || !searchQuery}
              style={{ padding: '0 24px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: (isSearching || !searchQuery) ? 'not-allowed' : 'pointer', opacity: (isSearching || !searchQuery) ? 0.7 : 1 }}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '25px' }}>
          {/* Profile Sidebar */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '25px', height: 'fit-content' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              {selectedStudent.photoUrl ? (
                <img src={selectedStudent.photoUrl} alt="Student" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto', border: '3px solid #f1f5f9' }} />
              ) : (
                <div style={{ width: '100px', height: '100px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: '3px solid #e2e8f0' }}>
                  <User size={40} color="#94a3b8" />
                </div>
              )}
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginTop: '12px' }}>{selectedStudent.name}</h3>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{selectedStudent.regNo}</div>
              <span style={{ display: 'inline-block', padding: '4px 10px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
                {selectedStudent.status}
              </span>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Room & Bed</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>Room {selectedStudent.roomNo || 'N/A'} - {selectedStudent.bedNo || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Gender & Age</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{selectedStudent.gender || '-'}, {selectedStudent.age || '-'} Yrs</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>College / Course</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{selectedStudent.college || '-'}</div>
                <div style={{ fontSize: '13px', color: '#475569' }}>{selectedStudent.educationalQua || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Contact</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{selectedStudent.mobileNo || '-'}</div>
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedStudent(null)}
              style={{ width: '100%', padding: '10px', background: 'white', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginTop: '20px', cursor: 'pointer' }}
            >
              Select Another Student
            </button>
          </div>

          {/* Registration Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Face Registration */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ScanFace size={20} color="#0ea5e9" /> Face Registration
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Ask the student to stand in front of the external camera.</p>
                </div>
                {faceScanState === 'success' && (
                  <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Registered
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <div style={{ 
                  width: '200px', height: '200px', background: '#f8fafc', border: faceScanState === 'success' ? '2px solid #22c55e' : faceScanState === 'error' ? '2px solid #ef4444' : '2px dashed #cbd5e1', 
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
                }}>
                  {cameraActive && (faceScanState === 'idle' || faceScanState === 'scanning') ? (
                    <>
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                      />
                      {faceScanState === 'scanning' && (
                        <>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#3b82f6', boxShadow: '0 0 10px #3b82f6', animation: 'scan 1.5s infinite linear' }} />
                          <style>{`@keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }`}</style>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {faceScanState === 'idle' && <Camera size={60} color="#cbd5e1" />}
                      {faceScanState === 'scanning' && (
                        <>
                          <ScanFace size={60} color="#94a3b8" />
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#3b82f6', boxShadow: '0 0 10px #3b82f6', animation: 'scan 1.5s infinite linear' }} />
                          <style>{`@keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }`}</style>
                        </>
                      )}
                    </>
                  )}
                  {faceScanState === 'success' && <CheckCircle2 size={60} color="#22c55e" />}
                  {faceScanState === 'error' && <AlertCircle size={60} color="#ef4444" />}
                </div>

                <div style={{ flex: 1 }}>
                  {faceScanState === 'idle' && (
                    <>
                      <div style={{ fontSize: '14px', color: '#475569', marginBottom: '15px', lineHeight: '1.5' }}>
                        1. Ensure the student's face is clearly visible.<br/>
                        2. Ask them to look directly at the scanning device.<br/>
                        3. Avoid heavy backlighting.
                      </div>
                      
                      {cameraError && (
                        <div style={{ color: '#f87171', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '6px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <X size={14} /> {cameraError} (using fallback UI)
                        </div>
                      )}

                      <button onClick={simulateFaceScan} style={{ padding: '12px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Smartphone size={18} /> Start Face Scan on Device
                      </button>
                    </>
                  )}
                  {faceScanState === 'scanning' && (
                    <div style={{ fontSize: '15px', color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={18} className="animate-spin" /> Communicating with scanner...
                    </div>
                  )}
                  {faceScanState === 'success' && (
                    <div style={{ fontSize: '14px', color: '#166534', background: '#dcfce7', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <strong style={{ display: 'block', fontSize: '15px', marginBottom: '5px' }}>Scan Successful</strong>
                      Facial feature points have been securely captured and encoded.
                      <br/>
                      <button onClick={simulateFaceScan} style={{ padding: '6px 12px', background: 'white', color: '#166534', border: '1px solid #86efac', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginTop: '10px', fontSize: '12px' }}>Recapture Face</button>
                    </div>
                  )}
                  {faceScanState === 'error' && (
                    <div style={{ fontSize: '14px', color: '#991b1b', background: '#fef2f2', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                      <strong style={{ display: 'block', fontSize: '15px', marginBottom: '5px' }}>Scan Failed</strong>
                      Could not detect a clear face. Ensure good lighting and try again.
                      <br/>
                      <button onClick={simulateFaceScan} style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginTop: '10px', fontSize: '12px' }}>Retry Scan</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fingerprint Registration */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Fingerprint size={20} color="#8b5cf6" /> Fingerprint Registration
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Ask the student to place their thumb on the fingerprint scanner.</p>
                </div>
                {fingerScanState === 'success' && (
                  <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Registered
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <div style={{ 
                  width: '200px', height: '200px', background: '#f8fafc', border: fingerScanState === 'success' ? '2px solid #22c55e' : fingerScanState === 'error' ? '2px solid #ef4444' : '2px dashed #cbd5e1', 
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
                }}>
                  {fingerScanState === 'idle' && <Fingerprint size={60} color="#cbd5e1" />}
                  {fingerScanState === 'scanning' && (
                    <>
                      <Fingerprint size={60} color="#94a3b8" />
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#8b5cf6', boxShadow: '0 0 10px #8b5cf6', animation: 'scan 1s infinite linear' }} />
                    </>
                  )}
                  {fingerScanState === 'success' && <CheckCircle2 size={60} color="#22c55e" />}
                  {fingerScanState === 'error' && <AlertCircle size={60} color="#ef4444" />}
                </div>

                <div style={{ flex: 1 }}>
                  {fingerScanState === 'idle' && (
                    <>
                      <div style={{ fontSize: '14px', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
                        1. Clean the scanner surface if necessary.<br/>
                        2. Student places right thumb firmly on the sensor.<br/>
                        3. Ensure the finger covers the entire sensor area.
                      </div>
                      <button onClick={simulateFingerScan} style={{ padding: '12px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Smartphone size={18} /> Start Fingerprint Scan
                      </button>
                    </>
                  )}
                  {fingerScanState === 'scanning' && (
                    <div style={{ fontSize: '15px', color: '#8b5cf6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={18} className="animate-spin" /> Waiting for device input...
                    </div>
                  )}
                  {fingerScanState === 'success' && (
                    <div style={{ fontSize: '14px', color: '#166534', background: '#dcfce7', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <strong style={{ display: 'block', fontSize: '15px', marginBottom: '5px' }}>Scan Successful</strong>
                      Fingerprint template captured. Quality score: 94%
                      <br/>
                      <button onClick={simulateFingerScan} style={{ padding: '6px 12px', background: 'white', color: '#166534', border: '1px solid #86efac', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginTop: '10px', fontSize: '12px' }}>Recapture Print</button>
                    </div>
                  )}
                  {fingerScanState === 'error' && (
                    <div style={{ fontSize: '14px', color: '#991b1b', background: '#fef2f2', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                      <strong style={{ display: 'block', fontSize: '15px', marginBottom: '5px' }}>Scan Failed</strong>
                      Poor print quality detected. Ask the student to press firmly and try again.
                      <br/>
                      <button onClick={simulateFingerScan} style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginTop: '10px', fontSize: '12px' }}>Retry Scan</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                onClick={saveRegistration}
                disabled={faceScanState !== 'success' && fingerScanState !== 'success'}
                style={{ 
                  padding: '14px 30px', 
                  background: (faceScanState === 'success' || fingerScanState === 'success') ? '#0d6efd' : '#94a3b8', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontSize: '15px', 
                  fontWeight: 600, 
                  cursor: (faceScanState === 'success' || fingerScanState === 'success') ? 'pointer' : 'not-allowed' 
                }}
              >
                Save Biometric Registration
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default BiometricRegistration;
