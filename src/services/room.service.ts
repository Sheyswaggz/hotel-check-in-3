// =============================================================================
// ROOM SERVICE - BUSINESS LOGIC FOR ROOM MANAGEMENT
// =============================================================================
// This service implements all business logic for room operations including
// CRUD operations, filtering, pagination, and validation. It serves as the
// data access layer between controllers and the database.
//
// Architecture: Service layer pattern with dependency injection
// Error Handling: Custom error classes for specific failure scenarios
// Validation: Business rule validation with detailed error messages
// Logging: Structured logging for all operations with context
// =============================================================================

import { prisma } from '../config/database.js';
import type {
  CreateRoomDto,
  UpdateRoomDto,
  RoomFilterDto,
  PaginationDto,
  Room,
  PaginatedRoomsResponse,
  PaginationMeta,
} from '../types/room.types.js';
import { RoomStatus, DEFAULT_PAGINATION, ROOM_VALIDATION } from '../types/room.types.js';
import type { Prisma } from '@prisma/client';

// =============================================================================
// CUSTOM ERROR CLASSES - Specific error types for room operations
// =============================================================================

/**
 * Base error class for all room service errors
 * Provides consistent error handling across the service layer
 */
export class RoomServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RoomServiceError';
    Error.captureStackTrace(this, RoomServiceError);
  }
}

/**
 * Error thrown when a room is not found by ID
 * HTTP Status: 404 Not Found
 */
export class RoomNotFoundError extends RoomServiceError {
  constructor(roomId: string, cause?: unknown) {
    super(`Room with ID ${roomId} not found`, 'ROOM_NOT_FOUND', 404, cause);
    this.name = 'RoomNotFoundError';
  }
}

/**
 * Error thrown when attempting to create a room with duplicate room number
 * HTTP Status: 409 Conflict
 */
export class DuplicateRoomNumberError extends RoomServiceError {
  constructor(roomNumber: string, cause?: unknown) {
    super(
      `Room with number ${roomNumber} already exists`,
      'DUPLICATE_ROOM_NUMBER',
      409,
      cause
    );
    this.name = 'DuplicateRoomNumberError';
  }
}

/**
 * Error thrown when room data fails validation
 * HTTP Status: 400 Bad Request
 */
export class RoomValidationError extends RoomServiceError {
  constructor(
    message: string,
    public readonly validationErrors: Record<string, string>,
    cause?: unknown
  ) {
    super(message, 'ROOM_VALIDATION_ERROR', 400, cause);
    this.name = 'RoomValidationError';
  }
}

/**
 * Error thrown when database operations fail
 * HTTP Status: 500 Internal Server Error
 */
export class RoomDatabaseError extends RoomServiceError {
  constructor(operation: string, cause?: unknown) {
    super(
      `Database operation failed: ${operation}`,
      'ROOM_DATABASE_ERROR',
      500,
      cause
    );
    this.name = 'RoomDatabaseError';
  }
}

// =============================================================================
// ROOM SERVICE CLASS - Core business logic implementation
// =============================================================================

/**
 * Service class for room management operations
 * Implements business logic for CRUD operations with validation and error handling
 *
 * @class RoomService
 */
export class RoomService {
  /**
   * Validates room data against business rules
   * Throws RoomValidationError if validation fails
   *
   * @private
   * @param {Partial<CreateRoomDto>} data - Room data to validate
   * @throws {RoomValidationError} If validation fails
   */
  private validateRoomData(data: Partial<CreateRoomDto>): void {
    const errors: Record<string, string> = {};

    // Validate room number format and length
    if (data.roomNumber !== undefined) {
      if (data.roomNumber.length < ROOM_VALIDATION.roomNumber.minLength) {
        errors.roomNumber = `Room number must be at least ${ROOM_VALIDATION.roomNumber.minLength} character`;
      }
      if (data.roomNumber.length > ROOM_VALIDATION.roomNumber.maxLength) {
        errors.roomNumber = `Room number must not exceed ${ROOM_VALIDATION.roomNumber.maxLength} characters`;
      }
      if (!ROOM_VALIDATION.roomNumber.pattern.test(data.roomNumber)) {
        errors.roomNumber = 'Room number must contain only alphanumeric characters and hyphens';
      }
    }

    // Validate price range
    if (data.price !== undefined) {
      if (data.price < ROOM_VALIDATION.price.min) {
        errors.price = `Price must be at least ${ROOM_VALIDATION.price.min}`;
      }
      if (data.price > ROOM_VALIDATION.price.max) {
        errors.price = `Price must not exceed ${ROOM_VALIDATION.price.max}`;
      }
      // Validate decimal places
      const decimalPlaces = (data.price.toString().split('.')[1] ?? '').length;
      if (decimalPlaces > ROOM_VALIDATION.price.decimalPlaces) {
        errors.price = `Price must have at most ${ROOM_VALIDATION.price.decimalPlaces} decimal places`;
      }
    }

    // Validate room type is not empty
    if (data.type !== undefined && data.type.trim().length === 0) {
      errors.type = 'Room type cannot be empty';
    }

    // Throw validation error if any errors exist
    if (Object.keys(errors).length > 0) {
      throw new RoomValidationError('Room validation failed', errors);
    }
  }

  /**
   * Builds Prisma where clause from filter parameters
   * Supports filtering by type, status, and price range
   *
   * @private
   * @param {RoomFilterDto} filters - Filter parameters
   * @returns {Prisma.RoomWhereInput} Prisma where clause
   */
  private buildWhereClause(filters: RoomFilterDto): Prisma.RoomWhereInput {
    const where: Prisma.RoomWhereInput = {};

    // Filter by room type (case-insensitive)
    if (filters.type !== undefined) {
      where.type = {
        equals: filters.type,
        mode: 'insensitive',
      };
    }

    // Filter by room status
    if (filters.status !== undefined) {
      where.status = filters.status;
    }

    // Filter by price range
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }

    return where;
  }

  /**
   * Calculates pagination metadata
   *
   * @private
   * @param {number} total - Total number of records
   * @param {number} page - Current page number
   * @param {number} limit - Items per page
   * @returns {PaginationMeta} Pagination metadata
   */
  private calculatePaginationMeta(total: number, page: number, limit: number): PaginationMeta {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves all rooms with optional filtering and pagination
   * Supports filtering by type, status, and price range
   *
   * @param {RoomFilterDto} filters - Optional filter parameters
   * @param {PaginationDto} pagination - Optional pagination parameters
   * @returns {Promise<PaginatedRoomsResponse>} Paginated list of rooms
   * @throws {RoomDatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * const result = await roomService.getAllRooms(
   *   { status: RoomStatus.AVAILABLE, minPrice: 100 },
   *   { page: 1, limit: 10 }
   * );
   * ```
   */
  async getAllRooms(
    filters: RoomFilterDto = {},
    pagination: PaginationDto = {
      page: DEFAULT_PAGINATION.page,
      limit: DEFAULT_PAGINATION.limit,
    }
  ): Promise<PaginatedRoomsResponse> {
    try {
      // Validate and normalize pagination parameters
      const page = Math.max(1, pagination.page);
      const limit = Math.min(
        Math.max(1, pagination.limit),
        DEFAULT_PAGINATION.maxLimit
      );
      const skip = (page - 1) * limit;

      // Build where clause from filters
      const where = this.buildWhereClause(filters);

      // Log operation with context
      console.log('Fetching rooms with filters:', {
        filters,
        pagination: { page, limit, skip },
        timestamp: new Date().toISOString(),
      });

      // Execute parallel queries for data and count
      const [rooms, total] = await Promise.all([
        prisma.room.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ roomNumber: 'asc' }],
        }),
        prisma.room.count({ where }),
      ]);

      // Convert Prisma Decimal to string for price
      const roomsWithStringPrice: Room[] = rooms.map((room) => ({
        ...room,
        price: room.price.toString(),
      }));

      // Calculate pagination metadata
      const meta = this.calculatePaginationMeta(total, page, limit);

      console.log('Rooms fetched successfully:', {
        count: rooms.length,
        total,
        page,
        timestamp: new Date().toISOString(),
      });

      return {
        data: roomsWithStringPrice,
        meta,
      };
    } catch (error) {
      console.error('Failed to fetch rooms:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
        timestamp: new Date().toISOString(),
      });
      throw new RoomDatabaseError('fetch rooms', error);
    }
  }

  /**
   * Retrieves a single room by ID
   *
   * @param {string} id - Room UUID
   * @returns {Promise<Room>} Room entity
   * @throws {RoomNotFoundError} If room does not exist
   * @throws {RoomDatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * const room = await roomService.getRoomById('123e4567-e89b-12d3-a456-426614174000');
   * ```
   */
  async getRoomById(id: string): Promise<Room> {
    try {
      console.log('Fetching room by ID:', {
        roomId: id,
        timestamp: new Date().toISOString(),
      });

      const room = await prisma.room.findUnique({
        where: { id },
      });

      if (room === null) {
        console.warn('Room not found:', {
          roomId: id,
          timestamp: new Date().toISOString(),
        });
        throw new RoomNotFoundError(id);
      }

      console.log('Room fetched successfully:', {
        roomId: id,
        roomNumber: room.roomNumber,
        timestamp: new Date().toISOString(),
      });

      return {
        ...room,
        price: room.price.toString(),
      };
    } catch (error) {
      if (error instanceof RoomNotFoundError) {
        throw error;
      }
      console.error('Failed to fetch room by ID:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomId: id,
        timestamp: new Date().toISOString(),
      });
      throw new RoomDatabaseError('fetch room by ID', error);
    }
  }

  /**
   * Creates a new room with validation and uniqueness check
   * Validates room data and ensures room number is unique
   *
   * @param {CreateRoomDto} data - Room creation data
   * @returns {Promise<Room>} Created room entity
   * @throws {RoomValidationError} If validation fails
   * @throws {DuplicateRoomNumberError} If room number already exists
   * @throws {RoomDatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * const room = await roomService.createRoom({
   *   roomNumber: '101',
   *   type: 'DELUXE',
   *   price: 150.00,
   *   status: RoomStatus.AVAILABLE
   * });
   * ```
   */
  async createRoom(data: CreateRoomDto): Promise<Room> {
    try {
      // Validate room data
      this.validateRoomData(data);

      console.log('Creating room:', {
        roomNumber: data.roomNumber,
        type: data.type,
        timestamp: new Date().toISOString(),
      });

      // Check for duplicate room number
      const existingRoom = await prisma.room.findUnique({
        where: { roomNumber: data.roomNumber },
      });

      if (existingRoom !== null) {
        console.warn('Duplicate room number detected:', {
          roomNumber: data.roomNumber,
          timestamp: new Date().toISOString(),
        });
        throw new DuplicateRoomNumberError(data.roomNumber);
      }

      // Create room
      const room = await prisma.room.create({
        data: {
          roomNumber: data.roomNumber,
          type: data.type,
          price: data.price,
          status: data.status,
        },
      });

      console.log('Room created successfully:', {
        roomId: room.id,
        roomNumber: room.roomNumber,
        timestamp: new Date().toISOString(),
      });

      return {
        ...room,
        price: room.price.toString(),
      };
    } catch (error) {
      if (
        error instanceof RoomValidationError ||
        error instanceof DuplicateRoomNumberError
      ) {
        throw error;
      }
      console.error('Failed to create room:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomNumber: data.roomNumber,
        timestamp: new Date().toISOString(),
      });
      throw new RoomDatabaseError('create room', error);
    }
  }

  /**
   * Updates an existing room with validation
   * Supports partial updates with uniqueness check for room number
   *
   * @param {string} id - Room UUID
   * @param {UpdateRoomDto} data - Room update data
   * @returns {Promise<Room>} Updated room entity
   * @throws {RoomNotFoundError} If room does not exist
   * @throws {RoomValidationError} If validation fails
   * @throws {DuplicateRoomNumberError} If room number already exists
   * @throws {RoomDatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * const room = await roomService.updateRoom('123e4567-e89b-12d3-a456-426614174000', {
   *   price: 175.00,
   *   status: RoomStatus.MAINTENANCE
   * });
   * ```
   */
  async updateRoom(id: string, data: UpdateRoomDto): Promise<Room> {
    try {
      // Validate room data
      this.validateRoomData(data);

      console.log('Updating room:', {
        roomId: id,
        updates: Object.keys(data),
        timestamp: new Date().toISOString(),
      });

      // Check if room exists
      const existingRoom = await prisma.room.findUnique({
        where: { id },
      });

      if (existingRoom === null) {
        console.warn('Room not found for update:', {
          roomId: id,
          timestamp: new Date().toISOString(),
        });
        throw new RoomNotFoundError(id);
      }

      // Check for duplicate room number if updating room number
      if (data.roomNumber !== undefined && data.roomNumber !== existingRoom.roomNumber) {
        const duplicateRoom = await prisma.room.findUnique({
          where: { roomNumber: data.roomNumber },
        });

        if (duplicateRoom !== null) {
          console.warn('Duplicate room number detected during update:', {
            roomNumber: data.roomNumber,
            timestamp: new Date().toISOString(),
          });
          throw new DuplicateRoomNumberError(data.roomNumber);
        }
      }

      // Update room
      const room = await prisma.room.update({
        where: { id },
        data: {
          ...(data.roomNumber !== undefined && { roomNumber: data.roomNumber }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.status !== undefined && { status: data.status }),
        },
      });

      console.log('Room updated successfully:', {
        roomId: id,
        roomNumber: room.roomNumber,
        timestamp: new Date().toISOString(),
      });

      return {
        ...room,
        price: room.price.toString(),
      };
    } catch (error) {
      if (
        error instanceof RoomNotFoundError ||
        error instanceof RoomValidationError ||
        error instanceof DuplicateRoomNumberError
      ) {
        throw error;
      }
      console.error('Failed to update room:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomId: id,
        timestamp: new Date().toISOString(),
      });
      throw new RoomDatabaseError('update room', error);
    }
  }

  /**
   * Deletes a room by ID with cascade handling
   * Automatically deletes associated reservations via Prisma cascade
   *
   * @param {string} id - Room UUID
   * @returns {Promise<void>}
   * @throws {RoomNotFoundError} If room does not exist
   * @throws {RoomDatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * await roomService.deleteRoom('123e4567-e89b-12d3-a456-426614174000');
   * ```
   */
  async deleteRoom(id: string): Promise<void> {
    try {
      console.log('Deleting room:', {
        roomId: id,
        timestamp: new Date().toISOString(),
      });

      // Check if room exists
      const existingRoom = await prisma.room.findUnique({
        where: { id },
      });

      if (existingRoom === null) {
        console.warn('Room not found for deletion:', {
          roomId: id,
          timestamp: new Date().toISOString(),
        });
        throw new RoomNotFoundError(id);
      }

      // Delete room (cascade deletes reservations)
      await prisma.room.delete({
        where: { id },
      });

      console.log('Room deleted successfully:', {
        roomId: id,
        roomNumber: existingRoom.roomNumber,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof RoomNotFoundError) {
        throw error;
      }
      console.error('Failed to delete room:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomId: id,
        timestamp: new Date().toISOString(),
      });
      throw new RoomDatabaseError('delete room', error);
    }
  }
}

// =============================================================================
// SERVICE INSTANCE EXPORT - Singleton pattern
// =============================================================================

/**
 * Singleton instance of RoomService
 * Use this instance throughout the application for consistency
 *
 * @example
 * ```typescript
 * import { roomService } from './services/room.service.js';
 * const rooms = await roomService.getAllRooms();
 * ```
 */
export const roomService = new RoomService();

// =============================================================================
// TYPE EXPORTS - Export error classes for use in other modules
// =============================================================================

export {
  RoomServiceError,
  RoomNotFoundError,
  DuplicateRoomNumberError,
  RoomValidationError,
  RoomDatabaseError,
};