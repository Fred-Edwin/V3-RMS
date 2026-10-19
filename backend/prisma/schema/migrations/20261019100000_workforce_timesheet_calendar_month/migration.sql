-- Workforce slice 4a follow-up (owner decision 19 Oct 2026): a timesheet period is one calendar month, not four weeks.
-- Data only; no table or column changes. It re-cuts every OPEN period that is not already a calendar month into the
-- months it touches, without losing a day, an exception, an overtime item or a request (requests hang on the person and
-- the date, not on the period). CLOSED periods are never changed; a month that starts after a closed period starts the
-- day after it. Running it again finds nothing to re-cut and changes nothing. The legacy tables are not touched.

-- A. Park the old open windows (a date before 1900 marks "being re-cut", so nothing here depends on a temp table).
UPDATE timesheet_periods p
SET start_date = p.start_date - 100000
WHERE p.state = 'OPEN'
  AND p.start_date >= DATE '1900-01-01'
  AND NOT (
    p.end_date = (date_trunc('month', p.start_date) + interval '1 month - 1 day')::date
    AND (
      p.start_date = date_trunc('month', p.start_date)::date
      OR EXISTS (SELECT 1 FROM timesheet_periods c WHERE c.organization_id = p.organization_id AND c.state = 'CLOSED' AND c.end_date = p.start_date - 1)
    )
  );

-- B. One OPEN period per touched month. The cut-off is the rule default: 18:00 Nairobi on the 2nd day after the month ends.
INSERT INTO timesheet_periods (id, organization_id, start_date, end_date, label, cutoff_at, updated_at)
SELECT gen_random_uuid()::text, m.organization_id, m.start_date, m.month_end, m.label,
       ((m.month_end + 2)::timestamp + time '18:00') AT TIME ZONE 'Africa/Nairobi' AT TIME ZONE 'UTC', now()
FROM (
  SELECT DISTINCT p.organization_id,
         greatest(
           g::date,
           coalesce((SELECT max(c.end_date) + 1 FROM timesheet_periods c WHERE c.organization_id = p.organization_id AND c.state = 'CLOSED' AND c.end_date >= g::date), g::date)
         ) AS start_date,
         (g + interval '1 month - 1 day')::date AS month_end,
         to_char(g, 'FMMonth YYYY') AS label
  FROM timesheet_periods p,
       LATERAL generate_series(date_trunc('month', p.start_date + 100000), date_trunc('month', p.end_date), interval '1 month') AS g
  WHERE p.start_date < DATE '1900-01-01'
) m
WHERE m.start_date <= m.month_end
ON CONFLICT (organization_id, start_date) DO NOTHING;

-- C. Days and overtime follow their date into the month period that holds it.
UPDATE timesheet_days d
SET period_id = n.id
FROM timesheet_periods o, timesheet_periods n
WHERE d.period_id = o.id AND o.start_date < DATE '1900-01-01'
  AND n.organization_id = d.organization_id AND n.start_date >= DATE '1900-01-01'
  AND d.shift_date BETWEEN n.start_date AND n.end_date;

UPDATE overtime_items i
SET period_id = n.id
FROM timesheet_periods o, timesheet_periods n
WHERE i.period_id = o.id AND o.start_date < DATE '1900-01-01'
  AND n.organization_id = i.organization_id AND n.start_date >= DATE '1900-01-01'
  AND i.shift_date BETWEEN n.start_date AND n.end_date;

-- D. Weeks follow their days (cut at the period boundary, Monday first, like the app's default week).
DELETE FROM timesheet_weeks w USING timesheet_periods o WHERE w.period_id = o.id AND o.start_date < DATE '1900-01-01';

INSERT INTO timesheet_weeks (id, period_id, organization_id, employee_id, week_start, status, scheduled_minutes, worked_minutes, updated_at)
SELECT gen_random_uuid()::text, d.period_id, d.organization_id, d.employee_id, date_trunc('week', d.shift_date)::date,
       CASE
         WHEN bool_or(d.status = 'NEEDS_LOOK') THEN 'NEEDS_LOOK'
         WHEN bool_or(d.status = 'HELD') THEN 'HELD'
         WHEN bool_or(d.status = 'MATCHED') THEN 'MATCHED'
         WHEN bool_and(d.status = 'AUTO_APPROVED') THEN 'AUTO_APPROVED'
         ELSE 'APPROVED'
       END::"TimesheetStatus",
       sum(d.scheduled_minutes), sum(d.worked_minutes), now()
FROM timesheet_days d
JOIN timesheet_periods p ON p.id = d.period_id AND p.state = 'OPEN' AND p.start_date >= DATE '1900-01-01'
GROUP BY d.period_id, d.organization_id, d.employee_id, date_trunc('week', d.shift_date)::date
ON CONFLICT (employee_id, week_start, period_id) DO NOTHING;

-- E. Nothing may be left on a parked window: stop the whole migration rather than lose a row.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM timesheet_days d JOIN timesheet_periods o ON o.id = d.period_id WHERE o.start_date < DATE '1900-01-01')
     OR EXISTS (SELECT 1 FROM overtime_items i JOIN timesheet_periods o ON o.id = i.period_id WHERE o.start_date < DATE '1900-01-01') THEN
    RAISE EXCEPTION 'A day or an overtime item has no calendar-month period to move to; the re-cut is stopped';
  END IF;
END $$;

DELETE FROM timesheet_periods WHERE start_date < DATE '1900-01-01';
