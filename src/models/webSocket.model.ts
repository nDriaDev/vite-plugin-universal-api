/**
 * Options for the permessage-deflate extension negotiation.
 * Based on RFC 7692 parameters.
 *
 * @internal
 */
export interface DeflateOptions {
    /** Whether the server prevents context takeover (reset context after each message) */
    server_no_context_takeover?: boolean;
    /** Whether the client prevents context takeover */
    client_no_context_takeover?: boolean;
    /** The maximum size of the server's LZ77 sliding window (logarithm base 2) */
    server_max_window_bits?: number;
    /** The maximum size of the client's LZ77 sliding window (logarithm base 2) */
    client_max_window_bits?: number;
}

/**
 * Represents a decoded WebSocket frame according to RFC 6455.
 *
 * @internal
 */
export interface WebSocketFrame {
    /** Final fragment flag */
    fin: boolean;
    /** Reserved bit 1 (often used for compression) */
    rsv1: boolean;
    /** Reserved bit 2 */
    rsv2: boolean;
    /** Reserved bit 3 */
    rsv3: boolean;
    /** Operation code (e.g., 0x1 for text, 0x2 for binary, 0x8 for close) */
    opcode: number;
    /** Whether the payload is XOR-masked (required for client-to-server) */
    masked: boolean;
    /** The raw payload data */
    payload: Buffer;
    /** Length of the payload in bytes */
    payloadLength: number;
}

/**
 * Handles binary stream parsing to extract complete WebSocket frames.
 *
 * @internal
 */
export interface IWebSocketFrameParser {
    /**
     * Parses an incoming chunk of data and returns an array of complete frames.
     * Buffers partial data until a full frame is available.
     */
    parse(data: Buffer): WebSocketFrame[];
}

/**
 * Manages the lifecycle and grouping of all active WebSocket connections.
 *
 * @internal
 */
export interface IConnectionManager {
    /** Registers a new connection */
    add(connection: IWebSocketConnection): void;
    /** Unregisters a connection by its ID */
    remove(connectionId: string): void;
    /** Retrieves a connection by its ID */
    get(connectionId: string): IWebSocketConnection | undefined;
    /** Returns all currently active connections */
    getAll(): IWebSocketConnection[];
    /** Returns connections belonging to a specific room */
    getByRoom(room: string): IWebSocketConnection[];
    /**
     * Sends a message to multiple connections based on filtering options.
     * @param data The payload to broadcast
     * @param options Filtering criteria like room or excluding a specific sender
     */
    broadcast(data: any, options?: { excludeId?: string; room?: string }): void;
}

/**
 * Handles message compression and decompression using the zlib deflate/inflate algorithms.
 * Implements the permessage-deflate WebSocket extension logic.
 *
 * @internal
 */
export interface IWebSocketDeflate {
    /**
     * Compresses a raw buffer using Deflate.
     * Removes the 0x00 0x00 0xFF 0xFF tail as required by the WebSocket spec.
     *
     * @param data The raw buffer to compress
     * @returns A promise that resolves to the compressed Buffer
     */
    compressMessage(data: Buffer): Promise<Buffer>;

    /**
     * Decompresses a compressed buffer using Inflate.
     * Appends the 0x00 0x00 0xFF 0xFF tail before processing to ensure correct decompression.
     *
     * @param data The compressed buffer received from the socket
     * @returns A promise that resolves to the decompressed Buffer
     */
    decompressMessage(data: Buffer): Promise<Buffer>;

    /**
     * Cleans up zlib resources and removes all event listeners.
     * Should be called when the connection is closed to prevent memory leaks.
     */
    destroy(): void;
}

/**
 * permessage-deflate extension configuration.
 */
export type PerMessageDeflateExension =
    | false
    | true
    | {
        /**
         * Disable compression context takeover on the client side.
         */
        clientNoContextTakeover?: boolean

        /**
         * Disable compression context takeover on the server side.
         */
        serverNoContextTakeover?: boolean

        /**
         * Maximum LZ77 window size for the client (8–15).
         */
        clientMaxWindowBits?: 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

        /**
         * Maximum LZ77 window size for the server (8–15).
         */
        serverMaxWindowBits?: 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

        /**
         * Fail the WebSocket handshake if parameters
         * cannot be negotiated with the client.
         *
         * Default: false
         */
        strict?: boolean
    }

/**
 * Interface representing a WebSocket connection with methods for communication and lifecycle management.
 *
 * @example
 * // Send a message to a specific client
 * connection.send({ type: 'notification', message: 'Hello!' });
 *
 * @example
 * // Join a room for targeted broadcasts
 * connection.joinRoom('game-lobby');
 *
 * @example
 * // Close connection gracefully
 * await connection.close(1000, 'Normal closure');
 */
export interface IWebSocketConnection {
	/**
	 * Unique identifier for this WebSocket connection.
	 * Generated automatically using UUID v4.
	 *
	 * @example
	 * console.log(`Client connected: ${connection.id}`);
	 * // Output: "Client connected: 550e8400-e29b-41d4-a716-446655440000"
	 */
	readonly id: string;

	/**
	 * The URL path where this WebSocket connection was established.
	 *
	 * @example
	 * if (connection.path === '/ws/chat') {
	 *   console.log('Chat connection established');
	 * }
	 */
	readonly path: string;

	/**
	 * Indicates whether the connection has been closed.
	 * Once true, no further messages can be sent.
	 *
	 * @example
	 * if (!connection.closed) {
	 *   await connection.send({ type: 'update' });
	 * }
	 */
	readonly closed: boolean;

	/**
	 * Custom metadata object for storing connection-specific data.
	 * Can be used to store user information, session data, etc.
	 *
	 * @example
	 * connection.metadata.userId = 123;
	 * connection.metadata.username = 'john_doe';
	 * connection.metadata.permissions = ['read', 'write'];
	 */
	metadata: Record<string, any>;

	/**
	 * Set of room names this connection has joined.
	 * Used for targeted broadcasts to specific groups of clients.
	 *
	 * @example
	 * // A user can be in multiple rooms simultaneously
	 * connection.joinRoom('lobby');
	 * connection.joinRoom('game-123');
	 * connection.joinRoom('chat-general');
	 */
	rooms: Set<string>;

	/**
	 * The negotiated subprotocol for this connection, if any.
	 * Selected during the WebSocket handshake from the client's requested protocols.
	 *
	 * @example
	 * if (connection.subprotocol === 'chat.v1') {
	 *   // Handle chat protocol v1
	 * }
	 */
	subprotocol?: string;

	/**
	 * Compression negotiated for this connection.
	 *
	 * @example
	 * if (connection.perMessageDeflate) {
	 *   console.log('Compression enabled');
	 * }
	 */
	perMessageDeflate?: PerMessageDeflateExension;

	/**
	 * Optional cleanup callback to remove socket event listeners.
	 *
	 * This callback is set during connection initialization and is responsible for
	 * removing all event listeners attached to the underlying socket to prevent
	 * memory leaks. It is automatically invoked when the connection is closed.
	 *
	 * @type {(() => void) | undefined}
	 *
	 * @example
	 * ```typescript
	 * // In handlingApiWsRequest - after creating the connection:
	 * connection.cleanup = () => {
	 *   socket.removeListener('data', onDataSocket);
	 *   socket.removeListener('close', onCloseSocket);
	 *   socket.removeListener('error', onErrorSocket);
	 * };
	 * ```
	 *
	 * @remarks
	 * The cleanup callback is invoked in:
	 * - {@link close} - When closing the connection normally
	 * - {@link forceClose} - When forcefully terminating the connection
	 *
	 * This property is set externally by the connection handler and should not
	 * be modified after initialization.
	 */
	cleanup?: () => void;

	/**
	 * Resets the missed pong counter to zero.
	 *
	 * This method should be called when a PONG frame is received from the client,
	 * indicating that the connection is still alive. It prevents the connection
	 * from being closed due to inactivity when heartbeat is enabled.
	 *
	 * @example
	 * ```typescript
	 * // When PONG frame is received
	 * if (frame.opcode === 0x0A) {
	 *   connection.resetMissedPong();
	 * }
	 * ```
	 *
	 * @see {@link startHeartbeat} for heartbeat initialization
	 */
	resetMissedPong(): void;

	/**
	 * Start sending periodic ping frames to the client.
	 * Useful for keeping the connection alive and detecting disconnections.
	 *
	 * @param intervalMs - Interval in milliseconds between ping frames
	 *
	 * @example
	 * // Send ping every 30 seconds
	 * connection.startHeartbeat(30000);
	 */
	startHeartbeat(intervalMs: number): void;

	/**
	 * Stop the heartbeat mechanism.
	 *
	 * @example
	 * connection.stopHeartbeat();
	 */
	stopHeartbeat(): void;

	/**
	 * Start a timer that closes the connection if no activity is detected.
	 * Activity includes receiving any frame from the client.
	 *
	 * @param timeoutMs - Timeout in milliseconds
	 *
	 * @example
	 * // Close connection after 5 minutes of inactivity
	 * connection.startInactivityTimeout(300000);
	 */
	startInactivityTimeout(timeoutMs: number): void;

	/**
	 * Reset the inactivity timer.
	 * Automatically called when any frame is received from the client.
	 *
	 * @param timeoutMs - New timeout value in milliseconds
	 *
	 * @example
	 * // Extend timeout after important action
	 * connection.resetInactivityTimer(600000); // 10 minutes
	 */
	resetInactivityTimer(timeoutMs: number): void;

	/**
	 * Stop the inactivity timeout mechanism.
	 *
	 * @example
	 * connection.stopInactivityTimeout();
	 */
	stopInactivityTimeout(): void;

	/**
	 * Send data to the client.
	 * Data is automatically serialized to JSON if it's an object.
	 * Supports compression if permessage-deflate extension is negotiated.
	 *
	 * @param data - Data to send (object, string, or any JSON-serializable value)
	 * @returns Promise that resolves when the data has been written to the socket
	 *
	 * @example
	 * // Send object (automatically serialized to JSON)
	 * await connection.send({ type: 'message', text: 'Hello!' });
	 *
	 * @example
	 * // Send string
	 * await connection.send('Simple text message');
	 *
	 * @example
	 * // Handle errors
	 * try {
	 *   await connection.send({ data: 'important' });
	 * } catch (error) {
	 *   console.error('Failed to send:', error);
	 * }
	 */
	send(data: any): Promise<void>;

	/**
	 * Broadcasts a message to all connections in a specific room or to all connections.
	 *
	 * This method sends a message to multiple WebSocket connections simultaneously.
	 * The current connection can optionally be included or excluded from the broadcast.
	 *
	 * @param {any} data - The data to broadcast. Can be a string, object, or any JSON-serializable value.
	 *                     Objects will be automatically stringified to JSON.
	 * @param {Object} [options] - Optional broadcast configuration
	 * @param {string} [options.room] - The room name to broadcast to. If not specified, broadcasts to all connections.
	 * @param {boolean} [options.includeSelf=false] - Whether to include the current connection in the broadcast.
	 *                                                 Defaults to false (excludes sender).
	 *
	 * @returns {void}
	 *
	 * @example
	 * // Broadcast to a specific room (excluding sender)
	 * connection.broadcast({ type: 'notification', text: 'New message!' }, {
	 *   room: 'chat-room-1'
	 * });
	 *
	 * @example
	 * // Broadcast to a specific room (including sender)
	 * connection.broadcast({ type: 'update', data: updatedData }, {
	 *   room: 'game-lobby',
	 *   includeSelf: true
	 * });
	 *
	 * @example
	 * // Broadcast to all connections (excluding sender)
	 * connection.broadcast({ type: 'server-announcement', message: 'Maintenance in 5 minutes' });
	 */
	broadcast(data: any, options?: { room?: string; includeSelf?: boolean }): void;

	/**
	 * Broadcasts a message to all connections in all rooms that this connection is a member of.
	 *
	 * If the connection is not in any rooms, the message is broadcast to all connections globally.
	 * This is useful for scenarios where a user action should notify all their active contexts.
	 *
	 * @param {any} data - The data to broadcast. Can be a string, object, or any JSON-serializable value.
	 *                     Objects will be automatically stringified to JSON.
	 * @param {boolean} [includeSelf=false] - Whether to include the current connection in the broadcast.
	 *                                         Defaults to false (excludes sender).
	 *
	 * @returns {void}
	 *
	 * @example
	 * // User updates their profile - notify all their active sessions
	 * connection.broadcastAllRooms({
	 *   type: 'profile-updated',
	 *   userId: user.id,
	 *   newData: profileData
	 * });
	 *
	 * @example
	 * // Send to all rooms including the sender
	 * connection.broadcastAllRooms({
	 *   type: 'global-event',
	 *   message: 'System update complete'
	 * }, true);
	 *
	 * @example
	 * // Connection not in any rooms - broadcasts globally
	 * // (connection.rooms.size === 0)
	 * connection.broadcastAllRooms({
	 *   type: 'announcement',
	 *   text: 'Welcome to the server!'
	 * });
	 */
	broadcastAllRooms(data: any, includeSelf: boolean): void;

	/**
	 * Send a ping frame to the client.
	 * The client should respond with a pong frame.
	 *
	 * @param payload - Optional payload to include in the ping frame
	 *
	 * @example
	 * // Simple ping
	 * connection.ping();
	 *
	 * @example
	 * // Ping with timestamp for latency measurement
	 * connection.ping(Date.now().toString());
	 */
	ping(payload?: string | Buffer): void;

	/**
	 * Send a pong frame to the client.
	 * Typically sent in response to a ping frame.
	 *
	 * @param payload - Optional payload to include in the pong frame
	 *
	 * @example
	 * // Respond to ping with same payload
	 * onPing: (connection, data) => {
	 *   connection.pong(data);
	 * }
	 */
	pong(payload?: string | Buffer): void;

	/**
	 * Accumulate fragmented WebSocket message frames.
	 * Returns the complete payload with its opcode when all fragments are received.
	 *
	 * @param frame - WebSocket frame to process
	 * @returns Object with complete payload and original opcode, or null if fragmentation incomplete
	 * @internal
	 */
	accumulateFragment(frame: WebSocketFrame): { payload: Buffer; opcode: number } | null;

	/**
	 * Decompresses the provided buffer if the permessage-deflate extension is active.
	 *
	 * If compression is enabled for this connection, it uses the deflate engine to
	 * decompress the data; otherwise, it returns the original buffer wrapped in a Promise.
	 *
	 * @param data - The raw compressed or uncompressed Buffer received from the socket.
	 * @returns A Promise resolving to the decompressed Buffer.
	 *
	 * @throws {Error} If decompression fails in the underlying deflate engine.
	 */
	decompressData(data: Buffer): ReturnType<IWebSocketDeflate["decompressMessage"]>;

	/**
	 * Close the WebSocket connection gracefully.
	 * Sends a close frame to the client and waits for acknowledgment.
	 *
	 * @param code - WebSocket close status code (default: 1000 for normal closure)
	 * @param reason - Human-readable reason for closing (default: empty string)
	 * @param initiatedByClient - Whether the close was initiated by the client
	 * @returns Promise that resolves when the connection is fully closed
	 *
	 * @example
	 * // Normal closure
	 * await connection.close();
	 *
	 * @example
	 * // Close with custom code and reason
	 * await connection.close(1008, 'Policy violation');
	 *
	 * @example
	 * // Close initiated by client (in onClose handler)
	 * await connection.close(1000, '', true);
	 */
	close(code?: number, reason?: string, initiatedByClient?: boolean): Promise<void>;

	/**
	 * Forcefully close the connection immediately without sending a close frame.
	 * Use only when graceful closure is not possible (e.g., socket errors).
	 *
	 * @example
	 * // Force close on error
	 * socket.on('error', () => {
	 *   connection.forceClose();
	 * });
	 */
	forceClose(): void;

	/**
	 * Add this connection to a room for targeted broadcasts.
	 * A connection can be in multiple rooms simultaneously.
	 *
	 * @param room - Room name to join
	 *
	 * @example
	 * // Join multiple rooms
	 * connection.joinRoom('lobby');
	 * connection.joinRoom('game-123');
	 * connection.joinRoom('notifications');
	 */
	joinRoom(room: string): void;

	/**
	 * Remove this connection from a room.
	 *
	 * @param room - Room name to leave
	 *
	 * @example
	 * connection.leaveRoom('game-123');
	 */
	leaveRoom(room: string): void;

	/**
	 * Check if this connection is in a specific room.
	 *
	 * @param room - Room name to check
	 * @returns True if the connection is in the room, false otherwise
	 *
	 * @example
	 * if (connection.isInRoom('admin')) {
	 *   // Send admin-only message
	 * }
	 */
	isInRoom(room: string): boolean;

	/**
	 * Get all rooms this connection has joined.
	 *
	 * @returns Array of room names
	 *
	 * @example
	 * const rooms = connection.getRooms();
	 * console.log(`User is in: ${rooms.join(', ')}`);
	 * // Output: "User is in: lobby, game-123, chat"
	 */
	getRooms(): string[];
}
