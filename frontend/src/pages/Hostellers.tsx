import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Phone, Mail, MapPin, Wallet, Eye, FileText, LogOut, Upload, FileSpreadsheet, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate, useLocation } from 'react-router-dom';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { LoadingRow } from '../components/LoadingSpinner';
import StudentImport from './StudentImport';
import { StudentAPI } from '../api/student.api';
import { FeesAPI } from '../api/fees.api';
import { RoomAPI } from '../api/room.api';
import { CollegeAPI } from '../api/college.api';
import { toast } from 'react-toastify';
const Hostellers = () => {
  const navigate = useNavigate();
  const [hostellers, setHostellers] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const location = useLocation();
  const [selectedHosteller, setSelectedHosteller] = useState<any>(null);
  const [roomFilter, setRoomFilter] = useState(location.state?.filterRoom || '-- All Rooms --');
  const [collegeFilter, setCollegeFilter] = useState('-- All Colleges --');
  const [feeStatusFilter, setFeeStatusFilter] = useState('-- All Fee Status --');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortFilter, setSortFilter] = useState('latest');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploadingImport, setIsUploadingImport] = useState(false);

  const [allRooms, setAllRooms] = useState<string[]>([]);
  const [allColleges, setAllColleges] = useState<string[]>([]);

  useEffect(() => {
    RoomAPI.findAll().then(res => {
      const data = Array.isArray(res) ? res : (res.data || []);
      setAllRooms(data.map((r: any) => `Room ${r.id}`));
    }).catch(console.error);
    CollegeAPI.findAll({ limit: 1000 }).then(res => {
      const data = Array.isArray(res) ? res : (res.data || []);
      setAllColleges(data.map((c: any) => c.name));
    }).catch(console.error);
  }, []);

  const fetchHostellers = () => {
    setError(null);
    StudentAPI.findAll({
      page,
      limit,
      search: searchQuery,
      roomFilter: roomFilter !== '-- All Rooms --' ? roomFilter : undefined,
      collegeFilter: collegeFilter !== '-- All Colleges --' ? collegeFilter : undefined,
      sortFilter: sortFilter !== 'latest' ? sortFilter : undefined,
      feeFilter: feeStatusFilter !== '-- All Fee Status --' ? feeStatusFilter : undefined
    }).then(res => {
      const data = res.data || [];
      const mapped = data.map((h: any) => {
        const pendingFeesAmount = h.transactions?.filter((f: any) => f.status === 'PENDING').reduce((sum: number, f: any) => sum + f.amount, 0) || 0;
        const hasPending = h.transactions?.some((f: any) => f.status === 'PENDING');
        const hasCompleted = h.transactions?.some((f: any) => f.status === 'COMPLETED');

        let currentFeeStatus = 'No Dues';
        if (hasPending) currentFeeStatus = 'Un-Paid';
        else if (hasCompleted) currentFeeStatus = 'Paid';

        return {
          id: h.manualRegsiName || h.regNo,
          name: h.name,
          contact: h.mobileNo || 'N/A',
          room: h.roomNo || 'N/A',
          bed: h.bedNo || 'N/A',
          college: h.college?.name ? h.college.name.trim() : typeof h.college === 'string' ? h.college.trim() : 'N/A',
          dept: h.educationalQua ? h.educationalQua.trim() : 'N/A',
          advance: `₹${h.advance || 0}`,
          pending: `₹${pendingFeesAmount}`,
          feeStatus: currentFeeStatus,
          date: new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          updatedDate: new Date(h.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          avatar: h.name.substring(0, 2).toUpperCase(),
          raw: h
        };
      });
      setHostellers(mapped);
      setTotalPages(res.totalPages || 1);
      setTotalRecords(res.total || 0);
    }).catch(err => {
      console.error(err);
      setError('Failed to load hostellers');
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHostellers();
  }, [page, limit, searchQuery, roomFilter, collegeFilter, sortFilter, feeStatusFilter]);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeStudent] = useState<any>(null);
  const [newFee, setNewFee] = useState({ transactionType: 'RENT', amount: 0, description: '', status: 'COMPLETED', paymentMode: 'UPI', referenceNumber: '' });
  const [isSubmittingFee, setIsSubmittingFee] = useState(false);

  const handleAddFee = async () => {
    if (!feeStudent || newFee.amount <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    setIsSubmittingFee(true);
    try {
      const uuid = feeStudent.raw.id;
      const finalDescription = `${newFee.description} | Ref: ${newFee.referenceNumber || '-'}`.trim();
      await FeesAPI.create({ ...newFee, studentId: uuid, amount: Number(newFee.amount), description: finalDescription });
      toast.success('Fee recorded successfully!');
      setShowFeeModal(false);
    } catch (e: any) {
      toast.error('Failed to add fee: ' + e.message);
    }
    setIsSubmittingFee(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const rooms = useMemo(() => {
    const uniqueRooms = new Set<string>(allRooms);
    hostellers.forEach(h => {
      if (h.room && h.room !== 'N/A') uniqueRooms.add(`Room ${h.room}`);
    });
    return ['-- All Rooms --', ...Array.from(uniqueRooms).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [hostellers, allRooms]);
  const roomOptions = rooms.map(r => ({ value: r, label: r }));

  const colleges = useMemo(() => {
    const uniqueColleges = new Set<string>(allColleges);
    hostellers.forEach(h => {
      if (h.college && h.college !== 'N/A') uniqueColleges.add(h.college);
    });
    return ['-- All Colleges --', ...Array.from(uniqueColleges).sort()];
  }, [hostellers, allColleges]);
  const collegeOptions = colleges.map(c => ({ value: c, label: c }));

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      padding: '2px',
      borderRadius: '8px',
      borderColor: state.isFocused ? 'var(--sidebar-active)' : 'var(--border-color)',
      boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
      '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1' },
      fontSize: '13px',
      cursor: 'pointer',
      width: '200px',
      background: 'white'
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
      color: state.isSelected ? 'white' : '#334155',
      cursor: 'pointer'
    })
  };

  const filteredHostellers = hostellers; // Filtering is now server-side

  const handleExportExcel = () => {
    const data = filteredHostellers.map(h => {
      const raw = h.raw || {};
      return {
        'REGIS NO': raw.regNo || '',
        'NAME': raw.name || '',
        'GENDER': raw.gender || '',
        'MOBILE NO': raw.mobileNo || '',
        'DOB': raw.dob ? new Date(raw.dob).toLocaleDateString('en-GB') : '',
        'COLLEGE': typeof raw.college === 'string' ? raw.college : (raw.college?.name || ''),
        'COURSE': raw.educationalQua || '',
        'COURSE DURATION': raw.courseDuration || '',
        'EMAIL ID': raw.emailId || '',
        'AADHAR NUMBER': raw.aadharNo || '',
        'BLOOD GROUP': raw.bloodGroup || '',
        'FATHER NAME': raw.fatherName || '',
        'FATHER MOBILE': raw.fatherMobileNo || '',
        'MOTHER NAME': raw.motherName || '',
        'MOTHER MOBILE': raw.motherMobileNo || '',
        'GUARDIAN NAME': raw.guardianName || '',
        'GUARDIAN MOBILE': raw.guardianMobileNo || '',
        'MARITAL STATUS': raw.maritalStatus || '',
        'ROOM NO': raw.roomNo || raw.room || '',
        'RENT': raw.rent || 0,
        'ADVANCE': raw.advance || 0,
        'CATEGORY': raw.category || '',
        'FOOD TYPE': raw.foodType || '',
        'VSR LEDGER-1': raw.vsrLedger1 || '',
        'DATE OF JOINING': raw.dateOfJoining ? new Date(raw.dateOfJoining).toLocaleDateString('en-GB') : '',
        'PURSUING YEAR': raw.pursuingYear || raw.passingYear || '',
        'STATUS': raw.status || 'In'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hostellers");
    XLSX.writeFile(workbook, "Hostellers_Export.xlsx");
  };

  return (
    <div>
      <div>
        <PageHeader
          title="Active Hostellers Master"
          subtitle="Filter by room to view enrolled students"
          icon={<Users size={24} color="#fff" />} iconBg="linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)"
          rightContent={
            <>
              <button
                onClick={handleExportExcel}
                className="ui-btn ui-btn-success">
                <FileSpreadsheet size={18} />
                Export Excel
              </button>
              <label
                className={`ui-btn ui-btn-secondary${isUploadingImport ? ' is-disabled' : ''}`}>
                {isUploadingImport ? (
                  <>
                    <span className="ui-spinner" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    <span>Bulk Import</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  disabled={isUploadingImport}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setIsUploadingImport(true);
                      setImportFile(e.target.files[0]);
                      setShowImportModal(true);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                onClick={() => navigate('/register')}
                className="ui-btn ui-btn-primary">
                + Register New Student
              </button>
            </>
          }
        />

        <div className="ui-toolbar">
          <div className="ui-toolbar-group">
            <span className="ui-toolbar-label">Show</span>
            <select
              className="ui-select hostellers-limit"
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={99999}>All</option>
            </select>
            <span className="ui-toolbar-label">entries</span>
          </div>
          <div className="hostellers-toolbar-divider"></div>

          <div className="ui-input-icon hostellers-search">
            <Search size={16} />
            <input
              type="text"
              className="ui-input"
              placeholder="Search by name, ID, Manual Reg Name, mobile..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            options={roomOptions}
            value={roomOptions.find(o => o.value === roomFilter)}
            onChange={(opt) => {
              setRoomFilter(opt?.value || '-- All Rooms --');
              setPage(1);
            }}
            styles={selectStyles}
            placeholder="Search room..."
            isSearchable={true}
          />

          <Select
            options={collegeOptions}
            value={collegeOptions.find(o => o.value === collegeFilter)}
            onChange={(opt) => {
              setCollegeFilter(opt?.value || '-- All Colleges --');
              setPage(1);
            }}
            styles={selectStyles}
            placeholder="Search college..."
            isSearchable={true}
          />

          <Select
            options={[
              { value: '-- All Fee Status --', label: '-- All Fee Status --' },
              { value: 'Un-Paid', label: 'Un-Paid' },
              { value: 'Paid', label: 'Paid' },
              { value: 'No Dues', label: 'No Dues' }
            ]}
            value={{ value: feeStatusFilter, label: feeStatusFilter }}
            onChange={(opt) => { setFeeStatusFilter(opt?.value || '-- All Fee Status --'); setPage(1); }}
            styles={selectStyles}
            isSearchable={false}
          />

          <Select
            options={[
              { value: 'latest', label: 'All Students' },
              { value: 'updated', label: 'Updated Profiles Only' }
            ]}
            value={{ value: sortFilter, label: sortFilter === 'updated' ? 'Updated Profiles Only' : 'All Students' }}
            onChange={(opt) => {
              setSortFilter(opt?.value || 'latest');
              setPage(1);
            }}
            styles={selectStyles}
            placeholder="View..."
            isSearchable={false}
          />

          {(searchQuery !== '' || roomFilter !== '-- All Rooms --' || collegeFilter !== '-- All Colleges --' || feeStatusFilter !== '-- All Fee Status --') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setRoomFilter('-- All Rooms --');
                setCollegeFilter('-- All Colleges --');
                setFeeStatusFilter('-- All Fee Status --');
                setSortFilter('latest');
                setPage(1);
              }}
              title="Clear all filters"
              className="ui-btn ui-btn-soft ui-btn-sm"
            >
              <X size={14} strokeWidth={3} /> Clear All
            </button>
          )}
          <div className="ui-spacer"></div>

          <button onClick={() => navigate('/gate-logs')} className="ui-btn ui-btn-dark">
            Gate Logs
          </button>
        </div>

        <div className="ui-table-wrap">
          <div className="ui-table-scroll">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Full Name & Contact</th>
                  <th>Room</th>
                  <th>College / Dept</th>
                  <th>Advance Held</th>
                  <th>Fee Status</th>
                  <th>Pending Fees</th>
                  <th>Joining Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRow colSpan={9} />
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="ui-empty ui-empty-danger">
                      {error}
                    </td>
                  </tr>
                ) : filteredHostellers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="ui-empty">
                      No enrolled students found.
                    </td>
                  </tr>
                ) : (
                  filteredHostellers.map((h, i) => (
                    <tr key={i}>
                      <td>
                        <a href="#" className="hostellers-link" onClick={(e) => { e.preventDefault(); setSelectedHosteller(h); }}>{h.id}</a>
                      </td>
                      <td>
                        <div className="hostellers-person">
                          <div className="ui-avatar">
                            {h.raw.photoUrl ? (
                              <img src={h.raw.photoUrl} alt="Avatar" />
                            ) : (
                              h.avatar
                            )}
                          </div>
                          <div>
                            <div className="hostellers-person-name">{h.name}</div>
                            <div className="hostellers-person-meta">
                              <Phone size={12} /> {h.contact}
                            </div>
                            {h.raw.profileUpdatedAt && (
                              <span className="ui-badge ui-badge-green hostellers-updated">
                                Updated: {new Date(h.raw.profileUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="ui-badge ui-badge-blue">Room {h.room}</span>
                      </td>
                      <td>
                        <div className="hostellers-college-name">{h.college?.name || h.college || '-'}</div>
                        <div className="hostellers-college-dept">{h.dept}</div>
                      </td>
                      <td className="hostellers-advance">
                        {h.advance}
                      </td>
                      <td>
                        <span className={
                          h.feeStatus === 'Paid' ? 'ui-badge ui-badge-green'
                            : h.feeStatus === 'Un-Paid' ? 'ui-badge ui-badge-red'
                              : 'ui-badge ui-badge-amber'
                        }>
                          {h.feeStatus}
                        </span>
                      </td>
                      <td>
                        <span className="ui-badge ui-badge-red">
                          {h.pending}
                        </span>
                      </td>
                      <td>{h.date}</td>
                      <td className="hostellers-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(activeDropdown === h.id ? null : h.id);
                          }}
                          className="ui-btn ui-btn-secondary ui-btn-sm"
                        >
                          Manage <span className="hostellers-caret">▼</span>
                        </button>

                        {activeDropdown === h.id && (
                          <div
                            ref={dropdownRef}
                            className="ui-menu"
                          >
                            <button
                              onClick={() => navigate(`/hostellers/profile/${h.id}`)}
                              className="ui-menu-item"
                            >
                              <Eye size={16} color="#0d6efd" /> View 360 Profile
                            </button>
                            <button
                              onClick={() => {
                                navigate(`/fees?student=${h.id}`);
                                setActiveDropdown(null);
                              }}
                              className="ui-menu-item"
                            >
                              <Wallet size={16} color="#198754" /> Collect Fees
                            </button>
                            <button
                              onClick={() => navigate('/outpass')}
                              className="ui-menu-item"
                            >
                              <FileText size={16} color="#ffc107" /> Issue Outpass
                            </button>
                            <div className="ui-menu-sep"></div>
                            <button
                              onClick={() => navigate(`/hostellers/clearance/${h.id}`)}
                              className="ui-menu-item danger"
                            >
                              <LogOut size={16} color="#dc3545" /> Checkout / Exit (Free Bed)
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 0 && (
            <div className="ui-pagination">
              <div className="ui-pagination-info">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} entries
              </div>
              <div className="ui-pagination-pages">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="ui-page-btn">
                  Previous
                </button>
                <button className="ui-page-btn active">
                  {page}
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="ui-page-btn">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Overlay */}
      {selectedHosteller && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal-lg">
            {/* Modal Header */}
            <div className="ui-modal-head hostellers-modal-head">
              <div className="hostellers-modal-who">
                <div className="hostellers-modal-avatar">
                  {selectedHosteller.raw.photoUrl ? (
                    <img src={selectedHosteller.raw.photoUrl} alt="Avatar" />
                  ) : (
                    selectedHosteller.name.charAt(0)
                  )}
                </div>
                <div>
                  <div className="ui-modal-title hostellers-modal-name">{selectedHosteller.name}</div>
                  <p className="hostellers-modal-sub">{selectedHosteller.id} • {selectedHosteller.dept}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHosteller(null)}
                className="ui-modal-close hostellers-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="ui-modal-body">
              <div className="hostellers-tiles">
                <div className="hostellers-tile">
                  <div className="hostellers-tile-label">Room Number</div>
                  <div className="hostellers-tile-value">Room {selectedHosteller.room}</div>
                </div>
                <div className="hostellers-tile">
                  <div className="hostellers-tile-label">Current Status</div>
                  <div className={`hostellers-tile-value ${selectedHosteller.raw?.status === 'In' ? 'hostellers-status-in' : 'hostellers-status-out'}`}>
                    {selectedHosteller.raw?.status || 'In'} Campus
                  </div>
                </div>
              </div>

              <div className="hostellers-subhead">Contact Information</div>
              <div className="hostellers-contact">
                <div className="hostellers-contact-row">
                  <div className="hostellers-contact-icon"><Phone size={16} /></div>
                  <div>
                    <div className="hostellers-contact-label">Phone Number</div>
                    <div className="hostellers-contact-value">{selectedHosteller.contact}</div>
                  </div>
                </div>
                <div className="hostellers-contact-row">
                  <div className="hostellers-contact-icon"><Mail size={16} /></div>
                  <div>
                    <div className="hostellers-contact-label">Email Address</div>
                    <div className="hostellers-contact-value">{selectedHosteller.raw?.emailId || 'N/A'}</div>
                  </div>
                </div>
                <div className="hostellers-contact-row">
                  <div className="hostellers-contact-icon"><MapPin size={16} /></div>
                  <div>
                    <div className="hostellers-contact-label">Home Address</div>
                    <div className="hostellers-contact-value">{selectedHosteller.raw?.address || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="hostellers-subhead hostellers-subhead-spaced">Personal Details</div>
              <div className="ui-kv-grid">
                <div className="ui-kv">
                  <div className="ui-kv-label">Biometric ID</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.biometricId || 'N/A'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">{selectedHosteller.raw?.doc1Type || 'Primary ID'}</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.doc1Number || 'N/A'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">{selectedHosteller.raw?.doc2Type || 'Secondary ID'}</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.doc2Number || 'N/A'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Aadhar Number</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.aadharNo || 'N/A'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Blood Group</div>
                  <div className="ui-kv-value hostellers-danger">{selectedHosteller.raw?.bloodGroup || 'N/A'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">DOB</div>
                  <div className="ui-kv-value">
                    {selectedHosteller.raw?.dob ? new Date(selectedHosteller.raw.dob).toLocaleDateString('en-GB') : 'N/A'}
                  </div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Marital Status</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.maritalStatus || 'N/A'}</div>
                </div>
              </div>

              <div className="hostellers-subhead hostellers-subhead-spaced">Family & Guardian</div>
              <div className="ui-kv-grid">
                <div className="ui-kv">
                  <div className="ui-kv-label">Father's Name</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.fatherName || 'N/A'}</div>
                  <div className="hostellers-guardian-mobile">{selectedHosteller.raw?.fatherMobileNo || 'No Mobile'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Mother's Name</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.motherName || 'N/A'}</div>
                  <div className="hostellers-guardian-mobile">{selectedHosteller.raw?.motherMobileNo || 'No Mobile'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Guardian Name</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.guardianName || 'N/A'}</div>
                  <div className="hostellers-guardian-mobile">{selectedHosteller.raw?.guardianMobileNo || 'No Mobile'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Emergency Contact</div>
                  <div className="ui-kv-value hostellers-danger">{selectedHosteller.raw?.emergencyContact || 'N/A'}</div>
                </div>
              </div>

              <div className="hostellers-subhead hostellers-subhead-spaced">Academic & Additional Info</div>
              <div className="ui-kv-grid">
                <div className="ui-kv">
                  <div className="ui-kv-label">VSR Ledger-1</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.vsrLedger1 || 'N/A'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Date of Joining</div>
                  <div className="ui-kv-value">
                    {selectedHosteller.raw?.dateOfJoining ? new Date(selectedHosteller.raw.dateOfJoining).toLocaleDateString('en-GB') : 'N/A'}
                  </div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">Pursuing Year</div>
                  <div className="ui-kv-value">{selectedHosteller.raw?.pursuingYear || 'N/A'}</div>
                </div>
                <div className="ui-kv">
                  <div className="ui-kv-label">College/Institute</div>
                  <div className="ui-kv-value">{selectedHosteller.dept || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="ui-modal-foot">
              <button
                onClick={() => setSelectedHosteller(null)}
                className="ui-btn ui-btn-secondary"
              >
                Close
              </button>
              <button
                onClick={() => navigate(`/register?edit=${selectedHosteller.id}`)}
                className="ui-btn ui-btn-primary"
              >
                Edit Student
              </button>
            </div>
          </div>
        </div>
      )}
      {showFeeModal && feeStudent && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal-sm">
            <div className="ui-modal-head hostellers-fee-head">
              <div className="ui-modal-title">Record Fee Payment</div>
              <button onClick={() => setShowFeeModal(false)} className="ui-modal-close hostellers-modal-close"><X size={20} /></button>
            </div>

            <div className="ui-modal-body">
              <div className="hostellers-fee-summary">
                <div className="hostellers-fee-student">{feeStudent.name} ({feeStudent.id}){feeStudent.room && feeStudent.room !== 'N/A' ? ` - Room ${feeStudent.room}` : ''} | {feeStudent.contact}</div>
                <div className="hostellers-fee-due">Due: ₹{newFee.amount || '0.00'}</div>
              </div>

              <div className="ui-stack">
                <div className="ui-field">
                  <label className="ui-label">Type <span className="hostellers-danger">*</span></label>
                  <select className="ui-select" value={newFee.transactionType} onChange={e => setNewFee({ ...newFee, transactionType: e.target.value })}>
                    <option value="RENT">Rent</option>
                    <option value="MESS">Mess Fee</option>
                    <option value="EB_BILL">EB Bill</option>
                    <option value="FINE">Fine</option>
                    <option value="ADVANCE">Advance Deposit</option>
                  </select>
                </div>
                <div className="ui-field">
                  <label className="ui-label">Amount Paid (₹) <span className="hostellers-danger">*</span></label>
                  <input type="number" className="ui-input" value={newFee.amount || ''} onChange={e => setNewFee({ ...newFee, amount: Number(e.target.value) })} />
                </div>
                <div className="ui-field">
                  <label className="ui-label">Payment Mode</label>
                  <select className="ui-select" value={newFee.paymentMode} onChange={e => setNewFee({ ...newFee, paymentMode: e.target.value })}>
                    <option value="UPI">UPI / QR (GPay / PhonePe / Paytm)</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div className="ui-field">
                  <label className="ui-label">Transaction Reference Number</label>
                  <input type="text" className="ui-input" placeholder="UPI Ref ID, Cheque #, or Cash Voucher" value={newFee.referenceNumber} onChange={e => setNewFee({ ...newFee, referenceNumber: e.target.value })} />
                </div>
                <div className="ui-field">
                  <label className="ui-label">Notes</label>
                  <input type="text" className="ui-input" placeholder="Optional notes" value={newFee.description} onChange={e => setNewFee({ ...newFee, description: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="ui-modal-foot">
              <button onClick={() => setShowFeeModal(false)} className="ui-btn ui-btn-soft">Cancel</button>
              <button onClick={handleAddFee} disabled={isSubmittingFee} className="ui-btn ui-btn-success">
                {isSubmittingFee ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && importFile && (
        <StudentImport
          file={importFile}
          onUploadingChange={setIsUploadingImport}
          onClose={() => {
            setShowImportModal(false);
            setImportFile(null);
            setIsUploadingImport(false);
            fetchHostellers();
          }}
        />
      )}
    </div>
  );
};

export default Hostellers;
