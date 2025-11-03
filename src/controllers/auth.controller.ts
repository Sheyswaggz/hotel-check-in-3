// =============================================================================
// AUTHENTICATION CONTROLLER
// =============================================================================
// Express.js request handlers for JWT authentication endpoints including user
// registration, login, and authenticated user profile retrieval.
//
// Security: Input validation, error sanitization, no password exposure
// Performance: Async operations, efficient error handling
// Maintainability: Clear separation of concerns, comprehensive logging
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import type { RegisterDto, LoginDto, AuthResponse } from '../types/auth.types.js';

/**
 * Controller error class for HTTP-specific error handling
 */
class ControllerError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ControllerError';
    Error.captureStackTrace(this, ControllerError);
  }
}

/**
 * Validates email format using RFC 5322 simplified regex
 */
function validateEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.trim()) {
    throw new ControllerError('Email is required', 400, 'VALIDATION_ERROR');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmedEmail = email.trim().toLowerCase();

  if (!emailRegex.test(trimmedEmail)) {
    throw new ControllerError('Invalid email format', 400, 'VALIDATION_ERROR', {
      field: 'email',
    });
  }

  return trimmedEmail;
}

/**
 * Validates password strength requirements
 * Requirements: Minimum 8 characters, at least one uppercase, one lowercase, one number
 */
function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || !password) {
    throw new ControllerError('Password is required', 400, 'VALIDATION_ERROR');
  }

  if (password.length < 8) {
    throw new ControllerError(
      'Password must be at least 8 characters long',
      400,
      'VALIDATION_ERROR',
      { field: 'password' }
    );
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    throw new ControllerError(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      400,
      'VALIDATION_ERROR',
      { field: 'password' }
    );
  }

  return password;
}

/**
 * Validates user role
 */
function validateRole(role: unknown): 'ADMIN' | 'GUEST' {
  if (typeof role !== 'string' || !role) {
    throw new ControllerError('Role is required', 400, 'VALIDATION_ERROR');
  }

  const upperRole = role.toUpperCase();

  if (upperRole !== 'ADMIN' && upperRole !== 'GUEST') {
    throw new ControllerError(
      'Role must be either ADMIN or GUEST',
      400,
      'VALIDATION_ERROR',
      { field: 'role', providedValue: role }
    );
  }

  return upperRole as 'ADMIN' | 'GUEST';
}

/**
 * Sanitizes error message for client response
 * Prevents exposure of sensitive information in error messages
 */
function sanitizeErrorMessage(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
} {
  if (error instanceof ControllerError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  // Handle auth service errors
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'statusCode' in error &&
    'message' in error
  ) {
    const authError = error as {
      code: string;
      statusCode: number;
      message: string;
    };

    return {
      message: authError.message,
      code: authError.code,
      statusCode: authError.statusCode,
    };
  }

  // Generic error - don't expose details
  console.error('[AuthController] Unexpected error:', error);

  return {
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
}

/**
 * Validates and sanitizes registration request body
 */
function validateRegisterRequest(body: unknown): RegisterDto {
  if (!body || typeof body !== 'object') {
    throw new ControllerError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  const requestBody = body as Record<string, unknown>;

  const email = validateEmail(requestBody.email);
  const password = validatePassword(requestBody.password);
  const role = validateRole(requestBody.role);

  return { email, password, role };
}

/**
 * Validates and sanitizes login request body
 */
function validateLoginRequest(body: unknown): LoginDto {
  if (!body || typeof body !== 'object') {
    throw new ControllerError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  const requestBody = body as Record<string, unknown>;

  const email = validateEmail(requestBody.email);
  const password = validatePassword(requestBody.password);

  return { email, password };
}

/**
 * Register new user endpoint handler
 * POST /api/auth/register
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!",
 *   "role": "GUEST"
 * }
 *
 * Success response (201):
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "role": "GUEST",
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   },
 *   "token": "jwt.token.here"
 * }
 *
 * Error responses:
 * - 400: Validation error (invalid email, weak password, invalid role)
 * - 409: Email already exists
 * - 500: Internal server error
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('[AuthController] Registration request received', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Validate request body
    const registerDto = validateRegisterRequest(req.body);

    console.log('[AuthController] Registration validation passed', {
      email: registerDto.email,
      role: registerDto.role,
      timestamp: new Date().toISOString(),
    });

    // Call auth service to register user
    const authResponse: AuthResponse = await authService.register(registerDto);

    console.log('[AuthController] User registered successfully', {
      userId: authResponse.user.id,
      email: authResponse.user.email,
      role: authResponse.user.role,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Return success response with 201 Created
    res.status(201).json(authResponse);
  } catch (error) {
    const sanitizedError = sanitizeErrorMessage(error);

    console.error('[AuthController] Registration failed', {
      error: sanitizedError,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Pass error to Express error handler
    res.status(sanitizedError.statusCode).json({
      error: {
        message: sanitizedError.message,
        code: sanitizedError.code,
      },
    });
  }
}

/**
 * Login user endpoint handler
 * POST /api/auth/login
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!"
 * }
 *
 * Success response (200):
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "role": "GUEST",
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   },
 *   "token": "jwt.token.here"
 * }
 *
 * Error responses:
 * - 400: Validation error (invalid email or password format)
 * - 401: Invalid credentials (wrong email or password)
 * - 500: Internal server error
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('[AuthController] Login request received', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Validate request body
    const loginDto = validateLoginRequest(req.body);

    console.log('[AuthController] Login validation passed', {
      email: loginDto.email,
      timestamp: new Date().toISOString(),
    });

    // Call auth service to authenticate user
    const authResponse: AuthResponse = await authService.login(loginDto);

    console.log('[AuthController] User logged in successfully', {
      userId: authResponse.user.id,
      email: authResponse.user.email,
      role: authResponse.user.role,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Return success response with 200 OK
    res.status(200).json(authResponse);
  } catch (error) {
    const sanitizedError = sanitizeErrorMessage(error);

    console.error('[AuthController] Login failed', {
      error: sanitizedError,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Pass error to Express error handler
    res.status(sanitizedError.statusCode).json({
      error: {
        message: sanitizedError.message,
        code: sanitizedError.code,
      },
    });
  }
}

/**
 * Get authenticated user profile endpoint handler
 * GET /api/auth/me
 *
 * Requires: Valid JWT token in Authorization header
 * Authorization: Bearer <token>
 *
 * Success response (200):
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "role": "GUEST",
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 *
 * Error responses:
 * - 401: Unauthorized (missing or invalid token)
 * - 404: User not found
 * - 500: Internal server error
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();

  try {
    // User is attached to request by authentication middleware
    if (!req.user) {
      console.error('[AuthController] Get profile failed: No user in request', {
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    console.log('[AuthController] Get profile request', {
      userId: req.user.id,
      email: req.user.email,
      timestamp: new Date().toISOString(),
    });

    // Fetch fresh user data from database
    const user = await authService.getUserById(req.user.id);

    if (!user) {
      console.error('[AuthController] Get profile failed: User not found', {
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });

      res.status(404).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
      return;
    }

    console.log('[AuthController] Profile retrieved successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Return user profile
    res.status(200).json({ user });
  } catch (error) {
    const sanitizedError = sanitizeErrorMessage(error);

    console.error('[AuthController] Get profile failed', {
      error: sanitizedError,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(sanitizedError.statusCode).json({
      error: {
        message: sanitizedError.message,
        code: sanitizedError.code,
      },
    });
  }
}

// =============================================================================
// TYPE AUGMENTATION FOR EXPRESS REQUEST
// =============================================================================
// Extend Express Request type to include authenticated user
// This is set by the authentication middleware
// =============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'ADMIN' | 'GUEST';
      };
    }
  }
}