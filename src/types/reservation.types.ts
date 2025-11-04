// =============================================================================
// RESERVATION TYPES - TYPE DEFINITIONS FOR RESERVATION OPERATIONS
// =============================================================================
// This module defines TypeScript types for reservation management including
// DTOs for creation, updates, filtering, and comprehensive type definitions
// for reservation entities with relations.
//
// Type Safety: All types are strictly typed with proper validation constraints
// Prisma Integration: Types align with Prisma schema definitions
// =============================================================================

import { Prisma } from '@prisma/client';

// =============================================================================
// ENUMS - RESERVATION STATUS ENUMERATION
// =============================================================================

/**
 * Reservation lifecycle status enumeration
 * Matches Prisma schema ReservationStatus enum exactly
 * 
 * Status Transitions:
 * - PENDING -> CONFIRMED (admin confirms booking)
 * - CONFIRMED -> CHECKED_IN (guest arrives)
 * - CHECKED_IN -> CHECKED_OUT (guest departs)
 * - Any status -> CANCELLED (cancellation allowed)
 */
export enum ReservationStatus {
  /** Reservation created but not confirmed */
  PENDING = 'PENDING',
  /** Reservation confirmed by admin or payment */
  CONFIRMED = 'CONFIRMED',
  /** Guest has checked in */
  CHECKED_IN = 'CHECKED_IN',
  /** Guest has checked out */
  CHECKED_OUT = 'CHECKED_OUT',
  /** Reservation cancelled by guest or admin */
  CANCELLED = 'CANCELLED',
}

// =============================================================================
// DATA TRANSFER OBJECTS (DTOs)
// =============================================================================

/**
 * DTO for creating a new reservation
 * Used in POST /api/reservations endpoint
 * 
 * Validation Requirements:
 * - roomId: Must be valid UUID of existing room
 * - checkInDate: Must be valid date, not in the past
 * - checkOutDate: Must be after checkInDate
 * - userId: Extracted from JWT token, not in request body
 */
export interface CreateReservationDto {
  /** UUID of the room to reserve */
  roomId: string;
  
  /** Check-in date in ISO 8601 format (YYYY-MM-DD) */
  checkInDate: string;
  
  /** Check-out date in ISO 8601 format (YYYY-MM-DD) */
  checkOutDate: string;
}

/**
 * DTO for updating reservation status
 * Used in PUT /api/reservations/:id/confirm, check-in, check-out endpoints
 * 
 * Status Transition Validation:
 * - PENDING -> CONFIRMED: Admin only
 * - CONFIRMED -> CHECKED_IN: Admin only
 * - CHECKED_IN -> CHECKED_OUT: Admin only
 * - Any -> CANCELLED: Guest (own) or Admin (any)
 */
export interface UpdateReservationStatusDto {
  /** New status for the reservation */
  status: ReservationStatus;
}

/**
 * DTO for filtering reservations
 * Used in GET /api/reservations endpoint with query parameters
 * 
 * Filter Behavior:
 * - All filters are optional and can be combined
 * - Date range filters are inclusive
 * - Admin sees all reservations, guests see only their own
 */
export interface ReservationFilterDto {
  /** Filter by reservation status */
  status?: ReservationStatus;
  
  /** Filter by user ID (admin only) */
  userId?: string;
  
  /** Filter by room ID */
  roomId?: string;
  
  /** Filter by date range */
  dateRange?: {
    /** Start date for filtering (inclusive) */
    from: string;
    /** End date for filtering (inclusive) */
    to: string;
  };
  
  /** Page number for pagination (default: 1) */
  page?: number;
  
  /** Items per page (default: 10, max: 100) */
  limit?: number;
}

// =============================================================================
// ENTITY TYPES - RESERVATION WITH RELATIONS
// =============================================================================

/**
 * Complete reservation entity with user and room relations
 * Used for API responses that include related data
 * 
 * Includes:
 * - All reservation fields from Prisma model
 * - Nested user object (excluding password)
 * - Nested room object with full details
 */
export interface ReservationWithDetails {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Foreign key to user */
  userId: string;
  
  /** Foreign key to room */
  roomId: string;
  
  /** Check-in date */
  checkInDate: Date;
  
  /** Check-out date */
  checkOutDate: Date;
  
  /** Current reservation status */
  status: ReservationStatus;
  
  /** Record creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
  
  /** Related user information (password excluded) */
  user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'GUEST';
    createdAt: Date;
    updatedAt: Date;
  };
  
  /** Related room information */
  room: {
    id: string;
    roomNumber: string;
    type: string;
    price: number;
    status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Basic reservation entity without relations
 * Used for simple API responses
 */
export interface Reservation {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Foreign key to user */
  userId: string;
  
  /** Foreign key to room */
  roomId: string;
  
  /** Check-in date */
  checkInDate: Date;
  
  /** Check-out date */
  checkOutDate: Date;
  
  /** Current reservation status */
  status: ReservationStatus;
  
  /** Record creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
}

// =============================================================================
// PAGINATION TYPES
// =============================================================================

/**
 * Paginated response for reservation list
 * Used in GET /api/reservations endpoint
 */
export interface PaginatedReservationsResponse {
  /** Array of reservations with details */
  data: ReservationWithDetails[];
  
  /** Pagination metadata */
  meta: PaginationMeta;
}

/**
 * Pagination metadata
 * Provides information about current page and total records
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  
  /** Items per page */
  limit: number;
  
  /** Total number of items */
  total: number;
  
  /** Total number of pages */
  totalPages: number;
  
  /** Whether there is a next page */
  hasNextPage: boolean;
  
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

// =============================================================================
// TYPE GUARDS - RUNTIME TYPE CHECKING
// =============================================================================

/**
 * Type guard for ReservationStatus enum
 * Validates if a value is a valid reservation status
 * 
 * @param value - Value to check
 * @returns True if value is a valid ReservationStatus
 */
export function isReservationStatus(value: unknown): value is ReservationStatus {
  return (
    typeof value === 'string' &&
    Object.values(ReservationStatus).includes(value as ReservationStatus)
  );
}

/**
 * Type guard for CreateReservationDto
 * Validates if an object matches CreateReservationDto structure
 * 
 * @param value - Value to check
 * @returns True if value is a valid CreateReservationDto
 */
export function isCreateReservationDto(value: unknown): value is CreateReservationDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  return (
    typeof dto.roomId === 'string' &&
    dto.roomId.length > 0 &&
    typeof dto.checkInDate === 'string' &&
    dto.checkInDate.length > 0 &&
    typeof dto.checkOutDate === 'string' &&
    dto.checkOutDate.length > 0
  );
}

/**
 * Type guard for UpdateReservationStatusDto
 * Validates if an object matches UpdateReservationStatusDto structure
 * 
 * @param value - Value to check
 * @returns True if value is a valid UpdateReservationStatusDto
 */
export function isUpdateReservationStatusDto(
  value: unknown
): value is UpdateReservationStatusDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  return isReservationStatus(dto.status);
}

/**
 * Type guard for ReservationFilterDto
 * Validates if an object matches ReservationFilterDto structure
 * 
 * @param value - Value to check
 * @returns True if value is a valid ReservationFilterDto
 */
export function isReservationFilterDto(value: unknown): value is ReservationFilterDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  // All fields are optional, so empty object is valid
  if (Object.keys(dto).length === 0) {
    return true;
  }

  // Validate status if present
  if (dto.status !== undefined && !isReservationStatus(dto.status)) {
    return false;
  }

  // Validate userId if present
  if (dto.userId !== undefined && typeof dto.userId !== 'string') {
    return false;
  }

  // Validate roomId if present
  if (dto.roomId !== undefined && typeof dto.roomId !== 'string') {
    return false;
  }

  // Validate dateRange if present
  if (dto.dateRange !== undefined) {
    if (typeof dto.dateRange !== 'object' || dto.dateRange === null) {
      return false;
    }
    const dateRange = dto.dateRange as Record<string, unknown>;
    if (typeof dateRange.from !== 'string' || typeof dateRange.to !== 'string') {
      return false;
    }
  }

  // Validate page if present
  if (dto.page !== undefined && typeof dto.page !== 'number') {
    return false;
  }

  // Validate limit if present
  if (dto.limit !== undefined && typeof dto.limit !== 'number') {
    return false;
  }

  return true;
}

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

/**
 * Validation rules for reservation operations
 * Used by validators and service layer
 */
export const RESERVATION_VALIDATION = {
  /** Date validation rules */
  dates: {
    /** Minimum advance booking days */
    minAdvanceDays: 0,
    /** Maximum advance booking days */
    maxAdvanceDays: 365,
    /** Minimum stay duration in days */
    minStayDays: 1,
    /** Maximum stay duration in days */
    maxStayDays: 30,
  },
  /** Pagination rules */
  pagination: {
    /** Default page number */
    defaultPage: 1,
    /** Default items per page */
    defaultLimit: 10,
    /** Maximum items per page */
    maxLimit: 100,
  },
} as const;

/**
 * Valid status transitions for reservation lifecycle
 * Used for validating status updates
 */
export const VALID_STATUS_TRANSITIONS: Record<
  ReservationStatus,
  ReservationStatus[]
> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.CHECKED_IN,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.CHECKED_IN]: [
    ReservationStatus.CHECKED_OUT,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.CHECKED_OUT]: [],
  [ReservationStatus.CANCELLED]: [],
} as const;

// =============================================================================
// PRISMA TYPE EXPORTS
// =============================================================================

/**
 * Prisma-generated types for type-safe database operations
 * Re-exported for use in service layer
 */
export type PrismaReservation = Prisma.ReservationGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        role: true;
        createdAt: true;
        updatedAt: true;
      };
    };
    room: true;
  };
}>;

/**
 * Prisma create input type
 * Used for type-safe reservation creation
 */
export type PrismaReservationCreateInput = Prisma.ReservationCreateInput;

/**
 * Prisma update input type
 * Used for type-safe reservation updates
 */
export type PrismaReservationUpdateInput = Prisma.ReservationUpdateInput;

/**
 * Prisma where input type
 * Used for type-safe reservation queries
 */
export type PrismaReservationWhereInput = Prisma.ReservationWhereInput;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  CreateReservationDto,
  UpdateReservationStatusDto,
  ReservationFilterDto,
  ReservationWithDetails,
  Reservation,
  PaginatedReservationsResponse,
  PaginationMeta,
};