import { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, PhoneCall, Timer } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioErrorNotice,
  BioExportButton,
  BioField,
  BioPageHead,
  BioPager,
  BioRefresh,
  BioSearchField,
  BioStatGrid,
  BioTableState,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatTime, number } from './utils';

const LIMIT = 15;

const CurrentlyOutside = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [minHours, setMinHours] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.currentlyOutside({
        page,
        limit: LIMIT,
        search: search.trim(),
        minHours: minHours || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [page, search, minHours, fromDate, toDate],
  );

  useEffect(() => {
    setPage(1);
  }, [search, minHours, fromDate, toDate]);

  const rows = data?.data || [];
  const summary = data?.summary;

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

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Currently outside',
          rows: rows.map((row) => ({
            'Student ID': row.reg_no,
            'Student Name': row.student_name,
            'Room No': row.room_no || '',
            'Last Exit Time': row.out_time_formatted || formatTime(row.out_time),
            Mobile: row.student_mobile || '',
            Status: 'Outside',
          })),
        },
      ],
      `currently-outside-${downloadStamp()}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Currently outside"
        subtitle="Students whose latest biometric movement is an OUT punch"
        actions={
          <>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </>
        }
      />

      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Outside right now', value: summary?.total ?? '—', sub: 'Not yet checked in', icon: <LogOut size={19} />, tone: 'warning' },
            { label: 'Over 4 hours', value: summary?.over4Hours ?? '—', sub: 'Follow-up recommended', icon: <AlertTriangle size={19} />, tone: 'danger' },
            { label: 'Average time away', value: `${number(summary?.avgHours)}h`, sub: 'Across students outside', icon: <Timer size={19} />, tone: 'info' },
            { label: 'Showing', value: rows.length, sub: 'Rows on this page', icon: <PhoneCall size={19} />, tone: 'accent' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Outside board"
          subtitle="Contact details are included for quick safety follow-up"
          icon={<LogOut size={17} />}
          action={<span className="bio-live-pill is-warn"><span className="bio-live-dot" /> Needs return</span>}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField value={search} onChange={setSearch} placeholder="Search outside students..." />
            <BioField label="From">
              <input type="date" className="ui-input ui-input--inline" value={fromDate} onChange={(event) => handleFrom(event.target.value)} />
            </BioField>
            <BioField label="To">
              <input type="date" className="ui-input ui-input--inline" value={toDate} onChange={(event) => handleTo(event.target.value)} />
            </BioField>
            <BioField label="Time away">
              <select className="ui-select" value={minHours} onChange={(event) => setMinHours(event.target.value)}>
                <option value="">Any duration</option>
                <option value="2">Over 2 hours</option>
                <option value="4">Over 4 hours</option>
                <option value="8">Over 8 hours</option>
                <option value="12">Over 12 hours</option>
              </select>
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
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Room No</th>
                <th>Last Exit Time</th>
                <th>Mobile</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={6}
                emptyTitle="No students currently outside"
                emptyText={
                  minHours
                    ? 'Nobody has been outside longer than the selected duration.'
                    : 'Every active hosteller currently has an IN punch recorded.'
                }
                onRetry={reload}
              />
              {rows.map((row) => (
                <tr key={`${row.reg_no}-${row.out_time}`}>
                  <td className="bio-strong">{row.reg_no || '—'}</td>
                  <td>{row.student_name || 'Unregistered'}</td>
                  <td>{row.room_no || '—'}</td>
                  <td className="bio-time">{row.out_time_formatted || formatTime(row.out_time)}</td>
                  <td>{row.student_mobile || '—'}</td>
                  <td><span className="bio-status is-warning">Outside</span></td>
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

export default CurrentlyOutside;
