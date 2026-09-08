CREATE TYPE "EmployeeEarningType" AS ENUM ('BONUS', 'COMMISSION');

CREATE TYPE "EmployeeEarningStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');

CREATE TABLE "employee_earnings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" "EmployeeEarningType" NOT NULL,
    "status" "EmployeeEarningStatus" NOT NULL DEFAULT 'APPROVED',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "percentage" DECIMAL(5,2),
    "payroll_cycle_month" VARCHAR(7) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_earnings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_earnings_organization_id_payroll_cycle_month_idx"
    ON "employee_earnings"("organization_id", "payroll_cycle_month");

CREATE INDEX "employee_earnings_employee_id_payroll_cycle_month_idx"
    ON "employee_earnings"("employee_id", "payroll_cycle_month");

ALTER TABLE "employee_earnings"
    ADD CONSTRAINT "employee_earnings_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_earnings"
    ADD CONSTRAINT "employee_earnings_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
