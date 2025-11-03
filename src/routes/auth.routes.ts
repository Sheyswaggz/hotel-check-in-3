// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================
// Express router configuration for JWT authentication endpoints including user
// registration, login, and authenticated profile retrieval.
//
// Security: Input validation via controllers, authentication middleware
// Performance: Efficient routing with proper middleware ordering
// Maintainability: Clear route definitions with comprehensive logging
// =============================================================================

import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

/**
 * Creates and configures authentication routes
 *
 * Routes:
 * - POST /register - Register new user account
 * - POST /login - Authenticate user and receive JWT token
 * - GET /me - Get authenticated user profile (requires authentication)
 *
 * @returns Configured Express router
 */
function createAuthRouter(): Router {
  const router = Router();

  console.log('[AuthRoutes] Initializing authentication routes', {
    timestamp: new Date().toISOString(),
  });

  // =============================================================================
  // PUBLIC ROUTES - No authentication required
  // =============================================================================

  /**
   * POST /api/auth/register
   * Register new user with email, password, and role
   *
   * Request body:
   * {
   *   "email": "user@example.com",
   *   "password": "SecurePass123!",
   *   "role": "GUEST" | "ADMIN"
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
   */
  router.post('/register', register);

  console.log('[AuthRoutes] Registered POST /register route', {
    timestamp: new Date().toISOString(),
  });

  /**
   * POST /api/auth/login
   * Authenticate user with email and password
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
   */
  router.post('/login', login);

  console.log('[AuthRoutes] Registered POST /login route', {
    timestamp: new Date().toISOString(),
  });

  // =============================================================================
  // PROTECTED ROUTES - Authentication required
  // =============================================================================

  /**
   * GET /api/auth/me
   * Get authenticated user profile
   *
   * Requires: Authorization header with Bearer token
   * Authorization: Bearer <jwt-token>
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
   */
  router.get('/me', authenticate, getMe);

  console.log('[AuthRoutes] Registered GET /me route with authentication', {
    timestamp: new Date().toISOString(),
  });

  console.log('[AuthRoutes] Authentication routes initialized successfully', {
    routeCount: 3,
    publicRoutes: 2,
    protectedRoutes: 1,
    timestamp: new Date().toISOString(),
  });

  return router;
}

/**
 * Configured authentication router instance
 * Export for use in main application
 */
export const authRouter: Router = createAuthRouter();

// =============================================================================
// ROUTE DOCUMENTATION
// =============================================================================
// This router provides three authentication endpoints:
//
// 1. POST /register
//    - Creates new user account
//    - Validates email format and password strength
//    - Hashes password with bcrypt
//    - Generates JWT token
//    - Returns user object and token
//
// 2. POST /login
//    - Authenticates existing user
//    - Validates credentials
//    - Generates JWT token
//    - Returns user object and token
//
// 3. GET /me
//    - Requires valid JWT token in Authorization header
//    - Returns authenticated user profile
//    - Validates token and fetches fresh user data
//
// All routes include:
// - Comprehensive input validation
// - Structured error responses
// - Security best practices
// - Detailed logging for observability
// =============================================================================