import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Biometric attendance reporting service.
 *
 * Data contract comes from the VSR-HMS biometric SQL report:
 *   - public.biometric_attendance_logs
 *   - public.biometric_device_registry
 *   - public.biometric_sync_state
 *   - public.view_student_in_out_logs
 *   - public.view_student_currently_inside
 *   - public.view_student_currently_outside
 *   - public.view_student_daily_attendance_summary
 *   - public.view_student_curfew_violations
 *
 * Some deployments are still waiting for the biometric sync schema. Every
 * method therefore checks object availability up front and returns an
 * `available: false` envelope instead of throwing SQL errors or inventing data.
 */

const OBJ = {
  logs: 'biometric_attendance_logs',
  devices: 'biometric_device_registry',
  sync: 'biometric_sync_state',
  inOut: 'view_student_in_out_logs',
  inside: 'view_student_currently_inside',
  outside: 'view_student_currently_outside',
  daily: 'view_student_daily_attendance_summary',
  curfew: 'view_student_curfew_violations',
} as const;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;

export interface PageQuery {
  page?: number;
  limit?: number;
  search?: string;
}

interface QueryResult<T> {
  rows: T[];
  error?: string;
}

interface Availability {
  tables: Set<string>;
  missing: string[];
  ready: boolean;
}

@Injectable()
export class BiometricAttendanceService {
  private availabilityCache: { at: number; value: Availability } | null = null;
  private logsColumnsCache: { at: number; value: Set<string> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private today(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  private page(value?: number): number {
    return Math.max(1, Number(value) || 1);
  }

  private limit(value?: number): number {
    return Math.min(MAX_LIMIT, Math.max(1, Number(value) || DEFAULT_LIMIT));
  }

  private normalizeDirection(value: unknown): 'IN' | 'OUT' {
    const text = String(value ?? '').trim().toUpperCase();
    return text.startsWith('OUT') ? 'OUT' : 'IN';
  }

  private async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<T[]>(sql, ...params);
      return { rows };
    } catch (error) {
      return { rows: [], error: error instanceof Error ? error.message : 'Query failed' };
    }
  }

  private async availability(force = false): Promise<Availability> {
    if (!force && this.availabilityCache && Date.now() - this.availabilityCache.at < 20_000) {
      return this.availabilityCache.value;
    }

    const result = await this.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tables = new Set(result.rows.map((row) => row.table_name));
    const missing = Object.values(OBJ).filter((name) => !tables.has(name));
    const value: Availability = {
      tables,
      missing,
      ready: Object.values(OBJ).some((name) => tables.has(name)),
    };
    this.availabilityCache = { at: Date.now(), value };
    return value;
  }

  private unavailableMessage(availability: Availability, feature?: string): string {
    const missing = availability.missing;
    const prefix = feature ? `${feature} is not available. ` : 'Biometric attendance is not connected. ';
    if (!missing.length) return `${prefix}The biometric query returned no usable data.`;
    return `${prefix}Missing database object${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`;
  }

  private envelope<T>(
    availability: Availability,
    data: T,
    message?: string,
    extra: Record<string, unknown> = {},
  ) {
    return {
      available: availability.ready,
      message: availability.ready
        ? message || null
        : this.unavailableMessage(availability),
      generatedAt: new Date().toISOString(),
      ...extra,
      ...data,
    };
  }

  private pagination(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Punch query shared by the dashboard and live monitor. Uses the report view
   * when present, otherwise falls back to the raw biometric log table.
   */
  private async fetchPunches(options: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    direction?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    rows: any[];
    total: number;
    summary: { total: number; inCount: number; outCount: number; students: number };
    error?: string;
  }> {
    const availability = await this.availability();
    const page = this.page(options.page);
    const limit = this.limit(options.limit);
    const offset = (page - 1) * limit;
    const search = String(options.search || '').trim();
    const direction = String(options.direction || '').trim().toUpperCase();
    const date = options.date || (options.fromDate || options.toDate ? undefined : this.today());

    const params: unknown[] = [];
    const where: string[] = [];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (availability.tables.has(OBJ.inOut)) {
      if (date) where.push(`punch_date = ${add(date)}::date`);
      if (options.fromDate) where.push(`punch_date >= ${add(options.fromDate)}::date`);
      if (options.toDate) where.push(`punch_date <= ${add(options.toDate)}::date`);
      if (direction === 'IN' || direction === 'OUT') {
        where.push(`movement_direction ILIKE ${add(`${direction}%`)}`);
      }
      if (search) {
        const term = add(`%${search}%`);
        where.push(
          `(COALESCE(reg_no, '') ILIKE ${term} OR COALESCE(student_name, '') ILIKE ${term} OR COALESCE(room_no, '') ILIKE ${term} OR COALESCE(device_name, '') ILIKE ${term} OR COALESCE(user_pin, '') ILIKE ${term} OR COALESCE(device_id, '') ILIKE ${term})`,
        );
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const count = await this.query<{ total: number; in_count: number; out_count: number; students: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE movement_direction ILIKE 'IN%')::int AS in_count,
                COUNT(*) FILTER (WHERE movement_direction ILIKE 'OUT%')::int AS out_count,
                COUNT(DISTINCT reg_no)::int AS students
         FROM public.view_student_in_out_logs ${whereSql}`,
        params,
      );
      if (count.error) return { rows: [], total: 0, summary: { total: 0, inCount: 0, outCount: 0, students: 0 }, error: count.error };

      const data = await this.query<any>(
        `SELECT punch_date::text AS punch_date,
                punch_time,
                punch_time_formatted AS time_of_punch,
                user_pin,
                movement_direction AS direction,
                reg_no,
                student_name,
                room_no,
                bed_no,
                student_mobile,
                verify_type AS verified_by,
                device_name AS gate_name,
                device_id
         FROM public.view_student_in_out_logs
         ${whereSql}
         ORDER BY punch_time DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      );

      const rows = data.rows.map((row) => ({
        ...row,
        direction: this.normalizeDirection(row.direction),
        id: `${row.reg_no || 'unknown'}-${row.punch_time}`,
      }));
      const summaryRow = count.rows[0] || { total: 0, in_count: 0, out_count: 0, students: 0 };
      return {
        rows,
        total: Number(summaryRow.total) || 0,
        summary: {
          total: Number(summaryRow.total) || 0,
          inCount: Number(summaryRow.in_count) || 0,
          outCount: Number(summaryRow.out_count) || 0,
          students: Number(summaryRow.students) || 0,
        },
        error: data.error,
      };
    }

    if (!availability.tables.has(OBJ.logs)) {
      return { rows: [], total: 0, summary: { total: 0, inCount: 0, outCount: 0, students: 0 } };
    }

    if (date) where.push(`b.punch_time::date = ${add(date)}::date`);
    if (options.fromDate) where.push(`b.punch_time::date >= ${add(options.fromDate)}::date`);
    if (options.toDate) where.push(`b.punch_time::date <= ${add(options.toDate)}::date`);
    if (direction === 'IN') where.push(`(b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In')`);
    if (direction === 'OUT') where.push(`(b.punch_state_code IN (1, 2) OR b.punch_state = 'Check-Out')`);
    if (search) {
      const term = add(`%${search}%`);
      where.push(
        `(COALESCE(s."regNo", '') ILIKE ${term} OR COALESCE(s.name, '') ILIKE ${term} OR COALESCE(s."roomNo", '') ILIKE ${term} OR COALESCE(d.device_name, b.device_id, '') ILIKE ${term})`,
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const joins = `
      LEFT JOIN public."Student" s ON (s."biometricId" = b.user_id OR s."regNo" = b.user_id OR s."manualRegsiName" = b.user_id)
      LEFT JOIN public.biometric_device_registry d ON d.device_id = b.device_id`;
    const count = await this.query<{ total: number; in_count: number; out_count: number; students: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In')::int AS in_count,
              COUNT(*) FILTER (WHERE b.punch_state_code IN (1, 2) OR b.punch_state = 'Check-Out')::int AS out_count,
              COUNT(DISTINCT b.user_id)::int AS students
       FROM public.biometric_attendance_logs b ${joins} ${whereSql}`,
      params,
    );
    if (count.error) return { rows: [], total: 0, summary: { total: 0, inCount: 0, outCount: 0, students: 0 }, error: count.error };

    const data = await this.query<any>(
      `SELECT TO_CHAR(b.punch_time::date, 'YYYY-MM-DD') AS punch_date,
              b.punch_time,
              TO_CHAR(b.punch_time, 'HH12:MI:SS AM') AS time_of_punch,
              b.user_id AS user_pin,
              CASE WHEN (b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In') THEN 'IN' ELSE 'OUT' END AS direction,
              COALESCE(s."regNo", b.user_id) AS reg_no,
              COALESCE(s.name, 'Unregistered') AS student_name,
              s."roomNo" AS room_no,
              s."bedNo" AS bed_no,
              s."mobileNo" AS student_mobile,
              b.verify_type AS verified_by,
              COALESCE(d.device_name, b.device_id) AS gate_name,
              b.device_id AS device_id
       FROM public.biometric_attendance_logs b ${joins}
       ${whereSql}
       ORDER BY b.punch_time DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const rows = data.rows.map((row) => ({
      ...row,
      direction: this.normalizeDirection(row.direction),
      id: `${row.reg_no || 'unknown'}-${row.punch_time}`,
    }));
    const summaryRow = count.rows[0] || { total: 0, in_count: 0, out_count: 0, students: 0 };
    return {
      rows,
      total: Number(summaryRow.total) || 0,
      summary: {
        total: Number(summaryRow.total) || 0,
        inCount: Number(summaryRow.in_count) || 0,
        outCount: Number(summaryRow.out_count) || 0,
        students: Number(summaryRow.students) || 0,
      },
      error: data.error,
    };
  }

  // ---------------------------------------------------------------------------
  // Health / dashboard
  // ---------------------------------------------------------------------------

  async getHealth() {
    const availability = await this.availability(true);
    const studentCount = await this.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM public."Student" WHERE status = 'In'`,
    );

    return {
      available: availability.ready,
      checkedAt: new Date().toISOString(),
      ready: availability.ready,
      missing: availability.missing,
      objects: {
        attendanceLogs: availability.tables.has(OBJ.logs),
        inOutView: availability.tables.has(OBJ.inOut),
        insideView: availability.tables.has(OBJ.inside),
        outsideView: availability.tables.has(OBJ.outside),
        dailyView: availability.tables.has(OBJ.daily),
        curfewView: availability.tables.has(OBJ.curfew),
        deviceRegistry: availability.tables.has(OBJ.devices),
        syncState: availability.tables.has(OBJ.sync),
      },
      totalStudents: Number(studentCount.rows[0]?.total) || 0,
      message: availability.ready
        ? 'Biometric attendance data source is connected.'
        : this.unavailableMessage(availability),
    };
  }

  async getDashboard() {
    const availability = await this.availability();
    const date = this.today();

    const studentCount = await this.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM public."Student" WHERE status = 'In'`,
    );
    const totalStudents = Number(studentCount.rows[0]?.total) || 0;

    let movements = { total: 0, inCount: 0, outCount: 0, activeStudents: 0 };
    if (availability.tables.has(OBJ.logs)) {
      const movement = await this.query<any>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE punch_state_code IN (0, 3, 255) OR punch_state = 'Check-In')::int AS in_count,
                COUNT(*) FILTER (WHERE punch_state_code IN (1, 2) OR punch_state = 'Check-Out')::int AS out_count,
                COUNT(DISTINCT user_id)::int AS active_students
         FROM public.biometric_attendance_logs
         WHERE punch_time::date = $1::date`,
        [date],
      );
      const row = movement.rows[0];
      if (row) {
        movements = {
          total: Number(row.total) || 0,
          inCount: Number(row.in_count) || 0,
          outCount: Number(row.out_count) || 0,
          activeStudents: Number(row.active_students) || 0,
        };
      }
    } else if (availability.tables.has(OBJ.daily)) {
      const movement = await this.query<any>(
        `SELECT COALESCE(SUM(total_punches), 0)::int AS total,
                COALESCE(SUM(total_in_punches), 0)::int AS in_count,
                COALESCE(SUM(total_out_punches), 0)::int AS out_count,
                COUNT(*)::int AS active_students
         FROM public.view_student_daily_attendance_summary
         WHERE attendance_date = $1::date`,
        [date],
      );
      const row = movement.rows[0];
      if (row) {
        movements = {
          total: Number(row.total) || 0,
          inCount: Number(row.in_count) || 0,
          outCount: Number(row.out_count) || 0,
          activeStudents: Number(row.active_students) || 0,
        };
      }
    }

    const outsideCount = availability.tables.has(OBJ.outside)
      ? Number((await this.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM public.view_student_currently_outside`)).rows[0]?.total) || 0
      : 0;

    // In a hostel, active students reside inside by default.
    // They are inside unless their latest movement is an exit (OUT) without return.
    const insideCount = availability.tables.has(OBJ.inside)
      ? Number((await this.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM public.view_student_currently_inside`)).rows[0]?.total) || Math.max(0, totalStudents - outsideCount)
      : Math.max(0, totalStudents - outsideCount);

    let lateEntries = 0;
    if (availability.tables.has(OBJ.curfew)) {
      lateEntries = Number(
        (
          await this.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total FROM public.view_student_curfew_violations WHERE violation_date = $1::date`,
            [date],
          )
        ).rows[0]?.total,
      ) || 0;
    } else if (availability.tables.has(OBJ.logs)) {
      lateEntries = Number(
        (
          await this.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total
             FROM public.biometric_attendance_logs
             WHERE punch_time::date = $1::date
               AND (punch_state_code IN (0, 3, 255) OR punch_state = 'Check-In')
               AND punch_time::time > TIME '20:30:00'`,
            [date],
          )
        ).rows[0]?.total,
      ) || 0;
    }

    const recent = await this.fetchPunches({ date, page: 1, limit: 12 });
    const presentToday = insideCount;
    const absentToday = outsideCount;
    const attendanceRate = totalStudents ? Math.round((insideCount / totalStudents) * 1000) / 10 : 0;

    let weeklyTrend: Array<{ date: string; present: number; punches: number }> = [];
    if (availability.tables.has(OBJ.logs)) {
      const trend = await this.query<any>(
        `SELECT TO_CHAR(punch_time::date, 'YYYY-MM-DD') AS date,
                COUNT(DISTINCT user_id)::int AS present,
                COUNT(*)::int AS punches
         FROM public.biometric_attendance_logs
         WHERE punch_time::date BETWEEN (CURRENT_DATE - INTERVAL '6 days') AND CURRENT_DATE
         GROUP BY punch_time::date
         ORDER BY punch_time::date ASC`,
      );
      weeklyTrend = trend.rows.map((row) => ({
        date: row.date,
        present: Number(row.present) || 0,
        punches: Number(row.punches) || 0,
      }));
    }

    const devices = await this.getDevices();

    return this.envelope(
      availability,
      {
        stats: {
          totalStudents,
          presentToday,
          absentToday,
          inside: insideCount,
          outside: outsideCount,
          punchesToday: movements.total,
          inToday: movements.inCount,
          outToday: movements.outCount,
          lateEntries,
          attendanceRate: totalStudents ? Math.round((presentToday / totalStudents) * 1000) / 10 : 0,
        },
        recentPunches: recent.rows,
        weeklyTrend,
        deviceSummary: devices.summary,
        date,
      },
      recent.error,
    );
  }

  // ---------------------------------------------------------------------------
  // Live punch monitor
  // ---------------------------------------------------------------------------

  async getPunchLogs(query: PageQuery & { date?: string; fromDate?: string; toDate?: string; direction?: string }) {
    const availability = await this.availability();
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const result = await this.fetchPunches({ ...query, page, limit });
    return this.envelope(
      availability,
      {
        data: result.rows,
        summary: result.summary,
        pagination: this.pagination(page, limit, result.total),
      },
      result.error,
    );
  }

  async getCurrentlyOutside(
    query: PageQuery & { minHours?: number; fromDate?: string; toDate?: string },
  ) {
    const availability = await this.availability();
    if (!availability.tables.has(OBJ.outside)) {
      return this.envelope(availability, { data: [], summary: { total: 0, over4Hours: 0 }, pagination: this.pagination(1, this.limit(query.limit), 0) });
    }

    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const offset = (page - 1) * limit;
    const search = String(query.search || '').trim();
    const minHours = Number(query.minHours) > 0 ? Number(query.minHours) : 0;
    const fromDate = String(query.fromDate || '').trim();
    const toDate = String(query.toDate || '').trim();
    const params: unknown[] = [];
    const where: string[] = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(COALESCE(reg_no, '') ILIKE $1 OR COALESCE(student_name, '') ILIKE $1 OR COALESCE(room_no, '') ILIKE $1 OR COALESCE(student_mobile, '') ILIKE $1 OR COALESCE(father_mobile, '') ILIKE $1)`);
    }
    if (minHours > 0) {
      params.push(minHours);
      where.push(`hours_outside >= $${params.length}`);
    }
    if (fromDate) {
      params.push(fromDate);
      where.push(`out_time::date >= $${params.length}::date`);
    }
    if (toDate) {
      params.push(toDate);
      where.push(`out_time::date <= $${params.length}::date`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const count = await this.query<{ total: number; over4: number; avg_hours: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE hours_outside > 4)::int AS over4,
              COALESCE(ROUND(AVG(hours_outside)::numeric, 1), 0)::float8 AS avg_hours
       FROM public.view_student_currently_outside ${whereSql}`,
      params,
    );
    const data = await this.query<any>(
      `SELECT reg_no, student_name, room_no, bed_no, out_time_formatted,
              COALESCE(hours_outside, 0)::float8 AS hours_outside,
              student_mobile, father_name, father_mobile, out_time,
              COALESCE(hours_outside, 0) || ' hrs' AS time_away
       FROM public.view_student_currently_outside
       ${whereSql}
       ORDER BY out_time DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return this.envelope(
      availability,
      {
        data: data.rows,
        summary: {
          total: Number(count.rows[0]?.total) || 0,
          over4Hours: Number(count.rows[0]?.over4) || 0,
          avgHours: Number(count.rows[0]?.avg_hours) || 0,
        },
        pagination: this.pagination(page, limit, Number(count.rows[0]?.total) || 0),
      },
      data.error || count.error,
    );
  }

  // ---------------------------------------------------------------------------
  // Daily attendance
  // ---------------------------------------------------------------------------

  async getDailyAttendance(
    query: PageQuery & { date?: string; fromDate?: string; toDate?: string; status?: string },
  ) {
    const availability = await this.availability();
    const fromDate = query.fromDate || query.date || this.today();
    const toDate = query.toDate || query.date || fromDate;
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const offset = (page - 1) * limit;
    const search = String(query.search || '').trim();
    const status = String(query.status || '').trim();

    const studentCount = await this.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM public."Student" WHERE status = 'In'`,
    );
    const totalStudents = Number(studentCount.rows[0]?.total) || 0;

    const params: unknown[] = [fromDate, toDate];
    const filterClauses: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      filterClauses.push(
        `(COALESCE(s."regNo", '') ILIKE $${params.length} OR COALESCE(s.name, '') ILIKE $${params.length} OR COALESCE(s."roomNo", '') ILIKE $${params.length} OR COALESCE(s."manualRegsiName", '') ILIKE $${params.length} OR COALESCE(s."biometricId", '') ILIKE $${params.length})`,
      );
    }

    let statusWhere = '';
    if (status && status.toUpperCase() !== 'ALL') {
      const st = status.toUpperCase();
      if (st === 'OUTSIDE' || st === 'ABSENT') {
        statusWhere = `AND (lgp.punch_state_code IN (1, 2) OR lgp.punch_state = 'Check-Out')`;
      } else if (st === 'MOVED') {
        statusWhere = `AND COALESCE(dp.total_punches, 0) > 0`;
      } else if (st.includes('HOSTEL') || st === 'PRESENT') {
        statusWhere = `AND (lgp.user_id IS NULL OR (lgp.punch_state_code NOT IN (1, 2) AND COALESCE(lgp.punch_state, '') != 'Check-Out'))`;
      }
    }

    const whereSearch = filterClauses.length ? `AND ${filterClauses.join(' AND ')}` : '';

    const baseCTE = `
      WITH day_punches AS (
        SELECT 
          b.user_id,
          MIN(b.punch_time) AS first_punch,
          MAX(b.punch_time) AS last_punch,
          MIN(CASE WHEN b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In' THEN b.punch_time END) AS first_in,
          MAX(CASE WHEN b.punch_state_code IN (1, 2) OR b.punch_state = 'Check-Out' THEN b.punch_time END) AS last_out,
          COUNT(*)::int AS total_punches,
          COUNT(*) FILTER (WHERE b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In')::int AS in_count,
          COUNT(*) FILTER (WHERE b.punch_state_code IN (1, 2) OR b.punch_state = 'Check-Out')::int AS out_count
        FROM public.biometric_attendance_logs b
        WHERE b.punch_time::date BETWEEN CAST($1 AS date) AND CAST($2 AS date)
        GROUP BY b.user_id
      ),
      latest_global_punches AS (
        SELECT DISTINCT ON (b.user_id) b.user_id, b.punch_state_code, b.punch_state, b.punch_time
        FROM public.biometric_attendance_logs b
        WHERE b.punch_time <= (CAST($2 AS date) + INTERVAL '1 day')
        ORDER BY b.user_id, b.punch_time DESC
      )
    `;

    const aggSql = `
      ${baseCTE}
      SELECT 
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE lgp.punch_state_code IN (1, 2) OR lgp.punch_state = 'Check-Out')::int AS outside_count,
        COUNT(*) FILTER (WHERE lgp.user_id IS NULL OR (lgp.punch_state_code NOT IN (1, 2) AND COALESCE(lgp.punch_state, '') != 'Check-Out'))::int AS inside_count,
        COALESCE(SUM(dp.total_punches), 0)::int AS total_punches,
        COUNT(*) FILTER (WHERE COALESCE(dp.total_punches, 0) > 0)::int AS moved_count
      FROM public."Student" s
      LEFT JOIN day_punches dp 
        ON (s."regNo" = dp.user_id OR s."manualRegsiName" = dp.user_id OR s."biometricId" = dp.user_id)
      LEFT JOIN latest_global_punches lgp 
        ON (s."regNo" = lgp.user_id OR s."manualRegsiName" = lgp.user_id OR s."biometricId" = lgp.user_id)
      WHERE s.status = 'In'
        ${whereSearch}
        ${statusWhere}
    `;

    const aggregate = await this.query<any>(aggSql, params);
    const aggRow = aggregate.rows[0] || {};
    const outsideCount = Number(aggRow.outside_count) || 0;
    const insideCount = Number(aggRow.inside_count) || Math.max(0, totalStudents - outsideCount);
    const totalPunches = Number(aggRow.total_punches) || 0;
    const totalRows = Number(aggRow.total_rows) || 0;

    const summary = {
      totalStudents,
      present: insideCount, // Inside hostel = Present
      absent: outsideCount, // Currently outside = Absent / Away
      totalPunches,
      attendanceRate: totalStudents ? Math.round((insideCount / totalStudents) * 1000) / 10 : 0,
      movedToday: Number(aggRow.moved_count) || 0,
    };

    const dataSql = `
      ${baseCTE}
      SELECT 
        CAST($1 AS text) AS attendance_date,
        s."regNo" AS reg_no,
        s.name AS student_name,
        s."roomNo" AS room_no,
        s."bedNo" AS bed_no,
        TO_CHAR(dp.first_in, 'HH12:MI:SS AM') AS first_in_time,
        TO_CHAR(dp.last_out, 'HH12:MI:SS AM') AS last_out_time,
        COALESCE(dp.total_punches, 0)::int AS total_punches,
        COALESCE(dp.in_count, 0)::int AS in_count,
        COALESCE(dp.out_count, 0)::int AS out_count,
        ROUND(COALESCE(EXTRACT(EPOCH FROM (dp.last_punch - dp.first_punch)) / 3600, 0)::numeric, 1)::float8 AS span_hours,
        CASE 
          WHEN lgp.punch_state_code IN (1, 2) OR lgp.punch_state = 'Check-Out' THEN 'Outside'
          WHEN COALESCE(dp.total_punches, 0) > 0 THEN 'In Hostel (Returned)'
          ELSE 'In Hostel'
        END AS attendance_status
      FROM public."Student" s
      LEFT JOIN day_punches dp 
        ON (s."regNo" = dp.user_id OR s."manualRegsiName" = dp.user_id OR s."biometricId" = dp.user_id)
      LEFT JOIN latest_global_punches lgp 
        ON (s."regNo" = lgp.user_id OR s."manualRegsiName" = lgp.user_id OR s."biometricId" = lgp.user_id)
      WHERE s.status = 'In'
        ${whereSearch}
        ${statusWhere}
      ORDER BY 
        CASE WHEN (lgp.punch_state_code IN (1, 2) OR lgp.punch_state = 'Check-Out') THEN 0 ELSE 1 END,
        COALESCE(dp.total_punches, 0) DESC,
        s."roomNo" ASC NULLS LAST,
        s.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = await this.query<any>(dataSql, params);

    return this.envelope(
      availability,
      {
        data: data.rows,
        summary,
        pagination: this.pagination(page, limit, totalRows),
        date: fromDate,
        fromDate,
        toDate,
      },
      data.error || aggregate.error,
    );
  }

  // ---------------------------------------------------------------------------
  // Device enrolled users
  // ---------------------------------------------------------------------------

  private async logsColumns(): Promise<Set<string>> {
    if (this.logsColumnsCache && Date.now() - this.logsColumnsCache.at < 60_000) {
      return this.logsColumnsCache.value;
    }

    const result = await this.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [OBJ.logs],
    );
    const value = new Set(result.rows.map((row) => row.column_name));
    this.logsColumnsCache = { at: Date.now(), value };
    return value;
  }

  /**
   * Distinct device/user pairs observed in the attendance log, enriched with
   * the matched student. Enrollment details that the terminal never pushes
   * (card number, enrolled templates) stay null unless the log table stores
   * them, so the UI can render them as "—" instead of inventing values.
   */
  async getDeviceUsers(query: PageQuery & { fromDate?: string; toDate?: string }) {
    const availability = await this.availability();
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const offset = (page - 1) * limit;
    const search = String(query.search || '').trim();
    const fromDate = String(query.fromDate || '').trim();
    const toDate = String(query.toDate || '').trim();
    const params: unknown[] = [];
    const where: string[] = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        device_user_id ILIKE $${params.length}
        OR COALESCE(device_id, '') ILIKE $${params.length}
        OR COALESCE(name_on_device, '') ILIKE $${params.length}
        OR COALESCE(student_name, '') ILIKE $${params.length}
        OR COALESCE(reg_no, '') ILIKE $${params.length}
        OR COALESCE(room_no, '') ILIKE $${params.length}
        OR COALESCE(card_no, '') ILIKE $${params.length}
      )`);
    }
    if (fromDate) {
      params.push(fromDate);
      where.push(`last_synced::date >= $${params.length}::date`);
    }
    if (toDate) {
      params.push(toDate);
      where.push(`last_synced::date <= $${params.length}::date`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const emptySummary = {
      totalUsers: 0,
      matched: 0,
      unmatched: 0,
      faceEnrolled: 0,
      fingerprintEnrolled: 0,
    };

    if (!availability.tables.has(OBJ.logs)) {
      return this.envelope(availability, {
        data: [],
        summary: emptySummary,
        pagination: this.pagination(page, limit, 0),
      });
    }

    const columns = await this.logsColumns();
    const nameColumn = ['user_name', 'name', 'person_name', 'employee_name'].find((name) =>
      columns.has(name),
    );
    const cardColumn = ['card_no', 'card_number', 'cardno'].find((name) => columns.has(name));
    const nameExpr = nameColumn ? `MAX(b.${nameColumn}::text)` : 'NULL::text';
    const cardExpr = cardColumn ? `MAX(b.${cardColumn}::text)` : 'NULL::text';
    const verifyText = columns.has('verify_type')
      ? `LOWER(COALESCE(b.verify_type::text, ''))`
      : `''`;
    const syncExpr = columns.has('synced_at')
      ? 'b.synced_at'
      : columns.has('created_at')
        ? 'b.created_at'
        : 'b.punch_time';

    const cte = `
      WITH users AS (
        SELECT
          b.device_id::text AS device_id,
          b.user_id::text AS device_user_id,
          MAX(${syncExpr}) AS last_synced,
          BOOL_OR(${verifyText} IN ('15', '20', 'face', 'face+fp') OR ${verifyText} LIKE '%face%') AS face_enrolled,
          BOOL_OR(
            ${verifyText} IN ('1', '20', 'fp', 'finger', 'fingerprint', 'face+fp')
            OR ${verifyText} LIKE '%finger%'
            OR ${verifyText} LIKE '%fp%'
          ) AS fingerprint_enrolled,
          ${cardExpr} AS card_no,
          ${nameExpr} AS name_on_device
        FROM public.biometric_attendance_logs b
        GROUP BY b.device_id, b.user_id
      ),
      joined AS (
        SELECT
          u.device_id,
          u.device_user_id,
          COALESCE(u.name_on_device, s.name) AS name_on_device,
          (s.id IS NOT NULL) AS matched,
          s.name AS student_name,
          s."regNo" AS reg_no,
          s."roomNo" AS room_no,
          s."bedNo" AS bed_no,
          u.face_enrolled,
          u.fingerprint_enrolled,
          u.card_no,
          u.last_synced
        FROM users u
        LEFT JOIN public."Student" s
          ON (s."biometricId" = u.device_user_id
              OR s."regNo" = u.device_user_id
              OR s."manualRegsiName" = u.device_user_id)
      )
    `;

    const summaryResult = await this.query<any>(
      `${cte}
       SELECT COUNT(*)::int AS total_users,
              COUNT(*) FILTER (WHERE matched)::int AS matched,
              COUNT(*) FILTER (WHERE NOT matched)::int AS unmatched,
              COUNT(*) FILTER (WHERE face_enrolled)::int AS face_enrolled,
              COUNT(*) FILTER (WHERE fingerprint_enrolled)::int AS fingerprint_enrolled
       FROM joined ${whereSql}`,
      params,
    );

    const dataResult = await this.query<any>(
      `${cte}
       SELECT device_id, device_user_id, name_on_device, matched, student_name,
              reg_no, room_no, bed_no, face_enrolled, fingerprint_enrolled, card_no, last_synced
       FROM joined ${whereSql}
       ORDER BY matched DESC, student_name ASC NULLS LAST, device_user_id ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const summaryRow = summaryResult.rows[0] || {};
    const total = Number(summaryRow.total_users) || 0;

    return this.envelope(
      availability,
      {
        data: dataResult.rows,
        summary: {
          totalUsers: total,
          matched: Number(summaryRow.matched) || 0,
          unmatched: Number(summaryRow.unmatched) || 0,
          faceEnrolled: Number(summaryRow.face_enrolled) || 0,
          fingerprintEnrolled: Number(summaryRow.fingerprint_enrolled) || 0,
        },
        pagination: this.pagination(page, limit, total),
      },
      summaryResult.error || dataResult.error,
    );
  }

  // ---------------------------------------------------------------------------
  // Devices / sync health
  // ---------------------------------------------------------------------------

  async getDevices() {
    const availability = await this.availability();
    const registry = availability.tables.has(OBJ.devices)
      ? await this.query<any>(
          `SELECT device_id, device_name, ip_address, is_online, serial_number, firmware_version,
                  face_version, platform, total_records_on_device::int AS punches_in_ram,
                  last_online_at, updated_at
           FROM public.biometric_device_registry
           ORDER BY device_name ASC`,
        )
      : { rows: [] as any[] };

    const sync = availability.tables.has(OBJ.sync)
      ? await this.query<any>(
          `SELECT device_id, device_ip, last_synced_timestamp, last_synced_uid,
                  total_synced_records::int AS total_synced_records,
                  records_in_last_batch::int AS records_in_last_batch,
                  last_sync_status, last_successful_sync, last_error_message, updated_at
           FROM public.biometric_sync_state`,
        )
      : { rows: [] as any[] };

    const syncByDevice = new Map<string, any>();
    for (const row of sync.rows) syncByDevice.set(String(row.device_id), row);

    const data: any[] = registry.rows.map((row) => {
      const state = syncByDevice.get(String(row.device_id)) || {};
      syncByDevice.delete(String(row.device_id));
      return {
        device_id: row.device_id,
        device_name: row.device_name,
        ip_address: row.ip_address || state.device_ip || null,
        is_online: Boolean(row.is_online),
        serial_number: row.serial_number,
        firmware_version: row.firmware_version,
        face_version: row.face_version,
        platform: row.platform,
        punches_in_ram: Number(row.punches_in_ram) || 0,
        last_online_at: row.last_online_at,
        updated_at: row.updated_at,
        last_synced_timestamp: state.last_synced_timestamp || null,
        last_synced_uid: state.last_synced_uid || null,
        total_synced_records: Number(state.total_synced_records) || 0,
        records_in_last_batch: Number(state.records_in_last_batch) || 0,
        last_sync_status: state.last_sync_status || null,
        last_successful_sync: state.last_successful_sync || null,
        last_error_message: state.last_error_message || null,
      };
    });

    for (const state of syncByDevice.values()) {
      data.push({
        device_id: state.device_id,
        device_name: state.device_id,
        ip_address: state.device_ip || null,
        is_online: false,
        serial_number: null,
        firmware_version: null,
        face_version: null,
        platform: null,
        punches_in_ram: Number(state.total_synced_records) || 0,
        last_online_at: null,
        updated_at: state.updated_at,
        last_synced_timestamp: state.last_synced_timestamp || null,
        last_synced_uid: state.last_synced_uid || null,
        total_synced_records: Number(state.total_synced_records) || 0,
        records_in_last_batch: Number(state.records_in_last_batch) || 0,
        last_sync_status: state.last_sync_status || null,
        last_successful_sync: state.last_successful_sync || null,
        last_error_message: state.last_error_message || null,
      });
    }

    const summary = {
      total: data.length,
      online: data.filter((device) => device.is_online).length,
      offline: data.filter((device) => !device.is_online).length,
      totalRecords: data.reduce((sum, device) => sum + device.punches_in_ram, 0),
      syncErrors: data.filter((device) => Boolean(device.last_error_message)).length,
      lastSuccessfulSync: data
        .map((device) => device.last_successful_sync)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null,
    };

    const available = availability.tables.has(OBJ.devices) || availability.tables.has(OBJ.sync);
    return {
      available,
      message: available
        ? registry.error || sync.error || null
        : this.unavailableMessage(availability, 'Device & sync status'),
      generatedAt: new Date().toISOString(),
      data,
      summary,
    };
  }
}
