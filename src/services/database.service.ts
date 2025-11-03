import { prisma, checkDatabaseHealth, DatabaseConnectionError } from '../config/database.js';
import type { DatabaseHealthCheck } from '../config/database.js';

/**
 * Database service error class for service-level failures
 */
class DatabaseServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseServiceError';
    Error.captureStackTrace(this, DatabaseServiceError);
  }
}

/**
 * Connection state enumeration for tracking database connection status
 */
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error',
}

/**
 * Database service connection status interface
 */
interface ConnectionStatus {
  readonly state: ConnectionState;
  readonly connectedAt?: Date;
  readonly lastError?: string;
  readonly reconnectAttempts: number;
}

/**
 * Database service configuration options
 */
interface DatabaseServiceConfig {
  readonly maxReconnectAttempts: number;
  readonly reconnectDelayMs: number;
  readonly healthCheckIntervalMs: number;
  readonly enableAutoReconnect: boolean;
}

/**
 * Default configuration for database service
 */
const DEFAULT_CONFIG: DatabaseServiceConfig = {
  maxReconnectAttempts: 5,
  reconnectDelayMs: 2000,
  healthCheckIntervalMs: 30000,
  enableAutoReconnect: true,
};

/**
 * DatabaseService class provides centralized database connection management,
 * health monitoring, and graceful shutdown capabilities.
 *
 * Implements singleton pattern to ensure single service instance across application.
 * Provides automatic reconnection logic and comprehensive error handling.
 *
 * @example
 * ```typescript
 * const dbService = DatabaseService.getInstance();
 * await dbService.connect();
 *
 * // Check health
 * const health = await dbService.healthCheck();
 * console.log(`Database healthy: ${health.isHealthy}`);
 *
 * // Graceful shutdown
 * await dbService.disconnect();
 * ```
 */
export class DatabaseService {
  private static instance: DatabaseService | undefined;
  private connectionStatus: ConnectionStatus;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private readonly config: DatabaseServiceConfig;
  private isShuttingDown: boolean;

  /**
   * Private constructor to enforce singleton pattern
   * @param config - Optional configuration overrides
   */
  private constructor(config: Partial<DatabaseServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connectionStatus = {
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
    };
    this.isShuttingDown = false;

    this.logServiceInitialization();
  }

  /**
   * Gets or creates the singleton DatabaseService instance
   * @param config - Optional configuration for first-time initialization
   * @returns Singleton DatabaseService instance
   */
  public static getInstance(config?: Partial<DatabaseServiceConfig>): DatabaseService {
    if (DatabaseService.instance === undefined) {
      DatabaseService.instance = new DatabaseService(config);
    }
    return DatabaseService.instance;
  }

  /**
   * Resets the singleton instance (primarily for testing)
   * @internal
   */
  public static resetInstance(): void {
    DatabaseService.instance = undefined;
  }

  /**
   * Establishes database connection with retry logic and health monitoring
   * Implements exponential backoff for reconnection attempts
   *
   * @throws {DatabaseServiceError} If connection fails after all retry attempts
   *
   * @example
   * ```typescript
   * try {
   *   await dbService.connect();
   *   console.log('Database connected successfully');
   * } catch (error) {
   *   console.error('Failed to connect:', error);
   *   process.exit(1);
   * }
   * ```
   */
  public async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new DatabaseServiceError('Cannot connect during shutdown');
    }

    if (this.connectionStatus.state === ConnectionState.CONNECTED) {
      console.warn('⚠ Database already connected, skipping connection attempt');
      return;
    }

    if (this.connectionStatus.state === ConnectionState.CONNECTING) {
      throw new DatabaseServiceError('Connection attempt already in progress');
    }

    this.updateConnectionState(ConnectionState.CONNECTING);

    try {
      await this.attemptConnection();
      this.updateConnectionState(ConnectionState.CONNECTED, new Date());
      this.startHealthCheckMonitoring();
      this.logSuccessfulConnection();
    } catch (error) {
      await this.handleConnectionFailure(error);
    }
  }

  /**
   * Attempts to establish database connection with Prisma client
   * @private
   */
  private async attemptConnection(): Promise<void> {
    try {
      console.log('🔌 Attempting database connection...');
      await prisma.$connect();

      // Verify connection with health check
      const health = await checkDatabaseHealth();
      if (!health.isHealthy) {
        throw new DatabaseConnectionError(
          `Connection established but health check failed: ${health.error ?? 'Unknown error'}`
        );
      }

      console.log(`✓ Database connection verified (latency: ${health.latencyMs}ms)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      throw new DatabaseServiceError(`Failed to establish connection: ${errorMessage}`, error);
    }
  }

  /**
   * Handles connection failure with retry logic
   * @private
   */
  private async handleConnectionFailure(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const currentAttempt = this.connectionStatus.reconnectAttempts + 1;

    this.updateConnectionState(ConnectionState.ERROR, undefined, errorMessage, currentAttempt);

    console.error('✗ Database connection failed:', {
      error: errorMessage,
      attempt: currentAttempt,
      maxAttempts: this.config.maxReconnectAttempts,
      timestamp: new Date().toISOString(),
    });

    if (
      this.config.enableAutoReconnect &&
      currentAttempt < this.config.maxReconnectAttempts &&
      !this.isShuttingDown
    ) {
      await this.scheduleReconnection(currentAttempt);
    } else {
      this.updateConnectionState(ConnectionState.DISCONNECTED);
      throw new DatabaseServiceError(
        `Failed to connect after ${currentAttempt} attempts: ${errorMessage}`,
        error
      );
    }
  }

  /**
   * Schedules reconnection attempt with exponential backoff
   * @private
   */
  private async scheduleReconnection(attempt: number): Promise<void> {
    const delay = this.config.reconnectDelayMs * Math.pow(2, attempt - 1);
    console.log(`⏳ Scheduling reconnection attempt ${attempt + 1} in ${delay}ms...`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (!this.isShuttingDown) {
      await this.connect();
    }
  }

  /**
   * Gracefully disconnects from database and cleans up resources
   * Stops health check monitoring and closes Prisma connection
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await dbService.disconnect();
   *   process.exit(0);
   * });
   * ```
   */
  public async disconnect(): Promise<void> {
    if (this.connectionStatus.state === ConnectionState.DISCONNECTED) {
      console.warn('⚠ Database already disconnected');
      return;
    }

    if (this.connectionStatus.state === ConnectionState.DISCONNECTING) {
      throw new DatabaseServiceError('Disconnection already in progress');
    }

    this.isShuttingDown = true;
    this.updateConnectionState(ConnectionState.DISCONNECTING);
    this.stopHealthCheckMonitoring();

    try {
      console.log('🔌 Disconnecting from database...');
      await prisma.$disconnect();
      this.updateConnectionState(ConnectionState.DISCONNECTED);
      console.log('✓ Database disconnected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown disconnection error';
      console.error('✗ Error during database disconnection:', errorMessage);
      this.updateConnectionState(ConnectionState.ERROR, undefined, errorMessage);
      throw new DatabaseServiceError(`Disconnection failed: ${errorMessage}`, error);
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Performs database health check and returns detailed status
   * Verifies database connectivity and measures response latency
   *
   * @returns Promise resolving to health check result with metrics
   *
   * @example
   * ```typescript
   * const health = await dbService.healthCheck();
   * if (!health.isHealthy) {
   *   console.error(`Database unhealthy: ${health.error}`);
   *   // Trigger alerts or failover
   * }
   * ```
   */
  public async healthCheck(): Promise<DatabaseHealthCheck> {
    try {
      const health = await checkDatabaseHealth();

      if (!health.isHealthy && this.connectionStatus.state === ConnectionState.CONNECTED) {
        console.warn('⚠ Health check failed for connected database:', {
          error: health.error,
          latencyMs: health.latencyMs,
          timestamp: health.timestamp.toISOString(),
        });

        // Trigger reconnection if auto-reconnect is enabled
        if (this.config.enableAutoReconnect && !this.isShuttingDown) {
          this.updateConnectionState(ConnectionState.ERROR, undefined, health.error);
          void this.connect().catch((error) => {
            console.error('Failed to reconnect after health check failure:', error);
          });
        }
      }

      return health;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Health check error';
      console.error('✗ Health check execution failed:', errorMessage);

      return {
        isHealthy: false,
        latencyMs: 0,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Gets current database connection status
   * @returns Current connection status with state and metadata
   */
  public getConnectionStatus(): Readonly<ConnectionStatus> {
    return { ...this.connectionStatus };
  }

  /**
   * Checks if database is currently connected
   * @returns True if connected, false otherwise
   */
  public isConnected(): boolean {
    return this.connectionStatus.state === ConnectionState.CONNECTED;
  }

  /**
   * Gets the Prisma client instance for direct database operations
   * @returns Prisma client instance
   * @throws {DatabaseServiceError} If database is not connected
   */
  public getClient(): typeof prisma {
    if (!this.isConnected()) {
      throw new DatabaseServiceError(
        'Cannot get client: Database is not connected. Call connect() first.'
      );
    }
    return prisma;
  }

  /**
   * Starts periodic health check monitoring
   * @private
   */
  private startHealthCheckMonitoring(): void {
    if (this.healthCheckInterval !== undefined) {
      return;
    }

    console.log(
      `🏥 Starting health check monitoring (interval: ${this.config.healthCheckIntervalMs}ms)`
    );

    this.healthCheckInterval = setInterval(() => {
      void this.healthCheck().catch((error) => {
        console.error('Health check monitoring error:', error);
      });
    }, this.config.healthCheckIntervalMs);

    // Prevent interval from keeping process alive
    this.healthCheckInterval.unref();
  }

  /**
   * Stops health check monitoring
   * @private
   */
  private stopHealthCheckMonitoring(): void {
    if (this.healthCheckInterval !== undefined) {
      console.log('🏥 Stopping health check monitoring');
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Updates internal connection state
   * @private
   */
  private updateConnectionState(
    state: ConnectionState,
    connectedAt?: Date,
    lastError?: string,
    reconnectAttempts?: number
  ): void {
    this.connectionStatus = {
      state,
      connectedAt: connectedAt ?? this.connectionStatus.connectedAt,
      lastError,
      reconnectAttempts: reconnectAttempts ?? this.connectionStatus.reconnectAttempts,
    };
  }

  /**
   * Logs service initialization details
   * @private
   */
  private logServiceInitialization(): void {
    console.log('🚀 DatabaseService initialized with configuration:', {
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      reconnectDelayMs: this.config.reconnectDelayMs,
      healthCheckIntervalMs: this.config.healthCheckIntervalMs,
      enableAutoReconnect: this.config.enableAutoReconnect,
    });
  }

  /**
   * Logs successful connection details
   * @private
   */
  private logSuccessfulConnection(): void {
    console.log('✓ Database service connected successfully:', {
      state: this.connectionStatus.state,
      connectedAt: this.connectionStatus.connectedAt?.toISOString(),
      reconnectAttempts: this.connectionStatus.reconnectAttempts,
    });

    // Reset reconnect attempts on successful connection
    this.connectionStatus = {
      ...this.connectionStatus,
      reconnectAttempts: 0,
      lastError: undefined,
    };
  }
}

/**
 * Export singleton instance getter for convenience
 */
export const getDatabaseService = (): DatabaseService => DatabaseService.getInstance();

/**
 * Export types for external use
 */
export type { ConnectionStatus, DatabaseServiceConfig, DatabaseHealthCheck };
export { ConnectionState, DatabaseServiceError };