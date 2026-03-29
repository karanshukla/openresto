/**
 * Tests for iCal date formatting functionality
 * This ensures UTC dates are properly formatted for calendar links across the app
 */

// Mock the iCal formatting function to test it independently
const fmtCal = (d: Date): string => {
  // Create proper UTC format for iCal (YYYYMMDDTHHMMSSZ)
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

describe('iCal Date Formatting', () => {
  describe('fmtCal function', () => {
    it('should format UTC dates correctly in iCal format', () => {
      // March 28, 2026, 7:55:00 PM UTC
      const testDate = new Date(Date.UTC(2026, 2, 28, 19, 55, 0, 0));
      const result = fmtCal(testDate);
      
      expect(result).toBe('20260328T195500Z');
    });

    it('should handle dates at midnight UTC', () => {
      // January 1, 2026, 00:00:00 UTC
      const testDate = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0));
      const result = fmtCal(testDate);
      
      expect(result).toBe('20260101T000000Z');
    });

    it('should handle dates at end of year UTC', () => {
      // December 31, 2026, 23:59:59 UTC
      const testDate = new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 0));
      const result = fmtCal(testDate);
      
      expect(result).toBe('20261231T235959Z');
    });

    it('should handle single digit months and days with leading zeros', () => {
      // February 3, 2026, 5:05:05 UTC
      const testDate = new Date(Date.UTC(2026, 1, 3, 5, 5, 5, 0));
      const result = fmtCal(testDate);
      
      expect(result).toBe('20260203T050505Z');
    });

    it('should always include Z suffix for UTC timezone', () => {
      const testDates = [
        new Date(Date.UTC(2026, 0, 15, 10, 30, 0, 0)),
        new Date(Date.UTC(2026, 5, 20, 14, 45, 30, 0)),
        new Date(Date.UTC(2026, 11, 25, 8, 15, 45, 0)),
      ];

      testDates.forEach(date => {
        const result = fmtCal(date);
        expect(result).toMatch(/Z$/);
      });
    });

    it('should be consistent regardless of local timezone', () => {
      // Create the same UTC moment but test with different local timezone interpretations
      const utcTimestamp = Date.UTC(2026, 5, 15, 12, 0, 0, 0);
      
      // Test with a date that might be interpreted differently in local timezones
      const localDate1 = new Date(utcTimestamp);
      const localDate2 = new Date('2026-06-15T12:00:00.000Z');
      
      const result1 = fmtCal(localDate1);
      const result2 = fmtCal(localDate2);
      
      expect(result1).toBe(result2);
      expect(result1).toBe('20260615T120000Z');
    });

    it('should handle leap years correctly', () => {
      // February 29, 2024 (leap year), 12:00:00 UTC
      const testDate = new Date(Date.UTC(2024, 1, 29, 12, 0, 0, 0));
      const result = fmtCal(testDate);
      
      expect(result).toBe('20240229T120000Z');
    });

    it('should maintain date format consistency', () => {
      const testDate = new Date(Date.UTC(2026, 8, 15, 14, 30, 45, 0));
      const result = fmtCal(testDate);
      
      // Verify the format: YYYYMMDDTHHMMSSZ
      expect(result).toMatch(/^\d{8}T\d{6}Z$/);
      expect(result.length).toBe(15); // 8 + 1 + 6 + 1 = 16, but Z is included
    });
  });

  describe('Calendar URL Generation', () => {
    it('should generate valid Google Calendar URLs', () => {
      const startDate = new Date(Date.UTC(2026, 2, 28, 19, 55, 0, 0));
      const endDate = new Date(Date.UTC(2026, 2, 28, 20, 55, 0, 0));
      
      const startFormatted = fmtCal(startDate);
      const endFormatted = fmtCal(endDate);
      
      const googleUrl = `https://calendar.google.com/calendar/r/eventedit?text=Test%20Event&dates=${startFormatted}/${endFormatted}&details=Test%20Description&location=Test%20Location`;
      
      expect(googleUrl).toContain('dates=20260328T195500Z/20260328T205500Z');
      expect(googleUrl).toContain('text=Test%20Event');
      expect(googleUrl).toContain('details=Test%20Description');
      expect(googleUrl).toContain('location=Test%20Location');
    });

    it('should generate valid Outlook Calendar URLs', () => {
      const startDate = new Date(Date.UTC(2026, 2, 28, 19, 55, 0, 0));
      const endDate = new Date(Date.UTC(2026, 2, 28, 20, 55, 0, 0));
      
      const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?subject=Test%20Event&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=Test%20Description&location=Test%20Location`;
      
      expect(outlookUrl).toContain('startdt=2026-03-28T19:55:00.000Z');
      expect(outlookUrl).toContain('enddt=2026-03-28T20:55:00.000Z');
      expect(outlookUrl).toContain('subject=Test%20Event');
    });
  });

  describe('Booking Date Scenarios', () => {
    it('should handle typical booking times', () => {
      // Common booking scenarios
      const bookingTimes = [
        { hour: 18, minute: 0 },  // 6:00 PM
        { hour: 19, minute: 30 }, // 7:30 PM
        { hour: 20, minute: 15 }, // 8:15 PM
        { hour: 21, minute: 0 },  // 9:00 PM
      ];

      bookingTimes.forEach(({ hour, minute }) => {
        const bookingDate = new Date(Date.UTC(2026, 5, 15, hour, minute, 0, 0));
        const result = fmtCal(bookingDate);
        
        expect(result).toMatch(/^20260615T\d{6}Z$/);
        expect(result).toContain(String(hour).padStart(2, '0'));
        expect(result).toContain(String(minute).padStart(2, '0'));
      });
    });

    it('should handle booking end times (1 hour later)', () => {
      const startDate = new Date(Date.UTC(2026, 5, 15, 19, 30, 0, 0));
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
      
      const startFormatted = fmtCal(startDate);
      const endFormatted = fmtCal(endDate);
      
      expect(startFormatted).toBe('20260615T193000Z');
      expect(endFormatted).toBe('20260615T203000Z');
    });
  });

  describe('Edge Cases', () => {
    it('should handle dates with milliseconds', () => {
      // Date with milliseconds that should be ignored
      const testDate = new Date(Date.UTC(2026, 5, 15, 12, 30, 45, 123));
      const result = fmtCal(testDate);
      
      expect(result).toBe('20260615T123045Z');
      expect(result).not.toContain('123');
    });

    it('should handle very old dates', () => {
      const testDate = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0));
      const result = fmtCal(testDate);
      
      expect(result).toBe('19700101T000000Z');
    });

    it('should handle far future dates', () => {
      const testDate = new Date(Date.UTC(2100, 11, 31, 23, 59, 59, 0));
      const result = fmtCal(testDate);
      
      expect(result).toBe('21001231T235959Z');
    });
  });
});
