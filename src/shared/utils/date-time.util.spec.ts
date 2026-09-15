import {
  generateRecurringCalendarDates,
  buildUtcSessionTimes,
  getKyivTimezoneOffset,
} from './date-time.util';

describe('DateTimeUtil', () => {
  describe('generateRecurringCalendarDates', () => {
    it('should generate exact matching days of week regardless of environment timezone', () => {
      // 2026-09-14 is Monday (1)
      // 2026-09-21 is Monday (1)
      // 2026-09-28 is Monday (1)
      const dates = generateRecurringCalendarDates('2026-09-14', '2026-09-28', [1]);
      expect(dates).toHaveLength(3);
      expect(dates[0].dateStr).toBe('2026-09-14');
      expect(dates[1].dateStr).toBe('2026-09-21');
      expect(dates[2].dateStr).toBe('2026-09-28');
    });

    it('should match multiple days of week (Mon, Wed, Fri)', () => {
      // From 2026-09-15 (Tue) to 2026-09-22 (Tue)
      // Days: 1 (Mon), 3 (Wed), 5 (Fri)
      // Expected:
      // Wed Sep 16
      // Fri Sep 18
      // Mon Sep 21
      const dates = generateRecurringCalendarDates('2026-09-15', '2026-09-22', [1, 3, 5]);
      expect(dates.map((d) => d.dateStr)).toEqual(['2026-09-16', '2026-09-18', '2026-09-21']);
    });

    it('should handle ISO strings with T00:00:00', () => {
      const dates = generateRecurringCalendarDates(
        '2026-09-14T00:00:00.000Z',
        '2026-09-15T23:59:59.000Z',
        [1],
      );
      expect(dates).toHaveLength(1);
      expect(dates[0].dateStr).toBe('2026-09-14');
    });
  });

  describe('buildUtcSessionTimes', () => {
    it('should convert local Kyiv summer time (UTC+3, offset -180) to exact UTC', () => {
      const dateItem = { year: 2026, month: 9, day: 16, dateStr: '2026-09-16' };
      const { startTime, endTime } = buildUtcSessionTimes(dateItem, '10:00', '11:00', -180);

      // 10:00 Kyiv in summer is 07:00 UTC
      expect(startTime.toISOString()).toBe('2026-09-16T07:00:00.000Z');
      expect(endTime.toISOString()).toBe('2026-09-16T08:00:00.000Z');
    });

    it('should handle late evening sessions without rolling to wrong day in local time', () => {
      const dateItem = { year: 2026, month: 9, day: 16, dateStr: '2026-09-16' };
      const { startTime } = buildUtcSessionTimes(dateItem, '22:00', '23:00', -180);

      // 22:00 Kyiv is 19:00 UTC on same date
      expect(startTime.toISOString()).toBe('2026-09-16T19:00:00.000Z');
    });

    it('should use Kyiv offset automatically when user offset is not provided', () => {
      const dateItem = { year: 2026, month: 9, day: 16, dateStr: '2026-09-16' };
      const { startTime } = buildUtcSessionTimes(dateItem, '10:00', '11:00');

      // In September, Kyiv is UTC+3 -> 10:00 local is 07:00 UTC
      expect(startTime.toISOString()).toBe('2026-09-16T07:00:00.000Z');
    });
  });

  describe('getKyivTimezoneOffset', () => {
    it('should return -180 in summer (EEST, UTC+3)', () => {
      const offset = getKyivTimezoneOffset(2026, 7, 15);
      expect(offset).toBe(-180);
    });

    it('should return -120 in winter (EET, UTC+2)', () => {
      const offset = getKyivTimezoneOffset(2026, 1, 15);
      expect(offset).toBe(-120);
    });
  });
});
