import React, { useState } from 'react';
import { Bed, Users, Search, Filter, Home, CheckCircle, XCircle, Plus, Zap, User, ArrowLeft, LayoutGrid, List, Wind } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

const RoomsDirectory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filterStatus, setFilterStatus] = useState('All');

  React.useEffect(() => {
    const handleSwitch = () => setViewMode('table');
    window.addEventListener('switch-to-table', handleSwitch);
  
  const filteredGridData = roomsData.filter(room => {
    if (filterStatus === 'Available') return room.filled < room.total;
    if (filterStatus === 'Fully Vacant') return room.filled === 0;
    if (filterStatus === 'Full') return room.filled === room.total;
    return true;
  });

  const filteredTableData = tableData.filter(row => {
    const matchesSearch = row.room.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'Available') return row.vac > 0;
    if (filterStatus === 'Fully Vacant') return row.occ === 0;
    if (filterStatus === 'Full') return row.vac === 0;
    return true;
  });

  return () => window.removeEventListener('switch-to-table', handleSwitch);
  }, []);

  const metrics = [
    { label: 'Total Hostel Rooms', value: '57 Rooms', color: '#3b82f6', icon: <Home size={20} /> },
    { label: 'Total Bed Capacity', value: '320 Beds', color: '#8b5cf6', icon: <Bed size={20} /> },
    { label: 'Occupied Beds', value: '150 Beds', color: '#10b981', icon: <Users size={20} /> },
    { label: 'Vacant Beds', value: '170 Available', color: '#f59e0b', icon: <CheckCircle size={20} /> }
  ];

  const roomsData = [
    { id: 'A1', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A2', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A3', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A4', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A5', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A6', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A7', block: 'Block A | 5 Sharing', status: 'Full', price: '₹6,500.00/mo', type: '5 sharing', amenities: ['AC', 'Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A8', block: 'Block A | 5 Sharing', status: 'Full', price: '₹6,500.00/mo', type: '5 sharing', amenities: ['AC', 'Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A9', block: 'Block A | 5 Sharing', status: 'Full', price: '₹6,500.00/mo', type: '5 sharing', amenities: ['AC', 'Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A10', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A11', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'A12', block: 'Block A | 5 Sharing', status: 'Full', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 5, total: 5, occupants: 'HST-001, HST-002, HST-003, HST-004, HST-005' },
    { id: 'B1', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B2', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B3', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B4', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B5', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B6', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B7', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B8', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B9', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B10', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B11', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'B12', block: 'Block B | 6 Sharing', status: 'Fully Vacant', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 0, total: 6, occupants: 'Ready for allocation' },
    { id: 'C1', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C2', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C3', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C4', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C5', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C6', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C7', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹6,500.00/mo', type: '5 sharing', amenities: ['AC', 'Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C8', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹6,500.00/mo', type: '5 sharing', amenities: ['AC', 'Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C9', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹6,500.00/mo', type: '5 sharing', amenities: ['AC', 'Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C10', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C11', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'C12', block: 'Block C | 5 Sharing', status: 'Partially Filled', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 2, total: 5, occupants: 'HST-050, HST-051' },
    { id: 'D1', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D2', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D3', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D4', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D5', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D6', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D7', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D8', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D9', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D10', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D11', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'D12', block: 'Block D | 6 Sharing', status: 'Full', price: '₹4,000.00/mo', type: '6 sharing', amenities: ['Bath'], filled: 6, total: 6, occupants: '6 Students' },
    { id: 'E1', block: 'Block E | Warden', status: 'Full', price: 'N/A', type: 'single', amenities: ['AC', 'Bath'], filled: 1, total: 1, occupants: 'Warden' },
    { id: 'E2', block: 'Block E | 5 Sharing', status: 'Fully Vacant', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 0, total: 5, occupants: 'Ready for allocation' },
    { id: 'E3', block: 'Block E | 5 Sharing', status: 'Fully Vacant', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 0, total: 5, occupants: 'Ready for allocation' },
    { id: 'E4', block: 'Block E | 5 Sharing', status: 'Fully Vacant', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 0, total: 5, occupants: 'Ready for allocation' },
    { id: 'E5', block: 'Block E | 5 Sharing', status: 'Fully Vacant', price: '₹4,500.00/mo', type: '5 sharing', amenities: ['Bath'], filled: 0, total: 5, occupants: 'Ready for allocation' },
    { id: 'W1', block: 'Single Room', status: 'Full', price: '₹8,500.00/mo', type: 'single', amenities: ['AC', 'Bath'], filled: 1, total: 1, occupants: '1 Student' },
    { id: 'W2', block: 'Single Room', status: 'Full', price: '₹8,500.00/mo', type: 'single', amenities: ['AC', 'Bath'], filled: 1, total: 1, occupants: '1 Student' },
    { id: 'W3', block: 'Single Room', status: 'Full', price: '₹8,500.00/mo', type: 'single', amenities: ['AC', 'Bath'], filled: 1, total: 1, occupants: '1 Student' },
    { id: 'Dorm', block: 'Dormitory', status: 'Partially Filled', price: '₹3,000.00/mo', type: 'dormitory', amenities: [], filled: 10, total: 28, occupants: '10 Students currently allocated' }
  ];

  const tableData = [
    { room: 'Room A1', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room A2', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room A3', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room A4', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room A5', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room A6', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room A7', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '5 Students' },
    { room: 'Room A8', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '5 Students' },
    { room: 'Room A9', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '5 Students' },
    { room: 'Room A10', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room A11', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room A12', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
    { room: 'Room B1', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B2', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B3', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B4', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B5', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B6', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B7', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B8', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B9', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B10', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B11', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room B12', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room C1', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room C2', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room C3', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room C4', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room C5', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room C6', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room C7', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '2 Students' },
    { room: 'Room C8', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '2 Students' },
    { room: 'Room C9', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '2 Students' },
    { room: 'Room C10', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room C11', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room C12', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
    { room: 'Room D1', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D2', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D3', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D4', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D5', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D6', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D7', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D8', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D9', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D10', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D11', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room D12', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
    { room: 'Room E1', loc: 'Block E', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 0, mess: 0, tot: 0, amen: 'AC Attached Bath', live: 'Warden' },
    { room: 'Room E2', loc: 'Block E', type: '5 sharing', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room E3', loc: 'Block E', type: '5 sharing', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room E4', loc: 'Block E', type: '5 sharing', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room E5', loc: 'Block E', type: '5 sharing', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
    { room: 'Room W1', loc: 'Single Rooms', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 8500, mess: 3500, tot: 12000, amen: 'AC Attached Bath', live: '1 Student' },
    { room: 'Room W2', loc: 'Single Rooms', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 8500, mess: 3500, tot: 12000, amen: 'AC Attached Bath', live: '1 Student' },
    { room: 'Room W3', loc: 'Single Rooms', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 8500, mess: 3500, tot: 12000, amen: 'AC Attached Bath', live: '1 Student' },
    { room: 'Dorm', loc: 'Dormitory', type: 'dormitory', cap: '28 Beds', occ: 10, vac: 18, rent: 3000, mess: 3500, tot: 6500, amen: 'None', live: '10 Students' }
  ];


  const filteredGridData = roomsData.filter(room => {
    if (filterStatus === 'Available') return room.filled < room.total;
    if (filterStatus === 'Fully Vacant') return room.filled === 0;
    if (filterStatus === 'Full') return room.filled === room.total;
    return true;
  });

  const filteredTableData = tableData.filter(row => {
    const matchesSearch = row.room.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'Available') return row.vac > 0;
    if (filterStatus === 'Fully Vacant') return row.occ === 0;
    if (filterStatus === 'Full') return row.vac === 0;
    return true;
  });

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader
        title="Rooms & Live Occupancy Grid"
        subtitle="Dynamic room bed status strictly reflecting active resident hostellers"
        rightContent={
          <>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginRight: '10px' }}>
              <button onClick={() => setViewMode('grid')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, background: viewMode === 'grid' ? 'white' : 'transparent', color: viewMode === 'grid' ? '#0f172a' : '#64748b', boxShadow: viewMode === 'grid' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}><LayoutGrid size={16} /> Grid</button>
              <button onClick={() => setViewMode('table')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, background: viewMode === 'table' ? 'white' : 'transparent', color: viewMode === 'table' ? '#0f172a' : '#64748b', boxShadow: viewMode === 'table' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}><List size={16} /> Table</button>
            </div>
            <button onClick={() => navigate('/rooms/eb-bills')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#eab308', color: '#1e293b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(234, 179, 8, 0.3)' }}>
              <Zap size={16} color="#1e293b" /> Room EB Bills
            </button>
            <button onClick={() => setIsModalOpen(true)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>
              <Plus size={16} /> Add New Room
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${m.color}15`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.icon}
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '10px 15px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', width: 'fit-content' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: '#64748b' }}>
          <Filter size={16} style={{ marginRight: '6px' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>Filter:</span>
        </div>
        {['All', 'Available', 'Fully Vacant', 'Full'].map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: filterStatus === f ? 'var(--sidebar-active)' : 'transparent',
              color: filterStatus === f ? 'white' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            {f}
          </button>
        ))}
      </div>


      {viewMode === 'grid' && (
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '15px' }}>Live Room Layout Visualizer</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {filteredGridData.map((r, i) => (

            <div key={i} className="content-card" style={{ marginTop: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {r.amenities.includes('AC') ? (
                <span className="status-pill status-paid" style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <Wind size={14} /> AC
                </span>
              ) : (
                <span className="status-pill" style={{ position: 'absolute', top: '16px', right: '16px', border: '1px solid var(--text-muted)', color: 'var(--text-muted)' }}>
                  Non-AC
                </span>
              )}
              
              <h3 className="card-title" style={{ marginBottom: '8px' }}>Room {r.id}</h3>
              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>{r.block} &bull; {r.price}</div>
              
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-muted">
                  <Users size={16} />
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>Occupied</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  background: '#f8f9fa', 
                  padding: '4px 10px', 
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: r.filled === r.total ? '#dc3545' : 'var(--sidebar-active)' }}>
                    {r.filled}
                  </span>
                  <span className="text-muted" style={{ fontSize: '13px', fontWeight: 600 }}>/ {r.total}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {Array.from({ length: r.total }).map((_, idx) => {
                  const isOccupied = idx < r.filled;
                  const isFull = r.filled === r.total;
                
  const filteredGridData = roomsData.filter(room => {
    if (filterStatus === 'Available') return room.filled < room.total;
    if (filterStatus === 'Fully Vacant') return room.filled === 0;
    if (filterStatus === 'Full') return room.filled === room.total;
    return true;
  });

  const filteredTableData = tableData.filter(row => {
    const matchesSearch = row.room.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'Available') return row.vac > 0;
    if (filterStatus === 'Fully Vacant') return row.occ === 0;
    if (filterStatus === 'Full') return row.vac === 0;
    return true;
  });

  return (
                    <div key={idx} style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '38px', height: '38px', borderRadius: '10px',
                      backgroundColor: isOccupied ? (isFull ? 'rgba(220, 53, 69, 0.1)' : 'rgba(74, 114, 250, 0.1)') : '#f4f6f8',
                      color: isOccupied ? (isFull ? '#dc3545' : 'var(--sidebar-active)') : '#adb5bd',
                      border: '1px solid',
                      borderColor: isOccupied ? (isFull ? 'rgba(220, 53, 69, 0.2)' : 'rgba(74, 114, 250, 0.2)') : '#e9ecef'
                    }}>
                      <Bed size={20} strokeWidth={isOccupied ? 2.5 : 2} />
                    </div>
                  );
                })}
              </div>
              
              <div style={{ marginTop: 'auto' }}>
                {r.filled > 0 && (
                  <div style={{ fontSize: '12px', color: '#64748b', background: '#f8f9fa', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>CURRENT OCCUPANTS:</div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.occupants}</div>
                  </div>
                )}
                
                <button 
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '10px', borderRadius: '8px', background: r.filled === r.total ? '#f8f9fa' : 'var(--sidebar-active)', color: r.filled === r.total ? '#64748b' : 'white', border: r.filled === r.total ? '1px solid #cbd5e1' : 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => navigate('/hostellers', { state: { filterRoom: `Room ${r.id}` } })}
                >
                  {r.filled === r.total ? 'View Students' : 'Assign Student'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {viewMode === 'table' && (
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>Rooms Master Directory</h3>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="Filter rooms..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '200px' }} />
          </div>
        </div>
        
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ textTransform: 'uppercase', fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 20px' }}>Room #</th>
                <th style={{ padding: '16px 20px' }}>Location</th>
                <th style={{ padding: '16px 20px' }}>Type</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>Capacity</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>Occupied</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>Vacant</th>
                <th style={{ padding: '16px 20px' }}>Monthly Fee Rates</th>
                <th style={{ padding: '16px 20px' }}>Amenities</th>
                <th style={{ padding: '16px 20px' }}>Live Occupants</th>
              </tr>
            </thead>
            <tbody>
              {filteredTableData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1e293b' }}>{row.room}</td>
                  <td style={{ padding: '16px 20px', color: '#475569' }}>{row.loc}</td>
                  <td style={{ padding: '16px 20px' }}><span style={{ border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: '#475569', fontWeight: 600 }}>{row.type}</span></td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{row.cap}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: row.occ > 0 ? '#0f172a' : '#94a3b8' }}>{row.occ}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: row.vac > 0 ? '#22c55e' : '#ef4444' }}>{row.vac}</td>
                  <td style={{ padding: '16px 20px', color: '#475569', fontSize: '12px' }}>
                    <div>Rent: ₹{row.rent.toFixed(2)}</div>
                    <div>Mess: ₹{row.mess.toFixed(2)}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>Total: ₹{row.tot.toFixed(2)}/mo</div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#475569' }}>{row.amen}</td>
                  <td style={{ padding: '16px 20px', color: row.occ > 0 ? '#334155' : '#94a3b8' }}>{row.live}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
      {/* Add Room Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)' }}>Add New Room</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <XCircle size={24} />
              </button>
            </div>
            
            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Room Number</label>
                  <input type="text" placeholder="e.g. 101" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Block & Floor</label>
                  <input type="text" placeholder="e.g. Block A | Floor 1" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Room Type</label>
                  <select style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: 'white' }}>
                    <option>Single</option>
                    <option>Double</option>
                    <option>Triple</option>
                    <option>Four Sharing</option>
                    <option>Dormitory</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Total Beds</label>
                  <input type="number" placeholder="2" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Monthly Rent (₹)</label>
                <input type="number" placeholder="5000" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Amenities</label>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" /> AC
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" /> Attached Bath
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'var(--sidebar-active)', border: 'none', color: 'white', cursor: 'pointer', boxShadow: '0 4px 10px rgba(74, 114, 250, 0.3)' }}>Save Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default RoomsDirectory;
