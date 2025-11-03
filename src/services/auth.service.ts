import { prisma } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.util.js';
import { generateToken } from '../utils/jwt.util.js';
import type { RegisterDto, LoginDto, AuthResponse, AuthUser } from '../types/auth.types.js';

/**
 * Authentication service error class for auth-specific failures
 */
class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthServiceError';
    Error.captureStackTrace(this, AuthServiceError);
  }
}

/**
 * Email validation regex (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Sanitizes email to lowercase and trim
 */
function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Converts Prisma user to AuthUser (excludes password)
 */
function toAuthUser(user: {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role as 'ADMIN' | 'GUEST',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Authentication Service
 * Handles user registration, login, and token generation
 */
export class AuthService {
  /**
   * Registers a new user with email and password
   * 
   * Validates email uniqueness, hashes password with bcrypt,
   * creates user in database, and generates JWT token.
   * 
   * @param data - Registration data with email, password, and role
   * @returns Promise resolving to authentication response with user and token
   * @throws {AuthServiceError} If validation fails or user already exists
   * 
   * @example
   * ```typescript
   * const authService = new AuthService();
   * const response = await authService.register({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!',
   *   role: 'GUEST'
   * });
   * console.log('User registered:', response.user.id);
   * console.log('Token:', response.token);
   * ```
   */
  async register(data: RegisterDto): Promise<AuthResponse> {
    const startTime = Date.now();
    
    try {
      // Validate input data
      if (!data || typeof data !== 'object') {
        console.error('[AuthService] Registration failed: Invalid input data', {
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Invalid registration data',
          'INVALID_INPUT',
          400
        );
      }

      // Validate email
      if (!data.email || typeof data.email !== 'string') {
        console.error('[AuthService] Registration failed: Missing or invalid email', {
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Email is required and must be a string',
          'INVALID_EMAIL',
          400
        );
      }

      const sanitizedEmail = sanitizeEmail(data.email);

      if (!isValidEmail(sanitizedEmail)) {
        console.error('[AuthService] Registration failed: Invalid email format', {
          email: sanitizedEmail,
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Invalid email format',
          'INVALID_EMAIL_FORMAT',
          400,
          { email: sanitizedEmail }
        );
      }

      // Validate password
      if (!data.password || typeof data.password !== 'string') {
        console.error('[AuthService] Registration failed: Missing or invalid password', {
          email: sanitizedEmail,
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Password is required and must be a string',
          'INVALID_PASSWORD',
          400
        );
      }

      // Validate role
      if (!data.role || (data.role !== 'ADMIN' && data.role !== 'GUEST')) {
        console.error('[AuthService] Registration failed: Invalid role', {
          email: sanitizedEmail,
          role: data.role,
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Role must be either ADMIN or GUEST',
          'INVALID_ROLE',
          400,
          { role: data.role }
        );
      }

      console.log('[AuthService] Starting user registration', {
        email: sanitizedEmail,
        role: data.role,
        timestamp: new Date().toISOString(),
      });

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: sanitizedEmail },
      });

      if (existingUser) {
        console.warn('[AuthService] Registration failed: Email already exists', {
          email: sanitizedEmail,
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'User with this email already exists',
          'EMAIL_EXISTS',
          409,
          { email: sanitizedEmail }
        );
      }

      // Hash password (validation happens inside hashPassword)
      let hashedPassword: string;
      try {
        hashedPassword = await hashPassword(data.password);
      } catch (error) {
        console.error('[AuthService] Registration failed: Password hashing error', {
          email: sanitizedEmail,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Password does not meet security requirements',
          'PASSWORD_VALIDATION_FAILED',
          400,
          {
            details: error instanceof Error ? error.message : 'Password validation failed',
          }
        );
      }

      // Create user in database
      const user = await prisma.user.create({
        data: {
          email: sanitizedEmail,
          password: hashedPassword,
          role: data.role,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      console.log('[AuthService] User created successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
      });

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      console.log('[AuthService] Registration completed successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return {
        user: toAuthUser(user),
        token,
      };
    } catch (error) {
      // Re-throw AuthServiceError
      if (error instanceof AuthServiceError) {
        throw error;
      }

      // Handle Prisma errors
      if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as { code: string; meta?: Record<string, unknown> };
        
        if (prismaError.code === 'P2002') {
          console.error('[AuthService] Registration failed: Unique constraint violation', {
            error: prismaError,
            timestamp: new Date().toISOString(),
          });
          throw new AuthServiceError(
            'User with this email already exists',
            'EMAIL_EXISTS',
            409
          );
        }
      }

      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AuthService] Registration failed: Unexpected error', {
        error: errorMessage,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        'Failed to register user',
        'REGISTRATION_FAILED',
        500,
        { error: errorMessage }
      );
    }
  }

  /**
   * Authenticates user with email and password
   * 
   * Finds user by email, verifies password with bcrypt comparison,
   * and generates JWT token on successful authentication.
   * 
   * @param data - Login credentials with email and password
   * @returns Promise resolving to authentication response with user and token
   * @throws {AuthServiceError} If credentials are invalid or user not found
   * 
   * @example
   * ```typescript
   * const authService = new AuthService();
   * const response = await authService.login({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!'
   * });
   * console.log('User logged in:', response.user.id);
   * console.log('Token:', response.token);
   * ```
   */
  async login(data: LoginDto): Promise<AuthResponse> {
    const startTime = Date.now();

    try {
      // Validate input data
      if (!data || typeof data !== 'object') {
        console.error('[AuthService] Login failed: Invalid input data', {
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Invalid login data',
          'INVALID_INPUT',
          400
        );
      }

      // Validate email
      if (!data.email || typeof data.email !== 'string') {
        console.error('[AuthService] Login failed: Missing or invalid email', {
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Email is required and must be a string',
          'INVALID_EMAIL',
          400
        );
      }

      const sanitizedEmail = sanitizeEmail(data.email);

      if (!isValidEmail(sanitizedEmail)) {
        console.error('[AuthService] Login failed: Invalid email format', {
          email: sanitizedEmail,
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Invalid email format',
          'INVALID_EMAIL_FORMAT',
          400
        );
      }

      // Validate password
      if (!data.password || typeof data.password !== 'string') {
        console.error('[AuthService] Login failed: Missing or invalid password', {
          email: sanitizedEmail,
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Password is required and must be a string',
          'INVALID_PASSWORD',
          400
        );
      }

      console.log('[AuthService] Starting user login', {
        email: sanitizedEmail,
        timestamp: new Date().toISOString(),
      });

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: sanitizedEmail },
        select: {
          id: true,
          email: true,
          password: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        console.warn('[AuthService] Login failed: User not found', {
          email: sanitizedEmail,
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Invalid email or password',
          'INVALID_CREDENTIALS',
          401
        );
      }

      // Verify password
      let isPasswordValid: boolean;
      try {
        isPasswordValid = await comparePassword(data.password, user.password);
      } catch (error) {
        console.error('[AuthService] Login failed: Password comparison error', {
          email: sanitizedEmail,
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Failed to verify password',
          'PASSWORD_VERIFICATION_FAILED',
          500
        );
      }

      if (!isPasswordValid) {
        console.warn('[AuthService] Login failed: Invalid password', {
          email: sanitizedEmail,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
        throw new AuthServiceError(
          'Invalid email or password',
          'INVALID_CREDENTIALS',
          401
        );
      }

      console.log('[AuthService] Password verified successfully', {
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString(),
      });

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      console.log('[AuthService] Login completed successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;

      return {
        user: toAuthUser(userWithoutPassword),
        token,
      };
    } catch (error) {
      // Re-throw AuthServiceError
      if (error instanceof AuthServiceError) {
        throw error;
      }

      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AuthService] Login failed: Unexpected error', {
        error: errorMessage,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        'Failed to login user',
        'LOGIN_FAILED',
        500,
        { error: errorMessage }
      );
    }
  }

  /**
   * Retrieves user by ID for token verification
   * 
   * Used by authentication middleware to fetch user details
   * after JWT token verification.
   * 
   * @param userId - User UUID to retrieve
   * @returns Promise resolving to user object without password, or null if not found
   * 
   * @example
   * ```typescript
   * const authService = new AuthService();
   * const user = await authService.getUserById('123e4567-e89b-12d3-a456-426614174000');
   * if (user) {
   *   console.log('User found:', user.email);
   * }
   * ```
   */
  async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      // Validate userId
      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        console.warn('[AuthService] Get user by ID failed: Invalid user ID', {
          userId,
          timestamp: new Date().toISOString(),
        });
        return null;
      }

      const trimmedUserId = userId.trim();

      console.log('[AuthService] Fetching user by ID', {
        userId: trimmedUserId,
        timestamp: new Date().toISOString(),
      });

      // Find user by ID
      const user = await prisma.user.findUnique({
        where: { id: trimmedUserId },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        console.warn('[AuthService] User not found', {
          userId: trimmedUserId,
          timestamp: new Date().toISOString(),
        });
        return null;
      }

      console.log('[AuthService] User retrieved successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
      });

      return toAuthUser(user);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AuthService] Get user by ID failed: Unexpected error', {
        userId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }
}

/**
 * Export singleton instance for convenience
 */
export const authService = new AuthService();