import { IncomingMessage, ServerResponse } from "node:http";
import { AntPathMatcher } from "src/utils/AntPathMatcher";
import { Connect, LogLevel, ResolvedConfig } from "vite";
import { IApiWsRestFsError } from "./error.model";
import { IWebSocketConnection, PerMessageDeflateExension } from "./webSocket.model";

/**
 * Extended HTTP request object used by the plugin.
 * Extends Node's IncomingMessage with parsed body, params, query, and files.
 * Similar to Express's Request type for familiar API.
 *
 * @example
 * // Access parsed JSON body
 * console.log(req.body.username);
 *
 * @example
 * // Access route parameters
 * // Pattern: "/api/users/{id}"
 * // Request: "/api/users/123"
 * console.log(req.params.id); // "123"
 *
 * @example
 * // Access query parameters
 * // Request: "/api/search?q=test&limit=10"
 * console.log(req.query.get('q')); // "test"
 * console.log(req.query.get('limit')); // "10"
 */
export interface ApiWsRestFsRequest extends IncomingMessage {
    /**
	 * Parsed request body.
	 * Type depends on the content and parser used.
	 *
	 * @example
	 * // JSON body
	 * req.body = { username: 'john', age: 30 };
	 *
	 * @example
	 * // Form data
	 * req.body = { field1: 'value1', field2: 'value2' };
	 */
	body: any;

	/**
	 * Route parameters extracted from the URL pattern.
	 * Null if the pattern doesn't contain parameters or if no match occurred.
	 *
	 * @example
	 * // Pattern: "/api/users/{userId}/posts/{postId}"
	 * // Request: "/api/users/123/posts/456"
	 * req.params = { userId: '123', postId: '456' };
	 */
    params: Record<string, string> | null;

	/**
	 * Parsed URL query parameters.
	 * Uses URLSearchParams for easy access to query string values.
	 *
	 * @example
	 * // Request: "/api/search?q=typescript&page=2&tags=web&tags=node"
	 * req.query.get('q'); // "typescript"
	 * req.query.get('page'); // "2"
	 * req.query.getAll('tags'); // ["web", "node"]
	 */
	query: URLSearchParams;

	/**
	 * Uploaded files from multipart/form-data requests.
	 * Null if no files were uploaded or if parser doesn't support file uploads.
	 *
	 * @example
	 * // Access uploaded files
	 * if (req.files && req.files.length > 0) {
	 *   req.files.forEach(file => {
	 *     console.log(`File: ${file.name}, Type: ${file.contentType}`);
	 *     // Save file.content buffer to disk
	 *   });
	 * }
	 */
	files: {
		/** Original filename */
		name: string;
		/** File content as Buffer */
		content: Buffer<ArrayBuffer>;
		/** MIME type of the file */
		contentType: string;
	}[] | null;
}

/**
 * Simple handler function for processing HTTP requests.
 * Can be synchronous or asynchronous.
 *
 * @param req - Extended request object with parsed data
 * @param res - Node's ServerResponse for sending the response
 *
 * @example
 * const handler: ApiWsRestFsSimpleHandleFunction = async (req, res) => {
 *   const userId = req.params?.id;
 *   const user = await database.getUser(userId);
 *
 *   res.writeHead(200, { 'Content-Type': 'application/json' });
 *   res.end(JSON.stringify(user));
 * };
 */
export type ApiWsRestFsSimpleHandleFunction = (req: ApiWsRestFsRequest, res: ServerResponse) => void | Promise<void>;

/**
 * Middleware function for pre-processing requests.
 * Similar to Express middleware with next() callback.
 *
 * @param req - Extended request object
 * @param res - ServerResponse object
 * @param next - Function to call to pass control to the next middleware
 *
 * @example
 * // Authentication middleware
 * const authMiddleware: ApiRestFsMiddlewareFunction = async (req, res, next) => {
 *   const token = req.headers.authorization;
 *
 *   if (!token) {
 *     res.writeHead(401, { 'Content-Type': 'application/json' });
 *     res.end(JSON.stringify({ error: 'Unauthorized' }));
 *     return;
 *   }
 *
 *   req.body.user = await verifyToken(token);
 *   next();
 * };
 */
export type ApiRestFsMiddlewareFunction = (req: ApiWsRestFsRequest, res: ServerResponse, next: Connect.NextFunction) => void | Promise<void>;

/**
 * Error handling middleware function.
 * Called when an error occurs during request processing.
 *
 * @param err - The error that occurred
 * @param req - Request object (may not be fully parsed if error occurred early)
 * @param res - ServerResponse object
 * @param next - Function to pass error to the next error middleware
 *
 * @example
 * const errorHandler: ApiRestFsErrorHandleFunction = (err, req, res, next) => {
 *   console.error('Request error:', err);
 *
 *   if (err.code === 'VALIDATION_ERROR') {
 *     res.writeHead(400, { 'Content-Type': 'application/json' });
 *     res.end(JSON.stringify({ error: err.message }));
 *   } else {
 *     res.writeHead(500, { 'Content-Type': 'application/json' });
 *     res.end(JSON.stringify({ error: 'Internal server error' }));
 *   }
 * };
 */
export type ApiRestFsErrorHandleFunction = (err: any, req: ApiWsRestFsRequest | IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => void | Promise<void>;

/**
 * Parser function for transforming raw HTTP requests.
 *
 * @param req - Raw IncomingMessage
 * @param res - ServerResponse object
 * @param next - Callback to continue processing
 *
 * @example
 * // Custom JSON parser
 * const jsonParser: ApiWsRestFsParserFunction = (req, res, next) => {
 *   let body = '';
 *   req.on('data', chunk => body += chunk);
 *   req.on('end', () => {
 *     try {
 *       req.body = JSON.parse(body);
 *       next();
 *     } catch (err) {
 *       res.writeHead(400);
 *       res.end('Invalid JSON');
 *     }
 *   });
 * };
 */
export type ApiWsRestFsParserFunction = (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => void | Promise<void>;

/**
 * Configuration for request body parsing.
 *
 * @example
 * // Use built-in parser
 * parser: true
 *
 * @example
 * // Disable parsing
 * parser: false
 *
 * @example
 * // Custom parser with transformation
 * parser: {
 *   parser: express.json(),
 *   transform: (req) => ({
 *     body: req.body,
 *     query: new URLSearchParams(req.url.split('?')[1])
 *   })
 * }
 */
export type APiWsRestFsParser = boolean | {
	/**
	 * Parser function(s) to process the request.
	 * Can be a single function or array of functions (executed in order).
	 * Compatible with Express parsers like express.json(), express.urlencoded(), etc.
	 */
	parser: ApiWsRestFsParserFunction | ApiWsRestFsParserFunction[];

	/**
	 * Transform function to extract parsed data from the request.
	 * Returns an object with body, files, and/or query properties.
	 * Only non-undefined values are used to construct the final ApiWsRestFsRequest.
	 *
	 * @param req - The request after parser processing
	 * @returns Object containing the extracted data
	 */
	transform: (req: IncomingMessage) => {
		body?: any;
		files?: {
			name: string;
			content: Buffer<ArrayBuffer>;
			contentType: string;
		}[];
		query?: URLSearchParams;
	}
};

/**
 * Common pagination options.
 */
type ApiWsRestFsPaginationCommon = {
    /**
	 * Query parameter or body field name for the limit value.
	 * Specifies maximum number of results to return.
	 *
	 * @example
	 * // Query param: /api/users?limit=10
	 * limit: "limit"
	 *
	 * @example
	 * // Body field: { pagination: { pageSize: 10 } }
	 * limit: "pagination.pageSize"
	 */
	limit?: string;

	/**
	 * Query parameter or body field name for the skip/offset value.
	 * Specifies number of results to skip.
	 *
	 * @example
	 * // Query param: /api/users?skip=20
	 * skip: "skip"
	 *
	 * @example
	 * // Body field: { pagination: { offset: 20 } }
	 * skip: "pagination.offset"
	 */
    skip?: string;

	/**
	 * Query parameter or body field name for the sort field.
	 * Specifies which field to sort by.
	 *
	 * @example
	 * // Query param: /api/users?sort=createdAt
	 * sort: "sort"
	 *
	 * @example
	 * // Body field: { sortBy: "name" }
	 * sort: "sortBy"
	 */
    sort?: string;

	/**
	 * Query parameter or body field name for the sort order.
	 * Accepted values: "ASC"/"DESC", "1"/"-1", or "true"/"false".
	 *
	 * @example
	 * // Query param: /api/users?order=DESC
	 * order: "order"
	 *
	 * @example
	 * // Body field: { sortOrder: "ASC" }
	 * order: "sortOrder"
	 */
    order?: string;
}

/**
 * Pagination configuration for filtering and sorting results from file-based endpoints.
 * Only works with JSON files containing array values.
 *
 * @example
 * // Pagination via query parameters
 * {
 *   type: "query-param",
 *   limit: "limit",
 *   skip: "skip",
 *   sort: "sortBy",
 *   order: "order"
 * }
 * // Request: /api/users?limit=10&skip=20&sortBy=name&order=ASC
 *
 * @example
 * // Pagination via request body
 * {
 *   type: "body",
 *   root: "pagination",
 *   limit: "pageSize",
 *   skip: "offset"
 * }
 * // Request body: { pagination: { pageSize: 10, offset: 20 } }
 */
type ApiWsRestFsPagination = (
    | {
        /** Pagination options provided in request body */
        type: "body";
        /**
		 * Root object path in body containing pagination options.
		 * If omitted, looks for pagination fields at the body root level.
		 *
		 * @example
		 * // With root: "pagination"
		 * // Body: { pagination: { limit: 10, skip: 0 } }
		 * root: "pagination"
		 *
		 * @example
		 * // Without root
		 * // Body: { limit: 10, skip: 0 }
		 * root: undefined
		 */
		root?: string;
    }
    | {
        /** Pagination options provided as URL query parameters */
        type: "query-param";
        root?: never;
    }
) & ApiWsRestFsPaginationCommon;

/**
 * Common filter options.
 */
type ApiWsRestFsFilterCommon = {
    /**
	 * Query parameter or body field name containing the value to filter by.
	 *
	 * @example
	 * // Query param: /api/users?status=active
	 * key: "status"
	 *
	 * @example
	 * // Body field: { filters: { userStatus: "active" } }
	 * key: "filters.userStatus"
	 */
	key: string;

	/**
	 * Type of the filter value or custom parsing function.
	 * Used to convert string values to the appropriate type for comparison.
	 *
	 * @example
	 * // Parse as number
	 * valueType: "number"
	 *
	 * @example
	 * // Parse as date
	 * valueType: "date"
	 *
	 * @example
	 * // Custom parser
	 * valueType: (val) => val.toLowerCase().trim()
	 */
    valueType: "string" | "boolean" | "number" | "date" | "string[]" | "boolean[]" | "number[]" | "date[]" | ((val: any) => any);

	/**
	 * Comparison operator for filtering.
	 *
	 * - `eq`: Equal to
	 * - `ne`: Not equal to
	 * - `in`: Value is in array
	 * - `nin`: Value is not in array
	 * - `lt`: Less than
	 * - `lte`: Less than or equal
	 * - `gt`: Greater than
	 * - `gte`: Greater than or equal
	 * - `regex`: Regular expression match
	 *
	 * @example
	 * // Exact match
	 * comparison: "eq"
	 *
	 * @example
	 * // Range filter
	 * comparison: "gte" // age >= 18
	 *
	 * @example
	 * // Pattern matching
	 * comparison: "regex" // name matches /^John/i
	 */
	comparison: "eq" | "ne" | "in" | "nin" | "lt" | "lte" | "gt" | "gte" | "regex";

	/**
	 * Regular expression flags (only for regex comparison).
	 * Common flags: "i" (case-insensitive), "g" (global), "m" (multiline).
	 *
	 * @example
	 * {
	 *   comparison: "regex",
	 *   regexFlags: "i" // Case-insensitive matching
	 * }
	 */
    regexFlags?: string;
}

/**
 * Filter configuration for filtering results from file-based endpoints.
 * Only works with JSON files containing array values.
 *
 * @example
 * // Filter via query parameters
 * {
 *   type: "query-param",
 *   filters: [
 *     { key: "status", valueType: "string", comparison: "eq" },
 *     { key: "age", valueType: "number", comparison: "gte" }
 *   ]
 * }
 * // Request: /api/users?status=active&age=18
 *
 * @example
 * // Filter via request body
 * {
 *   type: "body",
 *   root: "filters",
 *   filters: [
 *     { key: "email", valueType: "string", comparison: "regex", regexFlags: "i" }
 *   ]
 * }
 * // Request body: { filters: { email: "@gmail.com" } }
 */
type ApiWsRestFsFilter = (
    | {
        /** Filter options provided in request body */
        type: "body";
        /**
		 * Root object path in body containing filter options.
		 *
		 * @example
		 * // With root
		 * // Body: { filters: { status: "active" } }
		 * root: "filters"
		 */
		root?: string;
		/** Array of filter definitions */
		filters: ApiWsRestFsFilterCommon[];
    }
    | {
        /** Filter options provided as URL query parameters */
        type: "query-param";
        root?: never;
		/** Array of filter definitions */
		filters: ApiWsRestFsFilterCommon[];
    }
);

/**
 * Common options shared by all handler types.
 */
type ApiWsRestFsHandlerCommon = {
    /**
     * Apache Ant-style path pattern for URL matching.
     *
     * Pattern syntax:
     * - `?` matches exactly one character
     * - `*` matches zero or more characters (within a path segment)
     * - `**` matches zero or more path segments
     * - `{name}` captures a path variable
     * - `{name:regex}` captures a path variable matching the regex
     *
     * @example
     * // Exact path
     * pattern: "/api/users"
     *
     * @example
     * // Path with variable
     * pattern: "/api/users/{id}"
     * // Matches: /api/users/123, /api/users/abc
     *
     * @example
     * // Wildcard in segment
     * pattern: "/api/files/*.json"
     * // Matches: /api/files/data.json, /api/files/config.json
     *
     * @example
     * // Multiple segments
     * pattern: "/api/**\/details"
     * // Matches: /api/users/123/details, /api/products/details
     *
     * @example
     * // Regex validation
     * pattern: "/api/users/{id:[0-9]+}"
     * // Matches: /api/users/123
     * // Does NOT match: /api/users/abc
     */
    pattern: string;

	/**
	 * Disable this handler without removing it from configuration.
	 * Useful for temporarily disabling specific endpoints.
	 *
	 * @default false
	 *
	 * @example
	 * {
	 *   pattern: "/api/beta-feature",
	 *   disabled: true, // Temporarily disabled
	 *   handle: myHandler
	 * }
	 */
    disabled?: boolean;

	/**
	 * Artificial delay in milliseconds before sending response.
	 * Overrides the global delay option for this specific handler.
	 * Useful for simulating slow networks or testing loading states.
	 *
	 * @example
	 * {
	 *   pattern: "/api/slow-endpoint",
	 *   delay: 2000, // 2 second delay
	 *   handle: myHandler
	 * }
	 */
	delay?: number;

	/**
	 * Custom parser configuration for this handler.
	 * Overrides the global parser option.
	 * Only applicable for REST handlers (not WebSocket).
	 *
	 * @example
	 * // Use custom parser for this endpoint only
	 * {
	 *   pattern: "/api/upload",
	 *   parser: {
	 *     parser: multer().any(),
	 *     transform: (req) => ({
	 *       files: req.files,
	 *       body: req.body
	 *     })
	 *   }
	 * }
	 */
	parser?: APiWsRestFsParser;
}

/**
 * REST API handler configuration.
 * Defines how HTTP requests are processed for specific URL patterns.
 *
 * @example
 * // Simple custom handler
 * {
 *   pattern: "/api/users",
 *   method: "GET",
 *   handle: async (req, res) => {
 *     const users = await database.getUsers();
 *     res.writeHead(200, { 'Content-Type': 'application/json' });
 *     res.end(JSON.stringify(users));
 *   }
 * }
 *
 * @example
 * // File-based handler with pagination
 * {
 *   pattern: "/api/products",
 *   method: "GET",
 *   handle: "FS",
 *   pagination: {
 *     exclusive: {
 *       type: "query-param",
 *       limit: "limit",
 *       skip: "skip",
 *       sort: "sortBy"
 *     }
 *   }
 * }
 *
 * @example
 * // Handler with URL transformation
 * {
 *   pattern: "/api/v2/users",
 *   method: "GET",
 *   handle: "FS",
 *   preHandle: {
 *     transform: (url) => url.replace('/v2/', '/v1/')
 *   }
 * }
 */
export type ApiRestFsHandler = (
    | {
        /**
         * HTTP method(s) handled by this configuration.
         *
         * Supported methods:
         * - `HEAD`: Request headers only
         * - `GET`: Retrieve data
         * - `POST`: Create or submit data
         * - `PUT`: Update/replace data
         * - `PATCH`: Partially update data
         * - `DELETE`: Remove data
         * - `OPTIONS`: CORS preflight
         */
        method: "HEAD" | "GET" | "POST";

		/**
         * File system handler.
         * Serves files from the directory specified in `fsDir` plugin option.
         *
         * Supports:
         * - JSON files with automatic pagination and filtering (if configured)
         * - Static files (images, documents, etc.)
         * - Directory listings (if enabled)
         *
         * @example
         * // Serve user data from file system
         * {
         *   pattern: "/api/users",
         *   method: "GET",
         *   handle: "FS"
         * }
         * // Reads from: {fsDir}/api/users.json or {fsDir}/api/users/
         */
        handle: "FS";

		/**
         * Pre-processing configuration for URL transformation.
         * Applied before the file system lookup.
         *
         * @example
         * // Replace API version in URL
         * preHandle: {
         *   transform: (url) => url.replace('/v2/', '/v1/')
         * }
         *
         * @example
         * // Multiple replacements
         * preHandle: {
         *   transform: [
         *     { searchValue: '/api/', replaceValue: '/data/' },
         *     { searchValue: '.json', replaceValue: '' }
         *   ]
         * }
         */
        preHandle?: {
            transform: ((originalEndpoint: string) => string) | { searchValue: string, replaceValue: string }[];
        };

		/**
         * Must be undefined for file system handlers that support pagination/filtering.
         * Use the alternative signature if post-processing is needed.
         */
        postHandle?: never;

		/**
         * Pagination configuration for this handler.
         * Only works with JSON files containing arrays.
         *
         * Options:
         * - `"none"`: Explicitly disable pagination for this handler
         * - `{ inclusive }`: Merge with global pagination config
         * - `{ exclusive }`: Use only this config, ignore global
         *
         * @example
         * // Use handler-specific pagination only
         * pagination: {
         *   exclusive: {
         *     type: "query-param",
         *     limit: "pageSize",
         *     skip: "offset"
         *   }
         * }
         *
         * @example
         * // Disable pagination for this endpoint
         * pagination: "none"
         */
        pagination?: "none" | {inclusive?: ApiWsRestFsPagination, exclusive?: never} | {inclusive?: never, exclusive?: ApiWsRestFsPagination};

		/**
         * Filter configuration for this handler.
         * Only works with JSON files containing arrays.
         *
         * Options:
         * - `"none"`: Explicitly disable filters for this handler
         * - `{ inclusive }`: Merge with global filter config
         * - `{ exclusive }`: Use only this config, ignore global
         *
         * @example
         * // Handler-specific filters
         * filters: {
         *   exclusive: {
         *     type: "query-param",
         *     filters: [
         *       { key: "status", valueType: "string", comparison: "eq" },
         *       { key: "price", valueType: "number", comparison: "lte" }
         *     ]
         *   }
         * }
         */
		filters?: "none" | {inclusive?: ApiWsRestFsFilter, exclusive?: never} | {inclusive?: never, exclusive?: ApiWsRestFsFilter};
	}
	| {
		method: "HEAD" | "GET" | "POST";
		handle: "FS";
		preHandle?: {
			transform: ((originalEndpoint: string) => string) | { searchValue: string, replaceValue: string }[];
		};
		/**
         * Post-processing function called after file is read.
         * Can modify the response before sending to client.
         *
         * @param req - The processed request
         * @param res - ServerResponse for sending modified response
         * @param data - File content (null if file not found)
         *
         * @example
         * // Add metadata to file response
         * postHandle: async (req, res, data) => {
         *   if (!data) {
         *     res.writeHead(404);
         *     res.end('Not found');
         *     return;
         *   }
         *
         *   const response = {
         *     data: JSON.parse(data),
         *     timestamp: Date.now(),
         *     path: req.url
         *   };
         *
         *   res.writeHead(200, { 'Content-Type': 'application/json' });
         *   res.end(JSON.stringify(response));
         * }
         */
		postHandle?: (req: ApiWsRestFsRequest, res: ServerResponse, data: string | null) => void | Promise<void>;
		pagination?: never;
		filters?: never;
	}
	| {
		method: "PUT" | "PATCH" | "DELETE";
		handle: "FS";
		preHandle?: {
			transform: ((originalEndpoint: string) => string) | { searchValue: string, replaceValue: string }[];
		};
		/**
         * Post-processing for PUT/PATCH/DELETE file operations.
         *
         * @example
         * // Custom DELETE handler
         * postHandle: async (req, res, data) => {
         *   if (data) {
         *     await logDeletion(req.params.id);
         *     res.writeHead(204);
         *     res.end();
         *   } else {
         *     res.writeHead(404);
         *     res.end('Resource not found');
         *   }
         * }
         */
		postHandle?: (req: ApiWsRestFsRequest, res: ServerResponse, data: string | null) => void | Promise<void>;
		pagination?: never;
		filters?: never;
	}
    | {
		method: "HEAD" | "GET" | "POST" | "PUT" | "PATCH" | "OPTIONS" | "DELETE";
		/**
         * Custom handler function for full control over request processing.
         *
         * @example
         * // Simple API endpoint
         * handle: async (req, res) => {
         *   const userId = req.params?.id;
         *
         *   try {
         *     const user = await database.findUser(userId);
         *     res.writeHead(200, { 'Content-Type': 'application/json' });
         *     res.end(JSON.stringify(user));
         *   } catch (error) {
         *     res.writeHead(500, { 'Content-Type': 'application/json' });
         *     res.end(JSON.stringify({ error: 'Database error' }));
         *   }
         * }
         */
        handle: ApiWsRestFsSimpleHandleFunction;
        preHandle?: never;
        postHandle?: never;
        pagination?: never;
		filters?: never;
    }
) & ApiWsRestFsHandlerCommon;

/**
 * WebSocket handler configuration.
 * Defines behavior for WebSocket connections on specific URL patterns.
 *
 * @example
 * // Simple chat server
 * {
 *   pattern: "/ws/chat",
 *   defaultRoom: "lobby",
 *   onConnect: (connection) => {
 *     connection.metadata.joinedAt = Date.now();
 *     connection.send({ type: 'welcome', message: 'Connected!' });
 *   },
 *   onMessage: async (connection, message) => {
 *     if (message.type === 'chat') {
 *       connection.broadcast({
 *         type: 'chat',
 *         user: connection.metadata.username,
 *         text: message.text
 *       });
 *     }
 *   }
 * }
 *
 * @example
 * // Game server with heartbeat
 * {
 *   pattern: "/ws/game",
 *   heartbeat: 30000,
 *   inactivityTimeout: 300000,
 *   responses: [
 *     {
 *       match: (conn, msg) => msg.type === 'move',
 *       response: (conn, msg) => ({ type: 'move', data: msg.data }),
 *       broadcast: { room: conn.metadata.gameRoom }
 *     }
 *   ]
 * }
 */
export type ApiWsHandler = {
	/**
     * Apache Ant-style path pattern for WebSocket URL matching.
     * Same syntax as REST handlers.
     *
     * @example
     * pattern: "/ws/chat"
     *
     * @example
     * pattern: "/ws/game/{gameId}"
     */
    pattern: string;

	/**
	 * Disable this WebSocket handler.
	 * @default false
	 */
    disabled?: boolean;

	/**
	 * Artificial delay before processing messages.
	 * @example
	 * delay: 100 // 100ms delay for testing
	 */
	delay?: number;

	/**
	 * permessage-deflate extension configuration.
	 *
	 * - false: disable compression
	 * - true: if client send extension, enable compression with his options.
	 * - object: if client send etension, enable compression according client options and __strict__ plugin option.
	 *
	 * @default false
	 */
	perMessageDeflate?: PerMessageDeflateExension;

	/**
	 * Subprotocols supported by this handler.
	 * Server will negotiate one protocol from client's requested list.
	 *
	 * @example
	 * subprotocols: ['chat.v1', 'chat.v2']
	 */
	subprotocols?: string[];

	/**
	 * Enable automatic ping/pong heartbeat to keep connections alive.
	 * Set to a number (milliseconds) to enable, or false to disable.
	 *
	 * @default false
	 *
	 * @example
	 * // Send ping every 30 seconds
	 * heartbeat: 30000
	 *
	 * @example
	 * // Disable heartbeat
	 * heartbeat: false
	 */
	heartbeat?: number | false;

	/**
	 * Automatically close connection after period of inactivity.
	 * Set to a number (milliseconds) to enable, or false to disable.
	 * Timer resets on any received frame.
	 *
	 * @default false
	 *
	 * @example
	 * // Close after 5 minutes of inactivity
	 * inactivityTimeout: 300000
	 *
	 * @example
	 * // Disable timeout
	 * inactivityTimeout: false
	 */
	inactivityTimeout?: number | false;

	/**
     * Optional function to transform raw message payload before passing to onMessage.
     * Useful for custom encoding formats (Protobuf, MessagePack, etc.).
     *
     * If not provided, the plugin's default behavior is:
	 * - For text frames (0x01): Convert to UTF-8 string, attempt JSON.parse(), fallback to raw string
	 * - For binary frames (0x02): Pass the Buffer as-is
     *
     * @param rawMessage - Raw Buffer received from WebSocket frame(s)
     * @returns Transformed message (any type)
     *
     * @example
     * // Decode MessagePack
     * transformRawData: async (buffer) => {
     *   return msgpack.decode(buffer);
     * }
     *
     * @example
     * // Decode Protobuf
     * transformRawData: (buffer) => {
     *   return MyProtoMessage.decode(buffer);
     * }
     *
     * @example
     * // Custom JSON with validation
     * transformRawData: (buffer) => {
     *   const text = buffer.toString('utf8');
     *   const data = JSON.parse(text);
     *   if (!data.type) throw new Error('Invalid message format');
     *   return data;
     * }
     */
	transformRawData?: (rawMessage: Buffer) => any | Promise<any>;

	/**
     * Called when a client successfully establishes a WebSocket connection.
     * Use for initialization, authentication, sending welcome messages, etc.
     *
     * @param connection - The WebSocket connection instance
     * @param request - The original HTTP upgrade request
     *
     * @throws If this function throws, onError is called (if defined).
     *         If onError is not defined, an error message is sent to the client
     *         and the connection is closed with code 1011.
     *
     * @example
     * onConnect: async (connection, request) => {
     *   // Store user info from headers
     *   const userId = request.headers['x-user-id'];
     *   connection.metadata.userId = userId;
     *
     *   // Join default room
     *   connection.joinRoom('lobby');
     *
     *   // Send welcome message
     *   await connection.send({
     *     type: 'welcome',
     *     message: 'Connected successfully',
     *     userId
     *   });
     *
     *   // Notify others
     *   connection.broadcast({
     *     type: 'user-joined',
     *     userId
     *   }, { room: 'lobby' });
     * }
     */
	onConnect?: (connection: IWebSocketConnection, request: IncomingMessage) => void | Promise<void>;

	/**
     * Called when a Ping frame is received from the client.
     *
     * **Important**: If this callback is defined, automatic pong response is DISABLED.
     * You must manually call `connection.pong()` if you want to respond.
     *
     * If this callback is NOT defined, server automatically responds with pong.
     *
     * @param connection - The WebSocket connection instance
     * @param data - Optional payload from the ping frame
     *
     * @example
     * // Manual pong with latency measurement
     * onPing: (connection, data) => {
     *   const timestamp = data.toString('utf8');
     *   const latency = Date.now() - parseInt(timestamp);
     *   console.log(`Latency: ${latency}ms`);
     *   connection.pong(data); // Echo back
     * }
     *
     * @example
     * // Ignore pings (no automatic response)
     * onPing: (connection, data) => {
     *   console.log('Ping received, not responding');
     * }
     */
	onPing?: (connection: IWebSocketConnection, data: Buffer) => void | Promise<void>;

	/**
     * Called when a Pong frame is received from the client.
     * Usually in response to a ping sent by the server.
     * Useful for measuring round-trip time.
     *
     * @param connection - The WebSocket connection instance
     * @param data - Optional payload from the pong frame
     *
     * @example
     * // Measure latency
     * let pingTimestamp: number;
     *
     * // On heartbeat interval
     * connection.ping(Date.now().toString());
     *
     * // On pong received
     * onPong: (connection, data) => {
     *   const sentAt = parseInt(data.toString('utf8'));
     *   const latency = Date.now() - sentAt;
     *   connection.metadata.latency = latency;
     *   console.log(`Client ${connection.id} latency: ${latency}ms`);
     * }
     */
	onPong?: (connection: IWebSocketConnection, data: Buffer) => void | Promise<void>;

	/**
     * Called whenever a parsed message is received from the client.
     * This is where main application logic typically lives.
     *
     * @param connection - The WebSocket connection instance
     * @param message - The parsed message (type depends on transformRawData)
     *
     * @throws If this function throws, onError is called (if defined).
     *         If onError is not defined, an error message is sent to the client.
     *
     * @example
     * // Chat message handling
     * onMessage: async (connection, message) => {
     *   if (message.type === 'chat') {
     *     // Broadcast to all in same room
     *     const rooms = connection.getRooms();
     *     rooms.forEach(room => {
     *       connection.broadcast({
     *         type: 'chat',
     *         user: connection.metadata.username,
     *         text: message.text,
     *         timestamp: Date.now()
     *       }, { room, includeSelf: false });
     *     });
     *   } else if (message.type === 'join-room') {
     *     connection.joinRoom(message.room);
     *     await connection.send({
     *       type: 'joined',
     *       room: message.room
     *     });
     *   }
     * }
     *
     * @example
     * // Game state update
     * onMessage: async (connection, message) => {
     *   switch (message.type) {
     *     case 'move':
     *       const gameRoom = connection.metadata.gameRoom;
     *       const isValid = validateMove(message.move);
     *
     *       if (isValid) {
     *         connection.broadcast({
     *           type: 'move',
     *           playerId: connection.id,
     *           move: message.move
     *         }, { room: gameRoom, includeSelf: true });
     *       } else {
     *         await connection.send({
     *           type: 'error',
     *           message: 'Invalid move'
     *         });
     *       }
     *       break;
     *   }
     * }
     */
	onMessage?: (connection: IWebSocketConnection, message: any) => void | Promise<void>;

	/**
     * Called when the connection is closed.
     * Use for cleanup, logging, notifying other users, etc.
     *
     * @param connection - The WebSocket connection instance
     * @param code - WebSocket close code (1000 = normal, 1006 = abnormal, etc.)
     * @param reason - Human-readable close reason
     * @param initiatedByClient - True if client initiated the close
     *
     * @example
     * onClose: (connection, code, reason, initiatedByClient) => {
     *   console.log(`Client ${connection.id} disconnected: ${code} - ${reason}`);
     *
     *   // Notify others in same rooms
     *   connection.getRooms().forEach(room => {
     *     connection.broadcast({
     *       type: 'user-left',
     *       userId: connection.id
     *     }, { room });
     *   });
     *
     *   // Cleanup
     *   database.updateUserStatus(connection.metadata.userId, 'offline');
     * }
     */
	onClose?: (connection: IWebSocketConnection, code?: number, reason?: string, initiatedByClient?: boolean) => void | Promise<void>;

	/**
     * Called whenever an error occurs during connection lifecycle.
     * Includes errors from: onConnect, onMessage, response patterns, and socket errors.
     *
     * If not defined, default error handling applies:
     * - Send error message to client
     * - Log error to console
     * - Close connection on critical errors
     *
     * @param connection - The WebSocket connection where error occurred
     * @param error - The error object
     *
     * @example
     * onError: (connection, error) => {
     *   console.error(`Error on connection ${connection.id}:`, error);
     *
     *   // Send user-friendly error
     *   connection.send({
     *     type: 'error',
     *     message: 'Something went wrong',
     *     code: error.code
     *   }).catch(() => {
     *     // Connection might be dead, force close
     *     connection.forceClose();
     *   });
     *
     *   // Log to external service
     *   errorLogger.log({
     *     connectionId: connection.id,
     *     userId: connection.metadata.userId,
     *     error: error.message,
     *     stack: error.stack
     *   });
     * }
     */
	onError?: (connection: IWebSocketConnection, error: Error) => void | Promise<void>;

	/**
     * Optional authentication function.
     * Called before WebSocket handshake completes.
     *
     * Return `true` to allow connection, `false` to reject with 401.
     * Can be async for database lookups, token validation, etc.
     *
     * @param request - The HTTP upgrade request
     * @returns True to allow, false to reject
     *
     * @throws If throws an error, connection is rejected with 500.
     *
     * @example
     * // Token-based authentication
     * authenticate: async (request) => {
     *   const token = request.headers['authorization']?.replace('Bearer ', '');
     *
     *   if (!token) return false;
     *
     *   try {
     *     const user = await verifyToken(token);
     *     return user !== null;
     *   } catch (error) {
     *     return false;
     *   }
     * }
     *
     * @example
     * // Session-based authentication
     * authenticate: async (request) => {
     *   const sessionId = parseCookies(request.headers.cookie).sessionId;
     *   const session = await sessions.get(sessionId);
     *   return session && session.authenticated;
     * }
     *
     * @example
     * // IP whitelist
     * authenticate: (request) => {
     *   const ip = request.socket.remoteAddress;
     *   return allowedIPs.includes(ip);
     * }
     */
	authenticate?: (request: IncomingMessage) => boolean | Promise<boolean>;

	/**
     * Array of automatic response rules.
     * Processed in order; first matching rule is executed.
     * If THERE IS A MATCH, onMessage callback is not executed.
     *
     * @example
     * responses: [
     *   // Echo server
     *   {
     *     match: (conn, msg) => msg.type === 'echo',
     *     response: (conn, msg) => ({ type: 'echo', data: msg.data })
     *   },
     *
     *   // Broadcast chat message
     *   {
     *     match: (conn, msg) => msg.type === 'chat',
     *     response: (conn, msg) => ({
     *       type: 'chat',
     *       user: conn.metadata.username,
     *       text: msg.text,
     *       timestamp: Date.now()
     *     }),
     *     broadcast: true // Broadcast to sender's rooms
     *   },
     *
     *   // Targeted broadcast
     *   {
     *     match: (conn, msg) => msg.type === 'game-action',
     *     response: (conn, msg) => ({ type: 'action', data: msg.action }),
     *     broadcast: {
     *       room: 'game-123',
     *       includeSelf: true // Include sender in broadcast
     *     }
     *   },
     *
     *   // No response (just side effects)
     *   {
     *     match: (conn, msg) => msg.type === 'typing',
     *     response: (conn, msg) => {
     *       conn.metadata.lastTyping = Date.now();
     *       // Return void = no message sent
     *     }
     *   }
     * ]
     */
	responses?: {
		/**
         * Function to test if this response rule matches the message.
         *
         * @param connection - The connection that sent the message
         * @param message - The parsed message
         * @returns True if this rule should be applied
         *
         * @example
         * // Match by message type
         * match: (conn, msg) => msg.type === 'ping'
         *
         * @example
         * // Match with condition
         * match: (conn, msg) => {
         *   return msg.type === 'admin-command' &&
         *          conn.metadata.role === 'admin';
         * }
         *
         * @example
         * // Match by room
         * match: (conn, msg) => {
         *   return msg.type === 'broadcast' &&
         *          conn.isInRoom('moderators');
         * }
         */
		match: (connection: IWebSocketConnection, message: any) => boolean;

		/**
         * The response to send when match succeeds.
         *
         * Can be:
         * - Static value: Sent as-is (serialized to JSON)
         * - Function: Called with connection and message, returns response
         * - Function returning void: No response sent (useful for side effects only)
         *
         * @param connection - The connection that sent the message
         * @param message - The matched message
         * @returns Response data or void (no response)
         *
         * @example
         * // Static response
         * response: { type: 'pong' }
         *
         * @example
         * // Dynamic response
         * response: (conn, msg) => ({
         *   type: 'response',
         *   data: processData(msg.data),
         *   timestamp: Date.now()
         * })
         *
         * @example
         * // Side effects only (no response)
         * response: (conn, msg) => {
         *   updateDatabase(msg);
         *   // No return = no message sent
         * }
         *
         * @example
         * // Conditional response
         * response: (conn, msg) => {
         *   if (msg.priority === 'high') {
         *     return { type: 'ack', fast: true };
         *   }
         *   // Return undefined = no response
         * }
         */
		response: ((connection: IWebSocketConnection, message: any) => any | void) | string | number | boolean | bigint | Buffer | Uint8Array | object | any[] | null | undefined;

		/**
		 * Broadcast configuration for the response.
		 *
		 * - `true`: Broadcast to all rooms the sender is currently in (excludes sender by default)
		 * - `false` or `undefined`: Send only to the matching client (no broadcast)
		 * - Object: Configure specific broadcast behavior with room targeting and sender inclusion
		 *
		 * @example
		 * // Simple broadcast to sender's rooms
		 * broadcast: true
		 *
		 * @example
		 * // Broadcast to a specific room
		 * broadcast: { room: 'game-lobby' }
		 *
		 * @example
		 * // Broadcast including the sender
		 * broadcast: { includeSelf: true }
		 *
		 * @example
		 * // Broadcast to specific room, including sender
		 * broadcast: { room: 'chat-room-1', includeSelf: true }
		 */
		broadcast?: boolean | {
			/**
			 * The specific room to broadcast to.
			 * If omitted, broadcasts to all rooms the sender is currently in.
			 * If the sender is in no rooms, broadcasts globally to all connected clients.
			 */
			room?: string;
			/**
			 * Whether to include the message sender in the broadcast.
			 * @default false
			 */
			includeSelf?: boolean;
		};
	}[];

	/**
     * Optional default room for this handler.
     * Clients automatically join this room upon connecting.
     *
     * Set to `false` to disable default room.
     *
     * @example
     * // Auto-join lobby
     * defaultRoom: "lobby"
     *
     * @example
     * // No default room
     * defaultRoom: false
     *
     * @example
     * // Combined with manual room management
     * {
     *   defaultRoom: "waiting-room",
     *   onMessage: (connection, message) => {
     *     if (message.type === 'join-game') {
     *       connection.leaveRoom('waiting-room');
     *       connection.joinRoom(`game-${message.gameId}`);
     *     }
     *   }
     * }
     */
	defaultRoom?: string | false;
};

/**
 * Plugin configuration options.
 *
 * @example
 * // Basic REST API setup
 * {
 *   endpointPrefix: '/api',
 *   fsDir: './mock-data',
 *   handlers: [
 *     {
 *       pattern: '/api/users',
 *       method: 'GET',
 *       handle: 'FS'
 *     }
 *   ]
 * }
 *
 * @example
 * // WebSocket enabled setup
 * {
 *   enableWs: true,
 *   endpointPrefix: '/api',
 *   wsHandlers: [
 *     {
 *       pattern: '/ws/chat',
 *       onConnect: (conn) => conn.joinRoom('lobby'),
 *       onMessage: (conn, msg) => conn.broadcast(msg)
 *     }
 *   ]
 * }
 */
export type ApiWsRestFsOptions =
	{
		/**
		 * Completely disable the plugin.
		 * Useful for production builds or conditional enabling.
		 *
		 * @default false
		 *
		 * @example
		 * disable: process.env.NODE_ENV === 'production'
		 */
		disable?: boolean;

		/**
		 * Logging verbosity level.
		 *
		 * - `"silent"`: No logs
		 * - `"error"`: Only errors
		 * - `"warn"`: Warnings and errors
		 * - `"info"`: General information (recommended)
		 * - `"debug"`: Verbose debugging information
		 *
		 * @default "info"
		 *
		 * @example
		 * logLevel: "debug" // For development
		 *
		 * @example
		 * logLevel: "silent" // For production
		 */
		logLevel?: LogLevel | "debug";

		/**
		 * Simulate a gateway timeout by forcing 504 response after specified milliseconds.
		 * Does NOT stop handler execution, only changes the response status.
		 * Not applicable for WebSocket requests.
		 *
		 * @example
		 * gatewayTimeout: 5000 // 5 second timeout
		 */
		gatewayTimeout?: number;

		/**
		 * Global artificial delay in milliseconds before sending responses.
		 * Useful for testing loading states and simulating network latency.
		 * Can be overridden per handler.
		 * Not applicable for WebSocket requests.
		 *
		 * @default 0
		 *
		 * @example
		 * delay: 1000 // 1 second delay for all responses
		 */
		delay?: number;

		/**
		 * URL prefix(es) that the plugin will intercept and handle.
		 * Requests not starting with these prefixes are passed through.
		 *
		 * @default "/api"
		 *
		 * @example
		 * // Single prefix
		 * endpointPrefix: "/api"
		 *
		 * @example
		 * // Multiple prefixes
		 * endpointPrefix: ["/api", "/v1", "/mock"]
		 */
		endpointPrefix?: string | string[];

		/**
		 * Directory path for file-based handlers, relative to vite.config location.
		 * Used when handler `handle` option is set to "FS".
		 *
		 * Set to `null` to disable file-based routing entirely.
		 *
		 * @example
		 * fsDir: "./mock-data"
		 * // File structure:
		 * // mock-data/
		 * //   api/
		 * //     users.json
		 * //     products.json
		 *
		 * @example
		 * fsDir: null // Disable file-based routing
		 */
		fsDir?: string | null;

		/**
		 * Enable WebSocket support.
		 * When `true`, `wsHandlers` option becomes required.
		 *
		 * @default false
		 *
		 * @example
		 * enableWs: true
		 */
		enableWs?: false | undefined;

		/**
		 * Behavior for requests that don't match any handler pattern.
		 *
		 * - `"404"`: Return 404 Not Found
		 * - `"forward"`: Pass request to next Vite middleware
		 *
		 * @default "404"
		 *
		 * @example
		 * // Return 404 for unmatched requests
		 * noHandledRestFsRequestsAction: "404"
		 *
		 * @example
		 * // Forward to Vite's default handler (e.g., serve static files)
		 * noHandledRestFsRequestsAction: "forward"
		 */
		noHandledRestFsRequestsAction?: "404" | "forward";

		/**
		 * Request body parsing configuration.
		 * Determines how request body, query params, and route params are parsed.
		 * Executed after handlerMiddlewares.
		 * Not applicable for WebSocket requests.
		 *
		 * - `true`: Enable built-in simple parser (JSON + form data)
		 * - `false`: Disable all parsing
		 * - Object: Use custom parser with transformation
		 *
		 * @default true
		 *
		 * @example
		 * // Use built-in parser
		 * parser: true
		 *
		 * @example
		 * // Disable parsing
		 * parser: false
		 *
		 * @example
		 * // Custom parser
		 * parser: {
		 *   parser: [express.json(), express.urlencoded({ extended: true })],
		 *   transform: (req) => ({
		 *     body: req.body,
		 *     query: new URLSearchParams(req.url.split('?')[1])
		 *   })
		 * }
		 */
		parser?: APiWsRestFsParser;

		/**
		 * Middleware functions executed before each handler.
		 * Similar to Express middleware, executed in order.
		 * Not applicable for FS handlers or WebSocket requests.
		 *
		 * @example
		 * handlerMiddlewares: [
		 *   // Logging middleware
		 *   async (req, res, next) => {
		 *     console.log(`${req.method} ${req.url}`);
		 *     next();
		 *   },
		 *
		 *   // Auth middleware
		 *   async (req, res, next) => {
		 *     const token = req.headers.authorization;
		 *     if (!token) {
		 *       res.writeHead(401);
		 *       res.end('Unauthorized');
		 *       return;
		 *     }
		 *     req.body.user = await verifyToken(token);
		 *     next();
		 *   }
		 * ]
		 */
		handlerMiddlewares?: ApiRestFsMiddlewareFunction[];

		/**
		 * Error handling middleware functions.
		 * Called when an error occurs during request processing.
		 * Executed in order, similar to Express error middleware.
		 * Not applicable for WebSocket requests.
		 *
		 * @example
		 * errorMiddlewares: [
		 *   // Validation error handler
		 *   (err, req, res, next) => {
		 *     if (err.name === 'ValidationError') {
		 *       res.writeHead(400, { 'Content-Type': 'application/json' });
		 *       res.end(JSON.stringify({ error: err.message }));
		 *     } else {
		 *       next(err);
		 *     }
		 *   },
		 *
		 *   // Generic error handler
		 *   (err, req, res, next) => {
		 *     console.error('Unhandled error:', err);
		 *     res.writeHead(500, { 'Content-Type': 'application/json' });
		 *     res.end(JSON.stringify({ error: 'Internal server error' }));
		 *   }
		 * ]
		 */
		errorMiddlewares?: ApiRestFsErrorHandleFunction[];

		/**
		 * REST API handler configurations.
		 * Defines how HTTP requests are processed.
		 * If omitted, plugin only handles file-based requests.
		 *
		 * @example
		 * handlers: [
		 *   {
		 *     pattern: '/api/users',
		 *     method: 'GET',
		 *     handle: 'FS'
		 *   },
		 *   {
		 *     pattern: '/api/auth/login',
		 *     method: 'POST',
		 *     handle: async (req, res) => {
		 *       const { username, password } = req.body;
		 *       const token = await authenticate(username, password);
		 *       res.writeHead(200, { 'Content-Type': 'application/json' });
		 *       res.end(JSON.stringify({ token }));
		 *     }
		 *   }
		 * ]
		 */
		handlers?: ApiRestFsHandler[];

		/**
		 * WebSocket handlers (not allowed when enableWs is false/undefined).
		 */
		wsHandlers?: never;

		/**
		 * Global pagination configuration for file-based endpoints.
		 * Can be configured per HTTP method or for all methods.
		 * Only works with JSON files containing arrays.
		 * Not applicable for WebSocket requests.
		 *
		 * @example
		 * // Pagination for all GET requests
		 * pagination: {
		 *   ALL: {
		 *     type: "query-param",
		 *     limit: "limit",
		 *     skip: "skip",
		 *     sort: "sortBy",
		 *     order: "order"
		 *   }
		 * }
		 *
		 * @example
		 * // Different pagination per method
		 * pagination: {
		 *   GET: {
		 *     type: "query-param",
		 *     limit: "pageSize",
		 *     skip: "page"
		 *   },
		 *   POST: {
		 *     type: "body",
		 *     root: "pagination",
		 *     limit: "limit",
		 *     skip: "offset"
		 *   }
		 * }
		 */
		pagination?: Partial<Record<"ALL" | "HEAD" | "GET" | "POST" | "DELETE", ApiWsRestFsPagination>> | null;

		/**
		 * Global filter configuration for file-based endpoints.
		 * Can be configured per HTTP method or for all methods.
		 * Only works with JSON files containing arrays.
		 * Not applicable for WebSocket requests.
		 *
		 * @example
		 * filters: {
		 *   ALL: {
		 *     type: "query-param",
		 *     filters: [
		 *       { key: "status", valueType: "string", comparison: "eq" },
		 *       { key: "age", valueType: "number", comparison: "gte" }
		 *     ]
		 *   }
		 * }
		 */
		filters?: Partial<Record<"ALL" | "HEAD" | "GET" | "POST" | "DELETE", ApiWsRestFsFilter>> | null;
	} | {
		disable?: boolean;
		logLevel?: LogLevel | "debug";
		gatewayTimeout?: number;
		delay?: number;
		endpointPrefix?: string | string[];
		fsDir?: string | null;
		/**
		 * Enable WebSocket support.
		 * When true, wsHandlers becomes required.
		 *
		 * @default false
		 */
		enableWs?: true;
		noHandledRestFsRequestsAction?: "404" | "forward";
		parser?: APiWsRestFsParser;
		handlerMiddlewares?: ApiRestFsMiddlewareFunction[];
		errorMiddlewares?: ApiRestFsErrorHandleFunction[];
		handlers?: ApiRestFsHandler[];
		/**
		 * WebSocket handler configurations (required when enableWs is true).
		 *
		 * @example
		 * wsHandlers: [
		 *   {
		 *     pattern: '/ws/chat',
		 *     defaultRoom: 'lobby',
		 *     heartbeat: 30000,
		 *     onConnect: (conn) => {
		 *       conn.send({ type: 'welcome' });
		 *     },
		 *     onMessage: (conn, msg) => {
		 *       if (msg.type === 'chat') {
		 *         conn.broadcast(msg, { includeSelf: false });
		 *       }
		 *     }
		 *   }
		 * ]
		 */
		wsHandlers?: ApiWsHandler[];
		pagination?: Partial<Record<"ALL" | "HEAD" | "GET" | "POST" | "DELETE", ApiWsRestFsPagination>> | null;
		filters?: Partial<Record<"ALL" | "HEAD" | "GET" | "POST" | "DELETE", ApiWsRestFsFilter>> | null;
	}

/** @internal */
export type ApiWsRestFsOptionsRequired = Omit<Required<ApiWsRestFsOptions>, "handlerMiddlewares" | "endpointPrefix"> & { endpointPrefix: string[], fullFsDir: string | null, config: ResolvedConfig, matcher: AntPathMatcher, middlewares: ApiRestFsMiddlewareFunction[] };

/** @internal */
export interface HandledRequestData {
    status: number | null,
	data: any | null;
    headers: {
        name: string;
		value: string | number | readonly string[];
	}[];
}

/** @internal */
export interface ApiWsRestFsDataResponse {
	status: number;
	data: any | null;
	readFile: boolean;
	isError: boolean;
	headers: { name: string, value: string | number | readonly string[] }[],
	error?: IApiWsRestFsError;
	req?: ApiWsRestFsRequest | IncomingMessage;
	errorMiddlewares?: ApiWsRestFsOptionsRequired["errorMiddlewares"];
}
