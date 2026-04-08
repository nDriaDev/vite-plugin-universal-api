/**
 * permessage-deflate extension configuration.
 * Passed directly to the underlying `ws` WebSocketServer.
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
	 */
	readonly id: string;

	/**
	 * The URL path where this WebSocket connection was established.
	 */
	readonly path: string;

	/**
	 * Indicates whether the connection has been closed.
	 * Once true, no further messages can be sent.
	 */
	readonly closed: boolean;

	/**
	 * Custom metadata object for storing connection-specific data.
	 */
	metadata: Record<string, any>;

	/**
	 * Set of room names this connection has joined.
	 */
	rooms: Set<string>;

	/**
	 * The negotiated subprotocol for this connection, if any.
	 */
	subprotocol?: string;

	/**
	 * Resets the missed pong counter to zero.
	 * Should be called when a PONG frame is received.
	 */
	resetMissedPong(): void;

	/**
	 * Start sending periodic ping frames to the client.
	 * @param intervalMs - Interval in milliseconds between ping frames
	 */
	startHeartbeat(intervalMs: number): void;

	/**
	 * Stop the heartbeat mechanism.
	 */
	stopHeartbeat(): void;

	/**
	 * Start a timer that closes the connection if no activity is detected.
	 * @param timeoutMs - Timeout in milliseconds
	 */
	startInactivityTimeout(timeoutMs: number): void;

	/**
	 * Reset the inactivity timer.
	 * @param timeoutMs - New timeout value in milliseconds
	 */
	resetInactivityTimer(timeoutMs: number): void;

	/**
	 * Stop the inactivity timeout mechanism.
	 */
	stopInactivityTimeout(): void;

	/**
	 * Send data to the client.
	 * Data is automatically serialized to JSON if it's an object.
	 *
	 * @param data - Data to send (object, string, or any JSON-serializable value)
	 * @returns Promise that resolves when the data has been written to the socket
	 */
	send(data: any): Promise<void>;

	/**
	 * Broadcasts a message to all connections in a specific room or to all connections.
	 *
	 * @param data - The data to broadcast
	 * @param options - Optional broadcast configuration
	 */
	broadcast(data: any, options?: { room?: string; includeSelf?: boolean }): void;

	/**
	 * Broadcasts a message to all connections in all rooms that this connection is a member of.
	 * If not in any rooms, broadcasts globally.
	 *
	 * @param data - The data to broadcast
	 * @param includeSelf - Whether to include the current connection
	 */
	broadcastAllRooms(data: any, includeSelf?: boolean): void;

	/**
	 * Send a ping frame to the client.
	 * @param payload - Optional payload to include in the ping frame
	 */
	ping(payload?: string | Buffer): void;

	/**
	 * Send a pong frame to the client.
	 * @param payload - Optional payload to include in the pong frame
	 */
	pong(payload?: string | Buffer): void;

	/**
	 * Close the WebSocket connection gracefully.
	 * Sends a close frame to the client.
	 *
	 * @param code - WebSocket close status code (default: 1000)
	 * @param reason - Human-readable reason for closing
	 */
	close(code?: number, reason?: string): Promise<void>;

	/**
	 * Forcefully terminate the connection immediately.
	 * Use only when graceful closure is not possible.
	 */
	forceClose(): void;

	/**
	 * Add this connection to a room for targeted broadcasts.
	 * @param room - Room name to join
	 */
	joinRoom(room: string): void;

	/**
	 * Remove this connection from a room.
	 * @param room - Room name to leave
	 */
	leaveRoom(room: string): void;

	/**
	 * Check if this connection is in a specific room.
	 * @param room - Room name to check
	 */
	isInRoom(room: string): boolean;

	/**
	 * Get all rooms this connection has joined.
	 * @returns Array of room names
	 */
	getRooms(): string[];
}
