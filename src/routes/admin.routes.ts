// =============================================================================
// ADMIN ROUTES - DASHBOARD AND ANALYTICS ENDPOINTS
// =============================================================================
// Production-grade Express router for admin dashboard functionality including
// statistics, occupancy tracking, recent reservations, and user management.
// All routes require ADMIN role authorization.
//
// Security: ADMIN role required for all endpoints via middleware
// Performance: Optimized queries with caching support
// Observability: Comprehensive logging via controllers
// =============================================================================

import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import {
  getDashboard,
  getRecentReservations,
  getRoomOccupancy,
  getUsers,
} from '../controllers/admin.controller.js';

// =============================================================================
// ROUTER FACTORY
// =============================================================================

/**
 * Creates and configures admin routes
 *
 * All routes require authentication and ADMIN role.
 * Routes are organized by resource type:
 * - Dashboard statistics
 * - Recent reservations
 * - Room occupancy data
 * - User management
 *
 * @returns Configured Express router
 *
 * @example
 * ```typescript
 * import { adminRouter } from './routes/admin.routes.js';
 * app.use('/api/admin', adminRouter);
 * ```
 */
function createAdminRouter(): ExpressRouter {
  const router = Router();

  // =============================================================================
  // MIDDLEWARE CONFIGURATION
  // =============================================================================

  /**
   * Apply authentication and authorization middleware to all admin routes
   * - authenticate: Validates JWT token and attaches user to request
   * - requireRole('ADMIN'): Ensures user has ADMIN role
   */
  router.use(authenticate);
  router.use(requireRole('ADMIN'));

  // =============================================================================
  // DASHBOARD ROUTES
  // =============================================================================

  /**
   * GET /dashboard
   *
   * Returns comprehensive dashboard statistics including:
   * - Total rooms and availability
   * - Occupancy rate
   * - Reservation counts by status
   * - Checked-in guests
   * - Revenue metrics
   *
   * @access ADMIN only
   * @performance Target: < 500ms
   *
   * @example
   * ```typescript
   * GET /api/admin/dashboard
   * Authorization: Bearer <admin-token>
   *
   * Response 200:
   * {
   *   "stats": {
   *     "totalRooms": 50,
   *     "availableRooms": 15,
   *     "occupancyRate": 70.00,
   *     "totalReservations": 250,
   *     "pendingReservations": 5,
   *     "confirmedReservations": 10,
   *     "checkedInGuests": 35,
   *     "revenue": 125000.00
   *   },
   *   "timestamp": "2024-01-15T10:30:00.000Z"
   * }
   * ```
   */
  router.get('/dashboard', getDashboard);

  // =============================================================================
  // RESERVATION ROUTES
  // =============================================================================

  /**
   * GET /reservations/recent
   *
   * Returns most recent reservations with user and room details.
   * Supports optional limit parameter (default: 10, max: 50).
   *
   * @access ADMIN only
   * @performance Target: < 200ms
   *
   * @query limit - Number of reservations to return (optional)
   *
   * @example
   * ```typescript
   * GET /api/admin/reservations/recent?limit=20
   * Authorization: Bearer <admin-token>
   *
   * Response 200:
   * {
   *   "reservations": [
   *     {
   *       "id": "uuid",
   *       "userId": "uuid",
   *       "roomId": "uuid",
   *       "checkInDate": "2024-01-20",
   *       "checkOutDate": "2024-01-25",
   *       "status": "CONFIRMED",
   *       "createdAt": "2024-01-15T10:00:00.000Z",
   *       "user": { "email": "guest@example.com" },
   *       "room": { "roomNumber": "101", "type": "DELUXE", "price": 150.00 }
   *     }
   *   ],
   *   "count": 20
   * }
   * ```
   */
  router.get('/reservations/recent', getRecentReservations);

  // =============================================================================
  // ROOM ROUTES
  // =============================================================================

  /**
   * GET /rooms/occupancy
   *
   * Returns room occupancy statistics for specified date range.
   * Supports optional startDate and endDate parameters.
   *
   * @access ADMIN only
   * @performance Target: < 500ms
   *
   * @query startDate - Start date in ISO 8601 format (YYYY-MM-DD) (optional)
   * @query endDate - End date in ISO 8601 format (YYYY-MM-DD) (optional)
   *
   * @example
   * ```typescript
   * GET /api/admin/rooms/occupancy?startDate=2024-01-01&endDate=2024-01-31
   * Authorization: Bearer <admin-token>
   *
   * Response 200:
   * {
   *   "data": [
   *     {
   *       "date": "2024-01-01",
   *       "occupiedRooms": 35,
   *       "totalRooms": 50,
   *       "rate": 70.00
   *     }
   *   ],
   *   "startDate": "2024-01-01",
   *   "endDate": "2024-01-31"
   * }
   * ```
   */
  router.get('/rooms/occupancy', getRoomOccupancy);

  // =============================================================================
  // USER ROUTES
  // =============================================================================

  /**
   * GET /users
   *
   * Returns paginated list of users with reservation counts.
   * Supports filtering, sorting, and pagination parameters.
   *
   * @access ADMIN only
   * @performance Target: < 300ms
   *
   * @query page - Page number (default: 1) (optional)
   * @query pageSize - Items per page (default: 20, max: 100) (optional)
   * @query role - Filter by role: ADMIN or GUEST (optional)
   * @query sortBy - Sort field: createdAt, email, or reservationCount (optional)
   * @query sortOrder - Sort order: asc or desc (optional)
   *
   * @example
   * ```typescript
   * GET /api/admin/users?page=1&pageSize=20&role=GUEST&sortBy=createdAt&sortOrder=desc
   * Authorization: Bearer <admin-token>
   *
   * Response 200:
   * {
   *   "users": [
   *     {
   *       "id": "uuid",
   *       "email": "user@example.com",
   *       "role": "GUEST",
   *       "createdAt": "2024-01-01T00:00:00.000Z",
   *       "updatedAt": "2024-01-15T10:00:00.000Z",
   *       "reservationCount": 5
   *     }
   *   ],
   *   "pagination": {
   *     "total": 100,
   *     "page": 1,
   *     "pageSize": 20,
   *     "totalPages": 5
   *   }
   * }
   * ```
   */
  router.get('/users', getUsers);

  return router;
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Configured admin router instance
 * Mount at /api/admin in main application
 */
export const adminRouter: ExpressRouter = createAdminRouter();