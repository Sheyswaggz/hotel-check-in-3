// =============================================================================
// ROOM VALIDATOR - EXPRESS-VALIDATOR VALIDATION RULES FOR ROOM ENDPOINTS
// =============================================================================
// This module provides comprehensive validation rules for room management API
// endpoints using express-validator. Includes validation for room creation,
// updates, queries, and parameter validation with detailed error messages.
//
// Validation Strategy: Input validation at API boundary with type-safe rules
// Error Handling: Descriptive error messages for client feedback
// Type Safety: Aligned with room.types.ts type definitions
// =============================================================================

import { body, param, query, type ValidationChain } from 'express-validator';
import { RoomStatus, RoomType, ROOM_VALIDATION } from '../types/room.types.js';

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

/**
 * UUID v4 regex pattern for room ID validation
 * Matches standard UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valid room status values from RoomStatus enum
 */
const VALID_ROOM_STATUSES = Object.values(RoomStatus);

/**
 * Valid room type values from RoomType enum
 */
const VALID_ROOM_TYPES = Object.values(RoomType);

/**
 * Default pagination limits
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// =============================================================================
// FIELD VALIDATORS - REQUIRED FIELDS
// =============================================================================

/**
 * Validates room number field (required)
 * - Must be a non-empty string
 * - Length between 1 and 50 characters
 * - Matches alphanumeric pattern with hyphens
 *
 * @returns {ValidationChain} Express-validator chain
 */
function roomNumberValidation(): ValidationChain {
  return body('roomNumber')
    .trim()
    .notEmpty()
    .withMessage('Room number is required')
    .isString()
    .withMessage('Room number must be a string')
    .isLength({
      min: ROOM_VALIDATION.roomNumber.minLength,
      max: ROOM_VALIDATION.roomNumber.maxLength,
    })
    .withMessage(
      `Room number must be between ${ROOM_VALIDATION.roomNumber.minLength} and ${ROOM_VALIDATION.roomNumber.maxLength} characters`
    )
    .matches(ROOM_VALIDATION.roomNumber.pattern)
    .withMessage('Room number must contain only alphanumeric characters and hyphens');
}

/**
 * Validates room type field (required)
 * - Must be a non-empty string
 * - Must be one of the valid RoomType enum values
 *
 * @returns {ValidationChain} Express-validator chain
 */
function roomTypeValidation(): ValidationChain {
  return body('type')
    .trim()
    .notEmpty()
    .withMessage('Room type is required')
    .isString()
    .withMessage('Room type must be a string')
    .isIn(VALID_ROOM_TYPES)
    .withMessage(`Room type must be one of: ${VALID_ROOM_TYPES.join(', ')}`);
}

/**
 * Validates price field (required)
 * - Must be a positive number
 * - Must be within valid price range
 * - Enforces decimal precision
 *
 * @returns {ValidationChain} Express-validator chain
 */
function priceValidation(): ValidationChain {
  return body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: ROOM_VALIDATION.price.min, max: ROOM_VALIDATION.price.max })
    .withMessage(
      `Price must be between ${ROOM_VALIDATION.price.min} and ${ROOM_VALIDATION.price.max}`
    )
    .custom((value: number) => {
      const decimalPlaces = (value.toString().split('.')[1] ?? '').length;
      if (decimalPlaces > ROOM_VALIDATION.price.decimalPlaces) {
        throw new Error(`Price must have at most ${ROOM_VALIDATION.price.decimalPlaces} decimal places`);
      }
      return true;
    });
}

/**
 * Validates room status field (required)
 * - Must be a non-empty string
 * - Must be one of the valid RoomStatus enum values
 *
 * @returns {ValidationChain} Express-validator chain
 */
function roomStatusValidation(): ValidationChain {
  return body('status')
    .trim()
    .notEmpty()
    .withMessage('Room status is required')
    .isString()
    .withMessage('Room status must be a string')
    .isIn(VALID_ROOM_STATUSES)
    .withMessage(`Room status must be one of: ${VALID_ROOM_STATUSES.join(', ')}`);
}

// =============================================================================
// FIELD VALIDATORS - OPTIONAL FIELDS
// =============================================================================

/**
 * Validates optional room number field for updates
 * - If provided, must meet same requirements as required validation
 *
 * @returns {ValidationChain} Express-validator chain
 */
function optionalRoomNumberValidation(): ValidationChain {
  return body('roomNumber')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Room number cannot be empty if provided')
    .isString()
    .withMessage('Room number must be a string')
    .isLength({
      min: ROOM_VALIDATION.roomNumber.minLength,
      max: ROOM_VALIDATION.roomNumber.maxLength,
    })
    .withMessage(
      `Room number must be between ${ROOM_VALIDATION.roomNumber.minLength} and ${ROOM_VALIDATION.roomNumber.maxLength} characters`
    )
    .matches(ROOM_VALIDATION.roomNumber.pattern)
    .withMessage('Room number must contain only alphanumeric characters and hyphens');
}

/**
 * Validates optional room type field for updates
 * - If provided, must be a valid RoomType enum value
 *
 * @returns {ValidationChain} Express-validator chain
 */
function optionalRoomTypeValidation(): ValidationChain {
  return body('type')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Room type cannot be empty if provided')
    .isString()
    .withMessage('Room type must be a string')
    .isIn(VALID_ROOM_TYPES)
    .withMessage(`Room type must be one of: ${VALID_ROOM_TYPES.join(', ')}`);
}

/**
 * Validates optional price field for updates
 * - If provided, must meet same requirements as required validation
 *
 * @returns {ValidationChain} Express-validator chain
 */
function optionalPriceValidation(): ValidationChain {
  return body('price')
    .optional()
    .isFloat({ min: ROOM_VALIDATION.price.min, max: ROOM_VALIDATION.price.max })
    .withMessage(
      `Price must be between ${ROOM_VALIDATION.price.min} and ${ROOM_VALIDATION.price.max}`
    )
    .custom((value: number) => {
      const decimalPlaces = (value.toString().split('.')[1] ?? '').length;
      if (decimalPlaces > ROOM_VALIDATION.price.decimalPlaces) {
        throw new Error(`Price must have at most ${ROOM_VALIDATION.price.decimalPlaces} decimal places`);
      }
      return true;
    });
}

/**
 * Validates optional room status field for updates
 * - If provided, must be a valid RoomStatus enum value
 *
 * @returns {ValidationChain} Express-validator chain
 */
function optionalRoomStatusValidation(): ValidationChain {
  return body('status')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Room status cannot be empty if provided')
    .isString()
    .withMessage('Room status must be a string')
    .isIn(VALID_ROOM_STATUSES)
    .withMessage(`Room status must be one of: ${VALID_ROOM_STATUSES.join(', ')}`);
}

// =============================================================================
// PARAMETER VALIDATORS
// =============================================================================

/**
 * Validates room ID parameter
 * - Must be a valid UUID v4 format
 *
 * @returns {ValidationChain} Express-validator chain
 */
function roomIdParamValidation(): ValidationChain {
  return param('id')
    .trim()
    .notEmpty()
    .withMessage('Room ID is required')
    .matches(UUID_V4_REGEX)
    .withMessage('Room ID must be a valid UUID');
}

// =============================================================================
// QUERY PARAMETER VALIDATORS
// =============================================================================

/**
 * Validates room type query parameter for filtering
 * - Optional field
 * - If provided, must be a valid RoomType enum value
 *
 * @returns {ValidationChain} Express-validator chain
 */
function roomTypeQueryValidation(): ValidationChain {
  return query('type')
    .optional()
    .trim()
    .isString()
    .withMessage('Room type must be a string')
    .isIn(VALID_ROOM_TYPES)
    .withMessage(`Room type must be one of: ${VALID_ROOM_TYPES.join(', ')}`);
}

/**
 * Validates room status query parameter for filtering
 * - Optional field
 * - If provided, must be a valid RoomStatus enum value
 *
 * @returns {ValidationChain} Express-validator chain
 */
function roomStatusQueryValidation(): ValidationChain {
  return query('status')
    .optional()
    .trim()
    .isString()
    .withMessage('Room status must be a string')
    .isIn(VALID_ROOM_STATUSES)
    .withMessage(`Room status must be one of: ${VALID_ROOM_STATUSES.join(', ')}`);
}

/**
 * Validates minimum price query parameter for filtering
 * - Optional field
 * - If provided, must be a positive number
 *
 * @returns {ValidationChain} Express-validator chain
 */
function minPriceQueryValidation(): ValidationChain {
  return query('minPrice')
    .optional()
    .isFloat({ min: ROOM_VALIDATION.price.min })
    .withMessage(`Minimum price must be at least ${ROOM_VALIDATION.price.min}`)
    .toFloat();
}

/**
 * Validates maximum price query parameter for filtering
 * - Optional field
 * - If provided, must be a positive number
 * - Must be greater than or equal to minPrice if both provided
 *
 * @returns {ValidationChain} Express-validator chain
 */
function maxPriceQueryValidation(): ValidationChain {
  return query('maxPrice')
    .optional()
    .isFloat({ min: ROOM_VALIDATION.price.min })
    .withMessage(`Maximum price must be at least ${ROOM_VALIDATION.price.min}`)
    .toFloat()
    .custom((value: number, { req }) => {
      const minPrice = req.query.minPrice;
      if (minPrice !== undefined && value < parseFloat(minPrice as string)) {
        throw new Error('Maximum price must be greater than or equal to minimum price');
      }
      return true;
    });
}

/**
 * Validates page query parameter for pagination
 * - Optional field with default value
 * - Must be a positive integer
 *
 * @returns {ValidationChain} Express-validator chain
 */
function pageQueryValidation(): ValidationChain {
  return query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt()
    .default(DEFAULT_PAGE);
}

/**
 * Validates limit query parameter for pagination
 * - Optional field with default value
 * - Must be a positive integer
 * - Must not exceed maximum limit
 *
 * @returns {ValidationChain} Express-validator chain
 */
function limitQueryValidation(): ValidationChain {
  return query('limit')
    .optional()
    .isInt({ min: 1, max: MAX_LIMIT })
    .withMessage(`Limit must be between 1 and ${MAX_LIMIT}`)
    .toInt()
    .default(DEFAULT_LIMIT);
}

// =============================================================================
// VALIDATION RULE EXPORTS
// =============================================================================

/**
 * Validation rules for creating a new room
 * Validates: roomNumber, type, price, status
 *
 * @type {ValidationChain[]}
 */
export const createRoomValidation: ValidationChain[] = [
  roomNumberValidation(),
  roomTypeValidation(),
  priceValidation(),
  roomStatusValidation(),
];

/**
 * Validation rules for updating an existing room
 * All fields are optional, but at least one must be provided
 * Validates: roomNumber?, type?, price?, status?
 *
 * @type {ValidationChain[]}
 */
export const updateRoomValidation: ValidationChain[] = [
  optionalRoomNumberValidation(),
  optionalRoomTypeValidation(),
  optionalPriceValidation(),
  optionalRoomStatusValidation(),
  body()
    .custom((value, { req }) => {
      const hasAtLeastOneField =
        req.body.roomNumber !== undefined ||
        req.body.type !== undefined ||
        req.body.price !== undefined ||
        req.body.status !== undefined;

      if (!hasAtLeastOneField) {
        throw new Error('At least one field must be provided for update');
      }
      return true;
    })
    .withMessage('At least one field must be provided for update'),
];

/**
 * Validation rules for room ID parameter
 * Validates: id (UUID v4)
 *
 * @type {ValidationChain[]}
 */
export const roomIdValidation: ValidationChain[] = [roomIdParamValidation()];

/**
 * Validation rules for listing rooms with filters and pagination
 * Validates: type?, status?, minPrice?, maxPrice?, page?, limit?
 *
 * @type {ValidationChain[]}
 */
export const roomListValidation: ValidationChain[] = [
  roomTypeQueryValidation(),
  roomStatusQueryValidation(),
  minPriceQueryValidation(),
  maxPriceQueryValidation(),
  pageQueryValidation(),
  limitQueryValidation(),
];

/**
 * Validation rules for getting a single room by ID
 * Validates: id (UUID v4)
 *
 * @type {ValidationChain[]}
 */
export const getRoomValidation: ValidationChain[] = [...roomIdValidation];

/**
 * Validation rules for updating a room by ID
 * Combines ID validation with update field validation
 * Validates: id (UUID v4), roomNumber?, type?, price?, status?
 *
 * @type {ValidationChain[]}
 */
export const updateRoomByIdValidation: ValidationChain[] = [
  ...roomIdValidation,
  ...updateRoomValidation,
];

/**
 * Validation rules for deleting a room by ID
 * Validates: id (UUID v4)
 *
 * @type {ValidationChain[]}
 */
export const deleteRoomValidation: ValidationChain[] = [...roomIdValidation];