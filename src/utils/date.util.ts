/**
 * Date utility functions for reservation management
 * 
 * Provides type-safe date validation and manipulation functions for handling
 * reservation date ranges, overlap detection, and business logic calculations.
 * 
 * @module utils/date.util
 */

/**
 * Represents a date range with check-in and check-out dates
 */
export interface DateRange {
  checkIn: Date;
  checkOut: Date;
}

/**
 * Custom error for date validation failures
 */
export class DateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateValidationError';
    Object.setPrototypeOf(this, DateValidationError.prototype);
  }
}

/**
 * Validates that a date range is valid for reservations
 * 
 * Rules:
 * - Check-in date must be before check-out date
 * - Both dates must be valid Date objects
 * - Dates must not be the same (minimum 1 night stay)
 * 
 * @param checkIn - The check-in date
 * @param checkOut - The check-out date
 * @returns true if the date range is valid, false otherwise
 * 
 * @example
 * ```typescript
 * const checkIn = new Date('2024-01-01');
 * const checkOut = new Date('2024-01-05');
 * isDateRangeValid(checkIn, checkOut); // true
 * 
 * const invalid = new Date('2024-01-05');
 * isDateRangeValid(checkOut, invalid); // false (same date)
 * ```
 */
export function isDateRangeValid(checkIn: Date, checkOut: Date): boolean {
  // Validate that both parameters are valid Date objects
  if (!(checkIn instanceof Date) || !(checkOut instanceof Date)) {
    return false;
  }

  // Check for invalid dates (NaN timestamps)
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return false;
  }

  // Normalize dates to midnight for accurate comparison
  const normalizedCheckIn = new Date(checkIn);
  normalizedCheckIn.setHours(0, 0, 0, 0);

  const normalizedCheckOut = new Date(checkOut);
  normalizedCheckOut.setHours(0, 0, 0, 0);

  // Check-in must be before check-out (minimum 1 night stay)
  return normalizedCheckIn.getTime() < normalizedCheckOut.getTime();
}

/**
 * Checks if two date ranges overlap
 * 
 * Two ranges overlap if:
 * - Range1 starts before Range2 ends AND
 * - Range1 ends after Range2 starts
 * 
 * Edge cases handled:
 * - Same-day check-out/check-in is NOT considered an overlap
 * - Invalid date ranges return false
 * 
 * @param range1 - First date range
 * @param range2 - Second date range
 * @returns true if the ranges overlap, false otherwise
 * 
 * @example
 * ```typescript
 * const range1 = {
 *   checkIn: new Date('2024-01-01'),
 *   checkOut: new Date('2024-01-05')
 * };
 * const range2 = {
 *   checkIn: new Date('2024-01-03'),
 *   checkOut: new Date('2024-01-07')
 * };
 * hasDateOverlap(range1, range2); // true
 * 
 * const range3 = {
 *   checkIn: new Date('2024-01-05'),
 *   checkOut: new Date('2024-01-10')
 * };
 * hasDateOverlap(range1, range3); // false (check-out = check-in is allowed)
 * ```
 */
export function hasDateOverlap(range1: DateRange, range2: DateRange): boolean {
  // Validate both date ranges
  if (!isDateRangeValid(range1.checkIn, range1.checkOut)) {
    return false;
  }

  if (!isDateRangeValid(range2.checkIn, range2.checkOut)) {
    return false;
  }

  // Normalize all dates to midnight for accurate comparison
  const r1CheckIn = new Date(range1.checkIn);
  r1CheckIn.setHours(0, 0, 0, 0);

  const r1CheckOut = new Date(range1.checkOut);
  r1CheckOut.setHours(0, 0, 0, 0);

  const r2CheckIn = new Date(range2.checkIn);
  r2CheckIn.setHours(0, 0, 0, 0);

  const r2CheckOut = new Date(range2.checkOut);
  r2CheckOut.setHours(0, 0, 0, 0);

  // Check for overlap: range1 starts before range2 ends AND range1 ends after range2 starts
  // Note: Same-day check-out/check-in is NOT an overlap (< instead of <=)
  return (
    r1CheckIn.getTime() < r2CheckOut.getTime() &&
    r1CheckOut.getTime() > r2CheckIn.getTime()
  );
}

/**
 * Calculates the number of nights between check-in and check-out dates
 * 
 * @param checkIn - The check-in date
 * @param checkOut - The check-out date
 * @returns The number of nights, or 0 if the date range is invalid
 * 
 * @throws {DateValidationError} If the date range is invalid
 * 
 * @example
 * ```typescript
 * const checkIn = new Date('2024-01-01');
 * const checkOut = new Date('2024-01-05');
 * calculateNights(checkIn, checkOut); // 4
 * 
 * const sameDay = new Date('2024-01-01');
 * calculateNights(sameDay, sameDay); // throws DateValidationError
 * ```
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  // Validate the date range
  if (!isDateRangeValid(checkIn, checkOut)) {
    throw new DateValidationError(
      'Invalid date range: check-in must be before check-out and both must be valid dates'
    );
  }

  // Normalize dates to midnight for accurate calculation
  const normalizedCheckIn = new Date(checkIn);
  normalizedCheckIn.setHours(0, 0, 0, 0);

  const normalizedCheckOut = new Date(checkOut);
  normalizedCheckOut.setHours(0, 0, 0, 0);

  // Calculate difference in milliseconds
  const diffMs = normalizedCheckOut.getTime() - normalizedCheckIn.getTime();

  // Convert milliseconds to days (1 day = 24 * 60 * 60 * 1000 ms)
  const nights = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return nights;
}

/**
 * Checks if a date is in the future (after current date/time)
 * 
 * @param date - The date to check
 * @returns true if the date is in the future, false otherwise
 * 
 * @example
 * ```typescript
 * const futureDate = new Date('2025-01-01');
 * isDateInFuture(futureDate); // true (assuming current date is before 2025)
 * 
 * const pastDate = new Date('2020-01-01');
 * isDateInFuture(pastDate); // false
 * 
 * const invalidDate = new Date('invalid');
 * isDateInFuture(invalidDate); // false
 * ```
 */
export function isDateInFuture(date: Date): boolean {
  // Validate that the parameter is a valid Date object
  if (!(date instanceof Date)) {
    return false;
  }

  // Check for invalid date (NaN timestamp)
  if (isNaN(date.getTime())) {
    return false;
  }

  // Compare with current date/time
  const now = new Date();
  return date.getTime() > now.getTime();
}