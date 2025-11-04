import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError } from 'express-validator';

/**
 * Structured validation error response
 * Provides detailed information about validation failures
 */
interface ValidationErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: Array<{
      field: string;
      message: string;
      value?: unknown;
      location?: string;
    }>;
    timestamp: string;
  };
}

/**
 * Validation middleware that processes express-validator results
 * 
 * This middleware should be placed after express-validator validation chains
 * to check for validation errors and return a standardized error response.
 * 
 * @example
 * router.post('/rooms',
 *   body('roomNumber').notEmpty(),
 *   body('price').isNumeric(),
 *   validate,
 *   roomController.create
 * );
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns void - Either sends error response or calls next()
 */
export function validate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract validation results from request
    const errors = validationResult(req);

    // If no validation errors, proceed to next middleware
    if (errors.isEmpty()) {
      next();
      return;
    }

    // Map express-validator errors to our standardized format
    const validationErrors = errors.array().map((error: ExpressValidationError) => {
      // Handle different error types from express-validator
      if (error.type === 'field') {
        return {
          field: error.path,
          message: error.msg,
          value: error.value,
          location: error.location,
        };
      }

      // Handle alternative error formats
      return {
        field: 'path' in error ? String(error.path) : 'unknown',
        message: error.msg,
        value: 'value' in error ? error.value : undefined,
        location: 'location' in error ? error.location : undefined,
      };
    });

    // Construct standardized error response
    const errorResponse: ValidationErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString(),
      },
    };

    // Log validation failure with context
    console.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errorCount: validationErrors.length,
      errors: validationErrors,
      timestamp: errorResponse.error.timestamp,
    });

    // Send 400 Bad Request with validation errors
    res.status(400).json(errorResponse);
  } catch (error) {
    // Handle unexpected errors in validation middleware
    console.error('Error in validation middleware', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
    });

    // Send generic error response to avoid exposing internal details
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while validating the request',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Type guard to check if an error is a validation error response
 * Useful for error handling in tests and client code
 * 
 * @param error - Unknown error object
 * @returns boolean - True if error matches ValidationErrorResponse structure
 */
export function isValidationErrorResponse(error: unknown): error is ValidationErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'success' in error &&
    error.success === false &&
    'error' in error &&
    typeof error.error === 'object' &&
    error.error !== null &&
    'code' in error.error &&
    error.error.code === 'VALIDATION_ERROR' &&
    'details' in error.error &&
    Array.isArray(error.error.details)
  );
}

/**
 * Export types for use in other modules
 */
export type { ValidationErrorResponse };