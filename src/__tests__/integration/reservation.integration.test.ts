/**
 * Reservation Integration Tests
 * 
 * Comprehensive integration test suite for reservation management endpoints
 * with authentication, authorization, and database operations.
 * 
 * Test Coverage:
 * - POST /api/reservations - Create reservation (authenticated)
 * - GET /api/reservations - List reservations (role-based filtering)
 * - GET /api/reservations/:id - Get reservation details
 * - PUT /api/reservations/:id/confirm - Confirm reservation (admin only)
 * - PUT /api/reservations/:id/check-in - Process check-in (admin only)
 * - PUT /api/reservations/:id/check-out - Process check-out (admin only)
 * - PUT /api/reservations/:id/cancel - Cancel reservation
 * 
 * @module __tests__/integration/reservation.integration.test
 */

import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/database.js';
import { generateToken } from '../../utils/jwt.util.js';
import { hashPassword } from '../../utils/password.util.js';
import type { User, Room, Reservation } from '@prisma/client';

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Test user factory for creating test users with different roles
 */
interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
  role: 'ADMIN' | 'GUEST';
  token: string;
}

/**
 * Test room factory for creating test rooms
 */
interface TestRoom {
  id: string;
  number: string;
  type: string;
  price: number;
  status: string;
}

/**
 * Test reservation factory for creating test reservations
 */
interface TestReservation {
  id: string;
  userId: string;
  roomId: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
  totalPrice: number;
}

// =============================================================================
// TEST SUITE SETUP AND TEARDOWN
// =============================================================================

describe('Reservation Integration Tests', () => {
  let adminUser: TestUser;
  let guestUser: TestUser;
  let testRoom1: TestRoom;
  let testRoom2: TestRoom;

  /**
   * Setup test database with users and rooms before all tests
   */
  beforeAll(async () => {
    // Clean up existing test data
    await prisma.reservation.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});

    // Create admin user
    const adminPassword = await hashPassword('Admin123!');
    const admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        name: 'Admin User',
        password: adminPassword,
        role: 'ADMIN',
      },
    });

    adminUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      password: 'Admin123!',
      role: admin.role,
      token: generateToken({
        userId: admin.id,
        email: admin.email,
        role: admin.role,
      }),
    };

    // Create guest user
    const guestPassword = await hashPassword('Guest123!');
    const guest = await prisma.user.create({
      data: {
        email: 'guest@test.com',
        name: 'Guest User',
        password: guestPassword,
        role: 'GUEST',
      },
    });

    guestUser = {
      id: guest.id,
      email: guest.email,
      name: guest.name,
      password: 'Guest123!',
      role: guest.role,
      token: generateToken({
        userId: guest.id,
        email: guest.email,
        role: guest.role,
      }),
    };

    // Create test rooms
    const room1 = await prisma.room.create({
      data: {
        number: '101',
        type: 'SINGLE',
        price: 100.0,
        status: 'AVAILABLE',
      },
    });

    testRoom1 = {
      id: room1.id,
      number: room1.number,
      type: room1.type,
      price: room1.price.toNumber(),
      status: room1.status,
    };

    const room2 = await prisma.room.create({
      data: {
        number: '102',
        type: 'DOUBLE',
        price: 150.0,
        status: 'AVAILABLE',
      },
    });

    testRoom2 = {
      id: room2.id,
      number: room2.number,
      type: room2.type,
      price: room2.price.toNumber(),
      status: room2.status,
    };
  });

  /**
   * Clean up reservations after each test to ensure isolation
   */
  afterEach(async () => {
    await prisma.reservation.deleteMany({});
  });

  /**
   * Clean up all test data after all tests complete
   */
  afterAll(async () => {
    await prisma.reservation.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // =============================================================================
  // POST /api/reservations - CREATE RESERVATION
  // =============================================================================

  describe('POST /api/reservations', () => {
    /**
     * Happy path: Create reservation with valid data
     */
    it('should create reservation for authenticated guest user', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId: guestUser.id,
        roomId: testRoom1.id,
        status: 'PENDING',
        totalPrice: expect.any(Number),
      });

      expect(new Date(response.body.checkInDate)).toEqual(checkInDate);
      expect(new Date(response.body.checkOutDate)).toEqual(checkOutDate);
    });

    /**
     * Happy path: Admin can create reservation
     */
    it('should create reservation for authenticated admin user', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(201);

      expect(response.body).toMatchObject({
        userId: adminUser.id,
        roomId: testRoom1.id,
        status: 'PENDING',
      });
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject reservation creation without authentication', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Validation: Reject invalid token
     */
    it('should reject reservation creation with invalid token', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'INVALID_TOKEN',
      });
    });

    /**
     * Validation: Reject missing roomId
     */
    it('should reject reservation without roomId', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Validation: Reject invalid roomId format
     */
    it('should reject reservation with invalid roomId format', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: 'invalid-uuid',
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Validation: Reject missing checkInDate
     */
    it('should reject reservation without checkInDate', async () => {
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Validation: Reject missing checkOutDate
     */
    it('should reject reservation without checkOutDate', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Business logic: Reject past checkInDate
     */
    it('should reject reservation with past checkInDate', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() - 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Business logic: Reject checkOutDate before checkInDate
     */
    it('should reject reservation with checkOutDate before checkInDate', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 3);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 1);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Business logic: Reject conflicting dates
     */
    it('should reject reservation with conflicting dates', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      // Create first reservation
      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(201);

      // Try to create overlapping reservation
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'Conflict',
      });
    });

    /**
     * Business logic: Reject non-existent room
     */
    it('should reject reservation for non-existent room', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: '00000000-0000-0000-0000-000000000000',
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
      });
    });
  });

  // =============================================================================
  // GET /api/reservations - LIST RESERVATIONS
  // =============================================================================

  describe('GET /api/reservations', () => {
    let guestReservation: Reservation;
    let adminReservation: Reservation;

    /**
     * Setup test reservations before each test
     */
    beforeEach(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      // Create guest reservation
      guestReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom1.id,
          checkInDate,
          checkOutDate,
          status: 'PENDING',
          totalPrice: 200.0,
        },
      });

      // Create admin reservation
      adminReservation = await prisma.reservation.create({
        data: {
          userId: adminUser.id,
          roomId: testRoom2.id,
          checkInDate,
          checkOutDate,
          status: 'CONFIRMED',
          totalPrice: 300.0,
        },
      });
    });

    /**
     * Happy path: Guest sees only their own reservations
     */
    it('should return only guest user reservations for guest', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: guestReservation.id,
        userId: guestUser.id,
        roomId: testRoom1.id,
      });
    });

    /**
     * Happy path: Admin sees all reservations
     */
    it('should return all reservations for admin', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(2);
      
      const reservationIds = response.body.map((r: Reservation) => r.id);
      expect(reservationIds).toContain(guestReservation.id);
      expect(reservationIds).toContain(adminReservation.id);
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject listing reservations without authentication', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Filtering: Filter by status
     */
    it('should filter reservations by status', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .query({ status: 'PENDING' })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: guestReservation.id,
        status: 'PENDING',
      });
    });

    /**
     * Filtering: Filter by roomId
     */
    it('should filter reservations by roomId', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .query({ roomId: testRoom1.id })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: guestReservation.id,
        roomId: testRoom1.id,
      });
    });

    /**
     * Filtering: Admin can filter by userId
     */
    it('should allow admin to filter reservations by userId', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .query({ userId: guestUser.id })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: guestReservation.id,
        userId: guestUser.id,
      });
    });

    /**
     * Authorization: Guest cannot filter by userId
     */
    it('should ignore userId filter for guest users', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .query({ userId: adminUser.id })
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        userId: guestUser.id,
      });
    });
  });

  // =============================================================================
  // GET /api/reservations/:id - GET RESERVATION BY ID
  // =============================================================================

  describe('GET /api/reservations/:id', () => {
    let guestReservation: Reservation;
    let adminReservation: Reservation;

    /**
     * Setup test reservations before each test
     */
    beforeEach(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      guestReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom1.id,
          checkInDate,
          checkOutDate,
          status: 'PENDING',
          totalPrice: 200.0,
        },
      });

      adminReservation = await prisma.reservation.create({
        data: {
          userId: adminUser.id,
          roomId: testRoom2.id,
          checkInDate,
          checkOutDate,
          status: 'CONFIRMED',
          totalPrice: 300.0,
        },
      });
    });

    /**
     * Happy path: Guest can view their own reservation
     */
    it('should return reservation details for owner', async () => {
      const response = await request(app)
        .get(`/api/reservations/${guestReservation.id}`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: guestReservation.id,
        userId: guestUser.id,
        roomId: testRoom1.id,
        status: 'PENDING',
      });
    });

    /**
     * Happy path: Admin can view any reservation
     */
    it('should return reservation details for admin', async () => {
      const response = await request(app)
        .get(`/api/reservations/${guestReservation.id}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: guestReservation.id,
        userId: guestUser.id,
      });
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject getting reservation without authentication', async () => {
      const response = await request(app)
        .get(`/api/reservations/${guestReservation.id}`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Authorization: Guest cannot view other user reservations
     */
    it('should reject guest viewing other user reservation', async () => {
      const response = await request(app)
        .get(`/api/reservations/${adminReservation.id}`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
      });
    });

    /**
     * Validation: Reject invalid reservation ID format
     */
    it('should reject invalid reservation ID format', async () => {
      const response = await request(app)
        .get('/api/reservations/invalid-uuid')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Business logic: Return 404 for non-existent reservation
     */
    it('should return 404 for non-existent reservation', async () => {
      const response = await request(app)
        .get('/api/reservations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
      });
    });
  });

  // =============================================================================
  // PUT /api/reservations/:id/confirm - CONFIRM RESERVATION
  // =============================================================================

  describe('PUT /api/reservations/:id/confirm', () => {
    let pendingReservation: Reservation;

    /**
     * Setup pending reservation before each test
     */
    beforeEach(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      pendingReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom1.id,
          checkInDate,
          checkOutDate,
          status: 'PENDING',
          totalPrice: 200.0,
        },
      });
    });

    /**
     * Happy path: Admin can confirm pending reservation
     */
    it('should confirm pending reservation for admin', async () => {
      const response = await request(app)
        .put(`/api/reservations/${pendingReservation.id}/confirm`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: pendingReservation.id,
        status: 'CONFIRMED',
      });

      // Verify database update
      const updated = await prisma.reservation.findUnique({
        where: { id: pendingReservation.id },
      });
      expect(updated?.status).toBe('CONFIRMED');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject confirmation without authentication', async () => {
      const response = await request(app)
        .put(`/api/reservations/${pendingReservation.id}/confirm`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Authorization: Reject guest user confirmation
     */
    it('should reject confirmation by guest user', async () => {
      const response = await request(app)
        .put(`/api/reservations/${pendingReservation.id}/confirm`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    });

    /**
     * Validation: Reject invalid reservation ID
     */
    it('should reject invalid reservation ID format', async () => {
      const response = await request(app)
        .put('/api/reservations/invalid-uuid/confirm')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Business logic: Reject confirming non-pending reservation
     */
    it('should reject confirming already confirmed reservation', async () => {
      // First confirmation
      await request(app)
        .put(`/api/reservations/${pendingReservation.id}/confirm`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      // Second confirmation attempt
      const response = await request(app)
        .put(`/api/reservations/${pendingReservation.id}/confirm`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
      });
    });
  });

  // =============================================================================
  // PUT /api/reservations/:id/check-in - PROCESS CHECK-IN
  // =============================================================================

  describe('PUT /api/reservations/:id/check-in', () => {
    let confirmedReservation: Reservation;

    /**
     * Setup confirmed reservation before each test
     */
    beforeEach(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      confirmedReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom1.id,
          checkInDate,
          checkOutDate,
          status: 'CONFIRMED',
          totalPrice: 200.0,
        },
      });
    });

    /**
     * Happy path: Admin can process check-in
     */
    it('should process check-in for confirmed reservation', async () => {
      const response = await request(app)
        .put(`/api/reservations/${confirmedReservation.id}/check-in`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: confirmedReservation.id,
        status: 'CHECKED_IN',
      });

      // Verify database update
      const updated = await prisma.reservation.findUnique({
        where: { id: confirmedReservation.id },
      });
      expect(updated?.status).toBe('CHECKED_IN');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject check-in without authentication', async () => {
      const response = await request(app)
        .put(`/api/reservations/${confirmedReservation.id}/check-in`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Authorization: Reject guest user check-in
     */
    it('should reject check-in by guest user', async () => {
      const response = await request(app)
        .put(`/api/reservations/${confirmedReservation.id}/check-in`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    });

    /**
     * Business logic: Reject check-in for non-confirmed reservation
     */
    it('should reject check-in for pending reservation', async () => {
      const pendingReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom2.id,
          checkInDate: new Date(),
          checkOutDate: new Date(),
          status: 'PENDING',
          totalPrice: 150.0,
        },
      });

      const response = await request(app)
        .put(`/api/reservations/${pendingReservation.id}/check-in`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
      });
    });
  });

  // =============================================================================
  // PUT /api/reservations/:id/check-out - PROCESS CHECK-OUT
  // =============================================================================

  describe('PUT /api/reservations/:id/check-out', () => {
    let checkedInReservation: Reservation;

    /**
     * Setup checked-in reservation before each test
     */
    beforeEach(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() - 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 1);

      checkedInReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom1.id,
          checkInDate,
          checkOutDate,
          status: 'CHECKED_IN',
          totalPrice: 200.0,
        },
      });
    });

    /**
     * Happy path: Admin can process check-out
     */
    it('should process check-out for checked-in reservation', async () => {
      const response = await request(app)
        .put(`/api/reservations/${checkedInReservation.id}/check-out`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: checkedInReservation.id,
        status: 'CHECKED_OUT',
      });

      // Verify database update
      const updated = await prisma.reservation.findUnique({
        where: { id: checkedInReservation.id },
      });
      expect(updated?.status).toBe('CHECKED_OUT');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject check-out without authentication', async () => {
      const response = await request(app)
        .put(`/api/reservations/${checkedInReservation.id}/check-out`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Authorization: Reject guest user check-out
     */
    it('should reject check-out by guest user', async () => {
      const response = await request(app)
        .put(`/api/reservations/${checkedInReservation.id}/check-out`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    });

    /**
     * Business logic: Reject check-out for non-checked-in reservation
     */
    it('should reject check-out for confirmed reservation', async () => {
      const confirmedReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom2.id,
          checkInDate: new Date(),
          checkOutDate: new Date(),
          status: 'CONFIRMED',
          totalPrice: 150.0,
        },
      });

      const response = await request(app)
        .put(`/api/reservations/${confirmedReservation.id}/check-out`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
      });
    });
  });

  // =============================================================================
  // PUT /api/reservations/:id/cancel - CANCEL RESERVATION
  // =============================================================================

  describe('PUT /api/reservations/:id/cancel', () => {
    let guestReservation: Reservation;
    let adminReservation: Reservation;

    /**
     * Setup test reservations before each test
     */
    beforeEach(async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      guestReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom1.id,
          checkInDate,
          checkOutDate,
          status: 'PENDING',
          totalPrice: 200.0,
        },
      });

      adminReservation = await prisma.reservation.create({
        data: {
          userId: adminUser.id,
          roomId: testRoom2.id,
          checkInDate,
          checkOutDate,
          status: 'CONFIRMED',
          totalPrice: 300.0,
        },
      });
    });

    /**
     * Happy path: Guest can cancel their own reservation
     */
    it('should allow guest to cancel their own reservation', async () => {
      const response = await request(app)
        .put(`/api/reservations/${guestReservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: guestReservation.id,
        status: 'CANCELLED',
      });

      // Verify database update
      const updated = await prisma.reservation.findUnique({
        where: { id: guestReservation.id },
      });
      expect(updated?.status).toBe('CANCELLED');
    });

    /**
     * Happy path: Admin can cancel any reservation
     */
    it('should allow admin to cancel any reservation', async () => {
      const response = await request(app)
        .put(`/api/reservations/${guestReservation.id}/cancel`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: guestReservation.id,
        status: 'CANCELLED',
      });
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject cancellation without authentication', async () => {
      const response = await request(app)
        .put(`/api/reservations/${guestReservation.id}/cancel`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Authorization: Guest cannot cancel other user reservations
     */
    it('should reject guest cancelling other user reservation', async () => {
      const response = await request(app)
        .put(`/api/reservations/${adminReservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
      });
    });

    /**
     * Business logic: Reject cancelling already cancelled reservation
     */
    it('should reject cancelling already cancelled reservation', async () => {
      // First cancellation
      await request(app)
        .put(`/api/reservations/${guestReservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(200);

      // Second cancellation attempt
      const response = await request(app)
        .put(`/api/reservations/${guestReservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
      });
    });

    /**
     * Business logic: Reject cancelling checked-out reservation
     */
    it('should reject cancelling checked-out reservation', async () => {
      const checkedOutReservation = await prisma.reservation.create({
        data: {
          userId: guestUser.id,
          roomId: testRoom1.id,
          checkInDate: new Date(),
          checkOutDate: new Date(),
          status: 'CHECKED_OUT',
          totalPrice: 200.0,
        },
      });

      const response = await request(app)
        .put(`/api/reservations/${checkedOutReservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
      });
    });
  });

  // =============================================================================
  // EDGE CASES AND ERROR SCENARIOS
  // =============================================================================

  describe('Edge Cases and Error Scenarios', () => {
    /**
     * Performance: Handle multiple concurrent reservations
     */
    it('should handle concurrent reservation requests', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${guestUser.token}`)
          .send({
            roomId: testRoom1.id,
            checkInDate: checkInDate.toISOString(),
            checkOutDate: checkOutDate.toISOString(),
          })
      );

      const responses = await Promise.all(requests);

      // Only one should succeed (201), others should fail (409)
      const successCount = responses.filter((r) => r.status === 201).length;
      const conflictCount = responses.filter((r) => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);
    });

    /**
     * Security: Reject malformed Authorization header
     */
    it('should reject malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Security: Reject empty Bearer token
     */
    it('should reject empty Bearer token', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    });

    /**
     * Validation: Handle extremely long date ranges
     */
    it('should reject extremely long reservation duration', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setFullYear(checkOutDate.getFullYear() + 10);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .send({
          roomId: testRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
      });
    });

    /**
     * Database: Handle database connection errors gracefully
     */
    it('should handle database errors gracefully', async () => {
      // Disconnect database to simulate error
      await prisma.$disconnect();

      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${guestUser.token}`)
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error',
      });

      // Reconnect database for subsequent tests
      await prisma.$connect();
    });
  });
});