/**
 * Reservation Service Test Suite
 * 
 * Comprehensive test coverage for reservation business logic including:
 * - Room availability checking with date overlap detection
 * - Reservation creation with validation and atomic transactions
 * - Role-based access control and filtering
 * - Status transition validation and enforcement
 * - Check-in/check-out workflows with room status updates
 * - Cancellation with ownership validation
 * 
 * Test Strategy:
 * - Unit tests for all public methods
 * - Integration tests for database operations
 * - Edge case validation for date handling
 * - Error scenario coverage for all failure paths
 * - Security testing for authorization
 * 
 * Coverage Target: >=90% (lines, branches, functions, statements)
 * 
 * @module __tests__/services/reservation.service.test
 */

import { ReservationService, ReservationError } from '../../services/reservation.service.js';
import { prisma } from '../../config/database.js';
import type {
  CreateReservationDto,
  ReservationFilterDto,
  ReservationWithDetails,
} from '../../types/reservation.types.js';
import type { Reservation, Room, User } from '@prisma/client';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock the database module
jest.mock('../../config/database.js', () => ({
  prisma: {
    reservation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    room: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

// Mock console methods to keep test output clean
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Factory for creating mock user data
 */
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  password: 'hashed-password',
  role: 'GUEST',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Factory for creating mock room data
 */
const createMockRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 'room-123',
  number: '101',
  type: 'SINGLE',
  status: 'AVAILABLE',
  pricePerNight: 100,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Factory for creating mock reservation data
 */
const createMockReservation = (overrides: Partial<Reservation> = {}): Reservation => ({
  id: 'reservation-123',
  userId: 'user-123',
  roomId: 'room-123',
  checkInDate: new Date('2024-01-15'),
  checkOutDate: new Date('2024-01-20'),
  status: 'PENDING',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Factory for creating mock reservation with details
 */
const createMockReservationWithDetails = (
  overrides: Partial<ReservationWithDetails> = {}
): ReservationWithDetails => ({
  ...createMockReservation(),
  user: {
    id: 'user-123',
    email: 'test@example.com',
    role: 'GUEST',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  room: createMockRoom(),
  ...overrides,
});

// =============================================================================
// TEST SUITE SETUP
// =============================================================================

describe('ReservationService', () => {
  let service: ReservationService;

  beforeEach(() => {
    // Create fresh service instance for each test
    service = new ReservationService();

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Verify no unexpected console calls
    mockConsoleLog.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    // Restore console methods
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
  });

  // =============================================================================
  // ROOM AVAILABILITY TESTS
  // =============================================================================

  describe('checkRoomAvailability', () => {
    const roomId = 'room-123';
    const checkInDate = new Date('2024-01-15');
    const checkOutDate = new Date('2024-01-20');

    describe('✅ Success Scenarios', () => {
      test('should return true when room is available (no overlapping reservations)', async () => {
        // Arrange
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.checkRoomAvailability(roomId, checkInDate, checkOutDate);

        // Assert
        expect(result).toBe(true);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith({
          where: {
            roomId,
            id: undefined,
            status: {
              notIn: ['CANCELLED', 'CHECKED_OUT'],
            },
            OR: expect.arrayContaining([
              expect.objectContaining({
                AND: expect.arrayContaining([
                  { checkInDate: { lte: checkInDate } },
                  { checkOutDate: { gt: checkInDate } },
                ]),
              }),
            ]),
          },
        });
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Room availability check completed',
          expect.objectContaining({
            roomId,
            isAvailable: true,
            overlappingCount: 0,
          })
        );
      });

      test('should exclude specified reservation ID when checking availability', async () => {
        // Arrange
        const excludeId = 'reservation-456';
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.checkRoomAvailability(
          roomId,
          checkInDate,
          checkOutDate,
          excludeId
        );

        // Assert
        expect(result).toBe(true);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: { not: excludeId },
            }),
          })
        );
      });

      test('should return true when only cancelled/checked-out reservations exist', async () => {
        // Arrange
        const cancelledReservation = createMockReservation({
          status: 'CANCELLED',
          checkInDate: new Date('2024-01-16'),
          checkOutDate: new Date('2024-01-19'),
        });
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.checkRoomAvailability(roomId, checkInDate, checkOutDate);

        // Assert
        expect(result).toBe(true);
      });
    });

    describe('❌ Failure Scenarios', () => {
      test('should return false when room has overlapping reservation', async () => {
        // Arrange
        const overlappingReservation = createMockReservation({
          checkInDate: new Date('2024-01-16'),
          checkOutDate: new Date('2024-01-19'),
          status: 'CONFIRMED',
        });
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([overlappingReservation]);

        // Act
        const result = await service.checkRoomAvailability(roomId, checkInDate, checkOutDate);

        // Assert
        expect(result).toBe(false);
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Room availability check completed',
          expect.objectContaining({
            isAvailable: false,
            overlappingCount: 1,
          })
        );
      });

      test('should return false when check-in date is after check-out date', async () => {
        // Arrange
        const invalidCheckIn = new Date('2024-01-20');
        const invalidCheckOut = new Date('2024-01-15');

        // Act
        const result = await service.checkRoomAvailability(
          roomId,
          invalidCheckIn,
          invalidCheckOut
        );

        // Assert
        expect(result).toBe(false);
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          'Invalid date range for availability check',
          expect.any(Object)
        );
        expect(prisma.reservation.findMany).not.toHaveBeenCalled();
      });

      test('should return false when dates are the same', async () => {
        // Arrange
        const sameDate = new Date('2024-01-15');

        // Act
        const result = await service.checkRoomAvailability(roomId, sameDate, sameDate);

        // Assert
        expect(result).toBe(false);
        expect(mockConsoleWarn).toHaveBeenCalled();
      });

      test('should throw ReservationError when database query fails', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        (prisma.reservation.findMany as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(
          service.checkRoomAvailability(roomId, checkInDate, checkOutDate)
        ).rejects.toThrow(ReservationError);

        await expect(
          service.checkRoomAvailability(roomId, checkInDate, checkOutDate)
        ).rejects.toMatchObject({
          code: 'AVAILABILITY_CHECK_FAILED',
          statusCode: 500,
        });

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to check room availability',
          expect.any(Object)
        );
      });
    });

    describe('🔍 Edge Cases', () => {
      test('should handle multiple overlapping reservations', async () => {
        // Arrange
        const reservations = [
          createMockReservation({ id: 'res-1', status: 'CONFIRMED' }),
          createMockReservation({ id: 'res-2', status: 'PENDING' }),
          createMockReservation({ id: 'res-3', status: 'CHECKED_IN' }),
        ];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(reservations);

        // Act
        const result = await service.checkRoomAvailability(roomId, checkInDate, checkOutDate);

        // Assert
        expect(result).toBe(false);
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Room availability check completed',
          expect.objectContaining({
            overlappingCount: 3,
          })
        );
      });

      test('should handle date range at year boundary', async () => {
        // Arrange
        const yearEndCheckIn = new Date('2024-12-30');
        const yearStartCheckOut = new Date('2025-01-05');
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.checkRoomAvailability(
          roomId,
          yearEndCheckIn,
          yearStartCheckOut
        );

        // Assert
        expect(result).toBe(true);
      });
    });
  });

  // =============================================================================
  // RESERVATION CREATION TESTS
  // =============================================================================

  describe('createReservation', () => {
    const userId = 'user-123';
    const validDto: CreateReservationDto = {
      roomId: 'room-123',
      checkInDate: '2024-01-15',
      checkOutDate: '2024-01-20',
    };

    describe('✅ Success Scenarios', () => {
      test('should create reservation when room is available', async () => {
        // Arrange
        const mockRoom = createMockRoom();
        const mockReservation = createMockReservationWithDetails();

        (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.reservation.create as jest.Mock).mockResolvedValue(mockReservation);

        // Act
        const result = await service.createReservation(userId, validDto);

        // Assert
        expect(result).toEqual(mockReservation);
        expect(prisma.room.findUnique).toHaveBeenCalledWith({
          where: { id: validDto.roomId },
        });
        expect(prisma.reservation.create).toHaveBeenCalledWith({
          data: {
            userId,
            roomId: validDto.roomId,
            checkInDate: new Date(validDto.checkInDate),
            checkOutDate: new Date(validDto.checkOutDate),
            status: 'PENDING',
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
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservation created successfully',
          expect.objectContaining({
            reservationId: mockReservation.id,
            userId,
            roomId: validDto.roomId,
            status: 'PENDING',
          })
        );
      });

      test('should create reservation with valid date strings', async () => {
        // Arrange
        const mockRoom = createMockRoom();
        const mockReservation = createMockReservationWithDetails();

        (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.reservation.create as jest.Mock).mockResolvedValue(mockReservation);

        // Act
        const result = await service.createReservation(userId, validDto);

        // Assert
        expect(result).toBeDefined();
        expect(result.status).toBe('PENDING');
      });
    });

    describe('❌ Failure Scenarios', () => {
      test('should throw ReservationError when check-in date is after check-out date', async () => {
        // Arrange
        const invalidDto: CreateReservationDto = {
          roomId: 'room-123',
          checkInDate: '2024-01-20',
          checkOutDate: '2024-01-15',
        };

        // Act & Assert
        await expect(service.createReservation(userId, invalidDto)).rejects.toThrow(
          ReservationError
        );

        await expect(service.createReservation(userId, invalidDto)).rejects.toMatchObject({
          message: 'Invalid date range: check-in date must be before check-out date',
          code: 'INVALID_DATE_RANGE',
          statusCode: 400,
        });

        expect(prisma.room.findUnique).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when room does not exist', async () => {
        // Arrange
        (prisma.room.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.createReservation(userId, validDto)).rejects.toThrow(
          ReservationError
        );

        await expect(service.createReservation(userId, validDto)).rejects.toMatchObject({
          message: 'Room not found',
          code: 'ROOM_NOT_FOUND',
          statusCode: 404,
        });

        expect(prisma.reservation.create).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when room is unavailable', async () => {
        // Arrange
        const mockRoom = createMockRoom();
        const existingReservation = createMockReservation({ status: 'CONFIRMED' });

        (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([existingReservation]);

        // Act & Assert
        await expect(service.createReservation(userId, validDto)).rejects.toThrow(
          ReservationError
        );

        await expect(service.createReservation(userId, validDto)).rejects.toMatchObject({
          message: 'Room is not available for the specified dates',
          code: 'ROOM_UNAVAILABLE',
          statusCode: 409,
        });

        expect(prisma.reservation.create).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when database create fails', async () => {
        // Arrange
        const mockRoom = createMockRoom();
        const dbError = new Error('Database constraint violation');

        (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.reservation.create as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.createReservation(userId, validDto)).rejects.toThrow(
          ReservationError
        );

        await expect(service.createReservation(userId, validDto)).rejects.toMatchObject({
          message: 'Failed to create reservation',
          code: 'RESERVATION_CREATION_FAILED',
          statusCode: 500,
        });

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to create reservation',
          expect.any(Object)
        );
      });
    });

    describe('🔍 Edge Cases', () => {
      test('should handle same-day check-in and check-out (invalid)', async () => {
        // Arrange
        const sameDayDto: CreateReservationDto = {
          roomId: 'room-123',
          checkInDate: '2024-01-15',
          checkOutDate: '2024-01-15',
        };

        // Act & Assert
        await expect(service.createReservation(userId, sameDayDto)).rejects.toThrow(
          ReservationError
        );
      });

      test('should handle date strings with time components', async () => {
        // Arrange
        const dtoWithTime: CreateReservationDto = {
          roomId: 'room-123',
          checkInDate: '2024-01-15T14:30:00Z',
          checkOutDate: '2024-01-20T11:00:00Z',
        };
        const mockRoom = createMockRoom();
        const mockReservation = createMockReservationWithDetails();

        (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.reservation.create as jest.Mock).mockResolvedValue(mockReservation);

        // Act
        const result = await service.createReservation(userId, dtoWithTime);

        // Assert
        expect(result).toBeDefined();
      });
    });
  });

  // =============================================================================
  // GET RESERVATIONS TESTS (Role-Based Access)
  // =============================================================================

  describe('getReservations', () => {
    const userId = 'user-123';
    const adminId = 'admin-123';

    describe('✅ Success Scenarios - Guest Access', () => {
      test('should return only user own reservations for guests', async () => {
        // Arrange
        const mockReservations = [
          createMockReservationWithDetails({ userId }),
          createMockReservationWithDetails({ userId, id: 'reservation-456' }),
        ];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

        // Act
        const result = await service.getReservations({}, userId, false);

        // Assert
        expect(result).toEqual(mockReservations);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith({
          where: { userId },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservations retrieved successfully',
          expect.objectContaining({
            count: 2,
            userId,
            isAdmin: false,
          })
        );
      });

      test('should filter guest reservations by status', async () => {
        // Arrange
        const filters: ReservationFilterDto = { status: 'CONFIRMED' };
        const mockReservations = [
          createMockReservationWithDetails({ userId, status: 'CONFIRMED' }),
        ];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

        // Act
        const result = await service.getReservations(filters, userId, false);

        // Assert
        expect(result).toEqual(mockReservations);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith({
          where: {
            userId,
            status: 'CONFIRMED',
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });

      test('should filter guest reservations by room', async () => {
        // Arrange
        const roomId = 'room-123';
        const filters: ReservationFilterDto = { roomId };
        const mockReservations = [createMockReservationWithDetails({ userId, roomId })];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

        // Act
        const result = await service.getReservations(filters, userId, false);

        // Assert
        expect(result).toEqual(mockReservations);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith({
          where: {
            userId,
            roomId,
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });
    });

    describe('✅ Success Scenarios - Admin Access', () => {
      test('should return all reservations for admin without filters', async () => {
        // Arrange
        const mockReservations = [
          createMockReservationWithDetails({ userId: 'user-1' }),
          createMockReservationWithDetails({ userId: 'user-2' }),
          createMockReservationWithDetails({ userId: 'user-3' }),
        ];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

        // Act
        const result = await service.getReservations({}, adminId, true);

        // Assert
        expect(result).toEqual(mockReservations);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith({
          where: {},
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservations retrieved successfully',
          expect.objectContaining({
            count: 3,
            isAdmin: true,
          })
        );
      });

      test('should filter admin reservations by specific user', async () => {
        // Arrange
        const targetUserId = 'user-456';
        const filters: ReservationFilterDto = { userId: targetUserId };
        const mockReservations = [createMockReservationWithDetails({ userId: targetUserId })];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

        // Act
        const result = await service.getReservations(filters, adminId, true);

        // Assert
        expect(result).toEqual(mockReservations);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith({
          where: { userId: targetUserId },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });

      test('should filter admin reservations by date range', async () => {
        // Arrange
        const filters: ReservationFilterDto = {
          dateRange: {
            from: '2024-01-01',
            to: '2024-01-31',
          },
        };
        const mockReservations = [createMockReservationWithDetails()];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

        // Act
        const result = await service.getReservations(filters, adminId, true);

        // Assert
        expect(result).toEqual(mockReservations);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith({
          where: {
            OR: [
              {
                AND: [
                  { checkInDate: { lte: new Date('2024-01-31') } },
                  { checkOutDate: { gte: new Date('2024-01-01') } },
                ],
              },
            ],
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });

      test('should apply multiple filters for admin', async () => {
        // Arrange
        const filters: ReservationFilterDto = {
          status: 'CONFIRMED',
          roomId: 'room-123',
          userId: 'user-456',
        };
        const mockReservations = [createMockReservationWithDetails()];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

        // Act
        const result = await service.getReservations(filters, adminId, true);

        // Assert
        expect(result).toEqual(mockReservations);
        expect(prisma.reservation.findMany).toHaveBeenCalledWith({
          where: {
            userId: 'user-456',
            status: 'CONFIRMED',
            roomId: 'room-123',
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });
    });

    describe('❌ Failure Scenarios', () => {
      test('should throw ReservationError when database query fails', async () => {
        // Arrange
        const dbError = new Error('Database connection lost');
        (prisma.reservation.findMany as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.getReservations({}, userId, false)).rejects.toThrow(
          ReservationError
        );

        await expect(service.getReservations({}, userId, false)).rejects.toMatchObject({
          message: 'Failed to retrieve reservations',
          code: 'RESERVATION_RETRIEVAL_FAILED',
          statusCode: 500,
        });

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to retrieve reservations',
          expect.any(Object)
        );
      });
    });

    describe('🔍 Edge Cases', () => {
      test('should return empty array when no reservations exist', async () => {
        // Arrange
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.getReservations({}, userId, false);

        // Assert
        expect(result).toEqual([]);
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservations retrieved successfully',
          expect.objectContaining({ count: 0 })
        );
      });

      test('should handle empty filters object', async () => {
        // Arrange
        const mockReservations = [createMockReservationWithDetails()];
        (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

        // Act
        const result = await service.getReservations({}, userId, false);

        // Assert
        expect(result).toEqual(mockReservations);
      });
    });
  });

  // =============================================================================
  // GET RESERVATION BY ID TESTS
  // =============================================================================

  describe('getReservationById', () => {
    const reservationId = 'reservation-123';
    const userId = 'user-123';
    const adminId = 'admin-123';

    describe('✅ Success Scenarios', () => {
      test('should return reservation for owner (guest)', async () => {
        // Arrange
        const mockReservation = createMockReservationWithDetails({ id: reservationId, userId });
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(mockReservation);

        // Act
        const result = await service.getReservationById(reservationId, userId, false);

        // Assert
        expect(result).toEqual(mockReservation);
        expect(prisma.reservation.findUnique).toHaveBeenCalledWith({
          where: { id: reservationId },
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
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservation retrieved successfully',
          expect.objectContaining({
            reservationId,
            userId,
            isAdmin: false,
          })
        );
      });

      test('should return any reservation for admin', async () => {
        // Arrange
        const mockReservation = createMockReservationWithDetails({
          id: reservationId,
          userId: 'different-user',
        });
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(mockReservation);

        // Act
        const result = await service.getReservationById(reservationId, adminId, true);

        // Assert
        expect(result).toEqual(mockReservation);
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservation retrieved successfully',
          expect.objectContaining({
            reservationId,
            isAdmin: true,
          })
        );
      });
    });

    describe('❌ Failure Scenarios', () => {
      test('should throw ReservationError when reservation not found', async () => {
        // Arrange
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.getReservationById(reservationId, userId, false)).rejects.toThrow(
          ReservationError
        );

        await expect(
          service.getReservationById(reservationId, userId, false)
        ).rejects.toMatchObject({
          message: 'Reservation not found',
          code: 'RESERVATION_NOT_FOUND',
          statusCode: 404,
        });
      });

      test('should throw ReservationError when guest tries to access another user reservation', async () => {
        // Arrange
        const mockReservation = createMockReservationWithDetails({
          id: reservationId,
          userId: 'different-user',
        });
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(mockReservation);

        // Act & Assert
        await expect(service.getReservationById(reservationId, userId, false)).rejects.toThrow(
          ReservationError
        );

        await expect(
          service.getReservationById(reservationId, userId, false)
        ).rejects.toMatchObject({
          message: 'Access denied: You can only view your own reservations',
          code: 'ACCESS_DENIED',
          statusCode: 403,
        });

        expect(mockConsoleWarn).toHaveBeenCalledWith(
          'Unauthorized reservation access attempt',
          expect.objectContaining({
            reservationId,
            requestingUserId: userId,
            reservationUserId: 'different-user',
          })
        );
      });

      test('should throw ReservationError when database query fails', async () => {
        // Arrange
        const dbError = new Error('Database timeout');
        (prisma.reservation.findUnique as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.getReservationById(reservationId, userId, false)).rejects.toThrow(
          ReservationError
        );

        await expect(
          service.getReservationById(reservationId, userId, false)
        ).rejects.toMatchObject({
          message: 'Failed to retrieve reservation',
          code: 'RESERVATION_RETRIEVAL_FAILED',
          statusCode: 500,
        });

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to retrieve reservation',
          expect.any(Object)
        );
      });
    });
  });

  // =============================================================================
  // CONFIRM RESERVATION TESTS
  // =============================================================================

  describe('confirmReservation', () => {
    const reservationId = 'reservation-123';

    describe('✅ Success Scenarios', () => {
      test('should confirm reservation from PENDING status', async () => {
        // Arrange
        const pendingReservation = createMockReservation({ id: reservationId, status: 'PENDING' });
        const confirmedReservation = createMockReservation({
          id: reservationId,
          status: 'CONFIRMED',
        });

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(pendingReservation);
        (prisma.reservation.update as jest.Mock).mockResolvedValue(confirmedReservation);

        // Act
        const result = await service.confirmReservation(reservationId);

        // Assert
        expect(result).toEqual(confirmedReservation);
        expect(prisma.reservation.update).toHaveBeenCalledWith({
          where: { id: reservationId },
          data: { status: 'CONFIRMED' },
        });
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservation confirmed successfully',
          expect.objectContaining({
            reservationId,
            previousStatus: 'PENDING',
            newStatus: 'CONFIRMED',
          })
        );
      });
    });

    describe('❌ Failure Scenarios', () => {
      test('should throw ReservationError when reservation not found', async () => {
        // Arrange
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.confirmReservation(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.confirmReservation(reservationId)).rejects.toMatchObject({
          message: 'Reservation not found',
          code: 'RESERVATION_NOT_FOUND',
          statusCode: 404,
        });

        expect(prisma.reservation.update).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when confirming from invalid status', async () => {
        // Arrange
        const checkedInReservation = createMockReservation({
          id: reservationId,
          status: 'CHECKED_IN',
        });
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(checkedInReservation);

        // Act & Assert
        await expect(service.confirmReservation(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.confirmReservation(reservationId)).rejects.toMatchObject({
          message: 'Cannot confirm reservation in CHECKED_IN status',
          code: 'INVALID_STATUS_TRANSITION',
          statusCode: 400,
        });

        expect(prisma.reservation.update).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when database update fails', async () => {
        // Arrange
        const pendingReservation = createMockReservation({ id: reservationId, status: 'PENDING' });
        const dbError = new Error('Database constraint violation');

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(pendingReservation);
        (prisma.reservation.update as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.confirmReservation(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.confirmReservation(reservationId)).rejects.toMatchObject({
          message: 'Failed to confirm reservation',
          code: 'RESERVATION_CONFIRMATION_FAILED',
          statusCode: 500,
        });

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to confirm reservation',
          expect.any(Object)
        );
      });
    });
  });

  // =============================================================================
  // CHECK-IN TESTS
  // =============================================================================

  describe('checkIn', () => {
    const reservationId = 'reservation-123';
    const roomId = 'room-123';

    describe('✅ Success Scenarios', () => {
      test('should check in reservation and update room status', async () => {
        // Arrange
        const confirmedReservation = createMockReservation({
          id: reservationId,
          roomId,
          status: 'CONFIRMED',
        });
        const checkedInReservation = createMockReservation({
          id: reservationId,
          roomId,
          status: 'CHECKED_IN',
        });

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(confirmedReservation);
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
          callback({
            reservation: {
              update: jest.fn().mockResolvedValue(checkedInReservation),
            },
            room: {
              update: jest.fn().mockResolvedValue({}),
            },
          })
        );

        // Act
        const result = await service.checkIn(reservationId);

        // Assert
        expect(result).toEqual(checkedInReservation);
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Check-in processed successfully',
          expect.objectContaining({
            reservationId,
            roomId,
            previousStatus: 'CONFIRMED',
            newStatus: 'CHECKED_IN',
          })
        );
      });
    });

    describe('❌ Failure Scenarios', () => {
      test('should throw ReservationError when reservation not found', async () => {
        // Arrange
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.checkIn(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.checkIn(reservationId)).rejects.toMatchObject({
          message: 'Reservation not found',
          code: 'RESERVATION_NOT_FOUND',
          statusCode: 404,
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when checking in from invalid status', async () => {
        // Arrange
        const pendingReservation = createMockReservation({
          id: reservationId,
          status: 'PENDING',
        });
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(pendingReservation);

        // Act & Assert
        await expect(service.checkIn(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.checkIn(reservationId)).rejects.toMatchObject({
          message: 'Cannot check in reservation in PENDING status',
          code: 'INVALID_STATUS_TRANSITION',
          statusCode: 400,
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when transaction fails', async () => {
        // Arrange
        const confirmedReservation = createMockReservation({
          id: reservationId,
          status: 'CONFIRMED',
        });
        const dbError = new Error('Transaction rollback');

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(confirmedReservation);
        (prisma.$transaction as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.checkIn(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.checkIn(reservationId)).rejects.toMatchObject({
          message: 'Failed to process check-in',
          code: 'CHECK_IN_FAILED',
          statusCode: 500,
        });

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to process check-in',
          expect.any(Object)
        );
      });
    });
  });

  // =============================================================================
  // CHECK-OUT TESTS
  // =============================================================================

  describe('checkOut', () => {
    const reservationId = 'reservation-123';
    const roomId = 'room-123';

    describe('✅ Success Scenarios', () => {
      test('should check out reservation and update room status to AVAILABLE', async () => {
        // Arrange
        const checkedInReservation = createMockReservation({
          id: reservationId,
          roomId,
          status: 'CHECKED_IN',
        });
        const checkedOutReservation = createMockReservation({
          id: reservationId,
          roomId,
          status: 'CHECKED_OUT',
        });

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(checkedInReservation);
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
          callback({
            reservation: {
              update: jest.fn().mockResolvedValue(checkedOutReservation),
            },
            room: {
              update: jest.fn().mockResolvedValue({}),
            },
          })
        );

        // Act
        const result = await service.checkOut(reservationId);

        // Assert
        expect(result).toEqual(checkedOutReservation);
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Check-out processed successfully',
          expect.objectContaining({
            reservationId,
            roomId,
            previousStatus: 'CHECKED_IN',
            newStatus: 'CHECKED_OUT',
          })
        );
      });
    });

    describe('❌ Failure Scenarios', () => {
      test('should throw ReservationError when reservation not found', async () => {
        // Arrange
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.checkOut(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.checkOut(reservationId)).rejects.toMatchObject({
          message: 'Reservation not found',
          code: 'RESERVATION_NOT_FOUND',
          statusCode: 404,
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when checking out from invalid status', async () => {
        // Arrange
        const confirmedReservation = createMockReservation({
          id: reservationId,
          status: 'CONFIRMED',
        });
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(confirmedReservation);

        // Act & Assert
        await expect(service.checkOut(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.checkOut(reservationId)).rejects.toMatchObject({
          message: 'Cannot check out reservation in CONFIRMED status',
          code: 'INVALID_STATUS_TRANSITION',
          statusCode: 400,
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when transaction fails', async () => {
        // Arrange
        const checkedInReservation = createMockReservation({
          id: reservationId,
          status: 'CHECKED_IN',
        });
        const dbError = new Error('Transaction deadlock');

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(checkedInReservation);
        (prisma.$transaction as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.checkOut(reservationId)).rejects.toThrow(ReservationError);

        await expect(service.checkOut(reservationId)).rejects.toMatchObject({
          message: 'Failed to process check-out',
          code: 'CHECK_OUT_FAILED',
          statusCode: 500,
        });

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to process check-out',
          expect.any(Object)
        );
      });
    });
  });

  // =============================================================================
  // CANCEL RESERVATION TESTS
  // =============================================================================

  describe('cancelReservation', () => {
    const reservationId = 'reservation-123';
    const userId = 'user-123';
    const adminId = 'admin-123';

    describe('✅ Success Scenarios', () => {
      test('should cancel own reservation (guest)', async () => {
        // Arrange
        const pendingReservation = createMockReservation({
          id: reservationId,
          userId,
          status: 'PENDING',
        });
        const cancelledReservation = createMockReservation({
          id: reservationId,
          userId,
          status: 'CANCELLED',
        });

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(pendingReservation);
        (prisma.reservation.update as jest.Mock).mockResolvedValue(cancelledReservation);

        // Act
        const result = await service.cancelReservation(reservationId, userId, false);

        // Assert
        expect(result).toEqual(cancelledReservation);
        expect(prisma.reservation.update).toHaveBeenCalledWith({
          where: { id: reservationId },
          data: { status: 'CANCELLED' },
        });
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservation cancelled successfully',
          expect.objectContaining({
            reservationId,
            userId,
            isAdmin: false,
            previousStatus: 'PENDING',
            newStatus: 'CANCELLED',
          })
        );
      });

      test('should cancel any reservation (admin)', async () => {
        // Arrange
        const confirmedReservation = createMockReservation({
          id: reservationId,
          userId: 'different-user',
          status: 'CONFIRMED',
        });
        const cancelledReservation = createMockReservation({
          id: reservationId,
          userId: 'different-user',
          status: 'CANCELLED',
        });

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(confirmedReservation);
        (prisma.reservation.update as jest.Mock).mockResolvedValue(cancelledReservation);

        // Act
        const result = await service.cancelReservation(reservationId, adminId, true);

        // Assert
        expect(result).toEqual(cancelledReservation);
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Reservation cancelled successfully',
          expect.objectContaining({
            reservationId,
            isAdmin: true,
          })
        );
      });
    });

    describe('❌ Failure Scenarios', () => {
      test('should throw ReservationError when reservation not found', async () => {
        // Arrange
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.cancelReservation(reservationId, userId, false)).rejects.toThrow(
          ReservationError
        );

        await expect(
          service.cancelReservation(reservationId, userId, false)
        ).rejects.toMatchObject({
          message: 'Reservation not found',
          code: 'RESERVATION_NOT_FOUND',
          statusCode: 404,
        });

        expect(prisma.reservation.update).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when guest tries to cancel another user reservation', async () => {
        // Arrange
        const otherUserReservation = createMockReservation({
          id: reservationId,
          userId: 'different-user',
          status: 'PENDING',
        });
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(otherUserReservation);

        // Act & Assert
        await expect(service.cancelReservation(reservationId, userId, false)).rejects.toThrow(
          ReservationError
        );

        await expect(
          service.cancelReservation(reservationId, userId, false)
        ).rejects.toMatchObject({
          message: 'Access denied: You can only cancel your own reservations',
          code: 'ACCESS_DENIED',
          statusCode: 403,
        });

        expect(mockConsoleWarn).toHaveBeenCalledWith(
          'Unauthorized cancellation attempt',
          expect.objectContaining({
            reservationId,
            requestingUserId: userId,
            reservationUserId: 'different-user',
          })
        );

        expect(prisma.reservation.update).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when cancelling from invalid status', async () => {
        // Arrange
        const checkedOutReservation = createMockReservation({
          id: reservationId,
          userId,
          status: 'CHECKED_OUT',
        });
        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(checkedOutReservation);

        // Act & Assert
        await expect(service.cancelReservation(reservationId, userId, false)).rejects.toThrow(
          ReservationError
        );

        await expect(
          service.cancelReservation(reservationId, userId, false)
        ).rejects.toMatchObject({
          message: 'Cannot cancel reservation in CHECKED_OUT status',
          code: 'INVALID_STATUS_TRANSITION',
          statusCode: 400,
        });

        expect(prisma.reservation.update).not.toHaveBeenCalled();
      });

      test('should throw ReservationError when database update fails', async () => {
        // Arrange
        const pendingReservation = createMockReservation({
          id: reservationId,
          userId,
          status: 'PENDING',
        });
        const dbError = new Error('Database write failed');

        (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(pendingReservation);
        (prisma.reservation.update as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.cancelReservation(reservationId, userId, false)).rejects.toThrow(
          ReservationError
        );

        await expect(
          service.cancelReservation(reservationId, userId, false)
        ).rejects.toMatchObject({
          message: 'Failed to cancel reservation',
          code: 'RESERVATION_CANCELLATION_FAILED',
          statusCode: 500,
        });

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to cancel reservation',
          expect.any(Object)
        );
      });
    });
  });

  // =============================================================================
  // STATUS TRANSITION VALIDATION TESTS
  // =============================================================================

  describe('Status Transition Validation', () => {
    test('should allow PENDING -> CONFIRMED transition', async () => {
      // Arrange
      const pendingReservation = createMockReservation({ status: 'PENDING' });
      const confirmedReservation = createMockReservation({ status: 'CONFIRMED' });

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(pendingReservation);
      (prisma.reservation.update as jest.Mock).mockResolvedValue(confirmedReservation);

      // Act
      const result = await service.confirmReservation('reservation-123');

      // Assert
      expect(result.status).toBe('CONFIRMED');
    });

    test('should allow PENDING -> CANCELLED transition', async () => {
      // Arrange
      const pendingReservation = createMockReservation({ status: 'PENDING', userId: 'user-123' });
      const cancelledReservation = createMockReservation({ status: 'CANCELLED' });

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(pendingReservation);
      (prisma.reservation.update as jest.Mock).mockResolvedValue(cancelledReservation);

      // Act
      const result = await service.cancelReservation('reservation-123', 'user-123', false);

      // Assert
      expect(result.status).toBe('CANCELLED');
    });

    test('should allow CONFIRMED -> CHECKED_IN transition', async () => {
      // Arrange
      const confirmedReservation = createMockReservation({ status: 'CONFIRMED' });
      const checkedInReservation = createMockReservation({ status: 'CHECKED_IN' });

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(confirmedReservation);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback({
          reservation: {
            update: jest.fn().mockResolvedValue(checkedInReservation),
          },
          room: {
            update: jest.fn().mockResolvedValue({}),
          },
        })
      );

      // Act
      const result = await service.checkIn('reservation-123');

      // Assert
      expect(result.status).toBe('CHECKED_IN');
    });

    test('should allow CONFIRMED -> CANCELLED transition', async () => {
      // Arrange
      const confirmedReservation = createMockReservation({
        status: 'CONFIRMED',
        userId: 'user-123',
      });
      const cancelledReservation = createMockReservation({ status: 'CANCELLED' });

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(confirmedReservation);
      (prisma.reservation.update as jest.Mock).mockResolvedValue(cancelledReservation);

      // Act
      const result = await service.cancelReservation('reservation-123', 'user-123', false);

      // Assert
      expect(result.status).toBe('CANCELLED');
    });

    test('should allow CHECKED_IN -> CHECKED_OUT transition', async () => {
      // Arrange
      const checkedInReservation = createMockReservation({ status: 'CHECKED_IN' });
      const checkedOutReservation = createMockReservation({ status: 'CHECKED_OUT' });

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(checkedInReservation);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback({
          reservation: {
            update: jest.fn().mockResolvedValue(checkedOutReservation),
          },
          room: {
            update: jest.fn().mockResolvedValue({}),
          },
        })
      );

      // Act
      const result = await service.checkOut('reservation-123');

      // Assert
      expect(result.status).toBe('CHECKED_OUT');
    });

    test('should reject CHECKED_OUT -> any transition', async () => {
      // Arrange
      const checkedOutReservation = createMockReservation({
        status: 'CHECKED_OUT',
        userId: 'user-123',
      });
      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(checkedOutReservation);

      // Act & Assert
      await expect(
        service.cancelReservation('reservation-123', 'user-123', false)
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });

    test('should reject CANCELLED -> any transition', async () => {
      // Arrange
      const cancelledReservation = createMockReservation({ status: 'CANCELLED' });
      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(cancelledReservation);

      // Act & Assert
      await expect(service.confirmReservation('reservation-123')).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Integration Scenarios', () => {
    test('should handle complete reservation lifecycle', async () => {
      // 1. Create reservation
      const mockRoom = createMockRoom();
      const createdReservation = createMockReservationWithDetails({ status: 'PENDING' });

      (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.reservation.create as jest.Mock).mockResolvedValue(createdReservation);

      const created = await service.createReservation('user-123', {
        roomId: 'room-123',
        checkInDate: '2024-01-15',
        checkOutDate: '2024-01-20',
      });

      expect(created.status).toBe('PENDING');

      // 2. Confirm reservation
      const pendingReservation = createMockReservation({ status: 'PENDING' });
      const confirmedReservation = createMockReservation({ status: 'CONFIRMED' });

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(pendingReservation);
      (prisma.reservation.update as jest.Mock).mockResolvedValue(confirmedReservation);

      const confirmed = await service.confirmReservation(created.id);
      expect(confirmed.status).toBe('CONFIRMED');

      // 3. Check in
      const confirmedRes = createMockReservation({ status: 'CONFIRMED' });
      const checkedInRes = createMockReservation({ status: 'CHECKED_IN' });

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(confirmedRes);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback({
          reservation: {
            update: jest.fn().mockResolvedValue(checkedInRes),
          },
          room: {
            update: jest.fn().mockResolvedValue({}),
          },
        })
      );

      const checkedIn = await service.checkIn(created.id);
      expect(checkedIn.status).toBe('CHECKED_IN');

      // 4. Check out
      const checkedInReservation = createMockReservation({ status: 'CHECKED_IN' });
      const checkedOutReservation = createMockReservation({ status: 'CHECKED_OUT' });

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(checkedInReservation);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback({
          reservation: {
            update: jest.fn().mockResolvedValue(checkedOutReservation),
          },
          room: {
            update: jest.fn().mockResolvedValue({}),
          },
        })
      );

      const checkedOut = await service.checkOut(created.id);
      expect(checkedOut.status).toBe('CHECKED_OUT');
    });

    test('should prevent double booking', async () => {
      // Arrange
      const mockRoom = createMockRoom();
      const existingReservation = createMockReservation({
        status: 'CONFIRMED',
        checkInDate: new Date('2024-01-16'),
        checkOutDate: new Date('2024-01-19'),
      });

      (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue([existingReservation]);

      // Act & Assert
      await expect(
        service.createReservation('user-123', {
          roomId: 'room-123',
          checkInDate: '2024-01-15',
          checkOutDate: '2024-01-20',
        })
      ).rejects.toMatchObject({
        code: 'ROOM_UNAVAILABLE',
      });
    });
  });

  // =============================================================================
  // PERFORMANCE AND EDGE CASE TESTS
  // =============================================================================

  describe('Performance and Edge Cases', () => {
    test('should handle large number of reservations efficiently', async () => {
      // Arrange
      const largeReservationList = Array.from({ length: 1000 }, (_, i) =>
        createMockReservationWithDetails({ id: `reservation-${i}` })
      );
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue(largeReservationList);

      // Act
      const startTime = Date.now();
      const result = await service.getReservations({}, 'admin-123', true);
      const duration = Date.now() - startTime;

      // Assert
      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle concurrent availability checks', async () => {
      // Arrange
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const promises = Array.from({ length: 10 }, () =>
        service.checkRoomAvailability(
          'room-123',
          new Date('2024-01-15'),
          new Date('2024-01-20')
        )
      );

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(10);
      expect(results.every((r) => r === true)).toBe(true);
    });

    test('should handle date at leap year boundary', async () => {
      // Arrange
      const mockRoom = createMockRoom();
      const mockReservation = createMockReservationWithDetails();

      (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.reservation.create as jest.Mock).mockResolvedValue(mockReservation);

      // Act
      const result = await service.createReservation('user-123', {
        roomId: 'room-123',
        checkInDate: '2024-02-28',
        checkOutDate: '2024-03-01',
      });

      // Assert
      expect(result).toBeDefined();
    });
  });
});