# CI/CD Pipeline Documentation

## Overview

This document describes the GitHub Actions CI/CD pipeline for the Hotel Check-In application. The pipeline automates testing, linting, security scanning, Docker image building, and deployment to development environments.

## Table of Contents

- [Architecture](#architecture)
- [CI Workflow](#ci-workflow)
- [Deployment Workflow](#deployment-workflow)
- [Environment Configuration](#environment-configuration)
- [Secrets Management](#secrets-management)
- [Manual Deployments](#manual-deployments)
- [Branch Protection Rules](#branch-protection-rules)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)

## Architecture

### Workflow Files

The CI/CD pipeline consists of two main workflows:

- **`.github/workflows/ci.yml`** - Continuous Integration workflow
- **`.github/workflows/deploy.yml`** - Deployment workflow

### Pipeline Flow