import { PrismaClient } from '@prisma/client';
import { environment } from './environment.js';

/**
 * Database connection error class for database-specific failures
 */
class DatabaseConnectionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseConnectionError';
    Error.captureStackTrace(this, DatabaseConnectionError);
  }
}

/**
 * Database health check result interface
 */
interface DatabaseHealthCheck {
  readonly isHealthy: boolean;
  readonly latencyMs: number;
  readonly error?: string;
  readonly timestamp: Date;
}

/**
 * Prisma client configuration options
 */
interface PrismaClientConfig {
  readonly datasources: {
    readonly db: {
      readonly url: string;
    };
  };
  readonly log:
    | Array<{
        readonly emit: 'stdout' | 'event';
        readonly level: 'query' | 'info' | 'warn' | 'error';
      }>
    | undefined;
  readonly errorFormat: 'pretty' | 'colorless' | 'minimal';
}

/**
 * Creates and configures a new PrismaClient instance with appropriate settings
 * based on the current environment
 */
function createPrismaClient(): PrismaClient {
  const isDevelopment = environment.nodeEnv === 'development';
  const isProduction = environment.nodeEnv === 'production';

  const config: PrismaClientConfig = {
    datasources: {
      db: {
        url: environment.databaseUrl,
      },
    },
    log: isDevelopment
      ? [
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
    errorFormat: isProduction ? 'minimal' : 'pretty',
  };

  try {
    const client = new PrismaClient(config);

    // Log successful client creation in development
    if (isDevelopment) {
      console.log('✓ Prisma client created successfully');
      console.log('  Database URL:', environment.databaseUrl.replace(/\/\/[^@]+@/, '//***:***@'));
      console.log('  Query logging:', isDevelopment ? 'enabled' : 'disabled');
    }

    return client;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during client creation';
    throw new DatabaseConnectionError(
      `Failed to create Prisma client: ${errorMessage}`,
      error
    );
  }
}

/**
 * Global Prisma client instance
 * Implements singleton pattern to prevent multiple instances
 */
let prismaInstance: PrismaClient | undefined;

/**
 * Gets or creates the singleton Prisma client instance
 * Ensures only one connection pool is maintained throughout the application lifecycle
 */
function getPrismaClient(): PrismaClient {
  if (prismaInstance === undefined) {
    prismaInstance = createPrismaClient();
  }
  return prismaInstance;
}

/**
 * Singleton Prisma client instance for database operations
 * Configured with connection pooling and environment-specific logging
 *
 * Connection pool configuration is managed via DATABASE_URL query parameters:
 * - connection_limit: Maximum number of connections (default: 10)
 * - pool_timeout: Connection acquisition timeout in seconds (default: 30)
 *
 * Example DATABASE_URL with pooling:
 * postgresql://user:password@host:port/database?connection_limit=10&pool_timeout=30
 */
export const prisma: PrismaClient = getPrismaClient();

/**
 * Performs a database health check by executing a simple query
 * Measures connection latency and verifies database accessibility
 *
 * @returns Promise resolving to health check result with status and metrics
 *
 * @example
 * ```typescript
 * const health = await checkDatabaseHealth();
 * if (health.isHealthy) {
 *   console.log(`Database is healthy (latency: ${health.latencyMs}ms)`);
 * } else {
 *   console.error(`Database is unhealthy: ${health.error}`);
 * }
 * ```
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
  const startTime = Date.now();
  const timestamp = new Date();

  try {
    // Execute simple query to verify database connectivity
    // Using $queryRaw for direct database access without model dependencies
    await prisma.$queryRaw`SELECT 1 as health_check`;

    const latencyMs = Date.now() - startTime;

    if (environment.nodeEnv === 'development') {
      console.log(`✓ Database health check passed (latency: ${latencyMs}ms)`);
    }

    return {
      isHealthy: true,
      latencyMs,
      timestamp,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';

    console.error('✗ Database health check failed:', {
      error: errorMessage,
      latencyMs,
      timestamp: timestamp.toISOString(),
    });

    return {
      isHealthy: false,
      latencyMs,
      error: errorMessage,
      timestamp,
    };
  }
}

/**
 * Establishes database connection and verifies connectivity
 * Should be called during application startup to fail fast on connection issues
 *
 * @throws {DatabaseConnectionError} If connection cannot be established
 *
 * @example
 * ```typescript
 * try {
 *   await connectDatabase();
 *   console.log('Database connected successfully');
 * } catch (error) {
 *   console.error('Failed to connect to database:', error);
 *   process.exit(1);
 * }
 * ```
 */
export async function connectDatabase(): Promise<void> {
  try {
    console.log('Connecting to database...');

    // Attempt to connect to the database
    await prisma.$connect();

    // Verify connection with health check
    const healthCheck = await checkDatabaseHealth();

    if (!healthCheck.isHealthy) {
      throw new DatabaseConnectionError(
        `Database health check failed: ${healthCheck.error ?? 'Unknown error'}`
      );
    }

    console.log('✓ Database connection established successfully');
    console.log(`  Connection latency: ${healthCheck.latencyMs}ms`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';

    // Log detailed error information
    console.error('✗ Failed to connect to database:', {
      error: errorMessage,
      databaseUrl: environment.databaseUrl.replace(/\/\/[^@]+@/, '//***:***@'),
      timestamp: new Date().toISOString(),
    });

    // Attempt to disconnect to clean up any partial connections
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Failed to disconnect after connection error:', disconnectError);
    }

    throw new DatabaseConnectionError(`Database connection failed: ${errorMessage}`, error);
  }
}

/**
 * Gracefully disconnects from the database
 * Should be called during application shutdown to clean up connections
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await disconnectDatabase();
 *   process.exit(0);
 * });
 * ```
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    console.log('Disconnecting from database...');
    await prisma.$disconnect();
    console.log('✓ Database disconnected successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown disconnection error';
    console.error('✗ Error during database disconnection:', errorMessage);
    throw new DatabaseConnectionError(`Database disconnection failed: ${errorMessage}`, error);
  }
}

/**
 * Executes a database operation with automatic retry logic
 * Useful for handling transient connection failures
 *
 * @param operation - Async function to execute
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelayMs - Delay between retries in milliseconds (default: 1000)
 * @returns Promise resolving to operation result
 *
 * @throws {DatabaseConnectionError} If all retry attempts fail
 *
 * @example
 * ```typescript
 * const users = await withRetry(
 *   () => prisma.user.findMany(),
 *   3,
 *   1000
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, errorMessage);

      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : 'Unknown error after all retries';
  throw new DatabaseConnectionError(
    `Database operation failed after ${maxRetries} attempts: ${errorMessage}`,
    lastError
  );
}

/**
 * Export types for use in other modules
 */
export type { DatabaseHealthCheck };
export { DatabaseConnectionError };