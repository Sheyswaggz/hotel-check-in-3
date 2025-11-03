# Hotel Check-in Application

A production-grade hotel check-in application built with TypeScript, Express.js, and Node.js. This application provides a robust backend API for managing hotel guest check-in processes with enterprise-level code quality and security standards.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Authentication](#authentication)
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

## Installation

1. **Clone the repository** (or navigate to your project directory):

## Authentication

The application uses JWT (JSON Web Token) based authentication to secure API endpoints and manage user sessions. The authentication system supports role-based access control with two user roles: **ADMIN** and **GUEST**.

### Authentication Flow

1. **User Registration**: New users register with email, password, and role
2. **Password Hashing**: Passwords are securely hashed using bcrypt before storage
3. **Token Generation**: Upon successful login, a JWT token is generated with 24-hour expiration
4. **Token Validation**: Protected routes validate the JWT token from the Authorization header
5. **Role-Based Access**: Endpoints enforce role-based permissions (see [Authorization Matrix](docs/authorization-matrix.md))

### API Endpoints

#### Register New User

Create a new user account with email, password, and role.