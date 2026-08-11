ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "attendance_tracking_since" TIMESTAMPTZ(6);
