import { PreviewServer, ResolvedConfig, ViteDevServer } from "vite";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UniversalApiOptions, UniversalApiOptionsRequired, UniversalApiRequest } from "./models/index.model";
import path from "node:path";
import { mkdirp } from 'mkdirp';
import * as fs from 'node:fs';
import { rimraf } from 'rimraf';
import { Constants } from "./utils/constants";
import { EventEmitter, PassThrough } from "node:stream";
import { UniversalApiError } from "./utils/Error";
import { Utils } from "./utils/utils";
import { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { URLSearchParams } from "node:url";
import { ConnectionManager, WebSocketConnection, WebSocketDeflate, WebSocketFrameParser } from "./utils/WebSocket";
import { Socket } from "node:net";
import { IWebSocketConnection, PerMessageDeflateExension, WebSocketFrame } from "./models/webSocket.model";
import { runWsPlugin } from "./utils/plugin";

const ENDPOINT_PREFIX = "/api";
const MOCK_DIR = {
	NAME: "mock_dir",
	PATH: path.join(process.cwd(), "mock_dir")
}
const CONF = {
	root: process.cwd(),
	server: {
		https: false
	}
} as unknown as ResolvedConfig;
const mocks = vi.hoisted(() => ({
	readStream: {
		shouldFail: false,
		original: null as any
	},
	readStreamPipe: {
		shouldFail: false,
		original: null as any
	},
	parse: {
		shouldFail: false,
		shouldFailAt: 0,
		counter: 0,
		original: null as any
	},
	utils: {
		files: {
			writingFile: {
				shouldFail: false,
				original: null as any
			}
		},
		request: {
			addSlash: {
				shouldFail: false,
				original: null as any
			},
			applyPaginationAndFilters: {
				shouldFail: false,
				original: null as any
			},
			createRequest: {
				shouldFail: false,
				original: null as any
			},
			getCleanBody: {
				shouldFail: false,
				original: null as any
			},
			getPaginationAndFilters: {
				shouldFail: false,
				original: null as any,
				returnValue: null as any
			},
			MiddlewaresChain: {
				shouldFail: false,
				original: null as any
			},
			MiddlewaresChainUse: {
				shouldFail: false,
				original: null as any
			},
			MiddlewaresChainHandle: {
				shouldFail: false,
				original: null as any
			},
			parseRequest: {
				shouldFail: false,
				original: null as any
			},
			removeSlash: {
				shouldFail: false,
				original: null as any
			}
		},
		response: {
			settingResponse: {
				shouldFail: false,
				original: null as any
			}
		},
		ws: {
			transformPayloadToMessage: {
				mockReturnValue: false,
				returnValue: null as any,
				shouldFail: false,
				original: null as any
			}
		}
	}
}));
vi.mock('./utils/utils', async (importOriginal) => {
	const mod = await importOriginal<typeof import('./utils/utils')>();
	const requestsContext = mod.Utils.request;
	const responseContext = mod.Utils.response;
	const fileContext = mod.Utils.files;
	const wsContext = mod.Utils.ws;
	mocks.utils.request.addSlash.original = mod.Utils.request.addSlash;
	mocks.utils.request.applyPaginationAndFilters.original = mod.Utils.request.applyPaginationAndFilters;
	mocks.utils.request.createRequest.original = mod.Utils.request.createRequest;
	mocks.utils.request.getCleanBody.original = mod.Utils.request.getCleanBody;
	mocks.utils.request.getPaginationAndFilters.original = mod.Utils.request.getPaginationAndFilters;
	mocks.utils.request.MiddlewaresChain.original = mod.Utils.request.MiddlewaresChain;
	mocks.utils.request.MiddlewaresChain.original = mod.Utils.request.MiddlewaresChain;
	mocks.utils.request.parseRequest.original = mod.Utils.request.parseRequest;
	mocks.utils.request.removeSlash.original = mod.Utils.request.removeSlash;
	mocks.utils.response.settingResponse.original = mod.Utils.response.settingResponse;
	mocks.utils.files.writingFile.original = mod.Utils.files.writingFile;
	mocks.utils.ws.transformPayloadToMessage.original = mod.Utils.ws.transformPayloadToMessage;

	return {
		...mod,
		Utils: {
			...mod.Utils,
			files: {
				...mod.Utils.files,
				writingFile: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.files.writingFile.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.files.writingFile.original.apply(fileContext, args);
					}
				})
			},
			request: {
				...mod.Utils.request,
				addSlash: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.request.addSlash.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.addSlash.original.apply(requestsContext,args)
					}
				}),
				applyPaginationAndFilters: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.request.applyPaginationAndFilters.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.applyPaginationAndFilters.original.apply(
							mocks.utils.request.getPaginationAndFilters.returnValue ? { ...requestsContext, getPaginationAndFilters: vi.fn().mockReturnValue(mocks.utils.request.getPaginationAndFilters.returnValue) } : requestsContext,
							args
						)
					}
				}),
				createRequest: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.request.createRequest.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.createRequest.original.apply(requestsContext,args)
					}
				}),
				getCleanBody: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.request.getCleanBody.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.getCleanBody.original.apply(requestsContext,args)
					}
				}),
				getPaginationAndFilters: mocks.utils.request.getPaginationAndFilters.returnValue
					? vi.fn().mockReturnValue(mocks.utils.request.getPaginationAndFilters.returnValue)
					: vi.fn().mockImplementation((...args) => {
						if(mocks.utils.request.getPaginationAndFilters.shouldFail) {
							throw new Error("generic");
						} else {
							return mocks.utils.request.getPaginationAndFilters.original.apply(requestsContext,args)
						}
					}),
				MiddlewaresChain: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.request.MiddlewaresChain.shouldFail) {
						throw new Error("generic");
					} else if(mocks.utils.request.MiddlewaresChainUse.shouldFail) {
						return {
							use() {
								throw new Error("generic");
							}
						}
					} else if(mocks.utils.request.MiddlewaresChainHandle.shouldFail) {
						return {
							use() {},
							handle() {
								throw new UniversalApiError("generic", "TIMEOUT", "");
							}
						}
					} else {
						return mocks.utils.request.MiddlewaresChain.original.apply(requestsContext,args)
					}
				}),
				parseRequest: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.request.parseRequest.shouldFail) {
						throw new UniversalApiError("generic", "ERROR", "");
					} else {
						return mocks.utils.request.parseRequest.original.apply(requestsContext,args)
					}
				}),
				removeSlash: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.request.removeSlash.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.removeSlash.original.apply(requestsContext,args)
					}
				})
			},
			response: {
				...mod.Utils.response,
				settingResponse: vi.fn().mockImplementation((...args) => {
					if(mocks.utils.response.settingResponse.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.response.settingResponse.original.apply(responseContext,args)
					}
				})
			},
			ws: {
				...mod.Utils.ws,
				transformPayloadToMessage: vi.fn().mockImplementation((...args) => {
						if (mocks.utils.ws.transformPayloadToMessage.shouldFail) {
							throw new Error("generic")
						} else if (mocks.utils.ws.transformPayloadToMessage.mockReturnValue) {
							return mocks.utils.ws.transformPayloadToMessage.returnValue;
						} else {
							return mocks.utils.ws.transformPayloadToMessage.original.apply(wsContext, args)
						}
					})
			}
		}
	};
});
vi.mock('node:path', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:path')>();
	mocks.parse.original = actual.parse;

	return {
		...actual,
		parse: vi.fn().mockImplementation((...args) => {
			if (mocks.parse.shouldFail && mocks.parse.counter === mocks.parse.shouldFailAt) {
				mocks.parse.counter = 0;
				mocks.parse.shouldFailAt = 0;
				throw Error("generic");
			} else {
				mocks.parse.shouldFail && mocks.parse.counter++;
				return mocks.parse.original(...args);
			}
		})
	};
});
vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>();
	mocks.readStream.original = actual.createReadStream;
	mocks.readStreamPipe.original = actual.createReadStream;

	return {
		...actual,
		createReadStream: vi.fn().mockImplementation((...args) => {
			if (mocks.readStream.shouldFail) {
				const mockStream = new PassThrough();
				process.nextTick(() => mockStream.emit('error', new Error('ERRORE_FS_SIMULATO')));
				return mockStream;
			} else if (mocks.readStreamPipe.shouldFail) {
				const mockStream = new PassThrough();
				mockStream.pipe = ((destination: ServerResponse<IncomingMessage>) => {
					destination.emit("error", Error("generic"));
					return;
				}) as unknown as typeof mockStream.pipe;
				return mockStream;
			}
			return mocks.readStream.original(...args);
		}),
	};
});
const logSpy = vi.spyOn(process.stdout, 'write').mockImplementation((str: Uint8Array | string, encoding?: BufferEncoding, cb?: (err?: Error | null) => void) => {
	return true;
});

const originalStringify = {
	method: JSON.stringify,
	matchValue: "",
	shouldFail(matchValue: any) {
		this.matchValue = typeof matchValue === "string" ? matchValue : this.method(matchValue);
	},
	conditionForFail: (currentText: string, matchValue: string): boolean => false,
	applyCondition(text: string) {
		const result = this.matchValue ? this.conditionForFail(text, this.matchValue) : false;
		if (result) {
			this.matchValue = "";
			this.conditionForFail = (curr, match) => false;
		}
		return result;
	}
};
vi.spyOn(JSON, 'stringify').mockImplementation((...args) => {
	if (originalStringify.applyCondition(typeof args[0] === "string" ? args[0] : originalStringify.method(args[0]))) {
		throw new TypeError('Riferimento circolare rilevato!');
	} else {
		return originalStringify.method(...args as Parameters<typeof JSON.stringify>);
	}
});

const getServer = () => ({
	middlewares: {
		use: vi.fn()
	}
}) as any;
const generateOptions = (opt?: UniversalApiOptions) => import('./index').then(module => module.default(opt) as unknown as { configResolved: (conf: ResolvedConfig) => Promise<void>, configureServer: (server: ViteDevServer) => void, configurePreviewServer: (server: PreviewServer) => void });
const createMultipartBody = (parts: object, boundary = `----TestBoundary${Date.now()}`) => {
	const chunks = [];
	if (parts instanceof URLSearchParams) {
		const data = parts.toString();
		chunks.push(Buffer.from(`Content-Disposition: form-data;\r\n`));
		chunks.push(Buffer.from(`Content-Type: application/x-www-form-urlencoded\r\n\r\n`));
		chunks.push(Buffer.from(data));
	} else {
		for (const [key, value] of Object.entries(parts)) {
			chunks.push(Buffer.from(`--${boundary}\r\n`));
			if (value && typeof value === "object" && value instanceof URLSearchParams) {
				const urlEncodedData = value.toString();
				chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n`));
				chunks.push(Buffer.from(`Content-Type: application/x-www-form-urlencoded\r\n\r\n`));
				chunks.push(Buffer.from(urlEncodedData));
			} else if (value && typeof value === 'object' && value.filename) {
				// Caso FILE: { filename: 'test.txt', content: '...', contentType: 'text/plain' }
				chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"; filename="${value.filename}"\r\n`));
				chunks.push(Buffer.from(`Content-Type: ${value.contentType || 'application/octet-stream'}\r\n\r\n`));
				chunks.push(Buffer.isBuffer(value.content) ? value.content : Buffer.from(value.content));
			} else {
				// Caso JSON o Testo
				const isJson = typeof value === 'object';
				const content = isJson ? JSON.stringify(value) : String(value);
				chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n`));
				if (isJson) chunks.push(Buffer.from(`Content-Type: application/json\r\n`));
				chunks.push(Buffer.from(`\r\n${content}`));
			}

			chunks.push(Buffer.from(`\r\n`));
		}
	}

    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    const finalBuffer = Buffer.concat(chunks);

    return {
        body: finalBuffer,
        contentType: `multipart/form-data; boundary=${boundary}`,
        contentLength: finalBuffer.length
    };
}
const createMockRequestResponse = (isReq: boolean) => {
	const req = new PassThrough() as PassThrough & { url: string, method: string, headers: Record<string, any>, statusCode: number, setHeader:(...args: unknown[])=>void, removeHeader: (name: string) => void };
	isReq
		? Object.assign(req, {
			url: '/api/users',
			method: "GET",
			headers: {}
		})
		: Object.assign(req, {
			statusCode: 404,
			headers: {},
			setHeader: vi.fn((...args) => {
				req.headers[args[0]] = args[1];
			}),
			removeHeader: vi.fn((...args) => {
				delete req.headers[args[0]];
			})
		});
	return req;
}
const resetShouldFailMocks = (obj: typeof mocks) => {
	if(obj === null) {
		return;
	}
	const keys = Reflect.ownKeys(obj);
	for (const key of keys) {
		if(key === "shouldFail") {
			Reflect.set(obj, key, false);
		} else {
			const nested = Reflect.get(obj, key);
			if (typeof nested === "object" && nested !== null) {
				resetShouldFailMocks(nested);
				Reflect.set(obj, key, nested);
			}
		}
	}
}
class MockSocket extends EventEmitter {
    public writableLength = 0;
    public writableHighWaterMark = 16384;
    public destroyed = false;
    public ended = false;
    public writes: Buffer[] = [];

    write(data: Buffer, callback?: (err?: Error) => void): boolean {
        this.writes.push(data);
        if (callback) {
            process.nextTick(() => callback());
        }
        return true; // No backpressure by default
    }

    end(callback?: () => void): void {
        this.ended = true;
        if (callback) {
            process.nextTick(callback);
        }
    }

    destroy(): void {
        this.destroyed = true;
        this.emit('close', false);
    }

    clearWrites(): void {
        this.writes = [];
    }
}
function createMockSocket(): Socket {
    return new MockSocket() as unknown as Socket;
}
function createWebSocketFrame(payload: string | Buffer, options?: {
    opcode?: number;
    masked?: boolean;
    fin?: boolean;
    rsv1?: boolean;
	rsv2?: boolean;
}): Buffer {
    const {
        opcode = 0x01, // text frame
        masked = true,  // client frames devono essere masked
        fin = true,
        rsv1 = false,
		rsv2 = false
    } = options || {};

    const payloadBuffer = typeof payload === 'string'
        ? Buffer.from(payload, 'utf8')
        : payload;

    const payloadLength = payloadBuffer.length;
    let headerLength = 2;
    let frame: Buffer;
    let offset = 2;

    // Calcola lunghezza header in base al payload
    if (payloadLength < 126) {
        frame = Buffer.alloc(2 + (masked ? 4 : 0) + payloadLength);
        frame[1] = payloadLength;
    } else if (payloadLength < 65536) {
        headerLength = 4;
        frame = Buffer.alloc(4 + (masked ? 4 : 0) + payloadLength);
        frame[1] = 126;
        frame.writeUInt16BE(payloadLength, 2);
        offset = 4;
    } else {
        headerLength = 10;
        frame = Buffer.alloc(10 + (masked ? 4 : 0) + payloadLength);
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(payloadLength), 2);
        offset = 10;
    }

    // Primo byte: FIN + RSV + OPCODE
	frame[0] = (fin ? 0x80 : 0x00) | (rsv1 ? 0x40 : 0x00) | (rsv2 ? 0x20 : 0x00) | opcode;

    // Secondo byte: MASK bit
    if (masked) {
        frame[1] |= 0x80;

        // Genera mask key random
        const maskKey = Buffer.alloc(4);
        for (let i = 0; i < 4; i++) {
            maskKey[i] = Math.floor(Math.random() * 256);
        }

        // Scrivi mask key
        maskKey.copy(frame, offset);
        offset += 4;

        // Maschera il payload
        for (let i = 0; i < payloadLength; i++) {
            frame[offset + i] = payloadBuffer[i] ^ maskKey[i % 4];
        }
    } else {
        // Copia payload non mascherato
        payloadBuffer.copy(frame, offset);
    }

    return frame;
}
const executeTests = (testName: any, cb: () => Promise<void>) => {
	for (const key in testName) {
		if(key in TEST_NAME) {
			describe(key, async () => {
				const value = testName[key as keyof typeof testName];
				if(typeof value === "string") {
					it(value, async () => await cb);
				} else {
					executeTests(value, cb);
				}
			})
		} else {
			const value = testName[key as keyof typeof testName];
			if(typeof value === "string") {
				it(value, cb);
			} else {
				executeTests(value, cb);
			}
		}
	}
}
const TEST_NAME = {
	PLUGIN: {
		LOG_DEBUG: "PLUGIN LOG_DEBUG",
		LOG_INFO: "PLUGIN LOG_INFO",
		LOG_WARN_NO_PREFIX: "PLUGIN LOG_WARN_NO_PREFIX"
	},
	CONFIGURE_SERVER: {
		DISABLED: "CONFIGURE_SERVER DISABLED",
		LOG_DEBUG: "CONFIGURE_SERVER LOG_DEBUG",
		NO_MATCH_PREFIX: "CONFIGURE_SERVER NO_MATCH_PREFIX",
		NO_REQ_HANDLER: "CONFIGURE_SERVER NO_REQ_HANDLER",
		NO_FILE_FOUND: "CONFIGURE_SERVER NO_FILE_FOUND",
		NO_NESTED_FILE_FOUND: "CONFIGURE_SERVER NO_NESTED_FILE_FOUND",
		ERR_READING_FILE: "CONFIGURE_SERVER ERROR_READING_FILE",
		ERR_WRITING_RESPONSE: "CONFIGURE_SERVER ERROR_WRITING_RESPONSE",
		ERR_WRITING_RESPONSE_CATCH: "CONFIGURE_SERVER ERROR_WRITING_RESPONSE_CATCH",
		NO_HANDLER_FORWARD: "CONFIGURE_SERVER NO_HANDLER_FORWARD",
		NO_HANDLER_404: "CONFIGURE_SERVER NO_HANDLER_404",
		UNRECOGNIZED_ERROR: "CONFIGURE_SERVER UNRECOGNIZED_ERROR",
		WITHOUT_DIR: "CONFIGURE_SERVER WITHOUT_DIR",
		PRE_HANDLER_TRANSFORM_OBJ: "CONFIGURE_SERVER PRE_HANDLER_TRANSFORM_OBJ",
		PRE_HANDLER_TRANSFORM_FUNC: "CONFIGURE_SERVER PRE_HANDLER_TRANSFORM_FUNC",
		POST_HANDLER: "CONFIGURE_SERVER POST_HANDLER",
		POST_HANDLER_JSON: "CONFIGURE_SERVER POST_HANDLER_JSON",
		POST_HANDLER_FILE_NOT_FOUND: "CONFIGURE_SERVER POST_HANDLER_FILE_NOT_FOUND",
		POST_HANDLER_ERROR: "CONFIGURE_SERVER POST_HANDLER_ERROR",
		HANDLER_DISABLED: "CONFIGURE_SERVER HANDLER_DISABLED",
		HANDLER_DIFFERENT_METHOD: "CONFIGURE_SERVER HANDLER_DIFFERENT_METHOD",
		HANDLER_DELAYED: "CONFIGURE_SERVER HANDLER_DELAYED",
		API_REST_CUSTOM_PARSER: "CONFIGURE_SERVER API_REST_CUSTOM_PARSER",
		API_REST_ERROR: "CONFIGURE_SERVER API_REST_ERROR",
		API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER: "CONFIGURE_SERVER API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER",
		API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER_THROW_ERROR: "CONFIGURE_SERVER API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER_THROW_ERROR",
		API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER_NO_RESPONSE: "CONFIGURE_SERVER API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER_NO_RESPONSE",
		API_REST_MIDDLEWARE_CHAIN_ERROR: "CONFIGURE_SERVER API_REST_MIDDLEWARE_CHAIN_ERROR",
		API_REST_GENERIC_ERROR: "CONFIGURE_SERVER API_REST_GENERIC_ERROR",
		HANDLER_EXECUTION: "CONFIGURE_SERVER HANDLER_EXECUTION",
		GATEWAY_TIMEOUT: "CONFIGURE_SERVER GATEWAY_TIMEOUT",
		API_REST_UNRECOGNIZED_ERROR: "CONFIGURE_SERVER API_REST_UNRECOGNIZED_ERROR",
		NEXT_INVOCATION: "CONFIGURE_SERVER NEXT_INVOCATION",
		INTERNAL_GENERIC_ERROR: "CONFIGURE_SERVER INTERNAL_GENERIC_ERROR",
		ERROR_MIDDLEWARE: "CONFIGURE_SERVER ERROR_MIDDLEWARE",
		ERROR_MIDDLEWARE_NO_WRITE: "CONFIGURE_SERVER ERROR_MIDDLEWARE_NO_WRITE",
		ERROR_MIDDLEWARE_THROW_ERROR: "CONFIGURE_SERVER ERROR_MIDDLEWARE_THROW_ERROR",
		ERROR_MIDDLEWARE_THROW_NEXT_ERROR: "CONFIGURE_SERVER ERROR_MIDDLEWARE_THROW_NEXT_ERROR",
		ERROR_SETTING_JSON_RESPONSE: "CONFIGURE_SERVER ERROR_SETTING_JSON_RESPONSE",
		ERROR_READING_FILE_HEAD: "CONFIGURE_SERVER ERROR_READING_FILE_HEAD",
		ERROR_READING_FILE_STREAM_ERROR: "CONFIGURE_SERVER ERROR_READING_FILE_STREAM_ERROR",
		ERROR_READING_FILE_RESP_ERROR: "CONFIGURE_SERVER ERROR_READING_FILE_RESP_ERROR",
		HEAD: {
			OK: "CONFIGURE_SERVER HEAD OK"
		},
		GET: {
			OK: "CONFIGURE_SERVER GET OK",
			WITH_BODY_ERROR: "CONFIGURE_SERVER GET WITH_BODY_ERROR",
			WITH_FILE_ERROR: "CONFIGURE_SERVER GET WITH_FILE_ERROR",
			NO_JSON_FILE: "CONFIGURE_SERVER GET NO_JSON_FILE",
			EXE_FILE: "CONFIGURE_SERVER GET EXE_FILE",
			NO_JSON_FILE_WITH_EXT: "CONFIGURE_SERVER GET NO_JSON_FILE_WITH_EXT",
			DIR_WITH_INDEX_FILE: "CONFIGURE_SERVER GET DIR_INDEX",
			DIR_WITHOUT_INDEX_FILE: "CONFIGURE_SERVER GET DIR_NO_INDEX",
			WITH_FILTERS: "CONFIGURE_SERVER GET WITH_FILTERS",
			WITH_FILTERS_FILE_ERROR: "CONFIGURE_SERVER GET WITH_FILTERS_FILE_ERROR",
			WITH_PAGINATION: "CONFIGURE_SERVER GET WITH_PAGINATION",
			WITH_PAGINATION_ERROR: "CONFIGURE_SERVER GET WITH_PAGINATION_ERROR"
		},
		POST: {
			MULTIPLE_FILES: "CONFIGURE_SERVER POST MULTIPLE_FILES",
			MULTIPLE_FILES_REST: "CONFIGURE_SERVER POST MULTIPLE_FILES_REST",
			BOTH_FILE_AND_BODY: "CONFIGURE_SERVER POST BOTH_FILE_AND_BODY",
			BOTH_FILE_AND_BODY_REST: "CONFIGURE_SERVER POST BOTH_FILE_AND_BODY_REST",
			FILE_FOUND_NOT_JSON: "CONFIGURE_SERVER POST FILE_FOUND_NOT_JSON",
			FILE_FOUND_NOT_JSON_REST: "CONFIGURE_SERVER POST FILE_FOUND_NOT_JSON_REST",
			WITH_PAGINATION_ERROR: "CONFIGURE_SERVER POST WITH_PAGINATION_ERROR",
			WITH_FILTERS_FILE: "CONFIGURE_SERVER POST WITH_FILTERS_FILE",
			WITH_FILTERS_FILE_ARRAY: "CONFIGURE_SERVER POST WITH_FILTERS_FILE_ARRAY",
			WITH_FILTERS_FILE_ERROR: "CONFIGURE_SERVER POST WITH_FILTERS_FILE_ERROR",
			WITHOUT_PAGINATION_AND_NOT_JSON_BODY: "CONFIGURE_SERVER POST WITHOUT_PAGINATION_AND_NOT_JSON_BODY",
			WITH_BODY_EXTRA: "CONFIGURE_SERVER POST WITH_BODY_EXTRA",
			WITH_FILE_JSON: "CONFIGURE_SERVER POST WITH_FILE_JSON",
			WITH_FILE_NOT_JSON: "CONFIGURE_SERVER POST WITH_FILE_NOT_JSON",
			FILE_NOT_FOUND_AND_NO_DATA: "CONFIGURE_SERVER POST FILE_NOT_FOUND_AND_NO_DATA",
			FILE_NOT_FOUND_AND_FILTERS: "CONFIGURE_SERVER POST FILTE_NOT_FOUND_AND_FILTERS",
			TOTAL_COUNT_ERROR_HEADER: "CONFIGURE_SERVER POST TOTAL_COUNT_ERROR_HEADER",
			ERROR_WRITING_FILE: "CONFIGURE_SERVER POST ERROR_WRITING_FILE",
			ERROR_CREATING_DATA: "CONFIGURE_SERVER POST ERROR_CREATING_DATA",
		},
		PUT: {
			CREATE_NO_JSON_FILE: "CONFIGURE_SERVER PUT CREATE_NO_JSON_FILE",
			CREATE_FILE: "CONFIGURE_SERVER PUT CREATE_FILE",
			CREATE_FILE_WITH_FILE: "CONFIGURE_SERVER PUT CREATE_FILE_WITH_FILE",
			UPDATE_FILE: "CONFIGURE_SERVER PUT UPDATE_FILE",
			MULTIPLE_FILES: "CONFIGURE_SERVER PUT MULTIPLE_FILES",
			MULTIPLE_FILES_REST: "CONFIGURE_SERVER PUT MULTIPLE_FILES_REST",
			NO_FILE_PROVIDED: "CONFIGURE_SERVER PUT NOT_FILE_PROVIDED",
			ERROR_UPDATING_FILE: "CONFIGURE_SERVER PUT ERROR_UPDATING_FILE",
			ERROR_CREATING_FILE: "CONFIGURE_SERVER PUT ERROR_CREATING_FILE"
		},
		PATCH: {
			UNSUPPORTED_MEDIA_TYPE: "CONFIGURE_SERVER PATCH UNSUPPORTED_MEDIA_TYPE",
			UNSUPPORTED_MEDIA_TYPE_REST: "CONFIGURE_SERVER PATCH UNSUPPORTED_MEDIA_TYPE_REST",
			FILE_NOT_FOUND: "CONFIGURE_SERVER PATCH FILE_NOT_FOUND",
			NO_JSON_FILE: "CONFIGURE_SERVER PATCH NO_JSON_FILE",
			MERGE_PATCHING_ARRAY: "CONFIGURE_SERVER PATCH MERGE_PATCHING_ARRAY",
			MERGE_PATCHING_OBJECT: "CONFIGURE_SERVER PATCH MERGE_PATCHING_OBJECT",
			JSON_PATCHING: "CONFIGURE_SERVER PATCH JSON_PATCHING",
			ERROR_PATCHING_OPERATION_NOT_SUPPORTED: "CONFIGURE_SERVER PATH ERROR_PATCHING_OPERATION_NOT_SUPPORTED",
			ERROR_PATCHING_FILE: "CONFIGURE_SERVER PATH ERROR_PATCHING_FILE"
		},
		OPTIONS: {
			METHOD_NOT_ALLOWED: "CONFIGURE_SERVER OPTIONS METHOD_NOT_ALLOWED"
		},
		DELETE: {
			FILE_NOT_FOUND: "CONFIGURE_SERVER DELETE FILE_NOT_FOUND",
			BODY_ERROR: "CONFIGURE_SERVER DELETE BODY_ERROR",
			BODY_ERROR_REST: "CONFIGURE_SERVER DELETE BODY_ERROR_REST",
			FILTERS_FILE_NOT_FOUND: "CONFIGURE_SERVER DELETE FILTERS_FILE_NOT_FOUND",
			WITH_FILTERS_FILE_ERROR: "CONFIGURE_SERVER DELETE WITH_FILTERS_FILE_ERROR",
			WITH_PAGINATION_ERROR: "CONFIGURE_SERVER DELETE WITH_PAGINATION_ERROR",
			FULL_FILE: "CONFIGURE_SERVER DELETE FULL_FILE",
			FULL_FILE_OBJECT: "CONFIGURE_SERVER DELETE PARTIAL_FILE_OBJECT",
			PARTIAL_FULL_FILE: "CONFIGURE_SERVER DELETE PARTIAL_FULL_FILE",
			PARTIAL_FILE: "CONFIGURE_SERVER DELETE PARTIAL_FILE",
			ERROR_WRITING_FILE: "CONFIGURE_SERVER DELETE ERROR_WRITING_FILE"
		}
	},
	CONFIGURE_PREVIEW_SERVER: {
		DISABLED: "CONFIGURE_PREVIEW_SERVER DISABLED",
		LOG_DEBUG: "CONFIGURE_PREVIEW_SERVER LOG_DEBUG",
		NO_MATCH_PREFIX: "CONFIGURE_PREVIEW_SERVER NO_MATCH_PREFIX",
		NO_REQ_HANDLER: "CONFIGURE_PREVIEW_SERVER NO_REQ_HANDLER",
		NO_FILE_FOUND: "CONFIGURE_PREVIEW_SERVER NO_FILE_FOUND",
	},
	WS: {
		PARSE_LARGE_FRAME: "WS PARSE_LARGE_FRAME",
		PARSE_TEXT_FRAME: "WS PARSE_TEXT_FRAME",
		PARSE_CLOSE_FRAME: "WS PARSE_CLOSE_FRAME",
		PARSE_PING_FRAME: "WS PARSE_PING_FRAME",
		PARSE_PONG_FRAME: "WS PARSE_PONG_FRAME",
		PARSE_16BIT_FRAME: "WS PARSE_16BIT_FRAME",
		PARSE_MULTIPLE_CALL: "WS PARSE_MULTIPLE_CALL",
		PARSE_MULTIPLE_FRAME: "WS PARSE_MULTIPLE_FRAME",
		RSV_BITS: "WS RSV_BITS",
		ADD_CONNECTION: "WS ADD_CONNECTION",
		REMOVE_CONNECTION: "WS REMOVE_CONNECTION",
		GET_ALL_CONNECTION: "WS GET_ALL_CONNECTION",
		GET_ROOM_CONNECTION: "WS GET_ROOM_CONNECTION",
		BROADCAST_CONNECTION: "WS BROADCAST_CONNECTION",
		UNIQUE_ID_CONNECTION: "WS UNIQUE_ID_CONNECTION",
		ADD_CONNECTION_IT_SELF_TO_MANAGER: "WS ADD_CONNECTION_IT_SELF_TO_MANAGER",
		SET_PATH_CONNECTION: "WS SET_PATH_CONNECTION",
		NO_CONNECTION_CLOSED: "WS NO_CONNECTION_CLOSED",
		SEND_TEXT_MESSAGE: "WS SEND_TEXT_MESSAGE",
		SEND_STRING_MESSAGE: "WS SEND_STRING_MESSAGE",
		SEND_ON_CONNECTION_CLOSED: "WS SEND_ON_CONNECTION_CLOSED",
		HANDLE_SEND_ERRORS: "WS HANDLE_SEND_ERRORS",
		SEND_PING_FRAME: "WS SEND_PING_FRAME",
		SEND_PONG_FRAME: "WS SEND_PONG_FRAME",
		SEND_PING_ON_CONNECTION_CLOSED: "WS SEND_PING_ON_CONNECTION_CLOSED",
		SEND_PING_INTERVALS: "WS SEND_PING_INTERVALS",
		CLOSE_CONNECTION_AFTER_MISSED_PONGS: "WS CLOSE_CONNECTION_AFTER_MISSED_PONGS",
		RESET_MISSED_PONGS: "WS RESET_MISSED_PONGS",
		STOP_HEARTBEAT: "WS STOP_HEARTBEAT",
		CLOSE_CONNECTION_FOR_INACTIVITY: "WS CLOSE_CONNECTION_FOR_INACTIVITY",
		RESET_TIMER_ON_ACTIVITY: "WS RESET_TIMER_ON_ACTIVITY",
		STOP_INACTIVITY_TIMEOUT: "WS STOP_INACTIVITY_TIMEOUT",
		JOIN_ROOM: "WS JOIN_ROOM",
		LEAVE_ROOM: "WS LEAVE_ROOM",
		JOIN_MULTIPLE_ROOMS: "WS JOIN_MULTIPLE_ROOMS",
		BROADCAST_SPECIFIC_ROOM_EXCLUDING_SELF: "WS BROADCAST_SPECIFIC_ROOM_EXCLUDING_SELF",
		BROADCAST_SPECIFIC_ROOM_INCLUDING_SELF: "WS BROADCAST_SPECIFIC_ROOM_INCLUDING_SELF",
		BROADCAST_ALL_CONNECTIONS: "WS BROADCAST_ALL_CONNECTIONS",
		BROADCAST_ALL_ROOMS: "WS BROADCAST_ALL_ROOMS",
		BROADCAST_ALL_ROOMS_INCLUDING_SELF: "WS BROADCAST_ALL_ROOMS_INCLUDING_SELF",
		SEND_CLOSE_FRAME: "WS SEND_CLOSE_FRAME",
		REMOVE_CONNECTION_FROM_MANAGER: "WS REMOVE_CONNECTION_FROM_MANAGER",
		STOP_HEARTBEAT_AND_INACTIVITY_TIMEOUT: "WS STOP_HEARTBEAT_AND_INACTIVITY_TIMEOUT",
		CALL_CLEANUP_CB: "WS CALL_CLEANUP_CB",
		SEND_CLOSE_FRAME_TWICE: "WS SEND_CLOSE_FRAME_TWICE",
		DESTROY_SOCKET: "WS DESTROY_SOCKET",
		CALL_CONNECT_CLEANUP_CB: "WS CALL_CONNECT_CLEANUP_CB",
		NON_FRAGMENTED_FRAME: "WS NON_FRAGMENTED_FRAME",
		ACCUMULATE_FRAMES: "WS ACCUMULATE_FRAMES",
		WITHOUT_INITIAL_FRAME: "WS WITHOUT_INITIAL_FRAME",
		COMPRESS_DATA: "WS COMPRESS_DATA",
		REMOVE_TAIL_BYTES: "WS REMOVE_TAIL_BYTES",
		DECOMPRESS_DATA: "WS DECOMPRESS_DATA",
		HANDLE_EMPTY_DATA: "WS HANDLE_EMPTY_DATA",
		MULTIPLE_CYCLES: "WS MULTIPLE_CYCLES",
		RUN_WS_PLUGIN_1: "WS RUN_WS_PLUGIN_1",
		RUN_WS_PLUGIN_2: "WS RUN_WS_PLUGIN_2",
		RUN_WS_PLUGIN_3: "WS RUN_WS_PLUGIN_3",
		RUN_WS_PLUGIN_4: "WS RUN_WS_PLUGIN_4",
		RUN_WS_PLUGIN_5: "WS RUN_WS_PLUGIN_5",
		RUN_WS_PLUGIN_6: "WS RUN_WS_PLUGIN_6"
	},
	UTILS: {
		PARSE_DATA_WITH_NO_FILTERS_NO_PAG: "UTILS PARSE_DATA_WITH_NO_FILTERS_NO_PAG",
		NO_ARRAY_DATA: "UTILS NO_ARRAY_DATA",
		ONLY_EQ_FILTER: "UTILS ONLY_EQ_FILTER",
		ONLY_NE_FILTER: "UTILS ONLY_NE_FILTER",
		ONLY_LT_FILTERS: "UTILS ONLY_LT_FILTERS",
		ONLY_LTE_FILTERS: "UTILS ONLY_LTE_FILTERS",
		ONLY_GT_FILTERS: "UTILS ONLY_GT_FILTERS",
		ONLY_GTE_FILTERS: "UTILS ONLY_GTE_FILTERS",
		ONLY_REGEX_FILTER: "UTILS ONLY_REGEX_FILTER",
		ONLY_IN_WITH_ARRAY_DOT_FILTERS: "UTILS ONLY_IN_WITH_ARRAY_DOT_FILTERS",
		ONLY_NIN_WITH_ARRAY_FILTERS: "UTILS ONLY_NIN_WITH_ARRAY_FILTERS",
		ASC_ORDER_PAG: "UTILS ASC_ORDER_PAG",
		DESC_ORDER_PAG: "UTILS DESC_ORDER_PAG",
		INVALID_ORDER_PAG: "UTILS INVALID_ORDER_PAG",
		DATA_NULL: "UTILS DATA_NULL",
		GET_PAG_AND_FILTERS_PAG_NULL: "UTILS GET_PAG_AND_FILTERS_PAG_NULL",
		GET_PAG_AND_FILTERS_PAG_QUERY_PARAM: "UTILS GET_PAG_AND_FILTERS_PAG_QUERY_PARAM",
		GET_PAG_AND_FILTERS_PAG_QUERY_PARAM_INCOMPLETE: "UTILS GET_PAG_AND_FILTERS_PAG_QUERY_PARAM_INCOMPLETE",
		GET_PAG_AND_FILTERS_PAG_BODY: "UTILS GET_PAG_AND_FILTERS_PAG_BODY",
		GET_PAG_AND_FILTERS_PAG_BODY_INCOMPLETE: "UTILS GET_PAG_AND_FILTERS_PAG_BODY_INCOMPLETE",
		GET_PAG_AND_FILTERS_PAG_BODY_NO_VALUE: "UTILS GET_PAG_AND_FILTERS_PAG_BODY_NO_VALUE",
		GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT: "UTILS GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT",
		GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT_INCOMPLETE: "UTILS GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT_INCOMPLETE",
		GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT_NO_VALUE: "UTILS GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT_NO_VALUE",
		GET_PAG_AND_FILTERS_PAG_ALL: "UTILS GET_PAG_AND_FILTERS_PAG_ALL",
		GET_PAG_AND_FILTERS_FILT_ALL: "UTILS GET_PAG_AND_FILTERS_FILT_ALL",
		GET_PAG_AND_FILTERS_FILT_ALL_WITHOUT_ROOT: "UTILS GET_PAG_AND_FILTERS_FILT_ALL_WITHOUT_ROOT",
		GET_PAG_AND_FILTERS_FILT_TYPE_MAPPING: "UTILS GET_PAG_AND_FILTERS_FILT_TYPE_MAPPING",
		GET_PAG_AND_FILTERS_FILT_CUSTOM_FUNC: "UTILS GET_PAG_AND_FILTERS_FILT_CUSTOM_FUNC",
		GET_PAG_AND_FILTERS_FILT_REGEX_FLAGS: "UTILS GET_PAG_AND_FILTERS_FILT_REGEX_FLAGS",
		GET_PAG_AND_FILTERS_HANDLER_PAG_NONE: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_NONE",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_QUERY: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_QUERY",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_QUERY_INCOMPLETE: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_QUERY_INCOMPLETE",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_INCOMPLETE: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_INCOMPLETE",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_NO_VALUE: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_NO_VALUE",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_WITHOUT_ROOT: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_WITHOUT_ROOT",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_WITHOUT_ROOT_NO_VALUE: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_WITHOUT_ROOT_NO_VALUE",
		GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_INCOMPLETE_WITHOUT_ROOT: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_INCOMPLETE_WITHOUT_ROOT",
		GET_PAG_AND_FILTERS_HANDLER_PAG_INCLUSIVE: "UTILS GET_PAG_AND_FILTERS_HANDLER_PAG_INCLUSIVE",
		GET_PAG_AND_FILTERS_HANDLER_FILT_INCLUSIVE: "UTILS GET_PAG_AND_FILTERS_HANDLER_FILT_INCLUSIVE",
		GET_PAG_AND_FILTERS_HANDLER_FILT_EXCLUSIVE: "UTILS GET_PAG_AND_FILTERS_HANDLER_FILT_EXCLUSIVE",
		GET_PAG_AND_FILTERS_HANDLER_FILT_EXCLUSIVE_WITHOUT_ROOT: "UTILS GET_PAG_AND_FILTERS_HANDLER_FILT_EXCLUSIVE_WITHOUT_ROOT",
		GET_PAG_AND_FILTERS_HANDLER_FILT_NONE: "UTILS GET_PAG_AND_FILTERS_HANDLER_FILT_NONE",
		GET_PAG_AND_FILTERS_HANDLER_NULL: "UTILS GET_PAG_AND_FILTERS_HANDLER_NULL",
		GET_CLEAN_BODY_ARRAY: "UTILS GET_CLEAN_BODY_ARRAY",
		GET_CLEAN_BODY_OBJECT: "UTILS GET_CLEAN_BODY_OBJECT",
		PARSE_REQUEST_DISABLED: "UTILS PARSE_REQUEST_DISABLED",
		PARSE_REQUEST_OBJECT_PARSER: "UTILS PARSE_REQUEST_OBJECT_PARSER",
		PARSE_REQUEST_MULTIPART_URL_ENCODED: "UTILS PARSE_REQUEST_MULTIPART_URL_ENCODED",
		PARSE_REQUEST_MULTIPART_BINARY: "UTILS PARSE_REQUEST_MULTIPART_BINARY",
		MERGE_BODY_CHUNK_ERROR: "UTILS MERGE_BODY_CHUNK_ERROR",
		MATCH_ENDPOINT_PREFIX: "UTILS MATCH_ENDPOINT_PREFIX",
		ADD_SLASH: "UTILS ADD_SLASH",
		IS_DIR_EXIST: "UTILS IS_DIR_EXIST",
		MK_DIR_ERROR: "UTILS MK_DIR_ERROR",
		DIR_FILE_LIST_ENOTDIR: "UTILS DIR_FILE_LIST_ENOTDIR",
		DIR_FILE_LIST_ERROR: "UTILS DIR_FILE_LIST_ERROR",
		IS_FILE_EXIST: "UTILS IS_FILE_EXIST",
		READING_FILE_ERROR: "UTILS READING_FILE_ERROR",
		WRITING_FILE_ERROR: "UTILS WRITING_FILE_ERROR",
		REMOVE_FILE_ERROR: "UTILS REMOVE_FILE_ERROR",
		GET_BYTE_LENGTH_ERROR: "UTILS GET_BYTE_LENGTH_ERROR",
		APPLYING_PATCH_JSON_ERROR: "UTILS APPLYING_PATCH_JSON_ERROR",
		APPLYING_PATCH_JSON_OP_ERROR: "UTILS APPLYING_PATCH_JSON_OP_ERROR",
		APPLYING_PATCH_JSON_OP_REMOVE: "UTILS APPLYING_PATCH_JSON_OP_REMOVE",
		APPLYING_PATCH_JSON_OP_REMOVE_ERROR: "UTILS APPLYING_PATCH_JSON_OP_REMOVE_ERROR",
		APPLYING_PATCH_JSON_OP_REPLACE_ERROR: "UTILS APPLYING_PATCH_JSON_OP_REPLACE_ERROR",
		APPLYING_PATCH_JSON_OP_MOVE: "UTILS APPLYING_PATCH_JSON_OP_MOVE",
		APPLYING_PATCH_JSON_OP_COPY: "UTILS APPLYING_PATCH_JSON_OP_COPY",
		APPLYING_PATCH_JSON_OP_COPY_ERROR: "UTILS APPLYING_PATCH_JSON_OP_COPY_ERROR",
		DETECT_CLIENT_EXTENSION: "WS DETECT_CLIENT_EXTENSION",
		DETECT_DEFLATE_OPTIONS_1: "WS DETECT_DEFLATE_OPTIONS_1",
		DETECT_DEFLATE_OPTIONS_2: "WS DETECT_DEFLATE_OPTIONS_2",
		DETECT_DEFLATE_OPTIONS_3: "WS DETECT_DEFLATE_OPTIONS_3",
		HANDSHAKE_1: "WS HANDSHAKE_1",
		HANDSHAKE_2: "WS HANDSHAKE_2",
		HANDSHAKE_3: "WS HANDSHAKE_3",
		TRANSFORM_PAYLOAD_TO_MESSAGE_1: "WS TRANSFORM_PAYLOAD_TO_MESSAGE_1",
		TRANSFORM_PAYLOAD_TO_MESSAGE_2: "WS TRANSFORM_PAYLOAD_TO_MESSAGE_2",
		TRANSFORM_PAYLOAD_TO_MESSAGE_3: "WS TRANSFORM_PAYLOAD_TO_MESSAGE_3",
		TRANSFORM_PAYLOAD_TO_MESSAGE_4: "WS TRANSFORM_PAYLOAD_TO_MESSAGE_4"
	}
}

describe('Test plugin', async () => {
	const next = vi.fn();
	let wsConnection: WebSocketConnection;
	let wsConnection2: WebSocketConnection;
	let wsConnection3: WebSocketConnection;
	let wsDeflate;
	let upgradeWsCallback;
	let executeWsPlugin: (opt: Partial<UniversalApiOptionsRequired>, req?: any) => Promise<void>;
	let middlewareHandler: (...args: unknown[]) => Promise<void>,
		expects: (jsonResponse?: any) => Promise<void> | void = () => { },
		executeMiddleware = true,
		req: any,
		res: any;

	const mockDataFile = {
		originalData: null,
		data: JSON.stringify([
			{ id: 1, value: 10, category: { name: 'A' }, tags: ['t1', 't2'] },
			{ id: 2, value: 20, category: { name: 'B' }, tags: ['t2', 't3'] },
			{ id: 3, value: 30, category: { name: 'A' }, tags: ['t1', 't3'] }
		]),
		mimeType: "application/json",
		total: 0
	};
	const mockWsHttpServer = {
		on: vi.fn((event, cb) => {
			if (event === 'upgrade') upgradeWsCallback = cb;
		})
    };
	const mockViteWsServer = { httpServer: mockWsHttpServer };
	const mockWsRequest = { url: "/api/ws", headers: { upgrade: "websocket" } };
	const createMockRequest = (method: string, queryParams = {}, body = {}): UniversalApiRequest => ({
        url: "/api/users",
		method,
        query: {
            get: (key: string) => queryParams[key as keyof typeof queryParams] ?? null
        },
        body
    } as unknown as UniversalApiRequest);
	const testFunction = async () => {
		executeMiddleware && await middlewareHandler(req, res, next);
		await expects();
	}

	beforeEach(async (context) => {
		let multipart;
		let responseData: string = "";
		let instance;
		let request;
		let wsManager;
		let wsSocket: Socket;
		let wsParser;
		let result;
		vi.clearAllMocks();
		logSpy.mockClear();
		const mockOptions: UniversalApiOptions = {
			endpointPrefix: [ENDPOINT_PREFIX, "/test"],
			fsDir: MOCK_DIR.NAME,
			logLevel: 'info',
			disable: false,
		};
		const loggerMock = {
			debug: vi.fn(),
			error: vi.fn(),
			info: vi.fn(),
			warn: vi.fn()
		} as any;
		const fullUrlMock = {
			pathname: ""
		} as any;

		if (context.task.name.includes("UTILS")) {
			executeMiddleware = false;
			instance = Utils;
			mockDataFile.data = JSON.stringify([
				{ id: 1, value: 10, category: { name: 'A' }, tags: ['t1', 't2'] },
				{ id: 2, value: 20, category: { name: 'B' }, tags: ['t2', 't3'] },
				{ id: 3, value: 30, category: { name: 'A' }, tags: ['t1', 't3'] },
			]);
			mocks.utils.request.getPaginationAndFilters.returnValue = null;
		} else if (context.task.name.includes("WS")) {
			executeMiddleware = false;
			wsManager = new ConnectionManager(loggerMock);
			wsParser = new WebSocketFrameParser();
			wsSocket = createMockSocket();
			wsConnection = new WebSocketConnection(loggerMock,
				wsSocket,
				"/test",
				wsManager,
				null
			);
			wsConnection2 = new WebSocketConnection(loggerMock,
				wsSocket,
				"/test2",
				wsManager,
				null
			);
			wsConnection3 = new WebSocketConnection(loggerMock,
				wsSocket,
				"/test3",
				wsManager,
				null
			);
			wsDeflate = new WebSocketDeflate({
				server_max_window_bits: 15,
				client_max_window_bits: 15,
				server_no_context_takeover: false,
				client_no_context_takeover: false
			});
			executeWsPlugin = async (opt: Partial<UniversalApiOptionsRequired>, options?: {req?: any, socket?: any}) => {
				const opts = Utils.plugin.initOptions(mockOptions, CONF);
				runWsPlugin(
					mockViteWsServer as unknown as ViteDevServer,
					loggerMock,
					{
						...opts,
						...opt
					}
				);
				await upgradeWsCallback!(options?.req ?? mockWsRequest, options?.socket ?? wsSocket, Buffer.alloc(0));
			}
		} else {
			mkdirp.sync(MOCK_DIR.PATH);
			fs.writeFileSync(path.join(MOCK_DIR.PATH, 'users.json'), JSON.stringify([{ id: 0, name: "Test" }, { id: 1, name: "Test 1" }]));
			fs.writeFileSync(path.join(MOCK_DIR.PATH, 'product.txt'), "Product 1");
			req = createMockRequestResponse(true);
			res = createMockRequestResponse(false);
			res.on('data', (chunk: any) => responseData += chunk.toString());
		}

		switch (context.task.name) {
			case TEST_NAME.UTILS.PARSE_DATA_WITH_NO_FILTERS_NO_PAG:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: null };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(Array.isArray(mockDataFile.data)).toBe(true);
				}
				break;
			case TEST_NAME.UTILS.NO_ARRAY_DATA:
				const singleItemFile = { ...mockDataFile, data: JSON.stringify({ id: 1, value: 10 }) };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, singleItemFile);
				expects = () => {
					expect(Array.isArray(singleItemFile.data)).toBe(false);
					expect(singleItemFile.total).toBe(1);
					expect(singleItemFile.data).toEqual({ id: 1, value: 10 });
				}
				break;
			case TEST_NAME.UTILS.ONLY_EQ_FILTER:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'eq', value: 20 }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(1);
					expect((mockDataFile.data[0] as unknown as { id: number }).id).toBe(2);
				}
				break;
			case TEST_NAME.UTILS.ONLY_NE_FILTER:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'ne', value: 20 }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(2);
					expect((mockDataFile.data as unknown as { id: number }[]).map(el => el.id)).toEqual([1, 3]);
				}
				break;
			case TEST_NAME.UTILS.ONLY_LT_FILTERS:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'lt', value: 20 }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(1);
				}
				break;
			case TEST_NAME.UTILS.ONLY_LTE_FILTERS:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'lte', value: 10 }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(1);
				}
				break;
			case TEST_NAME.UTILS.ONLY_GT_FILTERS:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'gt', value: 20 }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(1);
				}
				break;
			case TEST_NAME.UTILS.ONLY_GTE_FILTERS:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'gte', value: 20 }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(2);
				}
				break;
			case TEST_NAME.UTILS.ONLY_REGEX_FILTER:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'category.name', comparison: 'regex', value: 'A', regexFlags: 'i' }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(2);
				}
				break;
			case TEST_NAME.UTILS.ONLY_IN_WITH_ARRAY_DOT_FILTERS:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'tags', comparison: 'in', value: ['t1'] }, { key: 'tags', comparison: 'in', value: 't1' }, { key: 'category.name', comparison: 'in', value: 'A' }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(2);
				}
				break;
			case TEST_NAME.UTILS.ONLY_NIN_WITH_ARRAY_FILTERS:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'tags', comparison: 'nin', value: ['t1'] }, { key: 'tags', comparison: 'nin', value: 't1' }, { key: 'category.name', comparison: 'nin', value: ['A'] }] };
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(1);
				}
				break;
			case TEST_NAME.UTILS.ASC_ORDER_PAG:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = {
					pagination: { sort: 'value', order: '1', skip: 0, limit: 2 },
					filters: null
				};
				mockDataFile.data = JSON.stringify([
					{ id: 3, value: 30, category: { name: 'A' }, tags: ['t1', 't3'] },
					{ id: 1, value: 10, category: { name: 'A' }, tags: ['t1', 't2'] },
					{ id: 3, value: 30, category: { name: 'A' }, tags: ['t1', 't3'] },
					{ id: 2, value: 20, category: { name: 'B' }, tags: ['t2', 't3'] },
				]);
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(2);
					expect((mockDataFile.data as unknown as { value: number }[]).map(el => el.value)).toEqual([10, 20]);
				}
				break;
			case TEST_NAME.UTILS.DESC_ORDER_PAG:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = {
					pagination: { sort: 'value', order: '-1', skip: 1, limit: 1 },
					filters: null
				};
				mockDataFile.data = JSON.stringify([
					{ id: 3, value: 30, category: { name: 'A' }, tags: ['t1', 't3'] },
					{ id: 1, value: 10, category: { name: 'A' }, tags: ['t1', 't2'] },
					{ id: 3, value: 30, category: { name: 'A' }, tags: ['t1', 't3'] },
					{ id: 2, value: 20, category: { name: 'B' }, tags: ['t2', 't3'] },
				]);
				instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
				expects = () => {
					expect(mockDataFile.data.length).toBe(1);
					expect((mockDataFile.data[0] as unknown as { value: number }).value).toBe(30);
				}
				break;
			case TEST_NAME.UTILS.INVALID_ORDER_PAG:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = {
					pagination: { sort: 'value', order: 'INVALID_ORDER', skip: 0, limit: 1 },
					filters: null
				};
				expects = () => {
					expect(() => {
						instance!.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
					}).toThrow(UniversalApiError);
				}
				break;
			case TEST_NAME.UTILS.DATA_NULL:
				mocks.utils.request.getPaginationAndFilters.shouldFail = true;
				mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: null };
				const nullDataFile = { ...mockDataFile, data: null };
				expects = () => {
					expect(() => {
						instance!.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, nullDataFile);
					}).not.toThrow();
					expect(nullDataFile.total).toBe(0);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_NULL:
				request = createMockRequest('GET');
				result = instance!.request.getPaginationAndFilters(request, undefined, undefined, null, null);
				expects = () => {
					expect(result!.pagination).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_QUERY_PARAM:
				request = createMockRequest('GET', { _limit: '10', _skip: '20', sort: "id", order: "1" });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{
						GET: {
							type: 'query-param',
							sort: "sor",
							order: "ord"
						}
					},
					null
				);
				expects = () => {
					expect(result!.pagination).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_QUERY_PARAM_INCOMPLETE:
				request = createMockRequest('GET', { _sort: '1', _order: '20' });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{
						GET: {
							type: 'query-param',
							limit: '_limit1',
							skip: '_skip1',
							sort: '_sort',
							order: '_order'
						}
					},
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual({
						limit: null,
						skip: null,
						sort: "1",
						order: "20"
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_BODY:
				request = createMockRequest('POST', {}, { meta: { page_size: '50', offset: '100', sort: "id", order: "1" } });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{
						POST: {
							type: "body",
							root: 'meta',
							limit: 'page_size',
							skip: 'offset',
							sort: "sort",
							order: "order"
						}
					},
					null
				);
				expects = () => {
					expect(result!.pagination?.limit).toBe(50);
					expect(result!.pagination?.skip).toBe(100);
					expect(result!.pagination?.sort).toBe("id");
					expect(result!.pagination?.order).toBe("1");
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_BODY_INCOMPLETE:
				request = createMockRequest('POST', {}, { meta: { page_size: '', offset: '', or: "", ss: "" } });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{
						POST: {
							type: "body",
							root: 'meta',
							limit: 'page_size',
							skip: 'offset',
							order: "or",
							sort: "ss"
						}
					},
					null
				);
				expects = () => {
					expect(result!.pagination).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_BODY_NO_VALUE:
				request = createMockRequest('POST', {}, { meta: { page_size: '', offset: '', or: "", ss: "" } });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{
						POST: {
							type: "body",
							root: 'meta',
							limit: 'page_size1',
							skip: 'offset1',
							order: "or1",
							sort: "ss1"
						}
					},
					null
				);
				expects = () => {
					expect(result!.pagination).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT:
				request = createMockRequest('POST', {}, { page_size: '50', offset: '100', sort: "id", order: 1 });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{
						POST: {
							type: "body",
							limit: 'page_size',
							skip: 'offset',
							order: 'order',
							sort: 'sort'
						}
					},
					null
				);
				expects = () => {
					expect(result!.pagination.limit).toBe(50);
					expect(result!.pagination.skip).toBe(100);
					expect(result!.pagination.sort).toBe("id");
					expect(result!.pagination.order).toBe(1);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT_INCOMPLETE:
				request = createMockRequest('POST', {}, { page_size: '50', offset: '100', sort: "id", order: 1 });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{
						POST: {
							type: "body",
							limit: 'page_size1',
							skip: 'offset1',
							order: 'order1',
							sort: 'sort1'
						}
					},
					null
				);
				expects = () => {
					expect(result!.pagination).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT_NO_VALUE:
				request = createMockRequest('POST', {}, { page_size: '', offset: '', sort: '', order: '' });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{
						POST: {
							type: "body",
							limit: 'page_size',
							skip: 'offset',
							sort: "sort",
							order: "order"
						}
					},
					null
				);
				expects = () => {
					expect(result!.pagination).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_PAG_ALL:
				request = createMockRequest('GET', { limit: '5' });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					{ ALL: { type: 'query-param', limit: 'limit' } },
					null
				);
				expects = () => {
					expect(result!.pagination?.limit).toBe(5);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_FILT_ALL:
				request = createMockRequest('POST', {}, { search_params: { status: "active" } });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					null,
					{
						ALL: {
							type: "body",
							root: 'search_params',
							filters: [{ key: 'status', valueType: 'string', comparison: 'eq' }, { key: 'id', valueType: 'string', comparison: 'eq' }]
						}
					}
				);
				expects = () => {
					expect(result!.filters![0]).toEqual({
						key: 'search_params.status',
						value: 'active',
						comparison: 'eq'
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_FILT_ALL_WITHOUT_ROOT:
				request = createMockRequest('POST', {}, { status: "active" });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					null,
					{
						ALL: {
							type: "body",
							filters: [
								{ key: 'status', valueType: 'string', comparison: 'eq' }, { key: 'id', valueType: 'string', comparison: 'eq' },
								{ key: 'id', valueType: 'string', comparison: 'eq' }, { key: 'id', valueType: 'string', comparison: 'eq' }
							]
						}
					}
				);
				expects = () => {
					expect(result!.filters![0]).toEqual({
						key: 'status',
						value: 'active',
						comparison: 'eq'
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_FILT_TYPE_MAPPING:
				request = createMockRequest(
					'GET',
					{ id: "1,2,3", active: true, type: 1, created: "2029-01-01", workedAt: "2029-01-01,2029-01-02", status: "PENDING,ACTIVE", d: "true,false", f: true }
				);
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					null,
					{
						GET: {
							type: 'query-param',
							filters: [
								{ key: 'id', valueType: 'number[]', comparison: 'eq' },
								{ key: 'active', valueType: 'boolean', comparison: 'eq' },
								{ key: 'type', valueType: 'number', comparison: 'eq' },
								{ key: 'created', valueType: 'date', comparison: 'eq' },
								{ key: 'workedAt', valueType: 'date[]', comparison: 'eq' },
								{ key: 'status', valueType: 'string[]', comparison: 'eq' },
								{ key: 'd', valueType: 'boolean[]', comparison: 'eq' },
								{ key: 'dd', valueType: 'boolean[]', comparison: 'eq' },
								{ key: 'f', valueType: val => !val, comparison: 'eq' }
							]
						}
					}
				);
				expects = () => {
					expect(result!.filters).toContainEqual({ key: 'id', value: [1, 2, 3], comparison: 'eq' });
					expect(result!.filters).toContainEqual({ key: 'active', value: true, comparison: 'eq' });
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_FILT_CUSTOM_FUNC:
				request = createMockRequest('POST', {}, { custom: 'hello' });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					null,
					{
						POST: {
							type: "body",
							filters: [
								{
									key: 'custom',
									valueType: (val: string) => val.toUpperCase(),
									comparison: 'eq'
								}
							]
						}
					}
				);
				expects = () => {
					expect(result!.filters![0].value).toBe('HELLO');
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_FILT_REGEX_FLAGS:
				request = createMockRequest('GET', { search: 'test' });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					undefined,
					null,
					{
						GET: {
							type: 'query-param',
							filters: [{ key: 'search', valueType: 'string', comparison: 'regex', regexFlags: 'i' }]
						}
					}
				);
				expects = () => {
					expect(result!.filters![0]).toMatchObject({
						key: 'search',
						regexFlags: 'i'
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_NONE:
				request = createMockRequest('GET', { limit: '10' });
				result = instance!.request.getPaginationAndFilters(
					request,
					"none",
					undefined,
					{ GET: { type: 'query-param', limit: 'limit' } },
					null
				);
				expects = () => {
					expect(result!.pagination).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE:
				request = createMockRequest('GET', { p_limit: '50', plugin_limit: '10' });
				result = instance!.request.getPaginationAndFilters(
					request,
					{ exclusive: { type: 'query-param', limit: 'p_limit' } },
					undefined,
					{ GET: { type: 'query-param', limit: 'plugin_limit' } },
					null
				);
				expects = () => {
					expect(result!.pagination?.limit).toBe(50);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_QUERY:
				request = createMockRequest('GET', { p_limit: '50', skip: "2", order: "id", sort: "1" });
				result = instance!.request.getPaginationAndFilters(
					request,
					{ exclusive: { type: 'query-param', limit: 'p_limit', skip: "skip", order: "order", sort: "sort" } },
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual({
						limit: 50,
						skip: 2,
						sort: "1",
						order: "id"
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_QUERY_INCOMPLETE:
				request = createMockRequest('GET', { p_limit: '50', skip: "2", order: "id", sort: "1" });
				result = instance!.request.getPaginationAndFilters(
					request,
					{ exclusive: { type: 'query-param', limit: 'p_limit1', skip: "skip1", order: "order1", sort: "sort1" } },
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual(null);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY:
				request = createMockRequest('POST', {}, { search_params: { limit: 10, skip: 5, sort: "status", order: 1 } });
				result = instance!.request.getPaginationAndFilters(
					request,
					{
						exclusive: {
							type: "body",
							root: 'search_params',
							limit: "limit",
							skip: "skip",
							sort: "sort",
							order: "order"
						}
					},
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual({
						limit: 10,
						skip: 5,
						sort: "status",
						order: 1
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_NO_VALUE:
				request = createMockRequest('POST', {}, { search_params: { limit: "", skip: "", sort: "", order: "" } });
				result = instance!.request.getPaginationAndFilters(
					request,
					{
						exclusive: {
							type: "body",
							root: 'search_params',
							limit: "limit",
							skip: "skip",
							sort: "sort",
							order: "order"
						}
					},
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual(null);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_INCOMPLETE:
				request = createMockRequest('POST', {}, { search_params: { limit: 10, skip: 5, sort: "status", order: 1 } });
				result = instance!.request.getPaginationAndFilters(
					request,
					{
						exclusive: {
							type: "body",
							root: 'search_params',
							limit: "limit1",
							skip: "skip1",
							sort: "sort1",
							order: "order1"
						}
					},
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual(null);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_WITHOUT_ROOT:
				request = createMockRequest('POST', {}, { limit: 10, skip: 5, sort: "status", order: 1 });
				result = instance!.request.getPaginationAndFilters(
					request,
					{
						exclusive: {
							type: "body",
							limit: "limit",
							skip: "skip",
							sort: "sort",
							order: "order"
						}
					},
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual({
						limit: 10,
						skip: 5,
						sort: "status",
						order: 1
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_WITHOUT_ROOT_NO_VALUE:
				request = createMockRequest('POST', {}, { limit: "", skip: "", sort: "", order: "" });
				result = instance!.request.getPaginationAndFilters(
					request,
					{
						exclusive: {
							type: "body",
							limit: "limit",
							skip: "skip",
							sort: "sort",
							order: "order"
						}
					},
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual(null);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_INCOMPLETE_WITHOUT_ROOT:
				request = createMockRequest('POST', {}, { limit: 10, skip: 5, sort: "status", order: 1 });
				result = instance!.request.getPaginationAndFilters(
					request,
					{
						exclusive: {
							type: "body",
							limit: "limit1",
							skip: "skip1",
							sort: "sort1",
							order: "order1"
						}
					},
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual(null);
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_PAG_INCLUSIVE:
				request = createMockRequest('GET', { p_skip: '100', plugin_limit: '10' });
				result = instance!.request.getPaginationAndFilters(
					request,
					{ inclusive: { type: 'query-param', skip: 'p_skip' } },
					undefined,
					{ GET: { type: 'query-param', limit: 'plugin_limit' } },
					null
				);
				expects = () => {
					expect(result!.pagination).toEqual({
						limit: 10,
						skip: 100,
						sort: null,
						order: null
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_FILT_INCLUSIVE:
				request = createMockRequest('GET', { f1: 'val1', f2: 'val2' });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					{
						inclusive: {
							type: 'query-param',
							filters: [{ key: 'f2', valueType: 'string', comparison: 'eq' }]
						}
					},
					null,
					{
						GET: {
							type: 'query-param',
							filters: [{ key: 'f1', valueType: 'string', comparison: 'eq' }]
						}
					}
				);
				expects = () => {
					expect(result!.filters).toHaveLength(2);
					expect((result!.filters as { key: string }[])?.map(f => f.key)).toContain('f1');
					expect((result!.filters as { key: string }[])?.map(f => f.key)).toContain('f2');
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_FILT_EXCLUSIVE:
				request = createMockRequest('POST', {}, { search_params: { status: "active" } });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					{
						exclusive: {
							type: "body",
							root: 'search_params',
							filters: [{ key: 'status', valueType: 'string', comparison: 'eq' }, { key: 'id', valueType: 'string', comparison: 'eq' }]
						}
					},
					null,
					null
				);
				expects = () => {
					expect(result!.filters![0]).toEqual({
						key: 'search_params.status',
						value: 'active',
						comparison: 'eq'
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_FILT_EXCLUSIVE_WITHOUT_ROOT:
				request = createMockRequest('POST', {}, { id: "1,2,3", active: true, type: 1, created: "2029-01-01", workedAt: "2029-01-01,2029-01-02", status: "PENDING,ACTIVE", d: "true,false", f: true });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					{
						exclusive: {
							type: "body",
							filters: [
								{ key: 'id', valueType: 'number[]', comparison: 'eq' },
								{ key: 'active', valueType: 'boolean', comparison: 'eq' },
								{ key: 'type', valueType: 'number', comparison: 'eq' },
								{ key: 'created', valueType: 'date', comparison: 'eq' },
								{ key: 'workedAt', valueType: 'date[]', comparison: 'eq' },
								{ key: 'status', valueType: 'string[]', comparison: 'eq' },
								{ key: 'd', valueType: 'boolean[]', comparison: 'eq' },
								{ key: 'f', valueType: val => !val, comparison: 'eq' }
							]
						}
					},
					null,
					null
				);
				expects = () => {
					expect(result!.filters![0]).toEqual({
						key: 'id',
						value: [1, 2, 3],
						comparison: 'eq'
					});
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_FILT_NONE:
				request = createMockRequest('GET', { f1: 'v1' });
				result = instance!.request.getPaginationAndFilters(
					request,
					undefined,
					"none",
					null,
					{ GET: { type: 'query-param', filters: [{ key: 'f1', valueType: 'string', comparison: 'eq' }] } }
				);
				expects = () => {
					expect(result!.filters).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_PAG_AND_FILTERS_HANDLER_NULL:
				request = createMockRequest('POST', {}, { data: {} });
				result = instance!.request.getPaginationAndFilters(
					request,
					{ exclusive: { type: "body", root: 'data', limit: 'limit' } },
					undefined,
					null,
					null
				);
				expects = () => {
					expect(result!.pagination).toBeNull();
				}
				break;
			case TEST_NAME.UTILS.GET_CLEAN_BODY_ARRAY:
				request = createMockRequest('POST', {}, { data: {} });
				result = instance!.request.getCleanBody(
					"POST",
					[{ id: 0 }],
					{
						"inclusive": {
							type: "body",
							limit: "limit",
							skip: "skip",
							sort: "sort",
							order: "order"
						}
					},
					{
						"inclusive": {
							type: "body",
							filters: [{ key: "d", valueType: "string", comparison: "eq" }]
						}
					},
					{
						POST: {
							type: "body",
							limit: "limit1",
							skip: "skip1",
							sort: "sort1",
							order: "order1"
						}
					},
					{
						POST: {
							type: "body",
							filters: [{ key: "dq", valueType: "string", comparison: "eq" }]
						}
					}
				);
				expects = () => {
					expect(result![0].id).toBe(0);
				}
				break;
			case TEST_NAME.UTILS.GET_CLEAN_BODY_OBJECT:
				request = createMockRequest('POST', {}, { data: {} });
				result = instance!.request.getCleanBody(
					"POST",
					{ id: 0 },
					{
						"inclusive": {
							type: "body",
							limit: "limit",
							skip: "skip",
							sort: "sort",
							order: "order"
						}
					},
					{
						"inclusive": {
							type: "body",
							filters: [{ key: "d", valueType: "string", comparison: "eq" }]
						}
					},
					{
						POST: {
							type: "body",
							limit: "limit1",
							skip: "skip1",
							sort: "sort1",
							order: "order1"
						}
					},
					{
						POST: {
							type: "body",
							filters: [{ key: "dq", valueType: "string", comparison: "eq" }]
						}
					}
				);
				expects = () => {
					expect(result!.id).toBe(0);
				}
				break;
			case TEST_NAME.UTILS.PARSE_REQUEST_DISABLED:
				request = createMockRequest('POST', {}, { data: {} });
				result = await instance!.request.parseRequest(request, res, fullUrlMock, false, loggerMock);
				expects = () => {
					expect(result!).toBe(undefined);
				}
				break;
			case TEST_NAME.UTILS.PARSE_REQUEST_OBJECT_PARSER:
				request = createMockRequest('POST', {}, { data: {} });
				try {
					result = await instance!.request.parseRequest(
						request,
						res,
						fullUrlMock,
						{
							parser: [
								(req, res, next) => {
									throw Error("generic");
								}
							],
							transform: req => {
								return {};
							}
						},
						loggerMock
					);
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result!).toBe("Error parsing request");
				}
				break;
			case TEST_NAME.UTILS.PARSE_REQUEST_MULTIPART_URL_ENCODED:
				multipart = createMultipartBody(new URLSearchParams({ "id": "1", "name": "Test 11" }));
				const reque = createMockRequest('POST', {}, {});
				request = new PassThrough() as any;
				Object.assign(
					request,
					{
						...reque,
						headers: {
							"content-type": multipart.contentType,
							"content-length": multipart.contentLength.toString()
						}
					}
				);
				request.write(multipart.body);
				request.end();
				result = await instance!.request.parseRequest(request, res, fullUrlMock, true, loggerMock);
				expects = () => {
					expect(result!).toBe(undefined);
				}
				break;
			case TEST_NAME.UTILS.PARSE_REQUEST_MULTIPART_BINARY:
				multipart = createMultipartBody({
					document: {
						filename: 'fake.jpg',
						contentType: 'image/jpeg',
						content: randomBytes(2048)
					}
				});
				const requ = createMockRequest('POST', {}, {});
				request = new PassThrough() as any;
				Object.assign(
					request,
					{
						...requ,
						headers: {
							"content-type": multipart.contentType,
							"content-length": multipart.contentLength.toString()
						}
					}
				);
				request.write(multipart.body);
				request.end();
				result = await instance!.request.parseRequest(request, res, fullUrlMock, true, loggerMock);
				expects = () => {
					expect(request!.files!.length).toBe(1);
				}
				break;
			case TEST_NAME.UTILS.MERGE_BODY_CHUNK_ERROR:
				req = new PassThrough();
				const promise = instance!.request.mergeBodyChunk(req);
				process.nextTick(() => {
					req.emit('error', new Error('generic'));
				});
				try {
					result = await promise;
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result!).toBe("Error parsing request body");
				}
				break;
			case TEST_NAME.UTILS.MATCH_ENDPOINT_PREFIX:
				result = instance!.request.matchesEndpointPrefix("", []);
				expects = () => {
					expect(result!).toBe(false);
				}
				break;
			case TEST_NAME.UTILS.ADD_SLASH:
				result = instance!.request.addSlash("/aa", "trailing");
				expects = () => {
					expect(result!).toBe("/aa/");
				}
				break;
			case TEST_NAME.UTILS.IS_DIR_EXIST:
				try {
					result = await instance!.files.isDirExists(path.join(process.cwd(), 'TODO.md'.repeat(5000)));
				} catch (error) {
					result = (error as Error).message
				}
				expects = () => {
					const IS_ENAMETOOLONG = result!.includes('ENAMETOOLONG');
					expect(IS_ENAMETOOLONG).toBe(true);
				}
				break;
			case TEST_NAME.UTILS.MK_DIR_ERROR:
				try {
					result = await instance!.files.createDir(path.join(process.cwd(), 'README.md', "t"));
				} catch (error) {
					result = (error as Error).message
				}
				expects = () => {
					const res = result!.includes('ENOTDIR');
					expect(res).toBe(true);
				}
				break;
			case TEST_NAME.UTILS.DIR_FILE_LIST_ENOTDIR:
				try {
					result = await instance!.files.directoryFileList(path.join(process.cwd(), 'README.md'));
				} catch (error) {
					result = (error as Error).message
				}
				expects = () => {
					expect(result!).toStrictEqual([]);
				}
				break;
			case TEST_NAME.UTILS.DIR_FILE_LIST_ERROR:
				try {
					result = await instance!.files.directoryFileList(path.join(process.cwd(), 'TODO'));
				} catch (error) {
					result = (error as Error).message
				}
				expects = () => {
					const res = result!.includes('ENOENT');
					expect(res).toBe(true);
				}
				break;
			case TEST_NAME.UTILS.IS_FILE_EXIST:
				try {
					result = await instance!.files.isFileExists(path.join(process.cwd(), 'TODO.md'.repeat(5000)));
				} catch (error) {
					result = (error as Error).message
				}
				expects = () => {
					const res = result!.includes('ENAMETOOLONG');
					expect(res).toBe(true);
				}
				break;
			case TEST_NAME.UTILS.READING_FILE_ERROR:
				try {
					result = await instance!.files.readingFile(path.join(process.cwd(), 'TODO.md'.repeat(5000)));
				} catch (error) {
					result = (error as Error).message
				}
				expects = () => {
					const res = result!.includes('ENAMETOOLONG');
					expect(res).toBe(true);
				}
				break;
			case TEST_NAME.UTILS.WRITING_FILE_ERROR:
				try {
					result = await instance!.files.writingFile(path.join(MOCK_DIR.PATH, 'example'), true, { id: 0 }, null, false);
				} catch (error) {
					result = (error as Error).message
				}
				expects = () => {
					const res = result!.includes('ENOENT');
					expect(res).toBe(true);
				}
				break;
			case TEST_NAME.UTILS.REMOVE_FILE_ERROR:
				try {
					result = await instance!.files.removeFile(path.join(MOCK_DIR.PATH, 'example'));
				} catch (error) {
					result = (error as Error).message
				}
				expects = () => {
					const res = result!.includes('ENOENT');
					expect(res).toBe(true);
				}
				break;
			case TEST_NAME.UTILS.GET_BYTE_LENGTH_ERROR:
				try {
					result = instance!.files.getByteLength({ id: 1n });
				} catch (error) {
					result = error;
				}
				expects = () => {
					expect(result!).toBeInstanceOf(Error);
				}
				break;
			case TEST_NAME.UTILS.APPLYING_PATCH_JSON_ERROR:
				try {
					result = instance!.files.applyingPatch({ id: 1n }, {}, "json");
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result!).toBe("PATCH body request malformed");
				}
				break;
			case TEST_NAME.UTILS.APPLYING_PATCH_JSON_OP_ERROR:
				try {
					result = instance!.files.applyingPatch({ id: 1n }, [{}], "json");
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result!).toBe("PATCH body request malformed");
				}
				break;
			case TEST_NAME.UTILS.APPLYING_PATCH_JSON_OP_REMOVE:
				result = instance!.files.applyingPatch([{ id: 1n }, { name: "asd" }], [{ op: "remove", path: "/name" }], "json");
				expects = () => {
					expect(result![0].name).toBe("asd");
				}
				break;
			case TEST_NAME.UTILS.APPLYING_PATCH_JSON_OP_REMOVE_ERROR:
				try {
					result = instance!.files.applyingPatch({ id: 1n }, [{ op: "remove", path: "/names" }], "json");
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result!).toBe("PATCH body request malformed");
				}
				break;
			case TEST_NAME.UTILS.APPLYING_PATCH_JSON_OP_REPLACE_ERROR:
				try {
					result = instance!.files.applyingPatch({ id: 1n }, [{ op: "replace", path: "/names" }], "json");
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result!).toBe("PATCH body request malformed");
				}
				break;
			case TEST_NAME.UTILS.APPLYING_PATCH_JSON_OP_MOVE:
				try {
					result = instance!.files.applyingPatch([{ id: 1n }, { name: "asd" }], [{ op: "move", path: "/name", from: "/id" }], "json");
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result![0]).toBe(undefined);
				}
				break;
			case TEST_NAME.UTILS.APPLYING_PATCH_JSON_OP_COPY:
				try {
					result = instance!.files.applyingPatch([{ id: 1n }, { name: "asd" }], [{ op: "copy", path: "/name", from: "/id" }], "json");
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result![0]).toBe(undefined);
				}
				break;
			case TEST_NAME.UTILS.APPLYING_PATCH_JSON_OP_COPY_ERROR:
				try {
					result = instance!.files.applyingPatch({ id: 1n }, [{ op: "replace", path: "names/ids" }], "json");
				} catch (error) {
					result = (error as Error).message;
				}
				expects = () => {
					expect(result!).toBe("PATCH body request malformed");
				}
				break;
			case TEST_NAME.UTILS.DETECT_CLIENT_EXTENSION: {
				const request = {
					headers: {
						"sec-websocket-extensions": 'permessage-deflate; server_max_window_bits=12'
					}
				} as unknown as IncomingMessage;
				const res: ReturnType<typeof Utils.ws.detectClientExtensions> = Utils.ws.detectClientExtensions(request);
				expects = () => {
					expect(res[0].name).toBe("permessage-deflate");
					expect(res[0].params.server_max_window_bits).toBe('12')
				}
				break;
			}
			case TEST_NAME.UTILS.DETECT_DEFLATE_OPTIONS_1: {
				const ext = [{
					name: 'permessage-deflate',
					params: {
						server_max_window_bits: '12',
					}
				}];
				const res: ReturnType<typeof Utils.ws.detectClientDeflateOptions> = Utils.ws.detectClientDeflateOptions(ext);
				expects = () => {
					expect(res!.server_max_window_bits).toBe(12);
					expect(res!.client_no_context_takeover).toBe(undefined);
					expect(res!.client_max_window_bits).toBe(undefined);
				}
				break;
			}
			case TEST_NAME.UTILS.DETECT_DEFLATE_OPTIONS_2: {
				const res2: ReturnType<typeof Utils.ws.detectClientDeflateOptions> = Utils.ws.detectClientDeflateOptions([]);
				expects = () => {
					expect(res2).toBeNull();
				}
				break;
			}
			case TEST_NAME.UTILS.DETECT_DEFLATE_OPTIONS_3: {
				const ext = [{
					name: 'permessage-deflate',
					params: {
						server_max_window_bits: '18',
						client_max_window_bits: '8'
					}
				}];
				const res: ReturnType<typeof Utils.ws.detectClientDeflateOptions> = Utils.ws.detectClientDeflateOptions(ext);
				expects = () => {
					expect(res!.server_max_window_bits).toBe(undefined);
					expect(res!.client_max_window_bits).toBe(8);
				}
				break;
			}
			case TEST_NAME.UTILS.HANDSHAKE_1: {
				const request = {
					headers: {
						'sec-websocket-protocol': 'chat, superchat, websocket'
					}
				} as IncomingMessage;

				const serverProtocols = ['superchat', 'otherchat'];
				const res: ReturnType<typeof Utils.ws.handshake> = Utils.ws.handshake(request, "dd", loggerMock, undefined, serverProtocols);
				expects = () => {
					expect(res.subprotocol).toBe('superchat');
				}
				break;
			}
			case TEST_NAME.UTILS.HANDSHAKE_2: {
				const deflateOptions = {
					server_no_context_takeover: true,
					client_no_context_takeover: false,
					server_max_window_bits: 12,
					client_max_window_bits: 15
				};
				const ext = ['permessage-deflate'];
				Object.entries(deflateOptions).forEach(([key, value]) => {
					if (typeof value === 'boolean') {
						value
							? ext.push(key)
							: ext.push(`${key}=${value}`);
					} else {
						ext.push(`${key}=${value}`);
					}
				});
				const extensionHeader = ext.join('; ');
				const request = {
					headers: {
						'sec-websocket-extensions': extensionHeader
					}
				} as IncomingMessage;
				const perMessageDeflate: PerMessageDeflateExension = {
					serverNoContextTakeover: false,
					clientNoContextTakeover: false,
					serverMaxWindowBits: 12,
					clientMaxWindowBits: 12,
					strict: false
				}
				const perMessageDeflate2: PerMessageDeflateExension = {
					serverNoContextTakeover: false,
					clientNoContextTakeover: false,
					serverMaxWindowBits: 12,
					clientMaxWindowBits: 12,
					strict: true
				}
				const perMessageDeflate3: PerMessageDeflateExension = {
					serverNoContextTakeover: true,
					clientNoContextTakeover: true,
					serverMaxWindowBits: 12,
					clientMaxWindowBits: 12,
					strict: true
				}
				const perMessageDeflate4: PerMessageDeflateExension = {
					serverNoContextTakeover: true,
					clientNoContextTakeover: false,
					serverMaxWindowBits: 11,
					clientMaxWindowBits: 12,
					strict: true
				}
				const perMessageDeflate5: PerMessageDeflateExension = {
					serverNoContextTakeover: true,
					clientNoContextTakeover: false,
					serverMaxWindowBits: 12,
					clientMaxWindowBits: 11,
					strict: true
				}
				const res: ReturnType<typeof Utils.ws.handshake> = Utils.ws.handshake(request, "dd", loggerMock, true, undefined);
				const res2: ReturnType<typeof Utils.ws.handshake> = Utils.ws.handshake(request, "dd", loggerMock, perMessageDeflate, undefined);
				const res3: ReturnType<typeof Utils.ws.handshake> = Utils.ws.handshake({ headers: { 'sec-websocket-extensions': "permessage-deflate;" } } as IncomingMessage, "dd", loggerMock, true, undefined);
				const res4: ReturnType<typeof Utils.ws.handshake> = Utils.ws.handshake(request, "dd", loggerMock, false, undefined);
				expects = () => {
					expect(res4.deflateOptions).toBe(null);
					expect(res3.deflateOptions).toBe(null);
					expect(res.headers).toContain('permessage-deflate');
					expect(res.headers).toContain('server_no_context_takeover');
					expect(res.headers).toContain('client_no_context_takeover');
					expect(res.headers).toContain('server_max_window_bits=12');
					expect(res.headers).toContain('client_max_window_bits=15');
					expect(res2.headers).toContain('permessage-deflate');
					expect(res2.headers).toContain('server_no_context_takeover');
					expect(res2.headers).toContain('server_max_window_bits=12');
					expect(res2.headers).toContain('client_max_window_bits=15');
					expect(Utils.ws.handshake({ headers: { 'sec-websocket-extensions': "permessage-deflate; server_no_context_takeover" } } as IncomingMessage, "dd", loggerMock, perMessageDeflate3, undefined).deflateOptions!.server_no_context_takeover).toBe(true);
					expect(Utils.ws.handshake({ headers: { 'sec-websocket-extensions': "permessage-deflate; client_no_context_takeover" } } as IncomingMessage, "dd", loggerMock, perMessageDeflate3, undefined).deflateOptions!.server_no_context_takeover).toBe(true);
					expect(() => Utils.ws.handshake({ headers: { 'sec-websocket-extensions': extensionHeader } } as IncomingMessage, "dd", loggerMock, perMessageDeflate2, undefined)).toThrow(Constants.WEB_SOCKET.PER_MESSAGE_DEFLATE_STRICT_ERROR);
					expect(() => Utils.ws.handshake({ headers: { 'sec-websocket-extensions': extensionHeader } } as IncomingMessage, "dd", loggerMock, perMessageDeflate3, undefined)).toThrow(Constants.WEB_SOCKET.PER_MESSAGE_DEFLATE_STRICT_ERROR);
					expect(() => Utils.ws.handshake({ headers: { 'sec-websocket-extensions': extensionHeader } } as IncomingMessage, "dd", loggerMock, perMessageDeflate4, undefined)).toThrow(Constants.WEB_SOCKET.PER_MESSAGE_DEFLATE_STRICT_ERROR);
					expect(() => Utils.ws.handshake({ headers: { 'sec-websocket-extensions': extensionHeader } } as IncomingMessage, "dd", loggerMock, perMessageDeflate5, undefined)).toThrow(Constants.WEB_SOCKET.PER_MESSAGE_DEFLATE_STRICT_ERROR);
				}
				break;
			}
			case TEST_NAME.UTILS.HANDSHAKE_3: {
				const extensions = ['permessage-deflate'];
				const request = {
					headers: {
						'sec-websocket-extensions': 'other-extension'
					}
				} as IncomingMessage;
				const res: ReturnType<typeof Utils.ws.handshake> = Utils.ws.handshake(request, "dd", loggerMock, false, ["chat"]);
				expects = () => {
					expect(res.headers).not.toContain("sec-websocket-extensions");
				}
				break;
			}
			case TEST_NAME.UTILS.TRANSFORM_PAYLOAD_TO_MESSAGE_1: {
				const payload = Buffer.from(JSON.stringify({ type: 'test', value: 123 }));
				const opCode = 0x01;
				const {result, message} = Utils.ws.transformPayloadToMessage(payload, opCode);
				expects = () => {
					expect(message).toEqual({ type: 'test', value: 123 });
					expect(result).toBe(true);
				}
				break;
			}
			case TEST_NAME.UTILS.TRANSFORM_PAYLOAD_TO_MESSAGE_2: {
				const payload = Buffer.from('plain text message');
				const opCode = 0x01;
				const {result, message} = Utils.ws.transformPayloadToMessage(payload, opCode);
				expects = () => {
					expect(message).toBe('plain text message');
				}
				break;
			}
			case TEST_NAME.UTILS.TRANSFORM_PAYLOAD_TO_MESSAGE_3: {
				const payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
				const opCode = 0x02;
				const {result, message} = Utils.ws.transformPayloadToMessage(payload, opCode);
				expects = () => {
					expect(message).toEqual(payload);
					expect(result).toBe(true);
				}
				break;
			}
			case TEST_NAME.UTILS.TRANSFORM_PAYLOAD_TO_MESSAGE_4: {
				const payload = Buffer.from('test');
				const opCode = 0x05;
				const {result, message} = Utils.ws.transformPayloadToMessage(payload, opCode);
				expects = () => {
					expect(result).toBe(false);
					expect(message).toEqual(payload);
				}
				break;
			}
			case TEST_NAME.PLUGIN.LOG_DEBUG:
				executeMiddleware = false;
				delete mockOptions.endpointPrefix;
				delete mockOptions.fsDir;
				mockOptions.logLevel = "debug";
				expects = () => {
					expect(logSpy).toBeCalledTimes(9);
				}
				break;
			case TEST_NAME.PLUGIN.LOG_INFO:
				executeMiddleware = false;
				delete mockOptions.endpointPrefix;
				delete mockOptions.fsDir;
				mockOptions.logLevel = "info";
				expects = () => {
					expect(logSpy).toBeCalledTimes(3);
				}
				break;
			case TEST_NAME.PLUGIN.LOG_WARN_NO_PREFIX:
				executeMiddleware = false;
				delete mockOptions.fsDir;
				mockOptions.logLevel = "warn";
				mockOptions.endpointPrefix = [];
				expects = () => {
					expect(logSpy).toBeCalledTimes(4);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DISABLED:
				executeMiddleware = false;
				delete mockOptions.endpointPrefix;
				delete mockOptions.fsDir;
				mockOptions.logLevel = "debug",
					mockOptions.disable = true;
				expects = () => {
					expect(logSpy).toHaveBeenCalledTimes(5);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.LOG_DEBUG:
				executeMiddleware = false;
				delete mockOptions.endpointPrefix;
				delete mockOptions.fsDir;
				mockOptions.logLevel = "debug",
					expects = () => {
						expect(logSpy).toHaveBeenCalledTimes(9);
					}
				break;
			case TEST_NAME.CONFIGURE_SERVER.NO_MATCH_PREFIX:
				req.url = "/apis/users";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Request doesn't match endpointPrefix");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.NO_REQ_HANDLER:
				delete mockOptions.fsDir;
				req.url = "/api/users/all";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Impossible handling request with url http://localhost/api/users/all");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.NO_FILE_FOUND:
				req.url = "/api/address/all";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Not found");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.NO_NESTED_FILE_FOUND:
				fs.mkdirSync(path.join(MOCK_DIR.PATH, "address"));
				req.url = "/api/address/all";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Not found");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERR_READING_FILE:
				mocks.readStream.shouldFail = true;
				req.url = "/api/users";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe(`Error reading file ${path.join(MOCK_DIR.PATH, "users.json")}`);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERR_WRITING_RESPONSE:
				res.write = (...args: unknown[]) => {
					responseData = (args[0] as string).toString();
					args[1] && (args[1] as ((err: Error) => void))(Error("generic"));
				};
				mockOptions.pagination = {
					GET: {
						type: "query-param",
						limit: "limit",
						skip: "skip",
						sort: "sort",
						order: "order"
					}
				}
				req.url = "/api/users?limit=1&skip=0&order=-1&sort=id";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error writing response");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERR_WRITING_RESPONSE_CATCH:
				res.write = (...args: unknown[]) => {
					responseData = (args[0] as string).toString();
					if (args[1]) {
						(args[1] as ((err: Error) => void))(Error("generic"));
					} else {
						throw new Error("generic")
					}
				};
				mockOptions.pagination = {
					GET: {
						type: "query-param",
						limit: "limit",
						skip: "skip",
						sort: "sort",
						order: "order"
					}
				}
				req.url = "/api/users?limit=1&skip=0&order=-1&sort=id";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error writing response");
					expect(next).toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.NO_HANDLER_FORWARD:
				mockOptions.noHandledRestFsRequestsAction = "forward";
				req.method = "TRACE";
				expects = () => {
					expect(next).toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.NO_HANDLER_404:
				mockOptions.noHandledRestFsRequestsAction = "404";
				req.method = "TRACE";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Impossible handling request with url http://localhost/api/users");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.UNRECOGNIZED_ERROR:
				mocks.utils.request.removeSlash.shouldFail = true;
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.WITHOUT_DIR:
				delete mockOptions.fsDir;
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Request matching Api Rest Fs handler but fsDir provide doesn't exists");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PRE_HANDLER_TRANSFORM_OBJ:
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/product",
						preHandle: {
							transform: [
								{
									searchValue: "product",
									replaceValue: "users"
								}
							]
						}
					}
				];
				req.url = "/api/product";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse[0].id).toBe(0);
					expect(jsonResponse[0].name).toBe("Test");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PRE_HANDLER_TRANSFORM_FUNC:
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/product",
						preHandle: {
							transform: (pathname) => {
								return "/api/users";
							}
						}
					}
				];
				req.url = "/api/product";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse[0].id).toBe(0);
					expect(jsonResponse[0].name).toBe("Test");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST_HANDLER:
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/product",
						postHandle(req, res, data) {
							res.statusCode = 200;
							res.write(data);
							res.end();
						},
					}
				];
				req.url = "/api/product";
				expects = () => {
					expect(res.setHeader).not.toHaveBeenCalled();
					expect(res.statusCode).toBe(200);
					expect(responseData).toBe("Product 1");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST_HANDLER_JSON:
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users",
						postHandle(req, res, data) {
							res.statusCode = 200;
							res.write(data);
							res.end();
						},
					}
				];
				req.url = "/api/users";
				expects = () => {
					expect(res.setHeader).not.toHaveBeenCalled();
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse[0].id).toBe(0);
					expect(jsonResponse[0].name).toBe("Test");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST_HANDLER_FILE_NOT_FOUND:
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/product1",
						postHandle(req, res, data) {
							res.statusCode = 404;
							res.end();
						},
					}
				];
				req.url = "/api/product1";
				expects = () => {
					expect(res.setHeader).not.toHaveBeenCalled();
					expect(res.statusCode).toBe(404);
					expect(responseData).toBe("");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST_HANDLER_ERROR:
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/product",
						postHandle(req, res, data) {
						},
					}
				];
				req.url = "/api/product";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("FS REST Handle request not send any response");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.HANDLER_DISABLED:
				mockOptions.logLevel = "debug";
				mockOptions.handlers = [
					{
						handle: "FS",
						disabled: true,
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(logSpy).toHaveBeenCalledWith("\x1b[1;93mvite-plugin-universal-api\x1b[0m handlingApiRestRequest: Request handler is disabled\n");
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse[0].id).toBe(0);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.HANDLER_DIFFERENT_METHOD:
				mockOptions.logLevel = "debug";
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "POST",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(logSpy).toHaveBeenCalledWith("\x1b[1;93mvite-plugin-universal-api\x1b[0m handlingApiRestRequest: Request url and handler have different http method\n");
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse[0].id).toBe(0);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.HANDLER_DELAYED:
				delete mockOptions.fsDir;
				mockOptions.logLevel = "debug";
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users",
						delay: 10
					}
				];
				expects = () => {
					expect(logSpy).toHaveBeenCalledWith("\x1b[1;93mvite-plugin-universal-api\x1b[0m handlingApiRestRequest: request execution will be delayed by 10\n");
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Request matching Api Rest Fs handler but fsDir provide doesn't exists");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.API_REST_CUSTOM_PARSER:
				mockOptions.handlers = [{
					pattern: "/user2",
					method: "PUT",
					handle: "FS",
					parser: {
						async parser(request, res, next) {
							let body: any = null;
							const files: any[] | null = null;
							const mergedChunk = await Utils.request.mergeBodyChunk(request);
							const contentType = request.headers["content-type"] || "";
							const boundary = contentType.split("boundary=")[1];
							const parts: Record<string, string>[] = [];
							const boundaryStr = `--${boundary}`;
							const endBoundaryStr = `--${boundary}--`;

							const bodyWithouEndBoundary = mergedChunk!.split(endBoundaryStr)[0];
							const rawParts: string[] = bodyWithouEndBoundary.split(boundaryStr).filter((part: string) => part.trim() !== '');

							rawParts.forEach(part => {
								const partData: Record<string, string> = {};
								const headersAndBody = part.split('\r\n\r\n');
								const headers = headersAndBody[0].trim();
								const body = headersAndBody[1];
								const headerLines = headers.split("\r\n");

								headerLines.forEach(line => {
									const [key, value] = line.split(": ");
									if (key && value) {
										partData[key.toLowerCase()] = value;
									}
								})

								partData.body = body.trim();
								parts.push(partData);
							});
							parts.forEach(part => {
								if (part["content-disposition"]) {
									const disposition = part["content-disposition"];
									const partContentType = part["content-type"] || "text/plain";
									const IS_FILE = disposition.indexOf("filename=") !== -1;
									const splitted = disposition.split(";");
									let name = splitted[1];
									const filename = splitted[2];
									if (name && name.includes("name=")) {
										name = name.split("name=")[1].replace(/"/g, "");
									}
									let data;
									if (partContentType.includes("application/json")) {
										data = JSON.parse(part.body);
									} else if (partContentType.includes("text")) {
										data = part.body;
									} else if (partContentType.includes("application/x-www-form-urlencoded")) {
										data = new URLSearchParams(part.body);
									} else {
										data = Buffer.from(part.body, "binary");
									}
									body = {};
									name
										? (body[name] = data)
										: (body = name);
								}
							});
							(request as IncomingMessage & { body: any }).body = body;
						},
						transform(req) {
							return {
								body: (req as IncomingMessage & { body: any }).body.user
							}
						},
					}
				}];
				multipart = createMultipartBody({
					user: "User 1"
				});
				req.url = "/api/user2";
				req.method = "PUT";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.statusCode).toBe(201);
					const file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.txt"), { encoding: "utf-8" });
					expect(file).toBeDefined();
					expect(file).toBe("User 1");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.API_REST_ERROR:
				mocks.utils.request.parseRequest.shouldFail = true;
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER:
				mockOptions.handlerMiddlewares = [
					(req, res, next) => {
						console.log("first handlerMiddleware");
						next();
					},
					(req, res, next) => {
						throw Error("generic");
					}
				];
				mockOptions.errorMiddlewares = [
					(err, req, res, next) => {
						res.statusCode = 500;
						res.write(err.message);
						res.end();
					}
				];
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(res.statusCode).toBe(500);
					expect(responseData).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER_THROW_ERROR:
				mockOptions.handlerMiddlewares = [
					(req, res, next) => {
						throw Error("generic");
					}
				];
				mockOptions.errorMiddlewares = [
					(err, req, res, next) => {
						throw err;
					},
				];
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER_NO_RESPONSE:
				mockOptions.handlerMiddlewares = [
					(req, res, next) => {
						throw Error("generic");
					}
				];
				mockOptions.errorMiddlewares = [
					(err, req, res, next) => {
						throw err;
					},
					(err, req, res, next) => {
						console.log("error");
					},
				];
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.API_REST_MIDDLEWARE_CHAIN_ERROR:
				mocks.utils.request.MiddlewaresChainUse.shouldFail = true;
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.API_REST_GENERIC_ERROR:
				mocks.utils.request.MiddlewaresChain.shouldFail = true;
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.HANDLER_EXECUTION:
				mockOptions.handlers = [
					{
						pattern: "/product",
						method: "GET",
						handle: (req, res) => {
							res.setHeader("content-type", "application/json");
							res.statusCode = 200;
							res.write(JSON.stringify([{ id: 0, name: "Test" }]));
							res.end();
						}
					}
				];
				req.url = "/api/product";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse[0].id).toBe(0);
					expect(jsonResponse[0].name).toBe("Test");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GATEWAY_TIMEOUT:
				mockOptions.delay = 200;
				mockOptions.gatewayTimeout = 100;
				mockOptions.handlers = [{
					handle: "FS",
					method: "DELETE",
					pattern: "/users"
				}];
				req.method = "DELETE";
				expects = async () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(504);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Gateway Timeout");
					expect(next).not.toHaveBeenCalled();
					return new Promise(res => {
						setTimeout(() => {
							let result;
							try {
								const stat = fs.statSync(path.join(MOCK_DIR.PATH, "users.json"));
								result = stat.isFile();
							} catch (error) {
								expect(result).toBe(undefined);
								result = false;
							}
							expect(result).toBe(false);
							res();
						}, 500);
					})
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.API_REST_UNRECOGNIZED_ERROR:
				mocks.utils.request.MiddlewaresChainHandle.shouldFail = true;
				mockOptions.handlers = [
					{
						handle: "FS",
						method: "GET",
						pattern: "/users"
					}
				];
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.NEXT_INVOCATION:
				mocks.utils.response.settingResponse.shouldFail = true;
				req.method = "HEAD";
				expects = () => {
					expect(next).toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.INTERNAL_GENERIC_ERROR:
				mocks.utils.request.createRequest.shouldFail = true;
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERROR_MIDDLEWARE:
				mockOptions.errorMiddlewares = [
					(err, req, res, next) => {
						next(err);
					},
					(err, req, res, next) => {
						res.statusCode = 404;
						res.write(err.message);
						res.end();
					}
				]
				req.url = "/apis/users";
				expects = () => {
					expect(res.statusCode).toBe(404);
					expect(responseData).toBe("Request doesn't match endpointPrefix");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERROR_MIDDLEWARE_NO_WRITE:
				mockOptions.errorMiddlewares = [
					(err, req, res, next) => {
						res.statusCode = 500;
					}
				]
				req.url = "/apis/users";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Request doesn't match endpointPrefix");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERROR_MIDDLEWARE_THROW_ERROR:
				mockOptions.errorMiddlewares = [
					(err, req, res, next) => {
						throw Error('generic');
					},
					(err, req, res, next) => {
						throw err;
					}
				]
				req.url = "/apis/users";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERROR_MIDDLEWARE_THROW_NEXT_ERROR:
				mockOptions.errorMiddlewares = [
					(err, req, res, next) => {
						throw Error('generic');
					},
					(err, req, res, next) => {
						next(err);
					}
				]
				req.url = "/apis/users";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("generic");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERROR_SETTING_JSON_RESPONSE:
				originalStringify.matchValue = JSON.stringify([{ id: 1, name: "Test 1" }])
				let alreadyPass = 0;
				originalStringify.conditionForFail = (currText, match) => {
					if (currText === match) {
						alreadyPass++;
					}
					return alreadyPass === 2;
				}
				mockOptions.pagination = {
					GET: {
						type: "query-param",
						limit: "limit",
						skip: "skip",
						sort: "sort",
						order: "order"
					}
				}
				req.url = "/api/users?limit=1&skip=0&order=-1&sort=id";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error parsing body response");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERROR_READING_FILE_HEAD:
				mocks.parse.shouldFail = true;
				mocks.parse.shouldFailAt = 1;
				req.method = "HEAD";
				req.url = "/api/product";
				expects = () => {
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Failed to send stream data");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERROR_READING_FILE_STREAM_ERROR:
				mocks.readStream.shouldFail = true;
				req.url = "/api/product";
				expects = () => {
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Failed to send stream data");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.ERROR_READING_FILE_RESP_ERROR:
				mocks.readStreamPipe.shouldFail = true;
				req.url = "/api/product";
				expects = () => {
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Failed to send stream data");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.HEAD.OK:
				req.method = "HEAD";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					expect(responseData).toBe("");
					expect(res.setHeader).toHaveBeenCalledWith(Constants.TOTAL_ELEMENTS_HEADER, 2);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.OK:
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse[0].id).toBe(0);
					expect(jsonResponse[0].name).toBe("Test");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.WITH_BODY_ERROR:
				mockOptions.filters = {
					GET: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "eq"
							}
						]
					}
				}
				req.url = "/api/users?id=1";
				req.method = "GET";
				req.headers = {
					"content-type": "application/json"
				}
				req.write(JSON.stringify({ id: 1, name: "Test 11" }));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("GET request cannot have a body in File System API mode");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.WITH_FILE_ERROR:
				mockOptions.filters = {
					GET: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "eq"
							}
						]
					}
				}
				mockOptions.handlers = [{
					pattern: "/users",
					method: "GET",
					handle: "FS"
				}];
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					}
				});
				req.url = "/api/users?id=1";
				req.method = "GET";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("GET request cannot have a body in REST File System API mode");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.NO_JSON_FILE:
				req.url = "/api/product";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/plain');
					expect(res.statusCode).toBe(200);
					expect(responseData).toBe(`Product 1`);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.EXE_FILE:
				fs.writeFileSync(path.join(MOCK_DIR.PATH, 'app.exe'), "");
				req.url = "/api/app";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/octet-stream');
					expect(res.statusCode).toBe(200);
					expect(responseData).toBe(``);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.NO_JSON_FILE_WITH_EXT:
				req.url = "/api/product.txt";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/plain');
					expect(res.statusCode).toBe(200);
					expect(responseData).toBe(`Product 1`);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.DIR_WITH_INDEX_FILE:
				fs.mkdirSync(path.join(MOCK_DIR.PATH, "users"));
				fs.writeFileSync(path.join(MOCK_DIR.PATH, "users", 'index.json'), JSON.stringify([]));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse).toStrictEqual([]);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.DIR_WITHOUT_INDEX_FILE:
				fs.mkdirSync(path.join(MOCK_DIR.PATH, "users"));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Not found");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.WITH_FILTERS:
				mockOptions.filters = {
					GET: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "eq"
							}
						]
					}
				}
				req.url = "/api/users?id=1";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.length).toBe(1);
					expect(jsonResponse[0].id).toBe(1);
					expect(jsonResponse[0].name).toBe("Test 1");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.WITH_FILTERS_FILE_ERROR:
				mocks.utils.request.applyPaginationAndFilters.shouldFail = true;
				mockOptions.filters = {
					GET: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "eq"
							}
						]
					}
				}
				req.url = "/api/users?id=1";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe(`Error parsing json content file ${path.join(MOCK_DIR.PATH, "users.json")}`);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.WITH_PAGINATION:
				mockOptions.pagination = {
					GET: {
						type: "query-param",
						limit: "limit",
						skip: "skip",
						sort: "sort",
						order: "order"
					}
				}
				req.url = "/api/users?limit=1&skip=0&order=-1&sort=id";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.length).toBe(1);
					expect(jsonResponse[0].id).toBe(1);
					expect(jsonResponse[0].name).toBe("Test 1");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.GET.WITH_PAGINATION_ERROR:
				mockOptions.pagination = {
					GET: {
						type: "query-param",
						limit: "limit",
						skip: "skip",
						sort: "sort",
						order: "order"
					}
				}
				req.url = "/api/users?limit=1&skip=0&order=-11&sort=id";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error parsing pagination request");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.MULTIPLE_FILES:
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					},
					file1: {
						filename: "user1.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					}
				});
				req.method = "POST";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("POST request with multiple file is not allowed in File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.MULTIPLE_FILES_REST:
				mockOptions.handlers = [{
					pattern: "/users",
					method: "POST",
					handle: "FS"
				}];
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					},
					file1: {
						filename: "user1.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					}
				});
				req.method = "POST";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("POST request with multiple file is not allowed in REST File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.BOTH_FILE_AND_BODY:
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					},
					user: {
						id: 1,
						name: "Test 1"
					}
				});
				req.method = "POST";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("POST request with file and body is not allowed in File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.BOTH_FILE_AND_BODY_REST:
				mockOptions.handlers = [{
					pattern: "/users",
					method: "POST",
					handle: "FS"
				}];
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					},
					user: {
						id: 1,
						name: "Test 1"
					}
				});
				req.method = "POST";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("POST request with file and body is not allowed in REST File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.FILE_FOUND_NOT_JSON:
				req.url = "/api/product";
				req.method = "POST";
				req.headers = {
					"content-type": "application/x-www-form-urlencoded"
				}
				req.write(new URLSearchParams({ "id": "1", "name": "Test 11" }).toString());
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("POST request for not json file is not allowed in File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.FILE_FOUND_NOT_JSON_REST:
				mockOptions.handlers = [{
					pattern: "/product",
					method: "POST",
					handle: "FS"
				}];
				req.url = "/api/product";
				req.method = "POST";
				req.headers = {
					"content-type": "application/x-www-form-urlencoded"
				}
				req.write(new URLSearchParams({ "id": "1", "name": "Test 11" }).toString());
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("POST request for not json file is not allowed in REST File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.WITH_FILE_JSON:
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					},
				});
				req.url = "/api/user2";
				req.method = "POST";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.statusCode).toBe(201);
					let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.json"), { encoding: "utf-8" });
					file = JSON.parse(file);
					expect(file).toBeDefined();
					expect(file.id).toBe(1);
					expect(file.name).toBe("Test 1");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.WITH_FILE_NOT_JSON:
				multipart = createMultipartBody({
					file: {
						filename: "user.txt",
						content: "Product",
						contentType: "text/plain"
					},
				});
				req.url = "/api/user2";
				req.method = "POST";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.statusCode).toBe(201);
					const file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.txt"), { encoding: "utf-8" });
					expect(file).toBe("Product");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.WITH_PAGINATION_ERROR:
				mockOptions.pagination = {
					POST: {
						type: "query-param",
						limit: "limit",
						skip: "skip",
						sort: "sort",
						order: "order"
					}
				}
				req.url = '/api/users?limit=1&skip=0&order=-11&sort=id';
				req.method = "POST";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error parsing pagination request");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.WITH_FILTERS_FILE:
				fs.writeFileSync(path.join(MOCK_DIR.PATH, 'user.json'), JSON.stringify({ id: 0, name: "Test" }));
				mockOptions.filters = {
					POST: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "eq"
							}
						]
					}
				}
				req.url = "/api/user?id=1";
				req.method = "POST";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					expect(responseData).toBe("");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.WITH_FILTERS_FILE_ARRAY:
				mockOptions.filters = {
					POST: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "regex"
							}
						]
					}
				}
				req.url = "/api/users?id=1";
				req.method = "POST";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(200);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.length).toBe(1);
					expect(jsonResponse[0].id).toBe(1);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.WITH_FILTERS_FILE_ERROR:
				mocks.utils.request.applyPaginationAndFilters.shouldFail = true;
				mockOptions.filters = {
					POST: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "eq"
							}
						]
					}
				}
				req.url = "/api/users?id=1";
				req.method = "POST";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe(`Error to retrive filtered and paginated data from ${path.join(MOCK_DIR.PATH, "users.json")}`);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.WITHOUT_PAGINATION_AND_NOT_JSON_BODY:
				mockOptions.handlers = [{
					pattern: "/users",
					method: "POST",
					handle: "FS"
				}];
				multipart = createMultipartBody({
					file: {
						filename: "user.txt",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "text/plain"
					}
				});
				req.method = "POST";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(409);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("File at /api/users already exists");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.WITH_BODY_EXTRA:
				mockOptions.handlers = [{
					pattern: "/users",
					method: "POST",
					handle: "FS",
					filters: {
						exclusive: {
							type: "body",
							root: "user",
							filters: [
								{
									key: "id",
									valueType: "number",
									comparison: "eq"
								}
							]
						}
					},
					pagination: {
						exclusive: {
							type: "body",
							root: "paginazione",
							limit: "limit",
							order: "order",
							skip: "skip",
							sort: "sort"
						}
					}
				}];

				multipart = createMultipartBody({
					user: {
						id: 1,
						name: "Test 1",
						eta: 23
					},
					paginazione: {
						limit: 1,
						order: "id",
						skip: 0,
						sort: "ASC"
					},
					datas: ["sdf"]
				});
				req.method = "POST";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(409);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("File at /api/users already exists");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.FILE_NOT_FOUND_AND_NO_DATA:
				req.url = "/api/product1";
				req.method = "POST";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("No data provided");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.FILE_NOT_FOUND_AND_FILTERS:
				mockOptions.filters = {
					POST: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "eq"
							}
						]
					}
				}
				req.url = "/api/product1";
				req.write("ok");
				req.method = "POST";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("No data to filter or to paginate");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.TOTAL_COUNT_ERROR_HEADER:
				fs.writeFileSync(
					path.join(MOCK_DIR.PATH, 'bad.json'),
					'[{"id":0,"name":"Test"}'
				);
				req.url = "/api/bad";
				req.method = "POST";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.setHeader).toHaveBeenCalledWith(Constants.TOTAL_ELEMENTS_HEADER, 1);
					expect(res.statusCode).toBe(200);
					expect(responseData).toBe('[{"id":0,"name":"Test"}');
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.ERROR_WRITING_FILE:
				mocks.utils.files.writingFile.shouldFail = true;
				req.url = "/api/users11";
				req.method = "POST";
				req.headers = {
					"content-type": "application/json"
				}
				req.write(JSON.stringify({ id: 1, name: "Test 11" }));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error writing data");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.POST.ERROR_CREATING_DATA:
				mocks.utils.request.getCleanBody.shouldFail = true;
				mockOptions.filters = {
					POST: {
						type: "body",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "nin"
							}
						]
					}
				}
				req.method = "POST";
				req.write(JSON.stringify({ id: [0, 1] }));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error creating data");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.CREATE_NO_JSON_FILE:
				req.url = "/api/user2";
				req.method = "PUT";
				req.headers = {
					"content-type": "text/plain"
				}
				req.write("User 1");
				expects = () => {
					expect(res.statusCode).toBe(201);
					const file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.txt"), { encoding: "utf-8" });
					expect(file).toBeDefined();
					expect(file).toBe("User 1");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.CREATE_FILE:
				multipart = createMultipartBody({
					user: {
						id: 1,
						name: "Test 1"
					}
				});
				req.url = "/api/user2";
				req.method = "PUT";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.statusCode).toBe(201);
					let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.json"), { encoding: "utf-8" });
					file = JSON.parse(file);
					expect(file.user).toBeDefined();
					expect(file.user.id).toBe(1);
					expect(file.user.name).toBe("Test 1");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.CREATE_FILE_WITH_FILE:
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					}
				});
				req.url = "/api/user2";
				req.method = "PUT";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.statusCode).toBe(201);
					let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.json"), { encoding: "utf-8" });
					file = JSON.parse(file);
					expect(file.id).toBe(1);
					expect(file.name).toBe("Test 1");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.UPDATE_FILE:
				multipart = createMultipartBody({
					fileData: {
						filename: 'users2.json',
						content: JSON.stringify({ id: 2, name: "Test 2" }),
						contentType: 'application/json'
					}
				});
				req.url = "/api/product";
				req.method = "PUT";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.statusCode).toBe(200);
					let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "product.txt"), { encoding: "utf-8" });
					file = JSON.parse(file);
					expect(file.id).toBe(2);
					expect(file.name).toBe("Test 2");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.MULTIPLE_FILES:
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					},
					file1: {
						filename: "user1.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					}
				});
				req.method = "PUT";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("PUT request with multiple file is not allowed in File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.MULTIPLE_FILES_REST:
				mockOptions.handlers = [{
					pattern: "/users",
					method: "PUT",
					handle: "FS"
				}];
				multipart = createMultipartBody({
					file: {
						filename: "user.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					},
					file1: {
						filename: "user1.json",
						content: JSON.stringify({ id: 1, name: "Test 1" }),
						contentType: "application/json"
					}
				});
				req.method = "PUT";
				req.headers = {
					"content-type": multipart.contentType,
					"content-length": multipart.contentLength
				}
				req.write(multipart.body);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("PUT request with multiple file is not allowed in REST File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.NO_FILE_PROVIDED:
				req.url = "/api/users2";
				req.method = "PUT";
				req.headers = {
					"content-type": "application/json"
				}
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("No data provided");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.ERROR_UPDATING_FILE:
				mocks.utils.files.writingFile.shouldFail = true;
				req.method = "PUT";
				req.headers = {
					"content-type": "application/json"
				}
				req.write(JSON.stringify({ id: 1, name: "Test 11" }));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error updating data");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PUT.ERROR_CREATING_FILE:
				mocks.utils.files.writingFile.shouldFail = true;
				req.method = "PUT";
				req.headers = {
					"content-type": "application/json"
				}
				req.url = "/api/user1";
				req.write(JSON.stringify({ id: 1, name: "Test 11" }));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error creating data");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.UNSUPPORTED_MEDIA_TYPE:
				req.method = "PATCH";
				req.headers = {
					"content-type": "multipart/form-data"
				}
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(415);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe(`PATCH request content-type unsupported in File System API mode`);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.UNSUPPORTED_MEDIA_TYPE_REST:
				mockOptions.handlers = [{
					pattern: "/users",
					method: "PATCH",
					handle: "FS"
				}];
				req.method = "PATCH";
				req.headers = {}
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(415);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe(`PATCH request content-type unsupported in REST File System API mode`);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.FILE_NOT_FOUND:
				req.url = "/api/users3";
				req.method = "PATCH";
				req.headers = {
					"content-type": "application/json"
				}
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Resource to update not found");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.NO_JSON_FILE:
				req.url = "/api/product";
				req.method = "PATCH";
				req.headers = {
					"content-type": "application/json"
				}
				req.write(JSON.stringify([2]));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Only json file can be processing with PATCH http method");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.MERGE_PATCHING_ARRAY:
				req.method = "PATCH";
				req.headers = {
					"content-type": "application/merge-patch+json"
				}
				req.write(JSON.stringify([
					{ id: 11, name: "Test 11" }
				]));
				expects = () => {
					expect(res.statusCode).toBe(200);
					let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "users.json"), { encoding: "utf-8" });
					file = JSON.parse(file);
					expect(file.length).toBe(1);
					expect(file[0].id).toBe(11);
					expect(file[0].name).toBe("Test 11");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.MERGE_PATCHING_OBJECT:
				fs.writeFileSync(
					path.join(MOCK_DIR.PATH, 'user.json'),
					JSON.stringify({
						"id": 1,
						"name": "Test 1"
					})
				);
				req.url = "/api/user";
				req.method = "PATCH";
				req.headers = {
					"content-type": "application/json"
				}
				req.write(
					JSON.stringify({
						name: null,
						eta: 2,
						tags: ["ee"]
					})
				);
				expects = () => {
					expect(res.statusCode).toBe(200);
					let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user.json"), { encoding: "utf-8" });
					file = JSON.parse(file);
					expect(file.id).toBe(1);
					expect(file.name).not.toBeDefined();
					expect(file.eta).toBe(2);
					expect(file.tags).toEqual(expect.any(Array));
					expect(file.tags.length).toBe(1);
					expect(file.tags[0]).toBe("ee");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.JSON_PATCHING:
				fs.writeFileSync(
					path.join(MOCK_DIR.PATH, 'user.json'),
					JSON.stringify({
						"name": "John",
						"status": "active",
						"oldCode": "ABC-123",
						"contacts": {
							"phone": "02-123456"
						},
						"address": {
							"temp": {
								"street": "1",
								"city": "Milan"
							}
						},
						"tags": ["tech", "news"],
						"author": "John Harry"
					})
				);
				req.url = "/api/user";
				req.method = "PATCH";
				req.headers = {
					"content-type": "application/json-patch+json"
				}
				req.write(
					JSON.stringify([
						{ "op": "add", "path": "/contacts/email", "value": "john.harry@example.it" },
						{ "op": "replace", "path": "/name", "value": "John Harry" },
						{ "op": "remove", "path": "/oldCode" },
						{ "op": "move", "from": "/address/temp", "path": "/address/principal" },
						{ op: "copy", from: "/author", path: "/editor" },
						{ "op": "add", "path": "/tags/-", "value": "premium" }
					])
				);
				expects = () => {
					expect(res.statusCode).toBe(200);
					let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user.json"), { encoding: "utf-8" });
					file = JSON.parse(file);
					expect(file.name).toBe("John Harry");
					expect(file.contacts.email).toBe("john.harry@example.it");
					expect(file.oldCode).toBeUndefined();
					expect(file.address.principal.street).toBe("1");
					expect(file.tags).toContain("premium");
					expect(file.editor).toBe("John Harry");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.ERROR_PATCHING_OPERATION_NOT_SUPPORTED:
				req.url = "/api/users";
				req.method = "PATCH";
				req.headers = {
					"content-type": "application/json-patch+json"
				}
				req.write(
					JSON.stringify([
						{ "op": "test", "path": "/status", "value": "active" },
					])
				);
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("PATCH operation not supported: test");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.PATCH.ERROR_PATCHING_FILE:
				mocks.utils.files.writingFile.shouldFail = true;
				req.method = "PATCH";
				req.headers = {
					"content-type": "application/json"
				}
				req.write(JSON.stringify([
					{ id: 11, name: "Test 11" }
				]));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error partial updating resource");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.OPTIONS.METHOD_NOT_ALLOWED:
				req.method = "OPTIONS";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(405);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Method OPTIONS not allowed in File System API mode");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.FILE_NOT_FOUND:
				req.method = "DELETE";
				req.url = "/api/user3";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Resource to delete not found");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.BODY_ERROR:
				req.method = "DELETE";
				req.headers = {
					"content-type": "application/json"
				}
				req.write(JSON.stringify({ id: 1, name: "Test 11" }));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("DELETE request cannot have a body in File System API mode");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.BODY_ERROR_REST:
				mockOptions.handlers = [{
					pattern: "/users",
					method: "DELETE",
					handle: "FS"
				}];
				req.method = "DELETE";
				req.headers = {
					"content-type": "application/json"
				}
				req.write(JSON.stringify({ id: 1, name: "Test 11" }));
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("DELETE request cannot have a body in REST File System API mode");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.FILTERS_FILE_NOT_FOUND:
				mockOptions.filters = {
					DELETE: {
						type: "query-param",
						filters: [
							{
								key: "eta",
								valueType: "number",
								comparison: "lt"
							}
						]
					}
				}
				req.method = "DELETE";
				req.url = "/api/users?eta=1";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe(`Partial resource to delete not found`);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.WITH_FILTERS_FILE_ERROR:
				mocks.utils.request.applyPaginationAndFilters.shouldFail = true;
				mockOptions.filters = {
					DELETE: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "eq"
							}
						]
					}
				}
				req.method = "DELETE";
				req.url = "/api/users?id=1";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe(`Error parsing json content file ${path.join(MOCK_DIR.PATH, "users.json")}`);
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.WITH_PAGINATION_ERROR:
				mockOptions.pagination = {
					DELETE: {
						type: "query-param",
						limit: "limit",
						skip: "skip",
						sort: "sort",
						order: "order"
					}
				}
				req.method = "DELETE";
				req.url = "/api/users?limit=1&skip=0&order=-11&sort=id";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(400);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error parsing pagination request");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.FULL_FILE:
				req.method = "DELETE";
				req.url = "/api/users";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith(Constants.DELETED_ELEMENTS_HEADER, 1);
					expect(res.statusCode).toBe(204);
					let result;
					try {
						const stat = fs.statSync(path.join(MOCK_DIR.PATH, "user.json"));
						result = stat.isFile();
					} catch (error) {
						expect(result).toBe(undefined);
						result = false;
					}
					expect(result).toBe(false);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.FULL_FILE_OBJECT:
				fs.writeFileSync(path.join(MOCK_DIR.PATH, 'user1.json'), JSON.stringify({ id: 0, name: "Test" }));
				mockOptions.filters = {
					DELETE: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "lte"
							}
						]
					}
				}
				req.method = "DELETE";
				req.url = "/api/user1?id=0";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith(Constants.DELETED_ELEMENTS_HEADER, 1);
					expect(res.statusCode).toBe(204);
					let result;
					try {
						const stat = fs.statSync(path.join(MOCK_DIR.PATH, "user1.json"));
						result = stat.isFile();
					} catch (error) {
						expect(result).toBe(undefined);
						result = false;
					}
					expect(result).toBe(false);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.PARTIAL_FULL_FILE:
				mockOptions.filters = {
					DELETE: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number[]",
								comparison: "in"
							}
						]
					}
				}
				req.method = "DELETE";
				req.url = "/api/users?id=0,1";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith(Constants.DELETED_ELEMENTS_HEADER, 1);
					expect(res.statusCode).toBe(204);
					let result;
					try {
						const stat = fs.statSync(path.join(MOCK_DIR.PATH, "user.json"));
						result = stat.isFile();
					} catch (error) {
						expect(result).toBe(undefined);
						result = false;
					}
					expect(result).toBe(false);
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.PARTIAL_FILE:
				mockOptions.filters = {
					DELETE: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "gte"
							}
						]
					}
				}
				req.method = "DELETE";
				req.url = "/api/users?id=1";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith(Constants.DELETED_ELEMENTS_HEADER, 1);
					expect(res.statusCode).toBe(204);
					let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "users.json"), { encoding: "utf-8" });
					file = JSON.parse(file);
					expect(file.length).toBe(1);
					expect(file[0].id).toBe(0);
					expect(file[0].name).toBe("Test");
				}
				break;
			case TEST_NAME.CONFIGURE_SERVER.DELETE.ERROR_WRITING_FILE:
				mocks.utils.files.writingFile.shouldFail = true;
				mockOptions.filters = {
					DELETE: {
						type: "query-param",
						filters: [
							{
								key: "id",
								valueType: "number",
								comparison: "gt"
							}
						]
					}
				}
				req.method = "DELETE";
				req.url = "/api/users?id=0";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(500);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Error deleting resource");
				}
				break;
			case TEST_NAME.CONFIGURE_PREVIEW_SERVER.DISABLED:
				executeMiddleware = false;
				delete mockOptions.endpointPrefix;
				delete mockOptions.fsDir;
				mockOptions.logLevel = "debug",
					mockOptions.disable = true;
				expects = () => {
					expect(logSpy).toHaveBeenCalledTimes(5);
				}
				break;
			case TEST_NAME.CONFIGURE_PREVIEW_SERVER.LOG_DEBUG:
				executeMiddleware = false;
				delete mockOptions.endpointPrefix;
				delete mockOptions.fsDir;
				mockOptions.logLevel = "debug",
					expects = () => {
						expect(logSpy).toHaveBeenCalledTimes(9);
					}
				break;
			case TEST_NAME.CONFIGURE_PREVIEW_SERVER.NO_MATCH_PREFIX:
				req.url = "/apis/users";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Request doesn't match endpointPrefix");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_PREVIEW_SERVER.NO_REQ_HANDLER:
				delete mockOptions.fsDir;
				req.url = "/api/users/all";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Impossible handling request with url http://localhost/api/users/all");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.CONFIGURE_PREVIEW_SERVER.NO_FILE_FOUND:
				req.url = "/api/address/all";
				expects = () => {
					expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
					expect(res.statusCode).toBe(404);
					const jsonResponse = JSON.parse(responseData);
					expect(jsonResponse.message).toBe("Not found");
					expect(next).not.toHaveBeenCalled();
				}
				break;
			case TEST_NAME.WS.PARSE_LARGE_FRAME: {
				const payloadLength = 70000;
				// Create frame with 127 indicator for 64-bit length
				const frame = Buffer.alloc(10 + 4 + payloadLength);
				frame[0] = 0x81; // FIN + text opcode
				frame[1] = 0xFF; // Masked + 127 (indicates 64-bit length follows)
				frame.writeBigUInt64BE(BigInt(payloadLength), 2); // Write 64-bit length at offset 2
				// Mask key at offset 10
				frame[10] = 0x00;
				frame[11] = 0x00;
				frame[12] = 0x00;
				frame[13] = 0x00;
				const frames = wsParser!.parse(frame);
				expects = () => {
					expect(frames).toHaveLength(1);
					expect(frames[0].payloadLength).toBe(payloadLength);
				}
				break;
			}
			case TEST_NAME.WS.PARSE_TEXT_FRAME: {
				// FIN=1, opcode=0x01 (text), masked, 5 byte payload
				const payload = Buffer.from('Hello');
				const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
				// Mask the payload
				const maskedPayload = Buffer.from(payload);
				for (let i = 0; i < maskedPayload.length; i++) {
					maskedPayload[i] ^= mask[i % 4];
				}
				const frame = Buffer.concat([
					Buffer.from([0x81, 0x85]), // FIN=1, opcode=1, masked=1, len=5
					mask,
					maskedPayload
				]);
				const frames = wsParser!.parse(frame);
				expects = () => {
					expect(frames).toHaveLength(1);
					expect(frames[0].fin).toBe(true);
					expect(frames[0].opcode).toBe(0x01);
					expect(frames[0].masked).toBe(true);
					expect(frames[0].payload.toString()).toBe('Hello');
				}
				break;
			}
			case TEST_NAME.WS.PARSE_CLOSE_FRAME: {
				// Close frame with code 1000
				const payload = Buffer.alloc(2);
				payload.writeUInt16BE(1000, 0);
				const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
				const maskedPayload = Buffer.from(payload);
				for (let i = 0; i < maskedPayload.length; i++) {
					maskedPayload[i] ^= mask[i % 4];
				}
				const frame = Buffer.concat([
					Buffer.from([0x88, 0x82]), // FIN=1, opcode=0x08 (close), masked=1, len=2
					mask,
					maskedPayload
				]);
				const frames = wsParser!.parse(frame);
				expects = () => {
					expect(frames).toHaveLength(1);
					expect(frames[0].fin).toBe(true);
					expect(frames[0].opcode).toBe(0x08);
					expect(frames[0].payload.readUInt16BE(0)).toBe(1000);
				}
				break;
			}
			case TEST_NAME.WS.PARSE_PING_FRAME: {
				const payload = Buffer.from('ping');
				const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
				const maskedPayload = Buffer.from(payload);
				for (let i = 0; i < maskedPayload.length; i++) {
					maskedPayload[i] ^= mask[i % 4];
				}
				const frame = Buffer.concat([
					Buffer.from([0x89, 0x84]), // FIN=1, opcode=0x09 (ping), masked=1, len=4
					mask,
					maskedPayload
				]);
				const frames = wsParser!.parse(frame);
				expects = () => {
					expect(frames).toHaveLength(1);
					expect(frames[0].opcode).toBe(0x09);
					expect(frames[0].payload.toString()).toBe('ping');
				}
				break;
			}
			case TEST_NAME.WS.PARSE_PONG_FRAME: {
				const payload = Buffer.from('pong');
				const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
				const maskedPayload = Buffer.from(payload);
				for (let i = 0; i < maskedPayload.length; i++) {
					maskedPayload[i] ^= mask[i % 4];
				}
				const frame = Buffer.concat([
					Buffer.from([0x8A, 0x84]), // FIN=1, opcode=0x0A (pong), masked=1, len=4
					mask,
					maskedPayload
				]);
				const frames = wsParser!.parse(frame);
				expects = () => {
					expect(frames).toHaveLength(1);
					expect(frames[0].opcode).toBe(0x0A);
					expect(frames[0].payload.toString()).toBe('pong');
				}
				break;
			}
			case TEST_NAME.WS.PARSE_16BIT_FRAME: {
				const payload = Buffer.alloc(200, 'A');
				const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
				const maskedPayload = Buffer.from(payload);
				for (let i = 0; i < maskedPayload.length; i++) {
					maskedPayload[i] ^= mask[i % 4];
				}
				const frame = Buffer.concat([
					Buffer.from([0x81, 126]), // FIN=1, opcode=1, masked=1, len=126 (extended)
					Buffer.from([0, 200]),    // 16-bit length
					mask,
					maskedPayload
				]);
				const frames = wsParser!.parse(frame);
				expects = () => {
					expect(frames).toHaveLength(1);
					expect(frames[0].payloadLength).toBe(200);
					expect(frames[0].payload.length).toBe(200);
				}
				break;
			}
			case TEST_NAME.WS.PARSE_MULTIPLE_CALL: {
				const payload = Buffer.from('Hello');
				const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
				const maskedPayload = Buffer.from(payload);
				for (let i = 0; i < maskedPayload.length; i++) {
					maskedPayload[i] ^= mask[i % 4];
				}
				const fullFrame = Buffer.concat([
					Buffer.from([0x81, 0x85]),
					mask,
					maskedPayload
				]);
				// Split frame into two parts
				const part1 = fullFrame.subarray(0, 5);
				const part2 = fullFrame.subarray(5);
				const frames1 = wsParser!.parse(part1);
				const frames2 = wsParser!.parse(part2);
				expects = () => {
					expect(frames1).toHaveLength(0); // Incomplete frame
					expect(frames2).toHaveLength(1); // Now complete
					expect(frames2[0].payload.toString()).toBe('Hello');
				}
				break;
			}
			case TEST_NAME.WS.PARSE_MULTIPLE_FRAME: {
				// Create two simple frames
				const createFrame = (text: string) => {
					const payload = Buffer.from(text);
					const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
					const maskedPayload = Buffer.from(payload);
					for (let i = 0; i < maskedPayload.length; i++) {
						maskedPayload[i] ^= mask[i % 4];
					}
					return Buffer.concat([
						Buffer.from([0x81, 0x80 | payload.length]),
						mask,
						maskedPayload
					]);
				};
				const frame1 = createFrame('Hi');
				const frame2 = createFrame('Bye');
				const combined = Buffer.concat([frame1, frame2]);
				const frames = wsParser!.parse(combined);
				expects = () => {
					expect(frames).toHaveLength(2);
					expect(frames[0].payload.toString()).toBe('Hi');
					expect(frames[1].payload.toString()).toBe('Bye');
				}
				break;
			}
			case TEST_NAME.WS.RSV_BITS: {
				// Frame with RSV1 set (for compression)
				const payload = Buffer.from('Test');
				const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
				const maskedPayload = Buffer.from(payload);
				for (let i = 0; i < maskedPayload.length; i++) {
					maskedPayload[i] ^= mask[i % 4];
				}
				const frame = Buffer.concat([
					Buffer.from([0xC1, 0x84]), // FIN=1, RSV1=1, opcode=1, masked=1, len=4
					mask,
					maskedPayload
				]);
				const frames = wsParser!.parse(frame);
				expects = () => {
					expect(frames).toHaveLength(1);
					expect(frames[0].rsv1).toBe(true);
					expect(frames[0].rsv2).toBe(false);
					expect(frames[0].rsv3).toBe(false);
				}
				break;
			}
			case TEST_NAME.WS.ADD_CONNECTION: {
				const conn = new WebSocketConnection(loggerMock,
					wsSocket!,
					'/test',
					wsManager!,
					null
				);
				wsManager!.add(conn);
				expects = () => {
					expect(wsManager!.get(conn.id)).toBe(conn);
					conn.forceClose();
				}
				break;
			}
			case TEST_NAME.WS.REMOVE_CONNECTION: {
				const conn = new WebSocketConnection(loggerMock,
					wsSocket!,
					'/test',
					wsManager!,
					null
				);
				expects = () => {
					wsManager!.add(conn);
					expect(wsManager!.get(conn.id)).toBe(conn);
					wsManager!.remove(conn.id);
					expect(wsManager!.get(conn.id)).toBeUndefined();
					conn.forceClose();
				}
				break;
			}
			case TEST_NAME.WS.GET_ALL_CONNECTION: {
				const manager = new ConnectionManager(loggerMock);
				const conn1 = new WebSocketConnection(loggerMock, createMockSocket(), '/test1', manager, null);
				const conn2 = new WebSocketConnection(loggerMock, createMockSocket(), '/test2', manager, {server_max_window_bits: 11}, {serverMaxWindowBits: 11});
				manager.add(conn1);
				manager.add(conn2);
				const all = manager.getAll();
				expects = () => {
					conn1.forceClose();
					conn2.forceClose();
					expect(all).toHaveLength(2);
					expect(all).toContain(conn1);
					expect(all).toContain(conn2);
				}
				break;
			}
			case TEST_NAME.WS.GET_ROOM_CONNECTION: {
				const conn1 = new WebSocketConnection(loggerMock, createMockSocket(), '/test1', wsManager!, null);
				const conn2 = new WebSocketConnection(loggerMock, createMockSocket(), '/test2', wsManager!, null);
				const conn3 = new WebSocketConnection(loggerMock, createMockSocket(), '/test3', wsManager!, null);
				wsManager!.add(conn1);
				wsManager!.add(conn2);
				wsManager!.add(conn3);
				conn1.joinRoom('room-a');
				conn2.joinRoom('room-a');
				conn3.joinRoom('room-b');
				const roomA = wsManager!.getByRoom('room-a');
				const roomB = wsManager!.getByRoom('room-b');
				expects = () => {
					conn1.forceClose();
					conn2.forceClose();
					conn3.forceClose();
					expect(roomA).toHaveLength(2);
					expect(roomA).toContain(conn1);
					expect(roomA).toContain(conn2);
					expect(roomB).toHaveLength(1);
					expect(roomB).toContain(conn3);
				}
				break;
			}
			case TEST_NAME.WS.BROADCAST_CONNECTION: {
				const conn1 = new WebSocketConnection(loggerMock, createMockSocket(), '/test1', wsManager!, null);
				const conn2 = new WebSocketConnection(loggerMock, createMockSocket(), '/test2', wsManager!, null);
				const conn3 = new WebSocketConnection(loggerMock, createMockSocket(), '/test3', wsManager!, null);
				wsManager!.add(conn1);
				wsManager!.add(conn2);
				wsManager!.add(conn3);
				await conn1.close();
				conn2.joinRoom('room-a');
				conn3.joinRoom('room-b');
				const sendSpy1 = vi.spyOn(conn1, 'send');
				const sendSpy2 = vi.spyOn(conn2, 'send');
				const sendSpy3 = vi.spyOn(conn3, 'send');
				wsManager!.broadcast({ type: 'test' });
				wsManager!.broadcast({ type: 'testa' }, { room: 'room-a' });
				expects = () => {
					conn1.forceClose();
					conn2.forceClose();
					conn3.forceClose();
					expect(sendSpy1).not.toHaveBeenCalled();
					expect(sendSpy2).toHaveBeenCalledWith({ type: 'testa' });
					expect(sendSpy3).toHaveBeenCalledWith({ type: "test" });
				}
				break;
			}
			case TEST_NAME.WS.UNIQUE_ID_CONNECTION: {
				expects = () => {
					expect(wsConnection.id).toBeDefined();
					expect(typeof wsConnection.id).toBe('string');
				}
				break;
			}
			case TEST_NAME.WS.ADD_CONNECTION_IT_SELF_TO_MANAGER: {
				expects = () => {
					expect(wsManager!.get(wsConnection.id)).toBe(wsConnection);
				}
				break;
			}
			case TEST_NAME.WS.SET_PATH_CONNECTION: {
				expects = () => {
					expect(wsConnection.path).toBe('/test');
				}
				break;
			}
			case TEST_NAME.WS.NO_CONNECTION_CLOSED: {
				expects = () => {
					expect(wsConnection.closed).toBe(false);
				}
				break;
			}
			case TEST_NAME.WS.SEND_TEXT_MESSAGE: {
				await wsConnection.send({ type: 'test', message: 'hello' });
				const frame = (wsSocket! as unknown as MockSocket).writes[0];
				const frame2 = wsConnection["createFrame"](Buffer.alloc(200, 'a'), 0x01);
				const frame3 = wsConnection["createFrame"](Buffer.alloc(70000, 'a'), 0x02);
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).writes.length).toBeGreaterThan(0);
					expect(frame[0] & 0x0F).toBe(0x01);
					expect(frame2.length).toBe(204);
					expect(frame2[0]).toBe(0x81);
					expect(frame2[1]).toBe(126);
					expect(frame3.length).toBe(70010);
					expect(() => wsConnection["createControlFrame"](0x02, Buffer.alloc(70000, 'a'))).toThrowError();
				}
				break;
			}
			case TEST_NAME.WS.SEND_STRING_MESSAGE: {
				await wsConnection.send('hello');
				const manager = new ConnectionManager(loggerMock);
				const conn1 = new WebSocketConnection(loggerMock, createMockSocket(), '/test1', manager, null);
				const conn2 = new WebSocketConnection(loggerMock, createMockSocket(), '/test2', manager, {server_max_window_bits: 11}, {serverMaxWindowBits: 11});
				manager.add(conn1);
				manager.add(conn2);
				await conn2.send("hi");
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).writes.length).toBeGreaterThan(0);
					expect((conn2 as unknown as {socket: MockSocket}).socket.writes.length).toBeGreaterThan(0);
					conn1.close();
					conn2.close();
				}
				break;
			}
			case TEST_NAME.WS.SEND_ON_CONNECTION_CLOSED: {
				await wsConnection.close();
				(wsSocket! as unknown as MockSocket).clearWrites();
				await wsConnection.send('test');
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).writes).toHaveLength(0);
				}
				break;
			}
			case TEST_NAME.WS.HANDLE_SEND_ERRORS: {
				wsSocket!.write = vi.fn((data, cb) => {
					if (cb) cb(new Error('Write failed'));
					return false;
				});
				expects = async () => {
					await expect(wsConnection.send('test')).rejects.toThrow('Write failed');
				}
				break;
			}
			case TEST_NAME.WS.SEND_PING_FRAME: {
				wsConnection.ping('test');
				wsConnection.ping(Buffer.from('test'));
				const frame = (wsSocket! as unknown as MockSocket).writes[0];
				const mockSocket = {
					write: vi.fn((frame, cb) => {
						// Simula il fallimento chiamando la callback con un errore
						if (typeof cb === 'function') {
						cb(new Error('Network error'));
						}
					}),
					destroy: vi.fn()
				} as unknown as Socket;
				const manager = new ConnectionManager(loggerMock);
				const conn = new WebSocketConnection(loggerMock, mockSocket, "/api/test", manager, null);
				manager.add(conn);
				conn.ping("Test");
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).writes.length).toBe(2);
					expect(frame[0] & 0x0F).toBe(0x09);
					expect(mockSocket.write).toHaveBeenCalled();
					conn.close();
				}
				break;
			}
			case TEST_NAME.WS.SEND_PONG_FRAME: {
				wsConnection.pong('test');
				wsConnection.pong(Buffer.from('test'));
				const frame = (wsSocket! as unknown as MockSocket).writes[0];
				const mockSocket = {
					write: vi.fn((frame, cb) => {
						// Simula il fallimento chiamando la callback con un errore
						if (typeof cb === 'function') {
						cb(new Error('Network error'));
						}
					}),
					destroy: vi.fn()
				} as unknown as Socket;
				const manager = new ConnectionManager(loggerMock);
				const conn = new WebSocketConnection(loggerMock, mockSocket, "/api/test", manager, null);
				manager.add(conn);
				conn.pong("Test");
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).writes.length).toBe(2);
					expect(frame[0] & 0x0F).toBe(0x0A);
					expect(mockSocket.write).toHaveBeenCalled();
					conn.close();
				}
				break;
			}
			case TEST_NAME.WS.SEND_PING_ON_CONNECTION_CLOSED: {
				wsConnection.forceClose();
				(wsSocket! as unknown as MockSocket).clearWrites();
				wsConnection.ping();
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).writes).toHaveLength(0);
				}
				break;
			}
			case TEST_NAME.WS.SEND_PING_INTERVALS: {
				vi.useFakeTimers();
				expects = () => {
					wsConnection.startHeartbeat(1000);
					expect((wsSocket! as unknown as MockSocket).writes).toHaveLength(0);
					vi.advanceTimersByTime(1000);
					expect((wsSocket! as unknown as MockSocket).writes.length).toBeGreaterThan(0);
					const writes1 = (wsSocket! as unknown as MockSocket).writes.length;
					vi.advanceTimersByTime(1000);
					expect((wsSocket! as unknown as MockSocket).writes.length).toBeGreaterThan(writes1);
					vi.useRealTimers();
				}
				break;
			}
			case TEST_NAME.WS.CLOSE_CONNECTION_AFTER_MISSED_PONGS: {
				vi.useFakeTimers();
				expects = () => {
					wsConnection.startHeartbeat(1000);
					// Miss 3 pongs
					vi.advanceTimersByTime(3000);
					expect(wsConnection.closed).toBe(true);
					vi.useRealTimers();
				}
				break;
			}
			case TEST_NAME.WS.RESET_MISSED_PONGS: {
				vi.useFakeTimers();
				expects = () => {
					wsConnection.startHeartbeat(1000);
					vi.advanceTimersByTime(2000); // 2 missed pongs
					wsConnection.resetMissedPong();
					vi.advanceTimersByTime(2000); // 2 more missed pongs
					expect(wsConnection.closed).toBe(false);
					vi.advanceTimersByTime(1000); // 3rd missed pong
					expect(wsConnection.closed).toBe(true);
					vi.useRealTimers();
				}
				break;
			}
			case TEST_NAME.WS.STOP_HEARTBEAT: {
				vi.useFakeTimers();
				expects = () => {
					wsConnection.startHeartbeat(1000);
					vi.advanceTimersByTime(1000);
					const writes1 = (wsSocket! as unknown as MockSocket).writes.length;
					wsConnection.stopHeartbeat();
					vi.advanceTimersByTime(2000);
					expect((wsSocket! as unknown as MockSocket).writes.length).toBe(writes1);
					vi.useRealTimers();
				}
				break;
			}
			case TEST_NAME.WS.CLOSE_CONNECTION_FOR_INACTIVITY: {
				vi.useFakeTimers();
				expects = () => {
					wsConnection.startInactivityTimeout(5000);
					vi.advanceTimersByTime(5000);
					expect(wsConnection.closed).toBe(true);
					vi.useRealTimers();
				}
				break;
			}
			case TEST_NAME.WS.RESET_TIMER_ON_ACTIVITY: {
				vi.useFakeTimers();
				expects = () => {
					wsConnection.startInactivityTimeout(5000);
					vi.advanceTimersByTime(4000);
					wsConnection.resetInactivityTimer(5000);
					vi.advanceTimersByTime(4000);
					expect(wsConnection.closed).toBe(false);
					vi.advanceTimersByTime(1000);
					expect(wsConnection.closed).toBe(true);
					vi.useRealTimers();
				}
				break;
			}
			case TEST_NAME.WS.STOP_INACTIVITY_TIMEOUT: {
				vi.useFakeTimers();
				expects = () => {
					wsConnection.startInactivityTimeout(5000);
					wsConnection.stopInactivityTimeout();
					vi.advanceTimersByTime(10000);
					expect(wsConnection.closed).toBe(false);
					vi.useRealTimers();
				}
				break;
			}
			case TEST_NAME.WS.JOIN_ROOM: {
				wsConnection.joinRoom('test-room');
				expects = () => {
					expect(wsConnection.isInRoom('test-room')).toBe(true);
					expect(wsConnection.getRooms()).toContain('test-room');
				}
				break;
			}
			case TEST_NAME.WS.LEAVE_ROOM: {
				wsConnection.joinRoom('test-room');
				wsConnection.leaveRoom('test-room');
				expects = () => {
					expect(wsConnection.isInRoom('test-room')).toBe(false);
					expect(wsConnection.getRooms()).not.toContain('test-room');
				}
				break;
			}
			case TEST_NAME.WS.JOIN_MULTIPLE_ROOMS: {
				wsConnection.joinRoom('room-1');
				wsConnection.joinRoom('room-2');
				expects = () => {
					expect(wsConnection.getRooms()).toHaveLength(2);
					expect(wsConnection.isInRoom('room-1')).toBe(true);
					expect(wsConnection.isInRoom('room-2')).toBe(true);
				}
				break;
			}
			case TEST_NAME.WS.BROADCAST_SPECIFIC_ROOM_EXCLUDING_SELF: {
				wsConnection.joinRoom('chat');
				wsConnection2.joinRoom('chat');
				const sendSpy = vi.spyOn(wsConnection2, 'send');
				wsConnection.broadcast({ type: 'message' }, { room: 'chat' });
				expects = () => {
					expect(sendSpy).toHaveBeenCalledWith({ type: 'message' });
				}
				break;
			}
			case TEST_NAME.WS.BROADCAST_SPECIFIC_ROOM_INCLUDING_SELF: {
				wsConnection.joinRoom('chat');
				const sendSpy = vi.spyOn(wsConnection, 'send');
				wsConnection.broadcast({ type: 'message' }, { room: 'chat', includeSelf: true });
				expects = () => {
					expect(sendSpy).toHaveBeenCalledWith({ type: 'message' });
				}
				break;
			}
			case TEST_NAME.WS.BROADCAST_ALL_CONNECTIONS: {
				const sendSpy2 = vi.spyOn(wsConnection2, 'send');
				const sendSpy3 = vi.spyOn(wsConnection3, 'send');
				wsConnection.broadcastAllRooms({ type: 'announcement' });
				expects = () => {
					expect(sendSpy2).toHaveBeenCalled();
					expect(sendSpy3).toHaveBeenCalled();
				}
				break;
			}
			case TEST_NAME.WS.BROADCAST_ALL_ROOMS: {
				wsConnection.joinRoom('room-a');
				wsConnection.joinRoom('room-b');
				wsConnection2.joinRoom('room-a');
				wsConnection3.joinRoom('room-b');
				const sendSpy2 = vi.spyOn(wsConnection2, 'send');
				const sendSpy3 = vi.spyOn(wsConnection3, 'send');
				wsConnection.broadcastAllRooms({ type: 'update' });
				expects = () => {
					expect(sendSpy2).toHaveBeenCalledWith({ type: 'update' });
					expect(sendSpy3).toHaveBeenCalledWith({ type: 'update' });
				}
				break;
			}
			case TEST_NAME.WS.BROADCAST_ALL_ROOMS_INCLUDING_SELF: {
				wsConnection.joinRoom('room-a');
				const sendSpy = vi.spyOn(wsConnection, 'send');
				wsConnection.broadcastAllRooms({ type: 'update' }, true);
				expects = () => {
					expect(sendSpy).toHaveBeenCalledWith({ type: 'update' });
				}
				break;
			}
			case TEST_NAME.WS.SEND_CLOSE_FRAME: {
				await wsConnection.close(1000, 'Normal closure');
				const frame = (wsSocket! as unknown as MockSocket).writes[0];
				const mockSocket = {
					write: vi.fn((frame, cb) => {
						// Simula il fallimento chiamando la callback con un errore
						if (typeof cb === 'function') {
						cb(new Error('Network error'));
						}
					}),
					end: vi.fn(),
					destroy: vi.fn()
				} as unknown as Socket;
				const manager = new ConnectionManager(loggerMock);
				const conn = new WebSocketConnection(loggerMock, mockSocket, "/api/test", manager, null);
				manager.add(conn);
				await conn.close(1000, "Normal closure", true);
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).writes.length).toBeGreaterThan(0);
					// Check opcode is 0x08 (close)
					expect(frame[0] & 0x0F).toBe(0x08);
					expect(wsConnection.closed).toBe(true);
					expect(mockSocket.write).toHaveBeenCalled();
				}
				break;
			}
			case TEST_NAME.WS.REMOVE_CONNECTION_FROM_MANAGER: {
				await wsConnection.close();
				expects = () => {
					expect(wsManager!.get(wsConnection.id)).toBeUndefined();
				}
				break;
			}
			case TEST_NAME.WS.STOP_HEARTBEAT_AND_INACTIVITY_TIMEOUT: {
				vi.useFakeTimers();
				expects = () => {
					wsConnection.startHeartbeat(1000);
					wsConnection.startInactivityTimeout(5000);
					wsConnection.close();
					const writes = (wsSocket! as unknown as MockSocket).writes.length;
					vi.advanceTimersByTime(10000);
					// No new pings should be sent
					expect((wsSocket! as unknown as MockSocket).writes.length).toBe(writes);
					vi.useRealTimers();
				}
				break;
			}
			case TEST_NAME.WS.CALL_CLEANUP_CB: {
				const cleanupSpy = vi.fn();
				wsConnection.cleanup = cleanupSpy;
				await wsConnection.close();
				let drainCallback: (() => void) | null = null;
				const mockSocket = {
					write: vi.fn((data, callback) => {
						// Simulate backpressure - first write returns false
						if (callback) setTimeout(() => callback(), 5);
						return false; // Indicates socket buffer is full
					}),
					once: vi.fn((event, handler) => {
						if (event === 'drain') {
						drainCallback = handler;
						}
					}),
					on: vi.fn(),
					removeListener: vi.fn(),
					end: vi.fn(),
					destroy: vi.fn()
				} as any;
				const manager = new ConnectionManager(loggerMock);
				const connection = new WebSocketConnection(loggerMock, mockSocket, '/test', manager, null);
				const sendPromise = connection.send({ type: 'test', message: 'hello' });
				await new Promise(resolve => setTimeout(resolve, 1000));
				expects = async () => {
					expect(cleanupSpy).toHaveBeenCalled();
					expect(mockSocket.once).toHaveBeenCalledWith('drain', expect.any(Function));
					expect(drainCallback).not.toBeNull();
					if (drainCallback) {
						drainCallback();
					}
					await sendPromise;
					expect(mockSocket.write).toHaveBeenCalled();
				}
				break;
			}
			case TEST_NAME.WS.SEND_CLOSE_FRAME_TWICE: {
				await wsConnection.close();
				(wsSocket! as unknown as MockSocket).clearWrites();
				await wsConnection.close();
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).writes).toHaveLength(0);
				}
				break;
			}
			case TEST_NAME.WS.DESTROY_SOCKET: {
				wsConnection.forceClose();
				expects = () => {
					expect((wsSocket! as unknown as MockSocket).destroyed).toBe(true);
					expect(wsConnection.closed).toBe(true);
				}
				break;
			}
			case TEST_NAME.WS.CALL_CONNECT_CLEANUP_CB: {
				const cleanupSpy = vi.fn();
				wsConnection.cleanup = cleanupSpy;
				wsConnection.forceClose();
				expects = () => {
					expect(cleanupSpy).toHaveBeenCalled();
				}
				break;
			}
			case TEST_NAME.WS.NON_FRAGMENTED_FRAME: {
				const frame: WebSocketFrame = {
					fin: true,
					rsv1: false,
					rsv2: false,
					rsv3: false,
					opcode: 0x01,
					masked: true,
					payload: Buffer.from('Hello'),
					payloadLength: 5
				};
				const frame2: WebSocketFrame = {
					fin: false,
					rsv1: false,
					rsv2: false,
					rsv3: false,
					opcode: 0x01,
					masked: true,
					payload: Buffer.from('Hello'),
					payloadLength: 5
				};
				const frame3: WebSocketFrame = {
					fin: false,
					rsv1: false,
					rsv2: false,
					rsv3: false,
					opcode: 0x00,
					masked: true,
					payload: Buffer.from('Hello'),
					payloadLength: 5
				};
				const result = wsConnection.accumulateFragment(frame);
				wsConnection2.accumulateFragment(frame2);
				const result2 = wsConnection2.accumulateFragment(frame3);
				expects = () => {
					expect(result).not.toBeNull();
					expect(result?.payload.toString()).toBe('Hello');
					expect(result?.opcode).toBe(0x01);
					expect(result2).toBeNull();
				}
				break;
			}
			case TEST_NAME.WS.ACCUMULATE_FRAMES: {
				// First frame (not final)
				const frame1: WebSocketFrame = {
					fin: false,
					rsv1: false,
					rsv2: false,
					rsv3: false,
					opcode: 0x01,
					masked: true,
					payload: Buffer.from('Hel'),
					payloadLength: 3
				};
				const result1 = wsConnection.accumulateFragment(frame1);
				// Continuation frame (final)
				const frame2: WebSocketFrame = {
					fin: true,
					rsv1: false,
					rsv2: false,
					rsv3: false,
					opcode: 0x00, // Continuation
					masked: true,
					payload: Buffer.from('lo'),
					payloadLength: 2
				};
				const result2 = wsConnection.accumulateFragment(frame2);
				expects = () => {
					expect(result1).toBeNull();
					expect(result2).not.toBeNull();
					expect(result2?.payload.toString()).toBe('Hello');
					expect(result2?.opcode).toBe(0x01); // Original opcode
				}
				break;
			}
			case TEST_NAME.WS.WITHOUT_INITIAL_FRAME: {
				const frame: WebSocketFrame = {
					fin: true,
					rsv1: false,
					rsv2: false,
					rsv3: false,
					opcode: 0x00, // Continuation
					masked: true,
					payload: Buffer.from('test'),
					payloadLength: 4
				};
				expects = () => {
					expect(() => wsConnection.accumulateFragment(frame)).toThrow(
						'Continuation frame without initial frame'
					);
				}
				break;
			}
			case TEST_NAME.WS.COMPRESS_DATA: {
				const original = Buffer.from('a'.repeat(10_000));
				const compressed = await wsDeflate!.compressMessage(original);
				const deflateOptions = {
					server_max_window_bits: 15,
					client_max_window_bits: 15,
					server_no_context_takeover: true,
					client_no_context_takeover: true
				};
				const deflate = new WebSocketDeflate(deflateOptions);
				const resetSpy = vi.spyOn((deflate as any).inflate, 'reset');
				const resetSpy2 = vi.spyOn((deflate as any).deflate, 'reset');
				const message = Buffer.from('Test message for inflate reset');
				const compressed2 = await deflate.compressMessage(message);
				await deflate.decompressMessage(compressed2);
				expects = async () => {
					expect(compressed.length).toBeLessThan(original.length);
					expect(resetSpy).toHaveBeenCalledTimes(1);
					expect(resetSpy2).toHaveBeenCalledTimes(1);
					deflate.destroy();
				}
				break;
			}
			case TEST_NAME.WS.REMOVE_TAIL_BYTES: {
				const original = Buffer.from('Test');
				const compressed = await wsDeflate!.compressMessage(original);
				const last4 = compressed.subarray(-4);
				const deflateOptions = {
					server_max_window_bits: 15,
					client_max_window_bits: 15,
					server_no_context_takeover: false,
					client_no_context_takeover: false
				};
				const deflate = new WebSocketDeflate(deflateOptions);
				expects = async () => {
					expect(
						last4[0] === 0x00 &&
						last4[1] === 0x00 &&
						last4[2] === 0xFF &&
						last4[3] === 0xFF
					).toBe(false);
					await expect(deflate.decompressMessage(Buffer.from('test'))).rejects.toThrow('invalid code lengths set');
					deflate.destroy();
				}
				break;
			}
			case TEST_NAME.WS.DECOMPRESS_DATA: {
				const original = Buffer.from('Hello World! This is a test message.');
				const compressed = await wsDeflate!.compressMessage(original);
				const decompressed = await wsDeflate!.decompressMessage(compressed);
				const deflateOptions = {
					server_max_window_bits: 15,
					client_max_window_bits: 15,
					server_no_context_takeover: false,
					client_no_context_takeover: false
				};
				const deflate = new WebSocketDeflate(deflateOptions);
				(deflate as any).deflate.flush = vi.fn((flag: any, callback: any) => {
					callback(new Error('Decompression flush error'));
				});
				const manager = new ConnectionManager(loggerMock);
				const conn1 = new WebSocketConnection(loggerMock, createMockSocket(), '/test2', manager, {server_max_window_bits: 11}, {serverMaxWindowBits: 11});
				const conn2 = new WebSocketConnection(loggerMock, createMockSocket(), '/test1', manager, null);
				manager.add(conn1);
				manager.add(conn2);
				const deflate2 = new WebSocketDeflate({ server_max_window_bits: 11 });
				const compressed2 = await deflate2.compressMessage(original);
				const decompressed2 = await conn1.decompressData(compressed2);
				const decompressed3 = await conn2.decompressData(original);
				expects = async () => {
					expect(decompressed.toString()).toBe(original.toString());
					await expect(deflate.compressMessage(Buffer.from('test'))).rejects.toThrow('Decompression flush error');
					deflate.destroy();
					expect(decompressed2.toString()).toStrictEqual(original.toString());
					expect(decompressed3.toString()).toStrictEqual(original.toString());
					conn1.close();
					conn2.close();
					deflate2.destroy();
				}
				break;
			}
			case TEST_NAME.WS.HANDLE_EMPTY_DATA: {
				const compressed = await wsDeflate!.compressMessage(Buffer.from(''));
				const decompressed = await wsDeflate!.decompressMessage(compressed);
				const deflateOptions = {
					server_max_window_bits: 15,
					client_max_window_bits: 15,
					server_no_context_takeover: false,
					client_no_context_takeover: false
				};
				const deflate = new WebSocketDeflate(deflateOptions);
				const removeListenerSpy = vi.spyOn((deflate as any).deflate, 'removeListener');
				const originalWrite = (deflate as any).deflate.write;
				let errorCallback: ((err: Error) => void) | null = null;
				(deflate as any).deflate.write = vi.fn(function(this: any, data: Buffer) {
					originalWrite.call(this, data);
					return true;
				});
				(deflate as any).deflate.flush = vi.fn(function(this: any, flag: any, callback: any) {
					const listeners = this.listeners('error');
					if (listeners.length > 0) {
						errorCallback = listeners[listeners.length - 1];
					}
					if (errorCallback) {
						errorCallback(new Error('Compression error'));
					}
				});

				expects = async () => {
					expect(decompressed.length).toBe(0);
					await expect(deflate.compressMessage(Buffer.from('test'))).rejects.toThrow('Compression error');
					expect(removeListenerSpy).toHaveBeenCalledWith('data', expect.any(Function));
					expect(removeListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
					deflate.destroy();
				}
				break;
			}
			case TEST_NAME.WS.MULTIPLE_CYCLES: {
				const messages = [
					'First message',
					'Second message with more data',
					'Third message',
				];
				const deflateOptions = {
					server_max_window_bits: 15,
					client_max_window_bits: 15,
					server_no_context_takeover: false,
					client_no_context_takeover: false
				};
				const deflate = new WebSocketDeflate(deflateOptions);
				(deflate as any).inflate.flush = vi.fn((flag: any, callback: any) => {
					callback(new Error('Decompression flush error'));
				});

				expects = async () => {
					for (const msg of messages) {
						const original = Buffer.from(msg);
						const compressed = await wsDeflate!.compressMessage(original);
						const decompressed = await wsDeflate!.decompressMessage(compressed);

						expect(decompressed.toString()).toBe(msg);
					}
					await expect(deflate.decompressMessage(Buffer.from('test'))).rejects.toThrow('Decompression flush error');
					deflate.destroy();
				}
				break;
			}
			case TEST_NAME.WS.RUN_WS_PLUGIN_1: {
				const spy = vi.spyOn(wsSocket!, 'write');
				await executeWsPlugin({
					enableWs: true,
					wsHandlers: [
						{
							pattern: "/ws",
							disabled: true
						}
					]
				});
				await new Promise(res => setTimeout(res, 50));

				await executeWsPlugin({
					enableWs: true,
					wsHandlers: [
						{
							pattern: "/ws",
							disabled: false
						}
					]
				});
				await new Promise(res => setTimeout(res, 50));

				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								authenticate: (req) => false
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } }
					}
				)
				await new Promise(res => setTimeout(res, 50));

				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								authenticate: (req) => {
									throw new Error("test")
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } }
					}
				)
				await new Promise(res => setTimeout(res, 50));

				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								perMessageDeflate: {
									clientMaxWindowBits: 8,
									strict: true
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key", "sec-websocket-extensions": "permessage-deflate; client_max_window_bits=9" } }
					}
				)
				await new Promise(res => setTimeout(res, 50));

				let error: string;
				try {
					await executeWsPlugin(
						{
							enableWs: true,
							wsHandlers: [
								{
									pattern: "/ws",
									disabled: false,
									perMessageDeflate: {
										clientMaxWindowBits: 8,
										strict: true
									}
								}
							]
						},
						{
							req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key", "sec-websocket-extensions": 12 } }
						}
					)
				} catch (err: any) {
					error = err.message;
				}
				await new Promise(res => setTimeout(res, 50));

				let spyConnect;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								defaultRoom: "general",
								heartbeat: 1000,
								inactivityTimeout: 2000,
								async onConnect(connection: IWebSocketConnection) {
									spyConnect = vi.spyOn(connection, "send");
									throw new Error("test")
								},
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } }
					}
				)
				await new Promise(res => setTimeout(res, 50));

				let spyConnect2;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								async onConnect(connection: IWebSocketConnection) {
									throw new Error("test")
								},
								async onError(connection, error) {
									spyConnect2 = vi.spyOn(connection, "send");
									await connection.send("handled");
								},
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } }
					}
				)
				await new Promise(res => setTimeout(res, 50));

				let spyConnect3;
				const socket = createMockSocket();
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								inactivityTimeout: 2000,
								async onConnect(connection: IWebSocketConnection) {
									spyConnect3 = vi.spyOn(connection, "send");
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket
					}
				)
				socket.emit("data", "Test");
				await new Promise(res => setTimeout(res, 50));

				let spyConnect4;
				const socket2 = createMockSocket();
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								inactivityTimeout: 2000,
								async onError(connection: IWebSocketConnection) {
									spyConnect4 = vi.spyOn(connection, "send");
									await connection.send("handled")
								},
								async onClose(connection, code1, reason1, initiatedByClient) {
									await connection.close(code1, reason1, initiatedByClient);
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket2
					}
				)
				socket2.emit("data", "Test");
				await new Promise(res => setTimeout(res, 50));

				let code;
				let reason;
				let onTrasformRawDataExecute = false;
				const socket3 = createMockSocket();
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								async onClose(connection, code1, reason1, initiatedByClient) {
									code = code1;
									reason = reason1;
								},
								transformRawData(rawMessage) {
									if (!onTrasformRawDataExecute) {
										onTrasformRawDataExecute = true;
										return rawMessage;
									} else {
										throw new Error("test");
									}
								},
								onMessage(connection, message) {
									throw new Error("test");
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket3
					}
				)
				socket3.emit("data", createWebSocketFrame("Test"));
				socket3.emit("data", createWebSocketFrame("Test1"));
				socket3.emit("close", false);
				await new Promise(res => setTimeout(res, 50));

				const socket4 = createMockSocket();
				let err: string;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								async onError(connection, error) {
									err = error.message;
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket4
					}
				)
				socket4.emit("error", new Error("test"));
				await new Promise(res => setTimeout(res, 50));

				const socket5 = createMockSocket();
				let mess;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								delay: 50,
								disabled: false,
								transformRawData(rawMessage) {
									throw new Error("test");
								},
								onMessage(connection, message) {
									throw new Error("test");
								},
								onError(connection, error) {
									mess = error.message;
								},
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket5
					}
				)
				socket5.emit("data", createWebSocketFrame("Test"));
				socket5.emit("data", createWebSocketFrame("Test1"));
				await new Promise(res => setTimeout(res, 50));

				const socket6 = createMockSocket();
				let code1;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onClose(connection, code, reason, initiatedByClient) {
									code1 = code;
								},
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket6
					}
				)
				const payload = Buffer.alloc(2 + 10);
				payload.writeUInt16BE(1000, 0);
				payload.write('Normal close', 2, 'utf-8');
				socket6.emit("data", createWebSocketFrame(payload, {opcode: 0x08}));
				await new Promise(res => setTimeout(res, 50));

				const socket7 = createMockSocket();
				let code2: number, code3: number, code4: number, code5: number, code6: number, code7: number, code8: number;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								async onClose(connection, code, reason, initiatedByClient) {
									if (!code8 && code7) {
										code8 = code!;
										await connection.close(code, reason, initiatedByClient);
									}
									if (!code7 && code6) {
										code7 = code!;
									}
									if (!code6 && code5) {
										code6 = code!;
									}
									if (!code5 && code4) {
										code5 = code!;
									}
									if(!code4 && code3) {
										code4 = code!;
									}
									if(!code3 && code2) {
										code3 = code!;
									}
									if (!code2) {
										code2 = code!;
									}
								},
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket7
					}
				)
				const payload2 = Buffer.alloc(2);
				payload2.writeUInt16BE(1005, 0);
				socket7.emit("data", createWebSocketFrame(payload2, {opcode: 0x08}));
				socket7.emit("data", createWebSocketFrame(Buffer.from([0x42]), {opcode: 0x08}));
				socket7.emit("data", createWebSocketFrame(Buffer.alloc(0), {opcode: 0x08}));
				const payload3 = Buffer.alloc(2 + 2);
				payload3.writeUInt16BE(1000, 0);
				payload3[2] = 0xFF;
				payload3[3] = 0xFE;
				socket7.emit("data", createWebSocketFrame(payload3, {opcode: 0x08}));
				const payload4 = Buffer.alloc(126);
				payload4.writeUInt16BE(1000, 0);
				socket7.emit("data", createWebSocketFrame(payload4, {opcode: 0x08}));
				const payload5 = Buffer.alloc(2);
				payload5.writeUInt16BE(1016, 0);
				socket7.emit("data", createWebSocketFrame(payload5, {opcode: 0x08}));
				const payload6 = Buffer.alloc(2);
				payload6.writeUInt16BE(4000, 0);
				socket7.emit("data", createWebSocketFrame(payload6, { opcode: 0x08 }));
				socket7.emit("close", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x08 }));
				await new Promise(res => setTimeout(res, 50));

				const socket8 = createMockSocket();
				let spyConnect5;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onConnect(connection, data) {
									spyConnect5 = vi.spyOn(connection, "pong");
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket8
					}
				)
				socket8.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x09 }));
				await new Promise(res => setTimeout(res, 50));

				const socket9 = createMockSocket();
				let code9: string, code10: string;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onPing(connection, data) {
									throw new Error("test");
								},
								onPong(connection, data) {
									throw new Error("test");
								},
								onError(connection, error) {
									if (!code10 && code9) {
										code10 = error.message;
									}
									if (!code9) {
										code9 = error.message;
									}
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket9
					}
				)
				socket9.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x09 }));
				socket9.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x0A }));
				await new Promise(res => setTimeout(res, 50));

				const socket10 = createMockSocket();
				let spyConnect6;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onConnect(connection, data) {
									spyConnect6 = vi.spyOn(connection, "send");
								},
								onPing(connection, data) {
									throw new Error("test");
								},
								onPong(connection, data) {
									throw new Error("test");
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket10
					}
				)
				socket10.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x09 }));
				socket10.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x0A }));
				await new Promise(res => setTimeout(res, 50));

				const socket11 = createMockSocket();
				let code11: number, code12: number, code13: number;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onClose(connection, code, reason, initiatedByClient) {
									if (!code13 && code12) {
										code13 = code!;
									}
									if (!code12 && code11) {
										code12 = code!;
									}
									if (!code11) {
										code11 = code!;
									}
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket11
					}
				)
				socket11.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x04 }));
				socket11.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x01, rsv1: true }));
				socket11.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x02, rsv2: true }));
				await new Promise(res => setTimeout(res, 50));

				const socket12 = createMockSocket();
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onClose(connection, code, reason, initiatedByClient) {
									if (!code13 && code12) {
										code13 = code!;
									}
									if (!code12 && code11) {
										code12 = code!;
									}
									if (!code11) {
										code11 = code!;
									}
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket12
					}
				)
				socket12.emit("data", createWebSocketFrame(Buffer.alloc(0), { opcode: 0x01, fin: false }));
				await new Promise(res => setTimeout(res, 50));

				const socket13 = createMockSocket();
				let spyConnect7;
				let spyConnect8;
				let spyConnect9;
				let rawMessagExecuted = 0;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onConnect(connection, request) {
									spyConnect7 = vi.spyOn(connection, "send");
									spyConnect8 = vi.spyOn(connection, "broadcastAllRooms");
									spyConnect9 = vi.spyOn(connection, "broadcast");
								},
								transformRawData(rawMessage) {
									if (rawMessagExecuted === 0) {
										rawMessagExecuted = 1;
										return "test";
									} else if (rawMessagExecuted === 1) {
										rawMessagExecuted = 2;
										return "broadcast";
									} else if (rawMessagExecuted === 2) {
										rawMessagExecuted = 3;
										return "broadcast-obj";
									} else if (rawMessagExecuted === 3) {
										rawMessagExecuted = 4;
										return "error-match";
									}
									return "error"
								},
								responses: [
									{
										match(connection, message) {
											throw new Error("match-error");
										},
										response(connection, message) {
											return "OK";
										}
									},
									{
										match(connection, message) {
											return message === "test";
										},
										response(connection, message) {
											return "OK";
										}
									},
									{
										match(connection, message) {
											return message === "broadcast";
										},
										response(connection, message) {
											return "OK";
										},
										broadcast: true
									},
									{
										match(connection, message) {
											return message === "broadcast-obj";
										},
										response(connection, message) {
											return "OK";
										},
										broadcast: {
											includeSelf: false
										}
									},
									{
										match(connection, message) {
											return message === "error";
										},
										response(connection, message) {
											throw new Error("test");
										}
									}
								]
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket13
					}
				)
				socket13.emit("data", createWebSocketFrame("Test"));
				socket13.emit("data", createWebSocketFrame("Test1"));
				socket13.emit("data", createWebSocketFrame("Test2"));
				socket13.emit("data", createWebSocketFrame("Test3"));
				socket13.emit("data", createWebSocketFrame("Test4"));
				await new Promise(res => setTimeout(res, 50));

				const socket14 = createMockSocket();
				let code14: string, code15: string;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onError(connection, error) {
									if (!code15 && code14) {
										code15 = error.message;
									}
									if (!code14) {
										code14 = error.message;
									}
								},
								transformRawData(rawMessage) {
									if (rawMessagExecuted === 4) {
										rawMessagExecuted = 5;
										return "response-error";
									} else if (rawMessagExecuted === 5) {
										rawMessagExecuted = 6;
										return "error-match";
									}
									return "error"
								},
								responses: [
									{
										match(connection, message) {
											throw new Error("match-error");
										},
										response(connection, message) {
											return "OK";
										}
									},
									{
										match(connection, message) {
											return message === "response-error";
										},
										response(connection, message) {
											throw new Error("test");
										}
									},
								]
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket14
					}
				)
				socket14.emit("data", createWebSocketFrame("Test"));
				socket14.emit("data", createWebSocketFrame("Test1"));
				await new Promise(res => setTimeout(res, 50));

				const socket15 = createMockSocket();
				let spyConnect10;
				mocks.utils.ws.transformPayloadToMessage.mockReturnValue = true;
				mocks.utils.ws.transformPayloadToMessage.shouldFail = false;
				mocks.utils.ws.transformPayloadToMessage.returnValue = {result: false, message: null};
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onConnect(connection, request) {
									spyConnect10 = vi.spyOn(connection, "send");
								},
								responses: [
									{
										match(connection, message) {
											return true;
										},
										response(connection, message) {
											throw new Error("test");
										}
									}
								]
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket15
					}
				)
				socket15.emit("data", createWebSocketFrame("Test"));
				await new Promise(res => setTimeout(res, 50));

				expects = () => {
					expect(spy).toHaveBeenCalledWith('HTTP/1.1 404 Not Found\r\n\r\n');
					expect(spy).toHaveBeenCalledWith('HTTP/1.1 400 Bad Request\r\n\r\n');
					expect(spy).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\n\r\n');
					expect(spy).toHaveBeenCalledWith('HTTP/1.1 500 Internal Server Error\r\n\r\n');
					expect(error).toBe("request.headers.sec-websocket-extensions?.split is not a function")
					expect(spyConnect!).toHaveBeenCalledWith({type: "error", message: "test"});
					expect(spyConnect2!).toHaveBeenCalledWith("handled");
					expect(spyConnect3!).toHaveBeenCalledWith({type: "error", message: "The \"list[1]\" argument must be an instance of Buffer or Uint8Array. Received type string ('Test')"});
					expect(spyConnect4!).toHaveBeenCalledWith("handled");
					expect(code!).toBe(1000);
					expect(reason!).toBe("");
					expect(err!).toBe("test");
					expect(mess!).toBe("test");
					expect(code1!).toBe(1000);
					expect(code2!).toBe(1002);
					expect(code3!).toBe(1002);
					expect(code4!).toBe(1000);
					expect(code5!).toBe(1002);
					expect(code6!).toBe(1002);
					expect(code7!).toBe(1002);
					expect(code8!).toBe(4000);
					expect(code9!).toBe("test");
					expect(spyConnect5!).toHaveBeenCalled();
					expect(spyConnect6!).toHaveBeenCalledWith({ type: "error", message: "test"});
					expect(spyConnect6!).toHaveBeenCalledWith({ type: "error", message: "test"});
					expect(code11!).toBe(1002);
					expect(code12!).toBe(1002);
					expect(code13!).toBe(1002);
					expect(spyConnect7!).toHaveBeenCalledWith("OK");
					expect(spyConnect7!).toHaveBeenCalledWith({ type: "error", message: "test"});
					expect(spyConnect8!).toHaveBeenCalled();
					expect(spyConnect9!).toHaveBeenCalled();
					expect(spyConnect7!).toHaveBeenCalledWith({ type: "error", message: "match-error"});
					expect(code14!).toBe("test");
					expect(code15!).toBe("match-error");
					expect(spyConnect10!).toHaveBeenCalledWith({ type: "error", message: "test"});
				}
				break;
			}
			case TEST_NAME.WS.RUN_WS_PLUGIN_2: {
				const socket16 = createMockSocket();
				let spyConnect11;
				mocks.utils.ws.transformPayloadToMessage.mockReturnValue = true;
				mocks.utils.ws.transformPayloadToMessage.shouldFail = false;
				mocks.utils.ws.transformPayloadToMessage.returnValue = {result: true, message: "error"};
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onConnect(connection, request) {
									spyConnect11 = vi.spyOn(connection, "send");
								},
								responses: [
									{
										match(connection, message) {
											return true;
										},
										response(connection, message) {
											throw new Error("test");
										}
									},
								]
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket16
					}
				)
				socket16.emit("data", createWebSocketFrame("Test"));
				await new Promise(res => setTimeout(res, 1050));

				expects = () => {
					expect(spyConnect11!).toHaveBeenCalledWith({ type: "error", message: "test" });
				}
				break;
			}
			case TEST_NAME.WS.RUN_WS_PLUGIN_3: {
				const socket17 = createMockSocket();
				let spyConnect12;
				mocks.utils.ws.transformPayloadToMessage.mockReturnValue = false;
				mocks.utils.ws.transformPayloadToMessage.returnValue = null;
				mocks.utils.ws.transformPayloadToMessage.shouldFail = true;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onConnect(connection, request) {
									spyConnect12 = vi.spyOn(connection, "send");
								},
								responses: [
									{
										match(connection, message) {
											return true;
										},
										response(connection, message) {
											throw new Error("test");
										}
									},
								]
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket17
					}
				)
				socket17.emit("data", createWebSocketFrame("Test"));
				await new Promise(res => setTimeout(res, 50));
				expects = () => {
					expect(spyConnect12!).toHaveBeenCalledWith({ type: "error", message: "generic" });
				}
				break;
			}
			case TEST_NAME.WS.RUN_WS_PLUGIN_4: {
				const socket18 = createMockSocket();
				mocks.utils.ws.transformPayloadToMessage.mockReturnValue = false;
				mocks.utils.ws.transformPayloadToMessage.returnValue = null;
				mocks.utils.ws.transformPayloadToMessage.shouldFail = true;
				let code16: string;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								onError(connection, error) {
									code16 = error.message;
								},
								responses: [
									{
										match(connection, message) {
											return true;
										},
										response(connection, message) {
											throw new Error("test");
										}
									},
								]
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key" } },
						socket: socket18
					}
				)
				socket18.emit("data", createWebSocketFrame("Test"));

				expects = () => {
					expect(code16!).toBe("generic");
				}
				break;
			}
			case TEST_NAME.WS.RUN_WS_PLUGIN_5: {
				const socket18 = createMockSocket();
				let code16: string;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								perMessageDeflate: {
									serverMaxWindowBits: 8
								},
								onError(connection, error) {
									code16 = error.message;
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key", "sec-websocket-extensions": 'permessage-deflate; server_max_window_bits=12' } },
						socket: socket18
					}
				)
				socket18.emit("data", createWebSocketFrame("Test", { rsv1: true }));
				await new Promise(res => setTimeout(res, 200));
				expects = () => {
					expect(code16!).toBe("invalid code lengths set");
				}
				break;
			}
			case TEST_NAME.WS.RUN_WS_PLUGIN_6: {
				const socket18 = createMockSocket();
				let spyConnect13;
				await executeWsPlugin(
					{
						enableWs: true,
						wsHandlers: [
							{
								pattern: "/ws",
								disabled: false,
								perMessageDeflate: {
									serverMaxWindowBits: 8
								},
								onConnect(connection, request) {
									spyConnect13 = vi.spyOn(connection, "send");
								}
							}
						]
					},
					{
						req: { url: "/api/ws", headers: { upgrade: "websocket", "sec-websocket-key": "key", "sec-websocket-extensions": 'permessage-deflate; server_max_window_bits=12' } },
						socket: socket18
					}
				)
				socket18.emit("data", createWebSocketFrame("Test", { rsv1: true }));
				await new Promise(res => setTimeout(res, 200));
				expects = () => {
					expect(spyConnect13!).toHaveBeenCalledWith({type: "error", message: "invalid code lengths set"});
				}
				break;
			}
			default:
				throw new Error("TEST NAME NOT FOUND");
		}
		if (context.task.name.includes("UTILS")) {
			//
		} else if (context.task.name.includes("WS")) {
			//
		} else {
			req.end();
			const plug = await generateOptions(mockOptions);
			await plug.configResolved(CONF);
			const server = getServer();
			context.task.name.includes("CONFIGURE_PREVIEW_SERVER")
				? plug.configureServer(server)
				: plug.configurePreviewServer(server);
			executeMiddleware && (middlewareHandler = (server).middlewares.use.mock.calls[0][0]);
		}
	});
	afterEach((context) => {
		resetShouldFailMocks(mocks);
		if (context.task.name.includes("UTILS")) {
			//
		} else if (context.task.name.includes("WS")) {
			if (!wsConnection.closed) {
				wsConnection.forceClose();
			}
			if (!wsConnection2.closed) {
				wsConnection2.forceClose();
			}
			if (!wsConnection3.closed) {
				wsConnection3.forceClose();
			}
			wsDeflate!.destroy();
		} else {
			executeMiddleware = true;
			rimraf.sync(MOCK_DIR.PATH);
		}
	});
	executeTests(TEST_NAME, testFunction);
});

// process.on('unhandledRejection', (reason) => {
// 	console.error('DEBUG STACK TRACE:', reason);
// });
