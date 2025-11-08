import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../config/database';
import { generateToken } from '../../utils/jwt.util';
import { hashPassword } from '../../utils/password.util';
import { Role, ReservationStatus, RoomStatus } from '@prisma/client';

describe('Admin Integration Tests', () => {
  let adminToken: string;
  let staffToken: string;
  let guestToken: string;
  let adminUserId: string;
  let staffUserId: string;
  let guestUserId: string;

  beforeAll(async () => {
    // Clean up existing test data
    await prisma.reservation.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test users
    const hashedPassword = await hashPassword('Test123!@#');

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
      },
    });
    adminUserId = adminUser.id;
    adminToken = generateToken({ userId: adminUser.id, role: adminUser.role });

    const staffUser = await prisma.user.create({
      data: {
        email: 'staff@test.com',
        password: hashedPassword,
        firstName: 'Staff',
        lastName: 'User',
        role: Role.STAFF,
      },
    });
    staffUserId = staffUser.id;
    staffToken = generateToken({ userId: staffUser.id, role: staffUser.role });

    const guestUser = await prisma.user.create({
      data: {
        email: 'guest@test.com',
        password: hashedPassword,
        firstName: 'Guest',
        lastName: 'User',
        role: Role.GUEST,
      },
    });
    guestUserId = guestUser.id;
    guestToken = generateToken({ userId: guestUser.id, role: guestUser.role });
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('GET /api/admin/dashboard - Get Dashboard Statistics', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app).get('/api/admin/dashboard');

      expect(response.status).toBe(401);
      const error = response.body as { error: string };
      expect(error.error).toBe('No token provided');
    });

    it('should return 403 when guest tries to access', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
      const error = response.body as { error: string };
      expect(error.error).toBe('Insufficient permissions');
    });

    it('should return 403 when staff tries to access', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
    });

    it('should return dashboard statistics for admin', async () => {
      // Create test data
      const room1 = await prisma.room.create({
        data: {
          roomNumber: '101',
          type: 'SINGLE',
          pricePerNight: 100,
          status: RoomStatus.AVAILABLE,
          capacity: 1,
          amenities: ['WiFi', 'TV'],
        },
      });

      const room2 = await prisma.room.create({
        data: {
          roomNumber: '102',
          type: 'DOUBLE',
          pricePerNight: 150,
          status: RoomStatus.OCCUPIED,
          capacity: 2,
          amenities: ['WiFi', 'TV', 'Mini Bar'],
        },
      });

      await prisma.reservation.create({
        data: {
          userId: guestUserId,
          roomId: room1.id,
          checkInDate: new Date('2024-01-01'),
          checkOutDate: new Date('2024-01-05'),
          totalPrice: 400,
          status: ReservationStatus.CONFIRMED,
          numberOfGuests: 1,
        },
      });

      await prisma.reservation.create({
        data: {
          userId: guestUserId,
          roomId: room2.id,
          checkInDate: new Date('2024-01-10'),
          checkOutDate: new Date('2024-01-15'),
          totalPrice: 750,
          status: ReservationStatus.PENDING,
          numberOfGuests: 2,
        },
      });

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('statistics');

      const stats = response.body as {
        statistics: {
          rooms: { totalRooms: number; availableRooms: number; occupiedRooms: number; maintenanceRooms: number; occupancyRate: number };
          reservations: { totalReservations: number; confirmedReservations: number; pendingReservations: number; cancelledReservations: number };
          revenue: { totalRevenue: number; monthlyRevenue: number };
          users: { totalUsers: number; adminUsers: number; staffUsers: number; guestUsers: number };
        };
      };

      // Verify room statistics
      expect(stats.statistics.rooms.totalRooms).toBe(2);
      expect(stats.statistics.rooms.availableRooms).toBe(1);
      expect(stats.statistics.rooms.occupiedRooms).toBe(1);
      expect(stats.statistics.rooms.occupancyRate).toBeGreaterThanOrEqual(0);
      expect(stats.statistics.rooms.occupancyRate).toBeLessThanOrEqual(100);

      // Verify reservation statistics
      expect(stats.statistics.reservations.totalReservations).toBe(2);
      expect(stats.statistics.reservations.confirmedReservations).toBe(1);
      expect(stats.statistics.reservations.pendingReservations).toBe(1);

      // Verify revenue statistics
      expect(stats.statistics.revenue.totalRevenue).toBe(1150);

      // Clean up
      await prisma.reservation.deleteMany({});
      await prisma.room.deleteMany({});
    });
  });

  describe('GET /api/admin/reservations/recent - Get Recent Reservations', () => {
    beforeEach(async () => {
      await prisma.reservation.deleteMany({});
      await prisma.room.deleteMany({});
    });

    it('should return 401 when no token is provided', async () => {
      const response = await request(app).get('/api/admin/reservations/recent');

      expect(response.status).toBe(401);
    });

    it('should return 403 when guest tries to access', async () => {
      const response = await request(app)
        .get('/api/admin/reservations/recent')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
    });

    it('should return recent reservations for admin with pagination', async () => {
      // Create test rooms
      const room = await prisma.room.create({
        data: {
          roomNumber: '201',
          type: 'SINGLE',
          pricePerNight: 100,
          status: RoomStatus.AVAILABLE,
          capacity: 1,
          amenities: ['WiFi'],
        },
      });

      // Create multiple reservations
      const reservationPromises = Array.from({ length: 15 }).map((_, i) =>
        prisma.reservation.create({
          data: {
            userId: guestUserId,
            roomId: room.id,
            checkInDate: new Date(`2024-01-${i + 1}`),
            checkOutDate: new Date(`2024-01-${i + 5}`),
            totalPrice: 400,
            status: ReservationStatus.CONFIRMED,
            numberOfGuests: 1,
          },
        })
      );

      await Promise.all(reservationPromises);

      const response = await request(app)
        .get('/api/admin/reservations/recent?limit=10&page=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const data = response.body as {
        reservations: Array<{
          id: string;
          userId: string;
          roomId: string;
          checkInDate: string;
          checkOutDate: string;
          totalPrice: number;
          status: string;
          numberOfGuests: number;
        }>;
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
      expect(Array.isArray(data.reservations)).toBe(true);
      expect(data.reservations.length).toBeLessThanOrEqual(10);
      expect(data.pagination.total).toBe(15);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.totalPages).toBe(2);
    });

    it('should return recent reservations for staff', async () => {
      const response = await request(app)
        .get('/api/admin/reservations/recent')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reservations');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('GET /api/admin/rooms/occupancy - Get Room Occupancy Overview', () => {
    beforeEach(async () => {
      await prisma.reservation.deleteMany({});
      await prisma.room.deleteMany({});
    });

    it('should return 401 when no token is provided', async () => {
      const response = await request(app).get('/api/admin/rooms/occupancy');

      expect(response.status).toBe(401);
    });

    it('should return 403 when guest tries to access', async () => {
      const response = await request(app)
        .get('/api/admin/rooms/occupancy')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
    });

    it('should return room occupancy overview for admin', async () => {
      // Create test rooms with different statuses
      await prisma.room.createMany({
        data: [
          {
            roomNumber: '301',
            type: 'SINGLE',
            pricePerNight: 100,
            status: RoomStatus.AVAILABLE,
            capacity: 1,
            amenities: ['WiFi'],
          },
          {
            roomNumber: '302',
            type: 'DOUBLE',
            pricePerNight: 150,
            status: RoomStatus.OCCUPIED,
            capacity: 2,
            amenities: ['WiFi', 'TV'],
          },
          {
            roomNumber: '303',
            type: 'SUITE',
            pricePerNight: 300,
            status: RoomStatus.MAINTENANCE,
            capacity: 4,
            amenities: ['WiFi', 'TV', 'Mini Bar'],
          },
        ],
      });

      const response = await request(app)
        .get('/api/admin/rooms/occupancy')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('occupancy');
      expect(response.body.occupancy).toHaveProperty('totalRooms', 3);
      expect(response.body.occupancy).toHaveProperty('availableRooms', 1);
      expect(response.body.occupancy).toHaveProperty('occupiedRooms', 1);
      expect(response.body.occupancy).toHaveProperty('maintenanceRooms', 1);
      expect(response.body.occupancy).toHaveProperty('occupancyRate');
      expect(response.body.occupancy).toHaveProperty('roomsByType');
    });

    it('should return room occupancy overview for staff', async () => {
      const response = await request(app)
        .get('/api/admin/rooms/occupancy')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('occupancy');
    });
  });

  describe('GET /api/admin/users - Get All Users', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(401);
    });

    it('should return 403 when guest tries to access', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 403 when staff tries to access', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
    });

    it('should return all users for admin with pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users?limit=10&page=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);

      // Verify user data structure (passwords should not be included)
      const firstUser = response.body.users[0];
      expect(firstUser).toHaveProperty('id');
      expect(firstUser).toHaveProperty('email');
      expect(firstUser).toHaveProperty('role');
      expect(firstUser).not.toHaveProperty('password');
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=ADMIN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.every((user: { role: string }) => user.role === 'ADMIN')).toBe(true);
    });
  });

  describe('PATCH /api/admin/users/:userId/role - Update User Role', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${guestUserId}/role`)
        .send({ role: 'STAFF' });

      expect(response.status).toBe(401);
    });

    it('should return 403 when guest tries to access', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${guestUserId}/role`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ role: 'STAFF' });

      expect(response.status).toBe(403);
    });

    it('should return 403 when staff tries to access', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${guestUserId}/role`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ role: 'STAFF' });

      expect(response.status).toBe(403);
    });

    it('should return 400 when invalid role is provided', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${guestUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'INVALID_ROLE' });

      expect(response.status).toBe(400);
    });

    it('should update user role successfully', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${guestUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'STAFF' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.role).toBe('STAFF');

      // Verify the role was actually updated in the database
      const updatedUser = await prisma.user.findUnique({
        where: { id: guestUserId },
      });
      expect(updatedUser?.role).toBe('STAFF');

      // Reset role back to GUEST for other tests
      await prisma.user.update({
        where: { id: guestUserId },
        data: { role: Role.GUEST },
      });
    });

    it('should return 404 when user does not exist', async () => {
      const response = await request(app)
        .patch('/api/admin/users/non-existent-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'STAFF' });

      expect(response.status).toBe(404);
    });
  });
});