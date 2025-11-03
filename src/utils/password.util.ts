import bcrypt from 'bcrypt';

/**
 * Password validation error with detailed context
 */
export class PasswordValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly violations: string[]
  ) {
    super(message);
    this.name = 'PasswordValidationError';
    Object.setPrototypeOf(this, PasswordValidationError.prototype);
  }
}

/**
 * Password hashing error with operation context
 */
export class PasswordHashError extends Error {
  constructor(
    message: string,
    public readonly operation: 'hash' | 'compare',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PasswordHashError';
    Object.setPrototypeOf(this, PasswordHashError.prototype);
  }
}

/**
 * Password strength validation result
 */
interface PasswordValidationResult {
  isValid: boolean;
  violations: string[];
}

/**
 * Salt rounds for bcrypt hashing (fixed at 10 per requirements)
 */
const SALT_ROUNDS = 10;

/**
 * Password validation rules
 */
const PASSWORD_RULES = {
  MIN_LENGTH: 8,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL_CHAR: true,
} as const;

/**
 * Special characters allowed in passwords
 */
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/**
 * Validates password strength according to security requirements
 * 
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * 
 * @param password - The password to validate
 * @returns Validation result with violations if any
 */
function validatePasswordStrength(password: string): PasswordValidationResult {
  const violations: string[] = [];

  if (!password || typeof password !== 'string') {
    violations.push('Password must be a non-empty string');
    return { isValid: false, violations };
  }

  if (password.length < PASSWORD_RULES.MIN_LENGTH) {
    violations.push(`Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters long`);
  }

  if (PASSWORD_RULES.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    violations.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_RULES.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    violations.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_RULES.REQUIRE_NUMBER && !/\d/.test(password)) {
    violations.push('Password must contain at least one number');
  }

  if (PASSWORD_RULES.REQUIRE_SPECIAL_CHAR && !SPECIAL_CHARS.test(password)) {
    violations.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?)');
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Hashes a password using bcrypt with salt rounds of 10
 * 
 * Validates password strength before hashing to ensure security requirements are met.
 * Uses bcrypt's built-in salt generation for cryptographic security.
 * 
 * @param password - The plain text password to hash
 * @returns Promise resolving to the bcrypt hash string
 * @throws {PasswordValidationError} If password doesn't meet strength requirements
 * @throws {PasswordHashError} If hashing operation fails
 * 
 * @example
 * ```typescript
 * const hash = await hashPassword('SecurePass123!');
 * // Returns: $2b$10$...
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate input type
  if (typeof password !== 'string') {
    throw new PasswordValidationError(
      'Password must be a string',
      'password',
      ['Invalid password type']
    );
  }

  // Validate password strength
  const validation = validatePasswordStrength(password);
  if (!validation.isValid) {
    throw new PasswordValidationError(
      'Password does not meet security requirements',
      'password',
      validation.violations
    );
  }

  try {
    // Generate salt and hash password in one operation
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Verify hash was generated successfully
    if (!hash || typeof hash !== 'string' || hash.length === 0) {
      throw new PasswordHashError(
        'Failed to generate password hash: empty result',
        'hash'
      );
    }

    return hash;
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof PasswordValidationError || error instanceof PasswordHashError) {
      throw error;
    }

    // Wrap bcrypt errors
    throw new PasswordHashError(
      'Failed to hash password',
      'hash',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Compares a plain text password with a bcrypt hash
 * 
 * Uses constant-time comparison to prevent timing attacks.
 * Validates inputs before comparison to fail fast on invalid data.
 * 
 * @param password - The plain text password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns Promise resolving to true if password matches hash, false otherwise
 * @throws {PasswordHashError} If comparison operation fails or inputs are invalid
 * 
 * @example
 * ```typescript
 * const isValid = await comparePassword('SecurePass123!', storedHash);
 * if (isValid) {
 *   // Password is correct
 * }
 * ```
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  // Validate password input
  if (typeof password !== 'string') {
    throw new PasswordHashError(
      'Password must be a string',
      'compare'
    );
  }

  if (!password || password.length === 0) {
    throw new PasswordHashError(
      'Password cannot be empty',
      'compare'
    );
  }

  // Validate hash input
  if (typeof hash !== 'string') {
    throw new PasswordHashError(
      'Hash must be a string',
      'compare'
    );
  }

  if (!hash || hash.length === 0) {
    throw new PasswordHashError(
      'Hash cannot be empty',
      'compare'
    );
  }

  // Validate hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(hash)) {
    throw new PasswordHashError(
      'Invalid bcrypt hash format',
      'compare'
    );
  }

  try {
    // Perform constant-time comparison
    const isMatch = await bcrypt.compare(password, hash);
    
    // Ensure boolean result
    if (typeof isMatch !== 'boolean') {
      throw new PasswordHashError(
        'Password comparison returned invalid result',
        'compare'
      );
    }

    return isMatch;
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof PasswordHashError) {
      throw error;
    }

    // Wrap bcrypt errors
    throw new PasswordHashError(
      'Failed to compare password with hash',
      'compare',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}