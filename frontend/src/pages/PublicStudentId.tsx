import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentAPI } from '../api/student.api';
import { StudentAcknowledgementCard } from '../components/StudentAcknowledgementCard';
import { AlertCircle } from 'lucide-react';

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
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>Loading Digital ID...</div>;
  }

  if (error || !student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', padding: '20px', textAlign: 'center' }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h2 style={{ color: '#0f172a', margin: '0 0 8px' }}>Verification Failed</h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>{error}</p>
        <button 
          onClick={() => navigate('/login')}
          style={{ background: '#0d6efd', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderTopLeftRadius: '24px', borderTopRightRadius: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 700 }}>Hostel Management System - Digital ID Verified</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✓ Valid Student</p>
        </div>
        <div style={{ padding: '10px' }}>
          <StudentAcknowledgementCard 
            student={student} 
            collegeName={student.college?.name || student.college}
            onBack={() => navigate('/login')}
            isViewOnly={true}
          />
        </div>
      </div>
    </div>
  );
}
