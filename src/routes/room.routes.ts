// =============================================================================
// ROOM ROUTES - EXPRESS ROUTER CONFIGURATION FOR ROOM MANAGEMENT API
// =============================================================================
// This module configures Express routes for room management endpoints including
// CRUD operations with proper authentication, authorization, and validation.
//
// Architecture: RESTful API design with role-based access control
// Security: Admin-only operations protected by authentication middleware
// Validation: Comprehensive input validation using express-validator
// Error Handling: Validation errors handled by validation middleware
// =============================================================================

import { Router } from 'express';
import {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
} from '../controllers/room.controller.js';
import {
  createRoomValidation,
  updateRoomValidation,
  roomIdValidation,
  roomListValidation,
} from '../validators/room.validator.js';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

/**
 * Creates and configures the room management router
 * 
 * Routes:
 * - GET    /rooms       - List all rooms with filtering and pagination (public)
 * - GET    /rooms/:id   - Get single room by ID (public)
 * - POST   /rooms       - Create new room (admin only)
 * - PUT    /rooms/:id   - Update existing room (admin only)
 * - DELETE /rooms/:id   - Delete room (admin only)
 * 
 * @returns {Router} Configured Express router
 */
function createRoomRouter(): Router {
  const router = Router();

  // =============================================================================
  // PUBLIC ROUTES - No authentication required
  // =============================================================================

  /**
   * GET /rooms - Retrieve paginated list of rooms with optional filtering
   * 
   * Query Parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10, max: 100)
   * - type: Filter by room type (STANDARD, DELUXE, SUITE, EXECUTIVE, PRESIDENTIAL)
   * - status: Filter by room status (AVAILABLE, OCCUPIED, MAINTENANCE)
   * - minPrice: Minimum price filter
   * - maxPrice: Maximum price filter
   * 
   * Response: 200 OK with paginated rooms data
   * 
   * @middleware roomListValidation - Validates query parameters
   * @middleware validate - Processes validation results
   * @handler getAllRooms - Controller handler
   */
  router.get(
    '/',
    roomListValidation,
    validate,
    getAllRooms
  );

  /**
   * GET /rooms/:id - Retrieve single room by ID
   * 
   * Path Parameters:
   * - id: Room UUID
   * 
   * Response: 200 OK with room data, 404 if not found
   * 
   * @middleware roomIdValidation - Validates room ID parameter
   * @middleware validate - Processes validation results
   * @handler getRoomById - Controller handler
   */
  router.get(
    '/:id',
    roomIdValidation,
    validate,
    getRoomById
  );

  // =============================================================================
  // ADMIN-ONLY ROUTES - Authentication and authorization required
  // =============================================================================

  /**
   * POST /rooms - Create new room (admin only)
   * 
   * Request Body:
   * {
   *   "roomNumber": "string",
   *   "type": "STANDARD|DELUXE|SUITE|EXECUTIVE|PRESIDENTIAL",
   *   "price": number,
   *   "status": "AVAILABLE|OCCUPIED|MAINTENANCE"
   * }
   * 
   * Response: 201 Created with room data, 409 if room number exists
   * 
   * @middleware authenticate - Verifies JWT token and attaches user to request
   * @middleware requireRole('ADMIN') - Ensures user has ADMIN role
   * @middleware createRoomValidation - Validates request body
   * @middleware validate - Processes validation results
   * @handler createRoom - Controller handler
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
   * - id: Room UUID
   * 
   * Request Body (all fields optional):
   * {
   *   "roomNumber": "string",
   *   "type": "STANDARD|DELUXE|SUITE|EXECUTIVE|PRESIDENTIAL",
   *   "price": number,
   *   "status": "AVAILABLE|OCCUPIED|MAINTENANCE"
   * }
   * 
   * Response: 200 OK with updated room data, 404 if not found
   * 
   * @middleware authenticate - Verifies JWT token and attaches user to request
   * @middleware requireRole('ADMIN') - Ensures user has ADMIN role
   * @middleware roomIdValidation - Validates room ID parameter
   * @middleware updateRoomValidation - Validates request body
   * @middleware validate - Processes validation results
   * @handler updateRoom - Controller handler
   */
  router.put(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    roomIdValidation,
    updateRoomValidation,
    validate,
    updateRoom
  );

  /**
   * DELETE /rooms/:id - Delete room (admin only)
   * 
   * Path Parameters:
   * - id: Room UUID
   * 
   * Response: 204 No Content on success, 404 if not found
   * 
   * @middleware authenticate - Verifies JWT token and attaches user to request
   * @middleware requireRole('ADMIN') - Ensures user has ADMIN role
   * @middleware roomIdValidation - Validates room ID parameter
   * @middleware validate - Processes validation results
   * @handler deleteRoom - Controller handler
   */
  router.delete(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    roomIdValidation,
    validate,
    deleteRoom
  );

  return router;
}

/**
 * Configured room management router instance
 * Ready to be mounted on the main Express application
 * 
 * @example
 * import { roomRouter } from './routes/room.routes.js';
 * app.use('/api/rooms', roomRouter);
 */
export const roomRouter: Router = createRoomRouter();