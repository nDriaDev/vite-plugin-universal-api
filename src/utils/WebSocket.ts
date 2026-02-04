import { Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { constants, createDeflateRaw, createInflateRaw } from 'node:zlib';
import { DeflateOptions, IConnectionManager, IWebSocketConnection, IWebSocketDeflate, IWebSocketFrameParser, PerMessageDeflateExension, WebSocketFrame } from 'src/models/webSocket.model';
import { ILogger } from 'src/models/logger.model';

export class WebSocketFrameParser implements IWebSocketFrameParser {
	private buffer: Buffer = Buffer.alloc(0);

	parse(data: Buffer): WebSocketFrame[] {
		this.buffer = Buffer.concat([this.buffer, data]);
		const frames: WebSocketFrame[] = [];

		while (this.buffer.length >= 2) {
			const firstByte = this.buffer[0];
			const secondByte = this.buffer[1];

			const fin = (firstByte & 0x80) !== 0;
			const rsv1 = (firstByte & 0x40) !== 0;
			const rsv2 = (firstByte & 0x20) !== 0;
			const rsv3 = (firstByte & 0x10) !== 0;
			const opcode = firstByte & 0x0f;
			const masked = (secondByte & 0x80) !== 0;
			let payloadLength = secondByte & 0x7f;
			let offset = 2;

			if (payloadLength === 126) {
				if (this.buffer.length < 4) break;
				payloadLength = this.buffer.readUInt16BE(2);
				offset = 4;
			} else if (payloadLength === 127) {
				if (this.buffer.length < 10) break;
				payloadLength = Number(this.buffer.readBigUInt64BE(2));
				offset = 10;
			}

			const frameLength = offset + (masked ? 4 : 0) + payloadLength;
			if (this.buffer.length < frameLength) break;

			let maskKey: Buffer | undefined;
			if (masked) {
				maskKey = this.buffer.subarray(offset, offset + 4);
				offset += 4;
			}

			let payload = this.buffer.subarray(offset, offset + payloadLength);

			if (masked && maskKey) {
				payload = Buffer.from(payload);
				for (let i = 0; i < payload.length; i++) {
					payload[i] ^= maskKey[i % 4];
				}
			}

			frames.push({ fin, rsv1, rsv2, rsv3, opcode, masked, payload, payloadLength });
			this.buffer = this.buffer.subarray(frameLength);
		}

		return frames;
	}
}

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

export class WebSocketDeflate implements IWebSocketDeflate {
	private deflate;
	private inflate;
	private resetDeflateContext;
	private reseteInflateContext;

	constructor(deflateOptions: DeflateOptions) {
		if (deflateOptions !== null) {
			this.deflate = createDeflateRaw({
				windowBits: deflateOptions.server_max_window_bits as number,
				level: constants.Z_DEFAULT_COMPRESSION,
				memLevel: 8
			});
			this.inflate = createInflateRaw({
				windowBits: deflateOptions.client_max_window_bits as number,
			});
			this.resetDeflateContext = deflateOptions.server_no_context_takeover as boolean || false;
			this.reseteInflateContext = deflateOptions.client_no_context_takeover as boolean || false;
		}
	}

	compressMessage(data: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            const onData = (chunk: Buffer) => {
                chunks.push(chunk);
            };

            const onError = (error: Error) => {
                cleanup();
                reject(error);
            };

            const cleanup = () => {
                this.deflate!.removeListener('data', onData);
                this.deflate!.removeListener('error', onError);
            };

            this.deflate!.on('data', onData);
            this.deflate!.once('error', onError);

            const flushCallback = (error?: Error | null) => {
                cleanup();

                if (error) {
                    reject(error);
                    return;
                }

                let compressed = Buffer.concat(chunks);

                if (compressed.length >= 4 &&
                    compressed[compressed.length - 4] === 0x00 &&
                    compressed[compressed.length - 3] === 0x00 &&
                    compressed[compressed.length - 2] === 0xFF &&
                    compressed[compressed.length - 1] === 0xFF) {
                    compressed = compressed.subarray(0, -4);
                }

                if (this.resetDeflateContext) {
                    this.deflate!.reset();
                }

                resolve(compressed);
            };

            this.deflate!.write(data);
            this.deflate!.flush(constants.Z_SYNC_FLUSH, flushCallback);
        });
	}

    decompressMessage(data: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            const onData = (chunk: Buffer) => {
                chunks.push(chunk);
            };

            const onError = (error: Error) => {
                cleanup();
                reject(error);
            };

            const cleanup = () => {
                this.inflate!.removeListener('data', onData);
                this.inflate!.removeListener('error', onError);
            };

            this.inflate!.on('data', onData);
            this.inflate!.once('error', onError);

            const flushCallback = (error?: Error | null) => {
                cleanup();

                if (error) {
                    reject(error);
                    return;
                }

                const decompressed = Buffer.concat(chunks);

                if (this.reseteInflateContext) {
                    this.inflate!.reset();
                }

                resolve(decompressed);
            };

            const tail = Buffer.from([0x00, 0x00, 0xFF, 0xFF]);
            const dataWithTail = Buffer.concat([data, tail]);

            this.inflate!.write(dataWithTail);
            this.inflate!.flush(constants.Z_SYNC_FLUSH, flushCallback);
        });
    }

    destroy(): void {
        this.deflate!.removeAllListeners();
        this.inflate!.removeAllListeners();
        this.deflate!.destroy();
        this.inflate!.destroy();
    }
}

export class WebSocketConnection implements IWebSocketConnection {
	private socket: Socket;
	private manager: ConnectionManager;
	private _closed = false;
	private fragmentBuffer: Buffer[] = [];
	private fragmentOpcode: number | null = null;
	private writeQueue: { data: Buffer; resolve: () => void; reject: (err: Error) => void }[] = [];
	private writing = false;
	private missedPongs = 0;
	private readonly MAX_MISSED_PONGS = 3;
	private heartbeatInterval?: NodeJS.Timeout;
	private inactivityTimer?: NodeJS.Timeout;
	private webSocketDeflate;
	private logger: ILogger;

	public path: string;
	public id: string;
	public metadata: Record<string, any> = {};
	public rooms: Set<string> = new Set();
	public subprotocol?: string;
	public perMessageDeflate?: PerMessageDeflateExension;
	public cleanup?: () => void;

	constructor(
		logger: ILogger,
		socket: Socket,
		path: string,
		manager: ConnectionManager,
		deflateOptions: DeflateOptions | null,
		perMessageDeflate?: PerMessageDeflateExension,
		subprotocol?: string
	) {
		this.logger = logger;
		this.socket = socket;
		this.path = path;
		this.manager = manager;
		this.id = randomUUID();
		this.subprotocol = subprotocol;

		if (perMessageDeflate) {
			this.perMessageDeflate = perMessageDeflate;
			if (deflateOptions !== null) {
				this.webSocketDeflate = new WebSocketDeflate(deflateOptions);
			}
		}
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
					this.close(1000, "No pong received", false);
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
				this.close(1000, 'Inactivity timeout', false);
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
		if (this._closed) return Promise.resolve();

		const payload = typeof data === 'string' ? data : JSON.stringify(data);
		let payloadBuffer = Buffer.from(payload, 'utf8');
		let rsv1 = false;

		if (this.perMessageDeflate) {
			payloadBuffer = Buffer.from(await this.webSocketDeflate!.compressMessage(payloadBuffer));
			rsv1 = true;
		}

		const frame = this.createFrame(payloadBuffer, 0x01, rsv1); // 0x01 = text frame
		return this.enqueueWrite(frame);
	}

    broadcast(data: any, options?: { room?: string; includeSelf?: boolean }): void {
        const room = options?.room;
        const includeSelf = options?.includeSelf ?? false;

        this.manager.broadcast(data, {
            room,
            excludeId: includeSelf ? undefined : this.id
        });
    }

    broadcastAllRooms(data: any, includeSelf = false): void {
        if (this.rooms.size === 0) {
            this.manager.broadcast(data, {
                excludeId: includeSelf ? undefined : this.id
            });
        } else {
            this.rooms.forEach(room => {
                this.manager.broadcast(data, {
                    room,
                    excludeId: includeSelf ? undefined : this.id
                });
            });
        }
    }

	private enqueueWrite(frame: Buffer): Promise<void> {
		return new Promise((resolve, reject) => {
			this.writeQueue.push({ data: frame, resolve, reject });
			this.processWriteQueue();
		});
	}

	private processWriteQueue() {
		if (this.writing || this.writeQueue.length === 0) return;

		this.writing = true;
		const { data, resolve, reject } = this.writeQueue.shift()!;

		const writeSuccessful = this.socket.write(data, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});

		if (!writeSuccessful) {
			this.socket.once('drain', () => {
				this.writing = false;
				this.processWriteQueue();
			});
		} else {
			this.writing = false;
			this.processWriteQueue();
		}
	}

	accumulateFragment(frame: WebSocketFrame): { payload: Buffer, opcode: number } | null {
		if (frame.opcode === 0x00 && this.fragmentOpcode === null) {
			throw new Error('Continuation frame without initial frame');
		}

		if (frame.opcode !== 0x00) {
			this.fragmentBuffer = [frame.payload];
			this.fragmentOpcode = frame.opcode;

			if (frame.fin) {
				const payload = Buffer.concat(this.fragmentBuffer);
				const opcode = this.fragmentOpcode;
				this.fragmentBuffer = [];
				this.fragmentOpcode = null;
				return { payload, opcode };
			}
			return null;
		}

		this.fragmentBuffer.push(frame.payload);

		if (frame.fin) {
			const payload = Buffer.concat(this.fragmentBuffer);
			const opcode = this.fragmentOpcode!;
			this.fragmentBuffer = [];
			this.fragmentOpcode = null;
			return { payload, opcode };

		}

		return null;
	}

	decompressData(data: Buffer): ReturnType<IWebSocketDeflate["compressMessage"]> {
		if (this.webSocketDeflate) {
			return this.webSocketDeflate!.decompressMessage(data);
		}
		return Promise.resolve(data);
	}

	ping(payload?: string | Buffer) {
		if (this._closed) return;

		const payloadBuffer = typeof payload === 'string'
			? Buffer.from(payload, 'utf8')
			: (payload || Buffer.alloc(0));

		const pingFrame = this.createControlFrame(0x09, payloadBuffer);

		this.socket.write(pingFrame, (err: any) => {
			if (err) {
				this.logger.error('[WebSocket] Error sending ping:', err);
			}
		});
	}

	pong(payload?: string | Buffer) {
		if (this._closed) return;

		const payloadBuffer = typeof payload === 'string'
			? Buffer.from(payload, 'utf8')
			: (payload || Buffer.alloc(0));

		const pongFrame = this.createControlFrame(0x0A, payloadBuffer);

		this.socket.write(pongFrame, (err: any) => {
			if (err) {
				this.logger.error('[WebSocket] Error sending pong:', err);
			}
		});
	}

	close(code = 1000, reason = '', initiatedByClient = false): Promise<void> {
		if (this._closed) return Promise.resolve();
		this._closed = true;

		this.stopHeartbeat();
		this.stopInactivityTimeout();

		return new Promise((resolve) => {
			const frame = this.createCloseFrame(code, reason);
			if (initiatedByClient) {
				this.socket.write(frame, (err: any) => {
					if (err) {
						this.logger.error('[WebSocket] Error sending close frame:', err);
					}
					this.cleanup && this.cleanup();
					this.socket.end();
					this.manager.remove(this.id);
					this.webSocketDeflate?.destroy();
					resolve();
				});
			} else {
				//INFO if no response from client force closing
				const closeTimeout = setTimeout(() => {
					this.cleanup && this.cleanup();
					this.socket.destroy();
					this.manager.remove(this.id);
					this.webSocketDeflate?.destroy();
					resolve();
				}, 2000); // INFO Standard RFC 6455 suggests 1-3 seconds

				this.socket.write(frame, (err: any) => {
					if (err) {
						this.logger.error('[WebSocket] Error sending close frame:', err);
						clearTimeout(closeTimeout);
						this.cleanup && this.cleanup();
						this.socket.destroy();
						this.manager.remove(this.id);
						this.webSocketDeflate?.destroy();
						resolve();
					} else {
						setTimeout(() => {
							clearTimeout(closeTimeout);
							this.cleanup && this.cleanup();
							this.socket.end();
							this.manager.remove(this.id);
							this.webSocketDeflate?.destroy();
							resolve();
						}, 100);
					}
				});
			}
		});
	}

	forceClose() {
		this._closed = true;
		this.stopHeartbeat();
		this.stopInactivityTimeout();
		this.cleanup && this.cleanup();
		this.socket.destroy();
		this.webSocketDeflate?.destroy();
	}

	private createFrame(payload: Buffer, opcode: number, rsv1 = false): Buffer {
		const payloadLength = payload.length;
		let frame: Buffer;
		let offset = 2;

		if (payloadLength < 126) {
			frame = Buffer.alloc(2 + payloadLength);
			frame[1] = payloadLength;
		} else if (payloadLength < 65536) {
			frame = Buffer.alloc(4 + payloadLength);
			frame[1] = 126;
			frame.writeUInt16BE(payloadLength, 2);
			offset = 4;
		} else {
			frame = Buffer.alloc(10 + payloadLength);
			frame[1] = 127;
			frame.writeBigUInt64BE(BigInt(payloadLength), 2);
			offset = 10;
		}

		frame[0] = 0x80 | opcode | (rsv1 ? 0x40 : 0x00);
		payload.copy(frame, offset);

		return frame;
	}

	private createCloseFrame(code: number, reason: string): Buffer {
		const reasonBuffer = Buffer.from(reason, 'utf8');
		const payloadLength = 2 + reasonBuffer.length;
		const frame = Buffer.alloc(2 + payloadLength);

		frame[0] = 0x88;
		frame[1] = payloadLength;
		frame.writeUInt16BE(code, 2);
		reasonBuffer.copy(frame, 4);

		return frame;
	}

	private createControlFrame(opcode: number, payload: Buffer): Buffer {
		if (payload.length > 125) {
			throw new Error('Control frame payload must be <= 125 bytes');
		}

		const frame = Buffer.alloc(2 + payload.length);
		frame[0] = 0x80 | opcode;
		frame[1] = payload.length;
		payload.copy(frame, 2);

		return frame;
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
