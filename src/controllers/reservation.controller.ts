/**
 * Reservation Controller - Request Handler Layer
 * 
 * Implements RESTful API endpoints for reservation management with:
 * - Request validation and sanitization
 * - Role-based access control enforcement
 * - Comprehensive error handling with proper HTTP status codes
 * - Structured logging for observability
 * - Input validation at API boundary
 * 
 * @module controllers/reservation.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { reservationService } from '../services/reservation.service.js';
import type {
  CreateReservationDto,
  ReservationFilterDto,
  ReservationStatus,
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
 * Creates a new reservation
 * 
 * POST /api/reservations
 * 
 * Business rules:
 * - User must be authenticated
 * - Room must be available for the date range
 * - Date range must be valid
 * - Check-in date must not be in the past
 * 
 * @param req - Express request with CreateReservationDto in body
 * @param res - Express response
 * @param next - Express next function
 * 
 * @returns 201 Created with reservation details
 * @returns 400 Bad Request if validation fails
 * @returns 401 Unauthorized if not authenticated
 * @returns 404 Not Found if room doesn't exist
 * @returns 409 Conflict if room not available
 * @returns 500 Internal Server Error on unexpected errors
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
      body: {
        roomId: req.body.roomId,
        checkInDate: req.body.checkInDate,
        checkOutDate: req.body.checkOutDate,
      },
      timestamp: new Date().toISOString(),
    });

    // Validate authentication
    if (!req.user) {
      console.warn('[ReservationController] Create reservation failed: Not authenticated', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to create reservations',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Extract and validate request body
    const { roomId, checkInDate, checkOutDate } = req.body;

    if (!roomId || !checkInDate || !checkOutDate) {
      console.warn('[ReservationController] Create reservation failed: Missing required fields', {
        ...requestInfo,
        missingFields: {
          roomId: !roomId,
          checkInDate: !checkInDate,
          checkOutDate: !checkOutDate,
        },
        timestamp: new Date().toISOString(),
      });

      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: roomId, checkInDate, checkOutDate',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const createDto: CreateReservationDto = {
      roomId,
      checkInDate,
      checkOutDate,
    };

    // Create reservation through service
    const reservation = await reservationService.createReservation(
      req.user.id,
      createDto
    );

    console.log('[ReservationController] Reservation created successfully', {
      ...requestInfo,
      reservationId: reservation.id,
      roomId: reservation.roomId,
      status: reservation.status,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      message: 'Reservation created successfully',
      data: reservation,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: string }).code;

    console.error('[ReservationController] Create reservation failed', {
      ...requestInfo,
      error: errorMessage,
      errorCode,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (errorCode === 'ROOM_NOT_FOUND') {
      res.status(404).json({
        error: 'Not Found',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    if (errorCode === 'ROOM_NOT_AVAILABLE') {
      res.status(409).json({
        error: 'Conflict',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    if (errorCode === 'INVALID_DATE_RANGE' || errorCode === 'CHECK_IN_DATE_IN_PAST') {
      res.status(400).json({
        error: 'Bad Request',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    next(error);
  }
}

/**
 * Retrieves reservations with role-based filtering
 * 
 * GET /api/reservations
 * 
 * Access control:
 * - Guests can only see their own reservations
 * - Admins can see all reservations
 * 
 * @param req - Express request with optional query parameters
 * @param res - Express response
 * @param next - Express next function
 * 
 * @returns 200 OK with paginated reservations
 * @returns 401 Unauthorized if not authenticated
 * @returns 500 Internal Server Error on unexpected errors
 */
export async function getReservations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    console.log('[ReservationController] Fetching reservations', {
      ...requestInfo,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    // Validate authentication
    if (!req.user) {
      console.warn('[ReservationController] Get reservations failed: Not authenticated', {
        ...requestInfo,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to view reservations',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Build filter from query parameters
    const filters: ReservationFilterDto = {
      status: req.query.status as ReservationStatus | undefined,
      userId: req.query.userId as string | undefined,
      roomId: req.query.roomId as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    // Add date range if provided
    if (req.query.dateFrom && req.query.dateTo) {
      filters.dateRange = {
        from: req.query.dateFrom as string,
        to: req.query.dateTo as string,
      };
    }

    const isAdmin = req.user.role === 'ADMIN';

    // Fetch reservations through service
    const result = await reservationService.getReservations(
      filters,
      req.user.id,
      isAdmin
    );

    console.log('[ReservationController] Reservations fetched successfully', {
      ...requestInfo,
      count: result.data.length,
      total: result.meta.total,
      page: result.meta.page,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[ReservationController] Get reservations failed', {
      ...requestInfo,
      error: errorMessage,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next(error);
  }
}

/**
 * Retrieves a single reservation by ID
 * 
 * GET /api/reservations/:id
 * 
 * Access control:
 * - Guests can only access their own reservations
 * - Admins can access any reservation
 * 
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 * 
 * @returns 200 OK with reservation details
 * @returns 401 Unauthorized if not authenticated
 * @returns 403 Forbidden if user lacks permission
 * @returns 404 Not Found if reservation doesn't exist
 * @returns 500 Internal Server Error on unexpected errors
 */
export async function getReservationById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    const { id } = req.params;

    console.log('[ReservationController] Fetching reservation by ID', {
      ...requestInfo,
      reservationId: id,
      timestamp: new Date().toISOString(),
    });

    // Validate authentication
    if (!req.user) {
      console.warn('[ReservationController] Get reservation failed: Not authenticated', {
        ...requestInfo,
        reservationId: id,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to view reservation',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const isAdmin = req.user.role === 'ADMIN';

    // Fetch reservation through service
    const reservation = await reservationService.getReservationById(
      id,
      req.user.id,
      isAdmin
    );

    console.log('[ReservationController] Reservation fetched successfully', {
      ...requestInfo,
      reservationId: id,
      status: reservation.status,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      data: reservation,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: string }).code;

    console.error('[ReservationController] Get reservation failed', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      errorCode,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (errorCode === 'RESERVATION_NOT_FOUND') {
      res.status(404).json({
        error: 'Not Found',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    if (errorCode === 'UNAUTHORIZED_ACCESS') {
      res.status(403).json({
        error: 'Forbidden',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    next(error);
  }
}

/**
 * Confirms a reservation (admin only)
 * 
 * PUT /api/reservations/:id/confirm
 * 
 * Business rules:
 * - Only ADMIN users can confirm reservations
 * - Only PENDING reservations can be confirmed
 * - Status transitions to CONFIRMED
 * 
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 * 
 * @returns 200 OK with updated reservation
 * @returns 400 Bad Request if status transition invalid
 * @returns 401 Unauthorized if not authenticated
 * @returns 403 Forbidden if not admin
 * @returns 404 Not Found if reservation doesn't exist
 * @returns 500 Internal Server Error on unexpected errors
 */
export async function confirmReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    const { id } = req.params;

    console.log('[ReservationController] Confirming reservation', {
      ...requestInfo,
      reservationId: id,
      timestamp: new Date().toISOString(),
    });

    // Validate authentication
    if (!req.user) {
      console.warn('[ReservationController] Confirm reservation failed: Not authenticated', {
        ...requestInfo,
        reservationId: id,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to confirm reservations',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Validate admin role
    if (req.user.role !== 'ADMIN') {
      console.warn('[ReservationController] Confirm reservation failed: Insufficient permissions', {
        ...requestInfo,
        reservationId: id,
        userRole: req.user.role,
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can confirm reservations',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    // Confirm reservation through service
    const reservation = await reservationService.confirmReservation(id);

    console.log('[ReservationController] Reservation confirmed successfully', {
      ...requestInfo,
      reservationId: id,
      newStatus: reservation.status,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Reservation confirmed successfully',
      data: reservation,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: string }).code;

    console.error('[ReservationController] Confirm reservation failed', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      errorCode,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (errorCode === 'RESERVATION_NOT_FOUND') {
      res.status(404).json({
        error: 'Not Found',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    if (errorCode === 'INVALID_STATUS_TRANSITION') {
      res.status(400).json({
        error: 'Bad Request',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    next(error);
  }
}

/**
 * Processes check-in for a reservation (admin only)
 * 
 * PUT /api/reservations/:id/check-in
 * 
 * Business rules:
 * - Only ADMIN users can process check-in
 * - Only CONFIRMED reservations can be checked in
 * - Status transitions to CHECKED_IN
 * - Room status updates to OCCUPIED
 * 
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 * 
 * @returns 200 OK with updated reservation
 * @returns 400 Bad Request if status transition invalid
 * @returns 401 Unauthorized if not authenticated
 * @returns 403 Forbidden if not admin
 * @returns 404 Not Found if reservation doesn't exist
 * @returns 500 Internal Server Error on unexpected errors
 */
export async function checkIn(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    const { id } = req.params;

    console.log('[ReservationController] Processing check-in', {
      ...requestInfo,
      reservationId: id,
      timestamp: new Date().toISOString(),
    });

    // Validate authentication
    if (!req.user) {
      console.warn('[ReservationController] Check-in failed: Not authenticated', {
        ...requestInfo,
        reservationId: id,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to process check-in',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Validate admin role
    if (req.user.role !== 'ADMIN') {
      console.warn('[ReservationController] Check-in failed: Insufficient permissions', {
        ...requestInfo,
        reservationId: id,
        userRole: req.user.role,
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can process check-in',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    // Process check-in through service
    const reservation = await reservationService.checkIn(id);

    console.log('[ReservationController] Check-in processed successfully', {
      ...requestInfo,
      reservationId: id,
      newStatus: reservation.status,
      roomId: reservation.roomId,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Check-in processed successfully',
      data: reservation,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: string }).code;

    console.error('[ReservationController] Check-in failed', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      errorCode,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (errorCode === 'RESERVATION_NOT_FOUND') {
      res.status(404).json({
        error: 'Not Found',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    if (errorCode === 'INVALID_STATUS_TRANSITION') {
      res.status(400).json({
        error: 'Bad Request',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    next(error);
  }
}

/**
 * Processes check-out for a reservation (admin only)
 * 
 * PUT /api/reservations/:id/check-out
 * 
 * Business rules:
 * - Only ADMIN users can process check-out
 * - Only CHECKED_IN reservations can be checked out
 * - Status transitions to CHECKED_OUT
 * - Room status updates to AVAILABLE
 * 
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 * 
 * @returns 200 OK with updated reservation
 * @returns 400 Bad Request if status transition invalid
 * @returns 401 Unauthorized if not authenticated
 * @returns 403 Forbidden if not admin
 * @returns 404 Not Found if reservation doesn't exist
 * @returns 500 Internal Server Error on unexpected errors
 */
export async function checkOut(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    const { id } = req.params;

    console.log('[ReservationController] Processing check-out', {
      ...requestInfo,
      reservationId: id,
      timestamp: new Date().toISOString(),
    });

    // Validate authentication
    if (!req.user) {
      console.warn('[ReservationController] Check-out failed: Not authenticated', {
        ...requestInfo,
        reservationId: id,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to process check-out',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Validate admin role
    if (req.user.role !== 'ADMIN') {
      console.warn('[ReservationController] Check-out failed: Insufficient permissions', {
        ...requestInfo,
        reservationId: id,
        userRole: req.user.role,
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can process check-out',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    // Process check-out through service
    const reservation = await reservationService.checkOut(id);

    console.log('[ReservationController] Check-out processed successfully', {
      ...requestInfo,
      reservationId: id,
      newStatus: reservation.status,
      roomId: reservation.roomId,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Check-out processed successfully',
      data: reservation,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: string }).code;

    console.error('[ReservationController] Check-out failed', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      errorCode,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (errorCode === 'RESERVATION_NOT_FOUND') {
      res.status(404).json({
        error: 'Not Found',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    if (errorCode === 'INVALID_STATUS_TRANSITION') {
      res.status(400).json({
        error: 'Bad Request',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    next(error);
  }
}

/**
 * Cancels a reservation
 * 
 * PUT /api/reservations/:id/cancel
 * 
 * Business rules:
 * - Guests can only cancel their own reservations
 * - Admins can cancel any reservation
 * - Cannot cancel CHECKED_OUT reservations
 * - Status transitions to CANCELLED
 * - If currently CHECKED_IN, room status updates to AVAILABLE
 * 
 * @param req - Express request with reservation ID in params
 * @param res - Express response
 * @param next - Express next function
 * 
 * @returns 200 OK with updated reservation
 * @returns 400 Bad Request if status transition invalid
 * @returns 401 Unauthorized if not authenticated
 * @returns 403 Forbidden if user lacks permission
 * @returns 404 Not Found if reservation doesn't exist
 * @returns 500 Internal Server Error on unexpected errors
 */
export async function cancelReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestInfo = sanitizeRequestForLogging(req);

  try {
    const { id } = req.params;

    console.log('[ReservationController] Cancelling reservation', {
      ...requestInfo,
      reservationId: id,
      timestamp: new Date().toISOString(),
    });

    // Validate authentication
    if (!req.user) {
      console.warn('[ReservationController] Cancel reservation failed: Not authenticated', {
        ...requestInfo,
        reservationId: id,
        timestamp: new Date().toISOString(),
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to cancel reservations',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Cancel reservation through service (ownership check done in service)
    const reservation = await reservationService.cancelReservation(
      id,
      req.user.id
    );

    console.log('[ReservationController] Reservation cancelled successfully', {
      ...requestInfo,
      reservationId: id,
      newStatus: reservation.status,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Reservation cancelled successfully',
      data: reservation,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: string }).code;

    console.error('[ReservationController] Cancel reservation failed', {
      ...requestInfo,
      reservationId: req.params.id,
      error: errorMessage,
      errorCode,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (errorCode === 'RESERVATION_NOT_FOUND') {
      res.status(404).json({
        error: 'Not Found',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    if (errorCode === 'UNAUTHORIZED_ACCESS') {
      res.status(403).json({
        error: 'Forbidden',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    if (errorCode === 'INVALID_STATUS_TRANSITION') {
      res.status(400).json({
        error: 'Bad Request',
        message: errorMessage,
        code: errorCode,
      });
      return;
    }

    next(error);
  }
}