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

### Common Room Operations

#### List All Rooms

## CI/CD Pipeline

[![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml)
[![Deploy](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy.yml)

The application uses GitHub Actions for continuous integration and deployment. The CI/CD pipeline automates testing, linting, security scanning, Docker image building, and deployment to development environments.

### Automated Workflows

#### Continuous Integration (CI)

The CI workflow runs automatically on every pull request and push to the main branch:

- **Linting**: ESLint checks for code quality and style consistency
- **Type Checking**: TypeScript compiler validates type safety
- **Unit Tests**: Jest runs all unit and integration tests
- **Security Scanning**: npm audit checks for vulnerable dependencies
- **Docker Build**: Validates Docker image builds successfully
- **Build Artifacts**: Compiles TypeScript to JavaScript and caches for deployment

#### Deployment

The deployment workflow automatically deploys to the development environment when changes are merged to the main branch:

- **Docker Image**: Builds and pushes images to GitHub Container Registry
- **Environment Deployment**: Deploys to development environment with proper configuration
- **Health Checks**: Validates deployment success with automated health checks

### Required GitHub Secrets

The following secrets must be configured in your GitHub repository settings for the CI/CD pipeline to function properly:

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | CI, Deployment |
| `JWT_SECRET` | Secret key for JWT token signing | CI, Deployment |
| `JWT_REFRESH_SECRET` | Secret key for refresh token signing | CI, Deployment |
| `DEPLOY_HOST` | Deployment server hostname | Deployment |
| `DEPLOY_USER` | SSH user for deployment | Deployment |
| `DEPLOY_KEY` | SSH private key for deployment | Deployment |

To configure secrets:
1. Navigate to your repository on GitHub
2. Go to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each required secret with its corresponding value

### Performance Optimization

The CI/CD pipeline includes several optimizations for faster builds:

- **Dependency Caching**: npm dependencies are cached between workflow runs
- **Docker Layer Caching**: Docker build layers are cached to speed up image builds
- **Parallel Jobs**: Tests and linting run in parallel when possible
- **Incremental Builds**: Only changed files trigger relevant workflow steps

### Documentation

For detailed information about the CI/CD pipeline, including workflow configuration, deployment strategies, and troubleshooting:

- [CI/CD Pipeline Documentation](docs/deployment/ci-cd.md) - Comprehensive guide to workflows and deployment
- [Secrets Management](docs/deployment/secrets.md) - Detailed secrets configuration and security best practices

### Monitoring Build Status

You can monitor the status of CI/CD workflows:

- View workflow runs in the **Actions** tab of your GitHub repository
- Check build status badges at the top of this README
- Receive notifications for failed builds via GitHub notifications
- Review detailed logs for each workflow step