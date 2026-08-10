ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'REMOTE';

ALTER TABLE "daily_attendance"
ADD COLUMN IF NOT EXISTS "status_override" "AttendanceStatus",
ADD COLUMN IF NOT EXISTS "status_override_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "status_override_by" UUID;

CREATE INDEX IF NOT EXISTS "daily_attendance_status_override_idx"
ON "daily_attendance" ("status_override")
WHERE "status_override" IS NOT NULL;
