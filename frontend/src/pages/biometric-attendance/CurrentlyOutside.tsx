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
  BioSourceNotice,
  BioStatGrid,
  BioTableState,
  BioStudent,
  ContactLines,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatTime, number } from './utils';

const LIMIT = 15;

const CurrentlyOutside = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [minHours, setMinHours] = useState('');

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.currentlyOutside({
        page,
        limit: LIMIT,
        search: search.trim(),
        minHours: minHours || undefined,
      }),
    [page, search, minHours],
  );

  useEffect(() => {
    setPage(1);
  }, [search, minHours]);

  const rows = data?.data || [];
  const summary = data?.summary;

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Currently outside',
          rows: rows.map((row) => ({
            Student: row.student_name,
            'Register No': row.reg_no,
            Room: row.room_no || '',
            Bed: row.bed_no || '',
            'Out time': row.out_time_formatted,
            'Time away': row.time_away,
            'Hours outside': number(row.hours_outside),
            Mobile: row.student_mobile || '',
            'Parent name': row.father_name || '',
            'Parent mobile': row.father_mobile || '',
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

      <BioSourceNotice available={data?.available} message={data?.message} loading={loading && !data} />
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
            <BioField label="Time away">
              <select className="ui-select" value={minHours} onChange={(event) => setMinHours(event.target.value)}>
                <option value="">Any duration</option>
                <option value="2">Over 2 hours</option>
                <option value="4">Over 4 hours</option>
                <option value="8">Over 8 hours</option>
                <option value="12">Over 12 hours</option>
              </select>
            </BioField>
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
                <th>Contact</th>
                <th>Out time</th>
                <th>Time away</th>
                <th>Hours outside</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={5}
                emptyTitle="No students currently outside"
                emptyText={
                  minHours
                    ? 'Nobody has been outside longer than the selected duration.'
                    : 'Every active hosteller currently has an IN punch recorded.'
                }
                onRetry={reload}
              />
              {rows.map((row) => {
                const hours = number(row.hours_outside);
                return (
                  <tr key={`${row.reg_no}-${row.out_time}`}>
                    <td>
                      <BioStudent name={row.student_name} regNo={row.reg_no} room={row.room_no} bed={row.bed_no} />
                    </td>
                    <td>
                      <ContactLines self={row.student_mobile} parentName={row.father_name} parent={row.father_mobile} />
                    </td>
                    <td className="bio-time">{row.out_time_formatted || formatTime(row.out_time)}</td>
                    <td className="bio-subtle">{row.time_away}</td>
                    <td>
                      <span className={`bio-status ${hours >= 4 ? 'is-danger' : hours >= 2 ? 'is-warning' : 'is-neutral'}`}>
                        {hours.toFixed(1)}h
                      </span>
                    </td>
                  </tr>
                );
              })}
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
