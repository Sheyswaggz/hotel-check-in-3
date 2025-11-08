/**
 * Reservation Service Test Suite
 * 
 * Comprehensive test coverage for reservation business logic including:
 * - Room availability checking with date overlap detection
 * - Reservation creation with atomic transactions
 * - Role-based access control and filtering
 * - Status transition validation
 * - Check-in/check-out workflows
 * - Cancellation with ownership validation
 * 
 * Test Strategy:
 * - Mock Prisma client for database isolation
 * - Test data factories for consistent test data
 * - Comprehensive error scenario coverage
 * - Edge case validation
 * - Transaction rollback verification
 * 
 * Coverage Target: >=90%
 * 
 * @module __tests__/services/reservation.service.test
 */

import { jest } from '@jest/globals';
import {
  ReservationService,
  ReservationServiceError,
  ReservationNotFoundError,
  RoomNotAvailableError,
  InvalidStatusTransitionError,
  UnauthorizedReservationAccessError,
  RoomNotFoundError,
} from '../../services/reservation.service.js';
import {
  ReservationStatus,
  CreateReservationDto,
  ReservationFilterDto,
} from '../../types/reservation.types.js';
import { DateValidationError } from '../../utils/date.util.js';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Mock Prisma client with all required methods
 * Provides isolated database operations for testing
 */
const mockPrisma = {
  room: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  reservation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

/**
 * Mock database module to inject mocked Prisma client
 */
jest.unstable_mockModule('../../config/database.js', () => ({
  prisma: mockPrisma,
}));

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Factory for creating test room data
 */
class RoomFactory {
  static create(overrides: Partial<any> = {}): any {
    return {
      id: 'room-123',
      roomNumber: '101',
      type: 'DELUXE',
      status: 'AVAILABLE',
      pricePerNight: 150.0,
      capacity: 2,
      amenities: ['WiFi', 'TV'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    };
  }
}

/**
 * Factory for creating test user data
 */
class UserFactory {
  static create(overrides: Partial<any> = {}): any {
    return {
      id: 'user-123',
      email: 'test@example.com',
      role: 'GUEST',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    };
  }
}

/**
 * Factory for creating test reservation data
 */
class ReservationFactory {
  static create(overrides: Partial<any> = {}): any {
    return {
      id: 'reservation-123',
      userId: 'user-123',
      roomId: 'room-123',
      checkInDate: new Date('2024-06-15'),
      checkOutDate: new Date('2024-06-20'),
      status: ReservationStatus.PENDING,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      user: UserFactory.create(),
      room: RoomFactory.create(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, (_, i) =>
      ReservationFactory.create({
        id: `reservation-${i + 1}`,
        ...overrides,
      })
    );
  }
}

// =============================================================================
// TEST SUITE SETUP
// =============================================================================

describe('ReservationService', () => {
  let reservationService: ReservationService;

  beforeEach(() => {
    // Create fresh service instance for each test
    reservationService = new ReservationService();

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset mock implementations
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  });

  afterEach(() => {
    // Ensure no lingering mock state
    jest.restoreAllMocks();
  });

  // =============================================================================
  // ROOM AVAILABILITY TESTS
  // =============================================================================

  describe('checkRoomAvailability', () => {
    const checkIn = new Date('2024-06-15');
    const checkOut = new Date('2024-06-20');
    const roomId = 'room-123';

    describe('✅ Success Scenarios', () => {
      it('should return true when room is available with no overlapping reservations', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(true);
        expect(mockPrisma.room.findUnique).toHaveBeenCalledWith({
          where: { id: roomId },
          select: { id: true, status: true, roomNumber: true },
        });
        expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              roomId,
              status: {
                in: [
                  ReservationStatus.PENDING,
                  ReservationStatus.CONFIRMED,
                  ReservationStatus.CHECKED_IN,
                ],
              },
            }),
          })
        );
      });

      it('should return true when existing reservations do not overlap', async () => {
        // Arrange - Reservation before the requested period
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const existingReservation = ReservationFactory.create({
          roomId,
          checkInDate: new Date('2024-06-01'),
          checkOutDate: new Date('2024-06-10'),
          status: ReservationStatus.CONFIRMED,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when cancelled reservations exist in the date range', async () => {
        // Arrange - Cancelled reservation should not block availability
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(true);
      });
    });

    describe('❌ Unavailable Scenarios', () => {
      it('should return false when room status is not AVAILABLE', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'OCCUPIED' });
        mockPrisma.room.findUnique.mockResolvedValue(room);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(false);
        expect(mockPrisma.reservation.findMany).not.toHaveBeenCalled();
      });

      it('should return false when overlapping confirmed reservation exists', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const overlappingReservation = ReservationFactory.create({
          roomId,
          checkInDate: new Date('2024-06-17'),
          checkOutDate: new Date('2024-06-22'),
          status: ReservationStatus.CONFIRMED,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([overlappingReservation]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when overlapping pending reservation exists', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const overlappingReservation = ReservationFactory.create({
          roomId,
          checkInDate: new Date('2024-06-18'),
          checkOutDate: new Date('2024-06-25'),
          status: ReservationStatus.PENDING,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([overlappingReservation]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when checked-in reservation exists', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const overlappingReservation = ReservationFactory.create({
          roomId,
          checkInDate: new Date('2024-06-14'),
          checkOutDate: new Date('2024-06-16'),
          status: ReservationStatus.CHECKED_IN,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([overlappingReservation]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when requested period is completely within existing reservation', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const overlappingReservation = ReservationFactory.create({
          roomId,
          checkInDate: new Date('2024-06-10'),
          checkOutDate: new Date('2024-06-25'),
          status: ReservationStatus.CONFIRMED,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([overlappingReservation]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('🚨 Error Scenarios', () => {
      it('should throw RoomNotFoundError when room does not exist', async () => {
        // Arrange
        mockPrisma.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          reservationService.checkRoomAvailability(roomId, checkIn, checkOut)
        ).rejects.toThrow(RoomNotFoundError);
        await expect(
          reservationService.checkRoomAvailability(roomId, checkIn, checkOut)
        ).rejects.toThrow(`Room with ID ${roomId} not found`);
      });

      it('should throw DateValidationError when check-out is before check-in', async () => {
        // Arrange
        const invalidCheckOut = new Date('2024-06-10');

        // Act & Assert
        await expect(
          reservationService.checkRoomAvailability(roomId, checkIn, invalidCheckOut)
        ).rejects.toThrow(DateValidationError);
      });

      it('should throw DateValidationError when check-in is in the past', async () => {
        // Arrange
        const pastCheckIn = new Date('2020-01-01');
        const pastCheckOut = new Date('2020-01-05');

        // Act & Assert
        await expect(
          reservationService.checkRoomAvailability(roomId, pastCheckIn, pastCheckOut)
        ).rejects.toThrow(DateValidationError);
      });

      it('should throw ReservationServiceError when database query fails', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockRejectedValue(
          new Error('Database connection failed')
        );

        // Act & Assert
        await expect(
          reservationService.checkRoomAvailability(roomId, checkIn, checkOut)
        ).rejects.toThrow(ReservationServiceError);
        await expect(
          reservationService.checkRoomAvailability(roomId, checkIn, checkOut)
        ).rejects.toThrow('Failed to check room availability');
      });
    });

    describe('🎯 Edge Cases', () => {
      it('should handle same-day check-in and check-out boundary correctly', async () => {
        // Arrange - Existing reservation ends on requested check-in date
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const existingReservation = ReservationFactory.create({
          roomId,
          checkInDate: new Date('2024-06-10'),
          checkOutDate: new Date('2024-06-15'), // Same as requested check-in
          status: ReservationStatus.CONFIRMED,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert - Should be available (no overlap at boundaries)
        expect(result).toBe(true);
      });

      it('should handle multiple non-overlapping reservations', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);

        // Act
        const result = await reservationService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        // Assert
        expect(result).toBe(true);
      });
    });
  });

  // =============================================================================
  // CREATE RESERVATION TESTS
  // =============================================================================

  describe('createReservation', () => {
    const userId = 'user-123';
    const roomId = 'room-123';
    const checkInDate = '2024-06-15';
    const checkOutDate = '2024-06-20';

    const createReservationDto: CreateReservationDto = {
      roomId,
      checkInDate,
      checkOutDate,
    };

    describe('✅ Success Scenarios', () => {
      it('should create reservation when room is available', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const createdReservation = ReservationFactory.create({
          userId,
          roomId,
          checkInDate: new Date(checkInDate),
          checkOutDate: new Date(checkOutDate),
          status: ReservationStatus.PENDING,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);
        mockPrisma.reservation.create.mockResolvedValue(createdReservation);

        // Act
        const result = await reservationService.createReservation(
          userId,
          createReservationDto
        );

        // Assert
        expect(result).toEqual(createdReservation);
        expect(result.status).toBe(ReservationStatus.PENDING);
        expect(result.userId).toBe(userId);
        expect(result.roomId).toBe(roomId);
        expect(mockPrisma.reservation.create).toHaveBeenCalledWith({
          data: {
            userId,
            roomId,
            checkInDate: new Date(checkInDate),
            checkOutDate: new Date(checkOutDate),
            status: ReservationStatus.PENDING,
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
      });

      it('should create reservation with transaction for data consistency', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const createdReservation = ReservationFactory.create({
          userId,
          roomId,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);
        mockPrisma.reservation.create.mockResolvedValue(createdReservation);

        // Act
        await reservationService.createReservation(userId, createReservationDto);

        // Assert
        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('should include user and room details in created reservation', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const user = UserFactory.create({ id: userId });
        const createdReservation = ReservationFactory.create({
          userId,
          roomId,
          user,
          room,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);
        mockPrisma.reservation.create.mockResolvedValue(createdReservation);

        // Act
        const result = await reservationService.createReservation(
          userId,
          createReservationDto
        );

        // Assert
        expect(result.user).toBeDefined();
        expect(result.room).toBeDefined();
        expect(result.user.id).toBe(userId);
        expect(result.room.id).toBe(roomId);
      });
    });

    describe('❌ Failure Scenarios', () => {
      it('should throw RoomNotAvailableError when room is not available', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const overlappingReservation = ReservationFactory.create({
          roomId,
          status: ReservationStatus.CONFIRMED,
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([overlappingReservation]);

        // Act & Assert
        await expect(
          reservationService.createReservation(userId, createReservationDto)
        ).rejects.toThrow(RoomNotAvailableError);
        await expect(
          reservationService.createReservation(userId, createReservationDto)
        ).rejects.toThrow(/is not available from/);
      });

      it('should throw RoomNotFoundError when room does not exist', async () => {
        // Arrange
        mockPrisma.room.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          reservationService.createReservation(userId, createReservationDto)
        ).rejects.toThrow(RoomNotFoundError);
      });

      it('should throw DateValidationError for invalid date range', async () => {
        // Arrange
        const invalidDto: CreateReservationDto = {
          roomId,
          checkInDate: '2024-06-20',
          checkOutDate: '2024-06-15', // Before check-in
        };

        // Act & Assert
        await expect(
          reservationService.createReservation(userId, invalidDto)
        ).rejects.toThrow(DateValidationError);
      });

      it('should throw DateValidationError for past check-in date', async () => {
        // Arrange
        const pastDto: CreateReservationDto = {
          roomId,
          checkInDate: '2020-01-01',
          checkOutDate: '2020-01-05',
        };

        // Act & Assert
        await expect(
          reservationService.createReservation(userId, pastDto)
        ).rejects.toThrow(DateValidationError);
      });

      it('should throw ReservationServiceError when database operation fails', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);
        mockPrisma.reservation.create.mockRejectedValue(
          new Error('Database error')
        );

        // Act & Assert
        await expect(
          reservationService.createReservation(userId, createReservationDto)
        ).rejects.toThrow(ReservationServiceError);
        await expect(
          reservationService.createReservation(userId, createReservationDto)
        ).rejects.toThrow('Failed to create reservation');
      });
    });

    describe('🎯 Edge Cases', () => {
      it('should handle minimum stay of 1 night', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const oneNightDto: CreateReservationDto = {
          roomId,
          checkInDate: '2024-06-15',
          checkOutDate: '2024-06-16',
        };
        const createdReservation = ReservationFactory.create({
          checkInDate: new Date('2024-06-15'),
          checkOutDate: new Date('2024-06-16'),
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);
        mockPrisma.reservation.create.mockResolvedValue(createdReservation);

        // Act
        const result = await reservationService.createReservation(userId, oneNightDto);

        // Assert
        expect(result).toBeDefined();
        expect(result.checkInDate).toEqual(new Date('2024-06-15'));
        expect(result.checkOutDate).toEqual(new Date('2024-06-16'));
      });

      it('should handle long-term reservations', async () => {
        // Arrange
        const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
        const longTermDto: CreateReservationDto = {
          roomId,
          checkInDate: '2024-06-01',
          checkOutDate: '2024-12-31',
        };
        const createdReservation = ReservationFactory.create({
          checkInDate: new Date('2024-06-01'),
          checkOutDate: new Date('2024-12-31'),
        });

        mockPrisma.room.findUnique.mockResolvedValue(room);
        mockPrisma.reservation.findMany.mockResolvedValue([]);
        mockPrisma.reservation.create.mockResolvedValue(createdReservation);

        // Act
        const result = await reservationService.createReservation(userId, longTermDto);

        // Assert
        expect(result).toBeDefined();
      });
    });
  });

  // =============================================================================
  // GET RESERVATIONS TESTS
  // =============================================================================

  describe('getReservations', () => {
    const userId = 'user-123';
    const adminId = 'admin-123';

    describe('✅ Guest User Access', () => {
      it('should return only user own reservations for guests', async () => {
        // Arrange
        const userReservations = ReservationFactory.createMany(3, { userId });
        const filters: ReservationFilterDto = {};

        mockPrisma.reservation.findMany.mockResolvedValue(userReservations);
        mockPrisma.reservation.count.mockResolvedValue(3);

        // Act
        const result = await reservationService.getReservations(
          filters,
          userId,
          false
        );

        // Assert
        expect(result.data).toHaveLength(3);
        expect(result.data.every((r) => r.userId === userId)).toBe(true);
        expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ userId }),
          })
        );
      });

      it('should ignore userId filter for guest users', async () => {
        // Arrange
        const userReservations = ReservationFactory.createMany(2, { userId });
        const filters: ReservationFilterDto = {
          userId: 'other-user-123', // Should be ignored
        };

        mockPrisma.reservation.findMany.mockResolvedValue(userReservations);
        mockPrisma.reservation.count.mockResolvedValue(2);

        // Act
        const result = await reservationService.getReservations(
          filters,
          userId,
          false
        );

        // Assert
        expect(result.data.every((r) => r.userId === userId)).toBe(true);
      });

      it('should apply status filter for guest users', async () => {
        // Arrange
        const confirmedReservations = ReservationFactory.createMany(2, {
          userId,
          status: ReservationStatus.CONFIRMED,
        });
        const filters: ReservationFilterDto = {
          status: ReservationStatus.CONFIRMED,
        };

        mockPrisma.reservation.findMany.mockResolvedValue(confirmedReservations);
        mockPrisma.reservation.count.mockResolvedValue(2);

        // Act
        const result = await reservationService.getReservations(
          filters,
          userId,
          false
        );

        // Assert
        expect(result.data.every((r) => r.status === ReservationStatus.CONFIRMED)).toBe(
          true
        );
        expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId,
              status: ReservationStatus.CONFIRMED,
            }),
          })
        );
      });
    });

    describe('✅ Admin User Access', () => {
      it('should return all reservations for admin users', async () => {
        // Arrange
        const allReservations = [
          ...ReservationFactory.createMany(2, { userId: 'user-1' }),
          ...ReservationFactory.createMany(2, { userId: 'user-2' }),
        ];
        const filters: ReservationFilterDto = {};

        mockPrisma.reservation.findMany.mockResolvedValue(allReservations);
        mockPrisma.reservation.count.mockResolvedValue(4);

        // Act
        const result = await reservationService.getReservations(
          filters,
          adminId,
          true
        );

        // Assert
        expect(result.data).toHaveLength(4);
        expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.not.objectContaining({ userId: adminId }),
          })
        );
      });

      it('should filter by userId when specified by admin', async () => {
        // Arrange
        const targetUserId = 'target-user-123';
        const userReservations = ReservationFactory.createMany(3, {
          userId: targetUserId,
        });
        const filters: ReservationFilterDto = {
          userId: targetUserId,
        };

        mockPrisma.reservation.findMany.mockResolvedValue(userReservations);
        mockPrisma.reservation.count.mockResolvedValue(3);

        // Act
        const result = await reservationService.getReservations(
          filters,
          adminId,
          true
        );

        // Assert
        expect(result.data.every((r) => r.userId === targetUserId)).toBe(true);
        expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ userId: targetUserId }),
          })
        );
      });

      it('should filter by roomId when specified', async () => {
        // Arrange
        const targetRoomId = 'room-456';
        const roomReservations = ReservationFactory.createMany(2, {
          roomId: targetRoomId,
        });
        const filters: ReservationFilterDto = {
          roomId: targetRoomId,
        };

        mockPrisma.reservation.findMany.mockResolvedValue(roomReservations);
        mockPrisma.reservation.count.mockResolvedValue(2);

        // Act
        const result = await reservationService.getReservations(
          filters,
          adminId,
          true
        );

        // Assert
        expect(result.data.every((r) => r.roomId === targetRoomId)).toBe(true);
      });

      it('should filter by date range when specified', async () => {
        // Arrange
        const dateRangeReservations = ReservationFactory.createMany(2, {
          checkInDate: new Date('2024-06-15'),
          checkOutDate: new Date('2024-06-20'),
        });
        const filters: ReservationFilterDto = {
          dateRange: {
            from: '2024-06-01',
            to: '2024-06-30',
          },
        };

        mockPrisma.reservation.findMany.mockResolvedValue(dateRangeReservations);
        mockPrisma.reservation.count.mockResolvedValue(2);

        // Act
        const result = await reservationService.getReservations(
          filters,
          adminId,
          true
        );

        // Assert
        expect(result.data).toHaveLength(2);
        expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              AND: expect.arrayContaining([
                { checkInDate: { gte: new Date('2024-06-01') } },
                { checkOutDate: { lte: new Date('2024-06-30') } },
              ]),
            }),
          })
        );
      });
    });

    describe('📊 Pagination', () => {
      it('should return paginated results with default values', async () => {
        // Arrange
        const reservations = ReservationFactory.createMany(20, { userId });
        const filters: ReservationFilterDto = {};

        mockPrisma.reservation.findMany.mockResolvedValue(reservations);
        mockPrisma.reservation.count.mockResolvedValue(50);

        // Act
        const result = await reservationService.getReservations(
          filters,
          userId,
          false
        );

        // Assert
        expect(result.meta.page).toBe(1);
        expect(result.meta.limit).toBe(20);
        expect(result.meta.total).toBe(50);
        expect(result.meta.totalPages).toBe(3);
        expect(result.meta.hasNextPage).toBe(true);
        expect(result.meta.hasPreviousPage).toBe(false);
      });

      it('should handle custom page and limit', async () => {
        // Arrange
        const reservations = ReservationFactory.createMany(10, { userId });
        const filters: ReservationFilterDto = {
          page: 2,
          limit: 10,
        };

        mockPrisma.reservation.findMany.mockResolvedValue(reservations);
        mockPrisma.reservation.count.mockResolvedValue(25);

        // Act
        const result = await reservationService.getReservations(
          filters,
          userId,
          false
        );

        // Assert
        expect(result.meta.page).toBe(2);
        expect(result.meta.limit).toBe(10);
        expect(result.meta.totalPages).toBe(3);
        expect(result.meta.hasNextPage).toBe(true);
        expect(result.meta.hasPreviousPage).toBe(true);
        expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10,
            take: 10,
          })
        );
      });

      it('should enforce maximum limit', async () => {
        // Arrange
        const reservations = ReservationFactory.createMany(50, { userId });
        const filters: ReservationFilterDto = {
          limit: 200, // Exceeds max limit
        };

        mockPrisma.reservation.findMany.mockResolvedValue(reservations);
        mockPrisma.reservation.count.mockResolvedValue(100);

        // Act
        const result = await reservationService.getReservations(
          filters,
          userId,
          false
        );

        // Assert
        expect(result.meta.limit).toBeLessThanOrEqual(100);
      });

      it('should handle last page correctly', async () => {
        // Arrange
        const reservations = ReservationFactory.createMany(5, { userId });
        const filters: ReservationFilterDto = {
          page: 3,
          limit: 10,
        };

        mockPrisma.reservation.findMany.mockResolvedValue(reservations);
        mockPrisma.reservation.count.mockResolvedValue(25);

        // Act
        const result = await reservationService.getReservations(
          filters,
          userId,
          false
        );

        // Assert
        expect(result.meta.hasNextPage).toBe(false);
        expect(result.meta.hasPreviousPage).toBe(true);
      });

      it('should handle empty results', async () => {
        // Arrange
        const filters: ReservationFilterDto = {};

        mockPrisma.reservation.findMany.mockResolvedValue([]);
        mockPrisma.reservation.count.mockResolvedValue(0);

        // Act
        const result = await reservationService.getReservations(
          filters,
          userId,
          false
        );

        // Assert
        expect(result.data).toHaveLength(0);
        expect(result.meta.total).toBe(0);
        expect(result.meta.totalPages).toBe(0);
        expect(result.meta.hasNextPage).toBe(false);
        expect(result.meta.hasPreviousPage).toBe(false);
      });
    });

    describe('🚨 Error Scenarios', () => {
      it('should throw ReservationServiceError when database query fails', async () => {
        // Arrange
        const filters: ReservationFilterDto = {};
        mockPrisma.reservation.findMany.mockRejectedValue(
          new Error('Database error')
        );

        // Act & Assert
        await expect(
          reservationService.getReservations(filters, userId, false)
        ).rejects.toThrow(ReservationServiceError);
        await expect(
          reservationService.getReservations(filters, userId, false)
        ).rejects.toThrow('Failed to fetch reservations');
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
      it('should return reservation for owner', async () => {
        // Arrange
        const reservation = ReservationFactory.create({
          id: reservationId,
          userId,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

        // Act
        const result = await reservationService.getReservationById(
          reservationId,
          userId,
          false
        );

        // Assert
        expect(result).toEqual(reservation);
        expect(result.id).toBe(reservationId);
        expect(result.userId).toBe(userId);
      });

      it('should return reservation for admin regardless of ownership', async () => {
        // Arrange
        const reservation = ReservationFactory.create({
          id: reservationId,
          userId: 'other-user-123',
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

        // Act
        const result = await reservationService.getReservationById(
          reservationId,
          adminId,
          true
        );

        // Assert
        expect(result).toEqual(reservation);
        expect(result.userId).not.toBe(adminId);
      });

      it('should include user and room details', async () => {
        // Arrange
        const reservation = ReservationFactory.create({
          id: reservationId,
          userId,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

        // Act
        const result = await reservationService.getReservationById(
          reservationId,
          userId,
          false
        );

        // Assert
        expect(result.user).toBeDefined();
        expect(result.room).toBeDefined();
      });
    });

    describe('❌ Failure Scenarios', () => {
      it('should throw ReservationNotFoundError when reservation does not exist', async () => {
        // Arrange
        mockPrisma.reservation.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          reservationService.getReservationById(reservationId, userId, false)
        ).rejects.toThrow(ReservationNotFoundError);
        await expect(
          reservationService.getReservationById(reservationId, userId, false)
        ).rejects.toThrow(`Reservation with ID ${reservationId} not found`);
      });

      it('should throw UnauthorizedReservationAccessError when guest accesses other user reservation', async () => {
        // Arrange
        const reservation = ReservationFactory.create({
          id: reservationId,
          userId: 'other-user-123',
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

        // Act & Assert
        await expect(
          reservationService.getReservationById(reservationId, userId, false)
        ).rejects.toThrow(UnauthorizedReservationAccessError);
        await expect(
          reservationService.getReservationById(reservationId, userId, false)
        ).rejects.toThrow(`User ${userId} is not authorized to access reservation`);
      });

      it('should throw ReservationServiceError when database query fails', async () => {
        // Arrange
        mockPrisma.reservation.findUnique.mockRejectedValue(
          new Error('Database error')
        );

        // Act & Assert
        await expect(
          reservationService.getReservationById(reservationId, userId, false)
        ).rejects.toThrow(ReservationServiceError);
        await expect(
          reservationService.getReservationById(reservationId, userId, false)
        ).rejects.toThrow('Failed to fetch reservation');
      });
    });
  });

  // =============================================================================
  // CONFIRM RESERVATION TESTS
  // =============================================================================

  describe('confirmReservation', () => {
    const reservationId = 'reservation-123';

    describe('✅ Success Scenarios', () => {
      it('should confirm pending reservation', async () => {
        // Arrange
        const pendingReservation = ReservationFactory.create({
          id: reservationId,
          status: ReservationStatus.PENDING,
        });
        const confirmedReservation = {
          ...pendingReservation,
          status: ReservationStatus.CONFIRMED,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
        mockPrisma.reservation.update.mockResolvedValue(confirmedReservation);

        // Act
        const result = await reservationService.confirmReservation(reservationId);

        // Assert
        expect(result.status).toBe(ReservationStatus.CONFIRMED);
        expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
          where: { id: reservationId },
          data: { status: ReservationStatus.CONFIRMED },
          include: expect.any(Object),
        });
      });
    });

    describe('❌ Failure Scenarios', () => {
      it('should throw ReservationNotFoundError when reservation does not exist', async () => {
        // Arrange
        mockPrisma.reservation.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          reservationService.confirmReservation(reservationId)
        ).rejects.toThrow(ReservationNotFoundError);
      });

      it('should throw InvalidStatusTransitionError when confirming non-pending reservation', async () => {
        // Arrange
        const confirmedReservation = ReservationFactory.create({
          id: reservationId,
          status: ReservationStatus.CONFIRMED,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);

        // Act & Assert
        await expect(
          reservationService.confirmReservation(reservationId)
        ).rejects.toThrow(InvalidStatusTransitionError);
        await expect(
          reservationService.confirmReservation(reservationId)
        ).rejects.toThrow(/Cannot transition from CONFIRMED to CONFIRMED/);
      });

      it('should throw InvalidStatusTransitionError when confirming cancelled reservation', async () => {
        // Arrange
        const cancelledReservation = ReservationFactory.create({
          id: reservationId,
          status: ReservationStatus.CANCELLED,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(cancelledReservation);

        // Act & Assert
        await expect(
          reservationService.confirmReservation(reservationId)
        ).rejects.toThrow(InvalidStatusTransitionError);
      });

      it('should throw ReservationServiceError when database update fails', async () => {
        // Arrange
        const pendingReservation = ReservationFactory.create({
          id: reservationId,
          status: ReservationStatus.PENDING,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
        mockPrisma.reservation.update.mockRejectedValue(new Error('Database error'));

        // Act & Assert
        await expect(
          reservationService.confirmReservation(reservationId)
        ).rejects.toThrow(ReservationServiceError);
        await expect(
          reservationService.confirmReservation(reservationId)
        ).rejects.toThrow('Failed to confirm reservation');
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
      it('should check in confirmed reservation and update room status', async () => {
        // Arrange
        const confirmedReservation = ReservationFactory.create({
          id: reservationId,
          roomId,
          status: ReservationStatus.CONFIRMED,
        });
        const checkedInReservation = {
          ...confirmedReservation,
          status: ReservationStatus.CHECKED_IN,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);
        mockPrisma.reservation.update.mockResolvedValue(checkedInReservation);
        mockPrisma.room.update.mockResolvedValue(RoomFactory.create({ status: 'OCCUPIED' }));

        // Act
        const result = await reservationService.checkIn(reservationId);

        // Assert
        expect(result.status).toBe(ReservationStatus.CHECKED_IN);
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
          where: { id: reservationId },
          data: { status: ReservationStatus.CHECKED_IN },
          include: expect.any(Object),
        });
        expect(mockPrisma.room.update).toHaveBeenCalledWith({
          where: { id: roomId },
          data: { status: 'OCCUPIED' },
        });
      });

      it('should execute check-in in transaction for atomicity', async () => {
        // Arrange
        const confirmedReservation = ReservationFactory.create({
          id: reservationId,
          roomId,
          status: ReservationStatus.CONFIRMED,
        });
        const checkedInReservation = {
          ...confirmedReservation,
          status: ReservationStatus.CHECKED_IN,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);
        mockPrisma.reservation.update.mockResolvedValue(checkedInReservation);
        mockPrisma.room.update.mockResolvedValue(RoomFactory.create());

        // Act
        await reservationService.checkIn(reservationId);

        // Assert
        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });

    describe('❌ Failure Scenarios', () => {
      it('should throw ReservationNotFoundError when reservation does not exist', async () => {
        // Arrange
        mockPrisma.reservation.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(reservationService.checkIn(reservationId)).rejects.toThrow(
          ReservationNotFoundError
        );
      });

      it('should throw InvalidStatusTransitionError when checking in pending reservation', async () => {
        // Arrange
        const pendingReservation = ReservationFactory.create({
          id: reservationId,
          status: ReservationStatus.PENDING,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);

        // Act & Assert
        await expect(reservationService.checkIn(reservationId)).rejects.toThrow(
          InvalidStatusTransitionError
        );
        await expect(reservationService.checkIn(reservationId)).rejects.toThrow(
          /Cannot transition from PENDING to CHECKED_IN/
        );
      });

      it('should throw InvalidStatusTransitionError when checking in cancelled reservation', async () => {
        // Arrange
        const cancelledReservation = ReservationFactory.create({
          id: reservationId,
          status: ReservationStatus.CANCELLED,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(cancelledReservation);

        // Act & Assert
        await expect(reservationService.checkIn(reservationId)).rejects.toThrow(
          InvalidStatusTransitionError
        );
      });

      it('should throw ReservationServiceError when transaction fails', async () => {
        // Arrange
        const confirmedReservation = ReservationFactory.create({
          id: reservationId,
          roomId,
          status: ReservationStatus.CONFIRMED,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);
        mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

        // Act & Assert
        await expect(reservationService.checkIn(reservationId)).rejects.toThrow(
          ReservationServiceError
        );
        await expect(reservationService.checkIn(reservationId)).rejects.toThrow(
          'Failed to process check-in'
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
      it('should check out checked-in reservation and update room status', async () => {
        // Arrange
        const checkedInReservation = ReservationFactory.create({
          id: reservationId,
          roomId,
          status: ReservationStatus.CHECKED_IN,
        });
        const checkedOutReservation = {
          ...checkedInReservation,
          status: ReservationStatus.CHECKED_OUT,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(checkedInReservation);
        mockPrisma.reservation.update.mockResolvedValue(checkedOutReservation);
        mockPrisma.room.update.mockResolvedValue(RoomFactory.create({ status: 'AVAILABLE' }));

        // Act
        const result = await reservationService.checkOut(reservationId);

        // Assert
        expect(result.status).toBe(ReservationStatus.CHECKED_OUT);
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
          where: { id: reservationId },
          data: { status: ReservationStatus.CHECKED_OUT },
          include: expect.any(Object),
        });
        expect(mockPrisma.room.update).toHaveBeenCalledWith({
          where: { id: roomId },
          data: { status: 'AVAILABLE' },
        });
      });

      it('should execute check-out in transaction for atomicity', async () => {
        // Arrange
        const checkedInReservation = ReservationFactory.create({
          id: reservationId,
          roomId,
          status: ReservationStatus.CHECKED_IN,
        });
        const checkedOutReservation = {
          ...checkedInReservation,
          status: ReservationStatus.CHECKED_OUT,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(checkedInReservation);
        mockPrisma.reservation.update.mockResolvedValue(checkedOutReservation);
        mockPrisma.room.update.mockResolvedValue(RoomFactory.create());

        // Act
        await reservationService.checkOut(reservationId);

        // Assert
        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });

    describe('❌ Failure Scenarios', () => {
      it('should throw ReservationNotFoundError when reservation does not exist', async () => {
        // Arrange
        mockPrisma.reservation.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(reservationService.checkOut(reservationId)).rejects.toThrow(
          ReservationNotFoundError
        );
      });

      it('should throw InvalidStatusTransitionError when checking out pending reservation', async () => {
        // Arrange
        const pendingReservation = ReservationFactory.create({
          id: reservationId,
          status: ReservationStatus.PENDING,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);

        // Act & Assert
        await expect(reservationService.checkOut(reservationId)).rejects.toThrow(
          InvalidStatusTransitionError
        );
        await expect(reservationService.checkOut(reservationId)).rejects.toThrow(
          /Cannot transition from PENDING to CHECKED_OUT/
        );
      });

      it('should throw InvalidStatusTransitionError when checking out confirmed reservation', async () => {
        // Arrange
        const confirmedReservation = ReservationFactory.create({
          id: reservationId,
          status: ReservationStatus.CONFIRMED,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);

        // Act & Assert
        await expect(reservationService.checkOut(reservationId)).rejects.toThrow(
          InvalidStatusTransitionError
        );
      });

      it('should throw ReservationServiceError when transaction fails', async () => {
        // Arrange
        const checkedInReservation = ReservationFactory.create({
          id: reservationId,
          roomId,
          status: ReservationStatus.CHECKED_IN,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(checkedInReservation);
        mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

        // Act & Assert
        await expect(reservationService.checkOut(reservationId)).rejects.toThrow(
          ReservationServiceError
        );
        await expect(reservationService.checkOut(reservationId)).rejects.toThrow(
          'Failed to process check-out'
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
    const roomId = 'room-123';

    describe('✅ Success Scenarios', () => {
      it('should cancel pending reservation by owner', async () => {
        // Arrange
        const pendingReservation = ReservationFactory.create({
          id: reservationId,
          userId,
          roomId,
          status: ReservationStatus.PENDING,
        });
        const cancelledReservation = {
          ...pendingReservation,
          status: ReservationStatus.CANCELLED,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
        mockPrisma.reservation.update.mockResolvedValue(cancelledReservation);

        // Act
        const result = await reservationService.cancelReservation(
          reservationId,
          userId
        );

        // Assert
        expect(result.status).toBe(ReservationStatus.CANCELLED);
        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('should cancel confirmed reservation by owner', async () => {
        // Arrange
        const confirmedReservation = ReservationFactory.create({
          id: reservationId,
          userId,
          roomId,
          status: ReservationStatus.CONFIRMED,
        });
        const cancelledReservation = {
          ...confirmedReservation,
          status: ReservationStatus.CANCELLED,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);
        mockPrisma.reservation.update.mockResolvedValue(cancelledReservation);

        // Act
        const result = await reservationService.cancelReservation(
          reservationId,
          userId
        );

        // Assert
        expect(result.status).toBe(ReservationStatus.CANCELLED);
      });

      it('should cancel checked-in reservation and make room available', async () => {
        // Arrange
        const checkedInReservation = ReservationFactory.create({
          id: reservationId,
          userId,
          roomId,
          status: ReservationStatus.CHECKED_IN,
        });
        const cancelledReservation = {
          ...checkedInReservation,
          status: ReservationStatus.CANCELLED,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(checkedInReservation);
        mockPrisma.reservation.update.mockResolvedValue(cancelledReservation);
        mockPrisma.room.update.mockResolvedValue(RoomFactory.create({ status: 'AVAILABLE' }));

        // Act
        const result = await reservationService.cancelReservation(
          reservationId,
          userId
        );

        // Assert
        expect(result.status).toBe(ReservationStatus.CANCELLED);
        expect(mockPrisma.room.update).toHaveBeenCalledWith({
          where: { id: roomId },
          data: { status: 'AVAILABLE' },
        });
      });

      it('should not update room status when cancelling non-checked-in reservation', async () => {
        // Arrange
        const pendingReservation = ReservationFactory.create({
          id: reservationId,
          userId,
          roomId,
          status: ReservationStatus.PENDING,
        });
        const cancelledReservation = {
          ...pendingReservation,
          status: ReservationStatus.CANCELLED,
        };

        mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
        mockPrisma.reservation.update.mockResolvedValue(cancelledReservation);

        // Act
        await reservationService.cancelReservation(reservationId, userId);

        // Assert
        expect(mockPrisma.room.update).not.toHaveBeenCalled();
      });
    });

    describe('❌ Failure Scenarios', () => {
      it('should throw ReservationNotFoundError when reservation does not exist', async () => {
        // Arrange
        mockPrisma.reservation.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          reservationService.cancelReservation(reservationId, userId)
        ).rejects.toThrow(ReservationNotFoundError);
      });

      it('should throw UnauthorizedReservationAccessError when user is not owner', async () => {
        // Arrange
        const reservation = ReservationFactory.create({
          id: reservationId,
          userId: 'other-user-123',
          status: ReservationStatus.PENDING,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

        // Act & Assert
        await expect(
          reservationService.cancelReservation(reservationId, userId)
        ).rejects.toThrow(UnauthorizedReservationAccessError);
        await expect(
          reservationService.cancelReservation(reservationId, userId)
        ).rejects.toThrow(`User ${userId} is not authorized to access reservation`);
      });

      it('should throw InvalidStatusTransitionError when cancelling checked-out reservation', async () => {
        // Arrange
        const checkedOutReservation = ReservationFactory.create({
          id: reservationId,
          userId,
          status: ReservationStatus.CHECKED_OUT,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(checkedOutReservation);

        // Act & Assert
        await expect(
          reservationService.cancelReservation(reservationId, userId)
        ).rejects.toThrow(InvalidStatusTransitionError);
        await expect(
          reservationService.cancelReservation(reservationId, userId)
        ).rejects.toThrow(/Cannot transition from CHECKED_OUT to CANCELLED/);
      });

      it('should throw InvalidStatusTransitionError when cancelling already cancelled reservation', async () => {
        // Arrange
        const cancelledReservation = ReservationFactory.create({
          id: reservationId,
          userId,
          status: ReservationStatus.CANCELLED,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(cancelledReservation);

        // Act & Assert
        await expect(
          reservationService.cancelReservation(reservationId, userId)
        ).rejects.toThrow(InvalidStatusTransitionError);
      });

      it('should throw ReservationServiceError when transaction fails', async () => {
        // Arrange
        const pendingReservation = ReservationFactory.create({
          id: reservationId,
          userId,
          roomId,
          status: ReservationStatus.PENDING,
        });
        mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
        mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

        // Act & Assert
        await expect(
          reservationService.cancelReservation(reservationId, userId)
        ).rejects.toThrow(ReservationServiceError);
        await expect(
          reservationService.cancelReservation(reservationId, userId)
        ).rejects.toThrow('Failed to cancel reservation');
      });
    });
  });

  // =============================================================================
  // ERROR CLASS TESTS
  // =============================================================================

  describe('Error Classes', () => {
    describe('ReservationServiceError', () => {
      it('should create error with correct properties', () => {
        // Arrange & Act
        const error = new ReservationServiceError(
          'Test error',
          'TEST_ERROR',
          500
        );

        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ReservationServiceError);
        expect(error.message).toBe('Test error');
        expect(error.code).toBe('TEST_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.name).toBe('ReservationServiceError');
      });

      it('should capture stack trace', () => {
        // Arrange & Act
        const error = new ReservationServiceError(
          'Test error',
          'TEST_ERROR',
          500
        );

        // Assert
        expect(error.stack).toBeDefined();
      });
    });

    describe('ReservationNotFoundError', () => {
      it('should create error with correct properties', () => {
        // Arrange & Act
        const error = new ReservationNotFoundError('reservation-123');

        // Assert
        expect(error).toBeInstanceOf(ReservationServiceError);
        expect(error.message).toBe('Reservation with ID reservation-123 not found');
        expect(error.code).toBe('RESERVATION_NOT_FOUND');
        expect(error.statusCode).toBe(404);
        expect(error.name).toBe('ReservationNotFoundError');
      });
    });

    describe('RoomNotAvailableError', () => {
      it('should create error with correct properties', () => {
        // Arrange
        const checkIn = new Date('2024-06-15');
        const checkOut = new Date('2024-06-20');

        // Act
        const error = new RoomNotAvailableError('room-123', checkIn, checkOut);

        // Assert
        expect(error).toBeInstanceOf(ReservationServiceError);
        expect(error.message).toContain('Room room-123 is not available');
        expect(error.code).toBe('ROOM_NOT_AVAILABLE');
        expect(error.statusCode).toBe(409);
        expect(error.name).toBe('RoomNotAvailableError');
      });
    });

    describe('InvalidStatusTransitionError', () => {
      it('should create error with correct properties', () => {
        // Arrange & Act
        const error = new InvalidStatusTransitionError(
          ReservationStatus.PENDING,
          ReservationStatus.CHECKED_OUT
        );

        // Assert
        expect(error).toBeInstanceOf(ReservationServiceError);
        expect(error.message).toBe('Cannot transition from PENDING to CHECKED_OUT');
        expect(error.code).toBe('INVALID_STATUS_TRANSITION');
        expect(error.statusCode).toBe(400);
        expect(error.name).toBe('InvalidStatusTransitionError');
      });
    });

    describe('UnauthorizedReservationAccessError', () => {
      it('should create error with correct properties', () => {
        // Arrange & Act
        const error = new UnauthorizedReservationAccessError(
          'user-123',
          'reservation-456'
        );

        // Assert
        expect(error).toBeInstanceOf(ReservationServiceError);
        expect(error.message).toBe(
          'User user-123 is not authorized to access reservation reservation-456'
        );
        expect(error.code).toBe('UNAUTHORIZED_ACCESS');
        expect(error.statusCode).toBe(403);
        expect(error.name).toBe('UnauthorizedReservationAccessError');
      });
    });

    describe('RoomNotFoundError', () => {
      it('should create error with correct properties', () => {
        // Arrange & Act
        const error = new RoomNotFoundError('room-123');

        // Assert
        expect(error).toBeInstanceOf(ReservationServiceError);
        expect(error.message).toBe('Room with ID room-123 not found');
        expect(error.code).toBe('ROOM_NOT_FOUND');
        expect(error.statusCode).toBe(404);
        expect(error.name).toBe('RoomNotFoundError');
      });
    });
  });

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete reservation lifecycle', async () => {
      // Arrange
      const userId = 'user-123';
      const roomId = 'room-123';
      const createDto: CreateReservationDto = {
        roomId,
        checkInDate: '2024-06-15',
        checkOutDate: '2024-06-20',
      };

      const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
      const pendingReservation = ReservationFactory.create({
        userId,
        roomId,
        status: ReservationStatus.PENDING,
      });
      const confirmedReservation = {
        ...pendingReservation,
        status: ReservationStatus.CONFIRMED,
      };
      const checkedInReservation = {
        ...confirmedReservation,
        status: ReservationStatus.CHECKED_IN,
      };
      const checkedOutReservation = {
        ...checkedInReservation,
        status: ReservationStatus.CHECKED_OUT,
      };

      // Mock sequence
      mockPrisma.room.findUnique.mockResolvedValue(room);
      mockPrisma.reservation.findMany.mockResolvedValue([]);
      mockPrisma.reservation.create.mockResolvedValue(pendingReservation);

      // Act 1: Create reservation
      const created = await reservationService.createReservation(userId, createDto);
      expect(created.status).toBe(ReservationStatus.PENDING);

      // Act 2: Confirm reservation
      mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
      mockPrisma.reservation.update.mockResolvedValue(confirmedReservation);
      const confirmed = await reservationService.confirmReservation(created.id);
      expect(confirmed.status).toBe(ReservationStatus.CONFIRMED);

      // Act 3: Check in
      mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);
      mockPrisma.reservation.update.mockResolvedValue(checkedInReservation);
      mockPrisma.room.update.mockResolvedValue(RoomFactory.create({ status: 'OCCUPIED' }));
      const checkedIn = await reservationService.checkIn(created.id);
      expect(checkedIn.status).toBe(ReservationStatus.CHECKED_IN);

      // Act 4: Check out
      mockPrisma.reservation.findUnique.mockResolvedValue(checkedInReservation);
      mockPrisma.reservation.update.mockResolvedValue(checkedOutReservation);
      mockPrisma.room.update.mockResolvedValue(RoomFactory.create({ status: 'AVAILABLE' }));
      const checkedOut = await reservationService.checkOut(created.id);
      expect(checkedOut.status).toBe(ReservationStatus.CHECKED_OUT);
    });

    it('should prevent double booking', async () => {
      // Arrange
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const roomId = 'room-123';
      const createDto: CreateReservationDto = {
        roomId,
        checkInDate: '2024-06-15',
        checkOutDate: '2024-06-20',
      };

      const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });
      const existingReservation = ReservationFactory.create({
        userId: userId1,
        roomId,
        status: ReservationStatus.CONFIRMED,
      });

      // Mock first booking succeeds
      mockPrisma.room.findUnique.mockResolvedValue(room);
      mockPrisma.reservation.findMany.mockResolvedValue([]);
      mockPrisma.reservation.create.mockResolvedValue(existingReservation);

      // Act 1: First booking
      await reservationService.createReservation(userId1, createDto);

      // Mock second booking fails
      mockPrisma.reservation.findMany.mockResolvedValue([existingReservation]);

      // Act 2: Second booking should fail
      await expect(
        reservationService.createReservation(userId2, createDto)
      ).rejects.toThrow(RoomNotAvailableError);
    });
  });

  // =============================================================================
  // PERFORMANCE TESTS
  // =============================================================================

  describe('Performance', () => {
    it('should handle large result sets efficiently', async () => {
      // Arrange
      const largeDataset = ReservationFactory.createMany(1000, { userId: 'user-123' });
      const filters: ReservationFilterDto = {};

      mockPrisma.reservation.findMany.mockResolvedValue(largeDataset.slice(0, 20));
      mockPrisma.reservation.count.mockResolvedValue(1000);

      // Act
      const startTime = Date.now();
      const result = await reservationService.getReservations(
        filters,
        'user-123',
        false
      );
      const duration = Date.now() - startTime;

      // Assert
      expect(result.data).toHaveLength(20);
      expect(result.meta.total).toBe(1000);
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });

    it('should handle concurrent availability checks', async () => {
      // Arrange
      const roomId = 'room-123';
      const checkIn = new Date('2024-06-15');
      const checkOut = new Date('2024-06-20');
      const room = RoomFactory.create({ id: roomId, status: 'AVAILABLE' });

      mockPrisma.room.findUnique.mockResolvedValue(room);
      mockPrisma.reservation.findMany.mockResolvedValue([]);

      // Act
      const promises = Array.from({ length: 10 }, () =>
        reservationService.checkRoomAvailability(roomId, checkIn, checkOut)
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Assert
      expect(results.every((r) => r === true)).toBe(true);
      expect(duration).toBeLessThan(500); // Should complete in < 500ms
    });
  });
});