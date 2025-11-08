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