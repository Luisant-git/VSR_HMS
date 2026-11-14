-- ============================================================================
-- VSR-HMS BIOMETRIC ATTENDANCE - DATABASE VIEWS & PERFORMANCE INDEXES
-- Compatible with: eSSL X2008 Face Recognition Terminal / ADMS Protocol
-- Supports: Check-In (0, 3, 255), Check-Out (1, 2)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_biometric_logs_punch_time 
    ON public.biometric_attendance_logs (punch_time DESC);

CREATE INDEX IF NOT EXISTS idx_biometric_logs_punch_date 
    ON public.biometric_attendance_logs (((punch_time)::date));

CREATE INDEX IF NOT EXISTS idx_student_biometric_id 
    ON public."Student" ("biometricId") 
    WHERE "biometricId" IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. View: Real-Time Student In/Out Movement Stream
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_student_in_out_logs AS
 SELECT b.id AS log_id,
    b.punch_time,
    b.punch_time::date AS punch_date,
    to_char(b.punch_time, 'HH12:MI:SS AM'::text) AS punch_time_formatted,
    CASE
        WHEN b.punch_state_code = ANY (ARRAY[0, 3, 255]) OR b.punch_state::text = 'Check-In'::text THEN 'IN'::text
        WHEN b.punch_state_code = ANY (ARRAY[1, 2]) OR b.punch_state::text = 'Check-Out'::text THEN 'OUT'::text
        ELSE 'IN'::text
    END AS movement_direction,
    b.punch_state,
    b.verify_type,
    s.id AS student_id,
    COALESCE(s."regNo", b.user_id::text) AS reg_no,
    COALESCE(s.name, ('Unregistered ('::text || b.user_id::text) || ')'::text) AS student_name,
    s."roomNo" AS room_no,
    s."bedNo" AS bed_no,
    s."mobileNo" AS student_mobile,
    s."fatherName" AS father_name,
    s."fatherMobileNo" AS father_mobile,
    b.device_id,
    COALESCE(d.device_name, b.device_id::text) AS device_name,
    b.device_uid,
    b.synced_at,
    b.user_id AS user_pin
   FROM public.biometric_attendance_logs b
     LEFT JOIN public."Student" s ON s."regNo" = b.user_id::text OR s."manualRegsiName" = b.user_id::text OR s."biometricId" = b.user_id::text
     LEFT JOIN public.biometric_device_registry d ON b.device_id::text = d.device_id::text
  ORDER BY b.punch_time DESC;

-- ----------------------------------------------------------------------------
-- 3. View: Students Currently INSIDE the Hostel
-- In a hostel, students reside inside by default. Students are inside unless
-- their latest punch is an exit (OUT) without a subsequent return (IN).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_student_currently_inside AS
 WITH latest_punches AS (
         SELECT DISTINCT ON (b.user_id) b.user_id,
            b.punch_time,
            b.punch_state_code,
            b.punch_state,
            b.device_id
           FROM public.biometric_attendance_logs b
          ORDER BY b.user_id, b.punch_time DESC
        )
 SELECT s.id AS student_id,
    s."regNo" AS reg_no,
    s.name AS student_name,
    s."roomNo" AS room_no,
    s."bedNo" AS bed_no,
    s."mobileNo" AS student_mobile,
    lp.punch_time AS in_time,
    lp.punch_time AS last_in_time,
    CASE
      WHEN lp.punch_time IS NOT NULL THEN to_char(lp.punch_time, 'YYYY-MM-DD HH12:MI:SS AM'::text)
      ELSE 'Resident in Hostel'::text
    END AS in_time_formatted,
    lp.device_id AS entry_device_id,
    'INSIDE'::text AS current_location
   FROM public."Student" s
     LEFT JOIN latest_punches lp ON s."regNo" = lp.user_id::text OR s."manualRegsiName" = lp.user_id::text OR s."biometricId" = lp.user_id::text
  WHERE s.status = 'In'::text
    AND (
      lp.user_id IS NULL
      OR lp.punch_state_code = ANY (ARRAY[0, 3, 255])
      OR lp.punch_state::text = 'Check-In'::text
    )
  ORDER BY lp.punch_time DESC NULLS LAST, s."roomNo" ASC NULLS LAST, s.name ASC;

-- ----------------------------------------------------------------------------
-- 4. View: Students Currently OUTSIDE the Hostel
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_student_currently_outside AS
 WITH latest_punches AS (
         SELECT DISTINCT ON (b.user_id) b.user_id,
            b.punch_time,
            b.punch_state_code,
            b.punch_state,
            b.device_id
           FROM public.biometric_attendance_logs b
          ORDER BY b.user_id, b.punch_time DESC
        )
 SELECT s.id AS student_id,
    s."regNo" AS reg_no,
    s.name AS student_name,
    s."roomNo" AS room_no,
    s."bedNo" AS bed_no,
    s."mobileNo" AS student_mobile,
    s."fatherName" AS father_name,
    s."fatherMobileNo" AS father_mobile,
    lp.punch_time AS out_time,
    lp.punch_time AS last_out_time,
    to_char(lp.punch_time, 'YYYY-MM-DD HH12:MI:SS AM'::text) AS out_time_formatted,
    round(EXTRACT(epoch FROM now() - lp.punch_time::timestamp with time zone) / 3600.0, 2) AS hours_outside,
    lp.device_id AS exit_device_id,
    'OUTSIDE'::text AS current_location
   FROM latest_punches lp
     JOIN public."Student" s ON s."regNo" = lp.user_id::text OR s."manualRegsiName" = lp.user_id::text OR s."biometricId" = lp.user_id::text
  WHERE (lp.punch_state_code = ANY (ARRAY[1, 2]) OR lp.punch_state::text = 'Check-Out'::text)
  ORDER BY lp.punch_time DESC;

-- ----------------------------------------------------------------------------
-- 5. View: Day-Wise Attendance Summary (First-In, Last-Out, Total Span)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_student_daily_attendance_summary AS
 SELECT b.punch_time::date AS attendance_date,
    s.id AS student_id,
    COALESCE(s."regNo", b.user_id::text) AS reg_no,
    COALESCE(s.name, ('Unregistered ('::text || b.user_id::text) || ')'::text) AS student_name,
    s."roomNo" AS room_no,
    s."bedNo" AS bed_no,
    s."mobileNo" AS student_mobile,
    s."fatherName" AS father_name,
    s."fatherMobileNo" AS father_mobile,
    min(b.punch_time) AS first_punch_time,
    to_char(min(b.punch_time), 'HH12:MI:SS AM'::text) AS first_punch_formatted,
    max(b.punch_time) AS last_punch_time,
    to_char(max(b.punch_time), 'HH12:MI:SS AM'::text) AS last_punch_formatted,
    min(
        CASE
            WHEN (b.punch_state_code = ANY (ARRAY[0, 3, 255])) OR b.punch_state::text = 'Check-In'::text THEN b.punch_time
            ELSE NULL::timestamp without time zone
        END) AS first_in_time,
    max(
        CASE
            WHEN (b.punch_state_code = ANY (ARRAY[1, 2])) OR b.punch_state::text = 'Check-Out'::text THEN b.punch_time
            ELSE NULL::timestamp without time zone
        END) AS last_out_time,
    count(*) AS total_punches,
    count(
        CASE
            WHEN (b.punch_state_code = ANY (ARRAY[0, 3, 255])) OR b.punch_state::text = 'Check-In'::text THEN 1
            ELSE NULL::integer
        END) AS total_in_punches,
    count(
        CASE
            WHEN (b.punch_state_code = ANY (ARRAY[1, 2])) OR b.punch_state::text = 'Check-Out'::text THEN 1
            ELSE NULL::integer
        END) AS total_out_punches,
    round(EXTRACT(epoch FROM max(b.punch_time) - min(b.punch_time)) / 3600.0, 2) AS span_hours,
        CASE
            WHEN count(*) > 0 THEN 'PRESENT'::text
            ELSE 'ABSENT'::text
        END AS attendance_status
   FROM public.biometric_attendance_logs b
     LEFT JOIN public."Student" s ON s."regNo" = b.user_id::text OR s."manualRegsiName" = b.user_id::text OR s."biometricId" = b.user_id::text
  GROUP BY (b.punch_time::date), s.id, s."regNo", b.user_id, s.name, s."roomNo", s."bedNo", s."mobileNo", s."fatherMobileNo"
  ORDER BY (b.punch_time::date) DESC, (COALESCE(s.name, ('Unregistered ('::text || b.user_id::text) || ')'::text));

-- ----------------------------------------------------------------------------
-- 6. View: Daily Absentee Report for Wardens
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_student_daily_absentee_report AS
 SELECT CURRENT_DATE AS check_date,
    id AS student_id,
    "regNo" AS reg_no,
    name AS student_name,
    "roomNo" AS room_no,
    "bedNo" AS bed_no,
    "mobileNo" AS student_mobile,
    "fatherName" AS father_name,
    "fatherMobileNo" AS father_mobile,
    status AS student_status,
    'ABSENT'::text AS attendance_status
   FROM public."Student" s
  WHERE status = 'In'::text AND NOT (EXISTS ( SELECT 1
           FROM public.biometric_attendance_logs b
          WHERE (b.user_id::text = s."regNo" OR b.user_id::text = s."manualRegsiName" OR b.user_id::text = s."biometricId") AND b.punch_time::date = CURRENT_DATE))
  ORDER BY "roomNo", name;

-- ----------------------------------------------------------------------------
-- 7. View: Curfew & Late Night Entry Violations (> 20:30)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_student_curfew_violations AS
 SELECT b.punch_time::date AS violation_date,
    b.punch_time::date AS punch_date,
    b.punch_time,
    b.punch_time AS return_time,
    to_char(b.punch_time, 'HH12:MI:SS AM'::text) AS punch_time_formatted,
    s.id AS student_id,
    s."regNo" AS reg_no,
    s.name AS student_name,
    s."roomNo" AS room_no,
    s."mobileNo" AS student_mobile,
    s."fatherName" AS father_name,
    s."fatherMobileNo" AS father_mobile,
    b.device_id,
    'LATE_ENTRY'::text AS violation_type,
    round(EXTRACT(epoch FROM b.punch_time::time without time zone - '20:30:00'::time without time zone) / 60.0, 0) AS minutes_past_curfew
   FROM public.biometric_attendance_logs b
     JOIN public."Student" s ON s."regNo" = b.user_id::text OR s."manualRegsiName" = b.user_id::text OR s."biometricId" = b.user_id::text
  WHERE ((b.punch_state_code = ANY (ARRAY[0, 3, 255])) OR b.punch_state::text = 'Check-In'::text) 
    AND b.punch_time::time without time zone > '20:30:00'::time without time zone
  ORDER BY b.punch_time DESC;

-- ----------------------------------------------------------------------------
-- 8. View: Room-Wise Daily Attendance Headcount
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_roomwise_daily_attendance AS
 SELECT CURRENT_DATE AS report_date,
    "roomNo" AS room_no,
    count(id) AS total_allotted_students,
    count(
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM public.biometric_attendance_logs b
              WHERE (b.user_id::text = s."regNo" OR b.user_id::text = s."manualRegsiName" OR b.user_id::text = s."biometricId") AND b.punch_time::date = CURRENT_DATE)) THEN 1
            ELSE NULL::integer
        END) AS present_count,
    count(
        CASE
            WHEN NOT (EXISTS ( SELECT 1
               FROM public.biometric_attendance_logs b
              WHERE (b.user_id::text = s."regNo" OR b.user_id::text = s."manualRegsiName" OR b.user_id::text = s."biometricId") AND b.punch_time::date = CURRENT_DATE)) THEN 1
            ELSE NULL::integer
        END) AS absent_count
   FROM public."Student" s
  WHERE status = 'In'::text AND "roomNo" IS NOT NULL
  GROUP BY "roomNo"
  ORDER BY "roomNo";

-- ----------------------------------------------------------------------------
-- 9. View: Monthly Student Attendance Summary
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_student_monthly_attendance_summary AS
 SELECT to_char(b.punch_time, 'YYYY-MM'::text) AS month_year,
    s.id AS student_id,
    COALESCE(s."regNo", b.user_id::text) AS reg_no,
    COALESCE(s.name, (('Unregistered ('::text || b.user_id::text) || ')'::text)) AS student_name,
    s."roomNo" AS room_no,
    count(DISTINCT b.punch_time::date) AS days_present,
    count(*) AS total_punches,
    count(
        CASE
            WHEN (b.punch_state_code = ANY (ARRAY[0, 3, 255])) OR b.punch_state::text = 'Check-In'::text THEN 1
            ELSE NULL::integer
        END) AS total_in_count,
    count(
        CASE
            WHEN (b.punch_state_code = ANY (ARRAY[1, 2])) OR b.punch_state::text = 'Check-Out'::text THEN 1
            ELSE NULL::integer
        END) AS total_out_count
   FROM public.biometric_attendance_logs b
     LEFT JOIN public."Student" s ON s."regNo" = b.user_id::text OR s."manualRegsiName" = b.user_id::text OR s."biometricId" = b.user_id::text
  GROUP BY (to_char(b.punch_time, 'YYYY-MM'::text)), s.id, s."regNo", b.user_id, s.name, s."roomNo"
  ORDER BY (to_char(b.punch_time, 'YYYY-MM'::text)) DESC, (count(DISTINCT b.punch_time::date)) DESC;

COMMIT;
