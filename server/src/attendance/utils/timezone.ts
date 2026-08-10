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
