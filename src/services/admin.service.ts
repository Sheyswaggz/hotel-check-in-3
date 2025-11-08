// =============================================================================
// ADMIN SERVICE - DASHBOARD AND ANALYTICS
// =============================================================================
// Production-grade service for admin dashboard functionality including
// statistics aggregation, occupancy tracking, recent reservations, and
// user management with optimized database queries and caching support.
//
// Performance targets:
// - Dashboard stats query: < 200ms
// - Occupancy calculations: < 300ms
// - User listing: < 150ms with pagination
// - Recent reservations: < 100ms
// =============================================================================

import { prisma } from '../config/database.js';
import type {
  DashboardStats,
  OccupancyData,
  RecentReservation,
  AdminUserListItem,
  PaginatedUserList,
  UserListQueryParams,
  OccupancyQueryParams,
} from '../types/admin.types.js';
import { ReservationStatus, UserRole } from '@prisma/client';
import { startOfDay, endOfDay, eachDayOfInterval, parseISO, format } from 'date-fns';

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Admin service error class for admin-specific failures
 */
class AdminServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AdminServiceError';
    Error.captureStackTrace(this, AdminServiceError);
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default pagination settings
 */
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;
const DEFAULT_PAGE = 1;

/**
 * Default query limits
 */
const DEFAULT_RECENT_RESERVATIONS_LIMIT = 10;
const MAX_RECENT_RESERVATIONS_LIMIT = 50;

/**
 * Default date range for occupancy (30 days)
 */
const DEFAULT_OCCUPANCY_DAYS = 30;

// =============================================================================
// ADMIN SERVICE CLASS
// =============================================================================

/**
 * Admin service for dashboard and analytics operations
 * Provides aggregated data and statistics for administrative oversight
 */
export class AdminService {
  /**
   * Get comprehensive dashboard statistics
   * Aggregates key metrics for hotel operations overview
   *
   * @returns Promise resolving to dashboard statistics
   * @throws {AdminServiceError} If statistics calculation fails
   *
   * @example
   * ```typescript
   * const stats = await adminService.getDashboardStats();
   * console.log(`Occupancy rate: ${stats.occupancyRate}%`);
   * ```
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const startTime = Date.now();

    try {
      console.log('Calculating dashboard statistics...');

      // Execute all queries in parallel for optimal performance
      const [
        totalRooms,
        availableRooms,
        totalReservations,
        reservationsByStatus,
        checkedInCount,
        revenueData,
      ] = await Promise.all([
        // Total rooms count
        prisma.room.count(),

        // Available rooms count
        prisma.room.count({
          where: { status: 'AVAILABLE' },
        }),

        // Total reservations count
        prisma.reservation.count(),

        // Reservations grouped by status
        prisma.reservation.groupBy({
          by: ['status'],
          _count: { status: true },
        }),

        // Currently checked-in guests
        prisma.reservation.count({
          where: { status: ReservationStatus.CHECKED_IN },
        }),

        // Revenue calculation from completed reservations
        prisma.reservation.findMany({
          where: {
            status: {
              in: [ReservationStatus.CHECKED_OUT, ReservationStatus.CHECKED_IN],
            },
          },
          select: {
            checkInDate: true,
            checkOutDate: true,
            room: {
              select: { price: true },
            },
          },
        }),
      ]);

      // Calculate occupancy rate
      const occupancyRate = totalRooms > 0 ? ((totalRooms - availableRooms) / totalRooms) * 100 : 0;

      // Extract status counts from grouped results
      const pendingReservations =
        reservationsByStatus.find((r) => r.status === ReservationStatus.PENDING)?._count.status ?? 0;
      const confirmedReservations =
        reservationsByStatus.find((r) => r.status === ReservationStatus.CONFIRMED)?._count
          .status ?? 0;

      // Calculate total revenue
      const revenue = revenueData.reduce((total, reservation) => {
        const checkIn = new Date(reservation.checkInDate);
        const checkOut = new Date(reservation.checkOutDate);
        const nights = Math.ceil(
          (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
        );
        const price = Number(reservation.room.price);
        return total + nights * price;
      }, 0);

      const stats: DashboardStats = {
        totalRooms,
        availableRooms,
        occupancyRate: Math.round(occupancyRate * 100) / 100, // Round to 2 decimal places
        totalReservations,
        pendingReservations,
        confirmedReservations,
        checkedInGuests: checkedInCount,
        revenue: Math.round(revenue * 100) / 100, // Round to 2 decimal places
      };

      const duration = Date.now() - startTime;
      console.log(`✓ Dashboard statistics calculated successfully (${duration}ms)`, {
        occupancyRate: stats.occupancyRate,
        totalReservations: stats.totalReservations,
        revenue: stats.revenue,
      });

      return stats;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('✗ Failed to calculate dashboard statistics:', {
        error: errorMessage,
        duration,
        timestamp: new Date().toISOString(),
      });

      throw new AdminServiceError(
        `Failed to calculate dashboard statistics: ${errorMessage}`,
        'STATS_CALCULATION_FAILED',
        error
      );
    }
  }

  /**
   * Get recent reservations with user and room details
   * Returns most recent reservations sorted by creation date
   *
   * @param limit - Maximum number of reservations to return (default: 10, max: 50)
   * @returns Promise resolving to array of recent reservations
   * @throws {AdminServiceError} If query fails
   *
   * @example
   * ```typescript
   * const recent = await adminService.getRecentReservations(20);
   * recent.forEach(r => console.log(`${r.user.email} - Room ${r.room.roomNumber}`));
   * ```
   */
  async getRecentReservations(limit: number = DEFAULT_RECENT_RESERVATIONS_LIMIT): Promise<
    RecentReservation[]
  > {
    const startTime = Date.now();

    try {
      // Validate and sanitize limit
      const sanitizedLimit = Math.min(
        Math.max(limit, 1),
        MAX_RECENT_RESERVATIONS_LIMIT
      );

      console.log('Fetching recent reservations...', { limit: sanitizedLimit });

      const reservations = await prisma.reservation.findMany({
        take: sanitizedLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          roomId: true,
          checkInDate: true,
          checkOutDate: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              email: true,
            },
          },
          room: {
            select: {
              roomNumber: true,
              type: true,
              price: true,
            },
          },
        },
      });

      // Transform to match RecentReservation interface
      const recentReservations: RecentReservation[] = reservations.map((r) => ({
        id: r.id,
        userId: r.userId,
        roomId: r.roomId,
        checkInDate: r.checkInDate.toISOString().split('T')[0] as string,
        checkOutDate: r.checkOutDate.toISOString().split('T')[0] as string,
        status: r.status,
        createdAt: r.createdAt,
        user: {
          email: r.user.email,
        },
        room: {
          roomNumber: r.room.roomNumber,
          type: r.room.type,
          price: Number(r.room.price),
        },
      }));

      const duration = Date.now() - startTime;
      console.log(`✓ Recent reservations fetched successfully (${duration}ms)`, {
        count: recentReservations.length,
        limit: sanitizedLimit,
      });

      return recentReservations;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('✗ Failed to fetch recent reservations:', {
        error: errorMessage,
        duration,
        timestamp: new Date().toISOString(),
      });

      throw new AdminServiceError(
        `Failed to fetch recent reservations: ${errorMessage}`,
        'RECENT_RESERVATIONS_FETCH_FAILED',
        error
      );
    }
  }

  /**
   * Get room occupancy data for date range
   * Calculates daily occupancy rates for visualization and reporting
   *
   * @param params - Query parameters with optional start and end dates
   * @returns Promise resolving to array of occupancy data points
   * @throws {AdminServiceError} If calculation fails
   *
   * @example
   * ```typescript
   * const occupancy = await adminService.getRoomOccupancy({
   *   startDate: '2024-01-01',
   *   endDate: '2024-01-31'
   * });
   * ```
   */
  async getRoomOccupancy(params: OccupancyQueryParams = {}): Promise<OccupancyData[]> {
    const startTime = Date.now();

    try {
      // Parse and validate date range
      const today = new Date();
      const startDate = params.startDate
        ? startOfDay(parseISO(params.startDate))
        : startOfDay(new Date(today.getTime() - DEFAULT_OCCUPANCY_DAYS * 24 * 60 * 60 * 1000));
      const endDate = params.endDate ? endOfDay(parseISO(params.endDate)) : endOfDay(today);

      // Validate date range
      if (startDate > endDate) {
        throw new AdminServiceError(
          'Start date must be before or equal to end date',
          'INVALID_DATE_RANGE'
        );
      }

      console.log('Calculating room occupancy...', {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });

      // Get total rooms count
      const totalRooms = await prisma.room.count();

      if (totalRooms === 0) {
        console.warn('No rooms found in system');
        return [];
      }

      // Get all reservations overlapping with date range
      const reservations = await prisma.reservation.findMany({
        where: {
          status: {
            in: [
              ReservationStatus.CONFIRMED,
              ReservationStatus.CHECKED_IN,
              ReservationStatus.CHECKED_OUT,
            ],
          },
          OR: [
            {
              checkInDate: { lte: endDate },
              checkOutDate: { gte: startDate },
            },
          ],
        },
        select: {
          checkInDate: true,
          checkOutDate: true,
        },
      });

      // Generate array of dates in range
      const dates = eachDayOfInterval({ start: startDate, end: endDate });

      // Calculate occupancy for each date
      const occupancyData: OccupancyData[] = dates.map((date) => {
        const dateStart = startOfDay(date);
        const dateEnd = endOfDay(date);

        // Count rooms occupied on this date
        const occupiedRooms = reservations.filter((r) => {
          const checkIn = startOfDay(new Date(r.checkInDate));
          const checkOut = startOfDay(new Date(r.checkOutDate));
          return checkIn <= dateStart && checkOut > dateStart;
        }).length;

        const rate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

        return {
          date: format(date, 'yyyy-MM-dd'),
          occupiedRooms,
          totalRooms,
          rate: Math.round(rate * 100) / 100, // Round to 2 decimal places
        };
      });

      const duration = Date.now() - startTime;
      console.log(`✓ Room occupancy calculated successfully (${duration}ms)`, {
        dateCount: occupancyData.length,
        averageRate:
          Math.round(
            (occupancyData.reduce((sum, d) => sum + d.rate, 0) / occupancyData.length) * 100
          ) / 100,
      });

      return occupancyData;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('✗ Failed to calculate room occupancy:', {
        error: errorMessage,
        duration,
        timestamp: new Date().toISOString(),
      });

      if (error instanceof AdminServiceError) {
        throw error;
      }

      throw new AdminServiceError(
        `Failed to calculate room occupancy: ${errorMessage}`,
        'OCCUPANCY_CALCULATION_FAILED',
        error
      );
    }
  }

  /**
   * Get paginated user list with reservation counts
   * Supports filtering, sorting, and pagination for user management
   *
   * @param params - Query parameters for filtering, sorting, and pagination
   * @returns Promise resolving to paginated user list with metadata
   * @throws {AdminServiceError} If query fails
   *
   * @example
   * ```typescript
   * const users = await adminService.getUsers({
   *   page: 1,
   *   pageSize: 20,
   *   role: 'GUEST',
   *   sortBy: 'createdAt',
   *   sortOrder: 'desc'
   * });
   * ```
   */
  async getUsers(params: UserListQueryParams = {}): Promise<PaginatedUserList> {
    const startTime = Date.now();

    try {
      // Validate and sanitize pagination parameters
      const page = Math.max(params.page ?? DEFAULT_PAGE, 1);
      const pageSize = Math.min(
        Math.max(params.pageSize ?? DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE),
        MAX_PAGE_SIZE
      );
      const skip = (page - 1) * pageSize;

      // Validate and sanitize sort parameters
      const sortBy = params.sortBy ?? 'createdAt';
      const sortOrder = params.sortOrder ?? 'desc';

      console.log('Fetching user list...', {
        page,
        pageSize,
        role: params.role,
        sortBy,
        sortOrder,
      });

      // Build where clause
      const where = params.role ? { role: params.role as UserRole } : {};

      // Execute count and data queries in parallel
      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy:
            sortBy === 'reservationCount'
              ? undefined // Handle reservation count sorting separately
              : { [sortBy]: sortOrder },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { reservations: true },
            },
          },
        }),
      ]);

      // Transform to AdminUserListItem format
      let userList: AdminUserListItem[] = users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        reservationCount: u._count.reservations,
      }));

      // Sort by reservation count if requested (client-side sorting for aggregated field)
      if (sortBy === 'reservationCount') {
        userList = userList.sort((a, b) => {
          const diff = a.reservationCount - b.reservationCount;
          return sortOrder === 'asc' ? diff : -diff;
        });
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / pageSize);

      const result: PaginatedUserList = {
        users: userList,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
        },
      };

      const duration = Date.now() - startTime;
      console.log(`✓ User list fetched successfully (${duration}ms)`, {
        count: userList.length,
        total,
        page,
        totalPages,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('✗ Failed to fetch user list:', {
        error: errorMessage,
        duration,
        timestamp: new Date().toISOString(),
      });

      throw new AdminServiceError(
        `Failed to fetch user list: ${errorMessage}`,
        'USER_LIST_FETCH_FAILED',
        error
      );
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Singleton instance of AdminService
 * Use this instance throughout the application for consistency
 */
export const adminService = new AdminService();