import { useEffect, useState } from 'react';
import { CreditCard, Fingerprint, LayoutGrid, List, ScanFace, UserCheck, UserX, Users } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioEmpty,
  BioExportButton,
  BioField,
  BioPageHead,
  BioPager,
  BioRefresh,
  BioSearchField,
  BioStatGrid,
  BioTableState,
} from './components/BioUI';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { downloadStamp, exportExcel, formatDateTime, initials } from './utils';

const LIMIT = 15;

const DeviceUsers = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.deviceUsers({
        page,
        limit: LIMIT,
        search: search.trim(),
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [page, search, fromDate, toDate],
  );

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate]);

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
              'Device ID': row.device_id || '',
              'Device PIN / User ID': row.device_user_id,
              'Name on Device': row.name_on_device || '',
              'Matched Student in DB': row.matched ? row.student_name || 'Matched' : 'Not matched',
              'Reg No': row.reg_no || '',
              'Room No': row.room_no || '',
              'Face Biometric': row.face_enrolled ? 'Yes' : '',
              Fingerprints: row.fingerprint_enrolled ? 'Yes' : '',
              'Card No': row.card_no || '',
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
              'Device ID': row.device_id || '',
              'Device PIN / User ID': row.device_user_id,
              'Name on Device': row.name_on_device || '',
              'Matched Student in DB': row.matched ? row.student_name || 'Matched' : 'Not matched',
              'Reg No': row.reg_no || '',
              'Room No': row.room_no || '',
              'Face Biometric': row.face_enrolled ? 'Yes' : '',
              Fingerprints: row.fingerprint_enrolled ? 'Yes' : '',
              'Card No': row.card_no || '',
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
          items={[
            { label: 'Enrolled users', value: summary?.totalUsers ?? '—', sub: 'Distinct device + PIN pairs', icon: <Users size={19} />, tone: 'accent' },
            { label: 'Matched', value: summary?.matched ?? '—', sub: 'Linked to a student record', icon: <UserCheck size={19} />, tone: 'success' },
            { label: 'Not matched', value: summary?.unmatched ?? '—', sub: 'Need register number mapping', icon: <UserX size={19} />, tone: 'warning' },
            { label: 'Face biometric', value: summary?.faceEnrolled ?? '—', sub: 'Enrolled face biometrics', icon: <ScanFace size={19} />, tone: 'info' },
            { label: 'Fingerprints', value: summary?.fingerprintEnrolled ?? '—', sub: 'Enrolled fingerprints', icon: <Fingerprint size={19} />, tone: 'purple' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Enrolled users"
          subtitle="Every PIN registered on a terminal or observed in logs, with student mapping and enrollment signals"
          icon={<Users size={17} />}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField
              value={search}
              onChange={setSearch}
              placeholder="Search PIN, device, student, reg no. or room..."
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
                setPage(1);
              }}
              title="Reset search and filters"
            >
              Reset
            </button>
          </div>
          <div className="bio-toolbar-actions">
            <div className="ui-btn-group" style={{ display: 'inline-flex' }}>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${viewMode === 'table' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                <List size={14} /> Table
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${viewMode === 'card' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => setViewMode('card')}
                title="Responsive card grid view"
              >
                <LayoutGrid size={14} /> Cards
              </button>
            </div>
            <BioRefresh onClick={reload} loading={loading} />
          </div>
        </div>

        {viewMode === 'card' ? (
          <div>
            {loading && !data ? (
              <div className="ui-table-state" style={{ padding: 40 }}>
                <LoadingSpinner text="Loading enrolled users..." />
              </div>
            ) : error && !data ? (
              <div style={{ padding: 20 }}>
                <BioEmpty title="Could not load records" text={error} />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 20 }}>
                <BioEmpty
                  title="No enrolled users found"
                  text="No biometric PINs match the current filters. Clear the search or date range."
                />
              </div>
            ) : (
              <div className="bio-users-grid">
                {rows.map((row) => (
                  <div className="bio-user-card" key={`${row.device_id || 'device'}-${row.device_user_id}`}>
                    <div className="bio-user-card-head">
                      <div className="bio-user-card-person">
                        <div className="bio-avatar">{initials(row.student_name || row.name_on_device)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="bio-person-name"
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={row.student_name || row.name_on_device || 'Unregistered'}
                          >
                            {row.student_name || row.name_on_device || 'Unregistered'}
                          </div>
                          {row.name_on_device && row.name_on_device !== row.student_name ? (
                            <div className="bio-subtle" style={{ fontSize: 11 }}>
                              Device: {row.name_on_device}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <span className={`bio-status ${row.matched ? 'is-success' : 'is-warning'}`}>
                        {row.matched ? 'Matched' : 'Not matched'}
                      </span>
                    </div>

                    <div className="bio-user-card-body">
                      <div className="bio-user-card-field">
                        <span className="bio-user-card-label">Device PIN / User ID</span>
                        <span className="bio-user-card-value">{row.device_user_id}</span>
                      </div>
                      <div className="bio-user-card-field">
                        <span className="bio-user-card-label">Register No</span>
                        <span className="bio-user-card-value">{row.reg_no || '—'}</span>
                      </div>
                      <div className="bio-user-card-field">
                        <span className="bio-user-card-label">Room / Bed</span>
                        <span className="bio-user-card-value">
                          {row.room_no ? `${row.room_no}${row.bed_no ? ` (${row.bed_no})` : ''}` : '—'}
                        </span>
                      </div>
                      <div className="bio-user-card-field">
                        <span className="bio-user-card-label">Device ID</span>
                        <span className="bio-user-card-value bio-mono" style={{ fontSize: 12 }} title={row.device_id || '—'}>
                          {row.device_id || '—'}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: 12,
                      }}
                    >
                      <div className="bio-user-card-badges">
                        {row.face_enrolled ? (
                          <span
                            className="bio-status is-success"
                            title="Face Biometric Enrolled"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <ScanFace size={13} /> Face
                          </span>
                        ) : null}
                        {row.fingerprint_enrolled ? (
                          <span
                            className="bio-status is-info"
                            title="Fingerprint Enrolled"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Fingerprint size={13} /> Fingerprint
                          </span>
                        ) : null}
                        {row.card_no ? (
                          <span
                            className="bio-status is-neutral"
                            title="Card Enrolled"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <CreditCard size={13} /> {row.card_no}
                          </span>
                        ) : null}
                        {!row.face_enrolled && !row.fingerprint_enrolled && !row.card_no ? (
                          <span className="bio-muted-value">No credentials</span>
                        ) : null}
                      </div>
                      <span className="bio-subtle" title="Last Synced">
                        {row.last_synced ? formatDateTime(row.last_synced) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bio-table-wrap">
            <table className="ui-table bio-table">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Device PIN / User ID</th>
                  <th>Name on Device</th>
                  <th>Matched Student in DB</th>
                  <th>Reg No</th>
                  <th>Room No</th>
                  <th>Face Biometric</th>
                  <th>Fingerprints</th>
                  <th>Card No</th>
                  <th>Last Synced</th>
                </tr>
              </thead>
              <tbody>
                <BioTableState
                  loading={loading && !data}
                  error={error && !data ? error : null}
                  empty={rows.length === 0}
                  colSpan={10}
                  emptyTitle="No enrolled users found"
                  emptyText="No biometric PINs have been recorded yet. Run a device sync or clear the search."
                  onRetry={reload}
                />
                {rows.map((row) => (
                  <tr key={`${row.device_id || 'device'}-${row.device_user_id}`}>
                    <td className="bio-strong bio-mono">{row.device_id || '—'}</td>
                    <td className="bio-strong">{row.device_user_id}</td>
                    <td>{row.name_on_device || '—'}</td>
                    <td>
                      {row.matched ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span className="bio-status is-success" style={{ fontSize: 11, padding: '2px 8px' }}>
                            Matched
                          </span>
                          <span className="bio-strong">{row.student_name || '—'}</span>
                        </div>
                      ) : (
                        <span className="bio-status is-warning" style={{ fontSize: 11, padding: '2px 8px' }}>
                          Not matched
                        </span>
                      )}
                    </td>
                    <td className="bio-strong">{row.reg_no || '—'}</td>
                    <td>
                      {row.room_no ? (
                        <span className="bio-strong">
                          {row.room_no} {row.bed_no ? <span className="bio-subtle">({row.bed_no})</span> : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {row.face_enrolled ? (
                        <span
                          className="bio-status is-success"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <ScanFace size={13} /> Yes
                        </span>
                      ) : (
                        <span className="bio-muted-value">—</span>
                      )}
                    </td>
                    <td>
                      {row.fingerprint_enrolled ? (
                        <span
                          className="bio-status is-info"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Fingerprint size={13} /> Yes
                        </span>
                      ) : (
                        <span className="bio-muted-value">—</span>
                      )}
                    </td>
                    <td>
                      {row.card_no ? (
                        <span
                          className="bio-strong"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <CreditCard size={13} /> {row.card_no}
                        </span>
                      ) : (
                        <span className="bio-muted-value">—</span>
                      )}
                    </td>
                    <td className="bio-time">{row.last_synced ? formatDateTime(row.last_synced) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
