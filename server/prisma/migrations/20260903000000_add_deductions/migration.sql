CREATE TABLE "deductions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "payroll_cycle_month" VARCHAR(7) NOT NULL,
    "late_days" INTEGER NOT NULL DEFAULT 0,
    "half_days" INTEGER NOT NULL DEFAULT 0,
    "absent_days" INTEGER NOT NULL DEFAULT 0,
    "late_half_day_deduction_days" INTEGER NOT NULL DEFAULT 0,
    "total_deduction_days" INTEGER NOT NULL DEFAULT 0,
    "monthly_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payroll_days" INTEGER NOT NULL DEFAULT 0,
    "daily_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "calculated_through" VARCHAR(10),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deductions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deductions_employee_id_payroll_cycle_month_key" ON "deductions"("employee_id", "payroll_cycle_month");
CREATE INDEX "deductions_organization_id_payroll_cycle_month_idx" ON "deductions"("organization_id", "payroll_cycle_month");

ALTER TABLE "deductions" ADD CONSTRAINT "deductions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
