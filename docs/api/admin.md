# Admin Dashboard API Documentation

## Overview

The Admin Dashboard API provides comprehensive administrative functionality for hotel management, including real-time statistics, occupancy tracking, reservation monitoring, and user management. All endpoints require ADMIN role authorization.

**Base URL**: `/api/admin`

**Authentication**: Bearer token (JWT) with ADMIN role required for all endpoints

**Performance Targets**:
- Dashboard statistics: < 500ms
- Recent reservations: < 200ms
- Room occupancy: < 500ms
- User listing: < 300ms

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Dashboard Statistics](#dashboard-statistics)
  - [Recent Reservations](#recent-reservations)
  - [Room Occupancy](#room-occupancy)
  - [User Management](#user-management)
- [Data Models](#data-models)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)
- [Performance Considerations](#performance-considerations)

---

## Authentication

All admin endpoints require authentication with a valid JWT token and ADMIN role.

### Authorization Header