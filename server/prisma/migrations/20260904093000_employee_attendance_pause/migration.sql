ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "attendance_paused_at" TIMESTAMPTZ(6);

