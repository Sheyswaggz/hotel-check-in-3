/**
 * Reservation Integration Tests
 * 
 * Comprehensive test suite for reservation management endpoints with:
 * - Role-based access control validation
 * - Complete CRUD operation testing
 * - Conflict detection and validation
 * - State transition verification
 * - Error handling and edge cases
 * - Performance and security testing
 * 
 * Test Coverage:
 * - POST /api/reservations - Create reservation
 * - GET /api/reservations - List reservations (role-based)
 * - GET /api/reservations/:id - Get reservation details
 * - PUT /api/reservations/:id/confirm - Confirm reservation (admin)
 * - PUT /api/reservations/:id/check-in - Check-in process (admin)
 * - PUT /api/reservations/:id/check-out - Check-out process (admin)
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
class TestUserFactory {
  private static userCounter = 0;

  static async createAdmin(): Promise<User> {
    TestUserFactory.userCounter++;
    const hashedPassword = await hashPassword('Admin123!');
    
    return prisma.user.create({
      data: {
        email: `admin${TestUserFactory.userCounter}@test.com`,
        name: `Admin User ${TestUserFactory.userCounter}`,
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
  }

  static async createGuest(): Promise<User> {
    TestUserFactory.userCounter++;
    const hashedPassword = await hashPassword('Guest123!');
    
    return prisma.user.create({
      data: {
        email: `guest${TestUserFactory.userCounter}@test.com`,
        name: `Guest User ${TestUserFactory.userCounter}`,
        password: hashedPassword,
        role: 'GUEST',
      },
    });
  }

  static generateToken(user: User): string {
    return generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
  }
}

/**
 * Test room factory for creating test rooms
 */
class TestRoomFactory {
  private static roomCounter = 0;

  static async createAvailableRoom(): Promise<Room> {
    TestRoomFactory.roomCounter++;
    
    return prisma.room.create({
      data: {
        number: `${100 + TestRoomFactory.roomCounter}`,
        type: 'SINGLE',
        price: 100.00,
        status: 'AVAILABLE',
      },
    });
  }

  static async createOccupiedRoom(): Promise<Room> {
    TestRoomFactory.roomCounter++;
    
    return prisma.room.create({
      data: {
        number: `${200 + TestRoomFactory.roomCounter}`,
        type: 'DOUBLE',
        price: 150.00,
        status: 'OCCUPIED',
      },
    });
  }
}

/**
 * Test reservation factory for creating test reservations
 */
class TestReservationFactory {
  static async createPendingReservation(
    userId: string,
    roomId: string
  ): Promise<Reservation> {
    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() + 7); // 7 days from now
    
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 3); // 3-day stay

    return prisma.reservation.create({
      data: {
        userId,
        roomId,
        checkInDate,
        checkOutDate,
        status: 'PENDING',
      },
    });
  }

  static async createConfirmedReservation(
    userId: string,
    roomId: string
  ): Promise<Reservation> {
    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() + 7);
    
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 3);

    return prisma.reservation.create({
      data: {
        userId,
        roomId,
        checkInDate,
        checkOutDate,
        status: 'CONFIRMED',
      },
    });
  }

  static async createCheckedInReservation(
    userId: string,
    roomId: string
  ): Promise<Reservation> {
    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() - 1); // Started yesterday
    
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 3);

    return prisma.reservation.create({
      data: {
        userId,
        roomId,
        checkInDate,
        checkOutDate,
        status: 'CHECKED_IN',
      },
    });
  }
}

// =============================================================================
// TEST SUITE SETUP AND TEARDOWN
// =============================================================================

describe('Reservation Integration Tests', () => {
  let adminUser: User;
  let guestUser1: User;
  let guestUser2: User;
  let adminToken: string;
  let guestToken1: string;
  let guestToken2: string;
  let availableRoom1: Room;
  let availableRoom2: Room;
  let occupiedRoom: Room;

  /**
   * Setup: Create test users and rooms before all tests
   */
  beforeAll(async () => {
    // Create test users
    adminUser = await TestUserFactory.createAdmin();
    guestUser1 = await TestUserFactory.createGuest();
    guestUser2 = await TestUserFactory.createGuest();

    // Generate authentication tokens
    adminToken = TestUserFactory.generateToken(adminUser);
    guestToken1 = TestUserFactory.generateToken(guestUser1);
    guestToken2 = TestUserFactory.generateToken(guestUser2);

    // Create test rooms
    availableRoom1 = await TestRoomFactory.createAvailableRoom();
    availableRoom2 = await TestRoomFactory.createAvailableRoom();
    occupiedRoom = await TestRoomFactory.createOccupiedRoom();

    console.log('[Test Setup] Test data created successfully', {
      users: { admin: adminUser.id, guest1: guestUser1.id, guest2: guestUser2.id },
      rooms: { available1: availableRoom1.id, available2: availableRoom2.id, occupied: occupiedRoom.id },
    });
  });

  /**
   * Cleanup: Remove all test data after all tests
   */
  afterAll(async () => {
    // Delete in correct order to respect foreign key constraints
    await prisma.reservation.deleteMany({
      where: {
        OR: [
          { userId: adminUser.id },
          { userId: guestUser1.id },
          { userId: guestUser2.id },
        ],
      },
    });

    await prisma.room.deleteMany({
      where: {
        id: {
          in: [availableRoom1.id, availableRoom2.id, occupiedRoom.id],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [adminUser.id, guestUser1.id, guestUser2.id],
        },
      },
    });

    await prisma.$disconnect();

    console.log('[Test Cleanup] Test data cleaned up successfully');
  });

  /**
   * Reset: Clean up reservations between tests
   */
  afterEach(async () => {
    await prisma.reservation.deleteMany({
      where: {
        OR: [
          { userId: adminUser.id },
          { userId: guestUser1.id },
          { userId: guestUser2.id },
        ],
      },
    });

    // Reset room statuses
    await prisma.room.updateMany({
      where: {
        id: {
          in: [availableRoom1.id, availableRoom2.id],
        },
      },
      data: {
        status: 'AVAILABLE',
      },
    });
  });

  // =============================================================================
  // POST /api/reservations - CREATE RESERVATION
  // =============================================================================

  describe('POST /api/reservations - Create Reservation', () => {
    /**
     * Happy Path: Authenticated user creates valid reservation
     */
    it('should create reservation for authenticated guest user', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId: guestUser1.id,
        roomId: availableRoom1.id,
        status: 'PENDING',
      });

      expect(new Date(response.body.checkInDate)).toEqual(checkInDate);
      expect(new Date(response.body.checkOutDate)).toEqual(checkOutDate);
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    /**
     * Happy Path: Admin user creates reservation
     */
    it('should create reservation for authenticated admin user', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 10);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(201);

      expect(response.body.userId).toBe(adminUser.id);
      expect(response.body.status).toBe('PENDING');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject reservation creation without authentication', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .send({
          roomId: availableRoom1.id,
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
     * Security: Reject invalid authentication token
     */
    it('should reject reservation creation with invalid token', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', 'Bearer invalid-token-12345')
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    /**
     * Validation: Reject missing required fields
     */
    it('should reject reservation without roomId', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'roomId',
            message: expect.any(String),
          }),
        ])
      );
    });

    /**
     * Validation: Reject invalid date format
     */
    it('should reject reservation with invalid date format', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: 'invalid-date',
          checkOutDate: 'invalid-date',
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    /**
     * Business Logic: Reject check-in date in the past
     */
    it('should reject reservation with check-in date in the past', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() - 1); // Yesterday
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'checkInDate',
            message: expect.stringContaining('past'),
          }),
        ])
      );
    });

    /**
     * Business Logic: Reject check-out before check-in
     */
    it('should reject reservation with check-out date before check-in date', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() - 1); // Before check-in

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'checkOutDate',
            message: expect.stringContaining('after'),
          }),
        ])
      );
    });

    /**
     * Business Logic: Reject stay duration exceeding maximum
     */
    it('should reject reservation with stay duration exceeding 30 days', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 31); // 31 days

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('30 days'),
          }),
        ])
      );
    });

    /**
     * Business Logic: Reject reservation for non-existent room
     */
    it('should reject reservation for non-existent room', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: '00000000-0000-0000-0000-000000000000',
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('Room not found');
    });

    /**
     * Business Logic: Reject reservation for occupied room
     */
    it('should reject reservation for occupied room', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: occupiedRoom.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(409);

      expect(response.body.error).toBe('Conflict');
      expect(response.body.message).toContain('not available');
    });

    /**
     * Business Logic: Reject conflicting date ranges
     */
    it('should reject reservation with conflicting dates', async () => {
      // Create first reservation
      const checkInDate1 = new Date();
      checkInDate1.setDate(checkInDate1.getDate() + 7);
      
      const checkOutDate1 = new Date(checkInDate1);
      checkOutDate1.setDate(checkOutDate1.getDate() + 5);

      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate1.toISOString(),
          checkOutDate: checkOutDate1.toISOString(),
        })
        .expect(201);

      // Attempt overlapping reservation
      const checkInDate2 = new Date(checkInDate1);
      checkInDate2.setDate(checkInDate2.getDate() + 2); // Overlaps with first
      
      const checkOutDate2 = new Date(checkInDate2);
      checkOutDate2.setDate(checkOutDate2.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken2}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate2.toISOString(),
          checkOutDate: checkOutDate2.toISOString(),
        })
        .expect(409);

      expect(response.body.error).toBe('Conflict');
      expect(response.body.message).toContain('already reserved');
    });

    /**
     * Performance: Create reservation within acceptable time
     */
    it('should create reservation within 500ms', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const startTime = Date.now();

      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: availableRoom1.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(201);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });

  // =============================================================================
  // GET /api/reservations - LIST RESERVATIONS
  // =============================================================================

  describe('GET /api/reservations - List Reservations', () => {
    /**
     * Happy Path: Guest user retrieves own reservations
     */
    it('should return only guest user\'s own reservations', async () => {
      // Create reservations for different users
      await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );
      await TestReservationFactory.createPendingReservation(
        guestUser2.id,
        availableRoom2.id
      );

      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].userId).toBe(guestUser1.id);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    /**
     * Happy Path: Admin user retrieves all reservations
     */
    it('should return all reservations for admin user', async () => {
      // Create reservations for different users
      await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );
      await TestReservationFactory.createPendingReservation(
        guestUser2.id,
        availableRoom2.id
      );
      await TestReservationFactory.createPendingReservation(
        adminUser.id,
        availableRoom1.id
      );

      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination.total).toBe(3);
    });

    /**
     * Filtering: Filter by status
     */
    it('should filter reservations by status', async () => {
      await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );
      const confirmed = await TestReservationFactory.createConfirmedReservation(
        guestUser1.id,
        availableRoom2.id
      );

      const response = await request(app)
        .get('/api/reservations?status=CONFIRMED')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(confirmed.id);
      expect(response.body.data[0].status).toBe('CONFIRMED');
    });

    /**
     * Filtering: Admin filters by userId
     */
    it('should allow admin to filter by userId', async () => {
      await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );
      await TestReservationFactory.createPendingReservation(
        guestUser2.id,
        availableRoom2.id
      );

      const response = await request(app)
        .get(`/api/reservations?userId=${guestUser1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].userId).toBe(guestUser1.id);
    });

    /**
     * Authorization: Guest cannot filter by userId
     */
    it('should ignore userId filter for guest users', async () => {
      await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );
      await TestReservationFactory.createPendingReservation(
        guestUser2.id,
        availableRoom2.id
      );

      const response = await request(app)
        .get(`/api/reservations?userId=${guestUser2.id}`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      // Should only return guestUser1's reservations, ignoring userId filter
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].userId).toBe(guestUser1.id);
    });

    /**
     * Pagination: Paginate results correctly
     */
    it('should paginate reservations correctly', async () => {
      // Create 15 reservations
      for (let i = 0; i < 15; i++) {
        await TestReservationFactory.createPendingReservation(
          guestUser1.id,
          i % 2 === 0 ? availableRoom1.id : availableRoom2.id
        );
      }

      // Get first page
      const page1 = await request(app)
        .get('/api/reservations?page=1&limit=10')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      expect(page1.body.data).toHaveLength(10);
      expect(page1.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 15,
        totalPages: 2,
      });

      // Get second page
      const page2 = await request(app)
        .get('/api/reservations?page=2&limit=10')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      expect(page2.body.data).toHaveLength(5);
      expect(page2.body.pagination.page).toBe(2);
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject listing reservations without authentication', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    /**
     * Edge Case: Return empty array when no reservations exist
     */
    it('should return empty array when user has no reservations', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  // =============================================================================
  // GET /api/reservations/:id - GET RESERVATION BY ID
  // =============================================================================

  describe('GET /api/reservations/:id - Get Reservation Details', () => {
    /**
     * Happy Path: Guest retrieves own reservation
     */
    it('should return reservation details for guest user', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .get(`/api/reservations/${reservation.id}`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: reservation.id,
        userId: guestUser1.id,
        roomId: availableRoom1.id,
        status: 'PENDING',
      });
      expect(response.body.room).toBeDefined();
      expect(response.body.user).toBeDefined();
    });

    /**
     * Happy Path: Admin retrieves any reservation
     */
    it('should return reservation details for admin user', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .get(`/api/reservations/${reservation.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(reservation.id);
      expect(response.body.userId).toBe(guestUser1.id);
    });

    /**
     * Authorization: Guest cannot access other user's reservation
     */
    it('should reject guest accessing another user\'s reservation', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser2.id,
        availableRoom1.id
      );

      const response = await request(app)
        .get(`/api/reservations/${reservation.id}`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toContain('access');
    });

    /**
     * Validation: Reject invalid UUID format
     */
    it('should reject invalid reservation ID format', async () => {
      const response = await request(app)
        .get('/api/reservations/invalid-uuid')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'id',
            message: expect.stringContaining('UUID'),
          }),
        ])
      );
    });

    /**
     * Edge Case: Return 404 for non-existent reservation
     */
    it('should return 404 for non-existent reservation', async () => {
      const response = await request(app)
        .get('/api/reservations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('Reservation not found');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject getting reservation without authentication', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .get(`/api/reservations/${reservation.id}`)
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  // =============================================================================
  // PUT /api/reservations/:id/confirm - CONFIRM RESERVATION
  // =============================================================================

  describe('PUT /api/reservations/:id/confirm - Confirm Reservation', () => {
    /**
     * Happy Path: Admin confirms pending reservation
     */
    it('should allow admin to confirm pending reservation', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');
      expect(response.body.id).toBe(reservation.id);

      // Verify in database
      const updated = await prisma.reservation.findUnique({
        where: { id: reservation.id },
      });
      expect(updated?.status).toBe('CONFIRMED');
    });

    /**
     * Authorization: Reject guest user confirmation
     */
    it('should reject guest user attempting to confirm reservation', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/confirm`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    /**
     * Business Logic: Reject confirming non-pending reservation
     */
    it('should reject confirming already confirmed reservation', async () => {
      const reservation = await TestReservationFactory.createConfirmedReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('PENDING');
    });

    /**
     * Edge Case: Return 404 for non-existent reservation
     */
    it('should return 404 when confirming non-existent reservation', async () => {
      const response = await request(app)
        .put('/api/reservations/00000000-0000-0000-0000-000000000000/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject confirming reservation without authentication', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/confirm`)
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  // =============================================================================
  // PUT /api/reservations/:id/check-in - CHECK-IN RESERVATION
  // =============================================================================

  describe('PUT /api/reservations/:id/check-in - Check-In Process', () => {
    /**
     * Happy Path: Admin processes check-in
     */
    it('should allow admin to check-in confirmed reservation', async () => {
      const reservation = await TestReservationFactory.createConfirmedReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-in`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('CHECKED_IN');
      expect(response.body.id).toBe(reservation.id);

      // Verify room status updated
      const room = await prisma.room.findUnique({
        where: { id: availableRoom1.id },
      });
      expect(room?.status).toBe('OCCUPIED');
    });

    /**
     * Authorization: Reject guest user check-in
     */
    it('should reject guest user attempting to check-in', async () => {
      const reservation = await TestReservationFactory.createConfirmedReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-in`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    /**
     * Business Logic: Reject checking in non-confirmed reservation
     */
    it('should reject checking in pending reservation', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-in`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('CONFIRMED');
    });

    /**
     * Business Logic: Reject checking in already checked-in reservation
     */
    it('should reject checking in already checked-in reservation', async () => {
      const reservation = await TestReservationFactory.createCheckedInReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-in`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain('CONFIRMED');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject check-in without authentication', async () => {
      const reservation = await TestReservationFactory.createConfirmedReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-in`)
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  // =============================================================================
  // PUT /api/reservations/:id/check-out - CHECK-OUT RESERVATION
  // =============================================================================

  describe('PUT /api/reservations/:id/check-out - Check-Out Process', () => {
    /**
     * Happy Path: Admin processes check-out
     */
    it('should allow admin to check-out checked-in reservation', async () => {
      const reservation = await TestReservationFactory.createCheckedInReservation(
        guestUser1.id,
        availableRoom1.id
      );

      // Set room to occupied first
      await prisma.room.update({
        where: { id: availableRoom1.id },
        data: { status: 'OCCUPIED' },
      });

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-out`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('CHECKED_OUT');
      expect(response.body.id).toBe(reservation.id);

      // Verify room status updated
      const room = await prisma.room.findUnique({
        where: { id: availableRoom1.id },
      });
      expect(room?.status).toBe('AVAILABLE');
    });

    /**
     * Authorization: Reject guest user check-out
     */
    it('should reject guest user attempting to check-out', async () => {
      const reservation = await TestReservationFactory.createCheckedInReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-out`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    /**
     * Business Logic: Reject checking out non-checked-in reservation
     */
    it('should reject checking out confirmed reservation', async () => {
      const reservation = await TestReservationFactory.createConfirmedReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-out`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('CHECKED_IN');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject check-out without authentication', async () => {
      const reservation = await TestReservationFactory.createCheckedInReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/check-out`)
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  // =============================================================================
  // PUT /api/reservations/:id/cancel - CANCEL RESERVATION
  // =============================================================================

  describe('PUT /api/reservations/:id/cancel - Cancel Reservation', () => {
    /**
     * Happy Path: Guest cancels own reservation
     */
    it('should allow guest to cancel own pending reservation', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
      expect(response.body.id).toBe(reservation.id);
    });

    /**
     * Happy Path: Guest cancels own confirmed reservation
     */
    it('should allow guest to cancel own confirmed reservation', async () => {
      const reservation = await TestReservationFactory.createConfirmedReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
    });

    /**
     * Happy Path: Admin cancels any reservation
     */
    it('should allow admin to cancel any reservation', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
    });

    /**
     * Business Logic: Cancel checked-in reservation and free room
     */
    it('should free room when cancelling checked-in reservation', async () => {
      const reservation = await TestReservationFactory.createCheckedInReservation(
        guestUser1.id,
        availableRoom1.id
      );

      // Set room to occupied
      await prisma.room.update({
        where: { id: availableRoom1.id },
        data: { status: 'OCCUPIED' },
      });

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');

      // Verify room is available
      const room = await prisma.room.findUnique({
        where: { id: availableRoom1.id },
      });
      expect(room?.status).toBe('AVAILABLE');
    });

    /**
     * Authorization: Reject guest cancelling other user's reservation
     */
    it('should reject guest cancelling another user\'s reservation', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser2.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toContain('access');
    });

    /**
     * Business Logic: Reject cancelling already checked-out reservation
     */
    it('should reject cancelling checked-out reservation', async () => {
      // Create and check out reservation
      const reservation = await TestReservationFactory.createCheckedInReservation(
        guestUser1.id,
        availableRoom1.id
      );

      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CHECKED_OUT' },
      });

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('CHECKED_OUT');
    });

    /**
     * Edge Case: Return 404 for non-existent reservation
     */
    it('should return 404 when cancelling non-existent reservation', async () => {
      const response = await request(app)
        .put('/api/reservations/00000000-0000-0000-0000-000000000000/cancel')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });

    /**
     * Security: Reject unauthenticated requests
     */
    it('should reject cancelling reservation without authentication', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const response = await request(app)
        .put(`/api/reservations/${reservation.id}/cancel`)
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  // =============================================================================
  // PERFORMANCE TESTS
  // =============================================================================

  describe('Performance Tests', () => {
    /**
     * Performance: List reservations within acceptable time
     */
    it('should list reservations within 300ms', async () => {
      // Create 50 reservations
      for (let i = 0; i < 50; i++) {
        await TestReservationFactory.createPendingReservation(
          guestUser1.id,
          i % 2 === 0 ? availableRoom1.id : availableRoom2.id
        );
      }

      const startTime = Date.now();

      await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(300);
    });

    /**
     * Performance: Get reservation by ID within acceptable time
     */
    it('should get reservation by ID within 200ms', async () => {
      const reservation = await TestReservationFactory.createPendingReservation(
        guestUser1.id,
        availableRoom1.id
      );

      const startTime = Date.now();

      await request(app)
        .get(`/api/reservations/${reservation.id}`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);
    });
  });

  // =============================================================================
  // EDGE CASES AND ERROR SCENARIOS
  // =============================================================================

  describe('Edge Cases and Error Scenarios', () => {
    /**
     * Edge Case: Handle malformed JSON
     */
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    /**
     * Edge Case: Handle extremely long input strings
     */
    it('should reject extremely long input strings', async () => {
      const longString = 'a'.repeat(10000);
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: longString,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    /**
     * Edge Case: Handle concurrent reservation attempts
     */
    it('should handle concurrent reservation attempts correctly', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const reservationData = {
        roomId: availableRoom1.id,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
      };

      // Attempt concurrent reservations
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${guestToken1}`)
          .send(reservationData),
        request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${guestToken2}`)
          .send(reservationData),
      ]);

      // One should succeed, one should fail
      const statuses = [response1.status, response2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });

    /**
     * Security: Reject SQL injection attempts
     */
    it('should reject SQL injection attempts in query parameters', async () => {
      const response = await request(app)
        .get('/api/reservations?status=PENDING\' OR \'1\'=\'1')
        .set('Authorization', `Bearer ${guestToken1}`)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    /**
     * Security: Reject XSS attempts in input
     */
    it('should sanitize XSS attempts in input', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 7);
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          roomId: '<script>alert("xss")</script>',
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });
});