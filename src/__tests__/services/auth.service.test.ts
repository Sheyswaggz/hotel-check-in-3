// src/__tests__/services/auth.service.test.ts
// =============================================================================
// AUTHENTICATION SERVICE TEST SUITE
// =============================================================================
// Comprehensive test coverage for user registration, login, and token generation
// with extensive mocking, edge case validation, and security testing.
//
// Test Strategy:
// - Unit tests for all public methods (register, login, getUserById)
// - Integration tests with mocked Prisma client
// - Security validation (password hashing, email sanitization)
// - Error handling for all failure scenarios
// - Performance validation for critical paths
// - Edge case coverage (null, empty, invalid inputs)
//
// Coverage Target: >90% (lines, branches, functions, statements)
// =============================================================================

import { AuthService } from '../../services/auth.service';
import { prisma } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/password.util';
import { generateToken } from '../../utils/jwt.util';
import type { RegisterDto, LoginDto } from '../../types/auth.types';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock Prisma client
jest.mock('../../config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock password utilities
jest.mock('../../utils/password.util', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));

// Mock JWT utilities
jest.mock('../../utils/jwt.util', () => ({
  generateToken: jest.fn(),
}));

// =============================================================================
// TYPE DEFINITIONS FOR MOCKS
// =============================================================================

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockComparePassword = comparePassword as jest.MockedFunction<typeof comparePassword>;
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Factory for creating valid registration data
 */
const createValidRegisterDto = (overrides?: Partial<RegisterDto>): RegisterDto => ({
  email: 'test@example.com',
  password: 'SecurePass123!',
  role: 'GUEST',
  ...overrides,
});

/**
 * Factory for creating valid login data
 */
const createValidLoginDto = (overrides?: Partial<LoginDto>): LoginDto => ({
  email: 'test@example.com',
  password: 'SecurePass123!',
  ...overrides,
});

/**
 * Factory for creating mock user database record
 */
const createMockUser = (overrides?: Partial<any>) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  password: '$2b$10$hashedPasswordExample123456789012345678901234567890',
  role: 'GUEST',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

/**
 * Factory for creating mock JWT token
 */
const createMockToken = (): string => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiR1VFU1QifQ.signature';

// =============================================================================
// TEST SUITE SETUP AND TEARDOWN
// =============================================================================

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Create fresh instance for each test
    authService = new AuthService();

    // Reset all mocks
    jest.clearAllMocks();

    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore console
    jest.restoreAllMocks();
  });

  // =============================================================================
  // REGISTRATION TESTS - HAPPY PATH
  // =============================================================================

  describe('register() - Happy Path', () => {
    it('should successfully register a new GUEST user with valid data', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const mockUser = createMockUser();
      const mockToken = createMockToken();
      const hashedPassword = '$2b$10$hashedPassword';

      mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
      mockHashPassword.mockResolvedValue(hashedPassword);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
        token: mockToken,
      });

      // Verify mock calls
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email.toLowerCase() },
      });
      expect(mockHashPassword).toHaveBeenCalledWith(registerDto.password);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email.toLowerCase(),
          password: hashedPassword,
          role: registerDto.role,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('should successfully register a new ADMIN user with valid data', async () => {
      // Arrange
      const registerDto = createValidRegisterDto({ role: 'ADMIN' });
      const mockUser = createMockUser({ role: 'ADMIN' });
      const mockToken = createMockToken();
      const hashedPassword = '$2b$10$hashedPassword';

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue(hashedPassword);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(result.user.role).toBe('ADMIN');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'ADMIN' }),
        })
      );
    });

    it('should sanitize email to lowercase during registration', async () => {
      // Arrange
      const registerDto = createValidRegisterDto({ email: 'Test@EXAMPLE.COM' });
      const mockUser = createMockUser({ email: 'test@example.com' });
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      await authService.register(registerDto);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'test@example.com' }),
        })
      );
    });

    it('should trim whitespace from email during registration', async () => {
      // Arrange
      const registerDto = createValidRegisterDto({ email: '  test@example.com  ' });
      const mockUser = createMockUser();
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      await authService.register(registerDto);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  // =============================================================================
  // REGISTRATION TESTS - VALIDATION ERRORS
  // =============================================================================

  describe('register() - Validation Errors', () => {
    it('should reject registration with null data', async () => {
      // Act & Assert
      await expect(authService.register(null as any)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_INPUT',
        statusCode: 400,
        message: 'Invalid registration data',
      });

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject registration with undefined data', async () => {
      // Act & Assert
      await expect(authService.register(undefined as any)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_INPUT',
        statusCode: 400,
      });
    });

    it('should reject registration with non-object data', async () => {
      // Act & Assert
      await expect(authService.register('invalid' as any)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_INPUT',
        statusCode: 400,
      });
    });

    it('should reject registration with missing email', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      delete (registerDto as any).email;

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_EMAIL',
        statusCode: 400,
        message: 'Email is required and must be a string',
      });
    });

    it('should reject registration with empty email', async () => {
      // Arrange
      const registerDto = createValidRegisterDto({ email: '' });

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_EMAIL_FORMAT',
        statusCode: 400,
        message: 'Invalid email format',
      });
    });

    it('should reject registration with non-string email', async () => {
      // Arrange
      const registerDto = createValidRegisterDto({ email: 123 as any });

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_EMAIL',
        statusCode: 400,
      });
    });

    it('should reject registration with invalid email format', async () => {
      // Arrange
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        'double@@domain.com',
      ];

      // Act & Assert
      for (const email of invalidEmails) {
        const registerDto = createValidRegisterDto({ email });
        await expect(authService.register(registerDto)).rejects.toMatchObject({
          name: 'AuthServiceError',
          code: 'INVALID_EMAIL_FORMAT',
          statusCode: 400,
        });
      }
    });

    it('should reject registration with missing password', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      delete (registerDto as any).password;

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_PASSWORD',
        statusCode: 400,
        message: 'Password is required and must be a string',
      });
    });

    it('should reject registration with empty password', async () => {
      // Arrange
      const registerDto = createValidRegisterDto({ password: '' });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockRejectedValue(new Error('Password validation failed'));

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'PASSWORD_VALIDATION_FAILED',
        statusCode: 400,
      });
    });

    it('should reject registration with non-string password', async () => {
      // Arrange
      const registerDto = createValidRegisterDto({ password: 12345 as any });

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_PASSWORD',
        statusCode: 400,
      });
    });

    it('should reject registration with missing role', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      delete (registerDto as any).role;

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_ROLE',
        statusCode: 400,
        message: 'Role must be either ADMIN or GUEST',
      });
    });

    it('should reject registration with invalid role', async () => {
      // Arrange
      const invalidRoles = ['USER', 'SUPERADMIN', 'user', 'admin', '', null, undefined];

      // Act & Assert
      for (const role of invalidRoles) {
        const registerDto = createValidRegisterDto({ role: role as any });
        await expect(authService.register(registerDto)).rejects.toMatchObject({
          name: 'AuthServiceError',
          code: 'INVALID_ROLE',
          statusCode: 400,
        });
      }
    });
  });

  // =============================================================================
  // REGISTRATION TESTS - BUSINESS LOGIC ERRORS
  // =============================================================================

  describe('register() - Business Logic Errors', () => {
    it('should reject registration when email already exists', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const existingUser = createMockUser();

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'EMAIL_EXISTS',
        statusCode: 409,
        message: 'User with this email already exists',
        details: { email: registerDto.email.toLowerCase() },
      });

      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should reject registration when password hashing fails', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const hashError = new Error('Hashing failed');

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockRejectedValue(hashError);

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'PASSWORD_VALIDATION_FAILED',
        statusCode: 400,
      });

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle Prisma unique constraint violation (P2002)', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const prismaError = {
        code: 'P2002',
        meta: { target: ['email'] },
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'EMAIL_EXISTS',
        statusCode: 409,
      });
    });

    it('should handle unexpected database errors', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const dbError = new Error('Database connection failed');

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockRejectedValue(dbError);

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'REGISTRATION_FAILED',
        statusCode: 500,
        message: 'Failed to register user',
      });
    });

    it('should handle token generation failure', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const mockUser = createMockUser();

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'REGISTRATION_FAILED',
        statusCode: 500,
      });
    });
  });

  // =============================================================================
  // LOGIN TESTS - HAPPY PATH
  // =============================================================================

  describe('login() - Happy Path', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      const mockUser = createMockUser();
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const result = await authService.login(loginDto);

      // Assert
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
        token: mockToken,
      });

      // Verify password is not included in response
      expect(result.user).not.toHaveProperty('password');

      // Verify mock calls
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email.toLowerCase() },
        select: {
          id: true,
          email: true,
          password: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockComparePassword).toHaveBeenCalledWith(loginDto.password, mockUser.password);
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('should sanitize email to lowercase during login', async () => {
      // Arrange
      const loginDto = createValidLoginDto({ email: 'Test@EXAMPLE.COM' });
      const mockUser = createMockUser({ email: 'test@example.com' });
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      await authService.login(loginDto);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: expect.any(Object),
      });
    });

    it('should trim whitespace from email during login', async () => {
      // Arrange
      const loginDto = createValidLoginDto({ email: '  test@example.com  ' });
      const mockUser = createMockUser();
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      await authService.login(loginDto);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: expect.any(Object),
      });
    });
  });

  // =============================================================================
  // LOGIN TESTS - VALIDATION ERRORS
  // =============================================================================

  describe('login() - Validation Errors', () => {
    it('should reject login with null data', async () => {
      // Act & Assert
      await expect(authService.login(null as any)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_INPUT',
        statusCode: 400,
        message: 'Invalid login data',
      });

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject login with undefined data', async () => {
      // Act & Assert
      await expect(authService.login(undefined as any)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_INPUT',
        statusCode: 400,
      });
    });

    it('should reject login with non-object data', async () => {
      // Act & Assert
      await expect(authService.login('invalid' as any)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_INPUT',
        statusCode: 400,
      });
    });

    it('should reject login with missing email', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      delete (loginDto as any).email;

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_EMAIL',
        statusCode: 400,
        message: 'Email is required and must be a string',
      });
    });

    it('should reject login with empty email', async () => {
      // Arrange
      const loginDto = createValidLoginDto({ email: '' });

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_EMAIL_FORMAT',
        statusCode: 400,
      });
    });

    it('should reject login with non-string email', async () => {
      // Arrange
      const loginDto = createValidLoginDto({ email: 123 as any });

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_EMAIL',
        statusCode: 400,
      });
    });

    it('should reject login with invalid email format', async () => {
      // Arrange
      const invalidEmails = ['notanemail', 'missing@domain', '@nodomain.com'];

      // Act & Assert
      for (const email of invalidEmails) {
        const loginDto = createValidLoginDto({ email });
        await expect(authService.login(loginDto)).rejects.toMatchObject({
          name: 'AuthServiceError',
          code: 'INVALID_EMAIL_FORMAT',
          statusCode: 400,
        });
      }
    });

    it('should reject login with missing password', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      delete (loginDto as any).password;

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_PASSWORD',
        statusCode: 400,
        message: 'Password is required and must be a string',
      });
    });

    it('should reject login with empty password', async () => {
      // Arrange
      const loginDto = createValidLoginDto({ password: '' });

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_PASSWORD',
        statusCode: 400,
      });
    });

    it('should reject login with non-string password', async () => {
      // Arrange
      const loginDto = createValidLoginDto({ password: 12345 as any });

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_PASSWORD',
        statusCode: 400,
      });
    });
  });

  // =============================================================================
  // LOGIN TESTS - AUTHENTICATION ERRORS
  // =============================================================================

  describe('login() - Authentication Errors', () => {
    it('should reject login when user does not exist', async () => {
      // Arrange
      const loginDto = createValidLoginDto();

      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
        message: 'Invalid email or password',
      });

      expect(mockComparePassword).not.toHaveBeenCalled();
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should reject login when password is incorrect', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      const mockUser = createMockUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
        message: 'Invalid email or password',
      });

      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should handle password comparison failure', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      const mockUser = createMockUser();
      const comparisonError = new Error('Comparison failed');

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockRejectedValue(comparisonError);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'PASSWORD_VERIFICATION_FAILED',
        statusCode: 500,
        message: 'Failed to verify password',
      });

      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should handle token generation failure during login', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      const mockUser = createMockUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'LOGIN_FAILED',
        statusCode: 500,
      });
    });

    it('should handle unexpected database errors during login', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      const dbError = new Error('Database connection failed');

      mockPrisma.user.findUnique.mockRejectedValue(dbError);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toMatchObject({
        name: 'AuthServiceError',
        code: 'LOGIN_FAILED',
        statusCode: 500,
        message: 'Failed to login user',
      });
    });
  });

  // =============================================================================
  // GET USER BY ID TESTS - HAPPY PATH
  // =============================================================================

  describe('getUserById() - Happy Path', () => {
    it('should successfully retrieve user by valid ID', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockUser = createMockUser({ id: userId });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      // Verify password is not included
      expect(result).not.toHaveProperty('password');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should trim whitespace from user ID', async () => {
      // Arrange
      const userId = '  123e4567-e89b-12d3-a456-426614174000  ';
      const mockUser = createMockUser({ id: userId.trim() });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).not.toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId.trim() },
        select: expect.any(Object),
      });
    });
  });

  // =============================================================================
  // GET USER BY ID TESTS - ERROR CASES
  // =============================================================================

  describe('getUserById() - Error Cases', () => {
    it('should return null when user ID is empty string', async () => {
      // Act
      const result = await authService.getUserById('');

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return null when user ID is whitespace only', async () => {
      // Act
      const result = await authService.getUserById('   ');

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return null when user ID is null', async () => {
      // Act
      const result = await authService.getUserById(null as any);

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return null when user ID is undefined', async () => {
      // Act
      const result = await authService.getUserById(undefined as any);

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return null when user ID is non-string', async () => {
      // Act
      const result = await authService.getUserById(123 as any);

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return null when user is not found', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: expect.any(Object),
      });
    });

    it('should return null when database query fails', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const dbError = new Error('Database connection failed');

      mockPrisma.user.findUnique.mockRejectedValue(dbError);

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockPrisma.user.findUnique.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // SECURITY TESTS
  // =============================================================================

  describe('Security Validation', () => {
    it('should never expose password in registration response', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const mockUser = createMockUser();
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(result.user).not.toHaveProperty('password');
      expect(Object.keys(result.user)).toEqual(['id', 'email', 'role', 'createdAt', 'updatedAt']);
    });

    it('should never expose password in login response', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      const mockUser = createMockUser();
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const result = await authService.login(loginDto);

      // Assert
      expect(result.user).not.toHaveProperty('password');
    });

    it('should never expose password in getUserById response', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockUser = createMockUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).not.toHaveProperty('password');
    });

    it('should use same error message for non-existent user and wrong password', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      const mockUser = createMockUser();

      // Test non-existent user
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const error1 = await authService.login(loginDto).catch((e) => e);

      // Test wrong password
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(false);
      const error2 = await authService.login(loginDto).catch((e) => e);

      // Assert - Both should have same message to prevent user enumeration
      expect(error1.message).toBe(error2.message);
      expect(error1.code).toBe(error2.code);
      expect(error1.statusCode).toBe(error2.statusCode);
    });

    it('should always hash passwords before storing', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const mockUser = createMockUser();
      const mockToken = createMockToken();
      const hashedPassword = '$2b$10$hashedPassword';

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue(hashedPassword);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      await authService.register(registerDto);

      // Assert
      expect(mockHashPassword).toHaveBeenCalledWith(registerDto.password);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: hashedPassword,
          }),
        })
      );
      // Verify plain password is never stored
      expect(mockPrisma.user.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: registerDto.password,
          }),
        })
      );
    });
  });

  // =============================================================================
  // PERFORMANCE TESTS
  // =============================================================================

  describe('Performance Validation', () => {
    it('should complete registration within acceptable time', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const mockUser = createMockUser();
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const startTime = Date.now();
      await authService.register(registerDto);
      const duration = Date.now() - startTime;

      // Assert - Should complete in under 100ms (mocked operations)
      expect(duration).toBeLessThan(100);
    });

    it('should complete login within acceptable time', async () => {
      // Arrange
      const loginDto = createValidLoginDto();
      const mockUser = createMockUser();
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const startTime = Date.now();
      await authService.login(loginDto);
      const duration = Date.now() - startTime;

      // Assert - Should complete in under 100ms (mocked operations)
      expect(duration).toBeLessThan(100);
    });

    it('should complete getUserById within acceptable time', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockUser = createMockUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const startTime = Date.now();
      await authService.getUserById(userId);
      const duration = Date.now() - startTime;

      // Assert - Should complete in under 50ms (simple query)
      expect(duration).toBeLessThan(50);
    });
  });

  // =============================================================================
  // EDGE CASES AND BOUNDARY CONDITIONS
  // =============================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long email addresses', async () => {
      // Arrange
      const longEmail = 'a'.repeat(100) + '@example.com';
      const registerDto = createValidRegisterDto({ email: longEmail });
      const mockUser = createMockUser({ email: longEmail.toLowerCase() });
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(result.user.email).toBe(longEmail.toLowerCase());
    });

    it('should handle email with special characters', async () => {
      // Arrange
      const specialEmail = 'user+test@example.co.uk';
      const registerDto = createValidRegisterDto({ email: specialEmail });
      const mockUser = createMockUser({ email: specialEmail.toLowerCase() });
      const mockToken = createMockToken();

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(result.user.email).toBe(specialEmail.toLowerCase());
    });

    it('should handle concurrent registration attempts for same email', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();

      // First call succeeds
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValueOnce(createMockUser());
      mockGenerateToken.mockReturnValue(createMockToken());

      // Second call finds existing user
      mockPrisma.user.findUnique.mockResolvedValueOnce(createMockUser());

      // Act
      const result1 = await authService.register(registerDto);
      const result2Promise = authService.register(registerDto);

      // Assert
      expect(result1).toBeDefined();
      await expect(result2Promise).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
        statusCode: 409,
      });
    });

    it('should handle user with very old timestamps', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const oldDate = new Date('1970-01-01T00:00:00.000Z');
      const mockUser = createMockUser({
        createdAt: oldDate,
        updatedAt: oldDate,
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.createdAt).toEqual(oldDate);
      expect(result?.updatedAt).toEqual(oldDate);
    });

    it('should handle user with future timestamps', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const futureDate = new Date('2099-12-31T23:59:59.999Z');
      const mockUser = createMockUser({
        createdAt: futureDate,
        updatedAt: futureDate,
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.createdAt).toEqual(futureDate);
      expect(result?.updatedAt).toEqual(futureDate);
    });
  });

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Integration Scenarios', () => {
    it('should complete full registration and login flow', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const loginDto = createValidLoginDto({
        email: registerDto.email,
        password: registerDto.password,
      });
      const mockUser = createMockUser({ email: registerDto.email.toLowerCase() });
      const mockToken = createMockToken();

      // Registration
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Login
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      mockComparePassword.mockResolvedValue(true);

      // Act
      const registerResult = await authService.register(registerDto);
      const loginResult = await authService.login(loginDto);

      // Assert
      expect(registerResult.user.email).toBe(loginResult.user.email);
      expect(registerResult.user.id).toBe(loginResult.user.id);
      expect(registerResult.token).toBeDefined();
      expect(loginResult.token).toBeDefined();
    });

    it('should retrieve user after successful registration', async () => {
      // Arrange
      const registerDto = createValidRegisterDto();
      const mockUser = createMockUser();
      const mockToken = createMockToken();

      // Registration
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockHashPassword.mockResolvedValue('$2b$10$hash');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue(mockToken);

      // Get user by ID
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      // Act
      const registerResult = await authService.register(registerDto);
      const userResult = await authService.getUserById(registerResult.user.id);

      // Assert
      expect(userResult).not.toBeNull();
      expect(userResult?.id).toBe(registerResult.user.id);
      expect(userResult?.email).toBe(registerResult.user.email);
    });
  });
});