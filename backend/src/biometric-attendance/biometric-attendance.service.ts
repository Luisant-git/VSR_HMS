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
          `(COALESCE(reg_no, '') ILIKE ${term} OR COALESCE(student_name, '') ILIKE ${term} OR COALESCE(room_no, '') ILIKE ${term} OR COALESCE(device_name, '') ILIKE ${term})`,
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
                movement_direction AS direction,
                reg_no,
                student_name,
                room_no,
                bed_no,
                student_mobile,
                verify_type AS verified_by,
                device_name AS gate_name
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

    const insideCount = availability.tables.has(OBJ.inside)
      ? Number((await this.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM public.view_student_currently_inside`)).rows[0]?.total) || 0
      : 0;
    const outsideCount = availability.tables.has(OBJ.outside)
      ? Number((await this.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM public.view_student_currently_outside`)).rows[0]?.total) || 0
      : 0;

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
    const presentToday = Math.min(totalStudents, movements.activeStudents);
    const absentToday = Math.max(0, totalStudents - presentToday);

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

    let rows: any[] = [];
    let total = 0;
    let summary = {
      totalStudents,
      present: 0,
      absent: totalStudents,
      totalPunches: 0,
      attendanceRate: 0,
    };
    let error: string | undefined;

    if (availability.tables.has(OBJ.daily)) {
      const params: unknown[] = [fromDate, toDate];
      const where: string[] = [`attendance_date BETWEEN $1::date AND $2::date`];
      if (search) {
        params.push(`%${search}%`);
        where.push(`(COALESCE(reg_no, '') ILIKE $${params.length} OR COALESCE(student_name, '') ILIKE $${params.length} OR COALESCE(room_no, '') ILIKE $${params.length})`);
      }
      if (status && status.toUpperCase() !== 'ALL') {
        params.push(status);
        where.push(`attendance_status ILIKE $${params.length}`);
      }
      const whereSql = `WHERE ${where.join(' AND ')}`;
      const aggregate = await this.query<any>(
        `SELECT COUNT(*)::int AS total_rows,
                COUNT(DISTINCT reg_no) FILTER (WHERE attendance_status NOT ILIKE '%absent%')::int AS present_students,
                COUNT(*) FILTER (WHERE attendance_status ILIKE '%absent%')::int AS absent_rows,
                COALESCE(SUM(total_punches), 0)::int AS total_punches
         FROM public.view_student_daily_attendance_summary ${whereSql}`,
        params,
      );
      const aggregateRow = aggregate.rows[0] || {};
      const present = Math.min(totalStudents, Number(aggregateRow.present_students) || 0);
      summary = {
        totalStudents,
        present,
        absent: Math.max(0, totalStudents - present),
        totalPunches: Number(aggregateRow.total_punches) || 0,
        attendanceRate: totalStudents ? Math.round((present / totalStudents) * 1000) / 10 : 0,
      };
      const data = await this.query<any>(
        `SELECT attendance_date::text AS attendance_date,
                reg_no, student_name, room_no, bed_no,
                first_punch_formatted AS first_in_time,
                last_punch_formatted AS last_out_time,
                total_punches::int AS total_punches,
                total_in_punches::int AS in_count,
                total_out_punches::int AS out_count,
                COALESCE(span_hours, 0)::float8 AS span_hours,
                attendance_status
         FROM public.view_student_daily_attendance_summary
         ${whereSql}
         ORDER BY attendance_date ASC, room_no ASC NULLS LAST, student_name ASC
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      );
      rows = data.rows;
      total = Number(aggregateRow.total_rows) || 0;
      error = data.error || aggregate.error;
    } else if (availability.tables.has(OBJ.logs)) {
      const params: unknown[] = [fromDate, toDate];
      const where: string[] = [`b.punch_time::date BETWEEN $1::date AND $2::date`];
      if (search) {
        params.push(`%${search}%`);
        where.push(`(COALESCE(s."regNo", b.user_id) ILIKE $${params.length} OR COALESCE(s.name, '') ILIKE $${params.length} OR COALESCE(s."roomNo", '') ILIKE $${params.length})`);
      }
      const whereSql = `WHERE ${where.join(' AND ')}`;
      const aggregate = await this.query<any>(
        `SELECT COUNT(DISTINCT b.user_id)::int AS present,
                COUNT(*)::int AS total_punches,
                COUNT(DISTINCT (COALESCE(s."regNo", b.user_id), b.punch_time::date))::int AS total_rows
         FROM public.biometric_attendance_logs b
         LEFT JOIN public."Student" s ON (s."biometricId" = b.user_id OR s."regNo" = b.user_id OR s."manualRegsiName" = b.user_id)
         ${whereSql}`,
        params,
      );
      const aggregateRow = aggregate.rows[0] || {};
      const present = Math.min(totalStudents, Number(aggregateRow.present) || 0);
      summary = {
        totalStudents,
        present,
        absent: Math.max(0, totalStudents - present),
        totalPunches: Number(aggregateRow.total_punches) || 0,
        attendanceRate: totalStudents ? Math.round((present / totalStudents) * 1000) / 10 : 0,
      };

      const dataParams = [...params];
      let statusSql = '';
      if (status && status.toUpperCase() !== 'ALL') {
        dataParams.push(status);
        statusSql = ` AND (CASE WHEN COUNT(*) FILTER (WHERE b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In') > 0 THEN 'Present' ELSE 'Absent' END) ILIKE $${dataParams.length}`;
      }
      const data = await this.query<any>(
        `SELECT TO_CHAR(b.punch_time::date, 'YYYY-MM-DD') AS attendance_date,
                COALESCE(s."regNo", b.user_id) AS reg_no,
                COALESCE(s.name, 'Unregistered') AS student_name,
                s."roomNo" AS room_no,
                s."bedNo" AS bed_no,
                TO_CHAR(MIN(b.punch_time) FILTER (WHERE b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In'), 'HH12:MI:SS AM') AS first_in_time,
                TO_CHAR(MAX(b.punch_time) FILTER (WHERE b.punch_state_code IN (1, 2) OR b.punch_state = 'Check-Out'), 'HH12:MI:SS AM') AS last_out_time,
                COUNT(*)::int AS total_punches,
                COUNT(*) FILTER (WHERE b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In')::int AS in_count,
                COUNT(*) FILTER (WHERE b.punch_state_code IN (1, 2) OR b.punch_state = 'Check-Out')::int AS out_count,
                ROUND(COALESCE(EXTRACT(EPOCH FROM (MAX(b.punch_time) - MIN(b.punch_time))) / 3600, 0)::numeric, 1)::float8 AS span_hours,
                CASE WHEN COUNT(*) FILTER (WHERE b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In') > 0 THEN 'Present' ELSE 'Absent' END AS attendance_status
         FROM public.biometric_attendance_logs b
         LEFT JOIN public."Student" s ON (s."biometricId" = b.user_id OR s."regNo" = b.user_id OR s."manualRegsiName" = b.user_id)
         ${whereSql}
         GROUP BY s.id, s."regNo", b.user_id, s.name, s."roomNo", s."bedNo", b.punch_time::date
         HAVING TRUE ${statusSql}
         ORDER BY b.punch_time::date ASC, s."roomNo" ASC NULLS LAST, s.name ASC
         LIMIT ${limit} OFFSET ${offset}`,
        dataParams,
      );
      rows = data.rows;
      total = Number(aggregateRow.total_rows) || 0;
      error = data.error || aggregate.error;
    } else {
      return this.envelope(availability, {
        data: [],
        summary,
        pagination: this.pagination(page, limit, 0),
        date: fromDate,
        fromDate,
        toDate,
      });
    }

    return this.envelope(
      availability,
      {
        data: rows,
        summary,
        pagination: this.pagination(page, limit, total),
        date: fromDate,
        fromDate,
        toDate,
      },
      error,
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
