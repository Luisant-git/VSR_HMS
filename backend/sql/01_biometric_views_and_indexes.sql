-- ============================================================================
-- VSR-HMS BIOMETRIC ATTENDANCE - DATABASE VIEWS & PERFORMANCE INDEXES
-- Compatible with: eSSL X2008 Face Recognition Terminal / ADMS Protocol
-- Supports: Hostel Movement Cycle (Morning OUT to College, Evening IN to Hostel)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Performance Indexes & Columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.biometric_attendance_logs ADD COLUMN IF NOT EXISTS student_id VARCHAR(100);
ALTER TABLE public.student_daily_attendance ADD COLUMN IF NOT EXISTS first_out_time TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE public.student_daily_attendance ADD COLUMN IF NOT EXISTS last_in_time TIMESTAMP WITHOUT TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_biometric_logs_punch_time 
    ON public.biometric_attendance_logs (punch_time DESC);

CREATE INDEX IF NOT EXISTS idx_biometric_logs_student_id 
    ON public.biometric_attendance_logs (student_id);

CREATE INDEX IF NOT EXISTS idx_student_biometric_id 
    ON public."Student" ("biometricId") 
    WHERE "biometricId" IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. View: Real-Time Student In/Out Movement Stream
-- Hostel cycle: Students wake up and go OUT in the morning (punch 1 = OUT).
-- Students return from college IN in the evening (punch 2 = IN).
-- Subsequent punches toggle OUT -> IN.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_student_in_out_logs CASCADE;
CREATE VIEW public.view_student_in_out_logs AS
 WITH numbered_punches AS (
     SELECT b.id AS log_id,
        b.punch_time,
        b.punch_time::date AS punch_date,
        to_char(b.punch_time, 'HH12:MI:SS AM'::text) AS punch_time_formatted,
        b.punch_state,
        b.punch_state_code,
        b.verify_type,
        b.device_id,
        b.device_uid,
        b.synced_at,
        b.user_id AS user_pin,
        b.student_id AS log_student_id,
        ROW_NUMBER() OVER (PARTITION BY b.user_id, b.punch_time::date ORDER BY b.punch_time ASC) AS punch_seq
     FROM public.biometric_attendance_logs b
 )
 SELECT np.log_id,
    np.punch_time,
    np.punch_date,
    np.punch_time_formatted,
    CASE
        WHEN np.punch_state_code = ANY (ARRAY[1, 2]) OR np.punch_state::text = 'Check-Out'::text THEN 'OUT'::text
        WHEN np.punch_state_code = ANY (ARRAY[0, 3]) OR (np.punch_state::text = 'Check-In'::text AND np.punch_state_code != 255) THEN 'IN'::text
        WHEN np.punch_seq % 2 = 1 THEN 'OUT'::text
        ELSE 'IN'::text
    END AS movement_direction,
    np.punch_state,
    np.verify_type,
    COALESCE(s.id, np.log_student_id, np.user_pin::text) AS student_id,
    COALESCE(s."manualRegsiName", s."regNo", np.user_pin::text) AS reg_no,
    COALESCE(s.name, ('Unregistered ('::text || np.user_pin::text) || ')'::text) AS student_name,
    s."roomNo" AS room_no,
    s."bedNo" AS bed_no,
    s."mobileNo" AS student_mobile,
    s."fatherMobileNo" AS father_mobile,
    np.device_id,
    COALESCE(d.device_name, np.device_id::text) AS device_name,
    np.device_uid,
    np.synced_at,
    np.user_pin
   FROM numbered_punches np
     LEFT JOIN public."Student" s ON s."regNo" = np.user_pin::text OR s."manualRegsiName" = np.user_pin::text OR s."biometricId" = np.user_pin::text
     LEFT JOIN public.biometric_device_registry d ON np.device_id::text = d.device_id::text
  ORDER BY np.punch_time DESC;

-- ----------------------------------------------------------------------------
-- 3. View: Students Currently OUTSIDE the Hostel (e.g. at college)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_student_currently_outside CASCADE;
CREATE VIEW public.view_student_currently_outside AS
 WITH latest_punches AS (
     SELECT DISTINCT ON (v.user_pin)
        v.user_pin,
        v.punch_time,
        v.movement_direction,
        v.device_id
     FROM public.view_student_in_out_logs v
     WHERE v.punch_date = (now() AT TIME ZONE 'Asia/Kolkata')::date
     ORDER BY v.user_pin, v.punch_time DESC
 )
 SELECT s.id AS student_id,
    COALESCE(s."manualRegsiName", s."regNo") AS reg_no,
    s.name AS student_name,
    s."roomNo" AS room_no,
    s."bedNo" AS bed_no,
    s."mobileNo" AS student_mobile,
    s."fatherName" AS father_name,
    s."fatherMobileNo" AS father_mobile,
    lp.punch_time AS out_time,
    lp.punch_time AS last_out_time,
    to_char(lp.punch_time, 'YYYY-MM-DD HH12:MI:SS AM'::text) AS out_time_formatted,
    round(EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Kolkata') - lp.punch_time::timestamp) / 3600.0, 2) AS hours_outside,
    lp.device_id AS exit_device_id,
    'OUTSIDE'::text AS current_location
 FROM latest_punches lp
 JOIN public."Student" s ON s."regNo" = lp.user_pin::text OR s."manualRegsiName" = lp.user_pin::text OR s."biometricId" = lp.user_pin::text
 WHERE lp.movement_direction = 'OUT' AND s.status = 'In'
 ORDER BY lp.punch_time DESC;

-- ----------------------------------------------------------------------------
-- 4. View: Students Currently INSIDE the Hostel
-- In a hostel, students reside inside by default. Students are inside unless
-- their latest punch today is OUT without a subsequent IN.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_student_currently_inside CASCADE;
CREATE VIEW public.view_student_currently_inside AS
 WITH latest_punches AS (
     SELECT DISTINCT ON (v.user_pin)
        v.user_pin,
        v.punch_time,
        v.movement_direction,
        v.device_id
     FROM public.view_student_in_out_logs v
     WHERE v.punch_date = (now() AT TIME ZONE 'Asia/Kolkata')::date
     ORDER BY v.user_pin, v.punch_time DESC
 )
 SELECT s.id AS student_id,
    COALESCE(s."manualRegsiName", s."regNo") AS reg_no,
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
 LEFT JOIN latest_punches lp ON s."regNo" = lp.user_pin::text OR s."manualRegsiName" = lp.user_pin::text OR s."biometricId" = lp.user_pin::text
 WHERE s.status = 'In'
   AND (lp.user_pin IS NULL OR lp.movement_direction = 'IN')
 ORDER BY lp.punch_time DESC NULLS LAST, s."roomNo" ASC NULLS LAST, s.name ASC;

-- ----------------------------------------------------------------------------
-- 5. View: Day-Wise Attendance Summary (First-Out, Last-In, Total Span)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_student_daily_attendance_summary CASCADE;
CREATE VIEW public.view_student_daily_attendance_summary AS
 SELECT v.punch_date AS attendance_date,
    s.id AS student_id,
    COALESCE(s."manualRegsiName", s."regNo", v.user_pin::text) AS reg_no,
    COALESCE(s.name, ('Unregistered ('::text || v.user_pin::text) || ')'::text) AS student_name,
    s."roomNo" AS room_no,
    s."bedNo" AS bed_no,
    s."mobileNo" AS student_mobile,
    s."fatherMobileNo" AS father_mobile,
    min(v.punch_time) AS first_punch_time,
    to_char(min(v.punch_time), 'HH12:MI:SS AM'::text) AS first_punch_formatted,
    max(v.punch_time) AS last_punch_time,
    to_char(max(v.punch_time), 'HH12:MI:SS AM'::text) AS last_punch_formatted,
    min(CASE WHEN v.movement_direction = 'OUT' THEN v.punch_time END) AS first_out_time,
    to_char(min(CASE WHEN v.movement_direction = 'OUT' THEN v.punch_time END), 'HH12:MI:SS AM'::text) AS first_out_formatted,
    max(CASE WHEN v.movement_direction = 'IN' THEN v.punch_time END) AS last_in_time,
    to_char(max(CASE WHEN v.movement_direction = 'IN' THEN v.punch_time END), 'HH12:MI:SS AM'::text) AS last_in_formatted,
    min(CASE WHEN v.movement_direction = 'IN' THEN v.punch_time END) AS first_in_time,
    max(CASE WHEN v.movement_direction = 'OUT' THEN v.punch_time END) AS last_out_time,
    count(*) AS total_punches,
    count(CASE WHEN v.movement_direction = 'OUT' THEN 1 END) AS total_out_punches,
    count(CASE WHEN v.movement_direction = 'IN' THEN 1 END) AS total_in_punches,
    round(EXTRACT(epoch FROM max(v.punch_time) - min(v.punch_time)) / 3600.0, 2) AS span_hours,
    CASE
        WHEN count(*) > 0 THEN 'PRESENT'::text
        ELSE 'ABSENT'::text
    END AS attendance_status
 FROM public.view_student_in_out_logs v
 LEFT JOIN public."Student" s ON s."regNo" = v.user_pin::text OR s."manualRegsiName" = v.user_pin::text OR s."biometricId" = v.user_pin::text
 GROUP BY v.punch_date, s.id, s."regNo", s."manualRegsiName", v.user_pin, s.name, s."roomNo", s."bedNo", s."mobileNo", s."fatherMobileNo"
 ORDER BY v.punch_date DESC, (COALESCE(s.name, ('Unregistered ('::text || v.user_pin::text) || ')'::text));

-- ----------------------------------------------------------------------------
-- 6. View: Daily Absentee Report for Wardens
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_student_daily_absentee_report CASCADE;
CREATE VIEW public.view_student_daily_absentee_report AS
 SELECT (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date AS check_date,
    id AS student_id,
    COALESCE("manualRegsiName", "regNo") AS reg_no,
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
          WHERE (b.user_id::text = s."regNo" OR b.user_id::text = s."manualRegsiName" OR b.user_id::text = s."biometricId") AND b.punch_time::date = (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date))
  ORDER BY "roomNo", name;

-- ----------------------------------------------------------------------------
-- 7. View: Curfew & Late Night Entry Violations (> 20:30)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_student_curfew_violations CASCADE;
CREATE VIEW public.view_student_curfew_violations AS
 SELECT v.punch_date AS violation_date,
    v.punch_date,
    v.punch_time,
    v.punch_time AS return_time,
    v.punch_time_formatted,
    s.id AS student_id,
    COALESCE(s."manualRegsiName", s."regNo", v.user_pin::text) AS reg_no,
    COALESCE(s.name, ('Unregistered ('::text || v.user_pin::text) || ')'::text) AS student_name,
    s."roomNo" AS room_no,
    s."mobileNo" AS student_mobile,
    s."fatherMobileNo" AS father_mobile,
    v.device_id,
    'LATE_ENTRY'::text AS violation_type,
    round(EXTRACT(epoch FROM v.punch_time::time without time zone - '20:30:00'::time without time zone) / 60.0, 0) AS minutes_past_curfew
 FROM public.view_student_in_out_logs v
 LEFT JOIN public."Student" s ON s."regNo" = v.user_pin::text OR s."manualRegsiName" = v.user_pin::text OR s."biometricId" = v.user_pin::text
 WHERE v.movement_direction = 'IN' 
   AND v.punch_time::time without time zone > '20:30:00'::time without time zone
 ORDER BY v.punch_time DESC;

-- ----------------------------------------------------------------------------
-- 8. View: Room-Wise Daily Attendance Headcount
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_roomwise_daily_attendance CASCADE;
CREATE VIEW public.view_roomwise_daily_attendance AS
 SELECT (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date AS report_date,
    "roomNo" AS room_no,
    count(id) AS total_allotted_students,
    count(
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM public.biometric_attendance_logs b
              WHERE (b.user_id::text = s."regNo" OR b.user_id::text = s."manualRegsiName" OR b.user_id::text = s."biometricId") AND b.punch_time::date = (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date)) THEN 1
            ELSE NULL::integer
        END) AS present_count,
    count(
        CASE
            WHEN NOT (EXISTS ( SELECT 1
               FROM public.biometric_attendance_logs b
              WHERE (b.user_id::text = s."regNo" OR b.user_id::text = s."manualRegsiName" OR b.user_id::text = s."biometricId") AND b.punch_time::date = (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date)) THEN 1
            ELSE NULL::integer
        END) AS absent_count
   FROM public."Student" s
  WHERE status = 'In'::text AND "roomNo" IS NOT NULL
  GROUP BY "roomNo"
  ORDER BY "roomNo";

-- ----------------------------------------------------------------------------
-- 9. View: Monthly Student Attendance Summary
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_student_monthly_attendance_summary CASCADE;
CREATE VIEW public.view_student_monthly_attendance_summary AS
 SELECT to_char(v.punch_time, 'YYYY-MM'::text) AS month_year,
    s.id AS student_id,
    COALESCE(s."manualRegsiName", s."regNo", v.user_pin::text) AS reg_no,
    COALESCE(s.name, ('Unregistered ('::text || v.user_pin::text) || ')'::text) AS student_name,
    s."roomNo" AS room_no,
    count(DISTINCT v.punch_date) AS days_present,
    count(*) AS total_punches,
    count(CASE WHEN v.movement_direction = 'OUT' THEN 1 END) AS total_out_count,
    count(CASE WHEN v.movement_direction = 'IN' THEN 1 END) AS total_in_count
   FROM public.view_student_in_out_logs v
     LEFT JOIN public."Student" s ON s."regNo" = v.user_pin::text OR s."manualRegsiName" = v.user_pin::text OR s."biometricId" = v.user_pin::text
  GROUP BY (to_char(v.punch_time, 'YYYY-MM'::text)), s.id, s."regNo", s."manualRegsiName", v.user_pin, s.name, s."roomNo"
  ORDER BY (to_char(v.punch_time, 'YYYY-MM'::text)) DESC, (count(DISTINCT v.punch_date)) DESC;

COMMIT;
