export function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to format date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function getTimePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value),
    minute: Number(parts.find((part) => part.type === 'minute')?.value),
  };
}

export function getNightShiftDateKey(date: Date, timeZone: string) {
  const dateKey = getDateKeyInTimeZone(date, timeZone);
  const { hour, minute } = getTimePartsInTimeZone(date, timeZone);
  const minutes = hour * 60 + minute;

  if (minutes <= 6 * 60) {
    const previousDate = dateKeyToDatabaseDate(dateKey);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    return previousDate.toISOString().slice(0, 10);
  }

  return dateKey;
}

export function dateKeyToDatabaseDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function getLooseUtcWindowForDateKey(dateKey: string) {
  const date = dateKeyToDatabaseDate(dateKey);
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - 1);

  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 2);

  return {
    start,
    end,
  };
}

export function getPakistanShiftEnd(dateKey: string) {
  const nextDate = dateKeyToDatabaseDate(dateKey);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  // 06:00 Asia/Karachi (UTC+05:00) is 01:00 UTC.
  nextDate.setUTCHours(1, 0, 0, 0);
  return nextDate;
}
