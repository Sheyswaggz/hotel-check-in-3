// =============================================================================
// ROOM TYPES - TYPE DEFINITIONS FOR ROOM MANAGEMENT
// =============================================================================
// This module defines all TypeScript types, interfaces, and enums for room
// operations including DTOs, filters, pagination, and validation rules.
//
// Type Safety: All types are strictly typed with runtime type guards
// Validation: Includes validation constants for business rules
// Prisma Integration: Exports Prisma-compatible types
// =============================================================================

import type { Prisma } from '@prisma/client';

// =============================================================================
// ENUMS - Type-safe enumeration definitions
// =============================================================================

/**
 * Room availability status enumeration
 * Matches Prisma schema RoomStatus enum
 *
 * @enum {string}
 */
export enum RoomStatus {
  /** Room is available for booking */
  AVAILABLE = 'AVAILABLE',
  /** Room is currently occupied by a guest */
  OCCUPIED = 'OCCUPIED',
  /** Room is under maintenance and unavailable */
  MAINTENANCE = 'MAINTENANCE',
}

/**
 * Room type/category enumeration
 * Defines standard room classifications
 *
 * @enum {string}
 */
export enum RoomType {
  /** Standard room with basic amenities */
  STANDARD = 'STANDARD',
  /** Deluxe room with enhanced amenities */
  DELUXE = 'DELUXE',
  /** Suite with premium amenities and space */
  SUITE = 'SUITE',
  /** Executive room for business travelers */
  EXECUTIVE = 'EXECUTIVE',
  /** Presidential suite with luxury amenities */
  PRESIDENTIAL = 'PRESIDENTIAL',
}

// =============================================================================
// DATA TRANSFER OBJECTS (DTOs)
// =============================================================================

/**
 * DTO for creating a new room
 * All fields are required for room creation
 *
 * @interface CreateRoomDto
 */
export interface CreateRoomDto {
  /** Unique room number (e.g., "101", "A-205") */
  roomNumber: string;
  /** Room type/category */
  type: string;
  /** Price per night in decimal format */
  price: number;
  /** Initial room status (defaults to AVAILABLE) */
  status: RoomStatus;
}

/**
 * DTO for updating an existing room
 * All fields are optional for partial updates
 *
 * @interface UpdateRoomDto
 */
export interface UpdateRoomDto {
  /** Updated room number (must remain unique) */
  roomNumber?: string;
  /** Updated room type/category */
  type?: string;
  /** Updated price per night */
  price?: number;
  /** Updated room status */
  status?: RoomStatus;
}

/**
 * DTO for filtering room queries
 * All fields are optional for flexible filtering
 *
 * @interface RoomFilterDto
 */
export interface RoomFilterDto {
  /** Filter by room type */
  type?: string;
  /** Filter by room status */
  status?: RoomStatus;
  /** Filter by minimum price (inclusive) */
  minPrice?: number;
  /** Filter by maximum price (inclusive) */
  maxPrice?: number;
}

/**
 * DTO for pagination parameters
 * Used for paginated room listings
 *
 * @interface PaginationDto
 */
export interface PaginationDto {
  /** Page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
}

// =============================================================================
// DOMAIN MODELS
// =============================================================================

/**
 * Room entity representing a hotel room
 * Matches Prisma Room model structure
 *
 * @interface Room
 */
export interface Room {
  /** Unique room identifier (UUID) */
  id: string;
  /** Unique room number */
  roomNumber: string;
  /** Room type/category */
  type: string;
  /** Price per night as string (Decimal from Prisma) */
  price: string;
  /** Current room status */
  status: RoomStatus;
  /** Record creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Paginated response for room listings
 * Includes data array and pagination metadata
 *
 * @interface PaginatedRoomsResponse
 */
export interface PaginatedRoomsResponse {
  /** Array of room entities */
  data: Room[];
  /** Pagination metadata */
  meta: PaginationMeta;
}

/**
 * Pagination metadata for paginated responses
 * Provides information about current page and total records
 *
 * @interface PaginationMeta
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of records matching filter */
  total: number;
  /** Total number of pages */
  totalPages: number;
}

// =============================================================================
// TYPE GUARDS - Runtime type checking
// =============================================================================

/**
 * Type guard to check if value is a valid RoomStatus
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is RoomStatus
 */
export function isRoomStatus(value: unknown): value is RoomStatus {
  return (
    typeof value === 'string' &&
    Object.values(RoomStatus).includes(value as RoomStatus)
  );
}

/**
 * Type guard to check if value is a valid RoomType
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is RoomType
 */
export function isRoomType(value: unknown): value is RoomType {
  return (
    typeof value === 'string' &&
    Object.values(RoomType).includes(value as RoomType)
  );
}

/**
 * Type guard to check if value is a valid CreateRoomDto
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is CreateRoomDto
 */
export function isCreateRoomDto(value: unknown): value is CreateRoomDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  return (
    typeof dto.roomNumber === 'string' &&
    typeof dto.type === 'string' &&
    typeof dto.price === 'number' &&
    isRoomStatus(dto.status)
  );
}

/**
 * Type guard to check if value is a valid UpdateRoomDto
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is UpdateRoomDto
 */
export function isUpdateRoomDto(value: unknown): value is UpdateRoomDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  // At least one field must be present
  const hasFields =
    dto.roomNumber !== undefined ||
    dto.type !== undefined ||
    dto.price !== undefined ||
    dto.status !== undefined;

  if (!hasFields) {
    return false;
  }

  // Validate present fields
  if (dto.roomNumber !== undefined && typeof dto.roomNumber !== 'string') {
    return false;
  }
  if (dto.type !== undefined && typeof dto.type !== 'string') {
    return false;
  }
  if (dto.price !== undefined && typeof dto.price !== 'number') {
    return false;
  }
  if (dto.status !== undefined && !isRoomStatus(dto.status)) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if value is a valid RoomFilterDto
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is RoomFilterDto
 */
export function isRoomFilterDto(value: unknown): value is RoomFilterDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const filter = value as Record<string, unknown>;

  // All fields are optional, but if present must be valid
  if (filter.type !== undefined && typeof filter.type !== 'string') {
    return false;
  }
  if (filter.status !== undefined && !isRoomStatus(filter.status)) {
    return false;
  }
  if (filter.minPrice !== undefined && typeof filter.minPrice !== 'number') {
    return false;
  }
  if (filter.maxPrice !== undefined && typeof filter.maxPrice !== 'number') {
    return false;
  }

  return true;
}

/**
 * Type guard to check if value is a valid PaginationDto
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is PaginationDto
 */
export function isPaginationDto(value: unknown): value is PaginationDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const pagination = value as Record<string, unknown>;

  return (
    typeof pagination.page === 'number' &&
    typeof pagination.limit === 'number' &&
    pagination.page > 0 &&
    pagination.limit > 0
  );
}

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

/**
 * Default pagination configuration
 * Used when pagination parameters are not provided
 */
export const DEFAULT_PAGINATION = {
  /** Default page number */
  page: 1,
  /** Default items per page */
  limit: 10,
  /** Maximum items per page */
  maxLimit: 100,
} as const;

/**
 * Room validation rules and constraints
 * Used for input validation across the application
 */
export const ROOM_VALIDATION = {
  /** Room number constraints */
  roomNumber: {
    minLength: 1,
    maxLength: 50,
    pattern: /^[A-Z0-9-]+$/i,
  },
  /** Price constraints */
  price: {
    min: 0.01,
    max: 999999.99,
    decimalPlaces: 2,
  },
} as const;

// =============================================================================
// PRISMA TYPE EXPORTS
// =============================================================================

/**
 * Prisma Room model payload type
 * Used for type-safe Prisma queries
 */
export type PrismaRoom = Prisma.RoomGetPayload<object>;

/**
 * Prisma Room create input type
 * Used for type-safe room creation
 */
export type PrismaRoomCreateInput = Prisma.RoomCreateInput;

/**
 * Prisma Room update input type
 * Used for type-safe room updates
 */
export type PrismaRoomUpdateInput = Prisma.RoomUpdateInput;

/**
 * Prisma Room where input type
 * Used for type-safe room queries
 */
export type PrismaRoomWhereInput = Prisma.RoomWhereInput;

/**
 * Prisma Room where unique input type
 * Used for type-safe unique room lookups
 */
export type PrismaRoomWhereUniqueInput = Prisma.RoomWhereUniqueInput;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  CreateRoomDto,
  UpdateRoomDto,
  RoomFilterDto,
  PaginationDto,
  Room,
  PaginatedRoomsResponse,
  PaginationMeta,
};