CREATE TABLE "shifts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "start_minutes" INTEGER NOT NULL,
  "end_minutes" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shifts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "shifts_organization_id_name_key" ON "shifts"("organization_id", "name");
CREATE INDEX "shifts_organization_id_is_active_idx" ON "shifts"("organization_id", "is_active");

CREATE TABLE "employee_shift_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "shift_id" UUID NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_shift_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
  CONSTRAINT "employee_shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT
);
CREATE INDEX "employee_shift_assignments_employee_id_effective_from_effective_to_idx" ON "employee_shift_assignments"("employee_id", "effective_from", "effective_to");
CREATE INDEX "employee_shift_assignments_shift_id_idx" ON "employee_shift_assignments"("shift_id");

ALTER TABLE "daily_attendance" ADD COLUMN "shift_id" UUID;
ALTER TABLE "daily_attendance" ADD COLUMN "shift_name_snapshot" VARCHAR(100);
ALTER TABLE "daily_attendance" ADD COLUMN "scheduled_start" TIMESTAMPTZ(6);
ALTER TABLE "daily_attendance" ADD COLUMN "scheduled_end" TIMESTAMPTZ(6);
ALTER TABLE "daily_attendance" ADD COLUMN "grace_deadline" TIMESTAMPTZ(6);
ALTER TABLE "daily_attendance" ADD CONSTRAINT "daily_attendance_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL;

INSERT INTO "shifts" ("organization_id", "name", "start_minutes", "end_minutes")
SELECT "id", 'Default Night Shift', 1260, 360 FROM "organizations";

INSERT INTO "employee_shift_assignments" ("employee_id", "shift_id", "effective_from")
SELECT e."id", s."id", COALESCE(e."attendance_tracking_since"::date, e."created_at"::date)
FROM "employees" e JOIN "shifts" s ON s."organization_id" = e."organization_id" AND s."name" = 'Default Night Shift';
