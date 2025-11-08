# Business Rules Documentation - Reservation Management System

## Overview

This document defines the business rules, validation logic, and workflows for the hotel reservation management system. These rules ensure data integrity, enforce business constraints, and guide the reservation lifecycle from creation to completion.

## Table of Contents

1. [Reservation Status State Machine](#reservation-status-state-machine)
2. [Room Availability Algorithm](#room-availability-algorithm)
3. [Date Validation Rules](#date-validation-rules)
4. [Check-In Workflow](#check-in-workflow)
5. [Check-Out Workflow](#check-out-workflow)
6. [Cancellation Rules](#cancellation-rules)
7. [Business Constraints](#business-constraints)
8. [Validation Rules](#validation-rules)

---

## Reservation Status State Machine

### Status Definitions

| Status | Description | Terminal State |
|--------|-------------|----------------|
| `PENDING` | Reservation created but not yet confirmed | No |
| `CONFIRMED` | Reservation confirmed by admin or payment system | No |
| `CHECKED_IN` | Guest has checked into the room | No |
| `CHECKED_OUT` | Guest has checked out and reservation is complete | Yes |
| `CANCELLED` | Reservation cancelled by guest or admin | Yes |

### State Transition Diagram