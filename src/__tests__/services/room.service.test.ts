// src/__tests__/services/room.service.test.ts
// =============================================================================
// ROOM SERVICE TEST SUITE - COMPREHENSIVE UNIT TESTS
// =============================================================================
// Complete test coverage for RoomService with mocked Prisma client
// Tests all CRUD operations, validation, error handling, and edge cases
//
// Test Strategy:
// - Mock Prisma client to isolate service logic
// - Test happy paths and error scenarios
// - Validate business rules and constraints
// - Ensure proper error handling and logging
// - Achieve >90% code coverage
// =============================================================================

import { jest } from '@jest/globals';
import type { PrismaClient, Room as PrismaRoom } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  RoomService,
  RoomNotFoundError,
  DuplicateRoomNumberError,
  RoomValidationError,
  RoomDatabaseError,
} from '../../services/room.service.js';
import type {
  CreateRoomDto,
  UpdateRoomDto,
  RoomFilterDto,
  PaginationDto,
} from '../../types/room.types.js';
import { RoomStatus } from '../../types/room.types.js';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Mock Prisma client with typed methods
 * Provides complete mock implementation for all Prisma operations
 */
const mockPrismaClient = {
  room: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaClient>;

/**
 * Mock the database module to inject our mock Prisma client
 */
jest.unstable_mockModule('../../config/database.js', () => ({
  prisma: mockPrismaClient,
}));

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Factory for creating test room data
 * Provides consistent test data with customizable overrides
 */
class RoomTestFactory {
  private static counter = 1;

  /**
   * Creates a complete Prisma room object with Decimal price
   */
  static createPrismaRoom(overrides: Partial<PrismaRoom> = {}): PrismaRoom {
    const roomNumber = overrides.roomNumber ?? `${this.counter++}01`;
    return {
      id: overrides.id ?? `room-${roomNumber}`,
      roomNumber,
      type: overrides.type ?? 'STANDARD',
      price: overrides.price ?? new Decimal('100.00'),
      status: overrides.status ?? RoomStatus.AVAILABLE,
      createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00Z'),
      updatedAt: overrides.updatedAt ?? new Date('2024-01-01T00:00:00Z'),
    };
  }

  /**
   * Creates a CreateRoomDto for testing room creation
   */
  static createRoomDto(overrides: Partial<CreateRoomDto> = {}): CreateRoomDto {
    return {
      roomNumber: overrides.roomNumber ?? `${this.counter++}01`,
      type: overrides.type ?? 'STANDARD',
      price: overrides.price ?? 100.0,
      status: overrides.status ?? RoomStatus.AVAILABLE,
    };
  }

  /**
   * Creates an UpdateRoomDto for testing room updates
   */
  static updateRoomDto(overrides: Partial<UpdateRoomDto> = {}): UpdateRoomDto {
    return {
      ...overrides,
    };
  }

  /**
   * Resets the counter for test isolation
   */
  static reset(): void {
    this.counter = 1;
  }
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe('RoomService', () => {
  let roomService: RoomService;

  // ---------------------------------------------------------------------------
  // SETUP AND TEARDOWN
  // ---------------------------------------------------------------------------

  beforeEach(() => {
    // Reset factory counter for consistent test data
    RoomTestFactory.reset();

    // Create fresh service instance
    roomService = new RoomService();

    // Clear all mocks
    jest.clearAllMocks();

    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // GET ALL ROOMS TESTS
  // ===========================================================================

  describe('getAllRooms', () => {
    // -------------------------------------------------------------------------
    // HAPPY PATH TESTS
    // -------------------------------------------------------------------------

    describe('Happy Path', () => {
      it('should return paginated rooms with default pagination', async () => {
        // Arrange
        const mockRooms = [
          RoomTestFactory.createPrismaRoom({ roomNumber: '101' }),
          RoomTestFactory.createPrismaRoom({ roomNumber: '102' }),
        ];

        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(2);

        // Act
        const result = await roomService.getAllRooms();

        // Assert
        expect(result.data).toHaveLength(2);
        expect(result.data[0].price).toBe('100.00');
        expect(result.meta).toEqual({
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        });

        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 0,
          take: 20,
          orderBy: [{ roomNumber: 'asc' }],
        });
      });

      it('should return empty array when no rooms exist', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        // Act
        const result = await roomService.getAllRooms();

        // Assert
        expect(result.data).toHaveLength(0);
        expect(result.meta.total).toBe(0);
        expect(result.meta.totalPages).toBe(0);
      });

      it('should apply custom pagination parameters', async () => {
        // Arrange
        const mockRooms = [RoomTestFactory.createPrismaRoom()];
        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(50);

        const pagination: PaginationDto = { page: 3, limit: 10 };

        // Act
        const result = await roomService.getAllRooms({}, pagination);

        // Assert
        expect(result.meta).toEqual({
          page: 3,
          limit: 10,
          total: 50,
          totalPages: 5,
        });

        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 20, // (page 3 - 1) * 10
          take: 10,
          orderBy: [{ roomNumber: 'asc' }],
        });
      });

      it('should enforce maximum limit constraint', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        const pagination: PaginationDto = { page: 1, limit: 200 }; // Exceeds max

        // Act
        await roomService.getAllRooms({}, pagination);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 100, // Should be capped at maxLimit
          })
        );
      });

      it('should handle page number less than 1', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        const pagination: PaginationDto = { page: 0, limit: 10 };

        // Act
        const result = await roomService.getAllRooms({}, pagination);

        // Assert
        expect(result.meta.page).toBe(1); // Should be normalized to 1
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 0,
          })
        );
      });
    });

    // -------------------------------------------------------------------------
    // FILTERING TESTS
    // -------------------------------------------------------------------------

    describe('Filtering', () => {
      it('should filter by room type (case-insensitive)', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        const filters: RoomFilterDto = { type: 'DELUXE' };

        // Act
        await roomService.getAllRooms(filters);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              type: {
                equals: 'DELUXE',
                mode: 'insensitive',
              },
            },
          })
        );
      });

      it('should filter by room status', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        const filters: RoomFilterDto = { status: RoomStatus.OCCUPIED };

        // Act
        await roomService.getAllRooms(filters);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              status: RoomStatus.OCCUPIED,
            },
          })
        );
      });

      it('should filter by minimum price', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        const filters: RoomFilterDto = { minPrice: 100 };

        // Act
        await roomService.getAllRooms(filters);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              price: {
                gte: 100,
              },
            },
          })
        );
      });

      it('should filter by maximum price', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        const filters: RoomFilterDto = { maxPrice: 200 };

        // Act
        await roomService.getAllRooms(filters);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              price: {
                lte: 200,
              },
            },
          })
        );
      });

      it('should filter by price range', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        const filters: RoomFilterDto = { minPrice: 100, maxPrice: 200 };

        // Act
        await roomService.getAllRooms(filters);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              price: {
                gte: 100,
                lte: 200,
              },
            },
          })
        );
      });

      it('should apply multiple filters simultaneously', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        const filters: RoomFilterDto = {
          type: 'SUITE',
          status: RoomStatus.AVAILABLE,
          minPrice: 150,
          maxPrice: 300,
        };

        // Act
        await roomService.getAllRooms(filters);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              type: {
                equals: 'SUITE',
                mode: 'insensitive',
              },
              status: RoomStatus.AVAILABLE,
              price: {
                gte: 150,
                lte: 300,
              },
            },
          })
        );
      });
    });

    // -------------------------------------------------------------------------
    // ERROR HANDLING TESTS
    // -------------------------------------------------------------------------

    describe('Error Handling', () => {
      it('should throw RoomDatabaseError on database failure', async () => {
        // Arrange
        const dbError = new Error('Connection timeout');
        mockPrismaClient.room.findMany.mockRejectedValue(dbError);

        // Act & Assert
        await expect(roomService.getAllRooms()).rejects.toThrow(RoomDatabaseError);
        await expect(roomService.getAllRooms()).rejects.toThrow('Database operation failed');
      });

      it('should log error details on failure', async () => {
        // Arrange
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPrismaClient.room.findMany.mockRejectedValue(new Error('DB Error'));

        // Act
        await expect(roomService.getAllRooms()).rejects.toThrow();

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch rooms:',
          expect.objectContaining({
            error: 'DB Error',
          })
        );
      });
    });

    // -------------------------------------------------------------------------
    // PAGINATION CALCULATION TESTS
    // -------------------------------------------------------------------------

    describe('Pagination Calculation', () => {
      it('should calculate correct total pages', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(47);

        const pagination: PaginationDto = { page: 1, limit: 10 };

        // Act
        const result = await roomService.getAllRooms({}, pagination);

        // Assert
        expect(result.meta.totalPages).toBe(5); // Math.ceil(47 / 10)
      });

      it('should handle exact page division', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(50);

        const pagination: PaginationDto = { page: 1, limit: 10 };

        // Act
        const result = await roomService.getAllRooms({}, pagination);

        // Assert
        expect(result.meta.totalPages).toBe(5);
      });

      it('should return 0 total pages when no results', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        // Act
        const result = await roomService.getAllRooms();

        // Assert
        expect(result.meta.totalPages).toBe(0);
      });
    });
  });

  // ===========================================================================
  // GET ROOM BY ID TESTS
  // ===========================================================================

  describe('getRoomById', () => {
    // -------------------------------------------------------------------------
    // HAPPY PATH TESTS
    // -------------------------------------------------------------------------

    describe('Happy Path', () => {
      it('should return room when found', async () => {
        // Arrange
        const mockRoom = RoomTestFactory.createPrismaRoom({
          id: 'room-123',
          roomNumber: '101',
        });
        mockPrismaClient.room.findUnique.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.getRoomById('room-123');

        // Assert
        expect(result).toEqual({
          ...mockRoom,
          price: '100.00',
        });
        expect(mockPrismaClient.room.findUnique).toHaveBeenCalledWith({
          where: { id: 'room-123' },
        });
      });

      it('should convert Decimal price to string', async () => {
        // Arrange
        const mockRoom = RoomTestFactory.createPrismaRoom({
          price: new Decimal('150.50'),
        });
        mockPrismaClient.room.findUnique.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.getRoomById('room-123');

        // Assert
        expect(result.price).toBe('150.50');
        expect(typeof result.price).toBe('string');
      });
    });

    // -------------------------------------------------------------------------
    // ERROR HANDLING TESTS
    // -------------------------------------------------------------------------

    describe('Error Handling', () => {
      it('should throw RoomNotFoundError when room does not exist', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(roomService.getRoomById('nonexistent')).rejects.toThrow(RoomNotFoundError);
        await expect(roomService.getRoomById('nonexistent')).rejects.toThrow(
          'Room with ID nonexistent not found'
        );
      });

      it('should throw RoomDatabaseError on database failure', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockRejectedValue(new Error('DB Error'));

        // Act & Assert
        await expect(roomService.getRoomById('room-123')).rejects.toThrow(RoomDatabaseError);
      });

      it('should preserve RoomNotFoundError when thrown', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(roomService.getRoomById('room-123')).rejects.toThrow(RoomNotFoundError);
        await expect(roomService.getRoomById('room-123')).rejects.not.toThrow(RoomDatabaseError);
      });
    });
  });

  // ===========================================================================
  // CREATE ROOM TESTS
  // ===========================================================================

  describe('createRoom', () => {
    // -------------------------------------------------------------------------
    // HAPPY PATH TESTS
    // -------------------------------------------------------------------------

    describe('Happy Path', () => {
      it('should create room with valid data', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: '101',
          type: 'DELUXE',
          price: 150.0,
        });

        const mockCreatedRoom = RoomTestFactory.createPrismaRoom({
          id: 'new-room-id',
          ...createDto,
          price: new Decimal(createDto.price),
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(null); // No duplicate
        mockPrismaClient.room.create.mockResolvedValue(mockCreatedRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result).toEqual({
          ...mockCreatedRoom,
          price: '150',
        });
        expect(mockPrismaClient.room.create).toHaveBeenCalledWith({
          data: {
            roomNumber: '101',
            type: 'DELUXE',
            price: 150.0,
            status: RoomStatus.AVAILABLE,
          },
        });
      });

      it('should create room with minimum valid price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 0 });
        const mockRoom = RoomTestFactory.createPrismaRoom({ price: new Decimal('0') });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe('0');
      });

      it('should create room with maximum valid price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 10000 });
        const mockRoom = RoomTestFactory.createPrismaRoom({ price: new Decimal('10000') });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe('10000');
      });
    });

    // -------------------------------------------------------------------------
    // VALIDATION TESTS
    // -------------------------------------------------------------------------

    describe('Validation', () => {
      it('should reject room number shorter than minimum length', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '1' });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomValidationError);
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Room number must be between'
        );
      });

      it('should reject room number longer than maximum length', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '12345678901' });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomValidationError);
      });

      it('should reject room number with invalid characters', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '101@#$' });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomValidationError);
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'must contain only alphanumeric characters'
        );
      });

      it('should accept room number with hyphens', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '101-A' });
        const mockRoom = RoomTestFactory.createPrismaRoom({ roomNumber: '101-A' });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.roomNumber).toBe('101-A');
      });

      it('should reject price below minimum', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: -1 });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomValidationError);
        await expect(roomService.createRoom(createDto)).rejects.toThrow('Price must be between');
      });

      it('should reject price above maximum', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 10001 });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomValidationError);
      });

      it('should reject price with too many decimal places', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 100.123 });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomValidationError);
        await expect(roomService.createRoom(createDto)).rejects.toThrow('decimal places');
      });

      it('should accept price with valid decimal places', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 100.99 });
        const mockRoom = RoomTestFactory.createPrismaRoom({ price: new Decimal('100.99') });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe('100.99');
      });

      it('should reject invalid room status', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          status: 'INVALID_STATUS' as RoomStatus,
        });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomValidationError);
        await expect(roomService.createRoom(createDto)).rejects.toThrow('Invalid room status');
      });

      it('should include all validation errors in error object', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: '1',
          price: -1,
          status: 'INVALID' as RoomStatus,
        });

        // Act & Assert
        try {
          await roomService.createRoom(createDto);
          fail('Should have thrown RoomValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(RoomValidationError);
          if (error instanceof RoomValidationError) {
            expect(error.validationErrors).toHaveProperty('roomNumber');
            expect(error.validationErrors).toHaveProperty('price');
            expect(error.validationErrors).toHaveProperty('status');
          }
        }
      });
    });

    // -------------------------------------------------------------------------
    // DUPLICATE HANDLING TESTS
    // -------------------------------------------------------------------------

    describe('Duplicate Handling', () => {
      it('should throw DuplicateRoomNumberError when room number exists', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '101' });
        const existingRoom = RoomTestFactory.createPrismaRoom({ roomNumber: '101' });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          DuplicateRoomNumberError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Room with number 101 already exists'
        );
      });

      it('should not call create when duplicate found', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto();
        mockPrismaClient.room.findUnique.mockResolvedValue(
          RoomTestFactory.createPrismaRoom()
        );

        // Act
        await expect(roomService.createRoom(createDto)).rejects.toThrow();

        // Assert
        expect(mockPrismaClient.room.create).not.toHaveBeenCalled();
      });
    });

    // -------------------------------------------------------------------------
    // ERROR HANDLING TESTS
    // -------------------------------------------------------------------------

    describe('Error Handling', () => {
      it('should throw RoomDatabaseError on database failure', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto();
        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockRejectedValue(new Error('DB Error'));

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomDatabaseError);
      });

      it('should preserve validation errors', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: -1 });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(RoomValidationError);
        await expect(roomService.createRoom(createDto)).rejects.not.toThrow(RoomDatabaseError);
      });
    });
  });

  // ===========================================================================
  // UPDATE ROOM TESTS
  // ===========================================================================

  describe('updateRoom', () => {
    // -------------------------------------------------------------------------
    // HAPPY PATH TESTS
    // -------------------------------------------------------------------------

    describe('Happy Path', () => {
      it('should update room with valid data', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({ id: 'room-123' });
        const updateDto = RoomTestFactory.updateRoomDto({ price: 200.0 });
        const updatedRoom = { ...existingRoom, price: new Decimal('200.0') };

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue(updatedRoom);

        // Act
        const result = await roomService.updateRoom('room-123', updateDto);

        // Assert
        expect(result.price).toBe('200');
        expect(mockPrismaClient.room.update).toHaveBeenCalledWith({
          where: { id: 'room-123' },
          data: { price: 200.0 },
        });
      });

      it('should update only provided fields', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        const updateDto = RoomTestFactory.updateRoomDto({ status: RoomStatus.MAINTENANCE });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue({
          ...existingRoom,
          status: RoomStatus.MAINTENANCE,
        });

        // Act
        await roomService.updateRoom('room-123', updateDto);

        // Assert
        expect(mockPrismaClient.room.update).toHaveBeenCalledWith({
          where: { id: 'room-123' },
          data: { status: RoomStatus.MAINTENANCE },
        });
      });

      it('should update multiple fields simultaneously', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        const updateDto = RoomTestFactory.updateRoomDto({
          type: 'SUITE',
          price: 300.0,
          status: RoomStatus.OCCUPIED,
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue({
          ...existingRoom,
          ...updateDto,
          price: new Decimal('300.0'),
        });

        // Act
        await roomService.updateRoom('room-123', updateDto);

        // Assert
        expect(mockPrismaClient.room.update).toHaveBeenCalledWith({
          where: { id: 'room-123' },
          data: {
            type: 'SUITE',
            price: 300.0,
            status: RoomStatus.OCCUPIED,
          },
        });
      });

      it('should update room number when not duplicate', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({ roomNumber: '101' });
        const updateDto = RoomTestFactory.updateRoomDto({ roomNumber: '102' });

        mockPrismaClient.room.findUnique
          .mockResolvedValueOnce(existingRoom) // First call: check existence
          .mockResolvedValueOnce(null); // Second call: check duplicate

        mockPrismaClient.room.update.mockResolvedValue({
          ...existingRoom,
          roomNumber: '102',
        });

        // Act
        await roomService.updateRoom('room-123', updateDto);

        // Assert
        expect(mockPrismaClient.room.update).toHaveBeenCalledWith({
          where: { id: 'room-123' },
          data: { roomNumber: '102' },
        });
      });
    });

    // -------------------------------------------------------------------------
    // VALIDATION TESTS
    // -------------------------------------------------------------------------

    describe('Validation', () => {
      it('should validate updated room number', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        const updateDto = RoomTestFactory.updateRoomDto({ roomNumber: '1' });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);

        // Act & Assert
        await expect(roomService.updateRoom('room-123', updateDto)).rejects.toThrow(
          RoomValidationError
        );
      });

      it('should validate updated price', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        const updateDto = RoomTestFactory.updateRoomDto({ price: -1 });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);

        // Act & Assert
        await expect(roomService.updateRoom('room-123', updateDto)).rejects.toThrow(
          RoomValidationError
        );
      });

      it('should validate updated status', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        const updateDto = RoomTestFactory.updateRoomDto({
          status: 'INVALID' as RoomStatus,
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);

        // Act & Assert
        await expect(roomService.updateRoom('room-123', updateDto)).rejects.toThrow(
          RoomValidationError
        );
      });
    });

    // -------------------------------------------------------------------------
    // ERROR HANDLING TESTS
    // -------------------------------------------------------------------------

    describe('Error Handling', () => {
      it('should throw RoomNotFoundError when room does not exist', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({ price: 200.0 });
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(roomService.updateRoom('nonexistent', updateDto)).rejects.toThrow(
          RoomNotFoundError
        );
      });

      it('should throw DuplicateRoomNumberError when updating to existing number', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({ roomNumber: '101' });
        const duplicateRoom = RoomTestFactory.createPrismaRoom({ roomNumber: '102' });
        const updateDto = RoomTestFactory.updateRoomDto({ roomNumber: '102' });

        mockPrismaClient.room.findUnique
          .mockResolvedValueOnce(existingRoom)
          .mockResolvedValueOnce(duplicateRoom);

        // Act & Assert
        await expect(roomService.updateRoom('room-123', updateDto)).rejects.toThrow(
          DuplicateRoomNumberError
        );
      });

      it('should not check duplicate when room number unchanged', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({ roomNumber: '101' });
        const updateDto = RoomTestFactory.updateRoomDto({
          roomNumber: '101',
          price: 200.0,
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue({
          ...existingRoom,
          price: new Decimal('200.0'),
        });

        // Act
        await roomService.updateRoom('room-123', updateDto);

        // Assert
        expect(mockPrismaClient.room.findUnique).toHaveBeenCalledTimes(1);
      });

      it('should throw RoomDatabaseError on database failure', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        const updateDto = RoomTestFactory.updateRoomDto({ price: 200.0 });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockRejectedValue(new Error('DB Error'));

        // Act & Assert
        await expect(roomService.updateRoom('room-123', updateDto)).rejects.toThrow(
          RoomDatabaseError
        );
      });
    });
  });

  // ===========================================================================
  // DELETE ROOM TESTS
  // ===========================================================================

  describe('deleteRoom', () => {
    // -------------------------------------------------------------------------
    // HAPPY PATH TESTS
    // -------------------------------------------------------------------------

    describe('Happy Path', () => {
      it('should delete existing room', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({ id: 'room-123' });
        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.delete.mockResolvedValue(existingRoom);

        // Act
        await roomService.deleteRoom('room-123');

        // Assert
        expect(mockPrismaClient.room.delete).toHaveBeenCalledWith({
          where: { id: 'room-123' },
        });
      });

      it('should return void on successful deletion', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.delete.mockResolvedValue(existingRoom);

        // Act
        const result = await roomService.deleteRoom('room-123');

        // Assert
        expect(result).toBeUndefined();
      });
    });

    // -------------------------------------------------------------------------
    // ERROR HANDLING TESTS
    // -------------------------------------------------------------------------

    describe('Error Handling', () => {
      it('should throw RoomNotFoundError when room does not exist', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(roomService.deleteRoom('nonexistent')).rejects.toThrow(RoomNotFoundError);
      });

      it('should not call delete when room not found', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act
        await expect(roomService.deleteRoom('nonexistent')).rejects.toThrow();

        // Assert
        expect(mockPrismaClient.room.delete).not.toHaveBeenCalled();
      });

      it('should throw RoomDatabaseError on database failure', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.delete.mockRejectedValue(new Error('DB Error'));

        // Act & Assert
        await expect(roomService.deleteRoom('room-123')).rejects.toThrow(RoomDatabaseError);
      });

      it('should preserve RoomNotFoundError when thrown', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(roomService.deleteRoom('room-123')).rejects.toThrow(RoomNotFoundError);
        await expect(roomService.deleteRoom('room-123')).rejects.not.toThrow(RoomDatabaseError);
      });
    });
  });

  // ===========================================================================
  // ERROR CLASS TESTS
  // ===========================================================================

  describe('Error Classes', () => {
    describe('RoomNotFoundError', () => {
      it('should create error with correct properties', () => {
        // Act
        const error = new RoomNotFoundError('room-123');

        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(RoomNotFoundError);
        expect(error.name).toBe('RoomNotFoundError');
        expect(error.message).toBe('Room with ID room-123 not found');
        expect(error.code).toBe('ROOM_NOT_FOUND');
        expect(error.statusCode).toBe(404);
      });

      it('should capture stack trace', () => {
        // Act
        const error = new RoomNotFoundError('room-123');

        // Assert
        expect(error.stack).toBeDefined();
      });
    });

    describe('DuplicateRoomNumberError', () => {
      it('should create error with correct properties', () => {
        // Act
        const error = new DuplicateRoomNumberError('101');

        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DuplicateRoomNumberError);
        expect(error.name).toBe('DuplicateRoomNumberError');
        expect(error.message).toBe('Room with number 101 already exists');
        expect(error.code).toBe('DUPLICATE_ROOM_NUMBER');
        expect(error.statusCode).toBe(409);
      });
    });

    describe('RoomValidationError', () => {
      it('should create error with validation errors', () => {
        // Arrange
        const validationErrors = {
          roomNumber: 'Invalid format',
          price: 'Out of range',
        };

        // Act
        const error = new RoomValidationError('Validation failed', validationErrors);

        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(RoomValidationError);
        expect(error.name).toBe('RoomValidationError');
        expect(error.message).toBe('Validation failed');
        expect(error.code).toBe('ROOM_VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.validationErrors).toEqual(validationErrors);
      });
    });

    describe('RoomDatabaseError', () => {
      it('should create error with operation details', () => {
        // Act
        const error = new RoomDatabaseError('create room');

        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(RoomDatabaseError);
        expect(error.name).toBe('RoomDatabaseError');
        expect(error.message).toBe('Database operation failed: create room');
        expect(error.code).toBe('ROOM_DATABASE_ERROR');
        expect(error.statusCode).toBe(500);
      });

      it('should store cause when provided', () => {
        // Arrange
        const cause = new Error('Connection timeout');

        // Act
        const error = new RoomDatabaseError('fetch rooms', cause);

        // Assert
        expect(error.cause).toBe(cause);
      });
    });
  });

  // ===========================================================================
  // EDGE CASES AND BOUNDARY TESTS
  // ===========================================================================

  describe('Edge Cases', () => {
    describe('Price Handling', () => {
      it('should handle zero price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 0 });
        const mockRoom = RoomTestFactory.createPrismaRoom({ price: new Decimal('0') });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe('0');
      });

      it('should handle price with one decimal place', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 100.5 });
        const mockRoom = RoomTestFactory.createPrismaRoom({ price: new Decimal('100.5') });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe('100.5');
      });

      it('should handle integer price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 100 });
        const mockRoom = RoomTestFactory.createPrismaRoom({ price: new Decimal('100') });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe('100');
      });
    });

    describe('Room Number Handling', () => {
      it('should handle minimum length room number', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '10' });
        const mockRoom = RoomTestFactory.createPrismaRoom({ roomNumber: '10' });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.roomNumber).toBe('10');
      });

      it('should handle maximum length room number', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '1234567890' });
        const mockRoom = RoomTestFactory.createPrismaRoom({ roomNumber: '1234567890' });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.roomNumber).toBe('1234567890');
      });

      it('should handle alphanumeric room numbers', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: 'A1B2C3' });
        const mockRoom = RoomTestFactory.createPrismaRoom({ roomNumber: 'A1B2C3' });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.roomNumber).toBe('A1B2C3');
      });
    });

    describe('Empty Update', () => {
      it('should handle update with no fields', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom();
        const updateDto = RoomTestFactory.updateRoomDto({});

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue(existingRoom);

        // Act
        const result = await roomService.updateRoom('room-123', updateDto);

        // Assert
        expect(result).toBeDefined();
        expect(mockPrismaClient.room.update).toHaveBeenCalledWith({
          where: { id: 'room-123' },
          data: {},
        });
      });
    });
  });
});