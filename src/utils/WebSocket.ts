import { WebSocket as WsWebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { IConnectionManager, IWebSocketConnection } from '../models/webSocket.model';
import { ILogger } from '../models/logger.model';

export { WebSocketServer };

export class ConnectionManager implements IConnectionManager {
	private connections: Map<string, WebSocketConnection> = new Map();
	private logger: ILogger;

	constructor(logger: ILogger) {
		this.logger = logger;
	}

	add(connection: WebSocketConnection) {
		this.connections.set(connection.id, connection);
	}

	remove(connectionId: string) {
		this.connections.delete(connectionId);
	}

	get(connectionId: string) {
		return this.connections.get(connectionId);
	}

	getAll(): WebSocketConnection[] {
		return Array.from(this.connections.values());
	}

	getByRoom(room: string): WebSocketConnection[] {
		return this.getAll().filter(conn => conn.isInRoom(room));
	}

	broadcast(data: any, options?: { excludeId?: string; room?: string }) {
		let connections = this.getAll();
		if (options?.room) connections = connections.filter(c => c.isInRoom(options.room!));
		connections.forEach(c => {
			if (c.id !== options?.excludeId && !c.closed) {
				c.send(data).catch(err => this.logger.error('[WebSocket] Broadcast error:', err));
			}
		});
	}
}

export class WebSocketConnection implements IWebSocketConnection {
	private ws: WsWebSocket;
	private manager: ConnectionManager;
	private _closed = false;
	private missedPongs = 0;
	private readonly MAX_MISSED_PONGS = 3;
	private heartbeatInterval?: NodeJS.Timeout;
	private inactivityTimer?: NodeJS.Timeout;
	private logger: ILogger;

	public path: string;
	public id: string;
	public metadata: Record<string, any> = {};
	public rooms: Set<string> = new Set();
	public subprotocol?: string;

	constructor(logger: ILogger, ws: WsWebSocket, path: string, manager: ConnectionManager, subprotocol?: string) {
		this.logger = logger;
		this.ws = ws;
		this.path = path;
		this.manager = manager;
		this.id = randomUUID();
		this.subprotocol = subprotocol;
		this.manager.add(this);
	}

	resetMissedPong() {
		this.missedPongs = 0;
	}

	startHeartbeat(intervalMs: number) {
		this.heartbeatInterval = setInterval(() => {
			if (!this._closed) {
				this.missedPongs++;
				if (this.missedPongs >= this.MAX_MISSED_PONGS) {
					this.close(1000, 'No pong received');
					return;
				}
				this.ping('heartbeat');
			}
		}, intervalMs);
	}

	stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = undefined;
		}
	}

	startInactivityTimeout(timeoutMs: number) {
		this.resetInactivityTimer(timeoutMs);
	}

	resetInactivityTimer(timeoutMs: number) {
		if (this.inactivityTimer) {
			clearTimeout(this.inactivityTimer);
		}
		this.inactivityTimer = setTimeout(() => {
			if (!this._closed) {
				this.logger.debug(`[WebSocket] Connection ${this.id} timed out due to inactivity`);
				this.close(1000, 'Inactivity timeout');
			}
		}, timeoutMs);
	}

	stopInactivityTimeout() {
		if (this.inactivityTimer) {
			clearTimeout(this.inactivityTimer);
			this.inactivityTimer = undefined;
		}
	}

	async send(data: any): Promise<void> {
		if (this._closed || this.ws.readyState !== WsWebSocket.OPEN) {
			return;
		}
		const payload = typeof data === 'string' ? data : JSON.stringify(data);
		return new Promise((resolve, reject) => {
			this.ws.send(payload, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	broadcast(data: any, options?: { room?: string; includeSelf?: boolean }): void {
		this.manager.broadcast(data, {
			room: options?.room,
			excludeId: options?.includeSelf ? undefined : this.id
		});
	}

	broadcastAllRooms(data: any, includeSelf = false): void {
		if (this.rooms.size === 0) {
			this.manager.broadcast(data, { excludeId: includeSelf ? undefined : this.id });
		} else {
			this.rooms.forEach(room => {
				this.manager.broadcast(data, { room, excludeId: includeSelf ? undefined : this.id });
			});
		}
	}

	ping(payload?: string | Buffer) {
		if (this._closed){
			return;
		}
		this.ws.ping(payload);
	}

	pong(payload?: string | Buffer) {
		if (this._closed){
			return;
		}
		this.ws.pong(payload);
	}

	/**
	 * INFO
	 * Mark the connection as closed without sending a close frame.
	 * Called internally when the client initiates the close (ws 'close' event).
	 * @internal
	 */
	markClosed() {
		this._closed = true;
		this.stopHeartbeat();
		this.stopInactivityTimeout();
	}

	close(code = 1000, reason = ''): Promise<void> {
		if (this._closed) {
			return Promise.resolve();
		}
		this._closed = true;
		this.stopHeartbeat();
		this.stopInactivityTimeout();
		this.manager.remove(this.id);
		return new Promise((resolve) => {
			// INFO Resolve once the underlying socket fully closes after the handshake
			this.ws.once('close', () => resolve());
			this.ws.close(code, reason);
		});
	}

	forceClose() {
		if (this._closed) {
			return;
		}
		this._closed = true;
		this.stopHeartbeat();
		this.stopInactivityTimeout();
		this.manager.remove(this.id);
		this.ws.terminate();
	}

	joinRoom(room: string) {
		this.rooms.add(room);
	}

	leaveRoom(room: string) {
		this.rooms.delete(room);
	}

	isInRoom(room: string) {
		return this.rooms.has(room);
	}

	getRooms(): string[] {
		return Array.from(this.rooms);
	}

	get closed() {
		return this._closed;
	}
}
