/**
 * Reservation Service - Business Logic Layer
 * 
 * Implements comprehensive reservation management including:
 * - Room availability checking with date overlap detection
 * - Reservation creation with atomic transactions
 * - Role-based reservation retrieval with filtering
 * - Status transition validation and enforcement
 * - Check-in/check-out workflows with room status updates
 * - Cancellation with ownership validation
 * 
 * @module services/reservation.service
 */

import { prisma } from '../config/database.js';
import {
  ReservationStatus,
  CreateReservationDto,
  ReservationFilterDto,
  ReservationWithDetails,
  PaginatedReservationsResponse,
  VALID_STATUS_TRANSITIONS,
  RESERVATION_VALIDATION,
} from '../types/reservation.types.js';
import {
  isDateRangeValid,
  hasDateOverlap,
  isValidCheckInDate,
  DateValidationError,
} from '../utils/date.util.js';
import { Prisma } from '@prisma/client';

/**
 * Base error class for reservation service errors
 */
class ReservationServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ReservationServiceError';
    Error.captureStackTrace(this, ReservationServiceError);
  }
}

/**
 * Error thrown when a reservation is not found
 */
class ReservationNotFoundError extends ReservationServiceError {
  constructor(reservationId: string) {
    super(
      `Reservation with ID ${reservationId} not found`,
      'RESERVATION_NOT_FOUND',
      404
    );
    this.name = 'ReservationNotFoundError';
  }
}

/**
 * Error thrown when room is not available for booking
 */
class RoomNotAvailableError extends ReservationServiceError {
  constructor(roomId: string, checkIn: Date, checkOut: Date) {
    super(
      `Room ${roomId} is not available from ${checkIn.toISOString()} to ${checkOut.toISOString()}`,
      'ROOM_NOT_AVAILABLE',
      409
    );
    this.name = 'RoomNotAvailableError';
  }
}

/**
 * Error thrown when status transition is invalid
 */
class InvalidStatusTransitionError extends ReservationServiceError {
  constructor(currentStatus: ReservationStatus, newStatus: ReservationStatus) {
    super(
      `Cannot transition from ${currentStatus} to ${newStatus}`,
      'INVALID_STATUS_TRANSITION',
      400
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Error thrown when user lacks permission for operation
 */
class UnauthorizedReservationAccessError extends ReservationServiceError {
  constructor(userId: string, reservationId: string) {
    super(
      `User ${userId} is not authorized to access reservation ${reservationId}`,
      'UNAUTHORIZED_ACCESS',
      403
    );
    this.name = 'UnauthorizedReservationAccessError';
  }
}

/**
 * Error thrown when room is not found
 */
class RoomNotFoundError extends ReservationServiceError {
  constructor(roomId: string) {
    super(`Room with ID ${roomId} not found`, 'ROOM_NOT_FOUND', 404);
    this.name = 'RoomNotFoundError';
  }
}

/**
 * Reservation Service Class
 * 
 * Provides business logic for reservation management with:
 * - Comprehensive error handling and recovery
 * - Transaction support for data consistency
 * - Role-based access control
 * - Structured logging for observability
 */
export class ReservationService {
  /**
   * Checks if a room is available for the specified date range
   * 
   * Business rules:
   * - Room must exist and be in AVAILABLE status
   * - No overlapping reservations in PENDING, CONFIRMED, or CHECKED_IN status
   * - Date range must be valid (check-out after check-in)
   * - Check-in date must not be in the past
   * 
   * @param roomId - UUID of the room to check
   * @param checkIn - Check-in date
   * @param checkOut - Check-out date
   * @returns True if room is available, false otherwise
   * @throws {DateValidationError} If date range is invalid
   * @throws {RoomNotFoundError} If room does not exist
   * @throws {ReservationServiceError} If database operation fails
   */
  async checkRoomAvailability(
    roomId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean> {
    try {
      // Validate date range
      isDateRangeValid(checkIn, checkOut);
      isValidCheckInDate(checkIn);

      console.log('Checking room availability:', {
        roomId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
      });

      // Check if room exists and is available
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, status: true, roomNumber: true },
      });

      if (!room) {
        throw new RoomNotFoundError(roomId);
      }

      if (room.status !== 'AVAILABLE') {
        console.log('Room not available - status:', {
          roomId,
          roomNumber: room.roomNumber,
          status: room.status,
        });
        return false;
      }

      // Query overlapping reservations
      const overlappingReservations = await prisma.reservation.findMany({
        where: {
          roomId,
          status: {
            in: [
              ReservationStatus.PENDING,
              ReservationStatus.CONFIRMED,
              ReservationStatus.CHECKED_IN,
            ],
          },
          OR: [
            {
              AND: [
                { checkInDate: { lte: checkIn } },
                { checkOutDate: { gt: checkIn } },
              ],
            },
            {
              AND: [
                { checkInDate: { lt: checkOut } },
                { checkOutDate: { gte: checkOut } },
              ],
            },
            {
              AND: [
                { checkInDate: { gte: checkIn } },
                { checkOutDate: { lte: checkOut } },
              ],
            },
          ],
        },
        select: {
          id: true,
          checkInDate: true,
          checkOutDate: true,
          status: true,
        },
      });

      const isAvailable = overlappingReservations.length === 0;

      console.log('Room availability check result:', {
        roomId,
        isAvailable,
        overlappingCount: overlappingReservations.length,
      });

      return isAvailable;
    } catch (error) {
      if (
        error instanceof DateValidationError ||
        error instanceof RoomNotFoundError
      ) {
        throw error;
      }

      console.error('Error checking room availability:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
      });

      throw new ReservationServiceError(
        'Failed to check room availability',
        'AVAILABILITY_CHECK_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Creates a new reservation with availability check
   * 
   * Business rules:
   * - Room must be available for the date range
   * - Date range must be valid
   * - Check-in date must not be in the past
   * - Initial status is PENDING
   * - Operation is atomic (transaction)
   * 
   * @param userId - UUID of the user making the reservation
   * @param data - Reservation creation data
   * @returns Created reservation with user and room details
   * @throws {DateValidationError} If date range is invalid
   * @throws {RoomNotFoundError} If room does not exist
   * @throws {RoomNotAvailableError} If room is not available
   * @throws {ReservationServiceError} If creation fails
   */
  async createReservation(
    userId: string,
    data: CreateReservationDto
  ): Promise<ReservationWithDetails> {
    const { roomId, checkInDate, checkOutDate } = data;

    try {
      // Parse and validate dates
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);

      isDateRangeValid(checkIn, checkOut);
      isValidCheckInDate(checkIn);

      console.log('Creating reservation:', {
        userId,
        roomId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
      });

      // Check availability
      const isAvailable = await this.checkRoomAvailability(
        roomId,
        checkIn,
        checkOut
      );

      if (!isAvailable) {
        throw new RoomNotAvailableError(roomId, checkIn, checkOut);
      }

      // Create reservation in transaction
      const reservation = await prisma.$transaction(async (tx) => {
        const created = await tx.reservation.create({
          data: {
            userId,
            roomId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            status: ReservationStatus.PENDING,
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

        console.log('Reservation created successfully:', {
          reservationId: created.id,
          userId,
          roomId,
          status: created.status,
        });

        return created;
      });

      return reservation as ReservationWithDetails;
    } catch (error) {
      if (
        error instanceof DateValidationError ||
        error instanceof RoomNotFoundError ||
        error instanceof RoomNotAvailableError
      ) {
        throw error;
      }

      console.error('Error creating reservation:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        roomId,
      });

      throw new ReservationServiceError(
        'Failed to create reservation',
        'RESERVATION_CREATE_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Retrieves reservations with role-based filtering
   * 
   * Access control:
   * - Guests can only see their own reservations
   * - Admins can see all reservations
   * 
   * @param filters - Filter criteria for reservations
   * @param userId - UUID of the requesting user
   * @param isAdmin - Whether the user is an admin
   * @returns Paginated list of reservations
   * @throws {ReservationServiceError} If retrieval fails
   */
  async getReservations(
    filters: ReservationFilterDto,
    userId: string,
    isAdmin: boolean
  ): Promise<PaginatedReservationsResponse> {
    try {
      const {
        status,
        userId: filterUserId,
        roomId,
        dateRange,
        page = RESERVATION_VALIDATION.pagination.defaultPage,
        limit = RESERVATION_VALIDATION.pagination.defaultLimit,
      } = filters;

      // Enforce pagination limits
      const validatedLimit = Math.min(
        limit,
        RESERVATION_VALIDATION.pagination.maxLimit
      );
      const skip = (page - 1) * validatedLimit;

      // Build where clause with role-based filtering
      const where: Prisma.ReservationWhereInput = {
        // Guests can only see their own reservations
        ...(isAdmin ? {} : { userId }),
        // Apply optional filters
        ...(status && { status }),
        ...(isAdmin && filterUserId && { userId: filterUserId }),
        ...(roomId && { roomId }),
        ...(dateRange && {
          AND: [
            { checkInDate: { gte: new Date(dateRange.from) } },
            { checkOutDate: { lte: new Date(dateRange.to) } },
          ],
        }),
      };

      console.log('Fetching reservations:', {
        userId,
        isAdmin,
        filters: where,
        page,
        limit: validatedLimit,
      });

      // Execute query with pagination
      const [reservations, total] = await Promise.all([
        prisma.reservation.findMany({
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
          orderBy: { createdAt: 'desc' },
          skip,
          take: validatedLimit,
        }),
        prisma.reservation.count({ where }),
      ]);

      const totalPages = Math.ceil(total / validatedLimit);

      console.log('Reservations retrieved:', {
        count: reservations.length,
        total,
        page,
        totalPages,
      });

      return {
        data: reservations as ReservationWithDetails[],
        meta: {
          page,
          limit: validatedLimit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      console.error('Error fetching reservations:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        isAdmin,
      });

      throw new ReservationServiceError(
        'Failed to fetch reservations',
        'RESERVATION_FETCH_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Retrieves a single reservation by ID with ownership check
   * 
   * Access control:
   * - Guests can only access their own reservations
   * - Admins can access any reservation
   * 
   * @param id - UUID of the reservation
   * @param userId - UUID of the requesting user
   * @param isAdmin - Whether the user is an admin
   * @returns Reservation with user and room details
   * @throws {ReservationNotFoundError} If reservation not found
   * @throws {UnauthorizedReservationAccessError} If user lacks permission
   * @throws {ReservationServiceError} If retrieval fails
   */
  async getReservationById(
    id: string,
    userId: string,
    isAdmin: boolean
  ): Promise<ReservationWithDetails> {
    try {
      console.log('Fetching reservation by ID:', { id, userId, isAdmin });

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
        throw new ReservationNotFoundError(id);
      }

      // Check ownership for non-admin users
      if (!isAdmin && reservation.userId !== userId) {
        throw new UnauthorizedReservationAccessError(userId, id);
      }

      console.log('Reservation retrieved:', {
        reservationId: id,
        status: reservation.status,
      });

      return reservation as ReservationWithDetails;
    } catch (error) {
      if (
        error instanceof ReservationNotFoundError ||
        error instanceof UnauthorizedReservationAccessError
      ) {
        throw error;
      }

      console.error('Error fetching reservation:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id,
        userId,
      });

      throw new ReservationServiceError(
        'Failed to fetch reservation',
        'RESERVATION_FETCH_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Confirms a reservation (admin only)
   * 
   * Business rules:
   * - Only PENDING reservations can be confirmed
   * - Status transitions to CONFIRMED
   * 
   * @param id - UUID of the reservation
   * @returns Updated reservation
   * @throws {ReservationNotFoundError} If reservation not found
   * @throws {InvalidStatusTransitionError} If transition is invalid
   * @throws {ReservationServiceError} If update fails
   */
  async confirmReservation(id: string): Promise<ReservationWithDetails> {
    try {
      console.log('Confirming reservation:', { id });

      const reservation = await prisma.reservation.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!reservation) {
        throw new ReservationNotFoundError(id);
      }

      // Validate status transition
      const validTransitions = VALID_STATUS_TRANSITIONS[reservation.status];
      if (!validTransitions.includes(ReservationStatus.CONFIRMED)) {
        throw new InvalidStatusTransitionError(
          reservation.status,
          ReservationStatus.CONFIRMED
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CONFIRMED },
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

      console.log('Reservation confirmed:', {
        reservationId: id,
        newStatus: updated.status,
      });

      return updated as ReservationWithDetails;
    } catch (error) {
      if (
        error instanceof ReservationNotFoundError ||
        error instanceof InvalidStatusTransitionError
      ) {
        throw error;
      }

      console.error('Error confirming reservation:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id,
      });

      throw new ReservationServiceError(
        'Failed to confirm reservation',
        'RESERVATION_CONFIRM_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Processes check-in for a reservation (admin only)
   * 
   * Business rules:
   * - Only CONFIRMED reservations can be checked in
   * - Status transitions to CHECKED_IN
   * - Room status updates to OCCUPIED
   * - Operation is atomic (transaction)
   * 
   * @param id - UUID of the reservation
   * @returns Updated reservation
   * @throws {ReservationNotFoundError} If reservation not found
   * @throws {InvalidStatusTransitionError} If transition is invalid
   * @throws {ReservationServiceError} If update fails
   */
  async checkIn(id: string): Promise<ReservationWithDetails> {
    try {
      console.log('Processing check-in:', { id });

      const reservation = await prisma.reservation.findUnique({
        where: { id },
        select: { status: true, roomId: true },
      });

      if (!reservation) {
        throw new ReservationNotFoundError(id);
      }

      // Validate status transition
      const validTransitions = VALID_STATUS_TRANSITIONS[reservation.status];
      if (!validTransitions.includes(ReservationStatus.CHECKED_IN)) {
        throw new InvalidStatusTransitionError(
          reservation.status,
          ReservationStatus.CHECKED_IN
        );
      }

      // Update reservation and room status in transaction
      const updated = await prisma.$transaction(async (tx) => {
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: ReservationStatus.CHECKED_IN },
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

        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'OCCUPIED' },
        });

        console.log('Check-in processed:', {
          reservationId: id,
          roomId: reservation.roomId,
          newStatus: updatedReservation.status,
        });

        return updatedReservation;
      });

      return updated as ReservationWithDetails;
    } catch (error) {
      if (
        error instanceof ReservationNotFoundError ||
        error instanceof InvalidStatusTransitionError
      ) {
        throw error;
      }

      console.error('Error processing check-in:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id,
      });

      throw new ReservationServiceError(
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
   * Business rules:
   * - Only CHECKED_IN reservations can be checked out
   * - Status transitions to CHECKED_OUT
   * - Room status updates to AVAILABLE
   * - Operation is atomic (transaction)
   * 
   * @param id - UUID of the reservation
   * @returns Updated reservation
   * @throws {ReservationNotFoundError} If reservation not found
   * @throws {InvalidStatusTransitionError} If transition is invalid
   * @throws {ReservationServiceError} If update fails
   */
  async checkOut(id: string): Promise<ReservationWithDetails> {
    try {
      console.log('Processing check-out:', { id });

      const reservation = await prisma.reservation.findUnique({
        where: { id },
        select: { status: true, roomId: true },
      });

      if (!reservation) {
        throw new ReservationNotFoundError(id);
      }

      // Validate status transition
      const validTransitions = VALID_STATUS_TRANSITIONS[reservation.status];
      if (!validTransitions.includes(ReservationStatus.CHECKED_OUT)) {
        throw new InvalidStatusTransitionError(
          reservation.status,
          ReservationStatus.CHECKED_OUT
        );
      }

      // Update reservation and room status in transaction
      const updated = await prisma.$transaction(async (tx) => {
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: ReservationStatus.CHECKED_OUT },
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

        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'AVAILABLE' },
        });

        console.log('Check-out processed:', {
          reservationId: id,
          roomId: reservation.roomId,
          newStatus: updatedReservation.status,
        });

        return updatedReservation;
      });

      return updated as ReservationWithDetails;
    } catch (error) {
      if (
        error instanceof ReservationNotFoundError ||
        error instanceof InvalidStatusTransitionError
      ) {
        throw error;
      }

      console.error('Error processing check-out:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id,
      });

      throw new ReservationServiceError(
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
   * Business rules:
   * - Guests can only cancel their own reservations
   * - Admins can cancel any reservation
   * - Cannot cancel CHECKED_OUT reservations
   * - Status transitions to CANCELLED
   * - If currently CHECKED_IN, room status updates to AVAILABLE
   * 
   * @param id - UUID of the reservation
   * @param userId - UUID of the requesting user
   * @returns Updated reservation
   * @throws {ReservationNotFoundError} If reservation not found
   * @throws {UnauthorizedReservationAccessError} If user lacks permission
   * @throws {InvalidStatusTransitionError} If transition is invalid
   * @throws {ReservationServiceError} If cancellation fails
   */
  async cancelReservation(
    id: string,
    userId: string
  ): Promise<ReservationWithDetails> {
    try {
      console.log('Cancelling reservation:', { id, userId });

      const reservation = await prisma.reservation.findUnique({
        where: { id },
        select: { status: true, userId: true, roomId: true },
      });

      if (!reservation) {
        throw new ReservationNotFoundError(id);
      }

      // Check ownership
      if (reservation.userId !== userId) {
        throw new UnauthorizedReservationAccessError(userId, id);
      }

      // Validate status transition
      const validTransitions = VALID_STATUS_TRANSITIONS[reservation.status];
      if (!validTransitions.includes(ReservationStatus.CANCELLED)) {
        throw new InvalidStatusTransitionError(
          reservation.status,
          ReservationStatus.CANCELLED
        );
      }

      // Update reservation and potentially room status in transaction
      const updated = await prisma.$transaction(async (tx) => {
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: ReservationStatus.CANCELLED },
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

        // If reservation was checked in, make room available
        if (reservation.status === ReservationStatus.CHECKED_IN) {
          await tx.room.update({
            where: { id: reservation.roomId },
            data: { status: 'AVAILABLE' },
          });
        }

        console.log('Reservation cancelled:', {
          reservationId: id,
          previousStatus: reservation.status,
          newStatus: updatedReservation.status,
        });

        return updatedReservation;
      });

      return updated as ReservationWithDetails;
    } catch (error) {
      if (
        error instanceof ReservationNotFoundError ||
        error instanceof UnauthorizedReservationAccessError ||
        error instanceof InvalidStatusTransitionError
      ) {
        throw error;
      }

      console.error('Error cancelling reservation:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id,
        userId,
      });

      throw new ReservationServiceError(
        'Failed to cancel reservation',
        'RESERVATION_CANCEL_FAILED',
        500,
        error
      );
    }
  }
}

/**
 * Singleton instance of ReservationService
 * Exported for use in controllers and routes
 */
export const reservationService = new ReservationService();

/**
 * Export error classes for use in error handling middleware
 */
export {
  ReservationServiceError,
  ReservationNotFoundError,
  RoomNotAvailableError,
  InvalidStatusTransitionError,
  UnauthorizedReservationAccessError,
  RoomNotFoundError,
};