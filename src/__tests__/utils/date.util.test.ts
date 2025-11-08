/**
 * @fileoverview Comprehensive test suite for date utility functions
 * 
 * Test Coverage Strategy:
 * - Unit tests for all exported functions
 * - Edge case validation (boundaries, invalid inputs)
 * - Error handling and custom exceptions
 * - Date normalization and timezone handling
 * - Business logic validation (overlap detection, night calculations)
 * - Type guard validation
 * 
 * Coverage Target: 100% (lines, branches, functions, statements)
 * 
 * @module __tests__/utils/date.util.test
 */

import {
  isDateRangeValid,
  hasDateOverlap,
  calculateNights,
  isDateInFuture,
  isValidCheckInDate,
  isDateRange,
  DateValidationError,
  type DateRange,
} from '@/utils/date.util';

// =============================================================================
// TEST SUITE ORGANIZATION
// =============================================================================
// 1. DateValidationError Class Tests
// 2. isDateRangeValid Function Tests
// 3. hasDateOverlap Function Tests
// 4. calculateNights Function Tests
// 5. isDateInFuture Function Tests
// 6. isValidCheckInDate Function Tests
// 7. isDateRange Type Guard Tests
// 8. Integration Tests (Combined Scenarios)
// 9. Performance Tests
// =============================================================================

describe('Date Utility Functions', () => {
  // =============================================================================
  // TEST DATA FACTORIES
  // =============================================================================

  /**
   * Factory for creating test dates with consistent timezone handling
   */
  const createTestDate = (dateString: string): Date => new Date(dateString);

  /**
   * Factory for creating date ranges
   */
  const createDateRange = (checkIn: string, checkOut: string): DateRange => ({
    checkIn: createTestDate(checkIn),
    checkOut: createTestDate(checkOut),
  });

  /**
   * Get a date relative to today
   */
  const getRelativeDate = (daysOffset: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date;
  };

  // =============================================================================
  // 1. DATEVALIDATIONERROR CLASS TESTS
  // =============================================================================

  describe('DateValidationError', () => {
    it('should create error with correct name and message', () => {
      const message = 'Test error message';
      const error = new DateValidationError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DateValidationError);
      expect(error.name).toBe('DateValidationError');
      expect(error.message).toBe(message);
    });

    it('should maintain prototype chain', () => {
      const error = new DateValidationError('Test');

      expect(Object.getPrototypeOf(error)).toBe(DateValidationError.prototype);
    });

    it('should be catchable as Error', () => {
      try {
        throw new DateValidationError('Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DateValidationError);
      }
    });
  });

  // =============================================================================
  // 2. ISDATERANGEVALID FUNCTION TESTS
  // =============================================================================

  describe('isDateRangeValid', () => {
    // -------------------------------------------------------------------------
    // Happy Path Tests
    // -------------------------------------------------------------------------

    describe('Valid Date Ranges', () => {
      it('should return true for valid date range with 1 night', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-16');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });

      it('should return true for valid date range with multiple nights', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-20');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });

      it('should return true for date range spanning months', () => {
        const checkIn = createTestDate('2024-01-30');
        const checkOut = createTestDate('2024-02-05');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });

      it('should return true for date range spanning years', () => {
        const checkIn = createTestDate('2024-12-30');
        const checkOut = createTestDate('2025-01-05');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });

      it('should handle dates with time components correctly', () => {
        const checkIn = createTestDate('2024-01-15T14:30:00');
        const checkOut = createTestDate('2024-01-16T10:00:00');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Invalid Input Tests
    // -------------------------------------------------------------------------

    describe('Invalid Check-in Date', () => {
      it('should throw error for invalid check-in date (null)', () => {
        const checkOut = createTestDate('2024-01-20');

        expect(() => isDateRangeValid(null as any, checkOut)).toThrow(
          DateValidationError
        );
        expect(() => isDateRangeValid(null as any, checkOut)).toThrow(
          'Check-in date must be a valid Date object'
        );
      });

      it('should throw error for invalid check-in date (undefined)', () => {
        const checkOut = createTestDate('2024-01-20');

        expect(() => isDateRangeValid(undefined as any, checkOut)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid check-in date (string)', () => {
        const checkOut = createTestDate('2024-01-20');

        expect(() => isDateRangeValid('2024-01-15' as any, checkOut)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid check-in date (number)', () => {
        const checkOut = createTestDate('2024-01-20');

        expect(() => isDateRangeValid(1234567890 as any, checkOut)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid check-in date (Invalid Date)', () => {
        const checkIn = new Date('invalid');
        const checkOut = createTestDate('2024-01-20');

        expect(() => isDateRangeValid(checkIn, checkOut)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid check-in date (NaN)', () => {
        const checkIn = new Date(NaN);
        const checkOut = createTestDate('2024-01-20');

        expect(() => isDateRangeValid(checkIn, checkOut)).toThrow(
          DateValidationError
        );
      });
    });

    describe('Invalid Check-out Date', () => {
      it('should throw error for invalid check-out date (null)', () => {
        const checkIn = createTestDate('2024-01-15');

        expect(() => isDateRangeValid(checkIn, null as any)).toThrow(
          DateValidationError
        );
        expect(() => isDateRangeValid(checkIn, null as any)).toThrow(
          'Check-out date must be a valid Date object'
        );
      });

      it('should throw error for invalid check-out date (undefined)', () => {
        const checkIn = createTestDate('2024-01-15');

        expect(() => isDateRangeValid(checkIn, undefined as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid check-out date (string)', () => {
        const checkIn = createTestDate('2024-01-15');

        expect(() => isDateRangeValid(checkIn, '2024-01-20' as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid check-out date (Invalid Date)', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = new Date('invalid');

        expect(() => isDateRangeValid(checkIn, checkOut)).toThrow(
          DateValidationError
        );
      });
    });

    // -------------------------------------------------------------------------
    // Business Logic Validation Tests
    // -------------------------------------------------------------------------

    describe('Date Range Business Rules', () => {
      it('should throw error when check-out equals check-in (same day)', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-15');

        expect(() => isDateRangeValid(checkIn, checkOut)).toThrow(
          DateValidationError
        );
        expect(() => isDateRangeValid(checkIn, checkOut)).toThrow(
          'Check-out date must be after check-in date (minimum stay: 1 night)'
        );
      });

      it('should throw error when check-out is before check-in', () => {
        const checkIn = createTestDate('2024-01-20');
        const checkOut = createTestDate('2024-01-15');

        expect(() => isDateRangeValid(checkIn, checkOut)).toThrow(
          DateValidationError
        );
        expect(() => isDateRangeValid(checkIn, checkOut)).toThrow(
          'Check-out date must be after check-in date'
        );
      });

      it('should handle same day with different times correctly', () => {
        const checkIn = createTestDate('2024-01-15T14:00:00');
        const checkOut = createTestDate('2024-01-15T16:00:00');

        expect(() => isDateRangeValid(checkIn, checkOut)).toThrow(
          DateValidationError
        );
      });
    });

    // -------------------------------------------------------------------------
    // Edge Cases and Boundary Tests
    // -------------------------------------------------------------------------

    describe('Edge Cases', () => {
      it('should handle leap year dates correctly', () => {
        const checkIn = createTestDate('2024-02-28');
        const checkOut = createTestDate('2024-03-01');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });

      it('should handle non-leap year February correctly', () => {
        const checkIn = createTestDate('2023-02-28');
        const checkOut = createTestDate('2023-03-01');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });

      it('should handle month boundaries correctly', () => {
        const checkIn = createTestDate('2024-01-31');
        const checkOut = createTestDate('2024-02-01');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });

      it('should handle year boundaries correctly', () => {
        const checkIn = createTestDate('2024-12-31');
        const checkOut = createTestDate('2025-01-01');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });

      it('should normalize dates with different timezones', () => {
        const checkIn = new Date('2024-01-15T23:59:59Z');
        const checkOut = new Date('2024-01-16T00:00:01Z');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
      });
    });
  });

  // =============================================================================
  // 3. HASDATEOVERLAP FUNCTION TESTS
  // =============================================================================

  describe('hasDateOverlap', () => {
    // -------------------------------------------------------------------------
    // Overlapping Ranges Tests
    // -------------------------------------------------------------------------

    describe('Overlapping Date Ranges', () => {
      it('should detect overlap when range2 starts during range1', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-18', '2024-01-25');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });

      it('should detect overlap when range2 ends during range1', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-10', '2024-01-17');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });

      it('should detect overlap when range2 completely contains range1', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-10', '2024-01-25');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });

      it('should detect overlap when range1 completely contains range2', () => {
        const range1 = createDateRange('2024-01-10', '2024-01-25');
        const range2 = createDateRange('2024-01-15', '2024-01-20');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });

      it('should detect overlap when ranges are identical', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-15', '2024-01-20');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });

      it('should detect overlap with single day overlap', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-19', '2024-01-25');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Non-Overlapping Ranges Tests
    // -------------------------------------------------------------------------

    describe('Non-Overlapping Date Ranges', () => {
      it('should not detect overlap when ranges are completely separate', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-25', '2024-01-30');

        expect(hasDateOverlap(range1, range2)).toBe(false);
      });

      it('should not detect overlap when range2 starts on range1 checkout', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-20', '2024-01-25');

        expect(hasDateOverlap(range1, range2)).toBe(false);
      });

      it('should not detect overlap when range1 starts on range2 checkout', () => {
        const range1 = createDateRange('2024-01-20', '2024-01-25');
        const range2 = createDateRange('2024-01-15', '2024-01-20');

        expect(hasDateOverlap(range1, range2)).toBe(false);
      });

      it('should not detect overlap for adjacent ranges (back-to-back bookings)', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-18');
        const range2 = createDateRange('2024-01-18', '2024-01-21');

        expect(hasDateOverlap(range1, range2)).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // Invalid Input Tests
    // -------------------------------------------------------------------------

    describe('Invalid Date Ranges', () => {
      it('should throw error for invalid range1 check-in', () => {
        const range1 = {
          checkIn: null as any,
          checkOut: createTestDate('2024-01-20'),
        };
        const range2 = createDateRange('2024-01-18', '2024-01-25');

        expect(() => hasDateOverlap(range1, range2)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid range1 check-out', () => {
        const range1 = {
          checkIn: createTestDate('2024-01-15'),
          checkOut: new Date('invalid'),
        };
        const range2 = createDateRange('2024-01-18', '2024-01-25');

        expect(() => hasDateOverlap(range1, range2)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid range2 check-in', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = {
          checkIn: undefined as any,
          checkOut: createTestDate('2024-01-25'),
        };

        expect(() => hasDateOverlap(range1, range2)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid range2 check-out', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = {
          checkIn: createTestDate('2024-01-18'),
          checkOut: null as any,
        };

        expect(() => hasDateOverlap(range1, range2)).toThrow(
          DateValidationError
        );
      });

      it('should throw error when range1 check-out equals check-in', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-15');
        const range2 = createDateRange('2024-01-18', '2024-01-25');

        expect(() => hasDateOverlap(range1, range2)).toThrow(
          DateValidationError
        );
      });

      it('should throw error when range2 check-out equals check-in', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-18', '2024-01-18');

        expect(() => hasDateOverlap(range1, range2)).toThrow(
          DateValidationError
        );
      });
    });

    // -------------------------------------------------------------------------
    // Edge Cases Tests
    // -------------------------------------------------------------------------

    describe('Edge Cases', () => {
      it('should handle ranges spanning months', () => {
        const range1 = createDateRange('2024-01-28', '2024-02-05');
        const range2 = createDateRange('2024-02-01', '2024-02-10');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });

      it('should handle ranges spanning years', () => {
        const range1 = createDateRange('2024-12-28', '2025-01-05');
        const range2 = createDateRange('2025-01-01', '2025-01-10');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });

      it('should handle leap year dates', () => {
        const range1 = createDateRange('2024-02-28', '2024-03-02');
        const range2 = createDateRange('2024-02-29', '2024-03-05');

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });

      it('should handle dates with time components', () => {
        const range1 = {
          checkIn: createTestDate('2024-01-15T14:00:00'),
          checkOut: createTestDate('2024-01-20T10:00:00'),
        };
        const range2 = {
          checkIn: createTestDate('2024-01-18T16:00:00'),
          checkOut: createTestDate('2024-01-25T11:00:00'),
        };

        expect(hasDateOverlap(range1, range2)).toBe(true);
      });
    });
  });

  // =============================================================================
  // 4. CALCULATENIGHTS FUNCTION TESTS
  // =============================================================================

  describe('calculateNights', () => {
    // -------------------------------------------------------------------------
    // Valid Calculations Tests
    // -------------------------------------------------------------------------

    describe('Valid Night Calculations', () => {
      it('should calculate 1 night correctly', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-16');

        expect(calculateNights(checkIn, checkOut)).toBe(1);
      });

      it('should calculate multiple nights correctly', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-20');

        expect(calculateNights(checkIn, checkOut)).toBe(5);
      });

      it('should calculate 7 nights (1 week) correctly', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-22');

        expect(calculateNights(checkIn, checkOut)).toBe(7);
      });

      it('should calculate 30 nights (1 month) correctly', () => {
        const checkIn = createTestDate('2024-01-01');
        const checkOut = createTestDate('2024-01-31');

        expect(calculateNights(checkIn, checkOut)).toBe(30);
      });

      it('should calculate nights spanning months', () => {
        const checkIn = createTestDate('2024-01-28');
        const checkOut = createTestDate('2024-02-05');

        expect(calculateNights(checkIn, checkOut)).toBe(8);
      });

      it('should calculate nights spanning years', () => {
        const checkIn = createTestDate('2024-12-28');
        const checkOut = createTestDate('2025-01-05');

        expect(calculateNights(checkIn, checkOut)).toBe(8);
      });
    });

    // -------------------------------------------------------------------------
    // Time Normalization Tests
    // -------------------------------------------------------------------------

    describe('Time Component Handling', () => {
      it('should normalize dates with different times to full nights', () => {
        const checkIn = createTestDate('2024-01-15T14:30:00');
        const checkOut = createTestDate('2024-01-16T10:00:00');

        expect(calculateNights(checkIn, checkOut)).toBe(1);
      });

      it('should handle late check-in and early check-out', () => {
        const checkIn = createTestDate('2024-01-15T23:59:00');
        const checkOut = createTestDate('2024-01-16T00:01:00');

        expect(calculateNights(checkIn, checkOut)).toBe(1);
      });

      it('should handle midnight times correctly', () => {
        const checkIn = createTestDate('2024-01-15T00:00:00');
        const checkOut = createTestDate('2024-01-20T00:00:00');

        expect(calculateNights(checkIn, checkOut)).toBe(5);
      });

      it('should ignore time components in calculation', () => {
        const checkIn = createTestDate('2024-01-15T08:00:00');
        const checkOut = createTestDate('2024-01-20T20:00:00');

        expect(calculateNights(checkIn, checkOut)).toBe(5);
      });
    });

    // -------------------------------------------------------------------------
    // Invalid Input Tests
    // -------------------------------------------------------------------------

    describe('Invalid Inputs', () => {
      it('should throw error for invalid check-in date', () => {
        const checkOut = createTestDate('2024-01-20');

        expect(() => calculateNights(null as any, checkOut)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for invalid check-out date', () => {
        const checkIn = createTestDate('2024-01-15');

        expect(() => calculateNights(checkIn, undefined as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error when check-out equals check-in', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-15');

        expect(() => calculateNights(checkIn, checkOut)).toThrow(
          DateValidationError
        );
      });

      it('should throw error when check-out is before check-in', () => {
        const checkIn = createTestDate('2024-01-20');
        const checkOut = createTestDate('2024-01-15');

        expect(() => calculateNights(checkIn, checkOut)).toThrow(
          DateValidationError
        );
      });
    });

    // -------------------------------------------------------------------------
    // Edge Cases Tests
    // -------------------------------------------------------------------------

    describe('Edge Cases', () => {
      it('should handle leap year February correctly', () => {
        const checkIn = createTestDate('2024-02-28');
        const checkOut = createTestDate('2024-03-01');

        expect(calculateNights(checkIn, checkOut)).toBe(2);
      });

      it('should handle non-leap year February correctly', () => {
        const checkIn = createTestDate('2023-02-28');
        const checkOut = createTestDate('2023-03-01');

        expect(calculateNights(checkIn, checkOut)).toBe(1);
      });

      it('should handle long stays (365 nights)', () => {
        const checkIn = createTestDate('2024-01-01');
        const checkOut = createTestDate('2025-01-01');

        expect(calculateNights(checkIn, checkOut)).toBe(366); // 2024 is leap year
      });

      it('should handle very long stays (multiple years)', () => {
        const checkIn = createTestDate('2024-01-01');
        const checkOut = createTestDate('2026-01-01');

        expect(calculateNights(checkIn, checkOut)).toBe(731); // 366 + 365
      });
    });
  });

  // =============================================================================
  // 5. ISDATEINFUTURE FUNCTION TESTS
  // =============================================================================

  describe('isDateInFuture', () => {
    // -------------------------------------------------------------------------
    // Future Date Tests
    // -------------------------------------------------------------------------

    describe('Future Dates', () => {
      it('should return true for tomorrow', () => {
        const tomorrow = getRelativeDate(1);

        expect(isDateInFuture(tomorrow)).toBe(true);
      });

      it('should return true for date 1 week in future', () => {
        const nextWeek = getRelativeDate(7);

        expect(isDateInFuture(nextWeek)).toBe(true);
      });

      it('should return true for date 1 month in future', () => {
        const nextMonth = getRelativeDate(30);

        expect(isDateInFuture(nextMonth)).toBe(true);
      });

      it('should return true for date 1 year in future', () => {
        const nextYear = getRelativeDate(365);

        expect(isDateInFuture(nextYear)).toBe(true);
      });

      it('should return true for far future date', () => {
        const farFuture = createTestDate('2099-12-31');

        expect(isDateInFuture(farFuture)).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Present and Past Date Tests
    // -------------------------------------------------------------------------

    describe('Present and Past Dates', () => {
      it('should return false for today', () => {
        const today = new Date();

        expect(isDateInFuture(today)).toBe(false);
      });

      it('should return false for yesterday', () => {
        const yesterday = getRelativeDate(-1);

        expect(isDateInFuture(yesterday)).toBe(false);
      });

      it('should return false for date 1 week ago', () => {
        const lastWeek = getRelativeDate(-7);

        expect(isDateInFuture(lastWeek)).toBe(false);
      });

      it('should return false for date 1 month ago', () => {
        const lastMonth = getRelativeDate(-30);

        expect(isDateInFuture(lastMonth)).toBe(false);
      });

      it('should return false for date 1 year ago', () => {
        const lastYear = getRelativeDate(-365);

        expect(isDateInFuture(lastYear)).toBe(false);
      });

      it('should return false for far past date', () => {
        const farPast = createTestDate('2000-01-01');

        expect(isDateInFuture(farPast)).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // Time Component Tests
    // -------------------------------------------------------------------------

    describe('Time Component Handling', () => {
      it('should normalize time components when checking future', () => {
        const tomorrow = getRelativeDate(1);
        tomorrow.setHours(0, 0, 0, 0);

        expect(isDateInFuture(tomorrow)).toBe(true);
      });

      it('should treat today with different time as not future', () => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        expect(isDateInFuture(today)).toBe(false);
      });

      it('should handle midnight correctly', () => {
        const tomorrow = getRelativeDate(1);
        tomorrow.setHours(0, 0, 0, 0);

        expect(isDateInFuture(tomorrow)).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Invalid Input Tests
    // -------------------------------------------------------------------------

    describe('Invalid Inputs', () => {
      it('should throw error for null date', () => {
        expect(() => isDateInFuture(null as any)).toThrow(DateValidationError);
        expect(() => isDateInFuture(null as any)).toThrow(
          'Date must be a valid Date object'
        );
      });

      it('should throw error for undefined date', () => {
        expect(() => isDateInFuture(undefined as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for string date', () => {
        expect(() => isDateInFuture('2024-01-15' as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for number date', () => {
        expect(() => isDateInFuture(1234567890 as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for Invalid Date', () => {
        const invalidDate = new Date('invalid');

        expect(() => isDateInFuture(invalidDate)).toThrow(DateValidationError);
      });

      it('should throw error for NaN date', () => {
        const nanDate = new Date(NaN);

        expect(() => isDateInFuture(nanDate)).toThrow(DateValidationError);
      });
    });

    // -------------------------------------------------------------------------
    // Edge Cases Tests
    // -------------------------------------------------------------------------

    describe('Edge Cases', () => {
      it('should handle leap year dates', () => {
        const leapDay = createTestDate('2024-02-29');
        const today = new Date();

        if (leapDay > today) {
          expect(isDateInFuture(leapDay)).toBe(true);
        } else {
          expect(isDateInFuture(leapDay)).toBe(false);
        }
      });

      it('should handle year boundaries', () => {
        const newYear = createTestDate('2025-01-01');
        const today = new Date();

        if (newYear > today) {
          expect(isDateInFuture(newYear)).toBe(true);
        } else {
          expect(isDateInFuture(newYear)).toBe(false);
        }
      });
    });
  });

  // =============================================================================
  // 6. ISVALIDCHECKINDATE FUNCTION TESTS
  // =============================================================================

  describe('isValidCheckInDate', () => {
    // -------------------------------------------------------------------------
    // Valid Check-in Dates Tests
    // -------------------------------------------------------------------------

    describe('Valid Check-in Dates', () => {
      it('should return true for today', () => {
        const today = new Date();

        expect(isValidCheckInDate(today)).toBe(true);
      });

      it('should return true for tomorrow', () => {
        const tomorrow = getRelativeDate(1);

        expect(isValidCheckInDate(tomorrow)).toBe(true);
      });

      it('should return true for date 1 week in future', () => {
        const nextWeek = getRelativeDate(7);

        expect(isValidCheckInDate(nextWeek)).toBe(true);
      });

      it('should return true for date 1 month in future', () => {
        const nextMonth = getRelativeDate(30);

        expect(isValidCheckInDate(nextMonth)).toBe(true);
      });

      it('should return true for far future date', () => {
        const farFuture = createTestDate('2099-12-31');

        expect(isValidCheckInDate(farFuture)).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Invalid Check-in Dates Tests
    // -------------------------------------------------------------------------

    describe('Invalid Check-in Dates (Past)', () => {
      it('should throw error for yesterday', () => {
        const yesterday = getRelativeDate(-1);

        expect(() => isValidCheckInDate(yesterday)).toThrow(
          DateValidationError
        );
        expect(() => isValidCheckInDate(yesterday)).toThrow(
          'Check-in date cannot be in the past'
        );
      });

      it('should throw error for date 1 week ago', () => {
        const lastWeek = getRelativeDate(-7);

        expect(() => isValidCheckInDate(lastWeek)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for date 1 month ago', () => {
        const lastMonth = getRelativeDate(-30);

        expect(() => isValidCheckInDate(lastMonth)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for far past date', () => {
        const farPast = createTestDate('2000-01-01');

        expect(() => isValidCheckInDate(farPast)).toThrow(DateValidationError);
      });
    });

    // -------------------------------------------------------------------------
    // Time Component Tests
    // -------------------------------------------------------------------------

    describe('Time Component Handling', () => {
      it('should normalize time components when validating', () => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        expect(isValidCheckInDate(today)).toBe(true);
      });

      it('should handle midnight correctly', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        expect(isValidCheckInDate(today)).toBe(true);
      });

      it('should handle early morning times', () => {
        const today = new Date();
        today.setHours(1, 0, 0, 0);

        expect(isValidCheckInDate(today)).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Invalid Input Tests
    // -------------------------------------------------------------------------

    describe('Invalid Inputs', () => {
      it('should throw error for null date', () => {
        expect(() => isValidCheckInDate(null as any)).toThrow(
          DateValidationError
        );
        expect(() => isValidCheckInDate(null as any)).toThrow(
          'Check-in date must be a valid Date object'
        );
      });

      it('should throw error for undefined date', () => {
        expect(() => isValidCheckInDate(undefined as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for string date', () => {
        expect(() => isValidCheckInDate('2024-01-15' as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for number date', () => {
        expect(() => isValidCheckInDate(1234567890 as any)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for Invalid Date', () => {
        const invalidDate = new Date('invalid');

        expect(() => isValidCheckInDate(invalidDate)).toThrow(
          DateValidationError
        );
      });

      it('should throw error for NaN date', () => {
        const nanDate = new Date(NaN);

        expect(() => isValidCheckInDate(nanDate)).toThrow(DateValidationError);
      });
    });

    // -------------------------------------------------------------------------
    // Edge Cases Tests
    // -------------------------------------------------------------------------

    describe('Edge Cases', () => {
      it('should handle leap year dates', () => {
        const leapDay = createTestDate('2024-02-29');
        const today = new Date();

        if (leapDay >= today) {
          expect(isValidCheckInDate(leapDay)).toBe(true);
        } else {
          expect(() => isValidCheckInDate(leapDay)).toThrow(
            DateValidationError
          );
        }
      });

      it('should handle year boundaries', () => {
        const newYear = createTestDate('2025-01-01');
        const today = new Date();

        if (newYear >= today) {
          expect(isValidCheckInDate(newYear)).toBe(true);
        } else {
          expect(() => isValidCheckInDate(newYear)).toThrow(
            DateValidationError
          );
        }
      });
    });
  });

  // =============================================================================
  // 7. ISDATERANGE TYPE GUARD TESTS
  // =============================================================================

  describe('isDateRange', () => {
    // -------------------------------------------------------------------------
    // Valid DateRange Tests
    // -------------------------------------------------------------------------

    describe('Valid DateRange Objects', () => {
      it('should return true for valid DateRange object', () => {
        const dateRange = createDateRange('2024-01-15', '2024-01-20');

        expect(isDateRange(dateRange)).toBe(true);
      });

      it('should return true for DateRange with Date objects', () => {
        const dateRange = {
          checkIn: new Date('2024-01-15'),
          checkOut: new Date('2024-01-20'),
        };

        expect(isDateRange(dateRange)).toBe(true);
      });

      it('should return true for DateRange with additional properties', () => {
        const dateRange = {
          checkIn: new Date('2024-01-15'),
          checkOut: new Date('2024-01-20'),
          roomId: '123',
          guestName: 'John Doe',
        };

        expect(isDateRange(dateRange)).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Invalid DateRange Tests
    // -------------------------------------------------------------------------

    describe('Invalid DateRange Objects', () => {
      it('should return false for null', () => {
        expect(isDateRange(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isDateRange(undefined)).toBe(false);
      });

      it('should return false for string', () => {
        expect(isDateRange('2024-01-15')).toBe(false);
      });

      it('should return false for number', () => {
        expect(isDateRange(1234567890)).toBe(false);
      });

      it('should return false for array', () => {
        expect(isDateRange([new Date(), new Date()])).toBe(false);
      });

      it('should return false for object missing checkIn', () => {
        const obj = {
          checkOut: new Date('2024-01-20'),
        };

        expect(isDateRange(obj)).toBe(false);
      });

      it('should return false for object missing checkOut', () => {
        const obj = {
          checkIn: new Date('2024-01-15'),
        };

        expect(isDateRange(obj)).toBe(false);
      });

      it('should return false for object with invalid checkIn', () => {
        const obj = {
          checkIn: '2024-01-15',
          checkOut: new Date('2024-01-20'),
        };

        expect(isDateRange(obj)).toBe(false);
      });

      it('should return false for object with invalid checkOut', () => {
        const obj = {
          checkIn: new Date('2024-01-15'),
          checkOut: '2024-01-20',
        };

        expect(isDateRange(obj)).toBe(false);
      });

      it('should return false for object with null checkIn', () => {
        const obj = {
          checkIn: null,
          checkOut: new Date('2024-01-20'),
        };

        expect(isDateRange(obj)).toBe(false);
      });

      it('should return false for object with undefined checkOut', () => {
        const obj = {
          checkIn: new Date('2024-01-15'),
          checkOut: undefined,
        };

        expect(isDateRange(obj)).toBe(false);
      });

      it('should return false for object with Invalid Date checkIn', () => {
        const obj = {
          checkIn: new Date('invalid'),
          checkOut: new Date('2024-01-20'),
        };

        expect(isDateRange(obj)).toBe(false);
      });

      it('should return false for object with Invalid Date checkOut', () => {
        const obj = {
          checkIn: new Date('2024-01-15'),
          checkOut: new Date('invalid'),
        };

        expect(isDateRange(obj)).toBe(false);
      });

      it('should return false for empty object', () => {
        expect(isDateRange({})).toBe(false);
      });
    });
  });

  // =============================================================================
  // 8. INTEGRATION TESTS (COMBINED SCENARIOS)
  // =============================================================================

  describe('Integration Tests', () => {
    describe('Complete Reservation Workflow', () => {
      it('should validate complete reservation date flow', () => {
        const checkIn = getRelativeDate(7);
        const checkOut = getRelativeDate(14);

        // Validate check-in date is valid for booking
        expect(isValidCheckInDate(checkIn)).toBe(true);

        // Validate date range
        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);

        // Calculate nights
        expect(calculateNights(checkIn, checkOut)).toBe(7);

        // Verify dates are in future
        expect(isDateInFuture(checkIn)).toBe(true);
        expect(isDateInFuture(checkOut)).toBe(true);
      });

      it('should detect overlapping reservations', () => {
        const reservation1 = createDateRange('2024-06-15', '2024-06-20');
        const reservation2 = createDateRange('2024-06-18', '2024-06-25');
        const reservation3 = createDateRange('2024-06-20', '2024-06-27');

        // Reservation 1 and 2 overlap
        expect(hasDateOverlap(reservation1, reservation2)).toBe(true);

        // Reservation 2 and 3 overlap
        expect(hasDateOverlap(reservation2, reservation3)).toBe(true);

        // Reservation 1 and 3 don't overlap (touching boundaries)
        expect(hasDateOverlap(reservation1, reservation3)).toBe(false);
      });

      it('should handle back-to-back reservations correctly', () => {
        const reservation1 = createDateRange('2024-06-15', '2024-06-20');
        const reservation2 = createDateRange('2024-06-20', '2024-06-25');
        const reservation3 = createDateRange('2024-06-25', '2024-06-30');

        // No overlaps (standard hotel practice)
        expect(hasDateOverlap(reservation1, reservation2)).toBe(false);
        expect(hasDateOverlap(reservation2, reservation3)).toBe(false);
        expect(hasDateOverlap(reservation1, reservation3)).toBe(false);

        // All ranges are valid
        expect(isDateRangeValid(reservation1.checkIn, reservation1.checkOut)).toBe(true);
        expect(isDateRangeValid(reservation2.checkIn, reservation2.checkOut)).toBe(true);
        expect(isDateRangeValid(reservation3.checkIn, reservation3.checkOut)).toBe(true);

        // Calculate total nights
        const nights1 = calculateNights(reservation1.checkIn, reservation1.checkOut);
        const nights2 = calculateNights(reservation2.checkIn, reservation2.checkOut);
        const nights3 = calculateNights(reservation3.checkIn, reservation3.checkOut);

        expect(nights1 + nights2 + nights3).toBe(15);
      });
    });

    describe('Complex Overlap Scenarios', () => {
      it('should handle multiple overlapping reservations', () => {
        const baseReservation = createDateRange('2024-06-15', '2024-06-25');
        const overlappingReservations = [
          createDateRange('2024-06-10', '2024-06-18'),
          createDateRange('2024-06-17', '2024-06-22'),
          createDateRange('2024-06-20', '2024-06-30'),
          createDateRange('2024-06-12', '2024-06-28'),
        ];

        overlappingReservations.forEach((reservation) => {
          expect(hasDateOverlap(baseReservation, reservation)).toBe(true);
        });
      });

      it('should handle non-overlapping reservations around a base reservation', () => {
        const baseReservation = createDateRange('2024-06-15', '2024-06-20');
        const nonOverlappingReservations = [
          createDateRange('2024-06-01', '2024-06-15'),
          createDateRange('2024-06-20', '2024-06-25'),
          createDateRange('2024-06-25', '2024-06-30'),
          createDateRange('2024-06-05', '2024-06-10'),
        ];

        nonOverlappingReservations.forEach((reservation) => {
          expect(hasDateOverlap(baseReservation, reservation)).toBe(false);
        });
      });
    });

    describe('Date Range Validation Chain', () => {
      it('should validate entire reservation creation flow', () => {
        const checkIn = getRelativeDate(30);
        const checkOut = getRelativeDate(37);

        // Step 1: Validate check-in date
        expect(() => isValidCheckInDate(checkIn)).not.toThrow();

        // Step 2: Validate date range
        expect(() => isDateRangeValid(checkIn, checkOut)).not.toThrow();

        // Step 3: Calculate nights
        const nights = calculateNights(checkIn, checkOut);
        expect(nights).toBe(7);

        // Step 4: Create DateRange object
        const dateRange = { checkIn, checkOut };
        expect(isDateRange(dateRange)).toBe(true);

        // Step 5: Check for overlaps with existing reservations
        const existingReservation = createDateRange('2024-06-01', '2024-06-10');
        expect(hasDateOverlap(dateRange, existingReservation)).toBe(false);
      });

      it('should reject invalid reservation creation flow', () => {
        const checkIn = getRelativeDate(-7); // Past date
        const checkOut = getRelativeDate(-1); // Past date

        // Step 1: Check-in validation should fail
        expect(() => isValidCheckInDate(checkIn)).toThrow(DateValidationError);

        // Step 2: Date range validation should also fail
        expect(() => isDateRangeValid(checkIn, checkOut)).not.toThrow(); // Range itself is valid
        
        // But check-in date is in the past
        expect(() => isValidCheckInDate(checkIn)).toThrow(
          'Check-in date cannot be in the past'
        );
      });
    });
  });

  // =============================================================================
  // 9. PERFORMANCE TESTS
  // =============================================================================

  describe('Performance Tests', () => {
    describe('Function Execution Time', () => {
      it('should validate date range in under 10ms', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-20');

        const startTime = performance.now();
        for (let i = 0; i < 1000; i++) {
          isDateRangeValid(checkIn, checkOut);
        }
        const endTime = performance.now();

        const avgTime = (endTime - startTime) / 1000;
        expect(avgTime).toBeLessThan(10);
      });

      it('should check overlap in under 10ms', () => {
        const range1 = createDateRange('2024-01-15', '2024-01-20');
        const range2 = createDateRange('2024-01-18', '2024-01-25');

        const startTime = performance.now();
        for (let i = 0; i < 1000; i++) {
          hasDateOverlap(range1, range2);
        }
        const endTime = performance.now();

        const avgTime = (endTime - startTime) / 1000;
        expect(avgTime).toBeLessThan(10);
      });

      it('should calculate nights in under 5ms', () => {
        const checkIn = createTestDate('2024-01-15');
        const checkOut = createTestDate('2024-01-20');

        const startTime = performance.now();
        for (let i = 0; i < 1000; i++) {
          calculateNights(checkIn, checkOut);
        }
        const endTime = performance.now();

        const avgTime = (endTime - startTime) / 1000;
        expect(avgTime).toBeLessThan(5);
      });
    });

    describe('Large Dataset Performance', () => {
      it('should handle checking 1000 overlaps efficiently', () => {
        const baseRange = createDateRange('2024-06-15', '2024-06-20');
        const ranges: DateRange[] = [];

        // Generate 1000 date ranges
        for (let i = 0; i < 1000; i++) {
          const offset = i * 2;
          ranges.push(
            createDateRange(
              `2024-06-${String(1 + offset).padStart(2, '0')}`,
              `2024-06-${String(5 + offset).padStart(2, '0')}`
            )
          );
        }

        const startTime = performance.now();
        ranges.forEach((range) => {
          try {
            hasDateOverlap(baseRange, range);
          } catch {
            // Ignore validation errors for invalid dates
          }
        });
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        expect(totalTime).toBeLessThan(1000); // Should complete in under 1 second
      });
    });
  });

  // =============================================================================
  // 10. BOUNDARY AND EDGE CASE TESTS
  // =============================================================================

  describe('Boundary and Edge Cases', () => {
    describe('Extreme Date Values', () => {
      it('should handle very far future dates', () => {
        const farFuture = createTestDate('2999-12-31');
        const farFuturePlus1 = createTestDate('3000-01-01');

        expect(isDateRangeValid(farFuture, farFuturePlus1)).toBe(true);
        expect(calculateNights(farFuture, farFuturePlus1)).toBe(1);
      });

      it('should handle dates at year boundaries', () => {
        const dec31 = createTestDate('2024-12-31');
        const jan1 = createTestDate('2025-01-01');

        expect(isDateRangeValid(dec31, jan1)).toBe(true);
        expect(calculateNights(dec31, jan1)).toBe(1);
      });

      it('should handle leap year edge cases', () => {
        const feb28 = createTestDate('2024-02-28');
        const feb29 = createTestDate('2024-02-29');
        const mar1 = createTestDate('2024-03-01');

        expect(isDateRangeValid(feb28, feb29)).toBe(true);
        expect(isDateRangeValid(feb29, mar1)).toBe(true);
        expect(calculateNights(feb28, mar1)).toBe(2);
      });
    });

    describe('Timezone Edge Cases', () => {
      it('should handle dates across different timezones consistently', () => {
        const date1 = new Date('2024-01-15T00:00:00Z');
        const date2 = new Date('2024-01-15T23:59:59Z');
        const date3 = new Date('2024-01-16T00:00:00Z');

        // Same day in UTC should not be valid range
        expect(() => isDateRangeValid(date1, date2)).toThrow(DateValidationError);

        // Different days should be valid
        expect(isDateRangeValid(date1, date3)).toBe(true);
      });

      it('should normalize dates with different timezone offsets', () => {
        const checkIn = new Date('2024-01-15T14:00:00+05:00');
        const checkOut = new Date('2024-01-20T10:00:00-08:00');

        expect(isDateRangeValid(checkIn, checkOut)).toBe(true);
        expect(calculateNights(checkIn, checkOut)).toBeGreaterThanOrEqual(4);
      });
    });

    describe('Month Boundary Cases', () => {
      it('should handle end of month correctly', () => {
        const jan31 = createTestDate('2024-01-31');
        const feb1 = createTestDate('2024-02-01');

        expect(isDateRangeValid(jan31, feb1)).toBe(true);
        expect(calculateNights(jan31, feb1)).toBe(1);
      });

      it('should handle February to March transition', () => {
        const feb28 = createTestDate('2024-02-28');
        const mar1 = createTestDate('2024-03-01');

        expect(isDateRangeValid(feb28, mar1)).toBe(true);
        expect(calculateNights(feb28, mar1)).toBe(2); // Leap year
      });

      it('should handle 30-day month boundaries', () => {
        const apr30 = createTestDate('2024-04-30');
        const may1 = createTestDate('2024-05-01');

        expect(isDateRangeValid(apr30, may1)).toBe(true);
        expect(calculateNights(apr30, may1)).toBe(1);
      });
    });
  });
});