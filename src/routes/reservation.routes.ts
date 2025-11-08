/**
 * Reservation Routes Configuration
 *
 * Defines Express router for reservation management endpoints with comprehensive
 * validation, authentication, and authorization middleware.
 *
 * Endpoints:
 * - POST /reservations - Create new reservation (authenticated)
 * - GET /reservations - List reservations with role-based filtering (authenticated)
 * - GET /reservations/:id - Get reservation details (authenticated)
 * - PUT /reservations/:id/confirm - Confirm reservation (admin only)
 * - PUT /reservations/:id/check-in - Process check-in (admin only)
 * - PUT /reservations/:id/check-out - Process check-out (admin only)
 * - PUT /reservations/:id/cancel - Cancel reservation (authenticated)
 *
 * @module routes/reservation.routes
 */

import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  createReservationValidation,
  reservationIdValidation,
  listReservationsValidation,
  confirmReservationValidation,
  checkInValidation,
  checkOutValidation,
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
 * @returns Configured Express router with all reservation endpoints
 *
 * @remarks
 * All endpoints require authentication via JWT token
 * Admin-only endpoints enforce ADMIN role requirement
 * All inputs validated before reaching controllers
 * Validation errors return 400 with detailed error messages
 */
function createReservationRouter(): ExpressRouter {
  const router = Router();

  console.log('[ReservationRoutes] Initializing reservation routes', {
    timestamp: new Date().toISOString(),
  });

  /**
   * POST /reservations
   * Create new reservation with availability validation
   *
   * @access Authenticated users (GUEST, ADMIN)
   * @body CreateReservationDto - roomId, checkInDate, checkOutDate
   * @returns 201 - Reservation created successfully
   * @returns 400 - Validation error
   * @returns 401 - Authentication required
   * @returns 404 - Room not found
   * @returns 409 - Room unavailable for selected dates
   */
  router.post(
    '/',
    authenticate,
    createReservationValidation,
    validate,
    createReservation
  );

  /**
   * GET /reservations
   * List reservations with role-based filtering
   *
   * @access Authenticated users (GUEST sees own, ADMIN sees all)
   * @query status - Filter by reservation status (optional)
   * @query roomId - Filter by room ID (optional)
   * @query userId - Filter by user ID (optional, admin only)
   * @query from - Filter by date range start (optional)
   * @query to - Filter by date range end (optional)
   * @returns 200 - Array of reservations
   * @returns 400 - Invalid query parameters
   * @returns 401 - Authentication required
   */
  router.get(
    '/',
    authenticate,
    listReservationsValidation,
    validate,
    getReservations
  );

  /**
   * GET /reservations/:id
   * Get reservation details by ID
   *
   * @access Authenticated users (GUEST sees own, ADMIN sees all)
   * @param id - Reservation UUID
   * @returns 200 - Reservation details
   * @returns 400 - Invalid reservation ID
   * @returns 401 - Authentication required
   * @returns 403 - Access denied (not owner)
   * @returns 404 - Reservation not found
   */
  router.get(
    '/:id',
    authenticate,
    reservationIdValidation,
    validate,
    getReservationById
  );

  /**
   * PUT /reservations/:id/confirm
   * Confirm pending reservation
   *
   * @access Admin only
   * @param id - Reservation UUID
   * @returns 200 - Reservation confirmed
   * @returns 400 - Invalid status transition
   * @returns 401 - Authentication required
   * @returns 403 - Admin access required
   * @returns 404 - Reservation not found
   */
  router.put(
    '/:id/confirm',
    authenticate,
    requireRole('ADMIN'),
    confirmReservationValidation,
    validate,
    confirmReservation
  );

  /**
   * PUT /reservations/:id/check-in
   * Process guest check-in
   *
   * @access Admin only
   * @param id - Reservation UUID
   * @returns 200 - Check-in processed
   * @returns 400 - Invalid status transition
   * @returns 401 - Authentication required
   * @returns 403 - Admin access required
   * @returns 404 - Reservation not found
   */
  router.put(
    '/:id/check-in',
    authenticate,
    requireRole('ADMIN'),
    checkInValidation,
    validate,
    checkIn
  );

  /**
   * PUT /reservations/:id/check-out
   * Process guest check-out
   *
   * @access Admin only
   * @param id - Reservation UUID
   * @returns 200 - Check-out processed
   * @returns 400 - Invalid status transition
   * @returns 401 - Authentication required
   * @returns 403 - Admin access required
   * @returns 404 - Reservation not found
   */
  router.put(
    '/:id/check-out',
    authenticate,
    requireRole('ADMIN'),
    checkOutValidation,
    validate,
    checkOut
  );

  /**
   * PUT /reservations/:id/cancel
   * Cancel reservation
   *
   * @access Authenticated users (GUEST cancels own, ADMIN cancels any)
   * @param id - Reservation UUID
   * @returns 200 - Reservation cancelled
   * @returns 400 - Invalid status transition
   * @returns 401 - Authentication required
   * @returns 403 - Access denied (not owner)
   * @returns 404 - Reservation not found
   */
  router.put(
    '/:id/cancel',
    authenticate,
    cancelReservationValidation,
    validate,
    cancelReservation
  );

  console.log('[ReservationRoutes] Reservation routes initialized successfully', {
    endpoints: [
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
 * Mount at /api/reservations in main application
 *
 * @example
 * ```typescript
 * import { reservationRouter } from './routes/reservation.routes.js';
 * app.use('/api/reservations', reservationRouter);
 * ```
 */
export const reservationRouter: ExpressRouter = createReservationRouter();