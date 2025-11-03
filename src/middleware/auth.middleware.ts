// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================
// Production-grade middleware for JWT authentication and role-based access
// control. Validates JWT tokens, attaches user to request, and enforces
// role-based authorization.
//
// Security: Validates all tokens, sanitizes inputs, prevents unauthorized access
// Performance: Efficient token verification with proper error handling
// Observability: Comprehensive logging for authentication attempts and failures
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util.js';
import { authService } from '../services/auth.service.js';
import type { AuthUser } from '../types/auth.types.js';

/**
 * Extended Express Request with authenticated user
 * Augments Express Request type to include user property
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user object attached by authenticate middleware
       * Available on all protected routes after successful authentication
       */
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware error class
 * Used for authentication-specific failures with proper HTTP status codes
 */
class AuthMiddlewareError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthMiddlewareError';
    Error.captureStackTrace(this, AuthMiddlewareError);
  }
}

/**
 * Extracts JWT token from Authorization header
 * Supports Bearer token format: "Bearer <token>"
 *
 * @param authHeader - Authorization header value
 * @returns Extracted token or null if invalid format
 */
function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const trimmedHeader = authHeader.trim();

  // Check for Bearer token format
  if (!trimmedHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  // Extract token after "Bearer "
  const token = trimmedHeader.slice(7).trim();

  if (token.length === 0) {
    return null;
  }

  return token;
}

/**
 * Sanitizes request information for logging
 * Removes sensitive data and limits size
 *
 * @param req - Express request object
 * @returns Sanitized request information
 */
function sanitizeRequestForLogging(req: Request): Record<string, unknown> {
  return {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
}

/**
 * Authentication middleware for protected routes
 *
 * Extracts JWT token from Authorization header, verifies token validity,
 * fetches user from database, and attaches user to request object.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @throws {AuthMiddlewareError} If token is missing, invalid, or user not found
 *
 * @example
 * ```typescript
 * router.get('/protected', authenticate, (req, res) => {
 *   // req.user is available and typed
 *   res.json({ userId: req.user.id });
 * });
 * ```
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[AuthMiddleware] Authentication attempt', {
      ...requestInfo,
      timestamp: new Date().toISOString(),
    });

    // Extract token from Authorization header
    const authHeader = req.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.warn('[AuthMiddleware] Authentication failed: Missing or invalid token', {
        ...requestInfo,
        hasAuthHeader: !!authHeader,
        authHeaderFormat: authHeader?.substring(0, 10),
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required. Please provide a valid Bearer token in the Authorization header.',
        code: 'MISSING_TOKEN',
      });
      return;
    }

    // Verify JWT token
    const payload = verifyToken(token);

    if (!payload) {
      console.warn('[AuthMiddleware] Authentication failed: Invalid or expired token', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token. Please login again.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    console.log('[AuthMiddleware] Token verified successfully', {
      ...requestInfo,
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      timestamp: new Date().toISOString(),
    });

    // Fetch user from database
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      console.warn('[AuthMiddleware] Authentication failed: User not found', {
        ...requestInfo,
        userId: payload.userId,
        email: payload.email,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account not found. The token may be associated with a deleted account.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Verify user role matches token
    if (user.role !== payload.role) {
      console.warn('[AuthMiddleware] Authentication failed: Role mismatch', {
        ...requestInfo,
        userId: user.id,
        tokenRole: payload.role,
        userRole: user.role,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'User role has changed. Please login again to refresh your token.',
        code: 'ROLE_MISMATCH',
      });
      return;
    }

    // Attach user to request
    req.user = user;

    console.log('[AuthMiddleware] Authentication successful', {
      ...requestInfo,
      userId: user.id,
      email: user.email,
      role: user.role,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AuthMiddleware] Authentication failed: Unexpected error', {
      ...requestInfo,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during authentication. Please try again.',
      code: 'AUTHENTICATION_ERROR',
    });
  }
}

/**
 * Role-based authorization middleware factory
 *
 * Creates middleware that enforces role-based access control.
 * Must be used after authenticate middleware.
 *
 * @param requiredRole - Required user role ('ADMIN' or 'GUEST')
 * @returns Express middleware function
 *
 * @throws {AuthMiddlewareError} If user role doesn't match required role
 *
 * @example
 * ```typescript
 * // Only ADMIN users can access this route
 * router.delete('/users/:id', authenticate, requireRole('ADMIN'), deleteUser);
 *
 * // Both ADMIN and GUEST can access (GUEST is default)
 * router.get('/profile', authenticate, requireRole('GUEST'), getProfile);
 * ```
 */
export function requireRole(requiredRole: 'ADMIN' | 'GUEST') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestInfo = sanitizeRequestForLogging(req);

    try {
      console.log('[AuthMiddleware] Role authorization check', {
        ...requestInfo,
        requiredRole,
        timestamp: new Date().toISOString(),
      });

      // Validate required role parameter
      if (requiredRole !== 'ADMIN' && requiredRole !== 'GUEST') {
        console.error('[AuthMiddleware] Authorization failed: Invalid required role', {
          ...requestInfo,
          requiredRole,
          timestamp: new Date().toISOString(),
        });

        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Invalid authorization configuration.',
          code: 'INVALID_ROLE_CONFIG',
        });
        return;
      }

      // Check if user is authenticated
      if (!req.user) {
        console.warn('[AuthMiddleware] Authorization failed: User not authenticated', {
          ...requestInfo,
          requiredRole,
          timestamp: new Date().toISOString(),
        });

        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required. Please login to access this resource.',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      // Check user role
      if (req.user.role !== requiredRole) {
        // ADMIN has access to all GUEST routes
        if (requiredRole === 'GUEST' && req.user.role === 'ADMIN') {
          console.log('[AuthMiddleware] Authorization granted: ADMIN accessing GUEST route', {
            ...requestInfo,
            userId: req.user.id,
            userRole: req.user.role,
            requiredRole,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          });
          next();
          return;
        }

        console.warn('[AuthMiddleware] Authorization failed: Insufficient permissions', {
          ...requestInfo,
          userId: req.user.id,
          userRole: req.user.role,
          requiredRole,
          timestamp: new Date().toISOString(),
        });

        res.status(403).json({
          error: 'Forbidden',
          message: `Access denied. This resource requires ${requiredRole} role.`,
          code: 'INSUFFICIENT_PERMISSIONS',
          details: {
            requiredRole,
            userRole: req.user.role,
          },
        });
        return;
      }

      console.log('[AuthMiddleware] Authorization successful', {
        ...requestInfo,
        userId: req.user.id,
        userRole: req.user.role,
        requiredRole,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AuthMiddleware] Authorization failed: Unexpected error', {
        ...requestInfo,
        requiredRole,
        error: errorMessage,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred during authorization. Please try again.',
        code: 'AUTHORIZATION_ERROR',
      });
    }
  };
}

/**
 * Optional authentication middleware
 *
 * Attempts to authenticate user but doesn't fail if token is missing.
 * Useful for routes that have different behavior for authenticated users.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @example
 * ```typescript
 * router.get('/content', optionalAuthenticate, (req, res) => {
 *   if (req.user) {
 *     // Show personalized content
 *   } else {
 *     // Show public content
 *   }
 * });
 * ```
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    const authHeader = req.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.log('[AuthMiddleware] Optional authentication: No token provided', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });
      next();
      return;
    }

    const payload = verifyToken(token);

    if (!payload) {
      console.log('[AuthMiddleware] Optional authentication: Invalid token', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });
      next();
      return;
    }

    const user = await authService.getUserById(payload.userId);

    if (user && user.role === payload.role) {
      req.user = user;
      console.log('[AuthMiddleware] Optional authentication: User authenticated', {
        ...requestInfo,
        userId: user.id,
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[AuthMiddleware] Optional authentication: Error occurred', {
      ...requestInfo,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    // Don't fail on errors in optional authentication
    next();
  }
}