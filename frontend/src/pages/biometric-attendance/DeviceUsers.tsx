import { useEffect, useState } from 'react';
import { Fingerprint, ScanFace, UserCheck, UserX, Users } from 'lucide-react';
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

  const handleExport = () => {
    if (!rows.length) return;
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
  };

  return (
    <>
      <BioPageHead
        title="Device enrolled users"
        subtitle="Users registered on biometric terminals and their student mapping"
        actions={
          <>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </>
        }
      />

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Enrolled users', value: summary?.totalUsers ?? '—', sub: 'Distinct device + PIN pairs', icon: <Users size={19} />, tone: 'accent' },
            { label: 'Matched', value: summary?.matched ?? '—', sub: 'Linked to a student record', icon: <UserCheck size={19} />, tone: 'success' },
            { label: 'Not matched', value: summary?.unmatched ?? '—', sub: 'Need register number mapping', icon: <UserX size={19} />, tone: 'warning' },
            { label: 'Face biometric', value: summary?.faceEnrolled ?? '—', sub: 'Detected from face punches', icon: <ScanFace size={19} />, tone: 'info' },
            { label: 'Fingerprints', value: summary?.fingerprintEnrolled ?? '—', sub: 'Detected from fingerprint punches', icon: <Fingerprint size={19} />, tone: 'purple' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Enrolled users"
          subtitle="Every PIN seen on a terminal, with its student match and enrollment signals"
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
            {fromDate || toDate ? (
              <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={clearDates}>
                Clear dates
              </button>
            ) : null}
          </div>
          <div className="bio-toolbar-actions">
            <BioRefresh onClick={reload} loading={loading} />
          </div>
        </div>

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
                  <td className="bio-strong">{row.device_id || '—'}</td>
                  <td className="bio-strong">{row.device_user_id}</td>
                  <td>{row.name_on_device || '—'}</td>
                  <td>
                    {row.matched ? (
                      <div className="bio-cell-stack">
                        <span className="bio-status is-success">Matched</span>
                        <span className="bio-strong">{row.student_name || '—'}</span>
                      </div>
                    ) : (
                      <span className="bio-status is-warning">Not matched</span>
                    )}
                  </td>
                  <td className="bio-strong">{row.reg_no || '—'}</td>
                  <td>
                    {row.room_no ? (
                      <div className="bio-cell-stack">
                        <span className="bio-strong">{row.room_no}</span>
                        {row.bed_no ? <span>{row.bed_no}</span> : null}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {row.face_enrolled ? (
                      <span className="bio-status is-success">Yes</span>
                    ) : (
                      <span className="bio-muted-value">—</span>
                    )}
                  </td>
                  <td>
                    {row.fingerprint_enrolled ? (
                      <span className="bio-status is-success">Yes</span>
                    ) : (
                      <span className="bio-muted-value">—</span>
                    )}
                  </td>
                  <td>{row.card_no || '—'}</td>
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
