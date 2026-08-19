-- Replace automatically generated ZKT-prefixed codes with the K40 device ID.
UPDATE "employees"
SET "employee_code" = "device_user_id"
WHERE "device_user_id" IS NOT NULL
  AND "employee_code" = 'ZKT-' || "device_user_id";