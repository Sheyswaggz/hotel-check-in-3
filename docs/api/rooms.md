# Room Management API Documentation

## Overview

The Room Management API provides comprehensive endpoints for managing hotel room inventory, including CRUD operations, filtering, and pagination. This API enables hotel administrators to maintain room data, set pricing, and control room availability.

**Base URL**: `https://api.example.com/v1`

**Authentication**: Bearer token (JWT) required for admin operations

**Rate Limits**:
- Authenticated users: 1000 requests/hour
- Unauthenticated users: 100 requests/hour

---

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [List Rooms](#list-rooms)
  - [Get Room by ID](#get-room-by-id)
  - [Create Room](#create-room)
  - [Update Room](#update-room)
  - [Delete Room](#delete-room)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Authentication

### Public Endpoints
The following endpoints are publicly accessible without authentication:
- `GET /api/rooms` - List rooms
- `GET /api/rooms/:id` - Get room details

### Admin-Only Endpoints
The following endpoints require authentication with an `ADMIN` role:
- `POST /api/rooms` - Create room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room

### Authentication Header