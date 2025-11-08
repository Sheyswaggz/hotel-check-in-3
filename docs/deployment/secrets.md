# Secrets Management Documentation

## Overview

This document outlines the secrets management strategy for the Hotel Check-in application's CI/CD pipeline. Proper secrets management is critical for maintaining security across all environments while enabling automated deployments.

## Required GitHub Secrets

### Core Application Secrets

#### `DATABASE_URL`
- **Purpose**: PostgreSQL database connection string
- **Format**: `postgresql://username:password@host:port/database`
- **Example**: `postgresql://hotel_user:secure_password@db.example.com:5432/hotel_checkin`
- **Environment**: Required for all environments (development, staging, production)
- **Security Level**: Critical
- **Rotation Frequency**: Every 90 days

**Validation Requirements**:
- Must be a valid PostgreSQL connection string
- Must include authentication credentials
- Host must be accessible from deployment environment
- Database must exist and be initialized

#### `JWT_SECRET`
- **Purpose**: Secret key for signing and verifying JWT tokens
- **Format**: Base64-encoded random string
- **Minimum Length**: 32 characters (64+ recommended)
- **Generation Command**: `openssl rand -base64 64`
- **Environment**: Required for all environments
- **Security Level**: Critical
- **Rotation Frequency**: Every 180 days

**Validation Requirements**:
- Minimum 32 characters in length
- Must be cryptographically random
- Should be unique per environment
- Never reuse across environments

#### `GITHUB_TOKEN`
- **Purpose**: Authentication for GitHub Container Registry and API access
- **Format**: GitHub Personal Access Token or automatic `GITHUB_TOKEN`
- **Scope**: `write:packages`, `read:packages`, `repo` (if needed)
- **Environment**: Automatically provided by GitHub Actions
- **Security Level**: High
- **Rotation Frequency**: Automatic (for `GITHUB_TOKEN`)

**Note**: The automatic `GITHUB_TOKEN` is sufficient for most CI/CD operations. Only create a Personal Access Token if additional permissions are required.

### Optional Secrets

#### `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- **Purpose**: Email notification configuration
- **Required**: Only if email notifications are enabled
- **Security Level**: Medium

#### `SENTRY_DSN`
- **Purpose**: Error tracking and monitoring
- **Required**: Only if Sentry integration is enabled
- **Security Level**: Low

#### `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Purpose**: AWS S3 file storage integration
- **Required**: Only if using S3 for file uploads
- **Security Level**: High

## Configuring Secrets in GitHub

### Repository-Level Secrets

1. **Navigate to Repository Settings**