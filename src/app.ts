import express, { Express, Request, Response, NextFunction } from 'express';

/**
 * Health check response interface
 */
interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

/**
 * Error response interface for consistent error formatting
 */
interface ErrorResponse {
  error: {
    message: string;
    status: number;
    timestamp: string;
    path?: string;
  };
}

/**
 * Custom error class for application errors
 */
class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'ApplicationError';
    Error.captureStackTrace(this, ApplicationError);
  }
}

/**
 * Creates and configures the Express application instance
 * @returns Configured Express application
 */
function createApp(): Express {
  const app: Express = express();

  // Trust proxy - required for proper IP detection behind reverse proxies
  app.set('trust proxy', 1);

  // Disable x-powered-by header for security
  app.disable('x-powered-by');

  // JSON body parser with size limit
  app.use(
    express.json({
      limit: '10mb',
      strict: true,
    })
  );

  // URL-encoded body parser
  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    })
  );

  // Request logging middleware
  app.use((req: Request, _res: Response, next: NextFunction): void => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response): void => {
    const response: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    res.status(200).json(response);
  });

  // 404 handler for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction): void => {
    const error = new ApplicationError(
      `Route not found: ${req.method} ${req.path}`,
      404
    );
    next(error);
  });

  // Global error handling middleware
  app.use(
    (
      err: Error | ApplicationError,
      req: Request,
      res: Response,
      _next: NextFunction
    ): void => {
      // Determine status code
      const statusCode =
        err instanceof ApplicationError ? err.statusCode : 500;

      // Log error with context
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] Error:`, {
        message: err.message,
        statusCode,
        path: req.path,
        method: req.method,
        stack: err.stack,
      });

      // Prepare error response
      const errorResponse: ErrorResponse = {
        error: {
          message:
            statusCode === 500
              ? 'Internal server error'
              : err.message,
          status: statusCode,
          timestamp,
          path: req.path,
        },
      };

      // Send error response
      res.status(statusCode).json(errorResponse);
    }
  );

  return app;
}

/**
 * Configured Express application instance
 * Ready for server initialization
 */
export const app: Express = createApp();

/**
 * Export error class for use in other modules
 */
export { ApplicationError };