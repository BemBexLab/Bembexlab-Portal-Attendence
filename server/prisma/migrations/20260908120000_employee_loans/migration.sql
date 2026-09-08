CREATE TYPE "EmployeeLoanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'PAID', 'CANCELLED');

CREATE TABLE "employee_loans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "description" VARCHAR(255),
    "principal_amount" DECIMAL(12,2) NOT NULL,
    "monthly_installment" DECIMAL(12,2) NOT NULL,
    "start_cycle_month" VARCHAR(7) NOT NULL,
    "number_of_installments" INTEGER NOT NULL,
    "status" "EmployeeLoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_loans_organization_id_status_idx"
    ON "employee_loans"("organization_id", "status");

CREATE INDEX "employee_loans_employee_id_status_start_cycle_month_idx"
    ON "employee_loans"("employee_id", "status", "start_cycle_month");

ALTER TABLE "employee_loans"
    ADD CONSTRAINT "employee_loans_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_loans"
    ADD CONSTRAINT "employee_loans_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
