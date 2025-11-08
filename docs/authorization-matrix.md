# Authorization Matrix

## Overview

This document defines the role-based access control (RBAC) system for the JWT authentication implementation. It specifies which roles can access which endpoints and the authentication requirements for each route.

## Roles

The system supports two user roles:

| Role | Description | Privileges |
|------|-------------|------------|
| **ADMIN** | Administrator with full system access | Can access all endpoints including ADMIN-only and GUEST routes |
| **GUEST** | Standard user with limited access | Can access GUEST-designated routes only |

## Role Hierarchy

## Endpoint Authorization Matrix

### Room Management Endpoints

| Endpoint | Method | Authentication Required | Authorized Roles | Description |
|----------|--------|------------------------|------------------|-------------|
| `/api/rooms` | GET | No | Public | List all rooms with filtering and pagination |
| `/api/rooms/:id` | GET | No | Public | Get single room details by ID |
| `/api/rooms` | POST | Yes | ADMIN | Create a new room |
| `/api/rooms/:id` | PUT | Yes | ADMIN | Update existing room |
| `/api/rooms/:id` | DELETE | Yes | ADMIN | Delete a room |

### Reservation Management Endpoints

| Endpoint | Method | Authentication Required | Authorized Roles | Description |
|----------|--------|------------------------|------------------|-------------|
| `/api/reservations` | POST | Yes | GUEST, ADMIN | Create new reservation with availability validation |
| `/api/reservations` | GET | Yes | GUEST (own), ADMIN (all) | List reservations with role-based filtering |
| `/api/reservations/:id` | GET | Yes | GUEST (own), ADMIN (all) | Get reservation details by ID |
| `/api/reservations/:id/confirm` | PUT | Yes | ADMIN | Confirm pending reservation |
| `/api/reservations/:id/check-in` | PUT | Yes | ADMIN | Process guest check-in |
| `/api/reservations/:id/check-out` | PUT | Yes | ADMIN | Process guest check-out |
| `/api/reservations/:id/cancel` | PUT | Yes | GUEST (own), ADMIN (all) | Cancel reservation with ownership validation |

### Admin Dashboard Endpoints

| Endpoint | Method | Authentication Required | Authorized Roles | Description |
|----------|--------|------------------------|------------------|-------------|
| `/api/admin/dashboard` | GET | Yes | ADMIN | Get comprehensive dashboard statistics including rooms, occupancy, reservations, and revenue |
| `/api/admin/reservations/recent` | GET | Yes | ADMIN | Get recent reservations with user and room details |
| `/api/admin/rooms/occupancy` | GET | Yes | ADMIN | Get room occupancy statistics for specified date range |
| `/api/admin/users` | GET | Yes | ADMIN | Get paginated list of users with reservation counts |

**Note:** GUEST users cannot access any admin endpoints. All admin endpoints require ADMIN role authorization.