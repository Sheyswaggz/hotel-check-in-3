/**
 * Reservation Controller - Request Handler Layer
 *
 * Implements HTTP request handlers for reservation management endpoints:
 * - POST /api/reservations - Create new reservation
 * - GET /api/reservations - List reservations with role-based filtering
 * - GET /api/reservations/:id - Get reservation details
 * - PUT /api/reservations/:id/confirm - Confirm reservation (admin only)
 * - PUT /api/reservations/:id/check-in - Process check-in (admin only)
 * - PUT /api/reservations/:id/check-out - Process check-out (admin only)
 * - PUT /api/reservations/:id/cancel - Cancel reservation
 *
 * @module controllers/reservation.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { reservationService, ReservationError } from '../services/reservation.service.js';
import type {
  CreateReservationDto,
  ReservationFilterDto,
  ReservationStatus,
} from '../types/reservation.types.js';
import {
  isCreateReservationDto,
  isReservationFilterDto,
} from '../types/reservation.types.js';

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
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    userRole: req.user?.role,
  };
}

/**
 * Creates a new reservation with availability validation
 *
 * @param req - Express request with CreateReservationDto in body
 * @param res - Express response
 * @param next - Express next function
 *
 * @remarks
 * - Validates request body structure
 * - Extracts userId from authenticated user
 * - Validates room availability
 * - Creates reservation in PENDING status
 * - Returns 201 with created reservation
 * - Returns 400 for validation errors
 * - Returns 404 if room not found
 * - Returns 409 if room unavailable
 *
 * @example
 * POST /api/reservations
 * Body: {
 *   "roomId": "room-uuid",
 *   "checkInDate": "2024-01-15",
 *   "checkOutDate": "2024-01-20"
 * }
 */
export async function createReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[ReservationController] Creating reservation', {
      ...requestInfo,
      timestamp: new Date().toISOString(),
    });

    // Validate authenticated user
    if (!req.user) {
      console.warn('[ReservationController] Unauthenticated request', {
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

    // Validate request body
    if (!isCreateReservationDto(req.body)) {
      console.warn('[ReservationController] Invalid request body', {
        ...requestInfo,
        body: req.body,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid reservation data. Required fields: roomId, checkInDate, checkOutDate',
        code: 'INVALID_REQUEST_BODY',
      });
      return;
    }

    const dto: CreateReservationDto = req.body;

    // Create reservation
    const reservation = await reservationService.createReservation(req.user.id, dto);

    console.log('[ReservationController] Reservation created successfully', {
      ...requestInfo,
      reservationId: reservation.id,
      roomId: dto.roomId,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      message: 'Reservation created successfully',
      data: reservation,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      console.warn('[ReservationController] Reservation creation failed', {
        ...requestInfo,
        error: error.message,
        code: error.code,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
        code: error.code,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReservationController] Unexpected error creating reservation', {
      ...requestInfo,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next(error);
  }
}

/**
 * Retrieves reservations with role-based filtering
 *
 * @param req - Express request with optional query parameters
 * @param res - Express response
 * @param next - Express next function
 *
 * @remarks
 * - Admins can view all reservations
 * - Guests can only view their own reservations
 * - Supports filtering by status, room, user, and date range
 * - Returns 200 with array of reservations
 *
 * @example
 * GET /api/reservations?status=CONFIRMED&roomId=room-uuid
 */
export async function getReservations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[ReservationController] Retrieving reservations', {
      ...requestInfo,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    // Validate authenticated user
    if (!req.user) {
      console.warn('[ReservationController] Unauthenticated request', {
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

    // Parse and validate filters
    const filters: ReservationFilterDto = {};

    if (req.query.status && typeof req.query.status === 'string') {
      filters.status = req.query.status as ReservationStatus;
    }

    if (req.query.roomId && typeof req.query.roomId === 'string') {
      filters.roomId = req.query.roomId;
    }

    if (req.query.userId && typeof req.query.userId === 'string') {
      filters.userId = req.query.userId;
    }

    if (req.query.from && req.query.to) {
      filters.dateRange = {
        from: req.query.from as string,
        to: req.query.to as string,
      };
    }

    if (!isReservationFilterDto(filters)) {
      console.warn('[ReservationController] Invalid filter parameters', {
        ...requestInfo,
        filters,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid filter parameters',
        code: 'INVALID_FILTERS',
      });
      return;
    }

    const isAdmin = req.user.role === 'ADMIN';

    // Retrieve reservations
    const reservations = await reservationService.getReservations(
      filters,
      req.user.id,
      isAdmin
    );

    console.log('[ReservationController] Reservations retrieved successfully', {
      ...requestInfo,
      count: reservations.length,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Reservations retrieved successfully',
      data: reservations,
      count: reservations.length,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      console.warn('[ReservationController] Reservation retrieval failed', {
        ...requestInfo,
        error: error.message,
        code: error.code,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
        code: error.code,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReservationController] Unexpected error retrieving reservations', {
      ...requestInfo,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next(error);
  }
}

/**
 * Retrieves a single reservation by ID with ownership validation
 *
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 *
 * @remarks
 * - Admins can view any reservation
 * - Guests can only view their own reservations
 * - Returns 200 with reservation details
 * - Returns 403 if access denied
 * - Returns 404 if reservation not found
 *
 * @example
 * GET /api/reservations/:id
 */
export async function getReservationById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[ReservationController] Retrieving reservation by ID', {
      ...requestInfo,
      reservationId: req.params.id,
      timestamp: new Date().toISOString(),
    });

    // Validate authenticated user
    if (!req.user) {
      console.warn('[ReservationController] Unauthenticated request', {
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

    // Validate reservation ID
    if (!req.params.id || typeof req.params.id !== 'string') {
      console.warn('[ReservationController] Invalid reservation ID', {
        ...requestInfo,
        reservationId: req.params.id,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid reservation ID',
        code: 'INVALID_RESERVATION_ID',
      });
      return;
    }

    const isAdmin = req.user.role === 'ADMIN';

    // Retrieve reservation
    const reservation = await reservationService.getReservationById(
      req.params.id,
      req.user.id,
      isAdmin
    );

    console.log('[ReservationController] Reservation retrieved successfully', {
      ...requestInfo,
      reservationId: req.params.id,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Reservation retrieved successfully',
      data: reservation,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      console.warn('[ReservationController] Reservation retrieval failed', {
        ...requestInfo,
        reservationId: req.params.id,
        error: error.message,
        code: error.code,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
        code: error.code,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReservationController] Unexpected error retrieving reservation', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next(error);
  }
}

/**
 * Confirms a reservation (admin only)
 *
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 *
 * @remarks
 * - Admin only endpoint
 * - Transitions reservation from PENDING to CONFIRMED
 * - Returns 200 with updated reservation
 * - Returns 400 if invalid status transition
 * - Returns 404 if reservation not found
 *
 * @example
 * PUT /api/reservations/:id/confirm
 */
export async function confirmReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[ReservationController] Confirming reservation', {
      ...requestInfo,
      reservationId: req.params.id,
      timestamp: new Date().toISOString(),
    });

    // Validate authenticated user
    if (!req.user) {
      console.warn('[ReservationController] Unauthenticated request', {
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

    // Validate reservation ID
    if (!req.params.id || typeof req.params.id !== 'string') {
      console.warn('[ReservationController] Invalid reservation ID', {
        ...requestInfo,
        reservationId: req.params.id,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid reservation ID',
        code: 'INVALID_RESERVATION_ID',
      });
      return;
    }

    // Confirm reservation
    const reservation = await reservationService.confirmReservation(req.params.id);

    console.log('[ReservationController] Reservation confirmed successfully', {
      ...requestInfo,
      reservationId: req.params.id,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Reservation confirmed successfully',
      data: reservation,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      console.warn('[ReservationController] Reservation confirmation failed', {
        ...requestInfo,
        reservationId: req.params.id,
        error: error.message,
        code: error.code,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
        code: error.code,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReservationController] Unexpected error confirming reservation', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next(error);
  }
}

/**
 * Processes check-in for a reservation (admin only)
 *
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 *
 * @remarks
 * - Admin only endpoint
 * - Transitions reservation from CONFIRMED to CHECKED_IN
 * - Updates room status to OCCUPIED
 * - Returns 200 with updated reservation
 * - Returns 400 if invalid status transition
 * - Returns 404 if reservation not found
 *
 * @example
 * PUT /api/reservations/:id/check-in
 */
export async function checkIn(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[ReservationController] Processing check-in', {
      ...requestInfo,
      reservationId: req.params.id,
      timestamp: new Date().toISOString(),
    });

    // Validate authenticated user
    if (!req.user) {
      console.warn('[ReservationController] Unauthenticated request', {
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

    // Validate reservation ID
    if (!req.params.id || typeof req.params.id !== 'string') {
      console.warn('[ReservationController] Invalid reservation ID', {
        ...requestInfo,
        reservationId: req.params.id,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid reservation ID',
        code: 'INVALID_RESERVATION_ID',
      });
      return;
    }

    // Process check-in
    const reservation = await reservationService.checkIn(req.params.id);

    console.log('[ReservationController] Check-in processed successfully', {
      ...requestInfo,
      reservationId: req.params.id,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Check-in processed successfully',
      data: reservation,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      console.warn('[ReservationController] Check-in failed', {
        ...requestInfo,
        reservationId: req.params.id,
        error: error.message,
        code: error.code,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
        code: error.code,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReservationController] Unexpected error processing check-in', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next(error);
  }
}

/**
 * Processes check-out for a reservation (admin only)
 *
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 *
 * @remarks
 * - Admin only endpoint
 * - Transitions reservation from CHECKED_IN to CHECKED_OUT
 * - Updates room status to AVAILABLE
 * - Returns 200 with updated reservation
 * - Returns 400 if invalid status transition
 * - Returns 404 if reservation not found
 *
 * @example
 * PUT /api/reservations/:id/check-out
 */
export async function checkOut(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[ReservationController] Processing check-out', {
      ...requestInfo,
      reservationId: req.params.id,
      timestamp: new Date().toISOString(),
    });

    // Validate authenticated user
    if (!req.user) {
      console.warn('[ReservationController] Unauthenticated request', {
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

    // Validate reservation ID
    if (!req.params.id || typeof req.params.id !== 'string') {
      console.warn('[ReservationController] Invalid reservation ID', {
        ...requestInfo,
        reservationId: req.params.id,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid reservation ID',
        code: 'INVALID_RESERVATION_ID',
      });
      return;
    }

    // Process check-out
    const reservation = await reservationService.checkOut(req.params.id);

    console.log('[ReservationController] Check-out processed successfully', {
      ...requestInfo,
      reservationId: req.params.id,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Check-out processed successfully',
      data: reservation,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      console.warn('[ReservationController] Check-out failed', {
        ...requestInfo,
        reservationId: req.params.id,
        error: error.message,
        code: error.code,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
        code: error.code,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReservationController] Unexpected error processing check-out', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next(error);
  }
}

/**
 * Cancels a reservation with ownership validation
 *
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 *
 * @remarks
 * - Guests can cancel their own reservations
 * - Admins can cancel any reservation
 * - Validates ownership for non-admin users
 * - Returns 200 with updated reservation
 * - Returns 400 if invalid status transition
 * - Returns 403 if access denied
 * - Returns 404 if reservation not found
 *
 * @example
 * PUT /api/reservations/:id/cancel
 */
export async function cancelReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[ReservationController] Cancelling reservation', {
      ...requestInfo,
      reservationId: req.params.id,
      timestamp: new Date().toISOString(),
    });

    // Validate authenticated user
    if (!req.user) {
      console.warn('[ReservationController] Unauthenticated request', {
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

    // Validate reservation ID
    if (!req.params.id || typeof req.params.id !== 'string') {
      console.warn('[ReservationController] Invalid reservation ID', {
        ...requestInfo,
        reservationId: req.params.id,
        timestamp: new Date().toISOString(),
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid reservation ID',
        code: 'INVALID_RESERVATION_ID',
      });
      return;
    }

    const isAdmin = req.user.role === 'ADMIN';

    // Cancel reservation
    const reservation = await reservationService.cancelReservation(
      req.params.id,
      req.user.id,
      isAdmin
    );

    console.log('[ReservationController] Reservation cancelled successfully', {
      ...requestInfo,
      reservationId: req.params.id,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Reservation cancelled successfully',
      data: reservation,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      console.warn('[ReservationController] Reservation cancellation failed', {
        ...requestInfo,
        reservationId: req.params.id,
        error: error.message,
        code: error.code,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
        code: error.code,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReservationController] Unexpected error cancelling reservation', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next(error);
  }
}