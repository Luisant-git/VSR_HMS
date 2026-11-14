import { useEffect, useMemo, useState } from 'react';
import { Building2, DoorClosed, Layers3, UserCheck, UserX } from 'lucide-react';
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
  BioRate,
  BioRefresh,
  BioSearchField,
  BioStatGrid,
  BioStatus,
  BioTableState,
} from './components/BioUI';
import { exportExcel, formatDate, number, percent, todayInput } from './utils';

const LIMIT = 12;

const RoomWise = () => {
  const [date, setDate] = useState(todayInput());
  const [search, setSearch] = useState('');
  const [floor, setFloor] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useApiData(
    () => BiometricAttendanceAPI.roomWise({ date, search: search.trim(), floor: floor || undefined }),
    [date, search, floor],
  );

  useEffect(() => {
    setPage(1);
  }, [date, search, floor]);

  const rows = data?.data || [];
  const summary = data?.summary;
  const floorSummary = data?.floorSummary || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / LIMIT));
  const pageRows = useMemo(() => rows.slice((page - 1) * LIMIT, page * LIMIT), [rows, page]);

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Room-wise attendance',
          rows: rows.map((row) => ({
            Date: formatDate(row.report_date),
            Room: row.room_no,
            Block: row.block || '',
            Floor: row.floor ?? '',
            Allotted: row.total_allotted_students,
            Present: row.present_count,
            Absent: row.absent_count,
            'Attendance %': number(row.attendance_rate),
            Status: row.room_status,
          })),
        },
        {
          name: 'Floor summary',
          rows: floorSummary.map((row) => ({
            Floor: row.floor,
            Rooms: row.rooms,
            Students: row.totalStudents,
            Present: row.present,
            Absent: row.absent,
            'Attendance %': number(row.attendanceRate),
          })),
        },
      ],
      `room-wise-attendance-${date}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Room-wise attendance"
        subtitle={`How many allotted students punched in on ${formatDate(date)}`}
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
            { label: 'Rooms on report', value: summary?.rooms ?? '—', sub: 'With allotted students', icon: <DoorClosed size={19} />, tone: 'accent' },
            { label: 'Students allotted', value: summary?.totalStudents ?? '—', sub: 'Active room residents', icon: <Building2 size={19} />, tone: 'info' },
            { label: 'Present', value: summary?.present ?? '—', sub: 'Punched in today', icon: <UserCheck size={19} />, tone: 'success' },
            { label: 'Absent', value: summary?.absent ?? '—', sub: 'No punch yet', icon: <UserX size={19} />, tone: 'danger' },
            { label: 'Full attendance rooms', value: summary?.fullRooms ?? '—', sub: percent(summary?.attendanceRate), icon: <Layers3 size={19} />, tone: 'purple' },
          ]}
        />
      </div>

      {floorSummary.length ? (
        <div className="bio-card" style={{ marginTop: 16 }}>
          <BioCardHead title="Floor summary" subtitle="Attendance rolled up by floor" icon={<Layers3 size={17} />} />
          <div className="bio-card-body">
            <div className="bio-device-grid">
              {floorSummary.map((row) => (
                <div className="bio-device-card" key={row.floor}>
                  <div className="bio-device-head" style={{ marginBottom: 10 }}>
                    <div>
                      <div className="bio-device-name">{row.floor}</div>
                      <div className="bio-device-ip">{row.rooms} rooms · {row.totalStudents} students</div>
                    </div>
                    <span className="bio-status is-info">{percent(row.attendanceRate)}</span>
                  </div>
                  <BioRate value={number(row.attendanceRate)} label={`${row.present} present / ${row.absent} absent`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Room register"
          subtitle="Allotted students vs students present"
          icon={<DoorClosed size={17} />}
          action={<span className="bio-status is-success">{summary?.fullRooms ?? 0} full rooms</span>}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField value={search} onChange={setSearch} placeholder="Search room, block or floor..." />
            <BioField label="Date">
              <input type="date" className="ui-input ui-input--inline" value={date} onChange={(event) => setDate(event.target.value)} />
            </BioField>
            <BioField label="Floor">
              <input
                type="number"
                min={0}
                className="ui-input ui-input--inline"
                placeholder="All floors"
                value={floor}
                onChange={(event) => setFloor(event.target.value)}
              />
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
                <th>Room</th>
                <th>Block / floor</th>
                <th>Allotted</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={7}
                emptyTitle="No room attendance data"
                emptyText="No rooms with allotted students were found for the selected date and filters."
                onRetry={reload}
              />
              {pageRows.map((row) => (
                <tr key={row.room_no}>
                  <td>
                    <div className="bio-cell-stack">
                      <span className="bio-strong">Room {row.room_no}</span>
                      <span>{formatDate(row.report_date)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="bio-cell-stack">
                      <span>{row.block || '—'}</span>
                      <span>{row.floor === null || row.floor === undefined ? 'Unassigned floor' : `Floor ${row.floor}`}</span>
                    </div>
                  </td>
                  <td className="bio-strong">{row.total_allotted_students}</td>
                  <td><span className="bio-status is-success">{row.present_count}</span></td>
                  <td><span className="bio-status is-danger">{row.absent_count}</span></td>
                  <td><BioRate value={number(row.attendance_rate)} /></td>
                  <td><BioStatus status={row.room_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length ? (
          <BioPager page={page} totalPages={totalPages} total={rows.length} limit={LIMIT} onPage={setPage} />
        ) : null}
      </div>

      {!loading && rows.length === 0 && data?.available ? (
        <div className="bio-card">
          <BioEmpty title="No rooms to display" text="Rooms appear once students are allotted and biometric punches are recorded." />
        </div>
      ) : null}
    </>
  );
};

export default RoomWise;
