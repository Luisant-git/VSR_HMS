-- ============================================================================
-- VSR-HMS BIOMETRIC ATTENDANCE & STUDENT IN/OUT COMPREHENSIVE REPORT QUERIES
-- Database: VSR-HMS (PostgreSQL)
-- Hardware: eSSL X2008 Face Recognition Terminal
-- ============================================================================
-- Table of Contents:
--   1. Real-Time In/Out Movements & Live Gate Stream
--   2. Hostel Security & Safety Live Boards (Currently Outside / Inside)
--   3. Day-Wise Student Attendance Summaries (First-In, Last-Out)
--   4. Daily Absentee Reports for Wardens & Roll Call
--   5. Curfew & Late Night Entry Violations
--   6. Room-Wise & Floor-Wise Attendance Reports
--   7. Date-Range & Monthly Student Attendance Analytics
--   8. Individual Student Punch History & Audit Trail
--   9. Hardware Telemetry & Biometric Sync Health
-- ============================================================================


-- ============================================================================
-- SECTION 1: REAL-TIME IN/OUT MOVEMENTS & LIVE GATE STREAM
-- ============================================================================

-- Query 1.1: Live Stream of All Student Movements Today (Newest First)
-- Shows every face/card punch today with formatted time, direction, and room details.
SELECT 
    punch_time_formatted AS time_of_punch,
    movement_direction   AS direction,
    user_pin,
    reg_no,
    student_name,
    room_no,
    bed_no,
    verify_type          AS verified_by,
    device_name          AS gate_name,
    device_id,
    student_mobile
FROM public.view_student_in_out_logs
WHERE punch_date = CURRENT_DATE
ORDER BY punch_time DESC;


-- Query 1.2: Filter Punches by Specific Date
-- (Change '2026-11-13' to any desired date)
SELECT 
    punch_time_formatted AS time_of_punch,
    movement_direction   AS direction,
    user_pin,
    reg_no,
    student_name,
    room_no,
    verify_type          AS verified_by,
    device_name          AS gate_name,
    device_id
FROM public.view_student_in_out_logs
WHERE punch_date = '2026-11-13'
ORDER BY punch_time DESC;


-- Query 1.3: Today's Movement Count Summary
-- Total IN punches, OUT punches, and distinct students active today.
-- NOTE: Handles eSSL terminal codes: IN = 0, 3, 255 (default check-in); OUT = 1, 2
SELECT 
    CURRENT_DATE AS report_date,
    COUNT(*) AS total_punches_today,
    COUNT(CASE WHEN punch_state_code IN (0, 3, 255) THEN 1 END) AS total_in_movements,
    COUNT(CASE WHEN punch_state_code IN (1, 2) THEN 1 END) AS total_out_movements,
    COUNT(DISTINCT user_id) AS distinct_students_active
FROM public.biometric_attendance_logs
WHERE punch_time::date = CURRENT_DATE;



-- ============================================================================
-- SECTION 2: HOSTEL SECURITY & SAFETY LIVE BOARDS
-- ============================================================================

-- Query 2.1: CRITICAL LIVE BOARD: Which Students Are Currently OUTSIDE Right Now?
-- Lists students whose latest punch was an OUT exit, including how long they have been away.
SELECT 
    reg_no,
    student_name,
    room_no,
    bed_no,
    out_time_formatted,
    hours_outside || ' hrs' AS time_away,
    student_mobile,
    father_mobile
FROM public.view_student_currently_outside
ORDER BY out_time DESC;


-- Query 2.2: Students Outside for More than 4 Hours (Extended Absence Alert)
SELECT 
    reg_no,
    student_name,
    room_no,
    out_time_formatted,
    hours_outside || ' hrs' AS duration_outside,
    student_mobile,
    father_mobile
FROM public.view_student_currently_outside
WHERE hours_outside > 4.0
ORDER BY hours_outside DESC;


-- Query 2.3: LIVE BOARD: Which Students Are Currently INSIDE the Hostel Right Now?
SELECT 
    reg_no,
    student_name,
    room_no,
    bed_no,
    in_time_formatted,
    student_mobile
FROM public.view_student_currently_inside
ORDER BY in_time DESC;



-- ============================================================================
-- SECTION 3: DAY-WISE STUDENT ATTENDANCE SUMMARIES (FIRST-IN, LAST-OUT)
-- ============================================================================

-- Query 3.1: Day-Wise Attendance Report for Today
-- Shows each student's first punch-in, last punch-out, and total time span.
SELECT 
    attendance_date,
    reg_no,
    student_name,
    room_no,
    bed_no,
    first_punch_formatted AS first_seen,
    last_punch_formatted  AS last_seen,
    total_punches,
    total_in_punches      AS in_count,
    total_out_punches     AS out_count,
    span_hours            AS total_span_hours,
    attendance_status     AS status
FROM public.view_student_daily_attendance_summary
WHERE attendance_date = CURRENT_DATE
ORDER BY room_no ASC, student_name ASC;


-- Query 3.2: Day-Wise Attendance for a Specific Date
-- (Change '2026-11-13' to any historical date)
SELECT 
    attendance_date,
    reg_no,
    student_name,
    room_no,
    first_punch_formatted AS first_seen,
    last_punch_formatted  AS last_seen,
    total_punches,
    span_hours,
    attendance_status
FROM public.view_student_daily_attendance_summary
WHERE attendance_date = '2026-11-13'
ORDER BY room_no ASC, student_name ASC;


-- Query 3.3: Daily Hostel-Wide Attendance Rollup & Statistics
-- Daily totals for total present, total absent, and overall present percentage.
WITH hostel_stats AS (
    SELECT 
        b.punch_time::date AS att_date,
        COUNT(DISTINCT b.user_id) AS present_count
    FROM public.biometric_attendance_logs b
    GROUP BY b.punch_time::date
),
student_pool AS (
    SELECT COUNT(*) AS total_students FROM public."Student" WHERE status = 'In'
)
SELECT 
    h.att_date AS attendance_date,
    p.total_students AS total_enrolled,
    h.present_count AS total_present,
    (p.total_students - h.present_count) AS total_absent,
    ROUND((h.present_count::numeric / NULLIF(p.total_students, 0)) * 100.0, 2) || '%' AS attendance_rate
FROM hostel_stats h
CROSS JOIN student_pool p
ORDER BY attendance_date DESC;



-- ============================================================================
-- SECTION 4: DAILY ABSENTEE REPORTS FOR WARDENS & ROLL CALL
-- ============================================================================

-- Query 4.1: Today's Absentee List (Students who have NOT punched today)
-- Perfect for daily morning/evening warden roll calls with parent phone numbers.
SELECT 
    check_date,
    reg_no,
    student_name,
    room_no,
    bed_no,
    student_mobile,
    father_name,
    father_mobile,
    attendance_status
FROM public.view_student_daily_absentee_report
ORDER BY room_no ASC, student_name ASC;


-- Query 4.2: Historical Absentee Report for a Specific Date
-- (Change '2026-11-13' to any desired date)
SELECT 
    '2026-11-13'::date AS report_date,
    s."regNo" AS reg_no,
    s.name AS student_name,
    s."roomNo" AS room_no,
    s."bedNo" AS bed_no,
    s."mobileNo" AS student_mobile,
    s."fatherName" AS father_name,
    s."fatherMobileNo" AS father_mobile,
    'ABSENT' AS attendance_status
FROM public."Student" s
WHERE s.status = 'In'
  AND NOT EXISTS (
      SELECT 1 
      FROM public.biometric_attendance_logs b 
      WHERE (b.user_id = s."biometricId" OR b.user_id = s."regNo" OR b.user_id = s."manualRegsiName")
        AND b.punch_time::date = '2026-11-13'::date
  )
ORDER BY s."roomNo" ASC, s.name ASC;



-- ============================================================================
-- SECTION 5: CURFEW & LATE NIGHT ENTRY VIOLATIONS
-- ============================================================================

-- Query 5.1: Students Entering After Curfew (After 08:30 PM / 20:30) Today
SELECT 
    violation_date,
    punch_time_formatted  AS entry_time,
    reg_no,
    student_name,
    room_no,
    minutes_past_curfew   AS mins_late,
    student_mobile,
    father_name,
    father_mobile
FROM public.view_student_curfew_violations
WHERE violation_date = CURRENT_DATE
ORDER BY punch_time DESC;


-- Query 5.2: Custom Curfew Report (e.g. Any entry after 09:00 PM / 21:00)
SELECT 
    b.punch_time::date AS date,
    TO_CHAR(b.punch_time, 'HH12:MI:SS AM') AS actual_in_time,
    COALESCE(s."regNo", b.user_id) AS reg_no,
    s.name AS student_name,
    s."roomNo" AS room_no,
    ROUND(EXTRACT(EPOCH FROM (b.punch_time::time - '21:00:00'::time)) / 60.0, 0) AS minutes_late,
    s."mobileNo" AS student_mobile,
    s."fatherMobileNo" AS father_mobile
FROM public.biometric_attendance_logs b
JOIN public."Student" s ON (s."biometricId" = b.user_id OR s."regNo" = b.user_id OR s."manualRegsiName" = b.user_id)
WHERE (b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In')
  AND b.punch_time::time > '21:00:00'::time
ORDER BY b.punch_time DESC;


-- Query 5.3: Frequent Curfew Violators (Last 30 Days)
-- Flags habitual offenders for disciplinary committee review.
SELECT 
    COALESCE(s."regNo", b.user_id) AS reg_no,
    s.name AS student_name,
    s."roomNo" AS room_no,
    COUNT(*) AS total_late_entries,
    ROUND(AVG(EXTRACT(EPOCH FROM (b.punch_time::time - '20:30:00'::time)) / 60.0), 0) AS avg_minutes_late,
    s."fatherMobileNo" AS father_mobile
FROM public.biometric_attendance_logs b
JOIN public."Student" s ON (s."biometricId" = b.user_id OR s."regNo" = b.user_id OR s."manualRegsiName" = b.user_id)
WHERE (b.punch_state_code IN (0, 3, 255) OR b.punch_state = 'Check-In')
  AND b.punch_time::time > '20:30:00'::time
  AND b.punch_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s."regNo", b.user_id, s.name, s."roomNo", s."fatherMobileNo"
HAVING COUNT(*) >= 2
ORDER BY total_late_entries DESC;



-- ============================================================================
-- SECTION 6: ROOM-WISE & FLOOR-WISE ATTENDANCE REPORTS
-- ============================================================================

-- Query 6.1: Room-Wise Daily Attendance Roll Call for Today
-- Shows room number, total allotted students, present count, and absent count.
SELECT 
    report_date,
    room_no,
    total_allotted_students,
    present_count,
    absent_count,
    CASE 
        WHEN absent_count = 0 THEN '100% Full Attendance'
        ELSE absent_count || ' Student(s) Missing'
    END AS room_status
FROM public.view_roomwise_daily_attendance
ORDER BY room_no ASC;


-- Query 6.2: Rooms with Missing / Absent Students Today Only
SELECT 
    room_no,
    total_allotted_students,
    present_count,
    absent_count
FROM public.view_roomwise_daily_attendance
WHERE absent_count > 0
ORDER BY absent_count DESC, room_no ASC;



-- ============================================================================
-- SECTION 7: DATE-RANGE & MONTHLY STUDENT ATTENDANCE ANALYTICS
-- ============================================================================

-- Query 7.1: Monthly Student Attendance Summary (e.g. Current Month)
SELECT 
    month_year,
    reg_no,
    student_name,
    room_no,
    days_present,
    total_punches,
    total_in_count,
    total_out_count
FROM public.view_student_monthly_attendance_summary
WHERE month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY days_present DESC, student_name ASC;


-- Query 7.2: Custom Date-Range Attendance Report (e.g. 2026-11-01 to 2026-11-30)
-- (Change dates to your desired range)
SELECT 
    COALESCE(s."regNo", b.user_id) AS reg_no,
    COALESCE(s.name, 'Unregistered') AS student_name,
    s."roomNo" AS room_no,
    COUNT(DISTINCT b.punch_time::date) AS days_attended,
    COUNT(*) AS total_punches,
    MIN(b.punch_time)::date AS first_active_date,
    MAX(b.punch_time)::date AS last_active_date
FROM public.biometric_attendance_logs b
LEFT JOIN public."Student" s ON (s."biometricId" = b.user_id OR s."regNo" = b.user_id OR s."manualRegsiName" = b.user_id)
WHERE b.punch_time::date BETWEEN '2026-11-01' AND '2026-11-30'
GROUP BY s."regNo", b.user_id, s.name, s."roomNo"
ORDER BY days_attended DESC, student_name ASC;


-- Query 7.3: Low Attendance Warning Report (Less than 15 Days Present in Month)
SELECT 
    month_year,
    reg_no,
    student_name,
    room_no,
    days_present,
    'LOW_ATTENDANCE' AS alert_level
FROM public.view_student_monthly_attendance_summary
WHERE month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  AND days_present < 15
ORDER BY days_present ASC;



-- ============================================================================
-- SECTION 8: INDIVIDUAL STUDENT PUNCH HISTORY & AUDIT TRAIL
-- ============================================================================

-- Query 8.1: Full Punch History for an Individual Student
-- (Replace '1' with the student's register number, manualRegsiName, or biometric ID)
SELECT 
    b.punch_time::date AS punch_date,
    TO_CHAR(b.punch_time, 'HH12:MI:SS AM') AS punch_time,
    CASE 
        WHEN b.punch_state_code IN (0, 3) THEN 'IN (Entry)'
        WHEN b.punch_state_code IN (1, 2) THEN 'OUT (Exit)'
        ELSE 'IN'
    END AS movement,
    b.verify_type AS method,
    b.device_id,
    COALESCE(d.device_name, b.device_id) AS terminal_name,
    b.synced_at
FROM public.biometric_attendance_logs b
LEFT JOIN public.biometric_device_registry d ON b.device_id = d.device_id
WHERE b.user_id = '1'
ORDER BY b.punch_time DESC;


-- Query 8.2: Daily In/Out Summary for an Individual Student
-- (Replace '1' with student register number)
SELECT 
    attendance_date,
    first_punch_formatted AS first_in,
    last_punch_formatted  AS last_out,
    total_punches,
    span_hours,
    attendance_status
FROM public.view_student_daily_attendance_summary
WHERE reg_no = '1'
ORDER BY attendance_date DESC;



-- ============================================================================
-- SECTION 9: HARDWARE TELEMETRY & BIOMETRIC SYNC HEALTH
-- ============================================================================

-- Query 9.1: Live Biometric Hardware Status (All eSSL Terminals)
-- Shows IP, Serial Number, Firmware, RAM punch count, and Online/Offline state.
SELECT 
    device_id,
    device_name,
    ip_address,
    is_online,
    serial_number,
    firmware_version,
    face_version,
    platform,
    total_records_on_device AS punches_in_ram,
    last_online_at,
    updated_at
FROM public.biometric_device_registry;


-- Query 9.2: Synchronization Checkpoint & Watermark Status
-- Verifies the last synced timestamp and batch progress.
SELECT 
    device_id,
    device_ip,
    last_synced_timestamp,
    last_synced_uid,
    total_synced_records,
    records_in_last_batch,
    last_sync_status,
    last_successful_sync,
    last_error_message,
    updated_at
FROM public.biometric_sync_state;
