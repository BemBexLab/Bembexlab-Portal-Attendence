"use client";

import { Select } from "@/components/ui/select";

const hourOptions = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1);
  return { value, label: value.padStart(2, "0") };
});
const minuteOptions = Array.from({ length: 60 }, (_, index) => {
  const value = String(index);
  return { value, label: value.padStart(2, "0") };
});
const periodOptions = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

function parseTime(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return { hour: hour % 12 || 12, minute, period: hour >= 12 ? "PM" : "AM" as "AM" | "PM" };
}

export function TimeInput({ value, onChange, ariaLabel }: { value: string; onChange: (value: string) => void; ariaLabel: string }) {
  const parsed = parseTime(value);
  const update = (hour: number, minute: number, period: "AM" | "PM") => {
    const hour24 = hour % 12 + (period === "PM" ? 12 : 0);
    onChange(`${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  };
  const segmentClass = "h-10 rounded-none border-0 bg-transparent px-3 hover:bg-muted/50 focus:ring-0";
  return <div aria-label={ariaLabel} className="grid min-w-0 grid-cols-[minmax(72px,1fr)_auto_minmax(72px,1fr)_84px] items-center overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/20" role="group">
    <Select ariaLabel={`${ariaLabel} hour`} className="min-w-0" menuMinWidth={80} onChange={(next) => update(Number(next), parsed.minute, parsed.period)} options={hourOptions} triggerClassName={segmentClass} value={String(parsed.hour)} />
    <span className="text-sm font-semibold text-muted-foreground">:</span>
    <Select ariaLabel={`${ariaLabel} minute`} className="min-w-0" menuMinWidth={80} onChange={(next) => update(parsed.hour, Number(next), parsed.period)} options={minuteOptions} triggerClassName={segmentClass} value={String(parsed.minute)} />
    <Select ariaLabel={`${ariaLabel} AM or PM`} className="min-w-0 border-l border-border" menuMinWidth={84} onChange={(next) => update(parsed.hour, parsed.minute, next as "AM" | "PM")} options={periodOptions} triggerClassName={segmentClass} value={parsed.period} />
  </div>;
}
