import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import GateLogs from './pages/GateLogs';
import LateWarnings from './pages/LateWarnings';
import Fees from './pages/Fees';
import Hostellers from './pages/Hostellers';
import Register from './pages/Register';
import Rooms from './pages/Rooms';
import RoomsDirectory from './pages/RoomsDirectory';
import RoomDetails from './pages/RoomDetails';
import EbBills from './pages/EbBills';
import Login from './pages/Login';
import Clearance from './pages/Clearance';
import StudentProfile from './pages/StudentProfile';
import NotFound from './pages/NotFound';
import Outpass from './pages/Outpass';
import CollegeMaster from './pages/CollegeMaster';
import MenuPermission from './pages/MenuPermission';
import UserManagement from './pages/UserManagement';
import StudentPortal from './pages/StudentPortal';
import DeveloperSettings from './pages/DeveloperSettings';
import StudentAdmissionForm from './pages/StudentAdmissionForm';

import BiometricDashboard from './pages/biometrics/BiometricDashboard';
import BiometricRegistration from './pages/biometrics/BiometricRegistration';
import BiometricIdentify from './pages/biometrics/BiometricIdentify';
import BiometricRecords from './pages/biometrics/BiometricRecords';
import PublicStudentId from './pages/PublicStudentId';

const ComingSoon = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center" style={{ height: '60vh', color: 'var(--text-muted)' }}>
    <h1 className="text-3xl font-bold mb-4">{title} Module</h1>
    <p>This module is scheduled for the next development phase.</p>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/student-portal" element={<StudentPortal />} />
        <Route path="/student-admission" element={<StudentAdmissionForm />} />
        <Route path="/id/:id" element={<PublicStudentId />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="hostellers">
            <Route index element={<Hostellers />} />
            <Route path="clearance/:id" element={<Clearance />} />
            <Route path="profile/:id" element={<StudentProfile />} />
          </Route>
          <Route path="gate-logs" element={<GateLogs />} />
          <Route path="late-warnings" element={<LateWarnings />} />
          <Route path="fees" element={<Fees />} />
          <Route path="outpass" element={<Outpass />} />
          <Route path="colleges" element={<CollegeMaster />} />
          <Route path="register" element={<Register />} />
          <Route path="rooms">
            <Route index element={<Rooms />} />
            <Route path="directory" element={<RoomsDirectory />} />
            <Route path="eb-bills" element={<EbBills />} />
            <Route path=":id" element={<RoomDetails />} />
          </Route>
          <Route path="biometrics">
            <Route index element={<BiometricDashboard />} />
            <Route path="register" element={<BiometricRegistration />} />
            <Route path="identify" element={<BiometricIdentify />} />
            <Route path="records" element={<BiometricRecords />} />
          </Route>
          <Route path="settings">
            <Route path="menu-permission" element={<MenuPermission />} />
            <Route path="user-management" element={<UserManagement />} />
          </Route>
          <Route path="developer">
            <Route path="settings" element={<DeveloperSettings />} />
          </Route>
          <Route path="canteen" element={<ComingSoon title="Canteen" />} />
          <Route path="staff" element={<ComingSoon title="Staff" />} />
          <Route path="admin" element={<ComingSoon title="Admin" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
