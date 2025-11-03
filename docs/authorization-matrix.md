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