// =============================================================================
// ROOM TYPES - TYPE DEFINITIONS FOR ROOM MANAGEMENT
// =============================================================================
// This module defines TypeScript types and DTOs for room management operations
// including creation, updates, filtering, and pagination.
//
// Type Safety: All types are strictly typed with validation constraints
// Enums: RoomStatus and RoomType match Prisma schema exactly
// DTOs: Data Transfer Objects for API request/response handling
// =============================================================================

/**
 * Room status enumeration matching Prisma schema
 * Represents the current availability state of a room
 * 
 * @enum {string}
 * @readonly
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
 * Room type enumeration for categorization
 * Represents different room categories in the hotel
 * 
 * @enum {string}
 * @readonly
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

/**
 * Data Transfer Object for creating a new room
 * All fields are required for room creation
 * 
 * @interface CreateRoomDto
 * @property {string} roomNumber - Unique room identifier (e.g., "101", "A-205")
 * @property {RoomType} type - Category of the room
 * @property {number} price - Price per night (must be positive)
 * @property {RoomStatus} status - Initial availability status
 */
export interface CreateRoomDto {
  /** Unique room number for physical identification */
  roomNumber: string;
  
  /** Room category/type */
  type: RoomType;
  
  /** Price per night in decimal format (e.g., 99.99) */
  price: number;
  
  /** Initial room status (defaults to AVAILABLE) */
  status: RoomStatus;
}

/**
 * Data Transfer Object for updating an existing room
 * All fields are optional to support partial updates
 * 
 * @interface UpdateRoomDto
 * @property {string} [roomNumber] - Updated room number (must remain unique)
 * @property {RoomType} [type] - Updated room category
 * @property {number} [price] - Updated price per night
 * @property {RoomStatus} [status] - Updated availability status
 */
export interface UpdateRoomDto {
  /** Optional: Updated room number */
  roomNumber?: string;
  
  /** Optional: Updated room type */
  type?: RoomType;
  
  /** Optional: Updated price per night */
  price?: number;
  
  /** Optional: Updated room status */
  status?: RoomStatus;
}

/**
 * Data Transfer Object for filtering room queries
 * All fields are optional to support flexible filtering
 * 
 * @interface RoomFilterDto
 * @property {RoomType} [type] - Filter by room type
 * @property {RoomStatus} [status] - Filter by availability status
 * @property {number} [minPrice] - Minimum price per night (inclusive)
 * @property {number} [maxPrice] - Maximum price per night (inclusive)
 */
export interface RoomFilterDto {
  /** Optional: Filter by room type */
  type?: RoomType;
  
  /** Optional: Filter by room status */
  status?: RoomStatus;
  
  /** Optional: Minimum price filter (inclusive) */
  minPrice?: number;
  
  /** Optional: Maximum price filter (inclusive) */
  maxPrice?: number;
}

/**
 * Data Transfer Object for pagination parameters
 * Supports offset-based pagination for room listings
 * 
 * @interface PaginationDto
 * @property {number} [page] - Page number (1-indexed, defaults to 1)
 * @property {number} [limit] - Items per page (defaults to 10, max 100)
 */
export interface PaginationDto {
  /** Page number (1-indexed) */
  page?: number;
  
  /** Number of items per page */
  limit?: number;
}

/**
 * Complete room entity with all fields
 * Represents a room record from the database
 * 
 * @interface Room
 * @property {string} id - UUID primary key
 * @property {string} roomNumber - Unique room identifier
 * @property {RoomType} type - Room category
 * @property {number} price - Price per night
 * @property {RoomStatus} status - Current availability status
 * @property {Date} createdAt - Record creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
export interface Room {
  /** UUID primary key */
  id: string;
  
  /** Unique room number */
  roomNumber: string;
  
  /** Room type/category */
  type: RoomType;
  
  /** Price per night */
  price: number;
  
  /** Current room status */
  status: RoomStatus;
  
  /** Record creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Paginated response wrapper for room listings
 * Includes pagination metadata for client-side handling
 * 
 * @interface PaginatedRoomsResponse
 * @property {Room[]} data - Array of room records
 * @property {PaginationMeta} meta - Pagination metadata
 */
export interface PaginatedRoomsResponse {
  /** Array of room records for current page */
  data: Room[];
  
  /** Pagination metadata */
  meta: PaginationMeta;
}

/**
 * Pagination metadata for paginated responses
 * Provides information about current page and total records
 * 
 * @interface PaginationMeta
 * @property {number} page - Current page number (1-indexed)
 * @property {number} limit - Items per page
 * @property {number} total - Total number of records
 * @property {number} totalPages - Total number of pages
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  
  /** Items per page */
  limit: number;
  
  /** Total number of records */
  total: number;
  
  /** Total number of pages */
  totalPages: number;
}

/**
 * Type guard to check if a value is a valid RoomStatus
 * Used for runtime validation of room status values
 * 
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a valid RoomStatus
 */
export function isRoomStatus(value: unknown): value is RoomStatus {
  return (
    typeof value === 'string' &&
    Object.values(RoomStatus).includes(value as RoomStatus)
  );
}

/**
 * Type guard to check if a value is a valid RoomType
 * Used for runtime validation of room type values
 * 
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a valid RoomType
 */
export function isRoomType(value: unknown): value is RoomType {
  return (
    typeof value === 'string' &&
    Object.values(RoomType).includes(value as RoomType)
  );
}

/**
 * Type guard to validate CreateRoomDto structure
 * Ensures all required fields are present with correct types
 * 
 * @param {unknown} value - Value to validate
 * @returns {boolean} True if value is a valid CreateRoomDto
 */
export function isCreateRoomDto(value: unknown): value is CreateRoomDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  return (
    typeof dto.roomNumber === 'string' &&
    dto.roomNumber.length > 0 &&
    isRoomType(dto.type) &&
    typeof dto.price === 'number' &&
    dto.price > 0 &&
    isRoomStatus(dto.status)
  );
}

/**
 * Type guard to validate UpdateRoomDto structure
 * Ensures optional fields have correct types when present
 * 
 * @param {unknown} value - Value to validate
 * @returns {boolean} True if value is a valid UpdateRoomDto
 */
export function isUpdateRoomDto(value: unknown): value is UpdateRoomDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  // At least one field must be present
  if (Object.keys(dto).length === 0) {
    return false;
  }

  // Validate roomNumber if present
  if (dto.roomNumber !== undefined) {
    if (typeof dto.roomNumber !== 'string' || dto.roomNumber.length === 0) {
      return false;
    }
  }

  // Validate type if present
  if (dto.type !== undefined && !isRoomType(dto.type)) {
    return false;
  }

  // Validate price if present
  if (dto.price !== undefined) {
    if (typeof dto.price !== 'number' || dto.price <= 0) {
      return false;
    }
  }

  // Validate status if present
  if (dto.status !== undefined && !isRoomStatus(dto.status)) {
    return false;
  }

  return true;
}

/**
 * Type guard to validate RoomFilterDto structure
 * Ensures optional filter fields have correct types when present
 * 
 * @param {unknown} value - Value to validate
 * @returns {boolean} True if value is a valid RoomFilterDto
 */
export function isRoomFilterDto(value: unknown): value is RoomFilterDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  // Validate type if present
  if (dto.type !== undefined && !isRoomType(dto.type)) {
    return false;
  }

  // Validate status if present
  if (dto.status !== undefined && !isRoomStatus(dto.status)) {
    return false;
  }

  // Validate minPrice if present
  if (dto.minPrice !== undefined) {
    if (typeof dto.minPrice !== 'number' || dto.minPrice < 0) {
      return false;
    }
  }

  // Validate maxPrice if present
  if (dto.maxPrice !== undefined) {
    if (typeof dto.maxPrice !== 'number' || dto.maxPrice < 0) {
      return false;
    }
  }

  // Validate price range if both present
  if (
    dto.minPrice !== undefined &&
    dto.maxPrice !== undefined &&
    dto.minPrice > dto.maxPrice
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard to validate PaginationDto structure
 * Ensures pagination parameters are valid positive integers
 * 
 * @param {unknown} value - Value to validate
 * @returns {boolean} True if value is a valid PaginationDto
 */
export function isPaginationDto(value: unknown): value is PaginationDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;

  // Validate page if present
  if (dto.page !== undefined) {
    if (
      typeof dto.page !== 'number' ||
      !Number.isInteger(dto.page) ||
      dto.page < 1
    ) {
      return false;
    }
  }

  // Validate limit if present
  if (dto.limit !== undefined) {
    if (
      typeof dto.limit !== 'number' ||
      !Number.isInteger(dto.limit) ||
      dto.limit < 1 ||
      dto.limit > 100
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Default pagination values
 * Used when pagination parameters are not provided
 * 
 * @constant
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
 * Room validation constraints
 * Used for input validation across the application
 * 
 * @constant
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