/// <reference types="jasmine" />

import { localCalendarDate } from './task.models';

describe('localCalendarDate', () => {
  it('uses the local calendar when the UTC instant falls on a different day and year', () => {
    const instant = new Date('2025-12-31T23:30:00Z');
    spyOn(instant, 'getFullYear').and.returnValue(2026);
    spyOn(instant, 'getMonth').and.returnValue(0);
    spyOn(instant, 'getDate').and.returnValue(1);

    expect(localCalendarDate(instant)).toBe('2026-01-01');
  });
});
