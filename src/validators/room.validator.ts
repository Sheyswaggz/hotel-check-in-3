// =============================================================================
// ROOM VALIDATOR - EXPRESS-VALIDATOR VALIDATION RULES
// =============================================================================
// This module defines validation rules for room management API endpoints using
// express-validator. Provides comprehensive input validation for create, update,
// and parameter validation operations.
//
// Validation Strategy: Fail-fast validation with detailed error messages
// Security: Input sanitization and type coercion prevention
// Extensibility: Modular validation chains for reusability
// =============================================================================

import { body, param, query, ValidationChain } from 'express-validator';
import { RoomStatus, RoomType, ROOM_VALIDATION } from '../types/room.types.js';

// =============================================================================
// ROOM NUMBER VALIDATION
// =============================================================================

/**
 * Validates room number field
 * - Required: Must be present and non-empty
 * - Format: Alphanumeric with hyphens (e.g., "101", "A-205", "SUITE-1")
 * - Length: 1-50 characters
 * - Sanitization: Trimmed and uppercased for consistency
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const roomNumberValidation = (): ValidationChain =>
  body('roomNumber')
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
    .withMessage('Room number must contain only letters, numbers, and hyphens')
    .customSanitizer((value: string) => value.toUpperCase());

/**
 * Validates optional room number field for updates
 * Same validation rules as required field, but optional
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const optionalRoomNumberValidation = (): ValidationChain =>
  body('roomNumber')
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
    .withMessage('Room number must contain only letters, numbers, and hyphens')
    .customSanitizer((value: string) => value.toUpperCase());

// =============================================================================
// ROOM TYPE VALIDATION
// =============================================================================

/**
 * Validates room type field
 * - Required: Must be present
 * - Enum: Must be one of the defined RoomType values
 * - Case-insensitive: Accepts lowercase and converts to uppercase
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const roomTypeValidation = (): ValidationChain =>
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Room type is required')
    .isString()
    .withMessage('Room type must be a string')
    .toUpperCase()
    .isIn(Object.values(RoomType))
    .withMessage(
      `Room type must be one of: ${Object.values(RoomType).join(', ')}`
    );

/**
 * Validates optional room type field for updates
 * Same validation rules as required field, but optional
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const optionalRoomTypeValidation = (): ValidationChain =>
  body('type')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Room type cannot be empty if provided')
    .isString()
    .withMessage('Room type must be a string')
    .toUpperCase()
    .isIn(Object.values(RoomType))
    .withMessage(
      `Room type must be one of: ${Object.values(RoomType).join(', ')}`
    );

// =============================================================================
// PRICE VALIDATION
// =============================================================================

/**
 * Validates price field
 * - Required: Must be present
 * - Type: Must be a valid number
 * - Range: Between 0.01 and 999999.99
 * - Precision: Maximum 2 decimal places
 * - Sanitization: Converted to float with 2 decimal precision
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const priceValidation = (): ValidationChain =>
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({
      min: ROOM_VALIDATION.price.min,
      max: ROOM_VALIDATION.price.max,
    })
    .withMessage(
      `Price must be between ${ROOM_VALIDATION.price.min} and ${ROOM_VALIDATION.price.max}`
    )
    .custom((value: number) => {
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > ROOM_VALIDATION.price.decimalPlaces) {
        throw new Error(
          `Price must have at most ${ROOM_VALIDATION.price.decimalPlaces} decimal places`
        );
      }
      return true;
    })
    .customSanitizer((value: number) => parseFloat(value.toFixed(2)));

/**
 * Validates optional price field for updates
 * Same validation rules as required field, but optional
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const optionalPriceValidation = (): ValidationChain =>
  body('price')
    .optional()
    .isFloat({
      min: ROOM_VALIDATION.price.min,
      max: ROOM_VALIDATION.price.max,
    })
    .withMessage(
      `Price must be between ${ROOM_VALIDATION.price.min} and ${ROOM_VALIDATION.price.max}`
    )
    .custom((value: number) => {
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > ROOM_VALIDATION.price.decimalPlaces) {
        throw new Error(
          `Price must have at most ${ROOM_VALIDATION.price.decimalPlaces} decimal places`
        );
      }
      return true;
    })
    .customSanitizer((value: number) => parseFloat(value.toFixed(2)));

// =============================================================================
// ROOM STATUS VALIDATION
// =============================================================================

/**
 * Validates room status field
 * - Required: Must be present
 * - Enum: Must be one of the defined RoomStatus values
 * - Case-insensitive: Accepts lowercase and converts to uppercase
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const roomStatusValidation = (): ValidationChain =>
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Room status is required')
    .isString()
    .withMessage('Room status must be a string')
    .toUpperCase()
    .isIn(Object.values(RoomStatus))
    .withMessage(
      `Room status must be one of: ${Object.values(RoomStatus).join(', ')}`
    );

/**
 * Validates optional room status field for updates
 * Same validation rules as required field, but optional
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const optionalRoomStatusValidation = (): ValidationChain =>
  body('status')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Room status cannot be empty if provided')
    .isString()
    .withMessage('Room status must be a string')
    .toUpperCase()
    .isIn(Object.values(RoomStatus))
    .withMessage(
      `Room status must be one of: ${Object.values(RoomStatus).join(', ')}`
    );

// =============================================================================
// ROOM ID PARAMETER VALIDATION
// =============================================================================

/**
 * Validates room ID parameter in URL
 * - Required: Must be present in URL path
 * - Format: Must be a valid UUID v4
 * - Security: Prevents SQL injection and path traversal
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const roomIdParamValidation = (): ValidationChain =>
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Room ID is required')
    .isUUID(4)
    .withMessage('Room ID must be a valid UUID');

// =============================================================================
// QUERY PARAMETER VALIDATION FOR FILTERING
// =============================================================================

/**
 * Validates room type query parameter for filtering
 * - Optional: Used for filtering room listings
 * - Enum: Must be one of the defined RoomType values
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const roomTypeQueryValidation = (): ValidationChain =>
  query('type')
    .optional()
    .trim()
    .toUpperCase()
    .isIn(Object.values(RoomType))
    .withMessage(
      `Room type must be one of: ${Object.values(RoomType).join(', ')}`
    );

/**
 * Validates room status query parameter for filtering
 * - Optional: Used for filtering room listings
 * - Enum: Must be one of the defined RoomStatus values
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const roomStatusQueryValidation = (): ValidationChain =>
  query('status')
    .optional()
    .trim()
    .toUpperCase()
    .isIn(Object.values(RoomStatus))
    .withMessage(
      `Room status must be one of: ${Object.values(RoomStatus).join(', ')}`
    );

/**
 * Validates minimum price query parameter for filtering
 * - Optional: Used for price range filtering
 * - Type: Must be a valid positive number
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const minPriceQueryValidation = (): ValidationChain =>
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number')
    .toFloat();

/**
 * Validates maximum price query parameter for filtering
 * - Optional: Used for price range filtering
 * - Type: Must be a valid positive number
 * - Logic: Must be greater than or equal to minPrice if both provided
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const maxPriceQueryValidation = (): ValidationChain =>
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number')
    .toFloat()
    .custom((value: number, { req }) => {
      const minPrice = req.query.minPrice;
      if (minPrice !== undefined && value < parseFloat(minPrice as string)) {
        throw new Error('Maximum price must be greater than or equal to minimum price');
      }
      return true;
    });

// =============================================================================
// PAGINATION VALIDATION
// =============================================================================

/**
 * Validates page query parameter for pagination
 * - Optional: Defaults to 1 if not provided
 * - Type: Must be a positive integer
 * - Range: Minimum value of 1
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const pageQueryValidation = (): ValidationChain =>
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt();

/**
 * Validates limit query parameter for pagination
 * - Optional: Defaults to 10 if not provided
 * - Type: Must be a positive integer
 * - Range: Between 1 and 100 to prevent excessive data retrieval
 *
 * @returns {ValidationChain} Express-validator validation chain
 */
const limitQueryValidation = (): ValidationChain =>
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt();

// =============================================================================
// EXPORTED VALIDATION ARRAYS
// =============================================================================

/**
 * Validation rules for creating a new room
 * Validates: roomNumber, type, price, status
 * All fields are required for room creation
 *
 * @constant {ValidationChain[]}
 */
export const createRoomValidation: ValidationChain[] = [
  roomNumberValidation(),
  roomTypeValidation(),
  priceValidation(),
  roomStatusValidation(),
];

/**
 * Validation rules for updating an existing room
 * Validates: roomNumber, type, price, status (all optional)
 * At least one field must be provided for update
 *
 * @constant {ValidationChain[]}
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
    }),
];

/**
 * Validation rules for room ID parameter
 * Validates: id parameter in URL path
 * Used for GET, PUT, DELETE operations on specific rooms
 *
 * @constant {ValidationChain[]}
 */
export const roomIdValidation: ValidationChain[] = [
  roomIdParamValidation(),
];

/**
 * Validation rules for room listing query parameters
 * Validates: type, status, minPrice, maxPrice, page, limit
 * All fields are optional for flexible filtering and pagination
 *
 * @constant {ValidationChain[]}
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
 * Combined validation for GET /api/rooms/:id endpoint
 * Validates room ID parameter
 *
 * @constant {ValidationChain[]}
 */
export const getRoomValidation: ValidationChain[] = [
  ...roomIdValidation,
];

/**
 * Combined validation for PUT /api/rooms/:id endpoint
 * Validates room ID parameter and update fields
 *
 * @constant {ValidationChain[]}
 */
export const updateRoomByIdValidation: ValidationChain[] = [
  ...roomIdValidation,
  ...updateRoomValidation,
];

/**
 * Combined validation for DELETE /api/rooms/:id endpoint
 * Validates room ID parameter only
 *
 * @constant {ValidationChain[]}
 */
export const deleteRoomValidation: ValidationChain[] = [
  ...roomIdValidation,
];