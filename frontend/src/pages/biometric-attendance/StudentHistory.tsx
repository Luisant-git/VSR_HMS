import { useEffect, useState } from 'react';
import { CalendarRange, History, IdCard, Phone, Search, UserRound } from 'lucide-react';
import { BiometricAttendanceAPI, type BioStudent } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioEmpty,
  BioErrorNotice,
  BioExportButton,
  BioField,
  BioPageHead,
  BioPager,
  BioRefresh,
  BioStatGrid,
  BioTableState,
  DirectionBadge,
} from './components/BioUI';
import {
  currentMonthInput,
  downloadStamp,
  exportExcel,
  formatDate,
  formatDateTime,
  formatTime,
  monthBounds,
  todayInput,
} from './utils';

const LIMIT = 15;

const StudentPunches = ({ student }: { student: BioStudent }) => {
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState('');
  const [fromDate, setFromDate] = useState(monthBounds(currentMonthInput()).fromDate);
  const [toDate, setToDate] = useState(todayInput());

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.studentPunches(student.id, {
        page,
        limit: LIMIT,
        fromDate,
        toDate,
        direction: direction || undefined,
      }),
    [student.id, page, fromDate, toDate, direction],
  );

  useEffect(() => {
    setPage(1);
  }, [student.id, fromDate, toDate, direction]);

  const rows = data?.data || [];
  const summary = data?.summary;

  const refresh = () => {
    reload();
  };

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Punch history',
          rows: rows.map((row) => ({
            Date: formatDate(row.punch_date),
            Time: row.punch_time,
            Direction: row.direction,
            Method: row.method || '',
            Device: row.terminal_name || row.device_id || '',
            'Synced at': row.synced_at || '',
          })),
        },
      ],
      `punch-history-${student.reg_no}-${downloadStamp()}.xlsx`,
    );
  };

  return (
    <>
      {error ? <BioErrorNotice message={error} onRetry={refresh} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Total punches', value: summary?.totalPunches ?? '—', sub: 'In selected range', icon: <History size={19} />, tone: 'accent' },
            { label: 'Days present', value: summary?.days ?? '—', sub: 'Distinct attendance days', icon: <CalendarRange size={19} />, tone: 'info' },
            { label: 'IN punches', value: summary?.inCount ?? '—', sub: 'Entries', icon: <UserRound size={19} />, tone: 'success' },
            { label: 'OUT punches', value: summary?.outCount ?? '—', sub: 'Exits', icon: <UserRound size={19} />, tone: 'warning' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title={`${student.name} · punch history`}
          subtitle={
            summary?.firstPunch
              ? `First punch ${formatDateTime(summary.firstPunch)} · last punch ${formatDateTime(summary.lastPunch)}`
              : 'No punches in this range'
          }
          icon={<History size={17} />}
          action={
            <>
              <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={refresh} disabled={loading}>
                Refresh
              </button>
              <BioExportButton onClick={handleExport} disabled={!rows.length} />
            </>
          }
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioField label="From">
              <input type="date" className="ui-input ui-input--inline" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </BioField>
            <BioField label="To">
              <input type="date" className="ui-input ui-input--inline" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </BioField>
            <BioField label="Direction">
              <select className="ui-select" value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="">All punches</option>
                <option value="IN">IN only</option>
                <option value="OUT">OUT only</option>
              </select>
            </BioField>
            <button
              type="button"
              className="ui-btn ui-btn-secondary ui-btn-sm"
              onClick={() => {
                const bounds = monthBounds(currentMonthInput());
                setFromDate(bounds.fromDate);
                setToDate(todayInput());
              }}
            >
              This month
            </button>
          </div>
          <div className="bio-toolbar-actions">
            <BioRefresh onClick={refresh} loading={loading} />
          </div>
        </div>

        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Direction</th>
                <th>Method</th>
                <th>Device</th>
                <th>Synced at</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={6}
                emptyTitle="No punches for this student"
                emptyText="Try a wider date range or switch the direction filter."
                onRetry={refresh}
              />
              {rows.map((row) => (
                <tr key={`${row.punch_time_raw}-${row.direction}`}>
                  <td className="bio-subtle">{formatDate(row.punch_date)}</td>
                  <td className="bio-time">{row.punch_time || formatTime(row.punch_time_raw)}</td>
                  <td><DirectionBadge direction={row.direction} /></td>
                  <td className="bio-subtle">{row.method || '—'}</td>
                  <td className="bio-subtle">{row.terminal_name || row.device_id || '—'}</td>
                  <td className="bio-subtle">{row.synced_at ? formatDateTime(row.synced_at) : '—'}</td>
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

const StudentHistory = () => {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<BioStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<BioStudent | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      BiometricAttendanceAPI.students({ search: query.trim(), limit: 10 })
        .then((response) => {
          if (active) setOptions(response.data || []);
        })
        .catch(() => {
          if (active) setOptions([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, query ? 300 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <>
      <BioPageHead
        title="Student punch history"
        subtitle="Search any hosteller to inspect their complete biometric movement trail"
      />

      <div className="bio-card">
        <BioCardHead
          title="Find a student"
          subtitle="Search by name, register number, biometric ID or room"
          icon={<Search size={17} />}
        />
        <div className="bio-card-body">
          <div className="bio-picker" style={{ maxWidth: 520 }}>
            <div className="ui-search bio-search" style={{ maxWidth: 'none' }}>
              <Search size={15} />
              <input
                type="search"
                value={query}
                placeholder="Start typing a name or register number..."
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                aria-label="Search students"
              />
            </div>
            {open ? (
              <div className="bio-picker-menu">
                {searching ? <div className="bio-picker-empty">Searching students...</div> : null}
                {!searching && options.length === 0 ? (
                  <div className="bio-picker-empty">No students matched your search.</div>
                ) : null}
                {!searching &&
                  options.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className="bio-picker-item"
                      onClick={() => {
                        setStudent(option);
                        setQuery(`${option.name} · ${option.reg_no}`);
                        setOpen(false);
                      }}
                    >
                      <div className="bio-avatar">{String(option.name || '?').slice(0, 2).toUpperCase()}</div>
                      <div className="bio-picker-text">
                        <strong>{option.name}</strong>
                        <span>
                          {option.reg_no}
                          {option.room_no ? ` · Room ${option.room_no}` : ''}
                          {option.bed_no ? ` · ${option.bed_no}` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {student ? (
        <>
          <div className="bio-card">
            <div className="bio-card-body">
              <div className="bio-profile">
                <div className="bio-profile-avatar">{String(student.name || '?').slice(0, 2).toUpperCase()}</div>
                <div className="bio-profile-main">
                  <div className="bio-profile-name">{student.name}</div>
                  <div className="bio-profile-meta">
                    {student.reg_no}
                    {student.room_no ? ` · Room ${student.room_no}` : ''}
                    {student.bed_no ? ` · ${student.bed_no}` : ''}
                    {student.status ? ` · ${student.status}` : ''}
                  </div>
                  <div className="bio-profile-tags">
                    <span className="bio-tag"><IdCard size={12} /> Biometric ID: {student.biometric_id || 'Not linked'}</span>
                    <span className="bio-tag"><Phone size={12} /> {student.student_mobile || 'No mobile'}</span>
                    {student.father_name || student.father_mobile ? (
                      <span className="bio-tag"><UserRound size={12} /> {student.father_name || 'Parent'} · {student.father_mobile || '—'}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <StudentPunches student={student} />
        </>
      ) : (
        <div className="bio-card">
          <BioEmpty
            title="No student selected"
            text="Use the search box above to pick a hosteller. Their daily punch timeline, IN/OUT counts and device details will appear here."
            icon={<History size={30} />}
          />
        </div>
      )}
    </>
  );
};

export default StudentHistory;
