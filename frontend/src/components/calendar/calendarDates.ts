const dhakaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayInDhaka(now = new Date()) {
  return dhakaDate.format(now);
}

// Calendar selections are civil dates, independent of the browser timezone.
export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function calendarDate(key: string) {
  return new Date(key + 'T00:00:00Z');
}

export function shiftDays(key: string, days: number) {
  const date = calendarDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function weekStart(key: string) {
  return shiftDays(key, -((calendarDate(key).getUTCDay() + 1) % 7));
}

export function shiftMonth(key: string, months: number) {
  const date = calendarDate(key);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  return dateKey(date);
}
