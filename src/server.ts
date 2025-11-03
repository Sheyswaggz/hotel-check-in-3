import { app } from './app.js';
import { environment } from './config/environment.js';

/**
 * Server instance type for graceful shutdown handling
 */
interface ServerInstance {
  close: (callback?: (err?: Error) => void) => void;
  listening: boolean;
}

/**
 * Shutdown signal types
 */
type ShutdownSignal = 'SIGTERM' | 'SIGINT';

/**
 * Server state for tracking lifecycle
 */
interface ServerState {
  isShuttingDown: boolean;
  server: ServerInstance | null;
}

/**
 * Server state management
 */
const serverState: ServerState = {
  isShuttingDown: false,
  server: null,
};

/**
 * Gracefully shuts down the server
 * Handles cleanup and ensures all connections are closed
 */
async function gracefulShutdown(signal: ShutdownSignal): Promise<void> {
  // Prevent multiple shutdown attempts
  if (serverState.isShuttingDown) {
    console.warn(`[${new Date().toISOString()}] Shutdown already in progress, ignoring ${signal}`);
    return;
  }

  serverState.isShuttingDown = true;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] Received ${signal}, starting graceful shutdown...`);

  // If server hasn't been initialized yet, exit immediately
  if (!serverState.server) {
    console.log(`[${new Date().toISOString()}] Server not initialized, exiting immediately`);
    process.exit(0);
    return;
  }

  // Set shutdown timeout to force exit if graceful shutdown takes too long
  const SHUTDOWN_TIMEOUT_MS = 10000;
  const shutdownTimeout = setTimeout(() => {
    console.error(
      `[${new Date().toISOString()}] Graceful shutdown timeout exceeded (${SHUTDOWN_TIMEOUT_MS}ms), forcing exit`
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Close server and stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      if (!serverState.server) {
        resolve();
        return;
      }

      serverState.server.close((err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    console.log(`[${new Date().toISOString()}] Server closed successfully`);

    // Clear the timeout since shutdown completed successfully
    clearTimeout(shutdownTimeout);

    // Exit with success code
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${new Date().toISOString()}] Error during graceful shutdown:`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Clear timeout and exit with error code
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

/**
 * Registers signal handlers for graceful shutdown
 */
function registerShutdownHandlers(): void {
  const signals: ShutdownSignal[] = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, () => {
      void gracefulShutdown(signal);
    });
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error(`[${new Date().toISOString()}] Uncaught exception:`, {
      message: error.message,
      stack: error.stack,
    });
    void gracefulShutdown('SIGTERM');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;

    console.error(`[${new Date().toISOString()}] Unhandled promise rejection:`, {
      reason: errorMessage,
      stack,
    });
    void gracefulShutdown('SIGTERM');
  });
}

/**
 * Starts the Express server
 */
function startServer(): void {
  try {
    const { port, nodeEnv } = environment;

    // Start listening on configured port
    const server = app.listen(port, () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ✓ Server started successfully`, {
        port,
        environment: nodeEnv,
        processId: process.pid,
        nodeVersion: process.version,
        uptime: process.uptime(),
      });

      console.log(`[${timestamp}] Server is ready to accept connections on port ${port}`);
      console.log(`[${timestamp}] Health check available at: http://localhost:${port}/health`);
    });

    // Store server instance for graceful shutdown
    serverState.server = server;

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      const timestamp = new Date().toISOString();

      if (error.code === 'EADDRINUSE') {
        console.error(`[${timestamp}] Port ${port} is already in use`, {
          error: error.message,
          code: error.code,
        });
      } else if (error.code === 'EACCES') {
        console.error(`[${timestamp}] Permission denied to bind to port ${port}`, {
          error: error.message,
          code: error.code,
        });
      } else {
        console.error(`[${timestamp}] Server error:`, {
          message: error.message,
          code: error.code,
          stack: error.stack,
        });
      }

      process.exit(1);
    });

    // Register shutdown handlers after server starts
    registerShutdownHandlers();
  } catch (error) {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;

    console.error(`[${timestamp}] Failed to start server:`, {
      error: errorMessage,
      stack,
    });

    process.exit(1);
  }
}

/**
 * Server initialization
 * Entry point for the application
 */
startServer();