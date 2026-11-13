import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, Repeat2, ShieldAlert, Timer, Users } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
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
  BioSearchField,
  BioSourceNotice,
  BioStatGrid,
  BioStatus,
  BioStudent,
  BioTableState,
  ContactLines,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatDate, number, todayInput } from './utils';

const LIMIT = 15;

const monthStart = () => `${todayInput().slice(0, 8)}01`;

const Curfew = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(todayInput());
  const [curfewTime, setCurfewTime] = useState('20:30');

  const violations = useApiData(
    () =>
      BiometricAttendanceAPI.curfew({
        page,
        limit: LIMIT,
        search: search.trim(),
        fromDate,
        toDate,
        curfewTime,
      }),
    [page, search, fromDate, toDate, curfewTime],
  );

  const frequent = useApiData(
    () =>
      BiometricAttendanceAPI.frequentCurfew({
        days: 30,
        minCount: 2,
        curfewTime,
        search: search.trim(),
      }),
    [curfewTime, search],
  );

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, curfewTime]);

  const rows = violations.data?.data || [];
  const summary = violations.data?.summary;
  const frequentRows = frequent.data?.data || [];

  const handleExport = () => {
    if (!rows.length && !frequentRows.length) return;
    exportExcel(
      [
        {
          name: 'Curfew violations',
          rows: rows.map((row) => ({
            Date: formatDate(row.violation_date),
            Student: row.student_name,
            'Register No': row.reg_no,
            Room: row.room_no || '',
            'Entry time': row.entry_time,
            'Minutes late': row.mins_late,
            Mobile: row.student_mobile || '',
            'Parent mobile': row.father_mobile || '',
          })),
        },
        {
          name: 'Frequent late entrants',
          rows: frequentRows.map((row) => ({
            Student: row.student_name,
            'Register No': row.reg_no,
            Room: row.room_no || '',
            'Late entries (30 days)': row.total_late_entries,
            'Average minutes late': number(row.avg_minutes_late),
            'Parent mobile': row.father_mobile || '',
          })),
        },
      ],
      `curfew-report-${downloadStamp()}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Curfew & late entry"
        subtitle={`IN punches after ${curfewTime} are flagged as late`}
        actions={
          <>
            <BioRefresh onClick={() => { violations.reload(); frequent.reload(); }} loading={violations.loading || frequent.loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length && !frequentRows.length} />
          </>
        }
      />

      <BioSourceNotice available={violations.data?.available} message={violations.data?.message} loading={violations.loading && !violations.data} />
      {violations.error ? <BioErrorNotice message={violations.error} onRetry={violations.reload} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Late entries', value: summary?.totalViolations ?? '—', sub: 'In selected range', icon: <ShieldAlert size={19} />, tone: 'warning' },
            { label: 'Students involved', value: summary?.students ?? '—', sub: 'Unique late entrants', icon: <Users size={19} />, tone: 'info' },
            { label: 'Average late by', value: `${number(summary?.avgMinutesLate)}m`, sub: 'Per violation', icon: <Timer size={19} />, tone: 'accent' },
            { label: 'Worst delay', value: `${number(summary?.maxMinutesLate)}m`, sub: 'Latest single entry', icon: <AlertTriangle size={19} />, tone: 'danger' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Late entry register"
          subtitle="All IN punches after the configured curfew time"
          icon={<Clock3 size={17} />}
          action={<span className="bio-status is-warning">{summary?.totalViolations ?? 0} flagged</span>}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField value={search} onChange={setSearch} placeholder="Search late entrants..." />
            <BioField label="From">
              <input type="date" className="ui-input ui-input--inline" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </BioField>
            <BioField label="To">
              <input type="date" className="ui-input ui-input--inline" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </BioField>
            <BioField label="Curfew time">
              <input type="time" className="ui-input ui-input--inline" value={curfewTime} onChange={(event) => setCurfewTime(event.target.value)} />
            </BioField>
          </div>
          <div className="bio-toolbar-actions">
            <BioRefresh onClick={violations.reload} loading={violations.loading} />
          </div>
        </div>

        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Room</th>
                <th>Entry time</th>
                <th>Minutes late</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={violations.loading && !violations.data}
                error={violations.error && !violations.data ? violations.error : null}
                empty={rows.length === 0}
                colSpan={6}
                emptyTitle="No curfew violations"
                emptyText="No IN punches were recorded after the curfew time in this range."
                onRetry={violations.reload}
              />
              {rows.map((row) => (
                <tr key={`${row.reg_no}-${row.punch_time}`}>
                  <td className="bio-subtle">{formatDate(row.violation_date)}</td>
                  <td>
                    <BioStudent name={row.student_name} regNo={row.reg_no} />
                  </td>
                  <td className="bio-strong">{row.room_no || '—'}</td>
                  <td className="bio-time">{row.entry_time}</td>
                  <td><span className="bio-late">{row.mins_late} min</span></td>
                  <td>
                    <ContactLines self={row.student_mobile} parentName={row.father_name} parent={row.father_mobile} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {violations.data?.pagination ? (
          <BioPager
            page={violations.data.pagination.page}
            totalPages={violations.data.pagination.totalPages}
            total={violations.data.pagination.total}
            limit={violations.data.pagination.limit}
            onPage={setPage}
          />
        ) : null}
      </div>

      <div className="bio-card">
        <BioCardHead
          title="Frequent late entrants"
          subtitle="Students with 2 or more late entries in the last 30 days"
          icon={<Repeat2 size={17} />}
          action={<span className="bio-status is-info">{frequentRows.length} students</span>}
        />
        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Room</th>
                <th>Late entries (30 days)</th>
                <th>Average late by</th>
                <th>Parent mobile</th>
              </tr>
            </thead>
            <tbody>
              {frequent.loading && !frequent.data ? (
                <tr>
                  <td colSpan={5} className="ui-table-state">Loading frequent late entrants...</td>
                </tr>
              ) : null}
              {!frequent.loading && frequentRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <BioEmpty
                      title="No repeat late entrants"
                      text="Students with two or more late entries in the last 30 days will be listed here."
                      icon={<Repeat2 size={28} />}
                    />
                  </td>
                </tr>
              ) : null}
              {frequentRows.map((row) => (
                <tr key={row.reg_no}>
                  <td><BioStudent name={row.student_name} regNo={row.reg_no} /></td>
                  <td className="bio-strong">{row.room_no || '—'}</td>
                  <td><span className="bio-status is-warning">{row.total_late_entries} times</span></td>
                  <td className="bio-subtle">{number(row.avg_minutes_late)} min</td>
                  <td className="bio-subtle">{row.father_mobile || row.student_mobile || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!frequent.loading && frequentRows.length > 0 ? (
          <div className="bio-card-body" style={{ paddingTop: 0 }}>
            <BioStatus status={`${frequent.data?.summary?.days || 30}-day window`} />
          </div>
        ) : null}
      </div>
    </>
  );
};

export default Curfew;
