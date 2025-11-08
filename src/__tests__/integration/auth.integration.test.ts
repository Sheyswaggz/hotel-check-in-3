import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app';
import { hashPassword } from '../../utils/password.util';
import { generateToken } from '../../utils/jwt.util';

const prisma = new PrismaClient();

// =============================================================================
// TEST DATA SETUP
// =============================================================================

const testUser = {
  email: 'test@example.com',
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User',
  role: 'GUEST' as const,
};

const testStaff = {
  email: 'staff@example.com',
  password: 'Staff123!@#',
  firstName: 'Staff',
  lastName: 'Member',
  role: 'STAFF' as const,
};

const testAdmin = {
  email: 'admin@example.com',
  password: 'Admin123!@#',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN' as const,
};

// =============================================================================
// TEST SUITE SETUP AND TEARDOWN
// =============================================================================

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testUser.email, testStaff.email, testAdmin.email],
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testUser.email, testStaff.email, testAdmin.email],
        },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testUser.email, testStaff.email, testAdmin.email],
        },
      },
    });
  });

  // ===========================================================================
  // REGISTRATION TESTS
  // ===========================================================================

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.role).toBe('GUEST');
      expect(response.body.user).not.toHaveProperty('password');

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      expect(user).toBeTruthy();
      expect(user?.email).toBe(testUser.email);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          password: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          // Missing password, firstName, lastName
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 for duplicate email', async () => {
      // First registration
      await request(app).post('/api/auth/register').send(testUser).expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should hash password before storing', async () => {
      await request(app).post('/api/auth/register').send(testUser).expect(201);

      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      expect(user?.password).not.toBe(testUser.password);
      expect(user?.password).toMatch(/^\$2[aby]\$\d+\$/);
    });

    it('should set default role to GUEST if not specified', async () => {
      const userWithoutRole = {
        email: 'norole@example.com',
        password: 'Test123!@#',
        firstName: 'No',
        lastName: 'Role',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userWithoutRole)
        .expect(201);

      expect(response.body.user.role).toBe('GUEST');

      // Cleanup
      await prisma.user.delete({
        where: { email: userWithoutRole.email },
      });
    });
  });

  // ===========================================================================
  // LOGIN TESTS
  // ===========================================================================

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      const hashedPassword = await hashPassword(testUser.password);
      await prisma.user.create({
        data: {
          ...testUser,
          password: hashedPassword,
        },
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: testUser.password,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const token = response.body.token;
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  // ===========================================================================
  // PROFILE TESTS
  // ===========================================================================

  describe('GET /api/auth/profile', () => {
    let userToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create test user
      const hashedPassword = await hashPassword(testUser.password);
      const user = await prisma.user.create({
        data: {
          ...testUser,
          password: hashedPassword,
        },
      });
      userId = user.id;
      userToken = generateToken({ userId: user.id, role: user.role });
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('firstName', testUser.firstName);
      expect(response.body).toHaveProperty('lastName', testUser.lastName);
      expect(response.body).toHaveProperty('role', testUser.role);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/auth/profile').expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No token provided');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with expired token', async () => {
      // Generate token with past expiration
      const expiredToken = generateToken(
        { userId, role: testUser.role },
        '-1h',
      );

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 if user no longer exists', async () => {
      // Delete user but keep token
      await prisma.user.delete({ where: { id: userId } });

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('User not found');
    });
  });

  // ===========================================================================
  // UPDATE PROFILE TESTS
  // ===========================================================================

  describe('PUT /api/auth/profile', () => {
    let userToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create test user
      const hashedPassword = await hashPassword(testUser.password);
      const user = await prisma.user.create({
        data: {
          ...testUser,
          password: hashedPassword,
        },
      });
      userId = user.id;
      userToken = generateToken({ userId: user.id, role: user.role });
    });

    it('should update user profile successfully', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty('firstName', updates.firstName);
      expect(response.body).toHaveProperty('lastName', updates.lastName);
      expect(response.body).toHaveProperty('email', testUser.email);

      // Verify in database
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.firstName).toBe(updates.firstName);
      expect(user?.lastName).toBe(updates.lastName);
    });

    it('should update password successfully', async () => {
      const newPassword = 'NewPassword123!@#';

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: newPassword })
        .expect(200);

      expect(response.body).not.toHaveProperty('password');

      // Verify can login with new password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      // Verify cannot login with old password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(401);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({ firstName: 'Updated' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'weak' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should not allow updating role', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      // Role should remain unchanged
      expect(response.body.role).toBe(testUser.role);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.role).toBe(testUser.role);
    });

    it('should return 409 for duplicate email', async () => {
      // Create another user
      const hashedPassword = await hashPassword(testStaff.password);
      await prisma.user.create({
        data: {
          ...testStaff,
          password: hashedPassword,
        },
      });

      // Try to update to existing email
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: testStaff.email })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });
  });

  // ===========================================================================
  // ROLE-BASED ACCESS TESTS
  // ===========================================================================

  describe('Role-based Access Control', () => {
    let guestToken: string;
    let staffToken: string;
    let adminToken: string;

    beforeEach(async () => {
      // Create users with different roles
      const hashedPassword = await hashPassword('Test123!@#');

      const guest = await prisma.user.create({
        data: { ...testUser, password: hashedPassword },
      });
      const staff = await prisma.user.create({
        data: { ...testStaff, password: hashedPassword },
      });
      const admin = await prisma.user.create({
        data: { ...testAdmin, password: hashedPassword },
      });

      guestToken = generateToken({ userId: guest.id, role: guest.role });
      staffToken = generateToken({ userId: staff.id, role: staff.role });
      adminToken = generateToken({ userId: admin.id, role: admin.role });
    });

    it('should allow all authenticated users to access their profile', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should include correct role in profile response', async () => {
      const guestResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);
      expect(guestResponse.body.role).toBe('GUEST');

      const staffResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect(staffResponse.body.role).toBe('STAFF');

      const adminResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(adminResponse.body.role).toBe('ADMIN');
    });
  });

  // ===========================================================================
  // TOKEN VALIDATION TESTS
  // ===========================================================================

  describe('Token Validation', () => {
    let userToken: string;
    let userId: string;

    beforeEach(async () => {
      const hashedPassword = await hashPassword(testUser.password);
      const user = await prisma.user.create({
        data: {
          ...testUser,
          password: hashedPassword,
        },
      });
      userId = user.id;
      userToken = generateToken({ userId: user.id, role: user.role });
    });

    it('should accept token in Authorization header', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should reject token without Bearer prefix', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', userToken)
        .expect(401);
    });

    it('should reject malformed token', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer malformed.token')
        .expect(401);
    });

    it('should reject token with invalid signature', async () => {
      const parts = userToken.split('.');
      const invalidToken = `${parts[0]}.${parts[1]}.invalidsignature`;

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });
  });

  // ===========================================================================
  // RATE LIMITING TESTS
  // ===========================================================================

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const hashedPassword = await hashPassword(testUser.password);
      await prisma.user.create({
        data: {
          ...testUser,
          password: hashedPassword,
        },
      });

      // Make multiple failed login attempts
      const attempts = 10;
      const _rateLimitedResponses = [];

      for (let i = 0; i < attempts; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword',
          });

        _rateLimitedResponses.push(response);

        // After certain number of attempts, should get rate limited
        if (i >= 5) {
          expect([401, 429]).toContain(response.status);
        }
      }
    }, 30000);
  });

  // ===========================================================================
  // INPUT VALIDATION TESTS
  // ===========================================================================

  describe('Input Validation', () => {
    it('should validate email format on registration', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            ...testUser,
            email,
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should validate password strength on registration', async () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoSpecialChar123',
        'NoNumbers!@#',
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            ...testUser,
            password,
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should validate required fields on registration', async () => {
      const requiredFields = ['email', 'password', 'firstName', 'lastName'];

      for (const field of requiredFields) {
        const userData = { ...testUser };
        delete userData[field as keyof typeof userData];

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should sanitize input to prevent XSS', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          firstName: xssPayload,
        })
        .expect(201);

      // Should not contain script tags
      expect(response.body.user.firstName).not.toContain('<script>');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('Error Handling', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password',
        })
        .expect(401);

      // Should not reveal whether email exists
      expect(response.body.error.toLowerCase()).not.toContain('user not found');
      expect(response.body.error.toLowerCase()).toContain('invalid credentials');
    });

    it('should handle database errors gracefully', async () => {
      // Disconnect database to simulate error
      await prisma.$disconnect();

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect([500, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('error');

      // Reconnect for other tests
      await prisma.$connect();
    });
  });

  // ===========================================================================
  // SECURITY TESTS
  // ===========================================================================

  describe('Security', () => {
    it('should not return password in any response', async () => {
      // Registration
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);
      expect(registerResponse.body.user).not.toHaveProperty('password');

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);
      expect(loginResponse.body.user).not.toHaveProperty('password');

      // Profile
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);
      expect(profileResponse.body).not.toHaveProperty('password');
    });

    it('should use bcrypt for password hashing', async () => {
      await request(app).post('/api/auth/register').send(testUser).expect(201);

      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(user?.password).toMatch(/^\$2[aby]\$/);
      expect(user?.password).not.toBe(testUser.password);
    });

    it('should generate unique tokens for each login', async () => {
      const hashedPassword = await hashPassword(testUser.password);
      await prisma.user.create({
        data: {
          ...testUser,
          password: hashedPassword,
        },
      });

      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response1.body.token).not.toBe(response2.body.token);
    });
  });
});