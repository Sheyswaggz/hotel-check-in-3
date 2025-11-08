import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError } from 'express-validator';

/**
 * Structured validation error response format
 * Provides detailed information about validation failures
 */
export interface ValidationErrorResponse {
  /** Error type identifier */
  error: 'VALIDATION_ERROR';
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  statusCode: 400;
  /** Array of validation error details */
  errors: Array<{
    /** Field that failed validation */
    field: string;
    /** Validation error message */
    message: string;
    /** Value that failed validation */
    value?: unknown;
    /** Location of the field (body, query, params, etc.) */
    location?: string;
  }>;
  /** ISO timestamp of when the error occurred */
  timestamp: string;
}

/**
 * Type guard to check if an error is a ValidationErrorResponse
 *
 * @param error - Unknown error object to check
 * @returns True if error matches ValidationErrorResponse structure
 */
export function isValidationErrorResponse(error: unknown): error is ValidationErrorResponse {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const err = error as Record<string, unknown>;

  return (
    err.error === 'VALIDATION_ERROR' &&
    typeof err.message === 'string' &&
    err.statusCode === 400 &&
    Array.isArray(err.errors) &&
    typeof err.timestamp === 'string'
  );
}

/**
 * Express middleware for handling validation errors from express-validator
 *
 * This middleware checks for validation errors in the request and returns
 * a standardized error response if any are found. It should be used after
 * express-validator validation chains.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @example
 * ```typescript
 * router.post(
 *   '/rooms',
 *   createRoomValidation,
 *   validate,
 *   createRoom
 * );
 * ```
 *
 * @remarks
 * - Returns 400 status code with detailed validation errors
 * - Includes field name, error message, and invalid value
 * - Provides timestamp for error tracking
 * - Calls next() if no validation errors found
 * - Logs validation failures for monitoring
 */
export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    next();
    return;
  }

  const validationErrors = errors.array();

  // Log validation failure for monitoring
  console.error('[VALIDATION_ERROR]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    errors: validationErrors.map((err) => ({
      field: 'path' in err ? err.path : 'unknown',
      message: err.msg,
      location: err.location,
    })),
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const errorResponse: ValidationErrorResponse = {
    error: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    statusCode: 400,
    errors: validationErrors.map((err: ExpressValidationError) => {
      const field = 'path' in err ? err.path : 'unknown';
      const value = 'value' in err ? err.value : undefined;
      const location = err.location;

      return {
        field,
        message: err.msg,
        value,
        location,
      };
    }),
    timestamp: new Date().toISOString(),
  };

  res.status(400).json(errorResponse);
}

export type { ValidationErrorResponse };