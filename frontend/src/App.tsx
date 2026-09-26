import { Routes, Route } from 'react-router-dom';
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

const ComingSoon = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center" style={{ height: '60vh', color: 'var(--text-muted)' }}>
    <h1 className="text-3xl font-bold mb-4">{title} Module</h1>
    <p>This module is scheduled for the next development phase.</p>
  </div>
);

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
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="hostellers">
          <Route index element={<Hostellers />} />
          <Route path="clearance/:id" element={<Clearance />} />
          <Route path="profile/:id" element={<StudentProfile />} />
        </Route>
        <Route path="gate-logs" element={<GateLogs />} />
        <Route path="late-warnings" element={<LateWarnings />} />
        <Route path="fees" element={<Fees />} />
        <Route path="register" element={<Register />} />
        <Route path="rooms">
          <Route index element={<Rooms />} />
          <Route path="directory" element={<RoomsDirectory />} />
          <Route path="eb-bills" element={<EbBills />} />
          <Route path=":id" element={<RoomDetails />} />
        </Route>
        <Route path="canteen" element={<ComingSoon title="Canteen" />} />
        <Route path="staff" element={<ComingSoon title="Staff" />} />
        <Route path="admin" element={<ComingSoon title="Admin" />} />
      </Route>
    </Routes>
    </>
  );
}

export default App;
