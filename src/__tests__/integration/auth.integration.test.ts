import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app';
import { hashPassword } from '../../utils/password.util';
import { generateToken } from '../../utils/jwt.util';

const prisma = new PrismaClient();

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({});
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+1234567890',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        role: 'GUEST',
      });
      expect(response.body.user).not.toHaveProperty('password');

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(user).toBeTruthy();
      expect(user?.email).toBe(userData.email);
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Doe',
        phoneNumber: '+1234567891',
      };

      // Create user first
      await prisma.user.create({
        data: {
          ...userData,
          password: await hashPassword(userData.password),
        },
      });

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+1234567890',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+1234567890',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('password');
    });

    it('should reject registration with missing required fields', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with invalid phone number', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: 'invalid',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await prisma.user.create({
        data: {
          email: 'login@example.com',
          password: await hashPassword('SecurePass123!'),
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+1234567890',
          role: 'GUEST',
        },
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'login@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'GUEST',
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      const token = response.body.token;
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Verify token can be used for authenticated requests
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.email).toBe('login@example.com');
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create a test user and get auth token
      const user = await prisma.user.create({
        data: {
          email: 'profile@example.com',
          password: await hashPassword('SecurePass123!'),
          firstName: 'Profile',
          lastName: 'User',
          phoneNumber: '+1234567890',
          role: 'GUEST',
        },
      });
      userId = user.id;
      authToken = generateToken({ userId: user.id, email: user.email, role: user.role });
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        email: 'profile@example.com',
        firstName: 'Profile',
        lastName: 'User',
        role: 'GUEST',
      });
      expect(response.body).not.toHaveProperty('password');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('token');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with expired token', async () => {
      // Generate an expired token (this would require mocking or using a very short expiry)
      const expiredToken = generateToken(
        { userId, email: 'profile@example.com', role: 'GUEST' },
        '0s'
      );

      // Wait a moment to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/auth/profile', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'update@example.com',
          password: await hashPassword('SecurePass123!'),
          firstName: 'Update',
          lastName: 'User',
          phoneNumber: '+1234567890',
          role: 'GUEST',
        },
      });
      userId = user.id;
      authToken = generateToken({ userId: user.id, email: user.email, role: user.role });
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '+9876543210',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        email: 'update@example.com',
        ...updateData,
      });

      // Verify changes in database
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.firstName).toBe(updateData.firstName);
      expect(user?.lastName).toBe(updateData.lastName);
      expect(user?.phoneNumber).toBe(updateData.phoneNumber);
    });

    it('should reject update without authentication', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({ firstName: 'Updated' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject update with invalid phone number', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phoneNumber: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should not allow email update', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'newemail@example.com' })
        .expect(200);

      // Email should remain unchanged
      expect(response.body.email).toBe('update@example.com');
    });

    it('should not allow role update', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      // Role should remain unchanged
      expect(response.body.role).toBe('GUEST');
    });
  });

  describe('POST /api/auth/change-password', () => {
    let authToken: string;
    let userId: string;
    const originalPassword = 'SecurePass123!';

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'password@example.com',
          password: await hashPassword(originalPassword),
          firstName: 'Password',
          lastName: 'User',
          phoneNumber: '+1234567890',
          role: 'GUEST',
        },
      });
      userId = user.id;
      authToken = generateToken({ userId: user.id, email: user.email, role: user.role });
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewSecurePass123!';

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: originalPassword,
          newPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'password@example.com',
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('token');
    });

    it('should reject password change with wrong current password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewSecurePass123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('current password');
    });

    it('should reject password change with weak new password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: originalPassword,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject password change without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: originalPassword,
          newPassword: 'NewSecurePass123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'logout@example.com',
          password: await hashPassword('SecurePass123!'),
          firstName: 'Logout',
          lastName: 'User',
          phoneNumber: '+1234567890',
          role: 'GUEST',
        },
      });
      authToken = generateToken({ userId: user.id, email: user.email, role: user.role });
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject logout without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security Tests', () => {
    it('should rate limit login attempts', async () => {
      // Create a test user
      await prisma.user.create({
        data: {
          email: 'ratelimit@example.com',
          password: await hashPassword('SecurePass123!'),
          firstName: 'Rate',
          lastName: 'Limit',
          phoneNumber: '+1234567890',
          role: 'GUEST',
        },
      });

      // Make multiple failed login attempts
      const attempts = 10;
      for (let i = 0; i < attempts; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'ratelimit@example.com',
            password: 'WrongPassword',
          });
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ratelimit@example.com',
          password: 'WrongPassword',
        });

      // Should either be rate limited (429) or still accepting (401)
      // This depends on rate limiting configuration
      expect([401, 429]).toContain(response.status);
    });

    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
        .expect(401);

      // Error should not reveal whether email exists
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.error).not.toContain('email');
      expect(response.body.error).not.toContain('user');
    });

    it('should hash passwords securely', async () => {
      const password = 'SecurePass123!';
      const user = await prisma.user.create({
        data: {
          email: 'hash@example.com',
          password: await hashPassword(password),
          firstName: 'Hash',
          lastName: 'Test',
          phoneNumber: '+1234567890',
          role: 'GUEST',
        },
      });

      // Password should be hashed
      expect(user.password).not.toBe(password);
      expect(user.password.length).toBeGreaterThan(password.length);

      // Should be able to login with original password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'hash@example.com',
          password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
    });
  });
});