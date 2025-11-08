# CI/CD Pipeline Documentation

## Overview

This document describes the GitHub Actions CI/CD pipeline for the Hotel Check-in application. The pipeline automates testing, security scanning, Docker image building, and deployment to development environments.

## Table of Contents

- [Pipeline Architecture](#pipeline-architecture)
- [CI Workflow](#ci-workflow)
- [Deployment Workflow](#deployment-workflow)
- [Secrets Configuration](#secrets-configuration)
- [Branch Protection Rules](#branch-protection-rules)
- [Manual Deployments](#manual-deployments)
- [Troubleshooting](#troubleshooting)

## Pipeline Architecture

The CI/CD pipeline consists of two main workflows:

1. **CI Pipeline** (`.github/workflows/ci.yml`) - Runs on all pull requests and pushes to main
2. **Deployment Pipeline** (`.github/workflows/deploy.yml`) - Deploys to development environment

### Workflow Triggers

**CI Pipeline:**
- Pull requests to `main` branch
- Pushes to `main` branch

**Deployment Pipeline:**
- Pushes to `main` branch (automatic)
- Manual workflow dispatch (on-demand)

### Concurrency Control

Both workflows implement concurrency groups to prevent multiple simultaneous runs: