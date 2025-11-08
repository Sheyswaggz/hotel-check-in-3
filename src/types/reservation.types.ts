// =============================================================================
// RESERVATION TYPES - TYPE DEFINITIONS FOR RESERVATION OPERATIONS
// =============================================================================
// This module defines TypeScript types and interfaces for reservation
// management operations including DTOs, filters, and domain models.
//
// Type Safety: All types are strictly typed with proper validation
// Prisma Integration: Types align with Prisma schema definitions
// =============================================================================

import type { Reservation, User, Room, ReservationStatus } from '@prisma/client';

// =============================================================================
// ENUMS - Re-export Prisma enums for type safety
// =============================================================================

/**
 * Reservation lifecycle status enumeration
 * Re-exported from Prisma for consistent type usage across the application
 *
 * @remarks
 * - PENDING: Reservation created but not confirmed
 * - CONFIRMED: Reservation confirmed by admin or payment
 * - CHECKED_IN: Guest has checked in
 * - CHECKED_OUT: Guest has checked out
 * - CANCELLED: Reservation cancelled by guest or admin
 */
export { ReservationStatus } from '@prisma/client';

// =============================================================================
// DATA TRANSFER OBJECTS (DTOs)
// =============================================================================

/**
 * DTO for creating a new reservation
 *
 * @remarks
 * Used for POST /api/reservations endpoint
 * All fields are required for reservation creation
 * Date validation must be performed at application level
 *
 * @example
 * ```typescript
 * const dto: CreateReservationDto = {
 *   roomId: '123e4567-e89b-12d3-a456-426614174000',
 *   checkInDate: '2024-01-15',
 *   checkOutDate: '2024-01-20'
 * };
 * ```
 */
export interface CreateReservationDto {
  /**
   * UUID of the room to reserve
   * Must reference an existing room in the database
   */
  roomId: string;

  /**
   * Check-in date in ISO 8601 format (YYYY-MM-DD)
   * Must be a future date or today
   * Must be before checkOutDate
   */
  checkInDate: string;

  /**
   * Check-out date in ISO 8601 format (YYYY-MM-DD)
   * Must be after checkInDate
   * Minimum stay duration should be validated at application level
   */
  checkOutDate: string;
}

/**
 * DTO for updating reservation status
 *
 * @remarks
 * Used for status transition endpoints:
 * - PUT /api/reservations/:id/confirm
 * - PUT /api/reservations/:id/check-in
 * - PUT /api/reservations/:id/check-out
 * - PUT /api/reservations/:id/cancel
 *
 * Status transitions must be validated:
 * - PENDING -> CONFIRMED, CANCELLED
 * - CONFIRMED -> CHECKED_IN, CANCELLED
 * - CHECKED_IN -> CHECKED_OUT
 * - CHECKED_OUT -> (terminal state)
 * - CANCELLED -> (terminal state)
 *
 * @example
 * ```typescript
 * const dto: UpdateReservationStatusDto = {
 *   status: 'CONFIRMED'
 * };
 * ```
 */
export interface UpdateReservationStatusDto {
  /**
   * New reservation status
   * Must be a valid transition from current status
   */
  status: ReservationStatus;
}

/**
 * DTO for filtering reservations in list queries
 *
 * @remarks
 * Used for GET /api/reservations endpoint
 * All fields are optional for flexible filtering
 * Multiple filters are combined with AND logic
 *
 * @example
 * ```typescript
 * // Filter by status and user
 * const filter: ReservationFilterDto = {
 *   status: 'CONFIRMED',
 *   userId: '123e4567-e89b-12d3-a456-426614174000'
 * };
 *
 * // Filter by date range
 * const dateFilter: ReservationFilterDto = {
 *   dateRange: {
 *     from: '2024-01-01',
 *     to: '2024-01-31'
 *   }
 * };
 * ```
 */
export interface ReservationFilterDto {
  /**
   * Filter by reservation status
   * Optional: If omitted, returns reservations in all statuses
   */
  status?: ReservationStatus;

  /**
   * Filter by user ID
   * Optional: If omitted, returns reservations for all users (admin only)
   * For guest users, this is automatically set to their own ID
   */
  userId?: string;

  /**
   * Filter by room ID
   * Optional: If omitted, returns reservations for all rooms
   */
  roomId?: string;

  /**
   * Filter by date range
   * Optional: If omitted, returns reservations for all dates
   *
   * @remarks
   * Matches reservations that overlap with the specified date range
   * Overlap logic: reservation.checkInDate <= dateRange.to AND reservation.checkOutDate >= dateRange.from
   */
  dateRange?: {
    /**
     * Start date of the range in ISO 8601 format (YYYY-MM-DD)
     */
    from: string;

    /**
     * End date of the range in ISO 8601 format (YYYY-MM-DD)
     * Must be >= from date
     */
    to: string;
  };
}

// =============================================================================
// DOMAIN MODELS - Extended types with relations
// =============================================================================

/**
 * Reservation with full user and room details
 *
 * @remarks
 * Used for detailed reservation views and responses
 * Includes all Prisma relations for complete reservation context
 * Returned by GET /api/reservations/:id endpoint
 *
 * @example
 * ```typescript
 * const reservation: ReservationWithDetails = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   userId: '223e4567-e89b-12d3-a456-426614174000',
 *   roomId: '323e4567-e89b-12d3-a456-426614174000',
 *   checkInDate: new Date('2024-01-15'),
 *   checkOutDate: new Date('2024-01-20'),
 *   status: 'CONFIRMED',
 *   createdAt: new Date('2024-01-01T10:00:00Z'),
 *   updatedAt: new Date('2024-01-02T15:30:00Z'),
 *   user: {
 *     id: '223e4567-e89b-12d3-a456-426614174000',
 *     email: 'guest@example.com',
 *     role: 'GUEST',
 *     createdAt: new Date('2023-12-01T10:00:00Z'),
 *     updatedAt: new Date('2023-12-01T10:00:00Z')
 *   },
 *   room: {
 *     id: '323e4567-e89b-12d3-a456-426614174000',
 *     roomNumber: '101',
 *     type: 'Deluxe',
 *     price: new Decimal('150.00'),
 *     status: 'AVAILABLE',
 *     createdAt: new Date('2023-11-01T10:00:00Z'),
 *     updatedAt: new Date('2023-11-01T10:00:00Z')
 *   }
 * };
 * ```
 */
export interface ReservationWithDetails extends Reservation {
  /**
   * User who made the reservation
   * Includes full user details excluding password
   */
  user: Omit<User, 'password'>;

  /**
   * Room being reserved
   * Includes full room details
   */
  room: Room;
}

/**
 * Reservation with user details only
 *
 * @remarks
 * Used for room-centric views where user context is needed
 * Lighter than ReservationWithDetails for list operations
 */
export interface ReservationWithUser extends Reservation {
  /**
   * User who made the reservation
   * Includes full user details excluding password
   */
  user: Omit<User, 'password'>;
}

/**
 * Reservation with room details only
 *
 * @remarks
 * Used for user-centric views where room context is needed
 * Lighter than ReservationWithDetails for list operations
 */
export interface ReservationWithRoom extends Reservation {
  /**
   * Room being reserved
   * Includes full room details
   */
  room: Room;
}

// =============================================================================
// TYPE GUARDS - Runtime type checking
// =============================================================================

/**
 * Type guard to check if a value is a valid ReservationStatus
 *
 * @param value - Value to check
 * @returns True if value is a valid ReservationStatus
 *
 * @example
 * ```typescript
 * const status: unknown = 'CONFIRMED';
 * if (isReservationStatus(status)) {
 *   // status is now typed as ReservationStatus
 *   console.log(status.toLowerCase());
 * }
 * ```
 */
export function isReservationStatus(value: unknown): value is ReservationStatus {
  return (
    typeof value === 'string' &&
    ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].includes(value)
  );
}

/**
 * Type guard to check if a value is a valid CreateReservationDto
 *
 * @param value - Value to check
 * @returns True if value is a valid CreateReservationDto
 *
 * @remarks
 * Performs structural validation only
 * Date format and business logic validation must be done separately
 *
 * @example
 * ```typescript
 * const dto: unknown = req.body;
 * if (isCreateReservationDto(dto)) {
 *   // dto is now typed as CreateReservationDto
 *   await createReservation(dto);
 * }
 * ```
 */
export function isCreateReservationDto(value: unknown): value is CreateReservationDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'roomId' in value &&
    typeof (value as CreateReservationDto).roomId === 'string' &&
    'checkInDate' in value &&
    typeof (value as CreateReservationDto).checkInDate === 'string' &&
    'checkOutDate' in value &&
    typeof (value as CreateReservationDto).checkOutDate === 'string'
  );
}

/**
 * Type guard to check if a value is a valid UpdateReservationStatusDto
 *
 * @param value - Value to check
 * @returns True if value is a valid UpdateReservationStatusDto
 *
 * @example
 * ```typescript
 * const dto: unknown = req.body;
 * if (isUpdateReservationStatusDto(dto)) {
 *   // dto is now typed as UpdateReservationStatusDto
 *   await updateReservationStatus(id, dto);
 * }
 * ```
 */
export function isUpdateReservationStatusDto(
  value: unknown
): value is UpdateReservationStatusDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    isReservationStatus((value as UpdateReservationStatusDto).status)
  );
}

/**
 * Type guard to check if a value is a valid ReservationFilterDto
 *
 * @param value - Value to check
 * @returns True if value is a valid ReservationFilterDto
 *
 * @remarks
 * All fields are optional, so empty object is valid
 * Validates structure and types of provided fields
 *
 * @example
 * ```typescript
 * const filter: unknown = req.query;
 * if (isReservationFilterDto(filter)) {
 *   // filter is now typed as ReservationFilterDto
 *   const reservations = await findReservations(filter);
 * }
 * ```
 */
export function isReservationFilterDto(value: unknown): value is ReservationFilterDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const filter = value as ReservationFilterDto;

  // Validate optional status field
  if ('status' in filter && !isReservationStatus(filter.status)) {
    return false;
  }

  // Validate optional userId field
  if ('userId' in filter && typeof filter.userId !== 'string') {
    return false;
  }

  // Validate optional roomId field
  if ('roomId' in filter && typeof filter.roomId !== 'string') {
    return false;
  }

  // Validate optional dateRange field
  if ('dateRange' in filter) {
    const dateRange = filter.dateRange;
    if (
      typeof dateRange !== 'object' ||
      dateRange === null ||
      !('from' in dateRange) ||
      typeof dateRange.from !== 'string' ||
      !('to' in dateRange) ||
      typeof dateRange.to !== 'string'
    ) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Valid reservation status transitions
 *
 * @remarks
 * Defines allowed state transitions for reservation lifecycle
 * Used for validation in status update operations
 *
 * State machine:
 * - PENDING -> CONFIRMED, CANCELLED
 * - CONFIRMED -> CHECKED_IN, CANCELLED
 * - CHECKED_IN -> CHECKED_OUT
 * - CHECKED_OUT -> (terminal state, no transitions)
 * - CANCELLED -> (terminal state, no transitions)
 */
export type ValidReservationTransitions = {
  PENDING: 'CONFIRMED' | 'CANCELLED';
  CONFIRMED: 'CHECKED_IN' | 'CANCELLED';
  CHECKED_IN: 'CHECKED_OUT';
  CHECKED_OUT: never;
  CANCELLED: never;
};

/**
 * Reservation response type for API endpoints
 *
 * @remarks
 * Omits password from user relation for security
 * Used in all reservation response payloads
 */
export type ReservationResponse = Omit<ReservationWithDetails, 'user'> & {
  user: Omit<User, 'password'>;
};

/**
 * Reservation list item type
 *
 * @remarks
 * Lighter version for list endpoints
 * Includes essential details without full relations
 */
export type ReservationListItem = Pick<
  Reservation,
  'id' | 'checkInDate' | 'checkOutDate' | 'status' | 'createdAt'
> & {
  user: Pick<User, 'id' | 'email'>;
  room: Pick<Room, 'id' | 'roomNumber' | 'type' | 'price'>;
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Re-export Prisma types for convenience
 */
export type { Reservation, User, Room } from '@prisma/client';