-- Preserve attendance logs when a device is removed by making the device
-- relation nullable and keeping the last known device name on each log.
ALTER TABLE "attendance_logs"
ADD COLUMN "device_name_snapshot" VARCHAR(120);

UPDATE "attendance_logs" AS logs
SET "device_name_snapshot" = devices."name"
FROM "zkteco_devices" AS devices
WHERE logs."device_id" = devices."id"
  AND logs."device_name_snapshot" IS NULL;

ALTER TABLE "attendance_logs"
ALTER COLUMN "device_id" DROP NOT NULL;

ALTER TABLE "attendance_logs"
DROP CONSTRAINT "attendance_logs_device_id_fkey";

ALTER TABLE "attendance_logs"
ADD CONSTRAINT "attendance_logs_device_id_fkey"
FOREIGN KEY ("device_id") REFERENCES "zkteco_devices"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
