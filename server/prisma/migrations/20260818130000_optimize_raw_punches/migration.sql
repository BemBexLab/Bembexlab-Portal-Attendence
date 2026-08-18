-- Add indexes used by the raw punches report ordering and attendance lookup.
CREATE INDEX "attendance_logs_punch_time_idx"
ON "attendance_logs"("punch_time");

CREATE INDEX "daily_attendance_employee_id_date_idx"
ON "daily_attendance"("employee_id", "date");