// =============================================================================
// ROOM CONTROLLER - REQUEST HANDLERS FOR ROOM MANAGEMENT
// =============================================================================
// This controller implements HTTP request handlers for room CRUD operations.
// It serves as the presentation layer, handling request/response transformation,
// delegating business logic to the room service, and managing HTTP status codes.
//
// Architecture: Controller layer pattern with service delegation
// Error Handling: Centralized error handling with appropriate HTTP status codes
// Authorization: Admin-only operations enforced via middleware
// Validation: Input validation handled by express-validator middleware
// Logging: Structured logging for all operations with request context
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { roomService } from '../services/room.service.js';
import type {
  CreateRoomDto,
  UpdateRoomDto,
  RoomFilterDto,
  PaginationDto,
} from '../types/room.types.js';
import { RoomStatus, DEFAULT_PAGINATION } from '../types/room.types.js';
import {
  RoomNotFoundError,
  DuplicateRoomNumberError,
  RoomValidationError,
  RoomDatabaseError,
} from '../services/room.service.js';

// =============================================================================
// HELPER FUNCTIONS - Request parsing and validation
// =============================================================================

/**
 * Parses and validates filter parameters from query string
 * Converts string values to appropriate types with validation
 *
 * @private
 * @param {Request} req - Express request object
 * @returns {RoomFilterDto} Parsed filter parameters
 */
function parseFilters(req: Request): RoomFilterDto {
  const filters: RoomFilterDto = {};

  // Parse room type filter (case-insensitive)
  if (typeof req.query.type === 'string' && req.query.type.trim().length > 0) {
    filters.type = req.query.type.trim();
  }

  // Parse room status filter with validation
  if (typeof req.query.status === 'string') {
    const status = req.query.status.toUpperCase();
    if (Object.values(RoomStatus).includes(status as RoomStatus)) {
      filters.status = status as RoomStatus;
    }
  }

  // Parse minimum price filter with validation
  if (typeof req.query.minPrice === 'string') {
    const minPrice = parseFloat(req.query.minPrice);
    if (!isNaN(minPrice) && minPrice >= 0) {
      filters.minPrice = minPrice;
    }
  }

  // Parse maximum price filter with validation
  if (typeof req.query.maxPrice === 'string') {
    const maxPrice = parseFloat(req.query.maxPrice);
    if (!isNaN(maxPrice) && maxPrice >= 0) {
      filters.maxPrice = maxPrice;
    }
  }

  return filters;
}

/**
 * Parses and validates pagination parameters from query string
 * Applies default values and enforces limits
 *
 * @private
 * @param {Request} req - Express request object
 * @returns {PaginationDto} Parsed pagination parameters
 */
function parsePagination(req: Request): PaginationDto {
  let page = DEFAULT_PAGINATION.page;
  let limit = DEFAULT_PAGINATION.limit;

  // Parse page number with validation
  if (typeof req.query.page === 'string') {
    const parsedPage = parseInt(req.query.page, 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  // Parse limit with validation and max limit enforcement
  if (typeof req.query.limit === 'string') {
    const parsedLimit = parseInt(req.query.limit, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, DEFAULT_PAGINATION.maxLimit);
    }
  }

  return { page, limit };
}

/**
 * Handles service errors and sends appropriate HTTP responses
 * Maps service errors to HTTP status codes with error details
 *
 * @private
 * @param {unknown} error - Error object from service layer
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
function handleServiceError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof RoomNotFoundError) {
    res.status(404).json({
      error: 'Not Found',
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof DuplicateRoomNumberError) {
    res.status(409).json({
      error: 'Conflict',
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof RoomValidationError) {
    res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      code: error.code,
      validationErrors: error.validationErrors,
    });
    return;
  }

  if (error instanceof RoomDatabaseError) {
    console.error('Database error in room controller:', {
      error: error.message,
      cause: error.cause,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while processing your request',
      code: error.code,
    });
    return;
  }

  // Pass unknown errors to Express error handler
  next(error);
}

// =============================================================================
// CONTROLLER HANDLERS - HTTP request handlers
// =============================================================================

/**
 * GET /api/rooms - Retrieves paginated list of rooms with optional filtering
 * Supports filtering by type, status, and price range
 * Supports pagination with page and limit parameters
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 *
 * @example
 * GET /api/rooms?type=DELUXE&status=AVAILABLE&minPrice=100&maxPrice=200&page=1&limit=10
 *
 * Response 200:
 * {
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "roomNumber": "101",
 *       "type": "DELUXE",
 *       "price": "150.00",
 *       "status": "AVAILABLE",
 *       "createdAt": "2024-01-01T00:00:00.000Z",
 *       "updatedAt": "2024-01-01T00:00:00.000Z"
 *     }
 *   ],
 *   "meta": {
 *     "page": 1,
 *     "limit": 10,
 *     "total": 50,
 *     "totalPages": 5
 *   }
 * }
 */
export async function getAllRooms(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    console.log('GET /api/rooms - Fetching rooms:', {
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    // Parse query parameters
    const filters = parseFilters(req);
    const pagination = parsePagination(req);

    // Fetch rooms from service
    const result = await roomService.getAllRooms(filters, pagination);

    console.log('GET /api/rooms - Rooms fetched successfully:', {
      count: result.data.length,
      total: result.meta.total,
      page: result.meta.page,
      timestamp: new Date().toISOString(),
    });

    // Send successful response
    res.status(200).json(result);
  } catch (error) {
    console.error('GET /api/rooms - Error fetching rooms:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query,
      timestamp: new Date().toISOString(),
    });
    handleServiceError(error, res, next);
  }
}

/**
 * GET /api/rooms/:id - Retrieves a single room by ID
 *
 * @param {Request} req - Express request object with room ID in params
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 *
 * @example
 * GET /api/rooms/123e4567-e89b-12d3-a456-426614174000
 *
 * Response 200:
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "roomNumber": "101",
 *   "type": "DELUXE",
 *   "price": "150.00",
 *   "status": "AVAILABLE",
 *   "createdAt": "2024-01-01T00:00:00.000Z",
 *   "updatedAt": "2024-01-01T00:00:00.000Z"
 * }
 *
 * Response 404:
 * {
 *   "error": "Not Found",
 *   "message": "Room with ID 123e4567-e89b-12d3-a456-426614174000 not found",
 *   "code": "ROOM_NOT_FOUND"
 * }
 */
export async function getRoomById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    console.log('GET /api/rooms/:id - Fetching room:', {
      roomId: id,
      timestamp: new Date().toISOString(),
    });

    // Fetch room from service
    const room = await roomService.getRoomById(id);

    console.log('GET /api/rooms/:id - Room fetched successfully:', {
      roomId: id,
      roomNumber: room.roomNumber,
      timestamp: new Date().toISOString(),
    });

    // Send successful response
    res.status(200).json(room);
  } catch (error) {
    console.error('GET /api/rooms/:id - Error fetching room:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      roomId: req.params.id,
      timestamp: new Date().toISOString(),
    });
    handleServiceError(error, res, next);
  }
}

/**
 * POST /api/rooms - Creates a new room (admin only)
 * Validates room data and ensures room number uniqueness
 *
 * @param {Request} req - Express request object with room data in body
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 *
 * @example
 * POST /api/rooms
 * Body:
 * {
 *   "roomNumber": "101",
 *   "type": "DELUXE",
 *   "price": 150.00,
 *   "status": "AVAILABLE"
 * }
 *
 * Response 201:
 * {
 *   "id": "uuid",
 *   "roomNumber": "101",
 *   "type": "DELUXE",
 *   "price": "150.00",
 *   "status": "AVAILABLE",
 *   "createdAt": "2024-01-01T00:00:00.000Z",
 *   "updatedAt": "2024-01-01T00:00:00.000Z"
 * }
 *
 * Response 409:
 * {
 *   "error": "Conflict",
 *   "message": "Room with number 101 already exists",
 *   "code": "DUPLICATE_ROOM_NUMBER"
 * }
 */
export async function createRoom(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const roomData: CreateRoomDto = {
      roomNumber: req.body.roomNumber as string,
      type: req.body.type as string,
      price: req.body.price as number,
      status: req.body.status as RoomStatus,
    };

    console.log('POST /api/rooms - Creating room:', {
      roomNumber: roomData.roomNumber,
      type: roomData.type,
      timestamp: new Date().toISOString(),
    });

    // Create room via service
    const room = await roomService.createRoom(roomData);

    console.log('POST /api/rooms - Room created successfully:', {
      roomId: room.id,
      roomNumber: room.roomNumber,
      timestamp: new Date().toISOString(),
    });

    // Send successful response with 201 Created
    res.status(201).json(room);
  } catch (error) {
    console.error('POST /api/rooms - Error creating room:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      roomNumber: req.body.roomNumber,
      timestamp: new Date().toISOString(),
    });
    handleServiceError(error, res, next);
  }
}

/**
 * PUT /api/rooms/:id - Updates an existing room (admin only)
 * Supports partial updates with validation
 *
 * @param {Request} req - Express request object with room ID in params and update data in body
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 *
 * @example
 * PUT /api/rooms/123e4567-e89b-12d3-a456-426614174000
 * Body:
 * {
 *   "price": 175.00,
 *   "status": "MAINTENANCE"
 * }
 *
 * Response 200:
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "roomNumber": "101",
 *   "type": "DELUXE",
 *   "price": "175.00",
 *   "status": "MAINTENANCE",
 *   "createdAt": "2024-01-01T00:00:00.000Z",
 *   "updatedAt": "2024-01-01T12:00:00.000Z"
 * }
 *
 * Response 404:
 * {
 *   "error": "Not Found",
 *   "message": "Room with ID 123e4567-e89b-12d3-a456-426614174000 not found",
 *   "code": "ROOM_NOT_FOUND"
 * }
 */
export async function updateRoom(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData: UpdateRoomDto = {};

    // Build update object from request body
    if (req.body.roomNumber !== undefined) {
      updateData.roomNumber = req.body.roomNumber as string;
    }
    if (req.body.type !== undefined) {
      updateData.type = req.body.type as string;
    }
    if (req.body.price !== undefined) {
      updateData.price = req.body.price as number;
    }
    if (req.body.status !== undefined) {
      updateData.status = req.body.status as RoomStatus;
    }

    console.log('PUT /api/rooms/:id - Updating room:', {
      roomId: id,
      updates: Object.keys(updateData),
      timestamp: new Date().toISOString(),
    });

    // Update room via service
    const room = await roomService.updateRoom(id, updateData);

    console.log('PUT /api/rooms/:id - Room updated successfully:', {
      roomId: id,
      roomNumber: room.roomNumber,
      timestamp: new Date().toISOString(),
    });

    // Send successful response
    res.status(200).json(room);
  } catch (error) {
    console.error('PUT /api/rooms/:id - Error updating room:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      roomId: req.params.id,
      timestamp: new Date().toISOString(),
    });
    handleServiceError(error, res, next);
  }
}

/**
 * DELETE /api/rooms/:id - Deletes a room (admin only)
 * Cascades deletion to associated reservations
 *
 * @param {Request} req - Express request object with room ID in params
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 *
 * @example
 * DELETE /api/rooms/123e4567-e89b-12d3-a456-426614174000
 *
 * Response 204: No Content
 *
 * Response 404:
 * {
 *   "error": "Not Found",
 *   "message": "Room with ID 123e4567-e89b-12d3-a456-426614174000 not found",
 *   "code": "ROOM_NOT_FOUND"
 * }
 */
export async function deleteRoom(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    console.log('DELETE /api/rooms/:id - Deleting room:', {
      roomId: id,
      timestamp: new Date().toISOString(),
    });

    // Delete room via service
    await roomService.deleteRoom(id);

    console.log('DELETE /api/rooms/:id - Room deleted successfully:', {
      roomId: id,
      timestamp: new Date().toISOString(),
    });

    // Send successful response with 204 No Content
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/rooms/:id - Error deleting room:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      roomId: req.params.id,
      timestamp: new Date().toISOString(),
    });
    handleServiceError(error, res, next);
  }
}