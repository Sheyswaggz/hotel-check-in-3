import { config } from 'dotenv';

/**
 * Environment variable names used by the application
 */
const ENV_VARS = {
  PORT: 'PORT',
  NODE_ENV: 'NODE_ENV',
  DATABASE_URL: 'DATABASE_URL',
  JWT_SECRET: 'JWT_SECRET',
} as const;

/**
 * Valid Node.js environment values
 */
const NODE_ENVIRONMENTS = ['development', 'production', 'test'] as const;
type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

/**
 * Application configuration interface with strict typing
 */
interface EnvironmentConfig {
  readonly port: number;
  readonly nodeEnv: NodeEnvironment;
  readonly databaseUrl: string;
  readonly jwtSecret: string;
}

/**
 * Configuration error class for environment-related failures
 */
class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Error.captureStackTrace(this, ConfigurationError);
  }
}

/**
 * Validates that a value is a non-empty string
 */
function validateRequiredString(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new ConfigurationError(
      `Environment variable ${name} must be a string, received: ${typeof value}`
    );
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new ConfigurationError(
      `Environment variable ${name} cannot be empty or whitespace-only`
    );
  }

  return trimmedValue;
}

/**
 * Validates and parses port number from environment variable
 */
function validatePort(value: unknown): number {
  const portString = typeof value === 'string' ? value : String(value);
  const port = parseInt(portString, 10);

  if (isNaN(port)) {
    throw new ConfigurationError(
      `PORT must be a valid number, received: ${portString}`
    );
  }

  if (port < 1 || port > 65535) {
    throw new ConfigurationError(
      `PORT must be between 1 and 65535, received: ${port}`
    );
  }

  return port;
}

/**
 * Validates Node environment value
 */
function validateNodeEnv(value: unknown): NodeEnvironment {
  const envString = validateRequiredString(value, ENV_VARS.NODE_ENV);
  const lowerEnv = envString.toLowerCase();

  if (!NODE_ENVIRONMENTS.includes(lowerEnv as NodeEnvironment)) {
    throw new ConfigurationError(
      `NODE_ENV must be one of: ${NODE_ENVIRONMENTS.join(', ')}, received: ${envString}`
    );
  }

  return lowerEnv as NodeEnvironment;
}

/**
 * Validates database URL format
 */
function validateDatabaseUrl(value: unknown): string {
  const url = validateRequiredString(value, ENV_VARS.DATABASE_URL);

  // Basic PostgreSQL URL validation
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new ConfigurationError(
      'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://'
    );
  }

  // Validate URL structure
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname) {
      throw new Error('Missing hostname');
    }
    if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
      throw new Error('Missing database name');
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Invalid URL format';
    throw new ConfigurationError(
      `DATABASE_URL is not a valid connection string: ${errorMessage}`
    );
  }

  return url;
}

/**
 * Validates JWT secret meets minimum security requirements
 */
function validateJwtSecret(value: unknown): string {
  const secret = validateRequiredString(value, ENV_VARS.JWT_SECRET);

  const MIN_SECRET_LENGTH = 32;
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new ConfigurationError(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long for security, received length: ${secret.length}`
    );
  }

  // Warn if using example/default secret
  const dangerousSecrets = [
    'your-super-secret-jwt-key-change-this-in-production-min-32-chars',
    'change-this-in-production',
    'secret',
    'jwt-secret',
  ];

  if (dangerousSecrets.some((dangerous) => secret.includes(dangerous))) {
    console.warn(
      '⚠️  WARNING: JWT_SECRET appears to be using a default or example value. ' +
        'This is a critical security risk in production environments.'
    );
  }

  return secret;
}

/**
 * Loads and validates all environment variables
 */
function loadEnvironmentConfig(): EnvironmentConfig {
  // Load .env file - ignore errors if file doesn't exist (env vars may be set directly)
  try {
    config();
  } catch (error) {
    // .env file is optional - environment variables may be set directly
    console.warn('No .env file found, using environment variables directly');
  }

  const missingVars: string[] = [];
  const errors: string[] = [];

  // Check for required environment variables
  for (const varName of Object.values(ENV_VARS)) {
    if (!(varName in process.env) || process.env[varName] === undefined) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
        'Please ensure all required variables are set in your .env file or environment.'
    );
  }

  // Validate and parse each configuration value
  let port: number;
  let nodeEnv: NodeEnvironment;
  let databaseUrl: string;
  let jwtSecret: string;

  try {
    port = validatePort(process.env[ENV_VARS.PORT]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(message);
    port = 3000; // Fallback for type safety
  }

  try {
    nodeEnv = validateNodeEnv(process.env[ENV_VARS.NODE_ENV]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(message);
    nodeEnv = 'development'; // Fallback for type safety
  }

  try {
    databaseUrl = validateDatabaseUrl(process.env[ENV_VARS.DATABASE_URL]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(message);
    databaseUrl = ''; // Fallback for type safety
  }

  try {
    jwtSecret = validateJwtSecret(process.env[ENV_VARS.JWT_SECRET]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(message);
    jwtSecret = ''; // Fallback for type safety
  }

  // If any validation errors occurred, throw with all error messages
  if (errors.length > 0) {
    throw new ConfigurationError(
      `Environment configuration validation failed:\n${errors.map((err) => `  - ${err}`).join('\n')}`
    );
  }

  const environmentConfig: EnvironmentConfig = {
    port,
    nodeEnv,
    databaseUrl,
    jwtSecret,
  };

  // Log configuration (excluding sensitive data) in non-production environments
  if (nodeEnv !== 'production') {
    console.log('✓ Environment configuration loaded successfully:', {
      port: environmentConfig.port,
      nodeEnv: environmentConfig.nodeEnv,
      databaseUrl: environmentConfig.databaseUrl.replace(
        /\/\/[^@]+@/,
        '//***:***@'
      ),
      jwtSecret: '***' + environmentConfig.jwtSecret.slice(-4),
    });
  }

  return environmentConfig;
}

/**
 * Exported environment configuration
 * Loaded and validated at module initialization
 * Throws ConfigurationError if validation fails
 */
export const environment: EnvironmentConfig = loadEnvironmentConfig();

/**
 * Export types for use in other modules
 */
export type { EnvironmentConfig, NodeEnvironment };
export { ConfigurationError };