// =============================================================================
// RESERVATION VALIDATOR - INPUT VALIDATION FOR RESERVATION ENDPOINTS
// =============================================================================
// This module provides express-validator validation chains for reservation
// management endpoints including creation, status updates, and filtering.
//
// Validation Strategy:
// - All inputs validated at API boundary
// - Business logic validation (dates, availability) in service layer
// - Comprehensive error messages for client feedback
// - Type-safe validation with TypeScript integration
// =============================================================================

import { body, param, query } from 'express-validator';
import type { ValidationChain } from 'express-validator';
import { ReservationStatus } from '../types/reservation.types.js';

// =============================================================================
// CONSTANTS - Validation configuration
// =============================================================================

/**
 * Valid reservation status values for validation
 * Synchronized with Prisma schema enum
 */
const VALID_STATUSES: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
];

/**
 * UUID v4 regex pattern for strict validation
 * Matches format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * ISO 8601 date format regex (YYYY-MM-DD)
 * Validates format only, not date validity
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// =============================================================================
// VALIDATION CHAINS - Reusable validation rules
// =============================================================================

/**
 * Validates UUID format for IDs
 *
 * @param fieldName - Name of the field being validated
 * @param location - Where the field is located (param, body, query)
 * @returns Validation chain for UUID field
 *
 * @remarks
 * - Validates UUID v4 format strictly
 * - Provides clear error messages
 * - Used for roomId, userId, reservationId
 */
function validateUUID(
  fieldName: string,
  location: 'param' | 'body' | 'query' = 'body'
): ValidationChain {
  const validator =
    location === 'param' ? param(fieldName) : location === 'query' ? query(fieldName) : body(fieldName);

  return validator
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .matches(UUID_REGEX)
    .withMessage(`${fieldName} must be a valid UUID`);
}

/**
 * Validates ISO 8601 date format (YYYY-MM-DD)
 *
 * @param fieldName - Name of the date field
 * @returns Validation chain for date field
 *
 * @remarks
 * - Validates format only (YYYY-MM-DD)
 * - Business logic validation (future dates, date ranges) in service layer
 * - Normalizes to ISO string format
 */
function validateISODate(fieldName: string): ValidationChain {
  return body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .matches(ISO_DATE_REGEX)
    .withMessage(`${fieldName} must be in ISO 8601 format (YYYY-MM-DD)`)
    .isISO8601({ strict: true })
    .withMessage(`${fieldName} must be a valid date`)
    .toDate()
    .customSanitizer((value: Date) => value.toISOString().split('T')[0]);
}

/**
 * Validates reservation status enum value
 *
 * @param fieldName - Name of the status field
 * @param location - Where the field is located
 * @returns Validation chain for status field
 *
 * @remarks
 * - Validates against ReservationStatus enum
 * - Case-sensitive validation
 * - Status transition validation in service layer
 */
function validateStatus(
  fieldName: string,
  location: 'body' | 'query' = 'body'
): ValidationChain {
  const validator = location === 'query' ? query(fieldName) : body(fieldName);

  return validator
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .isIn(VALID_STATUSES)
    .withMessage(
      `${fieldName} must be one of: ${VALID_STATUSES.join(', ')}`
    );
}

// =============================================================================
// ENDPOINT VALIDATION ARRAYS
// =============================================================================

/**
 * Validation rules for POST /api/reservations
 *
 * @remarks
 * Validates:
 * - roomId: Valid UUID format
 * - checkInDate: ISO 8601 date format, future date validation in service
 * - checkOutDate: ISO 8601 date format, after checkInDate validation in service
 *
 * Business logic validation (availability, date ranges) performed in service layer
 *
 * @example
 * ```typescript
 * router.post('/reservations',
 *   authenticate,
 *   createReservationValidation,
 *   validationErrorHandler,
 *   createReservation
 * );
 * ```
 */
export const createReservationValidation: ValidationChain[] = [
  validateUUID('roomId', 'body'),
  validateISODate('checkInDate'),
  validateISODate('checkOutDate'),
];

/**
 * Validation rules for reservation ID parameter
 *
 * @remarks
 * Validates:
 * - id: Valid UUID format in URL parameter
 *
 * Used by endpoints:
 * - GET /api/reservations/:id
 * - PUT /api/reservations/:id/confirm
 * - PUT /api/reservations/:id/check-in
 * - PUT /api/reservations/:id/check-out
 * - PUT /api/reservations/:id/cancel
 *
 * @example
 * ```typescript
 * router.get('/reservations/:id',
 *   authenticate,
 *   reservationIdValidation,
 *   validationErrorHandler,
 *   getReservationById
 * );
 * ```
 */
export const reservationIdValidation: ValidationChain[] = [
  validateUUID('id', 'param'),
];

/**
 * Validation rules for status update endpoints
 *
 * @remarks
 * Validates:
 * - status: Valid ReservationStatus enum value
 *
 * Status transition validation performed in service layer
 * Each endpoint may have specific allowed transitions
 *
 * @example
 * ```typescript
 * router.put('/reservations/:id/status',
 *   authenticate,
 *   requireRole('ADMIN'),
 *   reservationIdValidation,
 *   statusValidation,
 *   validationErrorHandler,
 *   updateReservationStatus
 * );
 * ```
 */
export const statusValidation: ValidationChain[] = [
  validateStatus('status', 'body'),
];

/**
 * Validation rules for GET /api/reservations query parameters
 *
 * @remarks
 * Validates optional query parameters:
 * - status: Valid ReservationStatus enum value
 * - userId: Valid UUID format
 * - roomId: Valid UUID format
 * - dateFrom: ISO 8601 date format
 * - dateTo: ISO 8601 date format
 *
 * All parameters are optional for flexible filtering
 * Date range validation (from <= to) in service layer
 *
 * @example
 * ```typescript
 * router.get('/reservations',
 *   authenticate,
 *   listReservationsValidation,
 *   validationErrorHandler,
 *   listReservations
 * );
 * ```
 */
export const listReservationsValidation: ValidationChain[] = [
  query('status')
    .optional()
    .trim()
    .isIn(VALID_STATUSES)
    .withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),

  query('userId')
    .optional()
    .trim()
    .matches(UUID_REGEX)
    .withMessage('userId must be a valid UUID'),

  query('roomId')
    .optional()
    .trim()
    .matches(UUID_REGEX)
    .withMessage('roomId must be a valid UUID'),

  query('dateFrom')
    .optional()
    .trim()
    .matches(ISO_DATE_REGEX)
    .withMessage('dateFrom must be in ISO 8601 format (YYYY-MM-DD)')
    .isISO8601({ strict: true })
    .withMessage('dateFrom must be a valid date')
    .toDate()
    .customSanitizer((value: Date) => value.toISOString().split('T')[0]),

  query('dateTo')
    .optional()
    .trim()
    .matches(ISO_DATE_REGEX)
    .withMessage('dateTo must be in ISO 8601 format (YYYY-MM-DD)')
    .isISO8601({ strict: true })
    .withMessage('dateTo must be a valid date')
    .toDate()
    .customSanitizer((value: Date) => value.toISOString().split('T')[0]),
];

/**
 * Validation rules for PUT /api/reservations/:id/confirm
 *
 * @remarks
 * Validates:
 * - id: Valid UUID in URL parameter
 *
 * No body validation required for confirm endpoint
 * Status transition validation in service layer
 *
 * @example
 * ```typescript
 * router.put('/reservations/:id/confirm',
 *   authenticate,
 *   requireRole('ADMIN'),
 *   confirmReservationValidation,
 *   validationErrorHandler,
 *   confirmReservation
 * );
 * ```
 */
export const confirmReservationValidation: ValidationChain[] = [
  validateUUID('id', 'param'),
];

/**
 * Validation rules for PUT /api/reservations/:id/check-in
 *
 * @remarks
 * Validates:
 * - id: Valid UUID in URL parameter
 *
 * No body validation required for check-in endpoint
 * Status transition and date validation in service layer
 *
 * @example
 * ```typescript
 * router.put('/reservations/:id/check-in',
 *   authenticate,
 *   requireRole('ADMIN'),
 *   checkInValidation,
 *   validationErrorHandler,
 *   checkInReservation
 * );
 * ```
 */
export const checkInValidation: ValidationChain[] = [
  validateUUID('id', 'param'),
];

/**
 * Validation rules for PUT /api/reservations/:id/check-out
 *
 * @remarks
 * Validates:
 * - id: Valid UUID in URL parameter
 *
 * No body validation required for check-out endpoint
 * Status transition and date validation in service layer
 *
 * @example
 * ```typescript
 * router.put('/reservations/:id/check-out',
 *   authenticate,
 *   requireRole('ADMIN'),
 *   checkOutValidation,
 *   validationErrorHandler,
 *   checkOutReservation
 * );
 * ```
 */
export const checkOutValidation: ValidationChain[] = [
  validateUUID('id', 'param'),
];

/**
 * Validation rules for PUT /api/reservations/:id/cancel
 *
 * @remarks
 * Validates:
 * - id: Valid UUID in URL parameter
 *
 * No body validation required for cancel endpoint
 * Status transition and cancellation policy validation in service layer
 *
 * @example
 * ```typescript
 * router.put('/reservations/:id/cancel',
 *   authenticate,
 *   cancelReservationValidation,
 *   validationErrorHandler,
 *   cancelReservation
 * );
 * ```
 */
export const cancelReservationValidation: ValidationChain[] = [
  validateUUID('id', 'param'),
];

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Re-export ValidationChain type for convenience
 */
export type { ValidationChain } from 'express-validator';