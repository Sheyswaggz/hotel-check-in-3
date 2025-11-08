/**
 * Reservation Service - Business Logic Layer
 *
 * Implements comprehensive reservation management including:
 * - Room availability checking with date overlap detection
 * - Reservation creation with atomic transactions
 * - Role-based reservation filtering and access control
 * - Status transition validation and enforcement
 * - Check-in/check-out workflows with room status updates
 * - Cancellation with ownership validation
 *
 * @module services/reservation.service
 */

import { prisma } from '../config/database.js';
import type {
  CreateReservationDto,
  ReservationFilterDto,
  ReservationWithDetails,
  ReservationStatus,
} from '../types/reservation.types.js';
import { isDateRangeValid, hasDateOverlap } from '../utils/date.util.js';
import type { Reservation, RoomStatus } from '@prisma/client';

/**
 * Custom error for reservation-specific failures
 */
export class ReservationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ReservationError';
    Error.captureStackTrace(this, ReservationError);
  }
}

/**
 * Valid reservation status transitions
 * Enforces state machine rules for reservation lifecycle
 */
const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
};

/**
 * Reservation Service Class
 *
 * Provides business logic for reservation management with:
 * - Comprehensive error handling and validation
 * - Database transaction support for atomic operations
 * - Role-based access control enforcement
 * - Structured logging with operation context
 */
export class ReservationService {
  /**
   * Checks if a room is available for the specified date range
   *
   * @param roomId - UUID of the room to check
   * @param checkInDate - Check-in date
   * @param checkOutDate - Check-out date
   * @param excludeReservationId - Optional reservation ID to exclude from check (for updates)
   * @returns Promise resolving to true if room is available, false otherwise
   *
   * @remarks
   * - Validates date range before checking availability
   * - Checks for overlapping reservations in non-cancelled statuses
   * - Excludes specified reservation ID for update scenarios
   * - Logs availability check results for debugging
   *
   * @example
   * ```typescript
   * const isAvailable = await service.checkRoomAvailability(
   *   'room-uuid',
   *   new Date('2024-01-15'),
   *   new Date('2024-01-20')
   * );
   * ```
   */
  async checkRoomAvailability(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date,
    excludeReservationId?: string
  ): Promise<boolean> {
    try {
      // Validate date range
      if (!isDateRangeValid(checkInDate, checkOutDate)) {
        console.warn('Invalid date range for availability check', {
          roomId,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        });
        return false;
      }

      // Query overlapping reservations
      const overlappingReservations = await prisma.reservation.findMany({
        where: {
          roomId,
          id: excludeReservationId ? { not: excludeReservationId } : undefined,
          status: {
            notIn: ['CANCELLED', 'CHECKED_OUT'],
          },
          OR: [
            {
              AND: [
                { checkInDate: { lte: checkInDate } },
                { checkOutDate: { gt: checkInDate } },
              ],
            },
            {
              AND: [
                { checkInDate: { lt: checkOutDate } },
                { checkOutDate: { gte: checkOutDate } },
              ],
            },
            {
              AND: [
                { checkInDate: { gte: checkInDate } },
                { checkOutDate: { lte: checkOutDate } },
              ],
            },
          ],
        },
      });

      const isAvailable = overlappingReservations.length === 0;

      console.log('Room availability check completed', {
        roomId,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        isAvailable,
        overlappingCount: overlappingReservations.length,
      });

      return isAvailable;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to check room availability', {
        error: errorMessage,
        roomId,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
      });
      throw new ReservationError(
        'Failed to check room availability',
        'AVAILABILITY_CHECK_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Creates a new reservation with availability validation
   *
   * @param userId - UUID of the user making the reservation
   * @param data - Reservation creation data
   * @returns Promise resolving to created reservation with full details
   *
   * @throws {ReservationError} If validation fails or room is unavailable
   *
   * @remarks
   * - Validates date range format and logic
   * - Verifies room exists and is available
   * - Checks room availability for date range
   * - Creates reservation in atomic transaction
   * - Logs reservation creation for audit trail
   *
   * @example
   * ```typescript
   * const reservation = await service.createReservation('user-uuid', {
   *   roomId: 'room-uuid',
   *   checkInDate: '2024-01-15',
   *   checkOutDate: '2024-01-20'
   * });
   * ```
   */
  async createReservation(
    userId: string,
    data: CreateReservationDto
  ): Promise<ReservationWithDetails> {
    try {
      // Parse and validate dates
      const checkInDate = new Date(data.checkInDate);
      const checkOutDate = new Date(data.checkOutDate);

      if (!isDateRangeValid(checkInDate, checkOutDate)) {
        throw new ReservationError(
          'Invalid date range: check-in date must be before check-out date',
          'INVALID_DATE_RANGE',
          400
        );
      }

      // Verify room exists
      const room = await prisma.room.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        throw new ReservationError('Room not found', 'ROOM_NOT_FOUND', 404);
      }

      // Check room availability
      const isAvailable = await this.checkRoomAvailability(
        data.roomId,
        checkInDate,
        checkOutDate
      );

      if (!isAvailable) {
        throw new ReservationError(
          'Room is not available for the specified dates',
          'ROOM_UNAVAILABLE',
          409
        );
      }

      // Create reservation in transaction
      const reservation = await prisma.reservation.create({
        data: {
          userId,
          roomId: data.roomId,
          checkInDate,
          checkOutDate,
          status: 'PENDING',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          room: true,
        },
      });

      console.log('Reservation created successfully', {
        reservationId: reservation.id,
        userId,
        roomId: data.roomId,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        status: reservation.status,
      });

      return reservation;
    } catch (error) {
      if (error instanceof ReservationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create reservation', {
        error: errorMessage,
        userId,
        data,
      });

      throw new ReservationError(
        'Failed to create reservation',
        'RESERVATION_CREATION_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Retrieves reservations with role-based filtering
   *
   * @param filters - Optional filters for reservation query
   * @param userId - UUID of the requesting user
   * @param isAdmin - Whether the requesting user is an admin
   * @returns Promise resolving to array of reservations with details
   *
   * @remarks
   * - Admins can view all reservations
   * - Guests can only view their own reservations
   * - Supports filtering by status, room, and date range
   * - Returns reservations with full user and room details
   * - Logs query execution for monitoring
   *
   * @example
   * ```typescript
   * // Admin viewing all confirmed reservations
   * const reservations = await service.getReservations(
   *   { status: 'CONFIRMED' },
   *   'admin-uuid',
   *   true
   * );
   *
   * // Guest viewing their own reservations
   * const myReservations = await service.getReservations(
   *   {},
   *   'guest-uuid',
   *   false
   * );
   * ```
   */
  async getReservations(
    filters: ReservationFilterDto = {},
    userId: string,
    isAdmin: boolean
  ): Promise<ReservationWithDetails[]> {
    try {
      // Build where clause with role-based filtering
      const where: Record<string, unknown> = {};

      // Guests can only see their own reservations
      if (!isAdmin) {
        where.userId = userId;
      } else if (filters.userId) {
        // Admins can filter by specific user
        where.userId = filters.userId;
      }

      // Apply optional filters
      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.roomId) {
        where.roomId = filters.roomId;
      }

      if (filters.dateRange) {
        const fromDate = new Date(filters.dateRange.from);
        const toDate = new Date(filters.dateRange.to);

        where.OR = [
          {
            AND: [{ checkInDate: { lte: toDate } }, { checkOutDate: { gte: fromDate } }],
          },
        ];
      }

      // Execute query with relations
      const reservations = await prisma.reservation.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          room: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log('Reservations retrieved successfully', {
        count: reservations.length,
        userId,
        isAdmin,
        filters,
      });

      return reservations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to retrieve reservations', {
        error: errorMessage,
        userId,
        isAdmin,
        filters,
      });

      throw new ReservationError(
        'Failed to retrieve reservations',
        'RESERVATION_RETRIEVAL_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Retrieves a single reservation by ID with ownership validation
   *
   * @param id - UUID of the reservation
   * @param userId - UUID of the requesting user
   * @param isAdmin - Whether the requesting user is an admin
   * @returns Promise resolving to reservation with full details
   *
   * @throws {ReservationError} If reservation not found or access denied
   *
   * @remarks
   * - Admins can view any reservation
   * - Guests can only view their own reservations
   * - Returns full reservation details with user and room relations
   * - Logs access attempts for security monitoring
   *
   * @example
   * ```typescript
   * const reservation = await service.getReservationById(
   *   'reservation-uuid',
   *   'user-uuid',
   *   false
   * );
   * ```
   */
  async getReservationById(
    id: string,
    userId: string,
    isAdmin: boolean
  ): Promise<ReservationWithDetails> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          room: true,
        },
      });

      if (!reservation) {
        throw new ReservationError('Reservation not found', 'RESERVATION_NOT_FOUND', 404);
      }

      // Validate ownership for non-admin users
      if (!isAdmin && reservation.userId !== userId) {
        console.warn('Unauthorized reservation access attempt', {
          reservationId: id,
          requestingUserId: userId,
          reservationUserId: reservation.userId,
        });
        throw new ReservationError(
          'Access denied: You can only view your own reservations',
          'ACCESS_DENIED',
          403
        );
      }

      console.log('Reservation retrieved successfully', {
        reservationId: id,
        userId,
        isAdmin,
      });

      return reservation;
    } catch (error) {
      if (error instanceof ReservationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to retrieve reservation', {
        error: errorMessage,
        reservationId: id,
        userId,
      });

      throw new ReservationError(
        'Failed to retrieve reservation',
        'RESERVATION_RETRIEVAL_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Validates if a status transition is allowed
   *
   * @param currentStatus - Current reservation status
   * @param newStatus - Desired new status
   * @returns True if transition is valid, false otherwise
   *
   * @remarks
   * Enforces state machine rules:
   * - PENDING -> CONFIRMED, CANCELLED
   * - CONFIRMED -> CHECKED_IN, CANCELLED
   * - CHECKED_IN -> CHECKED_OUT
   * - CHECKED_OUT -> (terminal state)
   * - CANCELLED -> (terminal state)
   */
  private isValidStatusTransition(
    currentStatus: ReservationStatus,
    newStatus: ReservationStatus
  ): boolean {
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Confirms a reservation (admin only)
   *
   * @param id - UUID of the reservation to confirm
   * @returns Promise resolving to updated reservation
   *
   * @throws {ReservationError} If reservation not found or invalid status transition
   *
   * @remarks
   * - Validates status transition from PENDING to CONFIRMED
   * - Updates reservation status atomically
   * - Logs confirmation for audit trail
   *
   * @example
   * ```typescript
   * const confirmed = await service.confirmReservation('reservation-uuid');
   * ```
   */
  async confirmReservation(id: string): Promise<Reservation> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        throw new ReservationError('Reservation not found', 'RESERVATION_NOT_FOUND', 404);
      }

      if (!this.isValidStatusTransition(reservation.status, 'CONFIRMED')) {
        throw new ReservationError(
          `Cannot confirm reservation in ${reservation.status} status`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' },
      });

      console.log('Reservation confirmed successfully', {
        reservationId: id,
        previousStatus: reservation.status,
        newStatus: updated.status,
      });

      return updated;
    } catch (error) {
      if (error instanceof ReservationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to confirm reservation', {
        error: errorMessage,
        reservationId: id,
      });

      throw new ReservationError(
        'Failed to confirm reservation',
        'RESERVATION_CONFIRMATION_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Processes check-in for a reservation (admin only)
   *
   * @param id - UUID of the reservation to check in
   * @returns Promise resolving to updated reservation
   *
   * @throws {ReservationError} If reservation not found or invalid status transition
   *
   * @remarks
   * - Validates status transition from CONFIRMED to CHECKED_IN
   * - Updates reservation status and room status atomically
   * - Sets room status to OCCUPIED
   * - Uses transaction for atomic updates
   * - Logs check-in for audit trail
   *
   * @example
   * ```typescript
   * const checkedIn = await service.checkIn('reservation-uuid');
   * ```
   */
  async checkIn(id: string): Promise<Reservation> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        throw new ReservationError('Reservation not found', 'RESERVATION_NOT_FOUND', 404);
      }

      if (!this.isValidStatusTransition(reservation.status, 'CHECKED_IN')) {
        throw new ReservationError(
          `Cannot check in reservation in ${reservation.status} status`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      // Update reservation and room status in transaction
      const updated = await prisma.$transaction(async (tx) => {
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: 'CHECKED_IN' },
        });

        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'OCCUPIED' as RoomStatus },
        });

        return updatedReservation;
      });

      console.log('Check-in processed successfully', {
        reservationId: id,
        roomId: reservation.roomId,
        previousStatus: reservation.status,
        newStatus: updated.status,
      });

      return updated;
    } catch (error) {
      if (error instanceof ReservationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to process check-in', {
        error: errorMessage,
        reservationId: id,
      });

      throw new ReservationError(
        'Failed to process check-in',
        'CHECK_IN_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Processes check-out for a reservation (admin only)
   *
   * @param id - UUID of the reservation to check out
   * @returns Promise resolving to updated reservation
   *
   * @throws {ReservationError} If reservation not found or invalid status transition
   *
   * @remarks
   * - Validates status transition from CHECKED_IN to CHECKED_OUT
   * - Updates reservation status and room status atomically
   * - Sets room status to AVAILABLE
   * - Uses transaction for atomic updates
   * - Logs check-out for audit trail
   *
   * @example
   * ```typescript
   * const checkedOut = await service.checkOut('reservation-uuid');
   * ```
   */
  async checkOut(id: string): Promise<Reservation> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        throw new ReservationError('Reservation not found', 'RESERVATION_NOT_FOUND', 404);
      }

      if (!this.isValidStatusTransition(reservation.status, 'CHECKED_OUT')) {
        throw new ReservationError(
          `Cannot check out reservation in ${reservation.status} status`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      // Update reservation and room status in transaction
      const updated = await prisma.$transaction(async (tx) => {
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: 'CHECKED_OUT' },
        });

        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'AVAILABLE' as RoomStatus },
        });

        return updatedReservation;
      });

      console.log('Check-out processed successfully', {
        reservationId: id,
        roomId: reservation.roomId,
        previousStatus: reservation.status,
        newStatus: updated.status,
      });

      return updated;
    } catch (error) {
      if (error instanceof ReservationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to process check-out', {
        error: errorMessage,
        reservationId: id,
      });

      throw new ReservationError(
        'Failed to process check-out',
        'CHECK_OUT_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Cancels a reservation with ownership validation
   *
   * @param id - UUID of the reservation to cancel
   * @param userId - UUID of the user requesting cancellation
   * @param isAdmin - Whether the requesting user is an admin
   * @returns Promise resolving to updated reservation
   *
   * @throws {ReservationError} If reservation not found, access denied, or invalid status
   *
   * @remarks
   * - Validates ownership for non-admin users
   * - Validates status transition to CANCELLED
   * - Updates reservation status atomically
   * - Logs cancellation for audit trail
   *
   * @example
   * ```typescript
   * const cancelled = await service.cancelReservation(
   *   'reservation-uuid',
   *   'user-uuid',
   *   false
   * );
   * ```
   */
  async cancelReservation(
    id: string,
    userId: string,
    isAdmin: boolean
  ): Promise<Reservation> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        throw new ReservationError('Reservation not found', 'RESERVATION_NOT_FOUND', 404);
      }

      // Validate ownership for non-admin users
      if (!isAdmin && reservation.userId !== userId) {
        console.warn('Unauthorized cancellation attempt', {
          reservationId: id,
          requestingUserId: userId,
          reservationUserId: reservation.userId,
        });
        throw new ReservationError(
          'Access denied: You can only cancel your own reservations',
          'ACCESS_DENIED',
          403
        );
      }

      if (!this.isValidStatusTransition(reservation.status, 'CANCELLED')) {
        throw new ReservationError(
          `Cannot cancel reservation in ${reservation.status} status`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      console.log('Reservation cancelled successfully', {
        reservationId: id,
        userId,
        isAdmin,
        previousStatus: reservation.status,
        newStatus: updated.status,
      });

      return updated;
    } catch (error) {
      if (error instanceof ReservationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to cancel reservation', {
        error: errorMessage,
        reservationId: id,
        userId,
      });

      throw new ReservationError(
        'Failed to cancel reservation',
        'RESERVATION_CANCELLATION_FAILED',
        500,
        error
      );
    }
  }
}

/**
 * Singleton instance of ReservationService
 * Exported for use throughout the application
 */
export const reservationService = new ReservationService();