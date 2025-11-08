import request from 'supertest';
import { PrismaClient, Reservation } from '@prisma/client';
import app from '../../app';
import { hashPassword } from '../../utils/password.util';
import { generateToken } from '../../utils/jwt.util';
import { addDays, format } from 'date-fns';

const prisma = new PrismaClient();

describe('Reservation Integration Tests', () => {
  let guestToken: string;
  let staffToken: string;
  let adminToken: string;
  let guestUserId: string;
  let staffUserId: string;
  let adminUserId: string;
  let testRoomId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.reservation.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test users
    const guestUser = await prisma.user.create({
      data: {
        email: 'guest@example.com',
        password: await hashPassword('SecurePass123!'),
        firstName: 'Guest',
        lastName: 'User',
        phoneNumber: '+1234567890',
        role: 'GUEST',
      },
    });
    guestUserId = guestUser.id;
    guestToken = generateToken({ userId: guestUser.id, email: guestUser.email, role: guestUser.role });

    const staffUser = await prisma.user.create({
      data: {
        email: 'staff@example.com',
        password: await hashPassword('SecurePass123!'),
        firstName: 'Staff',
        lastName: 'User',
        phoneNumber: '+1234567891',
        role: 'STAFF',
      },
    });
    staffUserId = staffUser.id;
    staffToken = generateToken({ userId: staffUser.id, email: staffUser.email, role: staffUser.role });

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: await hashPassword('SecurePass123!'),
        firstName: 'Admin',
        lastName: 'User',
        phoneNumber: '+1234567892',
        role: 'ADMIN',
      },
    });
    adminUserId = adminUser.id;
    adminToken = generateToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });

    // Create test room
    const room = await prisma.room.create({
      data: {
        roomNumber: '101',
        type: 'DELUXE',
        pricePerNight: 150.00,
        capacity: 2,
        status: 'AVAILABLE',
      },
    });
    testRoomId = room.id;
  });

  afterEach(async () => {
    // Clean up reservations after each test
    await prisma.reservation.deleteMany({});
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/reservations', () => {
    it('should create a reservation successfully', async () => {
      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 3);

      const reservationData = {
        roomId: testRoomId,
        checkInDate: format(checkInDate, 'yyyy-MM-dd'),
        checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
        numberOfGuests: 2,
        specialRequests: 'Late check-in',
      };

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .send(reservationData)
        .expect(201);

      expect(response.body).toMatchObject({
        roomId: testRoomId,
        guestId: guestUserId,
        numberOfGuests: 2,
        status: 'PENDING',
        specialRequests: 'Late check-in',
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('totalPrice');
    });

    it('should reject reservation without authentication', async () => {
      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 3);

      const response = await request(app)
        .post('/api/reservations')
        .send({
          roomId: testRoomId,
          checkInDate: format(checkInDate, 'yyyy-MM-dd'),
          checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
          numberOfGuests: 2,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject reservation with invalid dates', async () => {
      const checkInDate = addDays(new Date(), 3);
      const checkOutDate = addDays(new Date(), 1); // Before check-in

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomId: testRoomId,
          checkInDate: format(checkInDate, 'yyyy-MM-dd'),
          checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
          numberOfGuests: 2,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject reservation with past dates', async () => {
      const checkInDate = addDays(new Date(), -2);
      const checkOutDate = addDays(new Date(), -1);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomId: testRoomId,
          checkInDate: format(checkInDate, 'yyyy-MM-dd'),
          checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
          numberOfGuests: 2,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject reservation exceeding room capacity', async () => {
      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomId: testRoomId,
          checkInDate: format(checkInDate, 'yyyy-MM-dd'),
          checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
          numberOfGuests: 10, // Exceeds capacity of 2
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject reservation for unavailable room', async () => {
      // Create an unavailable room
      const unavailableRoom = await prisma.room.create({
        data: {
          roomNumber: '102',
          type: 'STANDARD',
          pricePerNight: 100.00,
          capacity: 2,
          status: 'MAINTENANCE',
        },
      });

      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomId: unavailableRoom.id,
          checkInDate: format(checkInDate, 'yyyy-MM-dd'),
          checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
          numberOfGuests: 2,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not available');

      await prisma.room.delete({ where: { id: unavailableRoom.id } });
    });

    it('should calculate total price correctly', async () => {
      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 4); // 3 nights

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomId: testRoomId,
          checkInDate: format(checkInDate, 'yyyy-MM-dd'),
          checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
          numberOfGuests: 2,
        })
        .expect(201);

      // Room price is 150 per night, 3 nights = 450
      expect(response.body.totalPrice).toBe(450.00);
    });
  });

  describe('GET /api/reservations', () => {
    beforeEach(async () => {
      // Create test reservations
      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 3);

      await prisma.reservation.create({
        data: {
          roomId: testRoomId,
          guestId: guestUserId,
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          totalPrice: 300.00,
          status: 'CONFIRMED',
        },
      });
    });

    it('should return guest\'s own reservations', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].guestId).toBe(guestUserId);
    });

    it('should return all reservations for staff', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return all reservations for admin', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should filter reservations by status', async () => {
      const response = await request(app)
        .get('/api/reservations?status=CONFIRMED')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((reservation: Reservation) => {
        expect(reservation.status).toBe('CONFIRMED');
      });
    });
  });

  describe('GET /api/reservations/:id', () => {
    let reservationId: string;

    beforeEach(async () => {
      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 3);

      const reservation = await prisma.reservation.create({
        data: {
          roomId: testRoomId,
          guestId: guestUserId,
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          totalPrice: 300.00,
          status: 'CONFIRMED',
        },
      });
      reservationId = reservation.id;
    });

    it('should return reservation details for owner', async () => {
      const response = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.id).toBe(reservationId);
      expect(response.body.guestId).toBe(guestUserId);
    });

    it('should return reservation details for staff', async () => {
      const response = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.id).toBe(reservationId);
    });

    it('should reject access to other guest\'s reservation', async () => {
      // Create another guest
      const otherGuest = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: await hashPassword('SecurePass123!'),
          firstName: 'Other',
          lastName: 'Guest',
          phoneNumber: '+1234567893',
          role: 'GUEST',
        },
      });
      const otherToken = generateToken({ userId: otherGuest.id, email: otherGuest.email, role: otherGuest.role });

      const response = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');

      await prisma.user.delete({ where: { id: otherGuest.id } });
    });

    it('should return 404 for non-existent reservation', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/reservations/${fakeId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/reservations/:id', () => {
    let reservationId: string;

    beforeEach(async () => {
      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 3);

      const reservation = await prisma.reservation.create({
        data: {
          roomId: testRoomId,
          guestId: guestUserId,
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          totalPrice: 300.00,
          status: 'PENDING',
        },
      });
      reservationId = reservation.id;
    });

    it('should allow guest to update their own reservation', async () => {
      const response = await request(app)
        .put(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          numberOfGuests: 1,
          specialRequests: 'Updated request',
        })
        .expect(200);

      expect(response.body.numberOfGuests).toBe(1);
      expect(response.body.specialRequests).toBe('Updated request');
    });

    it('should allow staff to update any reservation', async () => {
      const response = await request(app)
        .put(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          status: 'CONFIRMED',
        })
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');
    });

    it('should reject guest updating other guest\'s reservation', async () => {
      const otherGuest = await prisma.user.create({
        data: {
          email: 'other2@example.com',
          password: await hashPassword('SecurePass123!'),
          firstName: 'Other',
          lastName: 'Guest',
          phoneNumber: '+1234567894',
          role: 'GUEST',
        },
      });
      const otherToken = generateToken({ userId: otherGuest.id, email: otherGuest.email, role: otherGuest.role });

      const response = await request(app)
        .put(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ numberOfGuests: 1 })
        .expect(403);

      expect(response.body).toHaveProperty('error');

      await prisma.user.delete({ where: { id: otherGuest.id } });
    });

    it('should reject update with invalid data', async () => {
      const response = await request(app)
        .put(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          numberOfGuests: 0, // Invalid
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/reservations/:id', () => {
    let reservationId: string;

    beforeEach(async () => {
      const checkInDate = addDays(new Date(), 1);
      const checkOutDate = addDays(new Date(), 3);

      const reservation = await prisma.reservation.create({
        data: {
          roomId: testRoomId,
          guestId: guestUserId,
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          totalPrice: 300.00,
          status: 'PENDING',
        },
      });
      reservationId = reservation.id;
    });

    it('should allow guest to cancel their own reservation', async () => {
      const response = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify reservation is cancelled
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });
      expect(reservation?.status).toBe('CANCELLED');
    });

    it('should allow staff to cancel any reservation', async () => {
      const response = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject guest cancelling other guest\'s reservation', async () => {
      const otherGuest = await prisma.user.create({
        data: {
          email: 'other3@example.com',
          password: await hashPassword('SecurePass123!'),
          firstName: 'Other',
          lastName: 'Guest',
          phoneNumber: '+1234567895',
          role: 'GUEST',
        },
      });
      const otherToken = generateToken({ userId: otherGuest.id, email: otherGuest.email, role: otherGuest.role });

      const response = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');

      await prisma.user.delete({ where: { id: otherGuest.id } });
    });
  });

  describe('POST /api/reservations/:id/check-in', () => {
    let reservationId: string;

    beforeEach(async () => {
      const checkInDate = new Date(); // Today
      const checkOutDate = addDays(new Date(), 2);

      const reservation = await prisma.reservation.create({
        data: {
          roomId: testRoomId,
          guestId: guestUserId,
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          totalPrice: 300.00,
          status: 'CONFIRMED',
        },
      });
      reservationId = reservation.id;
    });

    it('should allow staff to check in guest', async () => {
      const response = await request(app)
        .post(`/api/reservations/${reservationId}/check-in`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.status).toBe('CHECKED_IN');
      expect(response.body).toHaveProperty('actualCheckInTime');
    });

    it('should reject check-in by guest', async () => {
      const response = await request(app)
        .post(`/api/reservations/${reservationId}/check-in`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject check-in for non-confirmed reservation', async () => {
      // Update reservation to pending
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: 'PENDING' },
      });

      const response = await request(app)
        .post(`/api/reservations/${reservationId}/check-in`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/reservations/:id/check-out', () => {
    let reservationId: string;

    beforeEach(async () => {
      const checkInDate = addDays(new Date(), -2);
      const checkOutDate = new Date(); // Today

      const reservation = await prisma.reservation.create({
        data: {
          roomId: testRoomId,
          guestId: guestUserId,
          checkInDate,
          checkOutDate,
          numberOfGuests: 2,
          totalPrice: 300.00,
          status: 'CHECKED_IN',
          actualCheckInTime: checkInDate,
        },
      });
      reservationId = reservation.id;
    });

    it('should allow staff to check out guest', async () => {
      const response = await request(app)
        .post(`/api/reservations/${reservationId}/check-out`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.status).toBe('CHECKED_OUT');
      expect(response.body).toHaveProperty('actualCheckOutTime');
    });

    it('should reject check-out by guest', async () => {
      const response = await request(app)
        .post(`/api/reservations/${reservationId}/check-out`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject check-out for non-checked-in reservation', async () => {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: 'CONFIRMED' },
      });

      const response = await request(app)
        .post(`/api/reservations/${reservationId}/check-out`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});