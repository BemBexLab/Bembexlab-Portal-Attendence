CREATE TYPE "RequestKind" AS ENUM ('LEAVE', 'REMOTE_WORK', 'CORRECTION');
CREATE TABLE "employee_requests" (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  kind "RequestKind" NOT NULL,
  leave_category VARCHAR(20),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ(6),
  decided_by UUID,
  CONSTRAINT employee_requests_pkey PRIMARY KEY (id)
);

CREATE INDEX employee_requests_organization_id_status_submitted_at_idx ON "employee_requests" (organization_id, status, submitted_at);
CREATE INDEX employee_requests_employee_id_from_date_idx ON "employee_requests" (employee_id, from_date);

ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE;
ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES "employees"(id) ON DELETE RESTRICT;
ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_decided_by_fkey" FOREIGN KEY (decided_by) REFERENCES "users"(id) ON DELETE SET NULL;
