// =============================================================================
// ADMIN DASHBOARD TYPES - TYPE DEFINITIONS
// =============================================================================
// Comprehensive type definitions for admin dashboard functionality including
// statistics, occupancy tracking, recent reservations, and user management.
//
// These types support the admin dashboard API endpoints with proper type safety
// and validation for aggregated data and analytics.
// =============================================================================

import type { ReservationStatus, UserRole } from '@prisma/client';

// =============================================================================
// DASHBOARD STATISTICS TYPES
// =============================================================================

/**
 * Dashboard statistics interface for admin overview
 * Provides comprehensive metrics for hotel operations and decision making
 *
 * @property totalRooms - Total number of rooms in the hotel inventory
 * @property availableRooms - Number of rooms currently available for booking
 * @property occupancyRate - Current occupancy rate as percentage (0-100)
 * @property totalReservations - Total number of reservations in the system
 * @property pendingReservations - Number of reservations awaiting confirmation
 * @property confirmedReservations - Number of confirmed reservations
 * @property checkedInGuests - Number of guests currently checked in
 * @property revenue - Total revenue generated (in decimal format)
 */
export interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  occupancyRate: number;
  totalReservations: number;
  pendingReservations: number;
  confirmedReservations: number;
  checkedInGuests: number;
  revenue: number;
}

// =============================================================================
// OCCUPANCY DATA TYPES
// =============================================================================

/**
 * Occupancy data interface for room utilization tracking
 * Used for generating occupancy reports and visualizations
 *
 * @property date - Date for the occupancy data point (ISO 8601 format)
 * @property occupiedRooms - Number of occupied rooms on this date
 * @property totalRooms - Total number of rooms available on this date
 * @property rate - Occupancy rate as percentage (0-100)
 */
export interface OccupancyData {
  date: string;
  occupiedRooms: number;
  totalRooms: number;
  rate: number;
}

// =============================================================================
// RECENT RESERVATION TYPES
// =============================================================================

/**
 * Recent reservation interface for dashboard display
 * Provides essential reservation details for quick overview
 *
 * @property id - Unique reservation identifier (UUID)
 * @property userId - User who made the reservation (UUID)
 * @property roomId - Reserved room identifier (UUID)
 * @property checkInDate - Check-in date (ISO 8601 date string)
 * @property checkOutDate - Check-out date (ISO 8601 date string)
 * @property status - Current reservation status
 * @property createdAt - Timestamp when reservation was created
 * @property user - User details (email only for privacy)
 * @property room - Room details (number, type, price)
 */
export interface RecentReservation {
  id: string;
  userId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  createdAt: Date;
  user: {
    email: string;
  };
  room: {
    roomNumber: string;
    type: string;
    price: number;
  };
}

// =============================================================================
// USER MANAGEMENT TYPES
// =============================================================================

/**
 * Admin user list item interface for user management
 * Excludes sensitive information like passwords
 *
 * @property id - Unique user identifier (UUID)
 * @property email - User email address
 * @property role - User role (ADMIN or GUEST)
 * @property createdAt - Account creation timestamp
 * @property updatedAt - Last update timestamp
 * @property reservationCount - Total number of reservations made by user
 */
export interface AdminUserListItem {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  reservationCount: number;
}

/**
 * Pagination metadata interface for list responses
 * Provides information for client-side pagination controls
 *
 * @property total - Total number of items available
 * @property page - Current page number (1-indexed)
 * @property pageSize - Number of items per page
 * @property totalPages - Total number of pages available
 */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Paginated user list response interface
 * Combines user data with pagination metadata
 *
 * @property users - Array of user list items
 * @property pagination - Pagination metadata
 */
export interface PaginatedUserList {
  users: AdminUserListItem[];
  pagination: PaginationMeta;
}

// =============================================================================
// QUERY PARAMETER TYPES
// =============================================================================

/**
 * User list query parameters interface
 * Supports filtering, sorting, and pagination
 *
 * @property page - Page number (default: 1)
 * @property pageSize - Items per page (default: 20, max: 100)
 * @property role - Filter by user role (optional)
 * @property sortBy - Sort field (default: 'createdAt')
 * @property sortOrder - Sort direction (default: 'desc')
 */
export interface UserListQueryParams {
  page?: number;
  pageSize?: number;
  role?: UserRole;
  sortBy?: 'createdAt' | 'email' | 'reservationCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Occupancy query parameters interface
 * Supports date range filtering for occupancy reports
 *
 * @property startDate - Start date for occupancy data (ISO 8601 date string)
 * @property endDate - End date for occupancy data (ISO 8601 date string)
 */
export interface OccupancyQueryParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Recent reservations query parameters interface
 * Supports limiting the number of results
 *
 * @property limit - Maximum number of reservations to return (default: 10, max: 50)
 */
export interface RecentReservationsQueryParams {
  limit?: number;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Dashboard statistics response interface
 * Wraps dashboard stats with metadata
 *
 * @property stats - Dashboard statistics data
 * @property timestamp - Timestamp when stats were generated
 */
export interface DashboardStatsResponse {
  stats: DashboardStats;
  timestamp: Date;
}

/**
 * Occupancy data response interface
 * Wraps occupancy data array with date range metadata
 *
 * @property data - Array of occupancy data points
 * @property startDate - Start date of the data range
 * @property endDate - End date of the data range
 */
export interface OccupancyDataResponse {
  data: OccupancyData[];
  startDate: string;
  endDate: string;
}

/**
 * Recent reservations response interface
 * Wraps recent reservations array with count metadata
 *
 * @property reservations - Array of recent reservation items
 * @property count - Total number of reservations returned
 */
export interface RecentReservationsResponse {
  reservations: RecentReservation[];
  count: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for DashboardStats
 * Validates that an unknown value conforms to DashboardStats interface
 *
 * @param value - Value to check
 * @returns True if value is a valid DashboardStats object
 */
export function isDashboardStats(value: unknown): value is DashboardStats {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const stats = value as Record<string, unknown>;

  return (
    typeof stats.totalRooms === 'number' &&
    typeof stats.availableRooms === 'number' &&
    typeof stats.occupancyRate === 'number' &&
    typeof stats.totalReservations === 'number' &&
    typeof stats.pendingReservations === 'number' &&
    typeof stats.confirmedReservations === 'number' &&
    typeof stats.checkedInGuests === 'number' &&
    typeof stats.revenue === 'number'
  );
}

/**
 * Type guard for OccupancyData
 * Validates that an unknown value conforms to OccupancyData interface
 *
 * @param value - Value to check
 * @returns True if value is a valid OccupancyData object
 */
export function isOccupancyData(value: unknown): value is OccupancyData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.date === 'string' &&
    typeof data.occupiedRooms === 'number' &&
    typeof data.totalRooms === 'number' &&
    typeof data.rate === 'number'
  );
}

/**
 * Type guard for UserListQueryParams
 * Validates that an unknown value conforms to UserListQueryParams interface
 *
 * @param value - Value to check
 * @returns True if value is a valid UserListQueryParams object
 */
export function isUserListQueryParams(value: unknown): value is UserListQueryParams {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const params = value as Record<string, unknown>;

  return (
    (params.page === undefined || typeof params.page === 'number') &&
    (params.pageSize === undefined || typeof params.pageSize === 'number') &&
    (params.role === undefined ||
      params.role === 'ADMIN' ||
      params.role === 'GUEST') &&
    (params.sortBy === undefined ||
      params.sortBy === 'createdAt' ||
      params.sortBy === 'email' ||
      params.sortBy === 'reservationCount') &&
    (params.sortOrder === undefined ||
      params.sortOrder === 'asc' ||
      params.sortOrder === 'desc')
  );
}