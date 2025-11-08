import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../config/database';
import { hashPassword } from '../../utils/password.util';
import { UserRole } from '@prisma/client';

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new guest user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest@test.com',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'Guest',
          phoneNumber: '+1234567890',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'guest@test.com',
        firstName: 'Test',
        lastName: 'Guest',
        role: UserRole.GUEST,
      });
    });

    it('should not register user with existing email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+1234567890',
        });

      // Attempt duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'Password123!',
          firstName: 'Another',
          lastName: 'User',
          phoneNumber: '+0987654321',
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid@test.com',
          // Missing password
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+1234567890',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@test.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+1234567890',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Create test user
      const hashedPassword = await hashPassword('Password123!');
      await prisma.user.create({
        data: {
          email: 'login@test.com',
          password: hashedPassword,
          firstName: 'Login',
          lastName: 'Test',
          role: UserRole.GUEST,
          phoneNumber: '+1234567890',
        },
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'login@test.com',
        firstName: 'Login',
        lastName: 'Test',
      });
    });

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeAll(async () => {
      // Create and login test user
      const hashedPassword = await hashPassword('Password123!');
      await prisma.user.create({
        data: {
          email: 'me@test.com',
          password: hashedPassword,
          firstName: 'Me',
          lastName: 'Test',
          role: UserRole.GUEST,
          phoneNumber: '+1234567890',
        },
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'me@test.com',
          password: 'Password123!',
        });

      authToken = loginResponse.body.token;
    });

    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        email: 'me@test.com',
        firstName: 'Me',
        lastName: 'Test',
        role: UserRole.GUEST,
      });
    });

    it('should not get user without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should not get user with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      // Create and login test user
      const hashedPassword = await hashPassword('Password123!');
      await prisma.user.create({
        data: {
          email: 'refresh@test.com',
          password: hashedPassword,
          firstName: 'Refresh',
          lastName: 'Test',
          role: UserRole.GUEST,
          phoneNumber: '+1234567890',
        },
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh@test.com',
          password: 'Password123!',
        });

      refreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should not refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;
    let _userId: string;

    beforeAll(async () => {
      // Create and login test user
      const hashedPassword = await hashPassword('Password123!');
      const user = await prisma.user.create({
        data: {
          email: 'logout@test.com',
          password: hashedPassword,
          firstName: 'Logout',
          lastName: 'Test',
          role: UserRole.GUEST,
          phoneNumber: '+1234567890',
        },
      });

      _userId = user.id;

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logout@test.com',
          password: 'Password123!',
        });

      authToken = loginResponse.body.token;
    });

    it('should logout with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should not logout without token', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});