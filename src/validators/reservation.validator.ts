// =============================================================================
// RESERVATION VALIDATOR - EXPRESS-VALIDATOR RULES FOR RESERVATION ENDPOINTS
// =============================================================================
// This module defines comprehensive validation rules for reservation management
// endpoints using express-validator. Implements strict validation for dates,
// UUIDs, status transitions, and business logic constraints.
//
// Validation Strategy:
// - Input sanitization at API boundary
// - Type-safe validation with TypeScript
// - Business rule enforcement (date ranges, status transitions)
// - Comprehensive error messages for client feedback
// =============================================================================

import { body, param, query, ValidationChain } from 'express-validator';
import { ReservationStatus } from '../types/reservation.types.js';

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

/**
 * UUID v4 regex pattern for strict validation
 * Matches format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * ISO 8601 date format regex (YYYY-MM-DD)
 * Validates basic date format structure
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Minimum advance booking time in milliseconds (0 days - same day booking allowed)
 */
const MIN_ADVANCE_BOOKING_MS = 0;

/**
 * Maximum advance booking time in milliseconds (365 days)
 */
const MAX_ADVANCE_BOOKING_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Minimum stay duration in milliseconds (1 day)
 */
const MIN_STAY_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Maximum stay duration in milliseconds (30 days)
 */
const MAX_STAY_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Valid reservation status values
 */
const VALID_STATUSES = Object.values(ReservationStatus);

// =============================================================================
// FIELD VALIDATORS - REUSABLE VALIDATION CHAINS
// =============================================================================

/**
 * Validates roomId field as UUID v4
 * Used in reservation creation
 *
 * @returns ValidationChain for roomId field
 */
function roomIdValidation(): ValidationChain {
  return body('roomId')
    .trim()
    .notEmpty()
    .withMessage('Room ID is required')
    .isUUID(4)
    .withMessage('Room ID must be a valid UUID v4')
    .matches(UUID_V4_REGEX)
    .withMessage('Room ID format is invalid');
}

/**
 * Validates checkInDate field
 * Ensures date is in ISO format and not in the past
 *
 * @returns ValidationChain for checkInDate field
 */
function checkInDateValidation(): ValidationChain {
  return body('checkInDate')
    .trim()
    .notEmpty()
    .withMessage('Check-in date is required')
    .matches(ISO_DATE_REGEX)
    .withMessage('Check-in date must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value: string) => {
      const checkInDate = new Date(value);

      // Validate date is valid
      if (isNaN(checkInDate.getTime())) {
        throw new Error('Check-in date is not a valid date');
      }

      // Normalize to start of day for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      checkInDate.setHours(0, 0, 0, 0);

      // Check if date is not in the past
      if (checkInDate < today) {
        throw new Error('Check-in date cannot be in the past');
      }

      // Check maximum advance booking
      const maxDate = new Date(today.getTime() + MAX_ADVANCE_BOOKING_MS);
      if (checkInDate > maxDate) {
        throw new Error('Check-in date cannot be more than 365 days in advance');
      }

      return true;
    });
}

/**
 * Validates checkOutDate field
 * Ensures date is in ISO format and after checkInDate
 *
 * @returns ValidationChain for checkOutDate field
 */
function checkOutDateValidation(): ValidationChain {
  return body('checkOutDate')
    .trim()
    .notEmpty()
    .withMessage('Check-out date is required')
    .matches(ISO_DATE_REGEX)
    .withMessage('Check-out date must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value: string, { req }) => {
      const checkOutDate = new Date(value);

      // Validate date is valid
      if (isNaN(checkOutDate.getTime())) {
        throw new Error('Check-out date is not a valid date');
      }

      // Validate checkInDate exists and is valid
      if (!req.body.checkInDate) {
        throw new Error('Check-in date is required to validate check-out date');
      }

      const checkInDate = new Date(req.body.checkInDate);
      if (isNaN(checkInDate.getTime())) {
        throw new Error('Check-in date must be valid to validate check-out date');
      }

      // Normalize to start of day for comparison
      checkInDate.setHours(0, 0, 0, 0);
      checkOutDate.setHours(0, 0, 0, 0);

      // Check if checkout is after checkin
      if (checkOutDate <= checkInDate) {
        throw new Error('Check-out date must be after check-in date');
      }

      // Validate minimum stay duration
      const stayDuration = checkOutDate.getTime() - checkInDate.getTime();
      if (stayDuration < MIN_STAY_DURATION_MS) {
        throw new Error('Minimum stay duration is 1 day');
      }

      // Validate maximum stay duration
      if (stayDuration > MAX_STAY_DURATION_MS) {
        throw new Error('Maximum stay duration is 30 days');
      }

      return true;
    });
}

/**
 * Validates reservation ID parameter as UUID v4
 * Used in all endpoints with :id parameter
 *
 * @returns ValidationChain for id parameter
 */
function reservationIdParamValidation(): ValidationChain {
  return param('id')
    .trim()
    .notEmpty()
    .withMessage('Reservation ID is required')
    .isUUID(4)
    .withMessage('Reservation ID must be a valid UUID v4')
    .matches(UUID_V4_REGEX)
    .withMessage('Reservation ID format is invalid');
}

/**
 * Validates status field for reservation status updates
 * Ensures status is a valid ReservationStatus enum value
 *
 * @returns ValidationChain for status field
 */
function statusBodyValidation(): ValidationChain {
  return body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(VALID_STATUSES)
    .withMessage(
      `Status must be one of: ${VALID_STATUSES.join(', ')}`
    )
    .custom((value: string) => {
      // Additional validation for status enum
      if (!Object.values(ReservationStatus).includes(value as ReservationStatus)) {
        throw new Error('Invalid reservation status');
      }
      return true;
    });
}

/**
 * Validates status query parameter for filtering
 * Optional field for reservation list filtering
 *
 * @returns ValidationChain for status query parameter
 */
function statusQueryValidation(): ValidationChain {
  return query('status')
    .optional()
    .trim()
    .isIn(VALID_STATUSES)
    .withMessage(
      `Status must be one of: ${VALID_STATUSES.join(', ')}`
    );
}

/**
 * Validates userId query parameter for filtering
 * Optional field for admin filtering by user
 *
 * @returns ValidationChain for userId query parameter
 */
function userIdQueryValidation(): ValidationChain {
  return query('userId')
    .optional()
    .trim()
    .isUUID(4)
    .withMessage('User ID must be a valid UUID v4')
    .matches(UUID_V4_REGEX)
    .withMessage('User ID format is invalid');
}

/**
 * Validates roomId query parameter for filtering
 * Optional field for filtering by room
 *
 * @returns ValidationChain for roomId query parameter
 */
function roomIdQueryValidation(): ValidationChain {
  return query('roomId')
    .optional()
    .trim()
    .isUUID(4)
    .withMessage('Room ID must be a valid UUID v4')
    .matches(UUID_V4_REGEX)
    .withMessage('Room ID format is invalid');
}

/**
 * Validates dateFrom query parameter for date range filtering
 * Optional field for filtering reservations by date range
 *
 * @returns ValidationChain for dateFrom query parameter
 */
function dateFromQueryValidation(): ValidationChain {
  return query('dateFrom')
    .optional()
    .trim()
    .matches(ISO_DATE_REGEX)
    .withMessage('Date from must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value: string) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Date from is not a valid date');
      }
      return true;
    });
}

/**
 * Validates dateTo query parameter for date range filtering
 * Optional field for filtering reservations by date range
 * Must be after dateFrom if both are provided
 *
 * @returns ValidationChain for dateTo query parameter
 */
function dateToQueryValidation(): ValidationChain {
  return query('dateTo')
    .optional()
    .trim()
    .matches(ISO_DATE_REGEX)
    .withMessage('Date to must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value: string, { req }) => {
      const dateTo = new Date(value);

      // Validate date is valid
      if (isNaN(dateTo.getTime())) {
        throw new Error('Date to is not a valid date');
      }

      // If dateFrom is provided, validate dateTo is after dateFrom
      if (req.query.dateFrom) {
        const dateFrom = new Date(req.query.dateFrom as string);
        if (!isNaN(dateFrom.getTime())) {
          dateFrom.setHours(0, 0, 0, 0);
          dateTo.setHours(0, 0, 0, 0);

          if (dateTo < dateFrom) {
            throw new Error('Date to must be after date from');
          }
        }
      }

      return true;
    });
}

/**
 * Validates page query parameter for pagination
 * Optional field with default value of 1
 *
 * @returns ValidationChain for page query parameter
 */
function pageQueryValidation(): ValidationChain {
  return query('page')
    .optional()
    .trim()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt();
}

/**
 * Validates limit query parameter for pagination
 * Optional field with default value of 10, max 100
 *
 * @returns ValidationChain for limit query parameter
 */
function limitQueryValidation(): ValidationChain {
  return query('limit')
    .optional()
    .trim()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100')
    .toInt();
}

// =============================================================================
// EXPORTED VALIDATION ARRAYS
// =============================================================================

/**
 * Validation rules for POST /api/reservations
 * Creates a new reservation with availability check
 *
 * Validates:
 * - roomId: Valid UUID v4
 * - checkInDate: ISO date, not in past, within 365 days
 * - checkOutDate: ISO date, after checkInDate, valid stay duration
 *
 * Business Rules:
 * - Check-in date cannot be in the past
 * - Check-out date must be after check-in date
 * - Minimum stay: 1 day
 * - Maximum stay: 30 days
 * - Maximum advance booking: 365 days
 */
export const createReservationValidation: ValidationChain[] = [
  roomIdValidation(),
  checkInDateValidation(),
  checkOutDateValidation(),
];

/**
 * Validation rules for GET /api/reservations/:id
 * Retrieves a specific reservation by ID
 *
 * Validates:
 * - id: Valid UUID v4 parameter
 */
export const reservationIdValidation: ValidationChain[] = [
  reservationIdParamValidation(),
];

/**
 * Validation rules for PUT /api/reservations/:id/confirm
 * Confirms a pending reservation (admin only)
 *
 * Validates:
 * - id: Valid UUID v4 parameter
 *
 * Note: Status transition validation handled in service layer
 */
export const confirmReservationValidation: ValidationChain[] = [
  reservationIdParamValidation(),
];

/**
 * Validation rules for PUT /api/reservations/:id/check-in
 * Processes guest check-in (admin only)
 *
 * Validates:
 * - id: Valid UUID v4 parameter
 *
 * Note: Status transition validation handled in service layer
 */
export const checkInReservationValidation: ValidationChain[] = [
  reservationIdParamValidation(),
];

/**
 * Validation rules for PUT /api/reservations/:id/check-out
 * Processes guest check-out (admin only)
 *
 * Validates:
 * - id: Valid UUID v4 parameter
 *
 * Note: Status transition validation handled in service layer
 */
export const checkOutReservationValidation: ValidationChain[] = [
  reservationIdParamValidation(),
];

/**
 * Validation rules for PUT /api/reservations/:id/cancel
 * Cancels a reservation
 *
 * Validates:
 * - id: Valid UUID v4 parameter
 *
 * Note: Authorization and status transition validation handled in service layer
 */
export const cancelReservationValidation: ValidationChain[] = [
  reservationIdParamValidation(),
];

/**
 * Validation rules for GET /api/reservations
 * Lists reservations with optional filtering and pagination
 *
 * Validates:
 * - status: Optional, valid ReservationStatus enum
 * - userId: Optional, valid UUID v4 (admin only)
 * - roomId: Optional, valid UUID v4
 * - dateFrom: Optional, valid ISO date
 * - dateTo: Optional, valid ISO date, after dateFrom
 * - page: Optional, positive integer (default: 1)
 * - limit: Optional, integer 1-100 (default: 10)
 *
 * Authorization:
 * - Guests see only their own reservations
 * - Admins can filter by userId
 */
export const listReservationsValidation: ValidationChain[] = [
  statusQueryValidation(),
  userIdQueryValidation(),
  roomIdQueryValidation(),
  dateFromQueryValidation(),
  dateToQueryValidation(),
  pageQueryValidation(),
  limitQueryValidation(),
];

/**
 * Validation rules for generic status update
 * Used for custom status transitions if needed
 *
 * Validates:
 * - id: Valid UUID v4 parameter
 * - status: Valid ReservationStatus enum value
 *
 * Note: Prefer specific endpoints (confirm, check-in, check-out, cancel)
 * over generic status updates for better API semantics
 */
export const updateReservationStatusValidation: ValidationChain[] = [
  reservationIdParamValidation(),
  statusBodyValidation(),
];

// =============================================================================
// TYPE EXPORTS FOR TESTING
// =============================================================================

/**
 * Export validation constants for use in tests
 */
export const VALIDATION_CONSTANTS = {
  UUID_V4_REGEX,
  ISO_DATE_REGEX,
  MIN_ADVANCE_BOOKING_MS,
  MAX_ADVANCE_BOOKING_MS,
  MIN_STAY_DURATION_MS,
  MAX_STAY_DURATION_MS,
  VALID_STATUSES,
} as const;