import { Router, Request, Response } from 'express';
import { getDatabaseService } from '../services/database.service.js';
import type { DatabaseHealthCheck } from '../services/database.service.js';

/**
 * Basic health check response interface
 */
interface BasicHealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

/**
 * Database health check response interface
 */
interface DatabaseHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    latencyMs: number;
    error?: string;
  };
}

/**
 * Error response interface for health check failures
 */
interface HealthErrorResponse {
  status: 'error';
  timestamp: string;
  error: string;
}

/**
 * Creates and configures health check routes
 * Provides endpoints for basic application health and database connectivity status
 *
 * @returns Configured Express router with health check endpoints
 *
 * @example
 * ```typescript
 * import { app } from './app.js';
 * import { healthRouter } from './routes/health.routes.js';
 *
 * app.use('/health', healthRouter);
 * ```
 */
function createHealthRouter(): Router {
  const router = Router();

  /**
   * GET /health
   * Basic health check endpoint
   * Returns application uptime and current timestamp
   *
   * @returns 200 OK with basic health information
   */
  router.get('/', (_req: Request, res: Response): void => {
    try {
      const response: BasicHealthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };

      console.log('✓ Basic health check successful', {
        uptime: response.uptime,
        timestamp: response.timestamp,
      });

      res.status(200).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('✗ Basic health check failed:', errorMessage);

      const errorResponse: HealthErrorResponse = {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      };

      res.status(500).json(errorResponse);
    }
  });

  /**
   * GET /health/db
   * Database health check endpoint
   * Verifies database connectivity and measures response latency
   *
   * @returns 200 OK if database is healthy
   * @returns 503 Service Unavailable if database is unhealthy
   */
  router.get('/db', async (_req: Request, res: Response): Promise<void> => {
    const timestamp = new Date().toISOString();

    try {
      const dbService = getDatabaseService();
      const healthCheck: DatabaseHealthCheck = await dbService.healthCheck();

      if (healthCheck.isHealthy) {
        const response: DatabaseHealthResponse = {
          status: 'healthy',
          timestamp,
          database: {
            connected: true,
            latencyMs: healthCheck.latencyMs,
          },
        };

        console.log('✓ Database health check successful', {
          latencyMs: healthCheck.latencyMs,
          timestamp,
        });

        res.status(200).json(response);
      } else {
        const response: DatabaseHealthResponse = {
          status: 'unhealthy',
          timestamp,
          database: {
            connected: false,
            latencyMs: healthCheck.latencyMs,
            error: healthCheck.error ?? 'Database connection failed',
          },
        };

        console.warn('⚠ Database health check failed', {
          error: healthCheck.error,
          latencyMs: healthCheck.latencyMs,
          timestamp,
        });

        res.status(503).json(response);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';

      console.error('✗ Database health check error:', {
        error: errorMessage,
        timestamp,
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorResponse: DatabaseHealthResponse = {
        status: 'unhealthy',
        timestamp,
        database: {
          connected: false,
          latencyMs: 0,
          error: errorMessage,
        },
      };

      res.status(503).json(errorResponse);
    }
  });

  return router;
}

/**
 * Configured health check router instance
 * Mount this router at /health in your Express application
 *
 * Available endpoints:
 * - GET /health - Basic application health check
 * - GET /health/db - Database connectivity health check
 */
export const healthRouter: Router = createHealthRouter();

/**
 * Export types for external use
 */
export type { BasicHealthResponse, DatabaseHealthResponse, HealthErrorResponse };