import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../config/database';
import { hashPassword } from '../../utils/password.util';
import { UserRole, ReservationStatus } from '@prisma/client';

describe('Reservation Integration Tests', () => {
  let guestToken: string;
  let guestUserId: string;
  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test users
    const hashedPassword = await hashPassword('Password123!');
    const _staffUserId = (await prisma.user.create({
      data: {
        email: 'staff@test.com',
        password: hashedPassword,
        firstName: 'Staff',
        lastName: 'User',
        role: UserRole.STAFF,
        phoneNumber: '+1234567890',
      },
    })).id;

    const _adminUserId = (await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        phoneNumber: '+0987654321',
      },
    })).id;

    guestUserId = (await prisma.user.create({
      data: {
        email: 'guest@test.com',
        password: hashedPassword,
        firstName: 'Guest',
        lastName: 'User',
        role: UserRole.GUEST,
        phoneNumber: '+1122334455',
      },
    })).id;

    // Login users
    const guestLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'guest@test.com', password: 'Password123!' });
    guestToken = guestLogin.body.token;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@test.com', password: 'Password123!' });
    staffToken = staffLogin.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' });
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/reservations', () => {
    it('should create a reservation as guest', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomNumber: '101',
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          numberOfGuests: 2,
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        roomNumber: '101',
        numberOfGuests: 2,
        status: ReservationStatus.PENDING,
        guestId: guestUserId,
      });
    });

    it('should not create reservation with past dates', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() - 1);
      const checkOutDate = new Date();

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomNumber: '102',
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          numberOfGuests: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should not create reservation without authentication', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      const response = await request(app)
        .post('/api/reservations')
        .send({
          roomNumber: '103',
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          numberOfGuests: 2,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/reservations', () => {
    beforeAll(async () => {
      // Create test reservations
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      await prisma.reservation.create({
        data: {
          roomNumber: '201',
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          status: ReservationStatus.PENDING,
          guestId: guestUserId,
        },
      });
    });

    it('should get own reservations as guest', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('roomNumber');
    });

    it('should get all reservations as staff', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should not get reservations without authentication', async () => {
      const response = await request(app).get('/api/reservations');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/reservations/:id', () => {
    let reservationId: string;

    beforeAll(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      const reservation = await prisma.reservation.create({
        data: {
          roomNumber: '301',
          checkInDate,
          checkOutDate,
          numberOfGuests: 1,
          status: ReservationStatus.PENDING,
          guestId: guestUserId,
        },
      });
      reservationId = reservation.id;
    });

    it('should get own reservation as guest', async () => {
      const response = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: reservationId,
        roomNumber: '301',
      });
    });

    it('should get any reservation as staff', async () => {
      const response = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(reservationId);
    });

    it('should not get non-existent reservation', async () => {
      const response = await request(app)
        .get('/api/reservations/non-existent-id')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/reservations/:id/check-in', () => {
    let reservationId: string;

    beforeEach(async () => {
      const checkInDate = new Date();
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      const reservation = await prisma.reservation.create({
        data: {
          roomNumber: '401',
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          status: ReservationStatus.CONFIRMED,
          guestId: guestUserId,
        },
      });
      reservationId = reservation.id;
    });

    it('should check in as staff', async () => {
      const response = await request(app)
        .patch(`/api/reservations/${reservationId}/check-in`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(ReservationStatus.CHECKED_IN);
    });

    it('should not check in as guest', async () => {
      const response = await request(app)
        .patch(`/api/reservations/${reservationId}/check-in`)
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/reservations/:id/check-out', () => {
    let reservationId: string;

    beforeEach(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() - 1);
      const checkOutDate = new Date();

      const reservation = await prisma.reservation.create({
        data: {
          roomNumber: '501',
          checkInDate,
          checkOutDate,
          numberOfGuests: 1,
          status: ReservationStatus.CHECKED_IN,
          guestId: guestUserId,
        },
      });
      reservationId = reservation.id;
    });

    it('should check out as staff', async () => {
      const response = await request(app)
        .patch(`/api/reservations/${reservationId}/check-out`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(ReservationStatus.CHECKED_OUT);
    });

    it('should not check out as guest', async () => {
      const response = await request(app)
        .patch(`/api/reservations/${reservationId}/check-out`)
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/reservations/:id', () => {
    let reservationId: string;

    beforeEach(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      const reservation = await prisma.reservation.create({
        data: {
          roomNumber: '601',
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          status: ReservationStatus.PENDING,
          guestId: guestUserId,
        },
      });
      reservationId = reservation.id;
    });

    it('should cancel own reservation as guest', async () => {
      const response = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(ReservationStatus.CANCELLED);
    });

    it('should cancel any reservation as admin', async () => {
      const response = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(ReservationStatus.CANCELLED);
    });
  });
});