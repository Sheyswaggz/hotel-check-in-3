// =============================================================================
// ROOM ROUTES - EXPRESS ROUTER CONFIGURATION FOR ROOM MANAGEMENT
// =============================================================================
// This module configures Express routes for room management API endpoints.
// Implements RESTful routing with authentication, authorization, validation,
// and proper middleware chaining for all CRUD operations.
//
// Architecture: Express Router pattern with middleware composition
// Security: JWT authentication and role-based authorization for admin routes
// Validation: Express-validator middleware for input validation
// Error Handling: Centralized error handling via controller layer
// =============================================================================

import { Router } from 'express';
import {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
} from '../controllers/room.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  roomListValidation,
  getRoomValidation,
  createRoomValidation,
  updateRoomByIdValidation,
  deleteRoomValidation,
} from '../validators/room.validator.js';

/**
 * Creates and configures the room management router
 * Defines all room-related endpoints with appropriate middleware
 *
 * @returns {Router} Configured Express router for room endpoints
 *
 * @remarks
 * Route Structure:
 * - GET /rooms - List all rooms with filtering and pagination (public)
 * - GET /rooms/:id - Get single room by ID (public)
 * - POST /rooms - Create new room (admin only)
 * - PUT /rooms/:id - Update existing room (admin only)
 * - DELETE /rooms/:id - Delete room (admin only)
 *
 * Middleware Chain:
 * 1. Validation middleware (express-validator)
 * 2. Validation error handler (validate)
 * 3. Authentication middleware (authenticate) - admin routes only
 * 4. Authorization middleware (requireRole) - admin routes only
 * 5. Controller handler
 */
function createRoomRouter(): Router {
  const router = Router();

  console.log('[RoomRouter] Initializing room routes', {
    timestamp: new Date().toISOString(),
  });

  // =============================================================================
  // PUBLIC ROUTES - No authentication required
  // =============================================================================

  /**
   * GET /rooms - List all rooms with optional filtering and pagination
   *
   * Query Parameters:
   * - type?: string - Filter by room type (STANDARD, DELUXE, SUITE, etc.)
   * - status?: string - Filter by room status (AVAILABLE, OCCUPIED, MAINTENANCE)
   * - minPrice?: number - Filter by minimum price
   * - maxPrice?: number - Filter by maximum price
   * - page?: number - Page number for pagination (default: 1)
   * - limit?: number - Items per page (default: 10, max: 100)
   *
   * Response 200:
   * {
   *   "data": [{ room objects }],
   *   "meta": {
   *     "page": 1,
   *     "limit": 10,
   *     "total": 50,
   *     "totalPages": 5
   *   }
   * }
   */
  router.get('/', roomListValidation, validate, getAllRooms);

  /**
   * GET /rooms/:id - Get single room by ID
   *
   * Path Parameters:
   * - id: string (UUID v4) - Room ID
   *
   * Response 200:
   * {
   *   "id": "uuid",
   *   "roomNumber": "101",
   *   "type": "DELUXE",
   *   "price": "150.00",
   *   "status": "AVAILABLE",
   *   "createdAt": "2024-01-01T00:00:00.000Z",
   *   "updatedAt": "2024-01-01T00:00:00.000Z"
   * }
   *
   * Response 404:
   * {
   *   "error": "Not Found",
   *   "message": "Room with ID {id} not found",
   *   "code": "ROOM_NOT_FOUND"
   * }
   */
  router.get('/:id', getRoomValidation, validate, getRoomById);

  // =============================================================================
  // ADMIN ROUTES - Authentication and authorization required
  // =============================================================================

  /**
   * POST /rooms - Create new room (admin only)
   *
   * Request Body:
   * {
   *   "roomNumber": "101",
   *   "type": "DELUXE",
   *   "price": 150.00,
   *   "status": "AVAILABLE"
   * }
   *
   * Response 201:
   * {
   *   "id": "uuid",
   *   "roomNumber": "101",
   *   "type": "DELUXE",
   *   "price": "150.00",
   *   "status": "AVAILABLE",
   *   "createdAt": "2024-01-01T00:00:00.000Z",
   *   "updatedAt": "2024-01-01T00:00:00.000Z"
   * }
   *
   * Response 401: Unauthorized (missing or invalid token)
   * Response 403: Forbidden (insufficient permissions)
   * Response 409: Conflict (duplicate room number)
   */
  router.post(
    '/',
    authenticate,
    requireRole('ADMIN'),
    createRoomValidation,
    validate,
    createRoom
  );

  /**
   * PUT /rooms/:id - Update existing room (admin only)
   *
   * Path Parameters:
   * - id: string (UUID v4) - Room ID
   *
   * Request Body (all fields optional):
   * {
   *   "roomNumber"?: "102",
   *   "type"?: "SUITE",
   *   "price"?: 200.00,
   *   "status"?: "MAINTENANCE"
   * }
   *
   * Response 200:
   * {
   *   "id": "uuid",
   *   "roomNumber": "102",
   *   "type": "SUITE",
   *   "price": "200.00",
   *   "status": "MAINTENANCE",
   *   "createdAt": "2024-01-01T00:00:00.000Z",
   *   "updatedAt": "2024-01-01T12:00:00.000Z"
   * }
   *
   * Response 401: Unauthorized (missing or invalid token)
   * Response 403: Forbidden (insufficient permissions)
   * Response 404: Not Found (room not found)
   * Response 409: Conflict (duplicate room number)
   */
  router.put(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    updateRoomByIdValidation,
    validate,
    updateRoom
  );

  /**
   * DELETE /rooms/:id - Delete room (admin only)
   *
   * Path Parameters:
   * - id: string (UUID v4) - Room ID
   *
   * Response 204: No Content (successful deletion)
   *
   * Response 401: Unauthorized (missing or invalid token)
   * Response 403: Forbidden (insufficient permissions)
   * Response 404: Not Found (room not found)
   *
   * Note: Cascades deletion to associated reservations
   */
  router.delete(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    deleteRoomValidation,
    validate,
    deleteRoom
  );

  console.log('[RoomRouter] Room routes initialized successfully', {
    routes: {
      public: ['GET /', 'GET /:id'],
      admin: ['POST /', 'PUT /:id', 'DELETE /:id'],
    },
    timestamp: new Date().toISOString(),
  });

  return router;
}

/**
 * Configured Express router for room management endpoints
 * Export as singleton instance for use in main application
 */
export const roomRouter: Router = createRoomRouter();