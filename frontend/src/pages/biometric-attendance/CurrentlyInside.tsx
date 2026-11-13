import { useEffect, useState } from 'react';
import { DoorClosed, LogIn, Phone, ShieldCheck } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioErrorNotice,
  BioExportButton,
  BioPageHead,
  BioPager,
  BioRefresh,
  BioSearchField,
  BioSourceNotice,
  BioStatGrid,
  BioTableState,
} from './components/BioUI';
import { downloadStamp, durationLabel, exportExcel, formatTime, hoursSince } from './utils';

const LIMIT = 15;

const CurrentlyInside = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, loading, error, reload } = useApiData(
    () => BiometricAttendanceAPI.currentlyInside({ page, limit: LIMIT, search: search.trim() }),
    [page, search],
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  const rows = data?.data || [];

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Currently inside',
          rows: rows.map((row) => ({
            Student: row.student_name,
            'Register No': row.reg_no,
            Room: row.room_no || '',
            Bed: row.bed_no || '',
            'In time': row.in_time_formatted,
            'Inside for': durationLabel(hoursSince(row.in_time)),
            Mobile: row.student_mobile || '',
          })),
        },
      ],
      `currently-inside-${downloadStamp()}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Currently inside"
        subtitle="Students whose latest biometric movement is an IN punch"
        actions={
          <>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </>
        }
      />

      <BioSourceNotice available={data?.available} message={data?.message} loading={loading && !data} />
      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Inside right now', value: data?.summary?.total ?? '—', sub: 'Live occupancy', icon: <LogIn size={19} />, tone: 'success' },
            { label: 'Showing', value: rows.length, sub: 'Rows on this page', icon: <DoorClosed size={19} />, tone: 'accent' },
            { label: 'Hall safety', value: 'Normal', sub: 'All listed students are inside', icon: <ShieldCheck size={19} />, tone: 'info' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Inside board"
          subtitle="Presence is derived from each student's latest IN punch"
          icon={<LogIn size={17} />}
          action={<span className="bio-live-pill"><span className="bio-live-dot" /> Live board</span>}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField value={search} onChange={setSearch} placeholder="Search inside students..." />
          </div>
          <div className="bio-toolbar-actions">
            <BioRefresh onClick={reload} loading={loading} />
          </div>
        </div>

        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Room / Bed</th>
                <th>In time</th>
                <th>Inside for</th>
                <th>Mobile</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={5}
                emptyTitle="No students currently inside"
                emptyText="No active IN punches were found. The board will update as students scan back in."
                onRetry={reload}
              />
              {rows.map((row) => (
                <tr key={`${row.reg_no}-${row.in_time}`}>
                  <td>
                    <div className="bio-person">
                      <div className="bio-avatar">{String(row.student_name || '?').slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="bio-person-name">{row.student_name || 'Unregistered'}</div>
                        <div className="bio-person-meta">{row.reg_no}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="bio-cell-stack">
                      <span className="bio-strong">{row.room_no || '—'}</span>
                      <span>{row.bed_no || 'No bed'}</span>
                    </div>
                  </td>
                  <td className="bio-time">{row.in_time_formatted || formatTime(row.in_time)}</td>
                  <td>
                    <span className="bio-status is-success">{durationLabel(hoursSince(row.in_time))}</span>
                  </td>
                  <td>
                    <span className="bio-subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Phone size={13} /> {row.student_mobile || '—'}
                    </span>
                  </td>
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

export default CurrentlyInside;
