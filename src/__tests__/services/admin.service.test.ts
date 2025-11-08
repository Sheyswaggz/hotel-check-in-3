/**
 * Admin Service Tests
 *
 * Comprehensive test suite for admin service functionality including:
 * - Dashboard statistics aggregation
 * - Recent reservations retrieval
 * - Room occupancy overview
 * - User management operations
 * - Revenue analytics
 * - Error handling and edge cases
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PrismaClient, UserRole, ReservationStatus } from '@prisma/client';
import { AdminService } from '../../services/admin.service';
import type {
  DashboardStats,
  RecentReservation,
  RoomOccupancy,
  UserManagement,
  RevenueAnalytics,
} from '../../types/admin.types';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
  UserRole: {
    GUEST: 'GUEST',
    STAFF: 'STAFF',
    ADMIN: 'ADMIN',
  },
  ReservationStatus: {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    CHECKED_IN: 'CHECKED_IN',
    CHECKED_OUT: 'CHECKED_OUT',
    CANCELLED: 'CANCELLED',
  },
}));

describe('AdminService', () => {
  let adminService: AdminService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Create mock Prisma client with all required methods
    mockPrisma = {
      reservation: {
        count: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      room: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    adminService = new AdminService(mockPrisma);
  });

  describe('getDashboardStats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      // Mock data
      const mockStats = {
        totalReservations: 150,
        activeReservations: 45,
        totalRevenue: 125000,
        occupancyRate: 75.5,
        totalUsers: 320,
        totalRooms: 60,
      };

      // Setup mocks using arrow functions to avoid unbound-method warnings
      (mockPrisma.reservation.count as jest.Mock) = jest.fn().mockResolvedValue(mockStats.totalReservations);
      (mockPrisma.reservation.aggregate as jest.Mock) = jest.fn().mockResolvedValue({
        _sum: { totalAmount: mockStats.totalRevenue },
      });
      (mockPrisma.user.count as jest.Mock) = jest.fn().mockResolvedValue(mockStats.totalUsers);
      (mockPrisma.room.count as jest.Mock) = jest.fn().mockResolvedValue(mockStats.totalRooms);

      // Mock active reservations count
      (mockPrisma.reservation.count as jest.Mock).mockResolvedValueOnce(mockStats.totalReservations);
      (mockPrisma.reservation.count as jest.Mock).mockResolvedValueOnce(mockStats.activeReservations);

      const result = await adminService.getDashboardStats();

      expect(result).toBeDefined();
      expect(result.totalReservations).toBe(mockStats.totalReservations);
      expect(result.activeReservations).toBe(mockStats.activeReservations);
      expect(result.totalRevenue).toBe(mockStats.totalRevenue);
      expect(result.totalUsers).toBe(mockStats.totalUsers);
      expect(result.totalRooms).toBe(mockStats.totalRooms);
    });

    it('should handle zero revenue gracefully', async () => {
      (mockPrisma.reservation.count as jest.Mock) = jest.fn().mockResolvedValue(0);
      (mockPrisma.reservation.aggregate as jest.Mock) = jest.fn().mockResolvedValue({
        _sum: { totalAmount: null },
      });
      (mockPrisma.user.count as jest.Mock) = jest.fn().mockResolvedValue(0);
      (mockPrisma.room.count as jest.Mock) = jest.fn().mockResolvedValue(0);

      const result = await adminService.getDashboardStats();

      expect(result.totalRevenue).toBe(0);
    });

    it('should handle database errors', async () => {
      (mockPrisma.reservation.count as jest.Mock) = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(adminService.getDashboardStats()).rejects.toThrow('Database error');
    });
  });

  describe('getRecentReservations', () => {
    it('should return recent reservations with user and room details', async () => {
      const mockReservations = [
        {
          id: 'res-1',
          userId: 'user-1',
          roomId: 'room-1',
          checkInDate: new Date('2024-01-15'),
          checkOutDate: new Date('2024-01-20'),
          status: ReservationStatus.CONFIRMED,
          totalAmount: 500,
          createdAt: new Date('2024-01-10'),
          user: {
            id: 'user-1',
            email: 'guest@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
          room: {
            id: 'room-1',
            roomNumber: '101',
            type: 'DELUXE',
          },
        },
      ];

      (mockPrisma.reservation.findMany as jest.Mock) = jest.fn().mockResolvedValue(mockReservations);

      const result = await adminService.getRecentReservations(10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('res-1');
      expect(result[0].user.email).toBe('guest@example.com');
      expect(result[0].room.roomNumber).toBe('101');
      expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should use default limit of 20 when not specified', async () => {
      (mockPrisma.reservation.findMany as jest.Mock) = jest.fn().mockResolvedValue([]);

      await adminService.getRecentReservations();

      expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });

    it('should handle empty results', async () => {
      (mockPrisma.reservation.findMany as jest.Mock) = jest.fn().mockResolvedValue([]);

      const result = await adminService.getRecentReservations();

      expect(result).toEqual([]);
    });
  });

  describe('getRoomOccupancy', () => {
    it('should return room occupancy overview', async () => {
      const mockRooms = [
        {
          id: 'room-1',
          roomNumber: '101',
          type: 'DELUXE',
          pricePerNight: 150,
          isAvailable: true,
          reservations: [],
        },
        {
          id: 'room-2',
          roomNumber: '102',
          type: 'SUITE',
          pricePerNight: 250,
          isAvailable: false,
          reservations: [
            {
              id: 'res-1',
              checkInDate: new Date('2024-01-15'),
              checkOutDate: new Date('2024-01-20'),
              status: ReservationStatus.CONFIRMED,
            },
          ],
        },
      ];

      (mockPrisma.room.findMany as jest.Mock) = jest.fn().mockResolvedValue(mockRooms);

      const result = await adminService.getRoomOccupancy();

      expect(result).toHaveLength(2);
      expect(result[0].roomNumber).toBe('101');
      expect(result[0].isOccupied).toBe(false);
      expect(result[1].roomNumber).toBe('102');
      expect(result[1].isOccupied).toBe(true);
    });

    it('should handle rooms with no reservations', async () => {
      const mockRooms = [
        {
          id: 'room-1',
          roomNumber: '101',
          type: 'STANDARD',
          pricePerNight: 100,
          isAvailable: true,
          reservations: [],
        },
      ];

      (mockPrisma.room.findMany as jest.Mock) = jest.fn().mockResolvedValue(mockRooms);

      const result = await adminService.getRoomOccupancy();

      expect(result[0].isOccupied).toBe(false);
      expect(result[0].currentReservation).toBeUndefined();
    });
  });

  describe('getUserManagement', () => {
    it('should return paginated user list with role filter', async () => {
      const mockUsers = Array.from({ length: 10 }).map(() => ({
        id: `user-${Math.random()}`,
        email: `user${Math.random()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.GUEST,
        isActive: true,
        createdAt: new Date(),
        _count: {
          reservations: 5,
        },
      }));

      const mockTotal = 50;

      (mockPrisma.user.findMany as jest.Mock) = jest.fn().mockResolvedValue(mockUsers);
      (mockPrisma.user.count as jest.Mock) = jest.fn().mockResolvedValue(mockTotal);

      const result = await adminService.getUserManagement({
        page: 1,
        limit: 10,
        role: UserRole.GUEST,
      });

      expect(result.users).toHaveLength(10);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(5);
    });

    it('should handle search query', async () => {
      (mockPrisma.user.findMany as jest.Mock) = jest.fn().mockResolvedValue([]);
      (mockPrisma.user.count as jest.Mock) = jest.fn().mockResolvedValue(0);

      await adminService.getUserManagement({
        page: 1,
        limit: 10,
        search: 'john@example.com',
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ email: expect.any(Object) }),
            ]),
          }),
        })
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.STAFF,
      };

      (mockPrisma.user.update as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

      const result = await adminService.updateUserRole('user-1', UserRole.STAFF);

      expect(result.role).toBe(UserRole.STAFF);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.STAFF },
      });
    });

    it('should handle non-existent user', async () => {
      (mockPrisma.user.update as jest.Mock) = jest.fn().mockRejectedValue(new Error('User not found'));

      await expect(adminService.updateUserRole('invalid-id', UserRole.STAFF)).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('getRevenueAnalytics', () => {
    it('should return revenue analytics for date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockReservations = [
        {
          totalAmount: 500,
          createdAt: new Date('2024-01-15'),
          status: ReservationStatus.CONFIRMED,
        },
        {
          totalAmount: 750,
          createdAt: new Date('2024-01-20'),
          status: ReservationStatus.CHECKED_OUT,
        },
      ];

      (mockPrisma.reservation.findMany as jest.Mock) = jest.fn().mockResolvedValue(mockReservations);
      (mockPrisma.reservation.aggregate as jest.Mock) = jest.fn().mockResolvedValue({
        _sum: { totalAmount: 1250 },
        _avg: { totalAmount: 625 },
      });

      const result = await adminService.getRevenueAnalytics(startDate, endDate);

      expect(result.totalRevenue).toBe(1250);
      expect(result.averageReservationValue).toBe(625);
      expect(result.reservationCount).toBe(2);
    });

    it('should handle period with no revenue', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (mockPrisma.reservation.findMany as jest.Mock) = jest.fn().mockResolvedValue([]);
      (mockPrisma.reservation.aggregate as jest.Mock) = jest.fn().mockResolvedValue({
        _sum: { totalAmount: null },
        _avg: { totalAmount: null },
      });

      const result = await adminService.getRevenueAnalytics(startDate, endDate);

      expect(result.totalRevenue).toBe(0);
      expect(result.averageReservationValue).toBe(0);
      expect(result.reservationCount).toBe(0);
    });
  });
});