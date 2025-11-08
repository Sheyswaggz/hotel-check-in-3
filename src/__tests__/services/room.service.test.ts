// src/__tests__/services/room.service.test.ts
// =============================================================================
// ROOM SERVICE TEST SUITE - COMPREHENSIVE UNIT TESTS
// =============================================================================
// Test Strategy:
// - Mock Prisma client for database isolation
// - Test all CRUD operations (Create, Read, Update, Delete)
// - Validate error handling for all error classes
// - Test pagination and filtering logic
// - Verify input validation and business rules
// - Achieve >90% code coverage
// =============================================================================

import { jest } from '@jest/globals';
import type { PrismaClient, Room as PrismaRoom } from '@prisma/client';
import {
  RoomService,
  RoomServiceError,
  RoomNotFoundError,
  DuplicateRoomNumberError,
  RoomValidationError,
  RoomDatabaseError,
} from '../../services/room.service.js';
import { RoomStatus, RoomType } from '../../types/room.types.js';
import type {
  CreateRoomDto,
  UpdateRoomDto,
  RoomFilterDto,
  PaginationDto,
} from '../../types/room.types.js';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Mock Prisma client with typed methods
 * Provides complete isolation from database
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
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn(),
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
  private static idCounter = 1;

  /**
   * Creates a mock Prisma room object
   */
  static createPrismaRoom(overrides: Partial<PrismaRoom> = {}): PrismaRoom {
    const id = `room-${this.idCounter++}`;
    return {
      id,
      roomNumber: `${100 + this.idCounter}`,
      type: RoomType.STANDARD,
      price: 100.0,
      status: RoomStatus.AVAILABLE,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  }

  /**
   * Creates a CreateRoomDto for testing room creation
   */
  static createRoomDto(overrides: Partial<CreateRoomDto> = {}): CreateRoomDto {
    return {
      roomNumber: `${100 + this.idCounter}`,
      type: RoomType.STANDARD,
      price: 100.0,
      status: RoomStatus.AVAILABLE,
      ...overrides,
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
   * Resets the ID counter for test isolation
   */
  static reset(): void {
    this.idCounter = 1;
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

    // Clear all mock call history
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Ensure mocks are reset between tests
    jest.resetAllMocks();
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
        expect(result.meta).toEqual({
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        });
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 0,
          take: 10,
          orderBy: [{ roomNumber: 'asc' }],
        });
        expect(mockPrismaClient.room.count).toHaveBeenCalledWith({ where: {} });
      });

      it('should return paginated rooms with custom pagination', async () => {
        // Arrange
        const mockRooms = [RoomTestFactory.createPrismaRoom()];
        const pagination: PaginationDto = { page: 2, limit: 5 };

        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(10);

        // Act
        const result = await roomService.getAllRooms(undefined, pagination);

        // Assert
        expect(result.meta).toEqual({
          page: 2,
          limit: 5,
          total: 10,
          totalPages: 2,
        });
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 5, // (page 2 - 1) * limit 5
          take: 5,
          orderBy: [{ roomNumber: 'asc' }],
        });
      });

      it('should filter rooms by type', async () => {
        // Arrange
        const mockRooms = [
          RoomTestFactory.createPrismaRoom({ type: RoomType.DELUXE }),
        ];
        const filters: RoomFilterDto = { type: RoomType.DELUXE };

        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(1);

        // Act
        const result = await roomService.getAllRooms(filters);

        // Assert
        expect(result.data).toHaveLength(1);
        expect(result.data[0].type).toBe(RoomType.DELUXE);
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { type: RoomType.DELUXE },
          })
        );
      });

      it('should filter rooms by status', async () => {
        // Arrange
        const mockRooms = [
          RoomTestFactory.createPrismaRoom({ status: RoomStatus.OCCUPIED }),
        ];
        const filters: RoomFilterDto = { status: RoomStatus.OCCUPIED };

        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(1);

        // Act
        const result = await roomService.getAllRooms(filters);

        // Assert
        expect(result.data[0].status).toBe(RoomStatus.OCCUPIED);
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { status: RoomStatus.OCCUPIED },
          })
        );
      });

      it('should filter rooms by price range', async () => {
        // Arrange
        const mockRooms = [RoomTestFactory.createPrismaRoom({ price: 150.0 })];
        const filters: RoomFilterDto = { minPrice: 100, maxPrice: 200 };

        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(1);

        // Act
        const result = await roomService.getAllRooms(filters);

        // Assert
        expect(result.data[0].price).toBe(150.0);
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

      it('should filter rooms by minimum price only', async () => {
        // Arrange
        const mockRooms = [RoomTestFactory.createPrismaRoom({ price: 150.0 })];
        const filters: RoomFilterDto = { minPrice: 100 };

        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(1);

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

      it('should filter rooms by maximum price only', async () => {
        // Arrange
        const mockRooms = [RoomTestFactory.createPrismaRoom({ price: 150.0 })];
        const filters: RoomFilterDto = { maxPrice: 200 };

        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(1);

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

      it('should combine multiple filters', async () => {
        // Arrange
        const mockRooms = [
          RoomTestFactory.createPrismaRoom({
            type: RoomType.SUITE,
            status: RoomStatus.AVAILABLE,
            price: 300.0,
          }),
        ];
        const filters: RoomFilterDto = {
          type: RoomType.SUITE,
          status: RoomStatus.AVAILABLE,
          minPrice: 200,
          maxPrice: 400,
        };

        mockPrismaClient.room.findMany.mockResolvedValue(mockRooms);
        mockPrismaClient.room.count.mockResolvedValue(1);

        // Act
        const result = await roomService.getAllRooms(filters);

        // Assert
        expect(result.data[0]).toMatchObject({
          type: RoomType.SUITE,
          status: RoomStatus.AVAILABLE,
          price: 300.0,
        });
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              type: RoomType.SUITE,
              status: RoomStatus.AVAILABLE,
              price: {
                gte: 200,
                lte: 400,
              },
            },
          })
        );
      });

      it('should return empty array when no rooms match filters', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        // Act
        const result = await roomService.getAllRooms();

        // Assert
        expect(result.data).toEqual([]);
        expect(result.meta.total).toBe(0);
        expect(result.meta.totalPages).toBe(0);
      });

      it('should handle large page numbers gracefully', async () => {
        // Arrange
        const pagination: PaginationDto = { page: 999, limit: 10 };
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        // Act
        const result = await roomService.getAllRooms(undefined, pagination);

        // Assert
        expect(result.data).toEqual([]);
        expect(result.meta.page).toBe(999);
      });

      it('should enforce maximum limit of 100', async () => {
        // Arrange
        const pagination: PaginationDto = { page: 1, limit: 200 };
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        // Act
        await roomService.getAllRooms(undefined, pagination);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 100, // Should be capped at MAX_LIMIT
          })
        );
      });

      it('should normalize negative page to 1', async () => {
        // Arrange
        const pagination: PaginationDto = { page: -5, limit: 10 };
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        // Act
        const result = await roomService.getAllRooms(undefined, pagination);

        // Assert
        expect(result.meta.page).toBe(1);
      });

      it('should normalize zero limit to 1', async () => {
        // Arrange
        const pagination: PaginationDto = { page: 1, limit: 0 };
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        // Act
        await roomService.getAllRooms(undefined, pagination);

        // Assert
        expect(mockPrismaClient.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 1,
          })
        );
      });
    });

    // -------------------------------------------------------------------------
    // VALIDATION ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Validation Errors', () => {
      it('should throw RoomValidationError for invalid room type', async () => {
        // Arrange
        const filters: RoomFilterDto = { type: 'INVALID_TYPE' as RoomType };

        // Act & Assert
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          'Invalid room type'
        );
      });

      it('should throw RoomValidationError for invalid room status', async () => {
        // Arrange
        const filters: RoomFilterDto = {
          status: 'INVALID_STATUS' as RoomStatus,
        };

        // Act & Assert
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          'Invalid room status'
        );
      });

      it('should throw RoomValidationError for negative minimum price', async () => {
        // Arrange
        const filters: RoomFilterDto = { minPrice: -50 };

        // Act & Assert
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          'Minimum price cannot be negative'
        );
      });

      it('should throw RoomValidationError for negative maximum price', async () => {
        // Arrange
        const filters: RoomFilterDto = { maxPrice: -100 };

        // Act & Assert
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          'Maximum price cannot be negative'
        );
      });

      it('should throw RoomValidationError when minPrice exceeds maxPrice', async () => {
        // Arrange
        const filters: RoomFilterDto = { minPrice: 200, maxPrice: 100 };

        // Act & Assert
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.getAllRooms(filters)).rejects.toThrow(
          'Minimum price cannot exceed maximum price'
        );
      });
    });

    // -------------------------------------------------------------------------
    // DATABASE ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Database Errors', () => {
      it('should throw RoomDatabaseError when findMany fails', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockRejectedValue(
          new Error('Database connection failed')
        );

        // Act & Assert
        await expect(roomService.getAllRooms()).rejects.toThrow(
          RoomDatabaseError
        );
        await expect(roomService.getAllRooms()).rejects.toThrow(
          'Failed to retrieve rooms from database'
        );
      });

      it('should throw RoomDatabaseError when count fails', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockRejectedValue(
          new Error('Count query failed')
        );

        // Act & Assert
        await expect(roomService.getAllRooms()).rejects.toThrow(
          RoomDatabaseError
        );
      });

      it('should preserve original error in RoomDatabaseError context', async () => {
        // Arrange
        const originalError = new Error('Connection timeout');
        mockPrismaClient.room.findMany.mockRejectedValue(originalError);

        // Act & Assert
        try {
          await roomService.getAllRooms();
          fail('Should have thrown RoomDatabaseError');
        } catch (error) {
          expect(error).toBeInstanceOf(RoomDatabaseError);
          if (error instanceof RoomDatabaseError) {
            expect(error.context?.cause).toBe('Connection timeout');
          }
        }
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
          id: 'test-room-id',
          roomNumber: '101',
        });
        mockPrismaClient.room.findUnique.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.getRoomById('test-room-id');

        // Assert
        expect(result).toMatchObject({
          id: 'test-room-id',
          roomNumber: '101',
          type: RoomType.STANDARD,
          price: 100.0,
          status: RoomStatus.AVAILABLE,
        });
        expect(mockPrismaClient.room.findUnique).toHaveBeenCalledWith({
          where: { id: 'test-room-id' },
        });
      });

      it('should convert Prisma Decimal price to number', async () => {
        // Arrange
        const mockRoom = RoomTestFactory.createPrismaRoom({ price: 199.99 });
        mockPrismaClient.room.findUnique.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.getRoomById('test-id');

        // Assert
        expect(typeof result.price).toBe('number');
        expect(result.price).toBe(199.99);
      });
    });

    // -------------------------------------------------------------------------
    // VALIDATION ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Validation Errors', () => {
      it('should throw RoomValidationError for empty string ID', async () => {
        // Act & Assert
        await expect(roomService.getRoomById('')).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.getRoomById('')).rejects.toThrow(
          'Invalid room ID format'
        );
      });

      it('should throw RoomValidationError for whitespace-only ID', async () => {
        // Act & Assert
        await expect(roomService.getRoomById('   ')).rejects.toThrow(
          RoomValidationError
        );
      });

      it('should throw RoomValidationError for null ID', async () => {
        // Act & Assert
        await expect(
          roomService.getRoomById(null as unknown as string)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for undefined ID', async () => {
        // Act & Assert
        await expect(
          roomService.getRoomById(undefined as unknown as string)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for non-string ID', async () => {
        // Act & Assert
        await expect(
          roomService.getRoomById(123 as unknown as string)
        ).rejects.toThrow(RoomValidationError);
      });
    });

    // -------------------------------------------------------------------------
    // NOT FOUND ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Not Found Errors', () => {
      it('should throw RoomNotFoundError when room does not exist', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(roomService.getRoomById('non-existent-id')).rejects.toThrow(
          RoomNotFoundError
        );
        await expect(roomService.getRoomById('non-existent-id')).rejects.toThrow(
          'Room with ID non-existent-id not found'
        );
      });

      it('should include room ID in RoomNotFoundError context', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        try {
          await roomService.getRoomById('missing-room');
          fail('Should have thrown RoomNotFoundError');
        } catch (error) {
          expect(error).toBeInstanceOf(RoomNotFoundError);
          if (error instanceof RoomNotFoundError) {
            expect(error.context?.roomId).toBe('missing-room');
            expect(error.code).toBe('ROOM_NOT_FOUND');
            expect(error.statusCode).toBe(404);
          }
        }
      });
    });

    // -------------------------------------------------------------------------
    // DATABASE ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Database Errors', () => {
      it('should throw RoomDatabaseError when findUnique fails', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockRejectedValue(
          new Error('Database error')
        );

        // Act & Assert
        await expect(roomService.getRoomById('test-id')).rejects.toThrow(
          RoomDatabaseError
        );
        await expect(roomService.getRoomById('test-id')).rejects.toThrow(
          'Failed to retrieve room from database'
        );
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
          roomNumber: '201',
          type: RoomType.DELUXE,
          price: 200.0,
          status: RoomStatus.AVAILABLE,
        });

        const mockCreatedRoom = RoomTestFactory.createPrismaRoom({
          id: 'new-room-id',
          ...createDto,
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(null); // No duplicate
        mockPrismaClient.room.create.mockResolvedValue(mockCreatedRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result).toMatchObject({
          id: 'new-room-id',
          roomNumber: '201',
          type: RoomType.DELUXE,
          price: 200.0,
          status: RoomStatus.AVAILABLE,
        });
        expect(mockPrismaClient.room.findUnique).toHaveBeenCalledWith({
          where: { roomNumber: '201' },
        });
        expect(mockPrismaClient.room.create).toHaveBeenCalledWith({
          data: {
            roomNumber: '201',
            type: RoomType.DELUXE,
            price: 200.0,
            status: RoomStatus.AVAILABLE,
          },
        });
      });

      it('should create room with all room types', async () => {
        // Test all enum values
        const roomTypes = [
          RoomType.STANDARD,
          RoomType.DELUXE,
          RoomType.SUITE,
        ];

        for (const type of roomTypes) {
          // Arrange
          const createDto = RoomTestFactory.createRoomDto({
            roomNumber: `${type}-room`,
            type,
          });
          const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

          mockPrismaClient.room.findUnique.mockResolvedValue(null);
          mockPrismaClient.room.create.mockResolvedValue(mockRoom);

          // Act
          const result = await roomService.createRoom(createDto);

          // Assert
          expect(result.type).toBe(type);
        }
      });

      it('should create room with all room statuses', async () => {
        // Test all enum values
        const roomStatuses = [
          RoomStatus.AVAILABLE,
          RoomStatus.OCCUPIED,
          RoomStatus.MAINTENANCE,
        ];

        for (const status of roomStatuses) {
          // Arrange
          const createDto = RoomTestFactory.createRoomDto({
            roomNumber: `${status}-room`,
            status,
          });
          const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

          mockPrismaClient.room.findUnique.mockResolvedValue(null);
          mockPrismaClient.room.create.mockResolvedValue(mockRoom);

          // Act
          const result = await roomService.createRoom(createDto);

          // Assert
          expect(result.status).toBe(status);
        }
      });

      it('should create room with minimum valid price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 0.01 });
        const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe(0.01);
      });

      it('should create room with maximum valid price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 999999.99 });
        const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe(999999.99);
      });

      it('should create room with alphanumeric room number', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: 'A1-B2-C3',
        });
        const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.roomNumber).toBe('A1-B2-C3');
      });
    });

    // -------------------------------------------------------------------------
    // VALIDATION ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Validation Errors', () => {
      it('should throw RoomValidationError for missing room number', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: undefined as unknown as string,
        });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Room number is required and must be a string'
        );
      });

      it('should throw RoomValidationError for non-string room number', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: 123 as unknown as string,
        });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
      });

      it('should throw RoomValidationError for empty room number', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '' });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          /must be between .* characters/
        );
      });

      it('should throw RoomValidationError for room number exceeding max length', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: 'A'.repeat(51), // Max is 50
        });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          /must be between .* characters/
        );
      });

      it('should throw RoomValidationError for room number with invalid characters', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: 'Room@123!',
        });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Room number must contain only alphanumeric characters and hyphens'
        );
      });

      it('should throw RoomValidationError for invalid room type', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          type: 'INVALID_TYPE' as RoomType,
        });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Invalid room type'
        );
      });

      it('should throw RoomValidationError for non-number price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          price: 'not-a-number' as unknown as number,
        });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Price must be a valid number'
        );
      });

      it('should throw RoomValidationError for NaN price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: NaN });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
      });

      it('should throw RoomValidationError for price below minimum', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 0.0 });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          /Price must be between/
        );
      });

      it('should throw RoomValidationError for price above maximum', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 1000000.0 });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          /Price must be between/
        );
      });

      it('should throw RoomValidationError for invalid room status', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          status: 'INVALID_STATUS' as RoomStatus,
        });

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Invalid room status'
        );
      });
    });

    // -------------------------------------------------------------------------
    // DUPLICATE ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Duplicate Errors', () => {
      it('should throw DuplicateRoomNumberError when room number exists', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '101' });
        const existingRoom = RoomTestFactory.createPrismaRoom({
          roomNumber: '101',
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          DuplicateRoomNumberError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Room with number 101 already exists'
        );
      });

      it('should include room number in DuplicateRoomNumberError context', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '202' });
        mockPrismaClient.room.findUnique.mockResolvedValue(
          RoomTestFactory.createPrismaRoom()
        );

        // Act & Assert
        try {
          await roomService.createRoom(createDto);
          fail('Should have thrown DuplicateRoomNumberError');
        } catch (error) {
          expect(error).toBeInstanceOf(DuplicateRoomNumberError);
          if (error instanceof DuplicateRoomNumberError) {
            expect(error.context?.roomNumber).toBe('202');
            expect(error.code).toBe('DUPLICATE_ROOM_NUMBER');
            expect(error.statusCode).toBe(409);
          }
        }
      });

      it('should handle Prisma P2002 unique constraint error', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: '303' });
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        const prismaError = new Error('Unique constraint failed') as Error & {
          code: string;
        };
        prismaError.code = 'P2002';
        mockPrismaClient.room.create.mockRejectedValue(prismaError);

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          DuplicateRoomNumberError
        );
      });
    });

    // -------------------------------------------------------------------------
    // DATABASE ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Database Errors', () => {
      it('should throw RoomDatabaseError when create fails', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto();
        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockRejectedValue(
          new Error('Database error')
        );

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomDatabaseError
        );
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          'Failed to create room in database'
        );
      });

      it('should throw RoomDatabaseError when duplicate check fails', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto();
        mockPrismaClient.room.findUnique.mockRejectedValue(
          new Error('Connection lost')
        );

        // Act & Assert
        await expect(roomService.createRoom(createDto)).rejects.toThrow(
          RoomDatabaseError
        );
      });
    });
  });

  // ===========================================================================
  // UPDATE ROOM TESTS
  // ===========================================================================

  describe('updateRoom', () => {
    const existingRoomId = 'existing-room-id';

    // -------------------------------------------------------------------------
    // HAPPY PATH TESTS
    // -------------------------------------------------------------------------

    describe('Happy Path', () => {
      it('should update room with valid data', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
          roomNumber: '101',
          price: 100.0,
        });
        const updateDto = RoomTestFactory.updateRoomDto({ price: 150.0 });
        const updatedRoom = { ...existingRoom, price: 150.0 };

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue(updatedRoom);

        // Act
        const result = await roomService.updateRoom(existingRoomId, updateDto);

        // Assert
        expect(result.price).toBe(150.0);
        expect(mockPrismaClient.room.update).toHaveBeenCalledWith({
          where: { id: existingRoomId },
          data: { price: 150.0 },
        });
      });

      it('should update room number', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
          roomNumber: '101',
        });
        const updateDto = RoomTestFactory.updateRoomDto({ roomNumber: '102' });
        const updatedRoom = { ...existingRoom, roomNumber: '102' };

        mockPrismaClient.room.findUnique
          .mockResolvedValueOnce(existingRoom) // First call: check if room exists
          .mockResolvedValueOnce(null); // Second call: check for duplicate room number
        mockPrismaClient.room.update.mockResolvedValue(updatedRoom);

        // Act
        const result = await roomService.updateRoom(existingRoomId, updateDto);

        // Assert
        expect(result.roomNumber).toBe('102');
        expect(mockPrismaClient.room.findUnique).toHaveBeenCalledTimes(2);
      });

      it('should update room type', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
          type: RoomType.STANDARD,
        });
        const updateDto = RoomTestFactory.updateRoomDto({ type: RoomType.DELUXE });
        const updatedRoom = { ...existingRoom, type: RoomType.DELUXE };

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue(updatedRoom);

        // Act
        const result = await roomService.updateRoom(existingRoomId, updateDto);

        // Assert
        expect(result.type).toBe(RoomType.DELUXE);
      });

      it('should update room status', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
          status: RoomStatus.AVAILABLE,
        });
        const updateDto = RoomTestFactory.updateRoomDto({
          status: RoomStatus.MAINTENANCE,
        });
        const updatedRoom = { ...existingRoom, status: RoomStatus.MAINTENANCE };

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue(updatedRoom);

        // Act
        const result = await roomService.updateRoom(existingRoomId, updateDto);

        // Assert
        expect(result.status).toBe(RoomStatus.MAINTENANCE);
      });

      it('should update multiple fields at once', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
        });
        const updateDto = RoomTestFactory.updateRoomDto({
          type: RoomType.SUITE,
          price: 300.0,
          status: RoomStatus.OCCUPIED,
        });
        const updatedRoom = { ...existingRoom, ...updateDto };

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue(updatedRoom);

        // Act
        const result = await roomService.updateRoom(existingRoomId, updateDto);

        // Assert
        expect(result).toMatchObject({
          type: RoomType.SUITE,
          price: 300.0,
          status: RoomStatus.OCCUPIED,
        });
      });

      it('should not check for duplicate when room number unchanged', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
          roomNumber: '101',
        });
        const updateDto = RoomTestFactory.updateRoomDto({ price: 150.0 });
        const updatedRoom = { ...existingRoom, price: 150.0 };

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockResolvedValue(updatedRoom);

        // Act
        await roomService.updateRoom(existingRoomId, updateDto);

        // Assert
        expect(mockPrismaClient.room.findUnique).toHaveBeenCalledTimes(1); // Only existence check
      });
    });

    // -------------------------------------------------------------------------
    // VALIDATION ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Validation Errors', () => {
      it('should throw RoomValidationError for invalid room ID', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({ price: 150.0 });

        // Act & Assert
        await expect(roomService.updateRoom('', updateDto)).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.updateRoom('', updateDto)).rejects.toThrow(
          'Invalid room ID format'
        );
      });

      it('should throw RoomValidationError for empty update data', async () => {
        // Arrange
        const updateDto = {};

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow('At least one field must be provided for update');
      });

      it('should throw RoomValidationError for non-string room number', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({
          roomNumber: 123 as unknown as string,
        });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow('Room number must be a string');
      });

      it('should throw RoomValidationError for room number too short', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({ roomNumber: '' });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for room number too long', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({
          roomNumber: 'A'.repeat(51),
        });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for room number with invalid characters', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({
          roomNumber: 'Room@123',
        });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for invalid room type', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({
          type: 'INVALID' as RoomType,
        });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow('Invalid room type');
      });

      it('should throw RoomValidationError for non-number price', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({
          price: 'not-a-number' as unknown as number,
        });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for price below minimum', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({ price: 0.0 });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for price above maximum', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({ price: 1000000.0 });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for invalid room status', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({
          status: 'INVALID' as RoomStatus,
        });

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomValidationError);
      });
    });

    // -------------------------------------------------------------------------
    // NOT FOUND ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Not Found Errors', () => {
      it('should throw RoomNotFoundError when room does not exist', async () => {
        // Arrange
        const updateDto = RoomTestFactory.updateRoomDto({ price: 150.0 });
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomNotFoundError);
      });
    });

    // -------------------------------------------------------------------------
    // DUPLICATE ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Duplicate Errors', () => {
      it('should throw DuplicateRoomNumberError when new room number exists', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
          roomNumber: '101',
        });
        const duplicateRoom = RoomTestFactory.createPrismaRoom({
          id: 'other-room-id',
          roomNumber: '102',
        });
        const updateDto = RoomTestFactory.updateRoomDto({ roomNumber: '102' });

        mockPrismaClient.room.findUnique
          .mockResolvedValueOnce(existingRoom)
          .mockResolvedValueOnce(duplicateRoom);

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(DuplicateRoomNumberError);
      });

      it('should handle Prisma P2002 unique constraint error on update', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
        });
        const updateDto = RoomTestFactory.updateRoomDto({ roomNumber: '999' });

        mockPrismaClient.room.findUnique
          .mockResolvedValueOnce(existingRoom)
          .mockResolvedValueOnce(null);

        const prismaError = new Error('Unique constraint failed') as Error & {
          code: string;
        };
        prismaError.code = 'P2002';
        mockPrismaClient.room.update.mockRejectedValue(prismaError);

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(DuplicateRoomNumberError);
      });
    });

    // -------------------------------------------------------------------------
    // DATABASE ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Database Errors', () => {
      it('should throw RoomDatabaseError when update fails', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
        });
        const updateDto = RoomTestFactory.updateRoomDto({ price: 150.0 });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.update.mockRejectedValue(
          new Error('Database error')
        );

        // Act & Assert
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow(RoomDatabaseError);
        await expect(
          roomService.updateRoom(existingRoomId, updateDto)
        ).rejects.toThrow('Failed to update room in database');
      });
    });
  });

  // ===========================================================================
  // DELETE ROOM TESTS
  // ===========================================================================

  describe('deleteRoom', () => {
    const existingRoomId = 'existing-room-id';

    // -------------------------------------------------------------------------
    // HAPPY PATH TESTS
    // -------------------------------------------------------------------------

    describe('Happy Path', () => {
      it('should delete existing room', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
          roomNumber: '101',
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.delete.mockResolvedValue(existingRoom);

        // Act
        await roomService.deleteRoom(existingRoomId);

        // Assert
        expect(mockPrismaClient.room.findUnique).toHaveBeenCalledWith({
          where: { id: existingRoomId },
        });
        expect(mockPrismaClient.room.delete).toHaveBeenCalledWith({
          where: { id: existingRoomId },
        });
      });

      it('should not throw error on successful deletion', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.delete.mockResolvedValue(existingRoom);

        // Act & Assert
        await expect(roomService.deleteRoom(existingRoomId)).resolves.not.toThrow();
      });
    });

    // -------------------------------------------------------------------------
    // VALIDATION ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Validation Errors', () => {
      it('should throw RoomValidationError for empty string ID', async () => {
        // Act & Assert
        await expect(roomService.deleteRoom('')).rejects.toThrow(
          RoomValidationError
        );
        await expect(roomService.deleteRoom('')).rejects.toThrow(
          'Invalid room ID format'
        );
      });

      it('should throw RoomValidationError for whitespace-only ID', async () => {
        // Act & Assert
        await expect(roomService.deleteRoom('   ')).rejects.toThrow(
          RoomValidationError
        );
      });

      it('should throw RoomValidationError for null ID', async () => {
        // Act & Assert
        await expect(
          roomService.deleteRoom(null as unknown as string)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for undefined ID', async () => {
        // Act & Assert
        await expect(
          roomService.deleteRoom(undefined as unknown as string)
        ).rejects.toThrow(RoomValidationError);
      });

      it('should throw RoomValidationError for non-string ID', async () => {
        // Act & Assert
        await expect(
          roomService.deleteRoom(123 as unknown as string)
        ).rejects.toThrow(RoomValidationError);
      });
    });

    // -------------------------------------------------------------------------
    // NOT FOUND ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Not Found Errors', () => {
      it('should throw RoomNotFoundError when room does not exist', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(roomService.deleteRoom(existingRoomId)).rejects.toThrow(
          RoomNotFoundError
        );
        await expect(roomService.deleteRoom(existingRoomId)).rejects.toThrow(
          `Room with ID ${existingRoomId} not found`
        );
      });

      it('should not attempt delete when room not found', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        try {
          await roomService.deleteRoom(existingRoomId);
          fail('Should have thrown RoomNotFoundError');
        } catch (error) {
          expect(mockPrismaClient.room.delete).not.toHaveBeenCalled();
        }
      });
    });

    // -------------------------------------------------------------------------
    // DATABASE ERROR TESTS
    // -------------------------------------------------------------------------

    describe('Database Errors', () => {
      it('should throw RoomDatabaseError when delete fails', async () => {
        // Arrange
        const existingRoom = RoomTestFactory.createPrismaRoom({
          id: existingRoomId,
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(existingRoom);
        mockPrismaClient.room.delete.mockRejectedValue(
          new Error('Database error')
        );

        // Act & Assert
        await expect(roomService.deleteRoom(existingRoomId)).rejects.toThrow(
          RoomDatabaseError
        );
        await expect(roomService.deleteRoom(existingRoomId)).rejects.toThrow(
          'Failed to delete room from database'
        );
      });

      it('should throw RoomDatabaseError when existence check fails', async () => {
        // Arrange
        mockPrismaClient.room.findUnique.mockRejectedValue(
          new Error('Connection lost')
        );

        // Act & Assert
        await expect(roomService.deleteRoom(existingRoomId)).rejects.toThrow(
          RoomDatabaseError
        );
      });
    });
  });

  // ===========================================================================
  // ERROR CLASS TESTS
  // ===========================================================================

  describe('Error Classes', () => {
    describe('RoomServiceError', () => {
      it('should create error with all properties', () => {
        // Arrange & Act
        const error = new RoomServiceError(
          'Test error',
          'TEST_CODE',
          400,
          { key: 'value' }
        );

        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('RoomServiceError');
        expect(error.message).toBe('Test error');
        expect(error.code).toBe('TEST_CODE');
        expect(error.statusCode).toBe(400);
        expect(error.context).toEqual({ key: 'value' });
      });

      it('should have stack trace', () => {
        // Arrange & Act
        const error = new RoomServiceError('Test', 'CODE', 500);

        // Assert
        expect(error.stack).toBeDefined();
      });
    });

    describe('RoomNotFoundError', () => {
      it('should create error with room ID', () => {
        // Arrange & Act
        const error = new RoomNotFoundError('test-room-id');

        // Assert
        expect(error).toBeInstanceOf(RoomServiceError);
        expect(error.name).toBe('RoomNotFoundError');
        expect(error.message).toBe('Room with ID test-room-id not found');
        expect(error.code).toBe('ROOM_NOT_FOUND');
        expect(error.statusCode).toBe(404);
        expect(error.context?.roomId).toBe('test-room-id');
      });
    });

    describe('DuplicateRoomNumberError', () => {
      it('should create error with room number', () => {
        // Arrange & Act
        const error = new DuplicateRoomNumberError('101');

        // Assert
        expect(error).toBeInstanceOf(RoomServiceError);
        expect(error.name).toBe('DuplicateRoomNumberError');
        expect(error.message).toBe('Room with number 101 already exists');
        expect(error.code).toBe('DUPLICATE_ROOM_NUMBER');
        expect(error.statusCode).toBe(409);
        expect(error.context?.roomNumber).toBe('101');
      });
    });

    describe('RoomValidationError', () => {
      it('should create error with message and context', () => {
        // Arrange & Act
        const error = new RoomValidationError('Invalid input', { field: 'price' });

        // Assert
        expect(error).toBeInstanceOf(RoomServiceError);
        expect(error.name).toBe('RoomValidationError');
        expect(error.message).toBe('Invalid input');
        expect(error.code).toBe('ROOM_VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.context?.field).toBe('price');
      });

      it('should create error without context', () => {
        // Arrange & Act
        const error = new RoomValidationError('Invalid input');

        // Assert
        expect(error.context).toBeUndefined();
      });
    });

    describe('RoomDatabaseError', () => {
      it('should create error with cause', () => {
        // Arrange
        const cause = new Error('Connection failed');

        // Act
        const error = new RoomDatabaseError('Database operation failed', cause);

        // Assert
        expect(error).toBeInstanceOf(RoomServiceError);
        expect(error.name).toBe('RoomDatabaseError');
        expect(error.message).toBe('Database operation failed');
        expect(error.code).toBe('ROOM_DATABASE_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.context?.cause).toBe('Connection failed');
      });

      it('should handle non-Error cause', () => {
        // Arrange & Act
        const error = new RoomDatabaseError('Database error', 'string cause');

        // Assert
        expect(error.context?.cause).toBe('string cause');
      });
    });
  });

  // ===========================================================================
  // EDGE CASES AND BOUNDARY TESTS
  // ===========================================================================

  describe('Edge Cases', () => {
    describe('Pagination Edge Cases', () => {
      it('should handle zero total results', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(0);

        // Act
        const result = await roomService.getAllRooms();

        // Assert
        expect(result.data).toEqual([]);
        expect(result.meta.totalPages).toBe(0);
      });

      it('should calculate correct total pages for exact division', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(20);

        // Act
        const result = await roomService.getAllRooms(undefined, {
          page: 1,
          limit: 10,
        });

        // Assert
        expect(result.meta.totalPages).toBe(2);
      });

      it('should calculate correct total pages for non-exact division', async () => {
        // Arrange
        mockPrismaClient.room.findMany.mockResolvedValue([]);
        mockPrismaClient.room.count.mockResolvedValue(25);

        // Act
        const result = await roomService.getAllRooms(undefined, {
          page: 1,
          limit: 10,
        });

        // Assert
        expect(result.meta.totalPages).toBe(3);
      });
    });

    describe('Price Edge Cases', () => {
      it('should handle price with many decimal places', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 99.999999 });
        const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe(99.999999);
      });

      it('should handle integer price', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ price: 100 });
        const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.price).toBe(100);
      });
    });

    describe('Room Number Edge Cases', () => {
      it('should handle single character room number', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({ roomNumber: 'A' });
        const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.roomNumber).toBe('A');
      });

      it('should handle maximum length room number', async () => {
        // Arrange
        const maxLengthNumber = 'A'.repeat(50);
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: maxLengthNumber,
        });
        const mockRoom = RoomTestFactory.createPrismaRoom(createDto);

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert
        expect(result.roomNumber).toBe(maxLengthNumber);
      });

      it('should trim whitespace from room number during validation', async () => {
        // Arrange
        const createDto = RoomTestFactory.createRoomDto({
          roomNumber: '  101  ',
        });
        const mockRoom = RoomTestFactory.createPrismaRoom({
          roomNumber: '  101  ',
        });

        mockPrismaClient.room.findUnique.mockResolvedValue(null);
        mockPrismaClient.room.create.mockResolvedValue(mockRoom);

        // Act
        const result = await roomService.createRoom(createDto);

        // Assert - Validation should pass after trimming
        expect(result.roomNumber).toBe('  101  ');
      });
    });
  });
});

// =============================================================================
// TEST SUITE SUMMARY
// =============================================================================
//
// Coverage Metrics (Expected):
// - Statements: >90%
// - Branches: >90%
// - Functions: >90%
// - Lines: >90%
//
// Test Categories:
// ✅ Unit Tests: All service methods with mocked dependencies
// ✅ Happy Path: Successful operations with valid data
// ✅ Validation: Input validation and business rule enforcement
// ✅ Error Handling: All custom error classes and scenarios
// ✅ Edge Cases: Boundary conditions and special cases
// ✅ Database Errors: Prisma client failure scenarios
//
// Test Organization:
// - Grouped by method (getAllRooms, getRoomById, createRoom, updateRoom, deleteRoom)
// - Subgrouped by scenario type (Happy Path, Validation, Errors, Edge Cases)
// - Clear test names describing expected behavior
// - Comprehensive assertions for all code paths
//
// Mocking Strategy:
// - Prisma client fully mocked for database isolation
// - Test data factories for consistent test data
// - Mock reset between tests for isolation
//
// Best Practices Applied:
// - AAA pattern (Arrange, Act, Assert)
// - Single responsibility per test
// - Descriptive test names
// - Comprehensive error scenario coverage
// - Type-safe mocking with TypeScript
// - Test isolation with beforeEach/afterEach
//
// =============================================================================