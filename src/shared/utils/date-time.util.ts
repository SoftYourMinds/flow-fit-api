export interface RecurringDateItem {
  year: number;
  month: number;
  day: number;
  dateStr: string; // YYYY-MM-DD
}

/**
 * Calculates Kyiv timezone offset in minutes from UTC for a specific calendar date.
 * E.g. -180 for EEST (summer daylight saving time UTC+3), -120 for EET (winter time UTC+2).
 */
export function getKyivTimezoneOffset(year: number, month: number, day: number): number {
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const utcDate = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  const kyivDate = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  return (utcDate.getTime() - kyivDate.getTime()) / 60000;
}

/**
 * Generates all calendar dates between dateFrom and dateTo matching daysOfWeek.
 * Uses purely UTC-based calendar calculation so it is 100% independent of server system timezone.
 *
 * @param dateFromStr YYYY-MM-DD (or ISO string)
 * @param dateToStr YYYY-MM-DD (or ISO string)
 * @param daysOfWeek array of days: 0 = Sun, 1 = Mon, ..., 6 = Sat
 */
export function generateRecurringCalendarDates(
  dateFromStr: string,
  dateToStr: string,
  daysOfWeek: number[],
): RecurringDateItem[] {
  const cleanFrom = dateFromStr.split('T')[0];
  const cleanTo = dateToStr.split('T')[0];

  const [startY, startM, startD] = cleanFrom.split('-').map(Number);
  const [endY, endM, endD] = cleanTo.split('-').map(Number);

  // Use noon (12:00 UTC) so that daylight saving or date boundaries never alter the day
  const startUtc = new Date(Date.UTC(startY, startM - 1, startD, 12, 0, 0));
  const endUtc = new Date(Date.UTC(endY, endM - 1, endD, 12, 0, 0));

  const items: RecurringDateItem[] = [];
  const curr = new Date(startUtc);

  while (curr <= endUtc) {
    const dow = curr.getUTCDay();
    if (daysOfWeek.includes(dow)) {
      const year = curr.getUTCFullYear();
      const month = curr.getUTCMonth() + 1;
      const day = curr.getUTCDate();
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      items.push({
        year,
        month,
        day,
        dateStr: `${year}-${monthStr}-${dayStr}`,
      });
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return items;
}

/**
 * Builds absolute UTC Date instances for session start and end times.
 * Converts the trainer's local calendar date & time to the true UTC timestamp
 * based on the provided timezoneOffset (or Europe/Kyiv default).
 */
export function buildUtcSessionTimes(
  dateItem: RecurringDateItem,
  startTimeStr: string,
  endTimeStr: string,
  userTimezoneOffset?: number,
): { startTime: Date; endTime: Date } {
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  const offsetMinutes =
    userTimezoneOffset !== undefined && !isNaN(userTimezoneOffset)
      ? userTimezoneOffset
      : getKyivTimezoneOffset(dateItem.year, dateItem.month, dateItem.day);

  // Date.UTC creates timestamp as if startH:startM was in UTC.
  // Adding offsetMinutes * 60000 converts local time to true UTC:
  // (UTC = Local + offset, e.g. 10:00 local + (-180 min) = 07:00 UTC).
  const startLocalUtcMs = Date.UTC(
    dateItem.year,
    dateItem.month - 1,
    dateItem.day,
    startH,
    startM,
    0,
    0,
  );
  const endLocalUtcMs = Date.UTC(dateItem.year, dateItem.month - 1, dateItem.day, endH, endM, 0, 0);

  const startTime = new Date(startLocalUtcMs + offsetMinutes * 60000);
  const endTime = new Date(endLocalUtcMs + offsetMinutes * 60000);

  return { startTime, endTime };
}
