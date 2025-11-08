# Hotel Check-in Application

A production-grade hotel check-in application built with TypeScript, Express.js, and Node.js. This application provides a robust backend API for managing hotel guest check-in processes with enterprise-level code quality and security standards.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Docker Setup](#docker-setup)
- [Authentication](#authentication)
- [Room Management](#room-management)
- [CI/CD Pipeline](#cicd-pipeline)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Development Guidelines](#development-guidelines)
- [Code Quality](#code-quality)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Overview

This hotel check-in application is designed with clean architecture principles, providing a scalable and maintainable codebase for managing hotel operations. The application features:

- **TypeScript**: Full type safety and modern JavaScript features
- **Express.js**: Fast, unopinionated web framework
- **ESM Modules**: Modern module system for better tree-shaking and performance
- **Strict Type Checking**: Zero tolerance for type errors
- **Production-Ready**: Comprehensive error handling, logging, and security measures
- **PostgreSQL Database**: Robust relational database with Prisma ORM
- **Database Migrations**: Version-controlled schema management
- **JWT Authentication**: Secure token-based authentication with role-based access control

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: Version 20.0.0 or higher
  - Check your version: `node --version`
  - Download from: [https://nodejs.org/](https://nodejs.org/)
- **npm**: Comes bundled with Node.js
  - Check your version: `npm --version`
- **Git**: For version control
  - Check your version: `git --version`
- **PostgreSQL**: Version 14.0 or higher
  - Check your version: `psql --version`
  - Download from: [https://www.postgresql.org/download/](https://www.postgresql.org/download/)
- **Docker**: For containerized deployment (optional)
  - Check your version: `docker --version`
  - Download from: [https://www.docker.com/get-started](https://www.docker.com/get-started)
- **Docker Compose**: For orchestrating multi-container applications (optional)
  - Check your version: `docker-compose --version`
  - Comes bundled with Docker Desktop

## Installation

1. **Clone the repository** (or navigate to your project directory):

## Docker Setup

The application can be run using Docker for consistent development and production environments. Docker containerization provides isolated, reproducible environments across different systems.

### Quick Start with Docker

To start the application with all dependencies using Docker Compose:

## Room Management

The application provides comprehensive room management capabilities through RESTful API endpoints. Hotel administrators can manage room inventory, set pricing, and control room availability.

### Room Management Features

- **Room Listing**: Browse available rooms with filtering and pagination
- **Room Details**: View detailed information about specific rooms
- **Room Creation**: Add new rooms to the inventory (admin only)
- **Room Updates**: Modify room details, pricing, and availability (admin only)
- **Room Deletion**: Remove rooms from the system (admin only)

### Room Management API Endpoints

The room management API provides the following endpoints:

- `GET /api/rooms` - List all rooms with optional filtering and pagination
- `GET /api/rooms/:id` - Get details of a specific room
- `POST /api/rooms` - Create a new room (admin only)
- `PUT /api/rooms/:id` - Update an existing room (admin only)
- `DELETE /api/rooms/:id` - Delete a room (admin only)

For detailed API documentation, including request/response schemas, authentication requirements, and example usage, see [Room API Documentation](docs/api/rooms.md).

### Common Room Operations

#### List All Rooms