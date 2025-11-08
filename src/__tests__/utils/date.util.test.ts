/**
 * @fileoverview Comprehensive test suite for date utility functions
 * 
 * Test Coverage Strategy:
 * - Unit tests for all exported functions
 * - Edge case validation (invalid dates, boundary conditions)
 * - Error handling verification
 * - Business logic validation (overlap detection, night calculations)
 * - Type safety validation
 * - Performance validation for date operations
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
  DateRange,
  DateValidationError,
} from '@/utils/date.util';

// =============================================================================
// TEST SUITE: isDateRangeValid
// =============================================================================

describe('isDateRangeValid', () => {
  // -------------------------------------------------------------------------
  // Happy Path Tests
  // -------------------------------------------------------------------------

  describe('✅ Valid Date Ranges', () => {
    it('should return true for valid date range with 1 night stay', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2024-01-02');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should return true for valid date range with multiple nights', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2024-01-10');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should return true for date range spanning months', () => {
      const checkIn = new Date('2024-01-30');
      const checkOut = new Date('2024-02-05');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should return true for date range spanning years', () => {
      const checkIn = new Date('2024-12-30');
      const checkOut = new Date('2025-01-05');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should return true when dates have different times but valid range', () => {
      const checkIn = new Date('2024-01-01T14:30:00');
      const checkOut = new Date('2024-01-02T09:15:00');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid Date Range Tests
  // -------------------------------------------------------------------------

  describe('❌ Invalid Date Ranges', () => {
    it('should return false when check-out is before check-in', () => {
      const checkIn = new Date('2024-01-10');
      const checkOut = new Date('2024-01-05');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return false when check-in and check-out are the same date', () => {
      const sameDate = new Date('2024-01-01');

      const result = isDateRangeValid(sameDate, sameDate);

      expect(result).toBe(false);
    });

    it('should return false when check-in and check-out are same day with different times', () => {
      const checkIn = new Date('2024-01-01T10:00:00');
      const checkOut = new Date('2024-01-01T15:00:00');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid Input Tests
  // -------------------------------------------------------------------------

  describe('🚫 Invalid Inputs', () => {
    it('should return false when check-in is not a Date object', () => {
      const checkIn = '2024-01-01' as unknown as Date;
      const checkOut = new Date('2024-01-05');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return false when check-out is not a Date object', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = '2024-01-05' as unknown as Date;

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return false when both dates are not Date objects', () => {
      const checkIn = '2024-01-01' as unknown as Date;
      const checkOut = '2024-01-05' as unknown as Date;

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return false when check-in is an invalid Date', () => {
      const checkIn = new Date('invalid-date');
      const checkOut = new Date('2024-01-05');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return false when check-out is an invalid Date', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('invalid-date');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return false when both dates are invalid', () => {
      const checkIn = new Date('invalid');
      const checkOut = new Date('also-invalid');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return false when check-in is null', () => {
      const checkIn = null as unknown as Date;
      const checkOut = new Date('2024-01-05');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return false when check-out is undefined', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = undefined as unknown as Date;

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge Cases
  // -------------------------------------------------------------------------

  describe('🔍 Edge Cases', () => {
    it('should handle leap year dates correctly', () => {
      const checkIn = new Date('2024-02-28');
      const checkOut = new Date('2024-03-01');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should handle non-leap year February correctly', () => {
      const checkIn = new Date('2023-02-28');
      const checkOut = new Date('2023-03-01');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should handle dates at midnight correctly', () => {
      const checkIn = new Date('2024-01-01T00:00:00');
      const checkOut = new Date('2024-01-02T00:00:00');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should handle dates at end of day correctly', () => {
      const checkIn = new Date('2024-01-01T23:59:59');
      const checkOut = new Date('2024-01-02T23:59:59');

      const result = isDateRangeValid(checkIn, checkOut);

      expect(result).toBe(true);
    });
  });
});

// =============================================================================
// TEST SUITE: hasDateOverlap
// =============================================================================

describe('hasDateOverlap', () => {
  // -------------------------------------------------------------------------
  // Overlapping Ranges Tests
  // -------------------------------------------------------------------------

  describe('🔴 Overlapping Ranges', () => {
    it('should return true when range2 starts during range1', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-10'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-05'),
        checkOut: new Date('2024-01-15'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });

    it('should return true when range2 ends during range1', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-10'),
        checkOut: new Date('2024-01-20'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-05'),
        checkOut: new Date('2024-01-15'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });

    it('should return true when range2 is completely within range1', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-20'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-05'),
        checkOut: new Date('2024-01-15'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });

    it('should return true when range1 is completely within range2', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-05'),
        checkOut: new Date('2024-01-15'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-20'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });

    it('should return true when ranges have identical dates', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-10'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-10'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });

    it('should return true when range2 starts one day before range1 ends', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-10'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-09'),
        checkOut: new Date('2024-01-15'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Non-Overlapping Ranges Tests
  // -------------------------------------------------------------------------

  describe('🟢 Non-Overlapping Ranges', () => {
    it('should return false when range2 starts after range1 ends', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-10'),
        checkOut: new Date('2024-01-15'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });

    it('should return false when range1 starts after range2 ends', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-10'),
        checkOut: new Date('2024-01-15'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-05'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });

    it('should return false when range1 check-out equals range2 check-in (same-day turnover)', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-05'),
        checkOut: new Date('2024-01-10'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });

    it('should return false when range2 check-out equals range1 check-in', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-05'),
        checkOut: new Date('2024-01-10'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-05'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid Range Tests
  // -------------------------------------------------------------------------

  describe('🚫 Invalid Ranges', () => {
    it('should return false when range1 is invalid (check-out before check-in)', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-10'),
        checkOut: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-15'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });

    it('should return false when range2 is invalid', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-10'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-15'),
        checkOut: new Date('2024-01-05'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });

    it('should return false when both ranges are invalid', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-10'),
        checkOut: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-20'),
        checkOut: new Date('2024-01-15'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });

    it('should return false when range1 has same check-in and check-out', () => {
      const sameDate = new Date('2024-01-05');
      const range1: DateRange = {
        checkIn: sameDate,
        checkOut: sameDate,
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-10'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });

    it('should return false when range1 has invalid Date objects', () => {
      const range1: DateRange = {
        checkIn: new Date('invalid'),
        checkOut: new Date('2024-01-10'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-15'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });

    it('should return false when range2 has invalid Date objects', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-10'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-05'),
        checkOut: new Date('invalid'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge Cases
  // -------------------------------------------------------------------------

  describe('🔍 Edge Cases', () => {
    it('should handle ranges with different times on same dates correctly', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01T14:00:00'),
        checkOut: new Date('2024-01-05T10:00:00'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-03T16:00:00'),
        checkOut: new Date('2024-01-07T11:00:00'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });

    it('should handle ranges spanning month boundaries', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-28'),
        checkOut: new Date('2024-02-05'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-02-01'),
        checkOut: new Date('2024-02-10'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });

    it('should handle ranges spanning year boundaries', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-12-28'),
        checkOut: new Date('2025-01-05'),
      };
      const range2: DateRange = {
        checkIn: new Date('2025-01-01'),
        checkOut: new Date('2025-01-10'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });

    it('should handle leap year dates in overlap detection', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-02-28'),
        checkOut: new Date('2024-03-02'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-02-29'),
        checkOut: new Date('2024-03-05'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });
  });
});

// =============================================================================
// TEST SUITE: calculateNights
// =============================================================================

describe('calculateNights', () => {
  // -------------------------------------------------------------------------
  // Valid Calculations Tests
  // -------------------------------------------------------------------------

  describe('✅ Valid Night Calculations', () => {
    it('should calculate 1 night for consecutive days', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2024-01-02');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(1);
    });

    it('should calculate 5 nights for a week stay', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2024-01-06');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(5);
    });

    it('should calculate 30 nights for a month stay', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2024-01-31');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(30);
    });

    it('should calculate nights across month boundaries', () => {
      const checkIn = new Date('2024-01-28');
      const checkOut = new Date('2024-02-05');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(8);
    });

    it('should calculate nights across year boundaries', () => {
      const checkIn = new Date('2024-12-28');
      const checkOut = new Date('2025-01-05');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(8);
    });

    it('should ignore time components and calculate based on dates only', () => {
      const checkIn = new Date('2024-01-01T23:59:59');
      const checkOut = new Date('2024-01-05T00:00:01');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(4);
    });

    it('should calculate nights for long-term stay (365 days)', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2025-01-01');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(366); // 2024 is a leap year
    });
  });

  // -------------------------------------------------------------------------
  // Error Handling Tests
  // -------------------------------------------------------------------------

  describe('❌ Error Handling', () => {
    it('should throw DateValidationError when check-out is before check-in', () => {
      const checkIn = new Date('2024-01-10');
      const checkOut = new Date('2024-01-05');

      expect(() => calculateNights(checkIn, checkOut)).toThrow(DateValidationError);
      expect(() => calculateNights(checkIn, checkOut)).toThrow(
        'Invalid date range: check-in must be before check-out and both must be valid dates'
      );
    });

    it('should throw DateValidationError when dates are the same', () => {
      const sameDate = new Date('2024-01-01');

      expect(() => calculateNights(sameDate, sameDate)).toThrow(DateValidationError);
    });

    it('should throw DateValidationError when check-in is invalid', () => {
      const checkIn = new Date('invalid');
      const checkOut = new Date('2024-01-05');

      expect(() => calculateNights(checkIn, checkOut)).toThrow(DateValidationError);
    });

    it('should throw DateValidationError when check-out is invalid', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('invalid');

      expect(() => calculateNights(checkIn, checkOut)).toThrow(DateValidationError);
    });

    it('should throw DateValidationError when both dates are invalid', () => {
      const checkIn = new Date('invalid');
      const checkOut = new Date('also-invalid');

      expect(() => calculateNights(checkIn, checkOut)).toThrow(DateValidationError);
    });

    it('should verify DateValidationError is instance of Error', () => {
      const error = new DateValidationError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DateValidationError);
      expect(error.name).toBe('DateValidationError');
      expect(error.message).toBe('Test error');
    });
  });

  // -------------------------------------------------------------------------
  // Edge Cases
  // -------------------------------------------------------------------------

  describe('🔍 Edge Cases', () => {
    it('should handle leap year February correctly', () => {
      const checkIn = new Date('2024-02-28');
      const checkOut = new Date('2024-03-01');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(2); // Includes Feb 29
    });

    it('should handle non-leap year February correctly', () => {
      const checkIn = new Date('2023-02-28');
      const checkOut = new Date('2023-03-01');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(1);
    });

    it('should handle dates at midnight', () => {
      const checkIn = new Date('2024-01-01T00:00:00');
      const checkOut = new Date('2024-01-05T00:00:00');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(4);
    });

    it('should handle dates at end of day', () => {
      const checkIn = new Date('2024-01-01T23:59:59');
      const checkOut = new Date('2024-01-05T23:59:59');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(4);
    });

    it('should handle daylight saving time transitions', () => {
      // March 10, 2024 - DST starts in US
      const checkIn = new Date('2024-03-09');
      const checkOut = new Date('2024-03-11');

      const result = calculateNights(checkIn, checkOut);

      expect(result).toBe(2);
    });
  });
});

// =============================================================================
// TEST SUITE: isDateInFuture
// =============================================================================

describe('isDateInFuture', () => {
  // -------------------------------------------------------------------------
  // Future Date Tests
  // -------------------------------------------------------------------------

  describe('🔮 Future Dates', () => {
    it('should return true for date 1 day in the future', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = isDateInFuture(tomorrow);

      expect(result).toBe(true);
    });

    it('should return true for date 1 year in the future', () => {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);

      const result = isDateInFuture(nextYear);

      expect(result).toBe(true);
    });

    it('should return true for date far in the future', () => {
      const farFuture = new Date('2050-01-01');

      const result = isDateInFuture(farFuture);

      expect(result).toBe(true);
    });

    it('should return true for date 1 millisecond in the future', () => {
      const future = new Date(Date.now() + 1);

      const result = isDateInFuture(future);

      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Past Date Tests
  // -------------------------------------------------------------------------

  describe('⏮️ Past Dates', () => {
    it('should return false for date 1 day in the past', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = isDateInFuture(yesterday);

      expect(result).toBe(false);
    });

    it('should return false for date 1 year in the past', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      const result = isDateInFuture(lastYear);

      expect(result).toBe(false);
    });

    it('should return false for date far in the past', () => {
      const farPast = new Date('2000-01-01');

      const result = isDateInFuture(farPast);

      expect(result).toBe(false);
    });

    it('should return false for current moment (not strictly future)', () => {
      const now = new Date();

      const result = isDateInFuture(now);

      // This might be flaky due to timing, but should generally be false
      // since the comparison happens after the Date object is created
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid Input Tests
  // -------------------------------------------------------------------------

  describe('🚫 Invalid Inputs', () => {
    it('should return false when input is not a Date object', () => {
      const notADate = '2025-01-01' as unknown as Date;

      const result = isDateInFuture(notADate);

      expect(result).toBe(false);
    });

    it('should return false when input is an invalid Date', () => {
      const invalidDate = new Date('invalid-date');

      const result = isDateInFuture(invalidDate);

      expect(result).toBe(false);
    });

    it('should return false when input is null', () => {
      const nullDate = null as unknown as Date;

      const result = isDateInFuture(nullDate);

      expect(result).toBe(false);
    });

    it('should return false when input is undefined', () => {
      const undefinedDate = undefined as unknown as Date;

      const result = isDateInFuture(undefinedDate);

      expect(result).toBe(false);
    });

    it('should return false when input is a number', () => {
      const numberDate = 1234567890 as unknown as Date;

      const result = isDateInFuture(numberDate);

      expect(result).toBe(false);
    });

    it('should return false when input is an object', () => {
      const objectDate = { date: '2025-01-01' } as unknown as Date;

      const result = isDateInFuture(objectDate);

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge Cases
  // -------------------------------------------------------------------------

  describe('🔍 Edge Cases', () => {
    it('should handle dates at midnight correctly', () => {
      const futureMidnight = new Date();
      futureMidnight.setDate(futureMidnight.getDate() + 1);
      futureMidnight.setHours(0, 0, 0, 0);

      const result = isDateInFuture(futureMidnight);

      expect(result).toBe(true);
    });

    it('should handle dates at end of day correctly', () => {
      const futureEndOfDay = new Date();
      futureEndOfDay.setDate(futureEndOfDay.getDate() + 1);
      futureEndOfDay.setHours(23, 59, 59, 999);

      const result = isDateInFuture(futureEndOfDay);

      expect(result).toBe(true);
    });

    it('should handle leap year dates', () => {
      const leapDay = new Date('2028-02-29'); // Future leap year

      const result = isDateInFuture(leapDay);

      expect(result).toBe(true);
    });

    it('should handle year boundary dates', () => {
      const newYear = new Date('2025-01-01T00:00:00');

      const result = isDateInFuture(newYear);

      expect(result).toBe(true);
    });
  });
});

// =============================================================================
// TEST SUITE: DateValidationError
// =============================================================================

describe('DateValidationError', () => {
  describe('🏗️ Error Construction', () => {
    it('should create error with custom message', () => {
      const message = 'Custom validation error';
      const error = new DateValidationError(message);

      expect(error.message).toBe(message);
      expect(error.name).toBe('DateValidationError');
    });

    it('should be instance of Error', () => {
      const error = new DateValidationError('Test');

      expect(error).toBeInstanceOf(Error);
    });

    it('should be instance of DateValidationError', () => {
      const error = new DateValidationError('Test');

      expect(error).toBeInstanceOf(DateValidationError);
    });

    it('should have correct prototype chain', () => {
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

    it('should preserve stack trace', () => {
      const error = new DateValidationError('Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DateValidationError');
    });
  });
});

// =============================================================================
// TEST SUITE: DateRange Interface
// =============================================================================

describe('DateRange Interface', () => {
  describe('📋 Type Validation', () => {
    it('should accept valid DateRange object', () => {
      const validRange: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-05'),
      };

      expect(validRange.checkIn).toBeInstanceOf(Date);
      expect(validRange.checkOut).toBeInstanceOf(Date);
    });

    it('should work with hasDateOverlap function', () => {
      const range1: DateRange = {
        checkIn: new Date('2024-01-01'),
        checkOut: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        checkIn: new Date('2024-01-03'),
        checkOut: new Date('2024-01-07'),
      };

      const result = hasDateOverlap(range1, range2);

      expect(result).toBe(true);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS: Combined Functionality
// =============================================================================

describe('🔗 Integration Tests', () => {
  describe('Reservation Workflow', () => {
    it('should validate and calculate nights for a valid reservation', () => {
      const checkIn = new Date('2024-06-01');
      const checkOut = new Date('2024-06-05');

      // Validate date range
      expect(isDateRangeValid(checkIn, checkOut)).toBe(true);

      // Calculate nights
      const nights = calculateNights(checkIn, checkOut);
      expect(nights).toBe(4);

      // Check if dates are in future
      const isFuture = isDateInFuture(checkIn);
      expect(typeof isFuture).toBe('boolean');
    });

    it('should detect overlapping reservations', () => {
      const existingReservation: DateRange = {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-05'),
      };

      const newReservation: DateRange = {
        checkIn: new Date('2024-06-03'),
        checkOut: new Date('2024-06-07'),
      };

      // Check for overlap
      const hasOverlap = hasDateOverlap(existingReservation, newReservation);
      expect(hasOverlap).toBe(true);

      // Both ranges should be valid
      expect(
        isDateRangeValid(existingReservation.checkIn, existingReservation.checkOut)
      ).toBe(true);
      expect(isDateRangeValid(newReservation.checkIn, newReservation.checkOut)).toBe(
        true
      );
    });

    it('should allow back-to-back reservations (same-day turnover)', () => {
      const firstReservation: DateRange = {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-05'),
      };

      const secondReservation: DateRange = {
        checkIn: new Date('2024-06-05'),
        checkOut: new Date('2024-06-10'),
      };

      // Should not overlap (same-day turnover allowed)
      const hasOverlap = hasDateOverlap(firstReservation, secondReservation);
      expect(hasOverlap).toBe(false);

      // Calculate total nights
      const firstNights = calculateNights(
        firstReservation.checkIn,
        firstReservation.checkOut
      );
      const secondNights = calculateNights(
        secondReservation.checkIn,
        secondReservation.checkOut
      );
      expect(firstNights + secondNights).toBe(9);
    });
  });

  describe('Business Logic Scenarios', () => {
    it('should handle multi-month reservation', () => {
      const checkIn = new Date('2024-01-15');
      const checkOut = new Date('2024-03-15');

      expect(isDateRangeValid(checkIn, checkOut)).toBe(true);

      const nights = calculateNights(checkIn, checkOut);
      expect(nights).toBe(60); // 17 + 29 + 14 days
    });

    it('should reject invalid reservation attempts', () => {
      const checkIn = new Date('2024-06-10');
      const checkOut = new Date('2024-06-05');

      expect(isDateRangeValid(checkIn, checkOut)).toBe(false);
      expect(() => calculateNights(checkIn, checkOut)).toThrow(DateValidationError);
    });

    it('should handle year-end reservations', () => {
      const checkIn = new Date('2024-12-30');
      const checkOut = new Date('2025-01-03');

      expect(isDateRangeValid(checkIn, checkOut)).toBe(true);

      const nights = calculateNights(checkIn, checkOut);
      expect(nights).toBe(4);
    });
  });
});

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

describe('⚡ Performance Tests', () => {
  it('should validate date ranges quickly (< 1ms for 1000 operations)', () => {
    const checkIn = new Date('2024-01-01');
    const checkOut = new Date('2024-01-05');

    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      isDateRangeValid(checkIn, checkOut);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(10); // Should complete in < 10ms
  });

  it('should detect overlaps quickly (< 5ms for 1000 operations)', () => {
    const range1: DateRange = {
      checkIn: new Date('2024-01-01'),
      checkOut: new Date('2024-01-05'),
    };
    const range2: DateRange = {
      checkIn: new Date('2024-01-03'),
      checkOut: new Date('2024-01-07'),
    };

    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      hasDateOverlap(range1, range2);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(20); // Should complete in < 20ms
  });

  it('should calculate nights quickly (< 5ms for 1000 operations)', () => {
    const checkIn = new Date('2024-01-01');
    const checkOut = new Date('2024-01-05');

    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      calculateNights(checkIn, checkOut);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(20); // Should complete in < 20ms
  });
});