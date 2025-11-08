// =============================================================================
// ADMIN CONTROLLER - DASHBOARD AND ANALYTICS ENDPOINTS
// =============================================================================
// Production-grade controller for admin dashboard functionality including
// statistics, occupancy tracking, recent reservations, and user management.
// All endpoints require ADMIN role authorization.
//
// Performance targets:
// - Dashboard stats: < 500ms
// - Recent reservations: < 200ms
// - Room occupancy: < 500ms
// - User listing: < 300ms
//
// Security: ADMIN role required for all endpoints
// Observability: Comprehensive logging with request context
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service.js';
import type {
  UserListQueryParams,
  OccupancyQueryParams,
} from '../types/admin.types.js';

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Admin controller error class for request handling failures
 */
class AdminControllerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AdminControllerError';
    Error.captureStackTrace(this, AdminControllerError);
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default limit for recent reservations
 */
const DEFAULT_RECENT_LIMIT = 10;

/**
 * Maximum limit for recent reservations
 */
const MAX_RECENT_LIMIT = 50;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

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
    userId: req.user?.id,
    userRole: req.user?.role,
    query: req.query,
    params: req.params,
  };
}

/**
 * Validates and sanitizes numeric query parameter
 *
 * @param value - Query parameter value
 * @param defaultValue - Default value if invalid
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Sanitized numeric value
 */
function sanitizeNumericParam(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return Math.min(Math.max(parsed, min), max);
    }
  }
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.min(Math.max(value, min), max);
  }
  return defaultValue;
}

/**
 * Validates ISO date string format
 *
 * @param value - Date string to validate
 * @returns True if valid ISO date format
 */
function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime());
}

// =============================================================================
// CONTROLLER HANDLERS
// =============================================================================

/**
 * Get dashboard statistics
 *
 * Returns comprehensive dashboard statistics including room counts,
 * occupancy rate, reservation counts, checked-in guests, and revenue.
 *
 * @route GET /api/admin/dashboard
 * @access ADMIN only
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @returns Promise resolving to void
 *
 * @example
 * ```typescript
 * GET /api/admin/dashboard
 * Authorization: Bearer <admin-token>
 *
 * Response:
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
export async function getDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[AdminController] Dashboard statistics request', {
      ...requestInfo,
      timestamp: new Date().toISOString(),
    });

    // Verify user is authenticated (should be guaranteed by middleware)
    if (!req.user) {
      console.error('[AdminController] Dashboard request without authenticated user', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Verify user has ADMIN role (should be guaranteed by middleware)
    if (req.user.role !== 'ADMIN') {
      console.warn('[AdminController] Dashboard access denied: Insufficient permissions', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    // Fetch dashboard statistics
    const stats = await adminService.getDashboardStats();

    const duration = Date.now() - startTime;
    console.log('[AdminController] Dashboard statistics retrieved successfully', {
      ...requestInfo,
      duration,
      occupancyRate: stats.occupancyRate,
      totalReservations: stats.totalReservations,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      stats,
      timestamp: new Date(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[AdminController] Dashboard statistics request failed', {
      ...requestInfo,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
    });

    next(
      new AdminControllerError(
        'Failed to retrieve dashboard statistics',
        'DASHBOARD_STATS_FAILED',
        500,
        { originalError: errorMessage }
      )
    );
  }
}

/**
 * Get recent reservations
 *
 * Returns most recent reservations with user and room details.
 * Supports optional limit parameter.
 *
 * @route GET /api/admin/reservations/recent
 * @access ADMIN only
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @returns Promise resolving to void
 *
 * @example
 * ```typescript
 * GET /api/admin/reservations/recent?limit=20
 * Authorization: Bearer <admin-token>
 *
 * Response:
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
export async function getRecentReservations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[AdminController] Recent reservations request', {
      ...requestInfo,
      timestamp: new Date().toISOString(),
    });

    // Verify user is authenticated
    if (!req.user) {
      console.error('[AdminController] Recent reservations request without authenticated user', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Verify user has ADMIN role
    if (req.user.role !== 'ADMIN') {
      console.warn(
        '[AdminController] Recent reservations access denied: Insufficient permissions',
        {
          ...requestInfo,
          timestamp: new Date().toISOString(),
        }
      );

      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    // Validate and sanitize limit parameter
    const limit = sanitizeNumericParam(
      req.query.limit,
      DEFAULT_RECENT_LIMIT,
      1,
      MAX_RECENT_LIMIT
    );

    console.log('[AdminController] Fetching recent reservations', {
      ...requestInfo,
      limit,
      timestamp: new Date().toISOString(),
    });

    // Fetch recent reservations
    const reservations = await adminService.getRecentReservations(limit);

    const duration = Date.now() - startTime;
    console.log('[AdminController] Recent reservations retrieved successfully', {
      ...requestInfo,
      count: reservations.length,
      limit,
      duration,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      reservations,
      count: reservations.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[AdminController] Recent reservations request failed', {
      ...requestInfo,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
    });

    next(
      new AdminControllerError(
        'Failed to retrieve recent reservations',
        'RECENT_RESERVATIONS_FAILED',
        500,
        { originalError: errorMessage }
      )
    );
  }
}

/**
 * Get room occupancy data
 *
 * Returns room occupancy statistics for specified date range.
 * Supports optional startDate and endDate parameters.
 *
 * @route GET /api/admin/rooms/occupancy
 * @access ADMIN only
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @returns Promise resolving to void
 *
 * @example
 * ```typescript
 * GET /api/admin/rooms/occupancy?startDate=2024-01-01&endDate=2024-01-31
 * Authorization: Bearer <admin-token>
 *
 * Response:
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
export async function getRoomOccupancy(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[AdminController] Room occupancy request', {
      ...requestInfo,
      timestamp: new Date().toISOString(),
    });

    // Verify user is authenticated
    if (!req.user) {
      console.error('[AdminController] Room occupancy request without authenticated user', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Verify user has ADMIN role
    if (req.user.role !== 'ADMIN') {
      console.warn('[AdminController] Room occupancy access denied: Insufficient permissions', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    // Validate and sanitize date parameters
    const params: OccupancyQueryParams = {};

    if (req.query.startDate) {
      if (!isValidISODate(req.query.startDate)) {
        console.warn('[AdminController] Invalid startDate parameter', {
          ...requestInfo,
          startDate: req.query.startDate,
          timestamp: new Date().toISOString(),
        });

        res.status(400).json({
          error: 'Bad Request',
          message: 'startDate must be in ISO 8601 format (YYYY-MM-DD)',
          code: 'INVALID_START_DATE',
        });
        return;
      }
      params.startDate = req.query.startDate;
    }

    if (req.query.endDate) {
      if (!isValidISODate(req.query.endDate)) {
        console.warn('[AdminController] Invalid endDate parameter', {
          ...requestInfo,
          endDate: req.query.endDate,
          timestamp: new Date().toISOString(),
        });

        res.status(400).json({
          error: 'Bad Request',
          message: 'endDate must be in ISO 8601 format (YYYY-MM-DD)',
          code: 'INVALID_END_DATE',
        });
        return;
      }
      params.endDate = req.query.endDate;
    }

    console.log('[AdminController] Fetching room occupancy', {
      ...requestInfo,
      params,
      timestamp: new Date().toISOString(),
    });

    // Fetch room occupancy data
    const data = await adminService.getRoomOccupancy(params);

    const duration = Date.now() - startTime;
    console.log('[AdminController] Room occupancy retrieved successfully', {
      ...requestInfo,
      dataPoints: data.length,
      duration,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      data,
      startDate: params.startDate ?? data[0]?.date ?? null,
      endDate: params.endDate ?? data[data.length - 1]?.date ?? null,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[AdminController] Room occupancy request failed', {
      ...requestInfo,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
    });

    next(
      new AdminControllerError(
        'Failed to retrieve room occupancy data',
        'ROOM_OCCUPANCY_FAILED',
        500,
        { originalError: errorMessage }
      )
    );
  }
}

/**
 * Get user list with pagination
 *
 * Returns paginated list of users with reservation counts.
 * Supports filtering, sorting, and pagination parameters.
 *
 * @route GET /api/admin/users
 * @access ADMIN only
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @returns Promise resolving to void
 *
 * @example
 * ```typescript
 * GET /api/admin/users?page=1&pageSize=20&role=GUEST&sortBy=createdAt&sortOrder=desc
 * Authorization: Bearer <admin-token>
 *
 * Response:
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
export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[AdminController] User list request', {
      ...requestInfo,
      timestamp: new Date().toISOString(),
    });

    // Verify user is authenticated
    if (!req.user) {
      console.error('[AdminController] User list request without authenticated user', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Verify user has ADMIN role
    if (req.user.role !== 'ADMIN') {
      console.warn('[AdminController] User list access denied: Insufficient permissions', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    // Validate and sanitize query parameters
    const params: UserListQueryParams = {};

    // Page parameter
    if (req.query.page) {
      const page = sanitizeNumericParam(req.query.page, 1, 1, Number.MAX_SAFE_INTEGER);
      params.page = page;
    }

    // Page size parameter
    if (req.query.pageSize) {
      const pageSize = sanitizeNumericParam(req.query.pageSize, 20, 1, 100);
      params.pageSize = pageSize;
    }

    // Role filter parameter
    if (req.query.role) {
      const role = req.query.role;
      if (role !== 'ADMIN' && role !== 'GUEST') {
        console.warn('[AdminController] Invalid role parameter', {
          ...requestInfo,
          role,
          timestamp: new Date().toISOString(),
        });

        res.status(400).json({
          error: 'Bad Request',
          message: 'role must be either ADMIN or GUEST',
          code: 'INVALID_ROLE',
        });
        return;
      }
      params.role = role;
    }

    // Sort by parameter
    if (req.query.sortBy) {
      const sortBy = req.query.sortBy;
      if (sortBy !== 'createdAt' && sortBy !== 'email' && sortBy !== 'reservationCount') {
        console.warn('[AdminController] Invalid sortBy parameter', {
          ...requestInfo,
          sortBy,
          timestamp: new Date().toISOString(),
        });

        res.status(400).json({
          error: 'Bad Request',
          message: 'sortBy must be one of: createdAt, email, reservationCount',
          code: 'INVALID_SORT_BY',
        });
        return;
      }
      params.sortBy = sortBy;
    }

    // Sort order parameter
    if (req.query.sortOrder) {
      const sortOrder = req.query.sortOrder;
      if (sortOrder !== 'asc' && sortOrder !== 'desc') {
        console.warn('[AdminController] Invalid sortOrder parameter', {
          ...requestInfo,
          sortOrder,
          timestamp: new Date().toISOString(),
        });

        res.status(400).json({
          error: 'Bad Request',
          message: 'sortOrder must be either asc or desc',
          code: 'INVALID_SORT_ORDER',
        });
        return;
      }
      params.sortOrder = sortOrder;
    }

    console.log('[AdminController] Fetching user list', {
      ...requestInfo,
      params,
      timestamp: new Date().toISOString(),
    });

    // Fetch user list
    const result = await adminService.getUsers(params);

    const duration = Date.now() - startTime;
    console.log('[AdminController] User list retrieved successfully', {
      ...requestInfo,
      count: result.users.length,
      total: result.pagination.total,
      page: result.pagination.page,
      duration,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[AdminController] User list request failed', {
      ...requestInfo,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
    });

    next(
      new AdminControllerError(
        'Failed to retrieve user list',
        'USER_LIST_FAILED',
        500,
        { originalError: errorMessage }
      )
    );
  }
}