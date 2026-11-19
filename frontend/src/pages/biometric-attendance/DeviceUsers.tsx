import { useEffect, useState } from 'react';
import { Fingerprint, KeyRound, ScanFace, Sparkles, UserCheck, Users } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioExportButton,
  BioField,
  BioPageHead,
  BioPager,
  BioRefresh,
  BioSearchField,
  BioStatGrid,
  BioTableState,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatDateTime } from './utils';

const LIMIT = 15;

const DeviceUsers = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'active' | 'all' | 'vacated' | 'unmatched' | 'both' | 'face_only' | 'fingerprint_only' | 'pin_only'
  >('active');
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.deviceUsers({
        page,
        limit: LIMIT,
        search: search.trim(),
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    [page, search, fromDate, toDate, statusFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, statusFilter]);

  const handleFrom = (value: string) => {
    setFromDate(value);
    if (value && toDate && value > toDate) setToDate(value);
  };

  const handleTo = (value: string) => {
    setToDate(value);
    if (value && fromDate && value < fromDate) setFromDate(value);
  };

  const clearDates = () => {
    setFromDate('');
    setToDate('');
  };

  const rows = data?.data || [];
  const summary = data?.summary;

  const handleExport = async () => {
    if (!rows.length || exporting) return;
    setExporting(true);
    try {
      let exportRows = rows;
      if (summary?.totalUsers && summary.totalUsers > rows.length) {
        const full = await BiometricAttendanceAPI.deviceUsers({
          page: 1,
          limit: summary.totalUsers,
          search: search.trim(),
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        });
        if (full?.data?.length) {
          exportRows = full.data;
        }
      }
      exportExcel(
        [
          {
            name: 'Device enrolled users',
            rows: exportRows.map((row) => ({
              'Student Name': row.student_name || row.name_on_device || 'Unmatched',
              'Student Reg No': row.reg_no || '',
              'Device PIN / User ID': row.device_user_id,
              'Room No': row.room_no ? `${row.room_no}${row.bed_no ? ` (${row.bed_no})` : ''}` : '',
              Status: row.student_status === 'In' ? 'Active' : (row.student_status || (row.matched ? 'Active' : 'Unmatched')),
              Biometrics:
                row.face_enrolled && row.fingerprint_enrolled
                  ? 'Both (Face + Fingerprint)'
                  : row.face_enrolled
                    ? 'Face Only'
                    : row.fingerprint_enrolled
                      ? 'Fingerprint Only'
                      : 'Pending Scan',
              'Last Synced': row.last_synced ? formatDateTime(row.last_synced) : '',
            })),
          },
        ],
        `device-enrolled-users-${downloadStamp()}.xlsx`,
      );
    } catch {
      exportExcel(
        [
          {
            name: 'Device enrolled users',
            rows: rows.map((row) => ({
              'Student Name': row.student_name || row.name_on_device || 'Unmatched',
              'Student Reg No': row.reg_no || '',
              'Device PIN / User ID': row.device_user_id,
              'Room No': row.room_no ? `${row.room_no}${row.bed_no ? ` (${row.bed_no})` : ''}` : '',
              Status: row.student_status === 'In' ? 'Active' : (row.student_status || (row.matched ? 'Active' : 'Unmatched')),
              Biometrics:
                row.face_enrolled && row.fingerprint_enrolled
                  ? 'Both (Face + Fingerprint)'
                  : row.face_enrolled
                    ? 'Face Only'
                    : row.fingerprint_enrolled
                      ? 'Fingerprint Only'
                      : 'Pending Scan',
              'Last Synced': row.last_synced ? formatDateTime(row.last_synced) : '',
            })),
          },
        ],
        `device-enrolled-users-${downloadStamp()}.xlsx`,
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <BioPageHead
        title="Device enrolled users"
        subtitle="Users registered on biometric terminals and their student mapping"
        actions={
          <>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length || exporting} />
          </>
        }
      />

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          singleRow
          items={[
            {
              label: 'Active students',
              value:
                summary?.activeMatched !== undefined && summary?.totalActiveStudents !== undefined
                  ? `${summary.activeMatched} / ${summary.totalActiveStudents}`
                  : (summary?.totalUsers ?? '—'),
              sub: 'Active hostel students on machine',
              icon: <Users size={19} />,
              tone: 'accent',
              onClick: () => {
                setStatusFilter('active');
                setPage(1);
              },
              active: statusFilter === 'active',
            },
            {
              label: 'Biometrics enrolled',
              value:
                summary?.activeBothBiometric !== undefined &&
                summary?.activeFaceOnly !== undefined &&
                summary?.activeFingerprintOnly !== undefined
                  ? summary.activeBothBiometric + summary.activeFaceOnly + summary.activeFingerprintOnly
                  : '—',
              sub: 'Total with face or fingerprint',
              icon: <UserCheck size={19} />,
              tone: 'success',
              onClick: () => {
                setStatusFilter('active');
                setPage(1);
              },
            },
            {
              label: 'Both Face & Finger',
              value: summary?.activeBothBiometric ?? '—',
              sub: 'Enrolled with both biometrics',
              icon: <Sparkles size={19} />,
              tone: 'accent',
              onClick: () => {
                setStatusFilter('both');
                setPage(1);
              },
              active: statusFilter === 'both',
            },
            {
              label: 'Face only',
              value: summary?.activeFaceOnly ?? '—',
              sub: 'Active with face only',
              icon: <ScanFace size={19} />,
              tone: 'info',
              onClick: () => {
                setStatusFilter('face_only');
                setPage(1);
              },
              active: statusFilter === 'face_only',
            },
            {
              label: 'Fingerprint only',
              value: summary?.activeFingerprintOnly ?? '—',
              sub: 'Active with fingerprint only',
              icon: <Fingerprint size={19} />,
              tone: 'purple',
              onClick: () => {
                setStatusFilter('fingerprint_only');
                setPage(1);
              },
              active: statusFilter === 'fingerprint_only',
            },
            {
              label: 'Pending scan',
              value: summary?.activePinOnly ?? '—',
              sub: 'Awaiting face / finger scan',
              icon: <KeyRound size={19} />,
              tone: 'warning',
              onClick: () => {
                setStatusFilter('pin_only');
                setPage(1);
              },
              active: statusFilter === 'pin_only',
            },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Enrolled users"
          subtitle="Deduplicated list of enrolled students and device PINs with biometrics and registration signals"
          icon={<Users size={17} />}
        />

        <div className="bio-toolbar">
          <div className="bio-filters" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="ui-btn-group" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${statusFilter === 'active' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => {
                  setStatusFilter('active');
                  setPage(1);
                }}
              >
                All Active {summary?.activeMatched !== undefined ? `(${summary.activeMatched})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${statusFilter === 'both' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => {
                  setStatusFilter('both');
                  setPage(1);
                }}
              >
                Both Face & Finger {summary?.activeBothBiometric !== undefined ? `(${summary.activeBothBiometric})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${statusFilter === 'face_only' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => {
                  setStatusFilter('face_only');
                  setPage(1);
                }}
              >
                Face Only {summary?.activeFaceOnly !== undefined ? `(${summary.activeFaceOnly})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${statusFilter === 'fingerprint_only' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => {
                  setStatusFilter('fingerprint_only');
                  setPage(1);
                }}
              >
                Fingerprint Only {summary?.activeFingerprintOnly !== undefined ? `(${summary.activeFingerprintOnly})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${statusFilter === 'pin_only' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => {
                  setStatusFilter('pin_only');
                  setPage(1);
                }}
              >
                PIN Only / Awaiting Scan {summary?.activePinOnly !== undefined ? `(${summary.activePinOnly})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${statusFilter === 'vacated' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => {
                  setStatusFilter('vacated');
                  setPage(1);
                }}
              >
                Vacated {summary?.vacatedMatched !== undefined ? `(${summary.vacatedMatched})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${statusFilter === 'unmatched' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => {
                  setStatusFilter('unmatched');
                  setPage(1);
                }}
              >
                Unmatched PINs {summary?.unmatched !== undefined ? `(${summary.unmatched})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${statusFilter === 'all' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => {
                  setStatusFilter('all');
                  setPage(1);
                }}
              >
                All on Machine {summary?.totalUsers !== undefined ? `(${summary.totalUsers})` : ''}
              </button>
            </div>

            <BioSearchField
              value={search}
              onChange={setSearch}
              placeholder="Search PIN, machine ID, student, reg no. or room..."
            />
            <BioField label="From">
              <input
                type="date"
                className="ui-input ui-input--inline"
                value={fromDate}
                onChange={(event) => handleFrom(event.target.value)}
              />
            </BioField>
            <BioField label="To">
              <input
                type="date"
                className="ui-input ui-input--inline"
                value={toDate}
                onChange={(event) => handleTo(event.target.value)}
              />
            </BioField>
            <button
              type="button"
              className="ui-btn ui-btn-secondary ui-btn-sm"
              onClick={() => {
                setSearch('');
                clearDates();
                setStatusFilter('active');
                setPage(1);
              }}
              title="Reset search and filters"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Student Reg No</th>
                <th>Device PIN / User ID</th>
                <th>Room</th>
                <th>Status</th>
                <th>Biometrics</th>
                <th>Last Synced</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading}
                error={error}
                empty={!loading && rows.length === 0}
                colSpan={7}
                emptyTitle="No enrolled users found"
                emptyText="No biometric PINs match the current filters. Clear the search or date range."
                onRetry={reload}
              />
              {!loading && rows.map((row) => (
                <tr key={`${row.device_id || 'device'}-${row.device_user_id}`}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="bio-strong">{row.student_name || row.name_on_device || 'Unregistered'}</span>
                      {row.name_on_device && row.student_name && row.name_on_device !== row.student_name ? (
                        <span className="bio-subtle" style={{ fontSize: 11 }}>
                          Device: {row.name_on_device}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="bio-strong">{row.reg_no || <span className="bio-muted-value">—</span>}</td>
                  <td className="bio-strong bio-mono">{row.device_user_id}</td>
                  <td>
                    {row.room_no ? (
                      <span className="bio-strong">
                        {row.room_no} {row.bed_no ? <span className="bio-subtle">({row.bed_no})</span> : null}
                      </span>
                    ) : (
                      <span className="bio-muted-value">—</span>
                    )}
                  </td>
                  <td>
                    {row.student_status === 'In' ? (
                      <span className="bio-status is-success" style={{ fontSize: 11, padding: '2px 8px' }}>
                        Active
                      </span>
                    ) : row.student_status === 'Vacated' ? (
                      <span className="bio-status is-warning" style={{ fontSize: 11, padding: '2px 8px' }}>
                        Vacated
                      </span>
                    ) : (
                      <span className="bio-status is-neutral" style={{ fontSize: 11, padding: '2px 8px' }}>
                        Unmatched
                      </span>
                    )}
                  </td>
                  <td>
                    {row.face_enrolled && row.fingerprint_enrolled ? (
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <span
                          className="bio-status is-success"
                          style={{ fontSize: 11, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          <ScanFace size={12} /> Face
                        </span>
                        <span
                          className="bio-status is-info"
                          style={{ fontSize: 11, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          <Fingerprint size={12} /> Finger
                        </span>
                      </div>
                    ) : row.face_enrolled ? (
                      <span
                        className="bio-status is-success"
                        style={{ fontSize: 11, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <ScanFace size={13} /> Face
                      </span>
                    ) : row.fingerprint_enrolled ? (
                      <span
                        className="bio-status is-info"
                        style={{ fontSize: 11, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Fingerprint size={13} /> Fingerprint
                      </span>
                    ) : (
                      <span
                        className="bio-status is-warning"
                        style={{ fontSize: 11, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <KeyRound size={12} /> Pending Scan
                      </span>
                    )}
                  </td>
                  <td className="bio-time">{row.last_synced ? formatDateTime(row.last_synced) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.pagination ? (
          <BioPager
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            limit={data.pagination.limit}
            onPage={setPage}
          />
        ) : null}
      </div>
    </>
  );
};

export default DeviceUsers;
