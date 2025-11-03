// =============================================================================
// AUTHENTICATION TYPE DEFINITIONS
// =============================================================================
// Type-safe interfaces for JWT authentication system including user
// registration, login, token management, and role-based access control.
//
// Security: All sensitive data types are properly typed to prevent exposure
// Performance: Lightweight type definitions with no runtime overhead
// Maintainability: Clear type definitions for all authentication flows
// =============================================================================

/**
 * User role enumeration for role-based access control
 * Matches Prisma schema UserRole enum
 */
export type UserRole = 'ADMIN' | 'GUEST';

/**
 * Data Transfer Object for user registration
 * Used in POST /api/auth/register endpoint
 *
 * Security considerations:
 * - Email must be validated for format at application level
 * - Password must meet strength requirements before hashing
 * - Role defaults to GUEST if not provided
 */
export interface RegisterDto {
  /**
   * User email address - must be unique and valid format
   * Validation: RFC 5322 email format
   * Example: "user@example.com"
   */
  email: string;

  /**
   * Plain text password - will be hashed with bcrypt before storage
   * Validation: Minimum 8 characters, at least one uppercase, one lowercase, one number
   * Security: Never log or expose this value
   */
  password: string;

  /**
   * User role for access control
   * Defaults to GUEST if not provided
   * Only ADMIN users can create other ADMIN users
   */
  role: UserRole;
}

/**
 * Data Transfer Object for user login
 * Used in POST /api/auth/login endpoint
 *
 * Security considerations:
 * - Rate limiting should be applied to prevent brute force attacks
 * - Failed login attempts should be logged for security monitoring
 */
export interface LoginDto {
  /**
   * User email address for authentication
   * Case-insensitive comparison recommended
   */
  email: string;

  /**
   * Plain text password for verification
   * Will be compared against bcrypt hash
   * Security: Never log or expose this value
   */
  password: string;
}

/**
 * User object returned in authentication responses
 * Excludes sensitive information like password hash
 *
 * Security: Password field is intentionally omitted
 */
export interface AuthUser {
  /**
   * Unique user identifier (UUID)
   * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  id: string;

  /**
   * User email address
   */
  email: string;

  /**
   * User role for authorization checks
   */
  role: UserRole;

  /**
   * Account creation timestamp
   * ISO 8601 format with timezone
   */
  createdAt: Date;

  /**
   * Last update timestamp
   * ISO 8601 format with timezone
   */
  updatedAt: Date;
}

/**
 * Authentication response returned after successful registration or login
 * Contains user information and JWT access token
 *
 * Usage:
 * - Client stores token in secure storage (httpOnly cookie or secure localStorage)
 * - Token included in Authorization header for subsequent requests
 * - Token format: "Bearer <token>"
 */
export interface AuthResponse {
  /**
   * Authenticated user object without sensitive data
   */
  user: AuthUser;

  /**
   * JWT access token for authentication
   * Format: Header.Payload.Signature (base64url encoded)
   * Expiration: 24 hours from generation
   * Algorithm: HS256
   *
   * Security:
   * - Store securely on client side
   * - Include in Authorization header as "Bearer <token>"
   * - Validate signature on every request
   */
  token: string;
}

/**
 * JWT token payload structure
 * Embedded in JWT token and extracted during verification
 *
 * Standard JWT claims:
 * - iat (issued at): Token generation timestamp
 * - exp (expiration): Token expiration timestamp (iat + 24 hours)
 *
 * Custom claims:
 * - userId: User identifier for database lookups
 * - email: User email for display purposes
 * - role: User role for authorization checks
 */
export interface JwtPayload {
  /**
   * User identifier (UUID)
   * Used to fetch user data from database
   */
  userId: string;

  /**
   * User email address
   * Included for convenience and logging
   */
  email: string;

  /**
   * User role for authorization
   * Used by middleware to enforce access control
   */
  role: UserRole;

  /**
   * Issued at timestamp (Unix epoch seconds)
   * Standard JWT claim
   * Used to calculate token age
   */
  iat: number;

  /**
   * Expiration timestamp (Unix epoch seconds)
   * Standard JWT claim
   * Token is invalid after this time
   * Default: iat + 86400 (24 hours)
   */
  exp: number;
}

/**
 * Type guard to check if a value is a valid UserRole
 * Used for runtime validation of role values
 *
 * @param value - Value to check
 * @returns True if value is 'ADMIN' or 'GUEST'
 *
 * @example
 * ```typescript
 * if (isUserRole(req.body.role)) {
 *   // Safe to use as UserRole
 * }
 * ```
 */
export function isUserRole(value: unknown): value is UserRole {
  return value === 'ADMIN' || value === 'GUEST';
}

/**
 * Type guard to validate RegisterDto structure
 * Used for runtime validation of registration requests
 *
 * @param value - Value to check
 * @returns True if value matches RegisterDto interface
 *
 * @example
 * ```typescript
 * if (isRegisterDto(req.body)) {
 *   // Safe to use as RegisterDto
 * }
 * ```
 */
export function isRegisterDto(value: unknown): value is RegisterDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'email' in value &&
    typeof (value as RegisterDto).email === 'string' &&
    'password' in value &&
    typeof (value as RegisterDto).password === 'string' &&
    'role' in value &&
    isUserRole((value as RegisterDto).role)
  );
}

/**
 * Type guard to validate LoginDto structure
 * Used for runtime validation of login requests
 *
 * @param value - Value to check
 * @returns True if value matches LoginDto interface
 *
 * @example
 * ```typescript
 * if (isLoginDto(req.body)) {
 *   // Safe to use as LoginDto
 * }
 * ```
 */
export function isLoginDto(value: unknown): value is LoginDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'email' in value &&
    typeof (value as LoginDto).email === 'string' &&
    'password' in value &&
    typeof (value as LoginDto).password === 'string'
  );
}

/**
 * Type guard to validate JwtPayload structure
 * Used for runtime validation of decoded JWT tokens
 *
 * @param value - Value to check
 * @returns True if value matches JwtPayload interface
 *
 * @example
 * ```typescript
 * const decoded = jwt.verify(token, secret);
 * if (isJwtPayload(decoded)) {
 *   // Safe to use as JwtPayload
 * }
 * ```
 */
export function isJwtPayload(value: unknown): value is JwtPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    typeof (value as JwtPayload).userId === 'string' &&
    'email' in value &&
    typeof (value as JwtPayload).email === 'string' &&
    'role' in value &&
    isUserRole((value as JwtPayload).role) &&
    'iat' in value &&
    typeof (value as JwtPayload).iat === 'number' &&
    'exp' in value &&
    typeof (value as JwtPayload).exp === 'number'
  );
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================
// All types and interfaces are exported for use throughout the application
// Type guards are exported for runtime validation
// =============================================================================