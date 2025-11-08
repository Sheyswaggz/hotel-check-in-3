// =============================================================================
// ROOM CONTROLLER - REQUEST HANDLERS FOR ROOM MANAGEMENT API
// =============================================================================
// This controller implements HTTP request handlers for room CRUD operations
// including listing, creation, updates, and deletion with proper authorization.
//
// Architecture: Controller layer pattern with service delegation
// Error Handling: Comprehensive error handling with appropriate HTTP status codes
// Logging: Structured logging for all operations with request context
// Authorization: Admin-only operations protected by role-based middleware
// Validation: Input validation delegated to validator middleware
// =============================================================================

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

// Express.js-like types (simulated for C environment)
typedef struct Request Request;
typedef struct Response Response;
typedef struct NextFunction NextFunction;

// Import room service and types
#include "../services/room.service.h"
#include "../types/room.types.h"

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Logs request information with structured context
 * 
 * @param method - HTTP method
 * @param path - Request path
 * @param user_id - Authenticated user ID (NULL if not authenticated)
 * @param user_role - User role (NULL if not authenticated)
 */
static void log_request(
    const char *method,
    const char *path,
    const char *user_id,
    const char *user_role
) {
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char timestamp[26];
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", tm_info);
    
    printf("[%s] %s %s - User: %s (Role: %s)\n",
           timestamp,
           method,
           path,
           user_id ? user_id : "anonymous",
           user_role ? user_role : "none");
}

/**
 * Logs operation result with duration
 * 
 * @param operation - Operation name
 * @param success - Whether operation succeeded
 * @param duration_ms - Operation duration in milliseconds
 * @param context - Additional context information
 */
static void log_operation_result(
    const char *operation,
    bool success,
    long duration_ms,
    const char *context
) {
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char timestamp[26];
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", tm_info);
    
    printf("[%s] %s %s in %ldms - %s\n",
           timestamp,
           operation,
           success ? "succeeded" : "failed",
           duration_ms,
           context ? context : "");
}

/**
 * Parses query parameter as integer with validation
 * 
 * @param req - Request object
 * @param param_name - Parameter name
 * @param default_value - Default value if parameter not present
 * @param min_value - Minimum allowed value
 * @param max_value - Maximum allowed value
 * @param out_value - Output parameter for parsed value
 * @returns RESULT_SUCCESS on success, error code otherwise
 */
static result_t parse_query_int(
    const Request *req,
    const char *param_name,
    int default_value,
    int min_value,
    int max_value,
    int *out_value
) {
    if (!req || !param_name || !out_value) {
        return RESULT_ERROR_NULL_POINTER;
    }
    
    // Get query parameter (implementation depends on framework)
    const char *param_str = request_get_query_param(req, param_name);
    
    if (!param_str) {
        *out_value = default_value;
        return RESULT_SUCCESS;
    }
    
    // Parse integer
    char *endptr;
    long value = strtol(param_str, &endptr, 10);
    
    // Validate parsing
    if (*endptr != '\0' || endptr == param_str) {
        return RESULT_ERROR_INVALID_INPUT;
    }
    
    // Validate range
    if (value < min_value || value > max_value) {
        return RESULT_ERROR_INVALID_INPUT;
    }
    
    *out_value = (int)value;
    return RESULT_SUCCESS;
}

/**
 * Parses query parameter as double with validation
 * 
 * @param req - Request object
 * @param param_name - Parameter name
 * @param out_value - Output parameter for parsed value
 * @param is_present - Output parameter indicating if parameter was present
 * @returns RESULT_SUCCESS on success, error code otherwise
 */
static result_t parse_query_double(
    const Request *req,
    const char *param_name,
    double *out_value,
    bool *is_present
) {
    if (!req || !param_name || !out_value || !is_present) {
        return RESULT_ERROR_NULL_POINTER;
    }
    
    const char *param_str = request_get_query_param(req, param_name);
    
    if (!param_str) {
        *is_present = false;
        return RESULT_SUCCESS;
    }
    
    char *endptr;
    double value = strtod(param_str, &endptr);
    
    if (*endptr != '\0' || endptr == param_str) {
        return RESULT_ERROR_INVALID_INPUT;
    }
    
    *out_value = value;
    *is_present = true;
    return RESULT_SUCCESS;
}

// =============================================================================
// CONTROLLER HANDLERS
// =============================================================================

/**
 * GET /api/rooms - Retrieves paginated list of rooms with optional filtering
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - type: Filter by room type (STANDARD, DELUXE, SUITE, EXECUTIVE, PRESIDENTIAL)
 * - status: Filter by room status (AVAILABLE, OCCUPIED, MAINTENANCE)
 * - minPrice: Minimum price filter
 * - maxPrice: Maximum price filter
 * 
 * @param req - Request object
 * @param res - Response object
 * @param next - Next middleware function
 * 
 * Response:
 * - 200: Success with paginated rooms data
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
void getAllRooms(Request *req, Response *res, NextFunction *next) {
    const clock_t start_time = clock();
    
    // Log request
    const char *user_id = request_get_user_id(req);
    const char *user_role = request_get_user_role(req);
    log_request("GET", "/api/rooms", user_id, user_role);
    
    // Parse pagination parameters
    PaginationDto pagination = {0};
    int page = 1;
    int limit = 10;
    
    result_t result = parse_query_int(req, "page", 1, 1, INT_MAX, &page);
    if (result != RESULT_SUCCESS) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("getAllRooms", false, duration, "Invalid page parameter");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Invalid page parameter\"}");
        return;
    }
    
    result = parse_query_int(req, "limit", 10, 1, 100, &limit);
    if (result != RESULT_SUCCESS) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("getAllRooms", false, duration, "Invalid limit parameter");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Invalid limit parameter\"}");
        return;
    }
    
    pagination.page = page;
    pagination.limit = limit;
    
    // Parse filter parameters
    RoomFilterDto filters = {0};
    bool has_filters = false;
    
    // Parse room type filter
    const char *type_str = request_get_query_param(req, "type");
    if (type_str) {
        if (strcmp(type_str, "STANDARD") == 0) {
            filters.type = ROOM_TYPE_STANDARD;
            has_filters = true;
        } else if (strcmp(type_str, "DELUXE") == 0) {
            filters.type = ROOM_TYPE_DELUXE;
            has_filters = true;
        } else if (strcmp(type_str, "SUITE") == 0) {
            filters.type = ROOM_TYPE_SUITE;
            has_filters = true;
        } else if (strcmp(type_str, "EXECUTIVE") == 0) {
            filters.type = ROOM_TYPE_EXECUTIVE;
            has_filters = true;
        } else if (strcmp(type_str, "PRESIDENTIAL") == 0) {
            filters.type = ROOM_TYPE_PRESIDENTIAL;
            has_filters = true;
        } else {
            const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
            log_operation_result("getAllRooms", false, duration, "Invalid type parameter");
            
            response_status(res, 400);
            response_json(res, "{\"error\":\"Invalid room type\"}");
            return;
        }
    }
    
    // Parse room status filter
    const char *status_str = request_get_query_param(req, "status");
    if (status_str) {
        if (strcmp(status_str, "AVAILABLE") == 0) {
            filters.status = ROOM_STATUS_AVAILABLE;
            has_filters = true;
        } else if (strcmp(status_str, "OCCUPIED") == 0) {
            filters.status = ROOM_STATUS_OCCUPIED;
            has_filters = true;
        } else if (strcmp(status_str, "MAINTENANCE") == 0) {
            filters.status = ROOM_STATUS_MAINTENANCE;
            has_filters = true;
        } else {
            const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
            log_operation_result("getAllRooms", false, duration, "Invalid status parameter");
            
            response_status(res, 400);
            response_json(res, "{\"error\":\"Invalid room status\"}");
            return;
        }
    }
    
    // Parse price filters
    bool has_min_price = false;
    bool has_max_price = false;
    
    result = parse_query_double(req, "minPrice", &filters.minPrice, &has_min_price);
    if (result != RESULT_SUCCESS) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("getAllRooms", false, duration, "Invalid minPrice parameter");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Invalid minPrice parameter\"}");
        return;
    }
    
    result = parse_query_double(req, "maxPrice", &filters.maxPrice, &has_max_price);
    if (result != RESULT_SUCCESS) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("getAllRooms", false, duration, "Invalid maxPrice parameter");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Invalid maxPrice parameter\"}");
        return;
    }
    
    if (has_min_price || has_max_price) {
        has_filters = true;
    }
    
    // Call room service
    PaginatedRoomsResponse rooms_response;
    result = room_service_get_all_rooms(
        has_filters ? &filters : NULL,
        &pagination,
        &rooms_response
    );
    
    const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
    
    if (result != RESULT_SUCCESS) {
        log_operation_result("getAllRooms", false, duration, "Service error");
        
        response_status(res, 500);
        response_json(res, "{\"error\":\"Failed to retrieve rooms\"}");
        return;
    }
    
    // Build response JSON
    char context[256];
    snprintf(context, sizeof(context), "Retrieved %zu rooms (page %d of %d)",
             rooms_response.meta.total, rooms_response.meta.page, rooms_response.meta.totalPages);
    log_operation_result("getAllRooms", true, duration, context);
    
    // Send response
    response_status(res, 200);
    response_json_rooms(res, &rooms_response);
    
    // Cleanup
    free_paginated_rooms_response(&rooms_response);
}

/**
 * GET /api/rooms/:id - Retrieves single room by ID
 * 
 * Path Parameters:
 * - id: Room UUID
 * 
 * @param req - Request object
 * @param res - Response object
 * @param next - Next middleware function
 * 
 * Response:
 * - 200: Success with room data
 * - 400: Invalid room ID format
 * - 404: Room not found
 * - 500: Internal server error
 */
void getRoomById(Request *req, Response *res, NextFunction *next) {
    const clock_t start_time = clock();
    
    // Get room ID from path parameters
    const char *room_id = request_get_param(req, "id");
    
    // Log request
    const char *user_id = request_get_user_id(req);
    const char *user_role = request_get_user_role(req);
    
    char path[256];
    snprintf(path, sizeof(path), "/api/rooms/%s", room_id ? room_id : "null");
    log_request("GET", path, user_id, user_role);
    
    // Validate room ID
    if (!room_id || strlen(room_id) == 0) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("getRoomById", false, duration, "Missing room ID");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Room ID is required\"}");
        return;
    }
    
    // Call room service
    Room room;
    result_t result = room_service_get_room_by_id(room_id, &room);
    
    const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
    
    if (result == RESULT_ERROR_NOT_FOUND) {
        char context[256];
        snprintf(context, sizeof(context), "Room not found: %s", room_id);
        log_operation_result("getRoomById", false, duration, context);
        
        response_status(res, 404);
        response_json(res, "{\"error\":\"Room not found\"}");
        return;
    }
    
    if (result != RESULT_SUCCESS) {
        log_operation_result("getRoomById", false, duration, "Service error");
        
        response_status(res, 500);
        response_json(res, "{\"error\":\"Failed to retrieve room\"}");
        return;
    }
    
    // Success
    char context[256];
    snprintf(context, sizeof(context), "Retrieved room: %s", room.roomNumber);
    log_operation_result("getRoomById", true, duration, context);
    
    response_status(res, 200);
    response_json_room(res, &room);
}

/**
 * POST /api/rooms - Creates new room (admin only)
 * 
 * Request Body:
 * {
 *   "roomNumber": "string",
 *   "type": "STANDARD|DELUXE|SUITE|EXECUTIVE|PRESIDENTIAL",
 *   "price": number,
 *   "status": "AVAILABLE|OCCUPIED|MAINTENANCE"
 * }
 * 
 * @param req - Request object
 * @param res - Response object
 * @param next - Next middleware function
 * 
 * Response:
 * - 201: Room created successfully
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 403: Forbidden (not admin)
 * - 409: Room number already exists
 * - 500: Internal server error
 */
void createRoom(Request *req, Response *res, NextFunction *next) {
    const clock_t start_time = clock();
    
    // Log request
    const char *user_id = request_get_user_id(req);
    const char *user_role = request_get_user_role(req);
    log_request("POST", "/api/rooms", user_id, user_role);
    
    // Verify admin role (should be handled by middleware, but double-check)
    if (!user_role || strcmp(user_role, "ADMIN") != 0) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("createRoom", false, duration, "Unauthorized: not admin");
        
        response_status(res, 403);
        response_json(res, "{\"error\":\"Admin access required\"}");
        return;
    }
    
    // Parse request body
    CreateRoomDto room_data;
    result_t result = request_parse_json_create_room(req, &room_data);
    
    if (result != RESULT_SUCCESS) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("createRoom", false, duration, "Invalid request body");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Invalid request body\"}");
        return;
    }
    
    // Call room service
    Room created_room;
    result = room_service_create_room(&room_data, &created_room);
    
    const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
    
    if (result == RESULT_ERROR_DUPLICATE) {
        char context[256];
        snprintf(context, sizeof(context), "Duplicate room number: %s", room_data.roomNumber);
        log_operation_result("createRoom", false, duration, context);
        
        response_status(res, 409);
        response_json(res, "{\"error\":\"Room number already exists\"}");
        return;
    }
    
    if (result == RESULT_ERROR_INVALID_INPUT) {
        log_operation_result("createRoom", false, duration, "Validation error");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Invalid room data\"}");
        return;
    }
    
    if (result != RESULT_SUCCESS) {
        log_operation_result("createRoom", false, duration, "Service error");
        
        response_status(res, 500);
        response_json(res, "{\"error\":\"Failed to create room\"}");
        return;
    }
    
    // Success
    char context[256];
    snprintf(context, sizeof(context), "Created room: %s (ID: %s) by admin %s",
             created_room.roomNumber, created_room.id, user_id);
    log_operation_result("createRoom", true, duration, context);
    
    response_status(res, 201);
    response_json_room(res, &created_room);
}

/**
 * PUT /api/rooms/:id - Updates existing room (admin only)
 * 
 * Path Parameters:
 * - id: Room UUID
 * 
 * Request Body (all fields optional):
 * {
 *   "roomNumber": "string",
 *   "type": "STANDARD|DELUXE|SUITE|EXECUTIVE|PRESIDENTIAL",
 *   "price": number,
 *   "status": "AVAILABLE|OCCUPIED|MAINTENANCE"
 * }
 * 
 * @param req - Request object
 * @param res - Response object
 * @param next - Next middleware function
 * 
 * Response:
 * - 200: Room updated successfully
 * - 400: Invalid request body or room ID
 * - 401: Unauthorized
 * - 403: Forbidden (not admin)
 * - 404: Room not found
 * - 409: Room number already exists
 * - 500: Internal server error
 */
void updateRoom(Request *req, Response *res, NextFunction *next) {
    const clock_t start_time = clock();
    
    // Get room ID from path parameters
    const char *room_id = request_get_param(req, "id");
    
    // Log request
    const char *user_id = request_get_user_id(req);
    const char *user_role = request_get_user_role(req);
    
    char path[256];
    snprintf(path, sizeof(path), "/api/rooms/%s", room_id ? room_id : "null");
    log_request("PUT", path, user_id, user_role);
    
    // Verify admin role
    if (!user_role || strcmp(user_role, "ADMIN") != 0) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("updateRoom", false, duration, "Unauthorized: not admin");
        
        response_status(res, 403);
        response_json(res, "{\"error\":\"Admin access required\"}");
        return;
    }
    
    // Validate room ID
    if (!room_id || strlen(room_id) == 0) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("updateRoom", false, duration, "Missing room ID");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Room ID is required\"}");
        return;
    }
    
    // Parse request body
    UpdateRoomDto update_data;
    result_t result = request_parse_json_update_room(req, &update_data);
    
    if (result != RESULT_SUCCESS) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("updateRoom", false, duration, "Invalid request body");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Invalid request body\"}");
        return;
    }
    
    // Call room service
    Room updated_room;
    result = room_service_update_room(room_id, &update_data, &updated_room);
    
    const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
    
    if (result == RESULT_ERROR_NOT_FOUND) {
        char context[256];
        snprintf(context, sizeof(context), "Room not found: %s", room_id);
        log_operation_result("updateRoom", false, duration, context);
        
        response_status(res, 404);
        response_json(res, "{\"error\":\"Room not found\"}");
        return;
    }
    
    if (result == RESULT_ERROR_DUPLICATE) {
        log_operation_result("updateRoom", false, duration, "Duplicate room number");
        
        response_status(res, 409);
        response_json(res, "{\"error\":\"Room number already exists\"}");
        return;
    }
    
    if (result == RESULT_ERROR_INVALID_INPUT) {
        log_operation_result("updateRoom", false, duration, "Validation error");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Invalid room data\"}");
        return;
    }
    
    if (result != RESULT_SUCCESS) {
        log_operation_result("updateRoom", false, duration, "Service error");
        
        response_status(res, 500);
        response_json(res, "{\"error\":\"Failed to update room\"}");
        return;
    }
    
    // Success
    char context[256];
    snprintf(context, sizeof(context), "Updated room: %s (ID: %s) by admin %s",
             updated_room.roomNumber, room_id, user_id);
    log_operation_result("updateRoom", true, duration, context);
    
    response_status(res, 200);
    response_json_room(res, &updated_room);
}

/**
 * DELETE /api/rooms/:id - Deletes room (admin only)
 * 
 * Path Parameters:
 * - id: Room UUID
 * 
 * @param req - Request object
 * @param res - Response object
 * @param next - Next middleware function
 * 
 * Response:
 * - 204: Room deleted successfully (no content)
 * - 400: Invalid room ID
 * - 401: Unauthorized
 * - 403: Forbidden (not admin)
 * - 404: Room not found
 * - 500: Internal server error
 */
void deleteRoom(Request *req, Response *res, NextFunction *next) {
    const clock_t start_time = clock();
    
    // Get room ID from path parameters
    const char *room_id = request_get_param(req, "id");
    
    // Log request
    const char *user_id = request_get_user_id(req);
    const char *user_role = request_get_user_role(req);
    
    char path[256];
    snprintf(path, sizeof(path), "/api/rooms/%s", room_id ? room_id : "null");
    log_request("DELETE", path, user_id, user_role);
    
    // Verify admin role
    if (!user_role || strcmp(user_role, "ADMIN") != 0) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("deleteRoom", false, duration, "Unauthorized: not admin");
        
        response_status(res, 403);
        response_json(res, "{\"error\":\"Admin access required\"}");
        return;
    }
    
    // Validate room ID
    if (!room_id || strlen(room_id) == 0) {
        const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
        log_operation_result("deleteRoom", false, duration, "Missing room ID");
        
        response_status(res, 400);
        response_json(res, "{\"error\":\"Room ID is required\"}");
        return;
    }
    
    // Call room service
    result_t result = room_service_delete_room(room_id);
    
    const long duration = (clock() - start_time) * 1000 / CLOCKS_PER_SEC;
    
    if (result == RESULT_ERROR_NOT_FOUND) {
        char context[256];
        snprintf(context, sizeof(context), "Room not found: %s", room_id);
        log_operation_result("deleteRoom", false, duration, context);
        
        response_status(res, 404);
        response_json(res, "{\"error\":\"Room not found\"}");
        return;
    }
    
    if (result != RESULT_SUCCESS) {
        log_operation_result("deleteRoom", false, duration, "Service error");
        
        response_status(res, 500);
        response_json(res, "{\"error\":\"Failed to delete room\"}");
        return;
    }
    
    // Success
    char context[256];
    snprintf(context, sizeof(context), "Deleted room ID: %s by admin %s", room_id, user_id);
    log_operation_result("deleteRoom", true, duration, context);
    
    response_status(res, 204);
    response_send(res);
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Export controller functions for route registration
 */