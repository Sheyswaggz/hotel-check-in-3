import { ReservationService } from '../../services/reservation.service';
import { PrismaClient, ReservationStatus, UserRole } from '@prisma/client';
import { addDays, startOfDay } from 'date-fns';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    reservation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    ReservationStatus: {
      PENDING: 'PENDING',
      CONFIRMED: 'CONFIRMED',
      CHECKED_IN: 'CHECKED_IN',
      CHECKED_OUT: 'CHECKED_OUT',
      CANCELLED: 'CANCELLED',
      NO_SHOW: 'NO_SHOW',
    },
    UserRole: {
      GUEST: 'GUEST',
      STAFF: 'STAFF',
      ADMIN: 'ADMIN',
    },
  };
});

describe('ReservationService', () => {
  let reservationService: ReservationService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  const mockReservation = {
    id: 'reservation-1',
    guestName: 'John Doe',
    guestEmail: 'john@example.com',
    guestPhone: '+1234567890',
    roomNumber: '101',
    checkInDate: startOfDay(new Date()),
    checkOutDate: startOfDay(addDays(new Date(), 2)),
    numberOfGuests: 2,
    specialRequests: 'Late check-in',
    status: ReservationStatus.PENDING,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    checkedInAt: null,
    checkedInBy: null,
    checkedOutAt: null,
    checkedOutBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
  };

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    reservationService = new ReservationService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('createReservation', () => {
    it('should create a reservation successfully', async () => {
      const reservationData = {
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        guestPhone: '+1234567890',
        roomNumber: '101',
        checkInDate: startOfDay(new Date()),
        checkOutDate: startOfDay(addDays(new Date(), 2)),
        numberOfGuests: 2,
        specialRequests: 'Late check-in',
      };

      mockPrisma.reservation.create.mockResolvedValue(mockReservation);

      const result = await reservationService.createReservation(
        reservationData,
        'user-1'
      );

      expect(result).toEqual(mockReservation);
      expect(mockPrisma.reservation.create).toHaveBeenCalledWith({
        data: {
          ...reservationData,
          createdById: 'user-1',
          status: ReservationStatus.PENDING,
        },
      });
    });

    it('should throw error if check-out date is before check-in date', async () => {
      const invalidData = {
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        guestPhone: '+1234567890',
        roomNumber: '101',
        checkInDate: startOfDay(addDays(new Date(), 2)),
        checkOutDate: startOfDay(new Date()),
        numberOfGuests: 2,
      };

      await expect(
        reservationService.createReservation(invalidData, 'user-1')
      ).rejects.toThrow('Check-out date must be after check-in date');
    });

    it('should throw error if check-in date is in the past', async () => {
      const invalidData = {
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        guestPhone: '+1234567890',
        roomNumber: '101',
        checkInDate: startOfDay(addDays(new Date(), -1)),
        checkOutDate: startOfDay(addDays(new Date(), 2)),
        numberOfGuests: 2,
      };

      await expect(
        reservationService.createReservation(invalidData, 'user-1')
      ).rejects.toThrow('Check-in date cannot be in the past');
    });

    it('should throw error if room is already booked', async () => {
      const reservationData = {
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        guestPhone: '+1234567890',
        roomNumber: '101',
        checkInDate: startOfDay(new Date()),
        checkOutDate: startOfDay(addDays(new Date(), 2)),
        numberOfGuests: 2,
      };

      mockPrisma.reservation.findMany.mockResolvedValue([mockReservation]);

      await expect(
        reservationService.createReservation(reservationData, 'user-1')
      ).rejects.toThrow('Room 101 is not available for the selected dates');
    });
  });

  describe('getReservationById', () => {
    it('should return reservation if found', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);

      const result = await reservationService.getReservationById('reservation-1');

      expect(result).toEqual(mockReservation);
      expect(mockPrisma.reservation.findUnique).toHaveBeenCalledWith({
        where: { id: 'reservation-1' },
      });
    });

    it('should throw error if reservation not found', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        reservationService.getReservationById('non-existent')
      ).rejects.toThrow('Reservation not found');
    });
  });

  describe('cancelReservation', () => {
    it('should cancel reservation successfully', async () => {
      const _cancelledReservation = {
        ...mockReservation,
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: 'user-1',
        cancellationReason: 'Guest request',
      };

      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrisma.reservation.update.mockResolvedValue(_cancelledReservation);

      const result = await reservationService.cancelReservation(
        'reservation-1',
        'user-1',
        'Guest request'
      );

      expect(result.status).toBe(ReservationStatus.CANCELLED);
      expect(mockPrisma.reservation.update).toHaveBeenCalled();
    });

    it('should throw error if reservation not found', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        reservationService.cancelReservation('non-existent', 'user-1')
      ).rejects.toThrow('Reservation not found');
    });

    it('should throw error if reservation is already cancelled', async () => {
      const cancelledReservation = {
        ...mockReservation,
        status: ReservationStatus.CANCELLED,
      };

      mockPrisma.reservation.findUnique.mockResolvedValue(cancelledReservation);

      await expect(
        reservationService.cancelReservation('reservation-1', 'user-1')
      ).rejects.toThrow('Cannot cancel reservation with status: CANCELLED');
    });

    it('should throw error if trying to cancel checked-in reservation', async () => {
      const checkedInReservation = {
        ...mockReservation,
        status: ReservationStatus.CHECKED_IN,
      };

      mockPrisma.reservation.findUnique.mockResolvedValue(checkedInReservation);

      await expect(
        reservationService.cancelReservation('reservation-1', 'user-1')
      ).rejects.toThrow('Cannot cancel reservation with status: CHECKED_IN');
    });
  });

  describe('checkIn', () => {
    it('should check in reservation successfully', async () => {
      const checkedInReservation = {
        ...mockReservation,
        status: ReservationStatus.CHECKED_IN,
        checkedInAt: new Date(),
        checkedInBy: 'user-1',
      };

      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrisma.reservation.update.mockResolvedValue(checkedInReservation);

      const result = await reservationService.checkIn('reservation-1', 'user-1');

      expect(result.status).toBe(ReservationStatus.CHECKED_IN);
      expect(mockPrisma.reservation.update).toHaveBeenCalled();
    });

    it('should throw error if reservation not found', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        reservationService.checkIn('non-existent', 'user-1')
      ).rejects.toThrow('Reservation not found');
    });

    it('should throw error if reservation is not confirmed', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);

      await expect(
        reservationService.checkIn('reservation-1', 'user-1')
      ).rejects.toThrow('Only confirmed reservations can be checked in');
    });

    it('should throw error if check-in date is in the future', async () => {
      const futureReservation = {
        ...mockReservation,
        status: ReservationStatus.CONFIRMED,
        checkInDate: startOfDay(addDays(new Date(), 1)),
      };

      mockPrisma.reservation.findUnique.mockResolvedValue(futureReservation);

      await expect(
        reservationService.checkIn('reservation-1', 'user-1')
      ).rejects.toThrow('Cannot check in before the check-in date');
    });
  });

  describe('checkOut', () => {
    it('should check out reservation successfully', async () => {
      const checkedInReservation = {
        ...mockReservation,
        status: ReservationStatus.CHECKED_IN,
      };

      const checkedOutReservation = {
        ...checkedInReservation,
        status: ReservationStatus.CHECKED_OUT,
        checkedOutAt: new Date(),
        checkedOutBy: 'user-1',
      };

      mockPrisma.reservation.findUnique.mockResolvedValue(checkedInReservation);
      mockPrisma.reservation.update.mockResolvedValue(checkedOutReservation);

      const result = await reservationService.checkOut('reservation-1', 'user-1');

      expect(result.status).toBe(ReservationStatus.CHECKED_OUT);
      expect(mockPrisma.reservation.update).toHaveBeenCalled();
    });

    it('should throw error if reservation not found', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        reservationService.checkOut('non-existent', 'user-1')
      ).rejects.toThrow('Reservation not found');
    });

    it('should throw error if reservation is not checked in', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);

      await expect(
        reservationService.checkOut('reservation-1', 'user-1')
      ).rejects.toThrow('Only checked-in reservations can be checked out');
    });
  });

  describe('getReservations', () => {
    it('should return paginated reservations', async () => {
      const reservations = [mockReservation];
      mockPrisma.reservation.findMany.mockResolvedValue(reservations);
      mockPrisma.reservation.count.mockResolvedValue(1);

      const result = await reservationService.getReservations({});

      expect(result.data).toEqual(reservations);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by status', async () => {
      const reservations = [mockReservation];
      mockPrisma.reservation.findMany.mockResolvedValue(reservations);
      mockPrisma.reservation.count.mockResolvedValue(1);

      await reservationService.getReservations({
        status: ReservationStatus.PENDING,
      });

      expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ReservationStatus.PENDING,
          }),
        })
      );
    });

    it('should filter by room number', async () => {
      const reservations = [mockReservation];
      mockPrisma.reservation.findMany.mockResolvedValue(reservations);
      mockPrisma.reservation.count.mockResolvedValue(1);

      await reservationService.getReservations({ roomNumber: '101' });

      expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roomNumber: '101',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const reservations = [mockReservation];
      mockPrisma.reservation.findMany.mockResolvedValue(reservations);
      mockPrisma.reservation.count.mockResolvedValue(1);

      const startDate = startOfDay(new Date());
      const endDate = startOfDay(addDays(new Date(), 7));

      await reservationService.getReservations({
        startDate,
        endDate,
      });

      expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkInDate: expect.objectContaining({
              gte: startDate,
              lte: endDate,
            }),
          }),
        })
      );
    });
  });
});