/**
 * Date Utility Functions for Reservation Management
 * 
 * Provides comprehensive date validation and manipulation utilities for the reservation system.
 * Handles date range validation, overlap detection, night calculations, and future date checks.
 * 
 * @module utils/date.util
 */

/**
 * Custom error class for date-related validation errors
 */
export class DateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateValidationError';
    Object.setPrototypeOf(this, DateValidationError.prototype);
  }
}

/**
 * Represents a date range with check-in and check-out dates
 */
export interface DateRange {
  checkIn: Date;
  checkOut: Date;
}

/**
 * Type guard to check if a value is a valid Date object
 * 
 * @param value - Value to check
 * @returns True if value is a valid Date object
 */
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Normalizes a date to midnight UTC to ensure consistent date comparisons
 * 
 * @param date - Date to normalize
 * @returns New Date object set to midnight UTC
 */
function normalizeToMidnightUTC(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Validates that a date range is valid for reservations
 * 
 * Business rules:
 * - Check-in date must be a valid Date object
 * - Check-out date must be a valid Date object
 * - Check-out date must be after check-in date
 * - Minimum stay is 1 night
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns True if the date range is valid
 * @throws {DateValidationError} If validation fails
 * 
 * @example
 * const checkIn = new Date('2024-01-15');
 * const checkOut = new Date('2024-01-20');
 * isDateRangeValid(checkIn, checkOut); // true
 * 
 * @example
 * const checkIn = new Date('2024-01-20');
 * const checkOut = new Date('2024-01-15');
 * isDateRangeValid(checkIn, checkOut); // throws DateValidationError
 */
export function isDateRangeValid(checkIn: Date, checkOut: Date): boolean {
  // Validate input types
  if (!isValidDate(checkIn)) {
    throw new DateValidationError('Check-in date must be a valid Date object');
  }

  if (!isValidDate(checkOut)) {
    throw new DateValidationError('Check-out date must be a valid Date object');
  }

  // Normalize dates to midnight UTC for accurate comparison
  const normalizedCheckIn = normalizeToMidnightUTC(checkIn);
  const normalizedCheckOut = normalizeToMidnightUTC(checkOut);

  // Check-out must be after check-in
  if (normalizedCheckOut <= normalizedCheckIn) {
    throw new DateValidationError(
      'Check-out date must be after check-in date (minimum stay: 1 night)'
    );
  }

  return true;
}

/**
 * Checks if two date ranges overlap
 * 
 * Two date ranges overlap if:
 * - Range1 starts before Range2 ends AND
 * - Range1 ends after Range2 starts
 * 
 * Edge cases handled:
 * - Same-day check-out and check-in do NOT overlap (standard hotel practice)
 * - Ranges that touch at boundaries do not overlap
 * 
 * @param range1 - First date range
 * @param range2 - Second date range
 * @returns True if the date ranges overlap
 * @throws {DateValidationError} If either range is invalid
 * 
 * @example
 * const range1 = { checkIn: new Date('2024-01-15'), checkOut: new Date('2024-01-20') };
 * const range2 = { checkIn: new Date('2024-01-18'), checkOut: new Date('2024-01-25') };
 * hasDateOverlap(range1, range2); // true (overlaps from Jan 18-20)
 * 
 * @example
 * const range1 = { checkIn: new Date('2024-01-15'), checkOut: new Date('2024-01-20') };
 * const range2 = { checkIn: new Date('2024-01-20'), checkOut: new Date('2024-01-25') };
 * hasDateOverlap(range1, range2); // false (touching boundaries, no overlap)
 */
export function hasDateOverlap(range1: DateRange, range2: DateRange): boolean {
  // Validate both ranges
  isDateRangeValid(range1.checkIn, range1.checkOut);
  isDateRangeValid(range2.checkIn, range2.checkOut);

  // Normalize all dates to midnight UTC
  const range1CheckIn = normalizeToMidnightUTC(range1.checkIn);
  const range1CheckOut = normalizeToMidnightUTC(range1.checkOut);
  const range2CheckIn = normalizeToMidnightUTC(range2.checkIn);
  const range2CheckOut = normalizeToMidnightUTC(range2.checkOut);

  // Check for overlap using standard interval overlap algorithm
  // Ranges overlap if: range1.start < range2.end AND range1.end > range2.start
  // Using < and > (not <= and >=) means touching boundaries don't count as overlap
  const overlaps =
    range1CheckIn < range2CheckOut && range1CheckOut > range2CheckIn;

  return overlaps;
}

/**
 * Calculates the number of nights between check-in and check-out dates
 * 
 * Business logic:
 * - Nights are calculated as full 24-hour periods
 * - Partial days are not counted as nights
 * - Minimum result is 1 night for valid date ranges
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights between the dates
 * @throws {DateValidationError} If the date range is invalid
 * 
 * @example
 * const checkIn = new Date('2024-01-15');
 * const checkOut = new Date('2024-01-20');
 * calculateNights(checkIn, checkOut); // 5
 * 
 * @example
 * const checkIn = new Date('2024-01-15T14:00:00');
 * const checkOut = new Date('2024-01-16T10:00:00');
 * calculateNights(checkIn, checkOut); // 1 (partial days normalized to full nights)
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  // Validate the date range
  isDateRangeValid(checkIn, checkOut);

  // Normalize dates to midnight UTC for accurate calculation
  const normalizedCheckIn = normalizeToMidnightUTC(checkIn);
  const normalizedCheckOut = normalizeToMidnightUTC(checkOut);

  // Calculate difference in milliseconds
  const diffInMs = normalizedCheckOut.getTime() - normalizedCheckIn.getTime();

  // Convert milliseconds to days (24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
  const msPerDay = 24 * 60 * 60 * 1000;
  const nights = Math.floor(diffInMs / msPerDay);

  // Ensure minimum of 1 night (should always be true after validation)
  return Math.max(nights, 1);
}

/**
 * Checks if a date is in the future relative to the current time
 * 
 * Business logic:
 * - Compares against current server time
 * - Uses normalized dates (midnight UTC) for consistency
 * - Today is considered "not in the future"
 * 
 * @param date - Date to check
 * @returns True if the date is in the future
 * @throws {DateValidationError} If the date is invalid
 * 
 * @example
 * const futureDate = new Date('2025-12-31');
 * isDateInFuture(futureDate); // true (assuming current date is before 2025-12-31)
 * 
 * @example
 * const today = new Date();
 * isDateInFuture(today); // false (today is not in the future)
 * 
 * @example
 * const pastDate = new Date('2020-01-01');
 * isDateInFuture(pastDate); // false
 */
export function isDateInFuture(date: Date): boolean {
  // Validate input
  if (!isValidDate(date)) {
    throw new DateValidationError('Date must be a valid Date object');
  }

  // Get current date normalized to midnight UTC
  const now = normalizeToMidnightUTC(new Date());

  // Normalize input date to midnight UTC
  const normalizedDate = normalizeToMidnightUTC(date);

  // Date is in the future if it's strictly greater than today
  return normalizedDate > now;
}

/**
 * Type guard to validate DateRange objects
 * 
 * @param value - Value to check
 * @returns True if value is a valid DateRange
 */
export function isDateRange(value: unknown): value is DateRange {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    'checkIn' in obj &&
    'checkOut' in obj &&
    isValidDate(obj.checkIn) &&
    isValidDate(obj.checkOut)
  );
}

/**
 * Validates that a check-in date is valid for new reservations
 * 
 * Business rules:
 * - Check-in date must be today or in the future
 * - Cannot book reservations for past dates
 * 
 * @param checkIn - Check-in date to validate
 * @returns True if check-in date is valid for booking
 * @throws {DateValidationError} If validation fails
 * 
 * @example
 * const tomorrow = new Date();
 * tomorrow.setDate(tomorrow.getDate() + 1);
 * isValidCheckInDate(tomorrow); // true
 * 
 * @example
 * const yesterday = new Date();
 * yesterday.setDate(yesterday.getDate() - 1);
 * isValidCheckInDate(yesterday); // throws DateValidationError
 */
export function isValidCheckInDate(checkIn: Date): boolean {
  // Validate input
  if (!isValidDate(checkIn)) {
    throw new DateValidationError('Check-in date must be a valid Date object');
  }

  // Get current date normalized to midnight UTC
  const today = normalizeToMidnightUTC(new Date());

  // Normalize check-in date to midnight UTC
  const normalizedCheckIn = normalizeToMidnightUTC(checkIn);

  // Check-in must be today or in the future
  if (normalizedCheckIn < today) {
    throw new DateValidationError(
      'Check-in date cannot be in the past. Reservations must be for today or future dates.'
    );
  }

  return true;
}

/**
 * Export all types for external use
 */
export type { DateRange };