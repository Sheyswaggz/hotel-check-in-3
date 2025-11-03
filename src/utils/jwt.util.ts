import jwt from 'jsonwebtoken';
import { environment } from '../config/environment.ts';

/**
 * JWT token payload interface
 * Contains user identification and authorization information
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Extended JWT payload with standard JWT claims
 */
interface JWTPayload extends TokenPayload {
  iat?: number;
  exp?: number;
}

/**
 * JWT utility error class for token-related failures
 */
class JWTUtilError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'JWTUtilError';
    Error.captureStackTrace(this, JWTUtilError);
  }
}

/**
 * Validates token payload structure
 */
function isValidTokenPayload(payload: unknown): payload is TokenPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const obj = payload as Record<string, unknown>;

  return (
    typeof obj.userId === 'string' &&
    obj.userId.trim().length > 0 &&
    typeof obj.email === 'string' &&
    obj.email.trim().length > 0 &&
    typeof obj.role === 'string' &&
    obj.role.trim().length > 0
  );
}

/**
 * Sanitizes payload to ensure only expected fields are included
 */
function sanitizePayload(payload: TokenPayload): TokenPayload {
  return {
    userId: payload.userId.trim(),
    email: payload.email.trim().toLowerCase(),
    role: payload.role.trim().toUpperCase(),
  };
}

/**
 * Generates a JWT token from the provided payload
 *
 * @param payload - Token payload containing user identification and role
 * @returns Signed JWT token string
 * @throws {JWTUtilError} If payload validation fails or token generation fails
 *
 * @example
 * ```typescript
 * const token = generateToken({
 *   userId: '123',
 *   email: 'user@example.com',
 *   role: 'GUEST'
 * });
 * ```
 */
export function generateToken(payload: TokenPayload): string {
  // Validate payload structure
  if (!isValidTokenPayload(payload)) {
    console.error('[JWT] Token generation failed: Invalid payload structure', {
      hasUserId: 'userId' in (payload as object),
      hasEmail: 'email' in (payload as object),
      hasRole: 'role' in (payload as object),
    });
    throw new JWTUtilError(
      'Invalid token payload: userId, email, and role are required and must be non-empty strings',
      'INVALID_PAYLOAD'
    );
  }

  // Sanitize payload
  const sanitizedPayload = sanitizePayload(payload);

  // Validate JWT configuration
  if (!environment.jwt.secret || environment.jwt.secret.trim().length === 0) {
    console.error('[JWT] Token generation failed: JWT secret not configured');
    throw new JWTUtilError(
      'JWT secret is not configured. Cannot generate token.',
      'MISSING_SECRET'
    );
  }

  if (!environment.jwt.expiresIn || environment.jwt.expiresIn.trim().length === 0) {
    console.error('[JWT] Token generation failed: JWT expiration not configured');
    throw new JWTUtilError(
      'JWT expiration time is not configured. Cannot generate token.',
      'MISSING_EXPIRATION'
    );
  }

  try {
    // Generate token with configured secret and expiration
    const token = jwt.sign(sanitizedPayload, environment.jwt.secret, {
      expiresIn: environment.jwt.expiresIn,
      algorithm: 'HS256',
      issuer: 'hotel-check-in-system',
      audience: 'hotel-check-in-api',
    });

    console.log('[JWT] Token generated successfully', {
      userId: sanitizedPayload.userId,
      email: sanitizedPayload.email,
      role: sanitizedPayload.role,
      expiresIn: environment.jwt.expiresIn,
    });

    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[JWT] Token generation failed', {
      error: errorMessage,
      userId: sanitizedPayload.userId,
    });

    throw new JWTUtilError(
      `Failed to generate JWT token: ${errorMessage}`,
      'GENERATION_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Verifies and decodes a JWT token
 *
 * @param token - JWT token string to verify
 * @returns Decoded token payload if valid, null if invalid or expired
 *
 * @example
 * ```typescript
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log('User ID:', payload.userId);
 * } else {
 *   console.log('Invalid or expired token');
 * }
 * ```
 */
export function verifyToken(token: string): TokenPayload | null {
  // Validate input
  if (typeof token !== 'string' || token.trim().length === 0) {
    console.warn('[JWT] Token verification failed: Empty or invalid token provided');
    return null;
  }

  const trimmedToken = token.trim();

  // Validate JWT configuration
  if (!environment.jwt.secret || environment.jwt.secret.trim().length === 0) {
    console.error('[JWT] Token verification failed: JWT secret not configured');
    return null;
  }

  try {
    // Verify token with configured secret
    const decoded = jwt.verify(trimmedToken, environment.jwt.secret, {
      algorithms: ['HS256'],
      issuer: 'hotel-check-in-system',
      audience: 'hotel-check-in-api',
    }) as JWTPayload;

    // Validate decoded payload structure
    if (!isValidTokenPayload(decoded)) {
      console.warn('[JWT] Token verification failed: Invalid payload structure in token', {
        hasUserId: 'userId' in decoded,
        hasEmail: 'email' in decoded,
        hasRole: 'role' in decoded,
      });
      return null;
    }

    console.log('[JWT] Token verified successfully', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    });

    // Return only the expected payload fields
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    // Handle specific JWT errors
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('[JWT] Token verification failed: Token expired', {
        expiredAt: error.expiredAt,
      });
      return null;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      console.warn('[JWT] Token verification failed: Invalid token', {
        error: error.message,
      });
      return null;
    }

    if (error instanceof jwt.NotBeforeError) {
      console.warn('[JWT] Token verification failed: Token not yet valid', {
        notBefore: error.date,
      });
      return null;
    }

    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[JWT] Token verification failed: Unexpected error', {
      error: errorMessage,
    });
    return null;
  }
}