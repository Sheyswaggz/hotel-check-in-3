// =============================================================================
// ROOM SERVICE - BUSINESS LOGIC FOR ROOM MANAGEMENT
// =============================================================================
// This service implements the business logic layer for room CRUD operations
// including validation, error handling, and database interactions.
//
// Architecture: Service layer pattern with dependency injection
// Error Handling: Custom errors with detailed context
// Logging: Structured logging for all operations
// Validation: Input validation and business rule enforcement
// =============================================================================

import { prisma } from '../config/database.js';
import type {
  Room,
  CreateRoomDto,
  UpdateRoomDto,
  RoomFilterDto,
  PaginationDto,
  PaginatedRoomsResponse,
  PaginationMeta,
} from '../types/room.types.js';
import { RoomStatus, RoomType } from '../types/room.types.js';
import type { Prisma } from '@prisma/client';

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Base error class for room service operations
 * Provides structured error handling with context
 */
class RoomServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RoomServiceError';
    Error.captureStackTrace(this, RoomServiceError);
  }
}

/**
 * Error thrown when a room is not found
 */
class RoomNotFoundError extends RoomServiceError {
  constructor(roomId: string) {
    super(
      `Room with ID ${roomId} not found`,
      'ROOM_NOT_FOUND',
      404,
      { roomId }
    );
    this.name = 'RoomNotFoundError';
  }
}

/**
 * Error thrown when attempting to create a room with duplicate room number
 */
class DuplicateRoomNumberError extends RoomServiceError {
  constructor(roomNumber: string) {
    super(
      `Room with number ${roomNumber} already exists`,
      'DUPLICATE_ROOM_NUMBER',
      409,
      { roomNumber }
    );
    this.name = 'DuplicateRoomNumberError';
  }
}

/**
 * Error thrown when room validation fails
 */
class RoomValidationError extends RoomServiceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'ROOM_VALIDATION_ERROR', 400, context);
    this.name = 'RoomValidationError';
  }
}

/**
 * Error thrown when database operations fail
 */
class RoomDatabaseError extends RoomServiceError {
  constructor(message: string, cause?: unknown) {
    super(
      message,
      'ROOM_DATABASE_ERROR',
      500,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
    this.name = 'RoomDatabaseError';
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default pagination values
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Room validation constraints
 */
const VALIDATION_CONSTRAINTS = {
  roomNumber: {
    minLength: 1,
    maxLength: 50,
    pattern: /^[A-Z0-9-]+$/i,
  },
  price: {
    min: 0.01,
    max: 999999.99,
  },
} as const;

// =============================================================================
// ROOM SERVICE CLASS
// =============================================================================

/**
 * Service class for room management operations
 * Implements business logic for CRUD operations with validation and error handling
 */
export class RoomService {
  /**
   * Retrieves a paginated list of rooms with optional filtering
   *
   * @param filters - Optional filters for room type, status, and price range
   * @param pagination - Pagination parameters (page and limit)
   * @returns Promise resolving to paginated rooms response
   * @throws {RoomValidationError} If pagination or filter parameters are invalid
   * @throws {RoomDatabaseError} If database query fails
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
    filters?: RoomFilterDto,
    pagination?: PaginationDto
  ): Promise<PaginatedRoomsResponse> {
    const startTime = Date.now();

    try {
      // Validate and normalize pagination parameters
      const page = Math.max(pagination?.page ?? DEFAULT_PAGE, 1);
      const limit = Math.min(
        Math.max(pagination?.limit ?? DEFAULT_LIMIT, 1),
        MAX_LIMIT
      );
      const skip = (page - 1) * limit;

      // Validate filter parameters
      this.validateFilters(filters);

      // Build Prisma where clause from filters
      const where = this.buildWhereClause(filters);

      // Log query operation
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

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const meta: PaginationMeta = {
        page,
        limit,
        total,
        totalPages,
      };

      // Transform Prisma results to Room type
      const data: Room[] = rooms.map((room) => ({
        id: room.id,
        roomNumber: room.roomNumber,
        type: room.type as RoomType,
        price: Number(room.price),
        status: room.status as RoomStatus,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      }));

      const duration = Date.now() - startTime;
      console.log('Rooms fetched successfully:', {
        count: data.length,
        total,
        page,
        durationMs: duration,
      });

      return { data, meta };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Failed to fetch rooms:', {
        error: error instanceof Error ? error.message : String(error),
        filters,
        pagination,
        durationMs: duration,
      });

      if (error instanceof RoomServiceError) {
        throw error;
      }

      throw new RoomDatabaseError(
        'Failed to retrieve rooms from database',
        error
      );
    }
  }

  /**
   * Retrieves a single room by ID
   *
   * @param id - UUID of the room to retrieve
   * @returns Promise resolving to room details
   * @throws {RoomValidationError} If room ID is invalid
   * @throws {RoomNotFoundError} If room does not exist
   * @throws {RoomDatabaseError} If database query fails
   *
   * @example
   * ```typescript
   * const room = await roomService.getRoomById('123e4567-e89b-12d3-a456-426614174000');
   * ```
   */
  async getRoomById(id: string): Promise<Room> {
    const startTime = Date.now();

    try {
      // Validate room ID format
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw new RoomValidationError('Invalid room ID format', { id });
      }

      console.log('Fetching room by ID:', {
        roomId: id,
        timestamp: new Date().toISOString(),
      });

      // Query room by ID
      const room = await prisma.room.findUnique({
        where: { id },
      });

      // Handle room not found
      if (room === null) {
        throw new RoomNotFoundError(id);
      }

      // Transform Prisma result to Room type
      const result: Room = {
        id: room.id,
        roomNumber: room.roomNumber,
        type: room.type as RoomType,
        price: Number(room.price),
        status: room.status as RoomStatus,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      };

      const duration = Date.now() - startTime;
      console.log('Room fetched successfully:', {
        roomId: id,
        roomNumber: result.roomNumber,
        durationMs: duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Failed to fetch room by ID:', {
        error: error instanceof Error ? error.message : String(error),
        roomId: id,
        durationMs: duration,
      });

      if (error instanceof RoomServiceError) {
        throw error;
      }

      throw new RoomDatabaseError('Failed to retrieve room from database', error);
    }
  }

  /**
   * Creates a new room with validation and uniqueness check
   *
   * @param data - Room creation data
   * @returns Promise resolving to created room
   * @throws {RoomValidationError} If room data is invalid
   * @throws {DuplicateRoomNumberError} If room number already exists
   * @throws {RoomDatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * const room = await roomService.createRoom({
   *   roomNumber: '101',
   *   type: RoomType.DELUXE,
   *   price: 150.00,
   *   status: RoomStatus.AVAILABLE
   * });
   * ```
   */
  async createRoom(data: CreateRoomDto): Promise<Room> {
    const startTime = Date.now();

    try {
      // Validate room data
      this.validateCreateRoomData(data);

      console.log('Creating new room:', {
        roomNumber: data.roomNumber,
        type: data.type,
        timestamp: new Date().toISOString(),
      });

      // Check for duplicate room number
      const existingRoom = await prisma.room.findUnique({
        where: { roomNumber: data.roomNumber },
      });

      if (existingRoom !== null) {
        throw new DuplicateRoomNumberError(data.roomNumber);
      }

      // Create room in database
      const room = await prisma.room.create({
        data: {
          roomNumber: data.roomNumber,
          type: data.type,
          price: data.price,
          status: data.status,
        },
      });

      // Transform Prisma result to Room type
      const result: Room = {
        id: room.id,
        roomNumber: room.roomNumber,
        type: room.type as RoomType,
        price: Number(room.price),
        status: room.status as RoomStatus,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      };

      const duration = Date.now() - startTime;
      console.log('Room created successfully:', {
        roomId: result.id,
        roomNumber: result.roomNumber,
        durationMs: duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Failed to create room:', {
        error: error instanceof Error ? error.message : String(error),
        roomNumber: data.roomNumber,
        durationMs: duration,
      });

      if (error instanceof RoomServiceError) {
        throw error;
      }

      // Handle Prisma unique constraint violation
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new DuplicateRoomNumberError(data.roomNumber);
      }

      throw new RoomDatabaseError('Failed to create room in database', error);
    }
  }

  /**
   * Updates an existing room with validation
   *
   * @param id - UUID of the room to update
   * @param data - Partial room data to update
   * @returns Promise resolving to updated room
   * @throws {RoomValidationError} If update data is invalid
   * @throws {RoomNotFoundError} If room does not exist
   * @throws {DuplicateRoomNumberError} If updated room number already exists
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
    const startTime = Date.now();

    try {
      // Validate room ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw new RoomValidationError('Invalid room ID format', { id });
      }

      // Validate update data
      this.validateUpdateRoomData(data);

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
        throw new RoomNotFoundError(id);
      }

      // Check for duplicate room number if updating room number
      if (data.roomNumber !== undefined && data.roomNumber !== existingRoom.roomNumber) {
        const duplicateRoom = await prisma.room.findUnique({
          where: { roomNumber: data.roomNumber },
        });

        if (duplicateRoom !== null) {
          throw new DuplicateRoomNumberError(data.roomNumber);
        }
      }

      // Update room in database
      const room = await prisma.room.update({
        where: { id },
        data: {
          ...(data.roomNumber !== undefined && { roomNumber: data.roomNumber }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.status !== undefined && { status: data.status }),
        },
      });

      // Transform Prisma result to Room type
      const result: Room = {
        id: room.id,
        roomNumber: room.roomNumber,
        type: room.type as RoomType,
        price: Number(room.price),
        status: room.status as RoomStatus,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      };

      const duration = Date.now() - startTime;
      console.log('Room updated successfully:', {
        roomId: id,
        roomNumber: result.roomNumber,
        durationMs: duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Failed to update room:', {
        error: error instanceof Error ? error.message : String(error),
        roomId: id,
        durationMs: duration,
      });

      if (error instanceof RoomServiceError) {
        throw error;
      }

      // Handle Prisma unique constraint violation
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new DuplicateRoomNumberError(data.roomNumber ?? 'unknown');
      }

      throw new RoomDatabaseError('Failed to update room in database', error);
    }
  }

  /**
   * Deletes a room by ID with cascade handling
   *
   * @param id - UUID of the room to delete
   * @returns Promise resolving when deletion is complete
   * @throws {RoomValidationError} If room ID is invalid
   * @throws {RoomNotFoundError} If room does not exist
   * @throws {RoomDatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * await roomService.deleteRoom('123e4567-e89b-12d3-a456-426614174000');
   * ```
   */
  async deleteRoom(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate room ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw new RoomValidationError('Invalid room ID format', { id });
      }

      console.log('Deleting room:', {
        roomId: id,
        timestamp: new Date().toISOString(),
      });

      // Check if room exists
      const existingRoom = await prisma.room.findUnique({
        where: { id },
      });

      if (existingRoom === null) {
        throw new RoomNotFoundError(id);
      }

      // Delete room (cascade will handle related reservations)
      await prisma.room.delete({
        where: { id },
      });

      const duration = Date.now() - startTime;
      console.log('Room deleted successfully:', {
        roomId: id,
        roomNumber: existingRoom.roomNumber,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Failed to delete room:', {
        error: error instanceof Error ? error.message : String(error),
        roomId: id,
        durationMs: duration,
      });

      if (error instanceof RoomServiceError) {
        throw error;
      }

      throw new RoomDatabaseError('Failed to delete room from database', error);
    }
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  /**
   * Builds Prisma where clause from filter parameters
   *
   * @param filters - Optional room filters
   * @returns Prisma where clause object
   */
  private buildWhereClause(filters?: RoomFilterDto): Prisma.RoomWhereInput {
    if (filters === undefined) {
      return {};
    }

    const where: Prisma.RoomWhereInput = {};

    // Filter by room type
    if (filters.type !== undefined) {
      where.type = filters.type;
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
   * Validates filter parameters
   *
   * @param filters - Optional room filters
   * @throws {RoomValidationError} If filters are invalid
   */
  private validateFilters(filters?: RoomFilterDto): void {
    if (filters === undefined) {
      return;
    }

    // Validate room type
    if (filters.type !== undefined && !Object.values(RoomType).includes(filters.type)) {
      throw new RoomValidationError('Invalid room type', { type: filters.type });
    }

    // Validate room status
    if (filters.status !== undefined && !Object.values(RoomStatus).includes(filters.status)) {
      throw new RoomValidationError('Invalid room status', { status: filters.status });
    }

    // Validate price range
    if (filters.minPrice !== undefined && filters.minPrice < 0) {
      throw new RoomValidationError('Minimum price cannot be negative', {
        minPrice: filters.minPrice,
      });
    }

    if (filters.maxPrice !== undefined && filters.maxPrice < 0) {
      throw new RoomValidationError('Maximum price cannot be negative', {
        maxPrice: filters.maxPrice,
      });
    }

    if (
      filters.minPrice !== undefined &&
      filters.maxPrice !== undefined &&
      filters.minPrice > filters.maxPrice
    ) {
      throw new RoomValidationError('Minimum price cannot exceed maximum price', {
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
      });
    }
  }

  /**
   * Validates room creation data
   *
   * @param data - Room creation data
   * @throws {RoomValidationError} If data is invalid
   */
  private validateCreateRoomData(data: CreateRoomDto): void {
    // Validate room number
    if (!data.roomNumber || typeof data.roomNumber !== 'string') {
      throw new RoomValidationError('Room number is required and must be a string');
    }

    const trimmedRoomNumber = data.roomNumber.trim();
    if (
      trimmedRoomNumber.length < VALIDATION_CONSTRAINTS.roomNumber.minLength ||
      trimmedRoomNumber.length > VALIDATION_CONSTRAINTS.roomNumber.maxLength
    ) {
      throw new RoomValidationError(
        `Room number must be between ${VALIDATION_CONSTRAINTS.roomNumber.minLength} and ${VALIDATION_CONSTRAINTS.roomNumber.maxLength} characters`,
        { roomNumber: data.roomNumber }
      );
    }

    if (!VALIDATION_CONSTRAINTS.roomNumber.pattern.test(trimmedRoomNumber)) {
      throw new RoomValidationError(
        'Room number must contain only alphanumeric characters and hyphens',
        { roomNumber: data.roomNumber }
      );
    }

    // Validate room type
    if (!Object.values(RoomType).includes(data.type)) {
      throw new RoomValidationError('Invalid room type', { type: data.type });
    }

    // Validate price
    if (typeof data.price !== 'number' || isNaN(data.price)) {
      throw new RoomValidationError('Price must be a valid number', { price: data.price });
    }

    if (
      data.price < VALIDATION_CONSTRAINTS.price.min ||
      data.price > VALIDATION_CONSTRAINTS.price.max
    ) {
      throw new RoomValidationError(
        `Price must be between ${VALIDATION_CONSTRAINTS.price.min} and ${VALIDATION_CONSTRAINTS.price.max}`,
        { price: data.price }
      );
    }

    // Validate room status
    if (!Object.values(RoomStatus).includes(data.status)) {
      throw new RoomValidationError('Invalid room status', { status: data.status });
    }
  }

  /**
   * Validates room update data
   *
   * @param data - Room update data
   * @throws {RoomValidationError} If data is invalid
   */
  private validateUpdateRoomData(data: UpdateRoomDto): void {
    // Ensure at least one field is provided
    if (Object.keys(data).length === 0) {
      throw new RoomValidationError('At least one field must be provided for update');
    }

    // Validate room number if provided
    if (data.roomNumber !== undefined) {
      if (typeof data.roomNumber !== 'string') {
        throw new RoomValidationError('Room number must be a string');
      }

      const trimmedRoomNumber = data.roomNumber.trim();
      if (
        trimmedRoomNumber.length < VALIDATION_CONSTRAINTS.roomNumber.minLength ||
        trimmedRoomNumber.length > VALIDATION_CONSTRAINTS.roomNumber.maxLength
      ) {
        throw new RoomValidationError(
          `Room number must be between ${VALIDATION_CONSTRAINTS.roomNumber.minLength} and ${VALIDATION_CONSTRAINTS.roomNumber.maxLength} characters`,
          { roomNumber: data.roomNumber }
        );
      }

      if (!VALIDATION_CONSTRAINTS.roomNumber.pattern.test(trimmedRoomNumber)) {
        throw new RoomValidationError(
          'Room number must contain only alphanumeric characters and hyphens',
          { roomNumber: data.roomNumber }
        );
      }
    }

    // Validate room type if provided
    if (data.type !== undefined && !Object.values(RoomType).includes(data.type)) {
      throw new RoomValidationError('Invalid room type', { type: data.type });
    }

    // Validate price if provided
    if (data.price !== undefined) {
      if (typeof data.price !== 'number' || isNaN(data.price)) {
        throw new RoomValidationError('Price must be a valid number', { price: data.price });
      }

      if (
        data.price < VALIDATION_CONSTRAINTS.price.min ||
        data.price > VALIDATION_CONSTRAINTS.price.max
      ) {
        throw new RoomValidationError(
          `Price must be between ${VALIDATION_CONSTRAINTS.price.min} and ${VALIDATION_CONSTRAINTS.price.max}`,
          { price: data.price }
        );
      }
    }

    // Validate room status if provided
    if (data.status !== undefined && !Object.values(RoomStatus).includes(data.status)) {
      throw new RoomValidationError('Invalid room status', { status: data.status });
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Singleton instance of RoomService
 * Use this instance throughout the application for consistency
 */
export const roomService = new RoomService();

/**
 * Export error classes for error handling in controllers
 */
export {
  RoomServiceError,
  RoomNotFoundError,
  DuplicateRoomNumberError,
  RoomValidationError,
  RoomDatabaseError,
};