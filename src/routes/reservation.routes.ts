/**
 * Reservation Routes Configuration
 * 
 * Implements RESTful API endpoints for reservation management with:
 * - Role-based access control (RBAC)
 * - Request validation at API boundary
 * - Comprehensive error handling
 * - Structured logging for observability
 * 
 * Endpoints:
 * - POST /reservations - Create new reservation (authenticated)
 * - GET /reservations - List reservations with role-based filtering
 * - GET /reservations/:id - Get reservation details
 * - PUT /reservations/:id/confirm - Confirm reservation (admin only)
 * - PUT /reservations/:id/check-in - Process check-in (admin only)
 * - PUT /reservations/:id/check-out - Process check-out (admin only)
 * - PUT /reservations/:id/cancel - Cancel reservation (authenticated)
 * 
 * @module routes/reservation.routes
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  createReservationValidation,
  reservationIdValidation,
  listReservationsValidation,
  confirmReservationValidation,
  checkInReservationValidation,
  checkOutReservationValidation,
  cancelReservationValidation,
} from '../validators/reservation.validator.js';
import {
  createReservation,
  getReservations,
  getReservationById,
  confirmReservation,
  checkIn,
  checkOut,
  cancelReservation,
} from '../controllers/reservation.controller.js';

/**
 * Creates and configures the reservation router
 * 
 * Route Configuration:
 * - All routes require authentication
 * - Admin-only routes use requireRole('ADMIN') middleware
 * - Validation middleware processes express-validator rules
 * - Controllers handle business logic and responses
 * 
 * @returns Configured Express router for reservation endpoints
 */
function createReservationRouter(): Router {
  const router = Router();

  console.log('[ReservationRoutes] Initializing reservation routes', {
    timestamp: new Date().toISOString(),
  });

  // =============================================================================
  // POST /reservations - Create new reservation
  // =============================================================================
  /**
   * Create new reservation with availability check
   * 
   * Access: Authenticated users (GUEST, ADMIN)
   * Validation: roomId, checkInDate, checkOutDate
   * 
   * Business Rules:
   * - Room must exist and be available
   * - Check-in date cannot be in the past
   * - Check-out date must be after check-in date
   * - Stay duration: 1-30 days
   * - Maximum advance booking: 365 days
   * 
   * @route POST /api/reservations
   * @access Authenticated
   * @returns 201 Created with reservation details
   */
  router.post(
    '/',
    authenticate,
    createReservationValidation,
    validate,
    createReservation
  );

  // =============================================================================
  // GET /reservations - List reservations with filtering
  // =============================================================================
  /**
   * Retrieve reservations with role-based filtering
   * 
   * Access: Authenticated users (GUEST, ADMIN)
   * Filtering: status, userId, roomId, dateRange, pagination
   * 
   * Authorization:
   * - GUEST users see only their own reservations
   * - ADMIN users can see all reservations and filter by userId
   * 
   * Query Parameters:
   * - status: Filter by reservation status
   * - userId: Filter by user (admin only)
   * - roomId: Filter by room
   * - dateFrom: Start date for date range filter
   * - dateTo: End date for date range filter
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10, max: 100)
   * 
   * @route GET /api/reservations
   * @access Authenticated
   * @returns 200 OK with paginated reservations
   */
  router.get(
    '/',
    authenticate,
    listReservationsValidation,
    validate,
    getReservations
  );

  // =============================================================================
  // GET /reservations/:id - Get reservation by ID
  // =============================================================================
  /**
   * Retrieve specific reservation details
   * 
   * Access: Authenticated users (GUEST, ADMIN)
   * Validation: id (UUID v4)
   * 
   * Authorization:
   * - GUEST users can only access their own reservations
   * - ADMIN users can access any reservation
   * 
   * @route GET /api/reservations/:id
   * @access Authenticated
   * @returns 200 OK with reservation details
   */
  router.get(
    '/:id',
    authenticate,
    reservationIdValidation,
    validate,
    getReservationById
  );

  // =============================================================================
  // PUT /reservations/:id/confirm - Confirm reservation
  // =============================================================================
  /**
   * Confirm a pending reservation
   * 
   * Access: ADMIN only
   * Validation: id (UUID v4)
   * 
   * Business Rules:
   * - Only PENDING reservations can be confirmed
   * - Status transitions to CONFIRMED
   * - Room remains AVAILABLE until check-in
   * 
   * Status Transition: PENDING → CONFIRMED
   * 
   * @route PUT /api/reservations/:id/confirm
   * @access Admin
   * @returns 200 OK with updated reservation
   */
  router.put(
    '/:id/confirm',
    authenticate,
    requireRole('ADMIN'),
    confirmReservationValidation,
    validate,
    confirmReservation
  );

  // =============================================================================
  // PUT /reservations/:id/check-in - Process check-in
  // =============================================================================
  /**
   * Process guest check-in
   * 
   * Access: ADMIN only
   * Validation: id (UUID v4)
   * 
   * Business Rules:
   * - Only CONFIRMED reservations can be checked in
   * - Status transitions to CHECKED_IN
   * - Room status updates to OCCUPIED
   * - Check-in timestamp recorded
   * 
   * Status Transition: CONFIRMED → CHECKED_IN
   * Room Status: AVAILABLE → OCCUPIED
   * 
   * @route PUT /api/reservations/:id/check-in
   * @access Admin
   * @returns 200 OK with updated reservation
   */
  router.put(
    '/:id/check-in',
    authenticate,
    requireRole('ADMIN'),
    checkInReservationValidation,
    validate,
    checkIn
  );

  // =============================================================================
  // PUT /reservations/:id/check-out - Process check-out
  // =============================================================================
  /**
   * Process guest check-out
   * 
   * Access: ADMIN only
   * Validation: id (UUID v4)
   * 
   * Business Rules:
   * - Only CHECKED_IN reservations can be checked out
   * - Status transitions to CHECKED_OUT
   * - Room status updates to AVAILABLE
   * - Check-out timestamp recorded
   * 
   * Status Transition: CHECKED_IN → CHECKED_OUT
   * Room Status: OCCUPIED → AVAILABLE
   * 
   * @route PUT /api/reservations/:id/check-out
   * @access Admin
   * @returns 200 OK with updated reservation
   */
  router.put(
    '/:id/check-out',
    authenticate,
    requireRole('ADMIN'),
    checkOutReservationValidation,
    validate,
    checkOut
  );

  // =============================================================================
  // PUT /reservations/:id/cancel - Cancel reservation
  // =============================================================================
  /**
   * Cancel a reservation
   * 
   * Access: Authenticated users (GUEST, ADMIN)
   * Validation: id (UUID v4)
   * 
   * Authorization:
   * - GUEST users can only cancel their own reservations
   * - ADMIN users can cancel any reservation
   * 
   * Business Rules:
   * - Cannot cancel CHECKED_OUT reservations
   * - Status transitions to CANCELLED
   * - If currently CHECKED_IN, room status updates to AVAILABLE
   * 
   * Valid Transitions:
   * - PENDING → CANCELLED
   * - CONFIRMED → CANCELLED
   * - CHECKED_IN → CANCELLED (room becomes AVAILABLE)
   * 
   * @route PUT /api/reservations/:id/cancel
   * @access Authenticated
   * @returns 200 OK with updated reservation
   */
  router.put(
    '/:id/cancel',
    authenticate,
    cancelReservationValidation,
    validate,
    cancelReservation
  );

  console.log('[ReservationRoutes] Reservation routes initialized successfully', {
    routes: [
      'POST /',
      'GET /',
      'GET /:id',
      'PUT /:id/confirm',
      'PUT /:id/check-in',
      'PUT /:id/check-out',
      'PUT /:id/cancel',
    ],
    timestamp: new Date().toISOString(),
  });

  return router;
}

/**
 * Configured reservation router instance
 * Export for use in main application
 */
export const reservationRouter: Router = createReservationRouter();