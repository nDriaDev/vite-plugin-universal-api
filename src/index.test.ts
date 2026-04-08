import { PreviewServer, ResolvedConfig, ViteDevServer } from "vite";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UniversalApiOptions, UniversalApiRequest } from "./models/index.model";
import path from "node:path";
import { mkdirp } from 'mkdirp';
import * as fs from 'node:fs';
import { rimraf } from 'rimraf';
import { Constants } from "./utils/constants";
import { PassThrough } from "node:stream";
import { UniversalApiError } from "./utils/Error";
import { Utils } from "./utils/utils";
import { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { URLSearchParams } from "node:url";

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
		}
	}
}));
vi.mock('./utils/utils', async (importOriginal) => {
	const mod = await importOriginal<typeof import('./utils/utils')>();
	const requestsContext = mod.Utils.request;
	const responseContext = mod.Utils.response;
	const fileContext = mod.Utils.files;
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

	return {
		...mod,
		Utils: {
			...mod.Utils,
			files: {
				...mod.Utils.files,
				writingFile: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.files.writingFile.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.files.writingFile.original.apply(fileContext, args);
					}
				})
			},
			request: {
				...mod.Utils.request,
				addSlash: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.request.addSlash.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.addSlash.original.apply(requestsContext, args)
					}
				}),
				applyPaginationAndFilters: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.request.applyPaginationAndFilters.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.applyPaginationAndFilters.original.apply(
							mocks.utils.request.getPaginationAndFilters.returnValue ? { ...requestsContext, getPaginationAndFilters: vi.fn().mockReturnValue(mocks.utils.request.getPaginationAndFilters.returnValue) } : requestsContext,
							args
						)
					}
				}),
				createRequest: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.request.createRequest.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.createRequest.original.apply(requestsContext, args)
					}
				}),
				getCleanBody: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.request.getCleanBody.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.getCleanBody.original.apply(requestsContext, args)
					}
				}),
				getPaginationAndFilters: mocks.utils.request.getPaginationAndFilters.returnValue
					? vi.fn().mockReturnValue(mocks.utils.request.getPaginationAndFilters.returnValue)
					: vi.fn().mockImplementation((...args) => {
						if (mocks.utils.request.getPaginationAndFilters.shouldFail) {
							throw new Error("generic");
						} else {
							return mocks.utils.request.getPaginationAndFilters.original.apply(requestsContext, args)
						}
					}),
				MiddlewaresChain: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.request.MiddlewaresChain.shouldFail) {
						throw new Error("generic");
					} else if (mocks.utils.request.MiddlewaresChainUse.shouldFail) {
						return {
							use() {
								throw new Error("generic");
							}
						}
					} else if (mocks.utils.request.MiddlewaresChainHandle.shouldFail) {
						return {
							use() { },
							handle() {
								throw new UniversalApiError("generic", "TIMEOUT", "");
							}
						}
					} else {
						return mocks.utils.request.MiddlewaresChain.original.apply(requestsContext, args)
					}
				}),
				parseRequest: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.request.parseRequest.shouldFail) {
						throw new UniversalApiError("generic", "ERROR", "");
					} else {
						return mocks.utils.request.parseRequest.original.apply(requestsContext, args)
					}
				}),
				removeSlash: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.request.removeSlash.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.request.removeSlash.original.apply(requestsContext, args)
					}
				})
			},
			response: {
				...mod.Utils.response,
				settingResponse: vi.fn().mockImplementation((...args) => {
					if (mocks.utils.response.settingResponse.shouldFail) {
						throw new Error("generic");
					} else {
						return mocks.utils.response.settingResponse.original.apply(responseContext, args)
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
		use: vi.fn(),
	},
	httpServer: vi.mockObject({once: vi.fn()})
}) as any;
const generateOptions = (opt?: UniversalApiOptions) => (
	import('./index')
		.then(module => module.default(opt) as unknown as {
			configResolved: (conf: ResolvedConfig) => Promise<void>,
			configureServer: (server: ViteDevServer) => void,
			configurePreviewServer: (server: PreviewServer) => void
		})
);
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
				chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"; filename="${value.filename}"\r\n`));
				chunks.push(Buffer.from(`Content-Type: ${value.contentType || 'application/octet-stream'}\r\n\r\n`));
				chunks.push(Buffer.isBuffer(value.content) ? value.content : Buffer.from(value.content));
			} else {
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
	const req = new PassThrough() as PassThrough & { url: string, method: string, headers: Record<string, any>, statusCode: number, setHeader: (...args: unknown[]) => void, removeHeader: (name: string) => void, write: any };
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
	if (obj === null) {
		return;
	}
	const keys = Reflect.ownKeys(obj);
	for (const key of keys) {
		if (key === "shouldFail") {
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

describe('TEST PLUGIN', () => {
	const mockOptions: UniversalApiOptions = {
		logLevel: 'info',
		disable: false,
	};
	beforeEach(() => {
		logSpy.mockClear();
		vi.clearAllMocks();
	})
	it('LOG_DEBUG', async () => {
		mockOptions.logLevel = "debug";
		const plug = await generateOptions(mockOptions);
		await plug.configResolved(CONF);
		const server = getServer();
		plug.configureServer(server);
		expect(logSpy).toHaveBeenCalledTimes(9);
	});

	it('LOG_INFO', async () => {
		mockOptions.logLevel = "info";
		const plug = await generateOptions(mockOptions);
		await plug.configResolved(CONF);
		const server = getServer();
		plug.configureServer(server);
		expect(logSpy).toHaveBeenCalledTimes(3);
	});

	it('LOG_WARN_NO_PREFIX', async () => {
		mockOptions.logLevel = "warn";
		mockOptions.endpointPrefix = [];
		const plug = await generateOptions(mockOptions);
		await plug.configResolved(CONF);
		const server = getServer();
		plug.configureServer(server);
		expect(logSpy).toHaveBeenCalledTimes(4);
	});
});

describe('TEST CONFIGURE_PREVIEW_SERVER', () => {
	let mockOptions: UniversalApiOptions;
	let wrapperMiddleware: any;

	async function execute(middleware: boolean) {
		const plug = await generateOptions(mockOptions);
		await plug.configResolved(CONF);
		const server = getServer();
		plug.configurePreviewServer(server);
		if (middleware) {
			if (!wrapperMiddleware) {
				wrapperMiddleware = (server).middlewares.use.mock.calls[0][0];
				if (!wrapperMiddleware) {
					throw new Error("Wrapper middleware not registered: server didn't call middlewares.use");
				}
			}
			return wrapperMiddleware;
		}
	}

	function generateRequestResponseNextResponseData() {
		const req = createMockRequestResponse(true);
		const res = createMockRequestResponse(false);
		const responseData: {value: string} = {value: ""};
		res.on('data', (chunk: any) => responseData.value += chunk.toString());
		return {
			req,
			res,
			next: vi.fn(),
			responseData
		}
	}

	beforeEach(() => {
		mockOptions = {
			endpointPrefix: [ENDPOINT_PREFIX, "/test"],
			fsDir: MOCK_DIR.NAME,
			logLevel: 'info',
			disable: false,
		}
		logSpy.mockClear();
		vi.clearAllMocks();
		wrapperMiddleware = undefined;
	});

	it('DISABLED', async () => {
		delete mockOptions.endpointPrefix;
		delete mockOptions.fsDir;
		mockOptions.logLevel = "debug";
		mockOptions.disable = true;
		await execute(false);
		expect(logSpy).toHaveBeenCalledTimes(5);
	});

	it('LOG_DEBUG', async () => {
		delete mockOptions.endpointPrefix;
		delete mockOptions.fsDir;
		mockOptions.logLevel = "debug",
		await execute(false);
		expect(logSpy).toHaveBeenCalledTimes(9);
	});

	it('NO_MATCH_PREFIX', async () => {
		const middleware = await execute(true);
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/apis/users";
		req.end();
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Request doesn't match endpointPrefix");
		expect(next).not.toHaveBeenCalled();
	});

	it('NO_REQ_HANDLER', async () => {
		delete mockOptions.fsDir;
		const middleware = await execute(true);
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/users/all";
		req.end();
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Impossible handling request with url http://localhost/api/users/all");
		expect(next).not.toHaveBeenCalled();

	});

	it('NO_FILE_FOUND', async () => {
		mkdirp.sync(MOCK_DIR.PATH);
		const middleware = await execute(true);
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/address/all";
		req.end();
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Not found");
		expect(next).not.toHaveBeenCalled();
		rimraf.sync(MOCK_DIR.PATH);
	});

	it('DISABLED_IN_PREVIEW', async () => {
		delete mockOptions.endpointPrefix;
		delete mockOptions.fsDir;
		mockOptions.logLevel = "debug";
		mockOptions.enablePreview = false;
		await execute(false);
		expect(logSpy).toHaveBeenCalledTimes(6);
	});
});

describe('TEST UTILS', () => {
	let instance: any;
	let mockDataFile: { originalData: null, data: string, mimeType: string, total: number };
	const loggerMock = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } as any;
	const fullUrlMock = { pathname: "" } as any;
	const res = createMockRequestResponse(false);

	function createMockRequest(method: string, queryParams = {}, body = {}): UniversalApiRequest {
		return {
			url: "/api/users",
			method,
			query: {
				get: (key: string) => queryParams[key as keyof typeof queryParams] ?? null
			},
			body
		} as unknown as UniversalApiRequest;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		logSpy.mockClear();
		resetShouldFailMocks(mocks);
		mockDataFile = {
			originalData: null,
			data: JSON.stringify([
				{ id: 1, value: 10, category: { name: 'A' }, tags: ['t1', 't2'] },
				{ id: 2, value: 20, category: { name: 'B' }, tags: ['t2', 't3'] },
				{ id: 3, value: 30, category: { name: 'A' }, tags: ['t1', 't3'] }
			]),
			mimeType: "application/json",
			total: 0
		};
		instance = Utils;
		mocks.utils.request.getPaginationAndFilters.returnValue = null;
	});

	it('PARSE_DATA_WITH_NO_FILTERS_NO_PAG', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: null };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(Array.isArray(mockDataFile.data)).toBe(true);
	});

	it('NO_ARRAY_DATA', async () => {
		const singleItemFile = { ...mockDataFile, data: JSON.stringify({ id: 1, value: 10 }) };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, singleItemFile);
		expect(Array.isArray(singleItemFile.data)).toBe(false);
		expect(singleItemFile.total).toBe(1);
		expect(singleItemFile.data).toEqual({ id: 1, value: 10 });
	});

	it('ONLY_EQ_FILTER', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'eq', value: 20 }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(1);
		expect((mockDataFile.data[0] as unknown as { id: number }).id).toBe(2);
	});

	it('ONLY_NE_FILTER', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'ne', value: 20 }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(2);
		expect((mockDataFile.data as unknown as { id: number }[]).map(el => el.id)).toEqual([1, 3]);
	});

	it('ONLY_LT_FILTERS', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'lt', value: 20 }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(1);
	});

	it('ONLY_LTE_FILTERS', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'lte', value: 10 }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(1);
	});

	it('ONLY_GT_FILTERS', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'gt', value: 20 }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(1);
	});

	it('ONLY_GTE_FILTERS', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'value', comparison: 'gte', value: 20 }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(2);
	});

	it('ONLY_REGEX_FILTER', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'category.name', comparison: 'regex', value: 'A', regexFlags: 'i' }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(2);
	});

	it('ONLY_IN_WITH_ARRAY_DOT_FILTERS', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'tags', comparison: 'in', value: ['t1'] }, { key: 'tags', comparison: 'in', value: 't1' }, { key: 'category.name', comparison: 'in', value: 'A' }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(2);
	});

	it('ONLY_NIN_WITH_ARRAY_FILTERS', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: [{ key: 'tags', comparison: 'nin', value: ['t1'] }, { key: 'tags', comparison: 'nin', value: 't1' }, { key: 'category.name', comparison: 'nin', value: ['A'] }] };
		instance?.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		expect(mockDataFile.data.length).toBe(1);
	});

	it('ASC_ORDER_PAG', async () => {
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
		expect(mockDataFile.data.length).toBe(2);
		expect((mockDataFile.data as unknown as { value: number }[]).map(el => el.value)).toEqual([10, 20]);
	});

	it('DESC_ORDER_PAG', async () => {
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
		expect(mockDataFile.data.length).toBe(1);
		expect((mockDataFile.data[0] as unknown as { value: number }).value).toBe(30);
	});

	it('INVALID_ORDER_PAG', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = {
			pagination: { sort: 'value', order: 'INVALID_ORDER', skip: 0, limit: 1 },
			filters: null
		};
		expect(() => {
			instance!.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, mockDataFile);
		}).toThrow(UniversalApiError);
	});

	it('DATA_NULL', async () => {
		mocks.utils.request.getPaginationAndFilters.shouldFail = true;
		mocks.utils.request.getPaginationAndFilters.returnValue = { pagination: null, filters: null };
		const nullDataFile = { ...mockDataFile, data: null };
		expect(() => {
			instance!.request.applyPaginationAndFilters({} as any, {} as any, {} as any, {} as any, {} as any, nullDataFile);
		}).not.toThrow();
		expect(nullDataFile.total).toBe(0);
	});

	it('GET_PAG_AND_FILTERS_PAG_NULL', async () => {
		const request = createMockRequest('GET');
		const result = instance!.request.getPaginationAndFilters(request, undefined, undefined, null, null);
		expect(result!.pagination).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_PAG_QUERY_PARAM', async () => {
		const request = createMockRequest('GET', { _limit: '10', _skip: '20', sort: "id", order: "1" });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_PAG_QUERY_PARAM_INCOMPLETE', async () => {
		const request = createMockRequest('GET', { _sort: '1', _order: '20' });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toEqual({
			limit: null,
			skip: null,
			sort: "1",
			order: "20"
		});
	});

	it('GET_PAG_AND_FILTERS_PAG_BODY', async () => {
		const request = createMockRequest('POST', {}, { meta: { page_size: '50', offset: '100', sort: "id", order: "1" } });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination?.limit).toBe(50);
		expect(result!.pagination?.skip).toBe(100);
		expect(result!.pagination?.sort).toBe("id");
		expect(result!.pagination?.order).toBe("1");
	});

	it('GET_PAG_AND_FILTERS_PAG_BODY_INCOMPLETE', async () => {
		const request = createMockRequest('POST', {}, { meta: { page_size: '', offset: '', or: "", ss: "" } });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_PAG_BODY_NO_VALUE', async () => {
		const request = createMockRequest('POST', {}, { meta: { page_size: '', offset: '', or: "", ss: "" } });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT', async () => {
		const request = createMockRequest('POST', {}, { page_size: '50', offset: '100', sort: "id", order: 1 });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination.limit).toBe(50);
		expect(result!.pagination.skip).toBe(100);
		expect(result!.pagination.sort).toBe("id");
		expect(result!.pagination.order).toBe(1);
	});

	it('GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT_INCOMPLETE', async () => {
		const request = createMockRequest('POST', {}, { page_size: '50', offset: '100', sort: "id", order: 1 });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_PAG_BODY_WITHOUT_ROOT_NO_VALUE', async () => {
		const request = createMockRequest('POST', {}, { page_size: '', offset: '', sort: '', order: '' });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_PAG_ALL', async () => {
		const request = createMockRequest('GET', { limit: '5' });
		const result = instance!.request.getPaginationAndFilters(
			request,
			undefined,
			undefined,
			{ ALL: { type: 'query-param', limit: 'limit' } },
			null
		);
		expect(result!.pagination?.limit).toBe(5);
	});

	it('GET_PAG_AND_FILTERS_FILT_ALL', async () => {
		const request = createMockRequest('POST', {}, { search_params: { status: "active" } });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.filters![0]).toEqual({
			key: 'search_params.status',
			value: 'active',
			comparison: 'eq'
		});
	});

	it('GET_PAG_AND_FILTERS_FILT_ALL_WITHOUT_ROOT', async () => {
		const request = createMockRequest('POST', {}, { status: "active" });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.filters![0]).toEqual({
			key: 'status',
			value: 'active',
			comparison: 'eq'
		});
	});

	it('GET_PAG_AND_FILTERS_FILT_TYPE_MAPPING', async () => {
		const request = createMockRequest(
			'GET',
			{ id: "1,2,3", active: true, type: 1, created: "2029-01-01", workedAt: "2029-01-01,2029-01-02", status: "PENDING,ACTIVE", d: "true,false", f: true }
		);
		const result = instance!.request.getPaginationAndFilters(
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
						{ key: 'f', valueType: (val: any) => !val, comparison: 'eq' }
					]
				}
			}
		);
		expect(result!.filters).toContainEqual({ key: 'id', value: [1, 2, 3], comparison: 'eq' });
		expect(result!.filters).toContainEqual({ key: 'active', value: true, comparison: 'eq' });
	});

	it('GET_PAG_AND_FILTERS_FILT_CUSTOM_FUNC', async () => {
		const request = createMockRequest('POST', {}, { custom: 'hello' });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.filters![0].value).toBe('HELLO');
	});

	it('GET_PAG_AND_FILTERS_FILT_REGEX_FLAGS', async () => {
		const request = createMockRequest('GET', { search: 'test' });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.filters![0]).toMatchObject({
			key: 'search',
			regexFlags: 'i'
		});
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_NONE', async () => {
		const request = createMockRequest('GET', { limit: '10' });
		const result = instance!.request.getPaginationAndFilters(
			request,
			"none",
			undefined,
			{ GET: { type: 'query-param', limit: 'limit' } },
			null
		);
		expect(result!.pagination).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE', async () => {
		const request = createMockRequest('GET', { p_limit: '50', plugin_limit: '10' });
		const result = instance!.request.getPaginationAndFilters(
			request,
			{ exclusive: { type: 'query-param', limit: 'p_limit' } },
			undefined,
			{ GET: { type: 'query-param', limit: 'plugin_limit' } },
			null
		);
		expect(result!.pagination?.limit).toBe(50);
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_QUERY', async () => {
		const request = createMockRequest('GET', { p_limit: '50', skip: "2", order: "id", sort: "1" });
		const result = instance!.request.getPaginationAndFilters(
			request,
			{ exclusive: { type: 'query-param', limit: 'p_limit', skip: "skip", order: "order", sort: "sort" } },
			undefined,
			null,
			null
		);
		expect(result!.pagination).toEqual({
			limit: 50,
			skip: 2,
			sort: "1",
			order: "id"
		});
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_QUERY_INCOMPLETE', async () => {
		const request = createMockRequest('GET', { p_limit: '50', skip: "2", order: "id", sort: "1" });
		const result = instance!.request.getPaginationAndFilters(
			request,
			{ exclusive: { type: 'query-param', limit: 'p_limit1', skip: "skip1", order: "order1", sort: "sort1" } },
			undefined,
			null,
			null
		);
		expect(result!.pagination).toEqual(null);
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY', async () => {
		const request = createMockRequest('POST', {}, { search_params: { limit: 10, skip: 5, sort: "status", order: 1 } });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toEqual({
			limit: 10,
			skip: 5,
			sort: "status",
			order: 1
		});
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_INCOMPLETE', async () => {
		const request = createMockRequest('POST', {}, { search_params: { limit: "", skip: "", sort: "", order: "" } });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toEqual(null);
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_NO_VALUE', async () => {
		let request = createMockRequest('POST', {}, { search_params: { limit: 10, skip: 5, sort: "status", order: 1 } });
		let result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toEqual(null);
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
		expect(result!.pagination).toEqual({
			limit: 10,
			skip: 5,
			sort: "status",
			order: 1
		});
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_WITHOUT_ROOT', async () => {
		const request = createMockRequest('POST', {}, { limit: "", skip: "", sort: "", order: "" });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toEqual(null);
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_WITHOUT_ROOT_NO_VALUE', async () => {
		const request = createMockRequest('POST', {}, { limit: 10, skip: 5, sort: "status", order: 1 });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.pagination).toEqual(null);
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_EXCLUSIVE_BODY_INCOMPLETE_WITHOUT_ROOT', async () => {
		const request = createMockRequest('GET', { p_skip: '100', plugin_limit: '10' });
		const result = instance!.request.getPaginationAndFilters(
			request,
			{ inclusive: { type: 'query-param', skip: 'p_skip' } },
			undefined,
			{ GET: { type: 'query-param', limit: 'plugin_limit' } },
			null
		);
		expect(result!.pagination).toEqual({
			limit: 10,
			skip: 100,
			sort: null,
			order: null
		});
	});

	it('GET_PAG_AND_FILTERS_HANDLER_PAG_INCLUSIVE', async () => {
		const request = createMockRequest('GET', { f1: 'val1', f2: 'val2' });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.filters).toHaveLength(2);
		expect((result!.filters as { key: string }[])?.map(f => f.key)).toContain('f1');
		expect((result!.filters as { key: string }[])?.map(f => f.key)).toContain('f2');
	});

	it('GET_PAG_AND_FILTERS_HANDLER_FILT_INCLUSIVE', async () => {
		const request = createMockRequest('POST', {}, { search_params: { status: "active" } });
		const result = instance!.request.getPaginationAndFilters(
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
		expect(result!.filters![0]).toEqual({
			key: 'search_params.status',
			value: 'active',
			comparison: 'eq'
		});
	});

	it('GET_PAG_AND_FILTERS_HANDLER_FILT_EXCLUSIVE', async () => {
		const request = createMockRequest('POST', {}, { id: "1,2,3", active: true, type: 1, created: "2029-01-01", workedAt: "2029-01-01,2029-01-02", status: "PENDING,ACTIVE", d: "true,false", f: true });
		const result = instance!.request.getPaginationAndFilters(
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
						{ key: 'f', valueType: (val: any) => !val, comparison: 'eq' }
					]
				}
			},
			null,
			null
		);
		expect(result!.filters![0]).toEqual({
			key: 'id',
			value: [1, 2, 3],
			comparison: 'eq'
		});
	});

	it('GET_PAG_AND_FILTERS_HANDLER_FILT_EXCLUSIVE_WITHOUT_ROOT', async () => {
		const request = createMockRequest('GET', { f1: 'v1' });
		const result = instance!.request.getPaginationAndFilters(
			request,
			undefined,
			"none",
			null,
			{ GET: { type: 'query-param', filters: [{ key: 'f1', valueType: 'string', comparison: 'eq' }] } }
		);
		expect(result!.filters).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_HANDLER_FILT_NONE', async () => {
		const request = createMockRequest('POST', {}, { data: {} });
		const result = instance!.request.getPaginationAndFilters(
			request,
			{ exclusive: { type: "body", root: 'data', limit: 'limit' } },
			undefined,
			null,
			null
		);
		expect(result!.pagination).toBeNull();
	});

	it('GET_PAG_AND_FILTERS_HANDLER_NULL', async () => {
		const request = createMockRequest('POST', {}, { data: {} });
		const result = instance!.request.getPaginationAndFilters(
			request,
			{ exclusive: { type: "body", root: 'data', limit: 'limit' } },
			undefined,
			null,
			null
		);
		expect(result!.pagination).toBeNull();
	});

	it('GET_CLEAN_BODY_ARRAY', async () => {
		const request = createMockRequest('POST', {}, { data: {} });
		const result = instance!.request.getCleanBody(
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
		expect(result![0].id).toBe(0);
	});

	it('GET_CLEAN_BODY_OBJECT', async () => {
		const result = instance!.request.getCleanBody(
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
		expect(result!.id).toBe(0);
	});

	it('PARSE_REQUEST_DISABLED', async () => {
		const request = createMockRequest('POST', {}, { data: {} });
		const result = await instance!.request.parseRequest(request, res, fullUrlMock, false, loggerMock);
		expect(result!).toBe(undefined);
	});

	it('PARSE_REQUEST_OBJECT_PARSER', async () => {
		const request = createMockRequest('POST', {}, { data: {} });
		let result;
		try {
			result = await instance!.request.parseRequest(
				request,
				res,
				fullUrlMock,
				{
					parser: [
						(req: any, res: any, next: any) => {
							throw Error("generic");
						}
					],
					transform: (req: any) => {
						return {};
					}
				},
				loggerMock
			);
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result!).toBe("Error parsing request");
	});

	it('PARSE_REQUEST_MULTIPART_URL_ENCODED', async () => {
		const multipart = createMultipartBody(new URLSearchParams({ "id": "1", "name": "Test 11" }));
		const reque = createMockRequest('POST', {}, {});
		const res = createMockRequestResponse(false);
		const request = new PassThrough() as any;
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
		const result = await instance!.request.parseRequest(request, res, fullUrlMock, true, loggerMock);
		expect(result!).toBe(undefined);
	});

	it('PARSE_REQUEST_MULTIPART_BINARY', async () => {
		const multipart = createMultipartBody({
			document: {
				filename: 'fake.jpg',
				contentType: 'image/jpeg',
				content: randomBytes(2048)
			}
		});
		const requ = createMockRequest('POST', {}, {});
		const request = new PassThrough() as any;
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
		await instance!.request.parseRequest(request, res, fullUrlMock, true, loggerMock);
		expect(request!.files!.length).toBe(1);
	});

	it('PARSE_REQUEST_JSON_INVALID_BODY_FALLS_BACK_TO_STRING', async () => {
		const requ = createMockRequest('POST', {}, {});
		const request = new PassThrough() as any;
		Object.assign(request, {
			...requ,
			headers: {
				'content-type': 'application/json',
				'content-length': '10'
			}
		});
		request.write(Buffer.from('not-valid-json'));
		request.end();
		const res = createMockRequestResponse(false);
		await instance!.request.parseRequest(request, res, fullUrlMock, true, loggerMock);
		expect(typeof request.body).toBe('string');
		expect(request.body).toBe('not-valid-json');
	});

	it('PARSE_REQUEST_MULTIPART_MALFORMED', async () => {
		const boundary = '----TestBoundaryMalformed';
		const rawBody = [
			`--${boundary}\r\n`,
			`Content-Disposition: form-data; name="malformed"\r\n`,
			`value\r\n`,
			`--${boundary}--\r\n`
		].join('');

		const bodyBuffer = Buffer.from(rawBody);
		const requ = createMockRequest('POST', {}, {});
		const request = new PassThrough() as any;

		Object.assign(request, {
			...requ,
			headers: {
				'content-type': `multipart/form-data; boundary=${boundary}`,
				'content-length': bodyBuffer.length.toString()
			}
		});

		request.write(bodyBuffer);
		request.end();

		const res = createMockRequestResponse(false);

		await instance!.request.parseRequest(request, res, fullUrlMock, true, loggerMock);

		expect(request.body).toBe(null);
	});

	it('PARSE_REQUEST_MULTIPART_MALFORMED_JSON', async () => {
		const boundary = '----TestBoundaryJsonError';
		const malformedJson = '{"key": "value"';

		const rawBody = [
			`--${boundary}\r\n`,
			`Content-Disposition: form-data; name="badJsonField"\r\n`,
			`Content-Type: application/json\r\n`,
			`\r\n`,
			`${malformedJson}\r\n`,
			`--${boundary}--\r\n`
		].join('');

		const bodyBuffer = Buffer.from(rawBody);
		const requ = createMockRequest('POST', {}, {});
		const request = new PassThrough() as any;

		Object.assign(request, {
			...requ,
			headers: {
				'content-type': `multipart/form-data; boundary=${boundary}`,
				'content-length': bodyBuffer.length.toString()
			}
		});

		request.write(bodyBuffer);
		request.end();

		const res = createMockRequestResponse(false);

		await instance!.request.parseRequest(request, res, fullUrlMock, true, loggerMock);

		expect(request.body).toBeDefined();
		expect((request.body as Record<string, any>)['badJsonField']).toBe(malformedJson);
		expect(typeof (request.body as Record<string, any>)['badJsonField']).toBe('string');
	});

	it('MERGE_BODY_CHUNK_ERROR', async () => {
		let result;
		const req = new PassThrough();
		const promise = instance!.request.mergeBodyChunk(req);
		process.nextTick(() => {
			req.emit('error', new Error('generic'));
		});
		try {
			result = await promise;
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result!).toBe("Error parsing request body");
	});

	it('MATCH_ENDPOINT_PREFIX', async () => {
		const result = instance!.request.matchesEndpointPrefix("", []);
		expect(result!).toBe(false);
	});

	it('ADD_SLASH', async () => {
		const result = instance!.request.addSlash("/aa", "trailing");
		expect(result!).toBe("/aa/");
	});

	it('IS_DIR_EXIST', async () => {
		let result;
		try {
			result = await instance!.files.isDirExists(path.join(process.cwd(), 'TODO.md'.repeat(5000)));
		} catch (error) {
			result = (error as Error).message
		}
		const IS_ENAMETOOLONG = result!.includes('ENAMETOOLONG');
		expect(IS_ENAMETOOLONG).toBe(true);
	});

	it('MK_DIR_ERROR', async () => {
		let result;
		try {
			result = await instance!.files.createDir(path.join(process.cwd(), 'README.md', "t"));
		} catch (error) {
			result = (error as Error).message
		}
		const res = result!.includes('ENOTDIR');
		expect(res).toBe(true);
	});

	it('DIR_FILE_LIST_ENOTDIR', async () => {
		let result;
		try {
			result = await instance!.files.directoryFileList(path.join(process.cwd(), 'README.md'));
		} catch (error) {
			result = (error as Error).message
		}
		expect(result!).toStrictEqual([]);
	});

	it('DIR_FILE_LIST_ERROR', async () => {
		let result;
		try {
			result = await instance!.files.directoryFileList(path.join(process.cwd(), 'TODO'));
		} catch (error) {
			result = (error as Error).message
		}
		const res = result!.includes('ENOENT');
		expect(res).toBe(true);
	});

	it('IS_FILE_EXIST', async () => {
		let result;
		try {
			result = await instance!.files.isFileExists(path.join(process.cwd(), 'TODO.md'.repeat(5000)));
		} catch (error) {
			result = (error as Error).message
		}
		const res = result!.includes('ENAMETOOLONG');
		expect(res).toBe(true);
	});

	it('READING_FILE_ERROR', async () => {
		let result;
		try {
			result = await instance!.files.readingFile(path.join(process.cwd(), 'TODO.md'.repeat(5000)));
		} catch (error) {
			result = (error as Error).message
		}
		const res = result!.includes('ENAMETOOLONG');
		expect(res).toBe(true);
	});

	it('WRITING_FILE_ERROR', async () => {
		let result;
		try {
			result = await instance!.files.writingFile(path.join(MOCK_DIR.PATH, 'example'), true, { id: 0 }, null, false);
		} catch (error) {
			result = (error as Error).message
		}
		const res = result!.includes('ENOENT');
		expect(res).toBe(true);
	});

	it('REMOVE_FILE_ERROR', async () => {
		let result;
		try {
			result = await instance!.files.removeFile(path.join(MOCK_DIR.PATH, 'example'));
		} catch (error) {
			result = (error as Error).message
		}
		const res = result!.includes('ENOENT');
		expect(res).toBe(true);
	});

	it('GET_BYTE_LENGTH_ERROR', async () => {
		let result;
		try {
			result = instance!.files.getByteLength({ id: 1n });
		} catch (error) {
			result = error;
		}
		expect(result!).toBeInstanceOf(Error);
	});

	it('APPLYING_PATCH_JSON_ERROR', async () => {
		let result;
		try {
			result = instance!.files.applyingPatch({ id: 1n }, {}, "json");
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result!).toBe("PATCH body request malformed");
	});

	it('APPLYING_PATCH_JSON_OP_ERROR', async () => {
		let result;
		try {
			result = instance!.files.applyingPatch({ id: 1n }, [{}], "json");
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result!).toBe("PATCH body request malformed");
	});

	it('APPLYING_PATCH_JSON_OP_REMOVE', async () => {
		const result = instance!.files.applyingPatch([{ id: 1n }, { name: "asd" }], [{ op: "remove", path: "/name" }], "json");
		expect(result![0].name).toBe("asd");
	});

	it('APPLYING_PATCH_JSON_OP_REMOVE_ERROR', async () => {
		let result;
		try {
			result = instance!.files.applyingPatch({ id: 1n }, [{ op: "remove", path: "/names" }], "json");
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result!).toBe("PATCH body request malformed");
	});

	it('APPLYING_PATCH_JSON_OP_REPLACE_ERROR', async () => {
		let result;
		try {
			result = instance!.files.applyingPatch({ id: 1n }, [{ op: "replace", path: "/names" }], "json");
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result!).toBe("PATCH body request malformed");
	});

	it('APPLYING_PATCH_JSON_OP_MOVE', async () => {
		let result;
		try {
			result = instance!.files.applyingPatch([{ id: 1n }, { name: "asd" }], [{ op: "move", path: "/name", from: "/id" }], "json");
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result![0]).toBe(undefined);
	});

	it('APPLYING_PATCH_JSON_OP_COPY', async () => {
		let result;
		try {
			result = instance!.files.applyingPatch([{ id: 1n }, { name: "asd" }], [{ op: "copy", path: "/name", from: "/id" }], "json");
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result![0]).toBe(undefined);
	});

	it('APPLYING_PATCH_JSON_OP_COPY_ERROR', async () => {
		let result;
		try {
			result = instance!.files.applyingPatch({ id: 1n }, [{ op: "replace", path: "names/ids" }], "json");
		} catch (error) {
			result = (error as Error).message;
		}
		expect(result!).toBe("PATCH body request malformed");
	});
});

describe('TEST CONFIGURE_SERVER', () => {
	let mockOptions: UniversalApiOptions;
	let wrapperMiddleware: any;

	async function execute(middleware: boolean) {
		const plug = await generateOptions(mockOptions);
		await plug.configResolved(CONF);
		const server = getServer();
		plug.configureServer(server);
		if (middleware) {
			if (!wrapperMiddleware) {
				wrapperMiddleware = (server).middlewares.use.mock.calls[0][0];
				if (!wrapperMiddleware) {
					throw new Error("Wrapper middleware not registered: server didn't call middlewares.use");
				}
			}
			return wrapperMiddleware;
		}
	}

	function generateRequestResponseNextResponseData() {
		const req = createMockRequestResponse(true);
		const res = createMockRequestResponse(false);
		const responseData: { value: string } = { value: "" };
		res.on('data', (chunk: any) => responseData.value += chunk.toString());
		return {
			req,
			res,
			next: vi.fn(),
			responseData
		}
	}

	beforeEach(() => {
		mkdirp.sync(MOCK_DIR.PATH);
		fs.writeFileSync(path.join(MOCK_DIR.PATH, 'users.json'), JSON.stringify([{ id: 0, name: "Test" }, { id: 1, name: "Test 1" }]));
		fs.writeFileSync(path.join(MOCK_DIR.PATH, 'product.txt'), "Product 1");
		mockOptions = {
			endpointPrefix: [ENDPOINT_PREFIX, "/test"],
			fsDir: MOCK_DIR.NAME,
			logLevel: 'info',
			disable: false,
		}
		logSpy.mockClear();
		vi.clearAllMocks();
		wrapperMiddleware = undefined;
	});

	afterEach(() => {
		resetShouldFailMocks(mocks);
		rimraf.sync(MOCK_DIR.PATH);
	});

	it('DISABLED', async () => {
		delete mockOptions.endpointPrefix;
		delete mockOptions.fsDir;
		mockOptions.logLevel = "debug";
		mockOptions.disable = true;
		await execute(false);
		expect(logSpy).toHaveBeenCalledTimes(5);

	});

	it('LOG_DEBUG', async () => {
		delete mockOptions.endpointPrefix;
		delete mockOptions.fsDir;
		mockOptions.logLevel = "debug";
		await execute(false);
		expect(logSpy).toHaveBeenCalledTimes(9);
	});

	it('NO_MATCH_PREFIX', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/apis/users";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Request doesn't match endpointPrefix");
		expect(next).not.toHaveBeenCalled();
	});

	it('NO_REQ_HANDLER', async () => {
		delete mockOptions.fsDir;
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/users/all";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Impossible handling request with url http://localhost/api/users/all");
		expect(next).not.toHaveBeenCalled();
	});

	it('NO_FILE_FOUND', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/address/all";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Not found");
		expect(next).not.toHaveBeenCalled();
	});

	it('NO_NESTED_FILE_FOUND', async () => {
		fs.mkdirSync(path.join(MOCK_DIR.PATH, "address"));
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/address/all";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Not found");
		expect(next).not.toHaveBeenCalled();
		rimraf.sync(MOCK_DIR.PATH);
	});

	it('ERR_READING_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mocks.readStream.shouldFail = true;
		req.url = "/api/users";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe(`Error reading file ${path.join(MOCK_DIR.PATH, "users.json")}`);
		expect(next).not.toHaveBeenCalled();
	});

	it('ERR_WRITING_RESPONSE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		res.write = (...args: unknown[]) => {
			responseData.value = (args[0] as string).toString();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error writing response");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERR_WRITING_RESPONSE_CATCH', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		res.write = (...args: unknown[]) => {
			responseData.value = (args[0] as string).toString();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error writing response");
		expect(next).toHaveBeenCalled();
	});

	it('NO_HANDLER_FORWARD', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mockOptions.noHandledRestFsRequestsAction = "forward";
		req.method = "TRACE";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(next).toHaveBeenCalled();
	});

	it('NO_HANDLER_404', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mockOptions.noHandledRestFsRequestsAction = "404";
		req.method = "TRACE";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Impossible handling request with url http://localhost/api/users");
		expect(next).not.toHaveBeenCalled();
	});

	it('UNRECOGNIZED_ERROR', async () => {
		mocks.utils.request.removeSlash.shouldFail = true;
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('WITHOUT_DIR', async () => {
		delete mockOptions.fsDir;
		mockOptions.handlers = [
			{
				handle: "FS",
				method: "GET",
				pattern: "/users"
			}
		];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Request matching Api Rest Fs handler but fsDir provide doesn't exists");
		expect(next).not.toHaveBeenCalled();
	});

	it('PRE_HANDLER_TRANSFORM_OBJ', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse[0].id).toBe(0);
		expect(jsonResponse[0].name).toBe("Test");
	});

	it('PRE_HANDLER_TRANSFORM_FUNC', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse[0].id).toBe(0);
		expect(jsonResponse[0].name).toBe("Test");
	});

	it('POST_HANDLER', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).not.toHaveBeenCalled();
		expect(res.statusCode).toBe(200);
		expect(responseData.value).toBe("Product 1");
	});

	it('POST_HANDLER_JSON', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/users";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).not.toHaveBeenCalled();
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse[0].id).toBe(0);
		expect(jsonResponse[0].name).toBe("Test");
	});

	it('POST_HANDLER_FILE_NOT_FOUND', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product1";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).not.toHaveBeenCalled();
		expect(res.statusCode).toBe(404);
		expect(responseData.value).toBe("");
	});

	it('POST_HANDLER_ERROR', async () => {
		mockOptions.handlers = [
			{
				handle: "FS",
				method: "GET",
				pattern: "/product",
				postHandle(req, res, data) {
				},
			}
		];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("FS REST Handled request did not send any response");
	});

	it('HANDLER_DISABLED', async () => {
		mockOptions.logLevel = "debug";
		mockOptions.handlers = [
			{
				handle: "FS",
				disabled: true,
				method: "GET",
				pattern: "/users"
			}
		];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(logSpy).toHaveBeenCalledWith("\x1b[1;93mvite-plugin-universal-api\x1b[0m handlingApiRestRequest: Request handler is disabled\n");
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse[0].id).toBe(0);
	});

	it('HANDLER_DIFFERENT_METHOD', async () => {
		mockOptions.logLevel = "debug";
		mockOptions.handlers = [
			{
				handle: "FS",
				method: "POST",
				pattern: "/users"
			}
		];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(logSpy).toHaveBeenCalledWith("\x1b[1;93mvite-plugin-universal-api\x1b[0m handlingApiRestRequest: Request url and handler have different http method\n");
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse[0].id).toBe(0);
	});

	it('HANDLER_DELAYED', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(logSpy).toHaveBeenCalledWith("\x1b[1;93mvite-plugin-universal-api\x1b[0m handlingApiRestRequest: request execution will be delayed by 10\n");
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Request matching Api Rest Fs handler but fsDir provide doesn't exists");
		expect(next).not.toHaveBeenCalled();
	});

	it('API_REST_CUSTOM_PARSER', async () => {
		mockOptions.handlers = [{
			pattern: "/user2",
			method: "PUT",
			handle: "FS",
			parser: {
				async parser(request, res, next) {
					const body = {};
					let files: any[] | null = null;
					const mergedChunk = await Utils.request.mergeBodyChunk(request);
					const contentType = request.headers["content-type"] || "";
					const boundary = contentType.split("boundary=")[1];
					const boundaryStr = `--${boundary}`;
					const bodyString = mergedChunk!.toString("binary");

					const rawParts: string[] = bodyString.split(boundaryStr).filter((part: string) => part.trim() !== '' && part !== '--');

					rawParts.forEach(part => {
						const divider = '\r\n\r\n';
						const dividerIndex = part.indexOf(divider);
						if (dividerIndex === -1) {
							return;
						}
						const headersPart = part.substring(0, dividerIndex);
						let bodyPartString = part.substring(dividerIndex + divider.length);
						bodyPartString = bodyPartString.replace(/\r\n$/, "");
						if (bodyPartString.endsWith("--")) {
							bodyPartString = bodyPartString.slice(0, -2);
						}
						const headerLines = headersPart.trim().split("\r\n");
						const partData: Record<string, string> = {};
						headerLines.forEach(line => {
							const [key, value] = line.split(": ");
							if (key) {
								partData[key.toLowerCase()] = value;
							}
						});

						const disposition = partData["content-disposition"] || "";
						const isFile = disposition.includes("filename=");

						const partBuffer = Buffer.from(bodyPartString, "binary");
						const name = disposition.match(/name="([^"]+)"/)?.[1];
						const filename = disposition.match(/filename="([^"]+)"/)?.[1];
						if (isFile) {
							!files && (files = []);
							files.push({
								name: filename!,
								content: partBuffer,
								contentType: partData["content-type"] || "application/octet-stream"
							});
						} else {
							(body as unknown as Record<string, any>)[name ?? ''] = partBuffer.toString("utf-8").trim();
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
		const multipart = createMultipartBody({
			user: "User 1"
		});
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/user2";
		req.method = "PUT";
		req.headers = {
			"content-type": multipart.contentType,
			"content-length": multipart.contentLength
		}
		req.write(multipart.body);
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(201);
		const file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.txt"), { encoding: "utf-8" });
		expect(file).toBeDefined();
		expect(file).toBe("User 1");
	});

	it('API_REST_ERROR', async () => {
		mocks.utils.request.parseRequest.shouldFail = true;
		mockOptions.handlers = [
			{
				handle: "FS",
				method: "GET",
				pattern: "/users"
			}
		];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(500);
		expect(responseData.value).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER_THROW_ERROR', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('API_REST_MIDDLEWARE_CHAIN_ERROR_HANDLER_NO_RESPONSE', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('API_REST_MIDDLEWARE_CHAIN_ERROR', async () => {
		mocks.utils.request.MiddlewaresChainUse.shouldFail = true;
		mockOptions.handlers = [
			{
				handle: "FS",
				method: "GET",
				pattern: "/users"
			}
		];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('API_REST_GENERIC_ERROR', async () => {
		mocks.utils.request.MiddlewaresChain.shouldFail = true;
		mockOptions.handlers = [
			{
				handle: "FS",
				method: "GET",
				pattern: "/users"
			}
		];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('HANDLER_EXECUTION', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse[0].id).toBe(0);
		expect(jsonResponse[0].name).toBe("Test");
	});

	it('GATEWAY_TIMEOUT', async () => {
		mockOptions.delay = 200;
		mockOptions.gatewayTimeout = 100;
		mockOptions.handlers = [{
			handle: "FS",
			method: "DELETE",
			pattern: "/users"
		}];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "DELETE";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(504);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Gateway Timeout");
		expect(next).not.toHaveBeenCalled();
		return new Promise<void>(res => {
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
		});
	});

	it('API_REST_UNRECOGNIZED_ERROR', async () => {
		mocks.utils.request.MiddlewaresChainHandle.shouldFail = true;
		mockOptions.handlers = [
			{
				handle: "FS",
				method: "GET",
				pattern: "/users"
			}
		];
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('NEXT_INVOCATION', async () => {
		mocks.utils.response.settingResponse.shouldFail = true;
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "HEAD";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(next).toHaveBeenCalled();
	});

	it('INTERNAL_GENERIC_ERROR', async () => {
		mocks.utils.request.createRequest.shouldFail = true;
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERROR_MIDDLEWARE', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/apis/users";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(404);
		expect(responseData.value).toBe("Request doesn't match endpointPrefix");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERROR_MIDDLEWARE_NO_WRITE', async () => {
		mockOptions.errorMiddlewares = [
			(err, req, res, next) => {
				res.statusCode = 500;
			}
		]
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/apis/users";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Request doesn't match endpointPrefix");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERROR_MIDDLEWARE_THROW_ERROR', async () => {
		mockOptions.errorMiddlewares = [
			(err, req, res, next) => {
				throw Error('generic');
			},
			(err, req, res, next) => {
				throw err;
			}
		]
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/apis/users";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERROR_MIDDLEWARE_THROW_NEXT_ERROR', async () => {
		mockOptions.errorMiddlewares = [
			(err, req, res, next) => {
				throw Error('generic');
			},
			(err, req, res, next) => {
				next(err);
			}
		]
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/apis/users";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("generic");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERROR_SETTING_JSON_RESPONSE', async () => {
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
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/users?limit=1&skip=0&order=-1&sort=id";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error parsing body response");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERROR_READING_FILE_HEAD', async () => {
		mocks.parse.shouldFail = true;
		mocks.parse.shouldFailAt = 1;
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "HEAD";
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Failed to send stream data");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERROR_READING_FILE_STREAM_ERROR', async () => {
		mocks.readStream.shouldFail = true;
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Failed to send stream data");
		expect(next).not.toHaveBeenCalled();
	});

	it('ERROR_READING_FILE_RESP_ERROR', async () => {
		mocks.readStreamPipe.shouldFail = true;
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Failed to send stream data");
		expect(next).not.toHaveBeenCalled();
	});

	it('HEAD OK', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "HEAD";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		expect(responseData.value).toBe("");
		expect(res.setHeader).toHaveBeenCalledWith(Constants.TOTAL_ELEMENTS_HEADER, 2);
		expect(next).not.toHaveBeenCalled();
	});

	it('HEAD MALFORMED JSON', async () => {
		fs.writeFileSync(path.join(MOCK_DIR.PATH, 'orders.json'), JSON.stringify([{ id: 0, name: "Test" }, { id: 1, name: "Test 1" }]) + ",{[]}}");
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/orders";
		req.method = "HEAD";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		expect(responseData.value).toBe("");
		expect(res.setHeader).toHaveBeenCalledWith(Constants.TOTAL_ELEMENTS_HEADER, 1);
		expect(next).not.toHaveBeenCalled();
	});

	it('GET OK', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse[0].id).toBe(0);
		expect(jsonResponse[0].name).toBe("Test");
		expect(next).not.toHaveBeenCalled();
	});

	it('GET WITH_BODY_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("GET request cannot have a body in File System API mode");
	});

	it('GET WITH_FILE_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("GET request cannot have a body in REST File System API mode");
	});

	it('GET NO_JSON_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/plain');
		expect(res.statusCode).toBe(200);
		expect(responseData.value).toBe(`Product 1`);
		expect(next).not.toHaveBeenCalled();
	});

	it('GET EXE_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		fs.writeFileSync(path.join(MOCK_DIR.PATH, 'app.exe'), "");
		req.url = "/api/app";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/octet-stream');
		expect(res.statusCode).toBe(200);
		expect(responseData.value).toBe(``);
		expect(next).not.toHaveBeenCalled();
	});

	it('GET NO_JSON_FILE_WITH_EXT', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product.txt";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/plain');
		expect(res.statusCode).toBe(200);
		expect(responseData.value).toBe(`Product 1`);
		expect(next).not.toHaveBeenCalled();
	});

	it('GET DIR_INDEX', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		fs.mkdirSync(path.join(MOCK_DIR.PATH, "users"));
		fs.writeFileSync(path.join(MOCK_DIR.PATH, "users", 'index.json'), JSON.stringify([]));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse).toStrictEqual([]);
		expect(next).not.toHaveBeenCalled();
	});

	it('GET DIR_NO_INDEX', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		fs.mkdirSync(path.join(MOCK_DIR.PATH, "users"));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Not found");
		expect(next).not.toHaveBeenCalled();
	});

	it('GET WITH_FILTERS', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.length).toBe(1);
		expect(jsonResponse[0].id).toBe(1);
		expect(jsonResponse[0].name).toBe("Test 1");
		expect(next).not.toHaveBeenCalled();
	});

	it('GET WITH_FILTERS_FILE_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe(`Error parsing json content file ${path.join(MOCK_DIR.PATH, "users.json")}`);
		expect(next).not.toHaveBeenCalled();
	});

	it('GET WITH_PAGINATION', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.length).toBe(1);
		expect(jsonResponse[0].id).toBe(1);
		expect(jsonResponse[0].name).toBe("Test 1");
		expect(next).not.toHaveBeenCalled();
	});

	it('GET WITH_PAGINATION_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error parsing pagination request");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST MULTIPLE_FILES', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("POST request with multiple file is not allowed in File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST MULTIPLE_FILES_REST', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mockOptions.handlers = [{
			pattern: "/users",
			method: "POST",
			handle: "FS"
		}];
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("POST request with multiple file is not allowed in REST File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST BOTH_FILE_AND_BODY', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("POST request with file and body is not allowed in File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST BOTH_FILE_AND_BODY_REST', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mockOptions.handlers = [{
			pattern: "/users",
			method: "POST",
			handle: "FS"
		}];
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("POST request with file and body is not allowed in REST File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST FILE_FOUND_NOT_JSON', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.method = "POST";
		req.headers = {
			"content-type": "application/x-www-form-urlencoded"
		}
		req.write(new URLSearchParams({ "id": "1", "name": "Test 11" }).toString());
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("POST request for not json file is not allowed in File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST FILE_FOUND_NOT_JSON_REST', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("POST request for not json file is not allowed in REST File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST WITH_PAGINATION_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(201);
		let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.json"), { encoding: "utf-8" });
		file = JSON.parse(file);
		expect(file).toBeDefined();
		expect(file.id).toBe(1);
		expect(file.name).toBe("Test 1");
	});

	it('POST WITH_FILTERS_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(201);
		const file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.txt"), { encoding: "utf-8" });
		expect(file).toBe("Product");
	});

	it('POST WITH_FILTERS_FILE_ARRAY', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error parsing pagination request");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST WITH_FILTERS_FILE_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		expect(responseData.value).toBe("");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST WITHOUT_PAGINATION_AND_NOT_JSON_BODY', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(200);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.length).toBe(1);
		expect(jsonResponse[0].id).toBe(1);
		expect(next).not.toHaveBeenCalled();
	});

	it('POST WITH_BODY_EXTRA', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe(`Error retrieving filtered and paginated data from ${path.join(MOCK_DIR.PATH, "users.json")}`);
		expect(next).not.toHaveBeenCalled();
	});

	it('POST WITH_FILE_JSON', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mockOptions.handlers = [{
			pattern: "/users",
			method: "POST",
			handle: "FS"
		}];
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(409);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("File at /api/users already exists");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST WITH_FILE_NOT_JSON', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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

		const multipart = createMultipartBody({
			user: {
				id: 1,
				name: "Test 1",
				eta: 23
			},
			paginazione: {
				limit: 1,
				field: "id",
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(409);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("File at /api/users already exists");
		expect(next).not.toHaveBeenCalled();
	});

	it('POST FILE_NOT_FOUND_AND_NO_DATA', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product1";
		req.method = "POST";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("No data provided");
	});

	it('POST FILTE_NOT_FOUND_AND_FILTERS', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("No data to filter or to paginate");
	});

	it('POST TOTAL_COUNT_ERROR_HEADER', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		fs.writeFileSync(
			path.join(MOCK_DIR.PATH, 'bad.json'),
			'[{"id":0,"name":"Test"}'
		);
		req.url = "/api/bad";
		req.method = "POST";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.setHeader).toHaveBeenCalledWith(Constants.TOTAL_ELEMENTS_HEADER, 1);
		expect(res.statusCode).toBe(200);
		expect(responseData.value).toBe('[{"id":0,"name":"Test"}');
	});

	it('POST ERROR_WRITING_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mocks.utils.files.writingFile.shouldFail = true;
		req.url = "/api/users11";
		req.method = "POST";
		req.headers = {
			"content-type": "application/json"
		}
		req.write(JSON.stringify({ id: 1, name: "Test 11" }));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error writing data");
	});

	it('POST ERROR_CREATING_DATA', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error creating data");
		expect(next).not.toHaveBeenCalled();
	});

	it('PUT CREATE_NO_JSON_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/user2";
		req.method = "PUT";
		req.headers = {
			"content-type": "text/plain"
		}
		req.write("User 1");
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(201);
		const file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.txt"), { encoding: "utf-8" });
		expect(file).toBeDefined();
		expect(file).toBe("User 1");
	});

	it('PUT CREATE_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(201);
		let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.json"), { encoding: "utf-8" });
		file = JSON.parse(file);
		expect(file.user).toBeDefined();
		expect(file.user.id).toBe(1);
		expect(file.user.name).toBe("Test 1");
	});

	it('PUT CREATE_FILE_WITH_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(201);
		let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user2.json"), { encoding: "utf-8" });
		file = JSON.parse(file);
		expect(file.id).toBe(1);
		expect(file.name).toBe("Test 1");
	});

	it('PUT UPDATE_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(200);
		let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "product.txt"), { encoding: "utf-8" });
		file = JSON.parse(file);
		expect(file.id).toBe(2);
		expect(file.name).toBe("Test 2");
	});

	it('PUT MULTIPLE_FILES', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("PUT request with multiple file is not allowed in File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('PUT MULTIPLE_FILES_REST', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mockOptions.handlers = [{
			pattern: "/users",
			method: "PUT",
			handle: "FS"
		}];
		const multipart = createMultipartBody({
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("PUT request with multiple file is not allowed in REST File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('PUT NOT_FILE_PROVIDED', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/users2";
		req.method = "PUT";
		req.headers = {
			"content-type": "application/json"
		}
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("No data provided");
	});

	it('PUT ERROR_UPDATING_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mocks.utils.files.writingFile.shouldFail = true;
		req.method = "PUT";
		req.headers = {
			"content-type": "application/json"
		}
		req.write(JSON.stringify({ id: 1, name: "Test 11" }));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error updating data");
	});

	it('PUT ERROR_CREATING_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mocks.utils.files.writingFile.shouldFail = true;
		req.method = "PUT";
		req.headers = {
			"content-type": "application/json"
		}
		req.url = "/api/user1";
		req.write(JSON.stringify({ id: 1, name: "Test 11" }));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error creating data");
	});

	it('PATCH UNSUPPORTED_MEDIA_TYPE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "PATCH";
		req.headers = {
			"content-type": "multipart/form-data"
		}
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(415);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe(`PATCH request content-type unsupported in File System API mode`);
	});

	it('PATCH UNSUPPORTED_MEDIA_TYPE_REST', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mockOptions.handlers = [{
			pattern: "/users",
			method: "PATCH",
			handle: "FS"
		}];
		req.method = "PATCH";
		req.headers = {}
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(415);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe(`PATCH request content-type unsupported in REST File System API mode`);
	});

	it('PATCH FILE_NOT_FOUND', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/users3";
		req.method = "PATCH";
		req.headers = {
			"content-type": "application/json"
		}
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Resource to update not found");
	});

	it('PATCH NO_JSON_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.url = "/api/product";
		req.method = "PATCH";
		req.headers = {
			"content-type": "application/json"
		}
		req.write(JSON.stringify([2]));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Only json file can be processing with PATCH http method");
	});

	it('PATCH MERGE_PATCHING_ARRAY', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "PATCH";
		req.headers = {
			"content-type": "application/merge-patch+json"
		}
		req.write(JSON.stringify([
			{ id: 11, name: "Test 11" }
		]));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(200);
		let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "users.json"), { encoding: "utf-8" });
		file = JSON.parse(file);
		expect(file.length).toBe(1);
		expect(file[0].id).toBe(11);
		expect(file[0].name).toBe("Test 11");
	});

	it('PATCH MERGE_PATCHING_OBJECT', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(200);
		let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user.json"), { encoding: "utf-8" });
		file = JSON.parse(file);
		expect(file.id).toBe(1);
		expect(file.name).not.toBeDefined();
		expect(file.eta).toBe(2);
		expect(file.tags).toEqual(expect.any(Array));
		expect(file.tags.length).toBe(1);
		expect(file.tags[0]).toBe("ee");
	});

	it('PATCH JSON_PATCHING', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.statusCode).toBe(200);
		let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "user.json"), { encoding: "utf-8" });
		file = JSON.parse(file);
		expect(file.name).toBe("John Harry");
		expect(file.contacts.email).toBe("john.harry@example.it");
		expect(file.oldCode).toBeUndefined();
		expect(file.address.principal.street).toBe("1");
		expect(file.tags).toContain("premium");
		expect(file.editor).toBe("John Harry");
	});

	it('PATH ERROR_PATCHING_OPERATION_NOT_SUPPORTED', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("PATCH operation not supported: test");
	});

	it('PATH ERROR_PATCHING_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		mocks.utils.files.writingFile.shouldFail = true;
		req.method = "PATCH";
		req.headers = {
			"content-type": "application/json"
		}
		req.write(JSON.stringify([
			{ id: 11, name: "Test 11" }
		]));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error partial updating resource");
	});

	it('OPTIONS METHOD_NOT_ALLOWED', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "OPTIONS";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(405);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Method OPTIONS not allowed in File System API mode");
		expect(next).not.toHaveBeenCalled();
	});

	it('DELETE FILE_NOT_FOUND', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "DELETE";
		req.url = "/api/user3";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Resource to delete not found");
	});

	it('DELETE BODY_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "DELETE";
		req.headers = {
			"content-type": "application/json"
		}
		req.write(JSON.stringify({ id: 1, name: "Test 11" }));
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("DELETE request cannot have a body in File System API mode");
	});

	it('DELETE BODY_ERROR_REST', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("DELETE request cannot have a body in REST File System API mode");
	});

	it('DELETE FILTERS_FILE_NOT_FOUND', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(404);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe(`Partial resource to delete not found`);
		expect(next).not.toHaveBeenCalled();
	});

	it('DELETE WITH_FILTERS_FILE_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe(`Error parsing json content file ${path.join(MOCK_DIR.PATH, "users.json")}`);
		expect(next).not.toHaveBeenCalled();
	});

	it('DELETE WITH_PAGINATION_ERROR', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(400);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error parsing pagination request");
	});

	it('DELETE FULL_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
		req.method = "DELETE";
		req.url = "/api/users";
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
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
	});

	it('DELETE PARTIAL_FILE_OBJECT', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
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
	});

	it('DELETE PARTIAL_FULL_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
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
	});

	it('DELETE PARTIAL_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith(Constants.DELETED_ELEMENTS_HEADER, 1);
		expect(res.statusCode).toBe(204);
		let file: any = fs.readFileSync(path.join(MOCK_DIR.PATH, "users.json"), { encoding: "utf-8" });
		file = JSON.parse(file);
		expect(file.length).toBe(1);
		expect(file[0].id).toBe(0);
		expect(file[0].name).toBe("Test");
	});

	it('DELETE ERROR_WRITING_FILE', async () => {
		const { req, res, next, responseData } = generateRequestResponseNextResponseData();
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
		req.end();
		const middleware = await execute(true);
		await middleware(req, res, next);
		expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
		expect(res.statusCode).toBe(500);
		const jsonResponse = JSON.parse(responseData.value);
		expect(jsonResponse.message).toBe("Error deleting resource");
	});
});

describe('TEST WEBSOCKET', async () => {
	const { ConnectionManager, WebSocketConnection } = await import('./utils/WebSocket');

	const makeLogger = () => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		success: vi.fn()
	});

	const makeMockWs = async () => {
		const { EventEmitter } = await import('node:events');
		const ws = new EventEmitter() as any;
		ws.readyState = 1;
		ws.send = vi.fn((data: any, cb: any) => cb && cb());
		ws.ping = vi.fn();
		ws.pong = vi.fn();
		ws.close = vi.fn((code: number, reason: string) => {
			process.nextTick(() => ws.emit('close', code, reason));
		});
		ws.terminate = vi.fn();
		ws.protocol = '';
		return ws;
	};

	const makeMockHttpServer = async () => {
		const { EventEmitter } = await import('node:events');
		const srv = new EventEmitter() as any;
		srv.off = vi.fn((event: string, handler: any) => srv.removeListener(event, handler));
		return srv;
	};

	describe('CONNECTION_MANAGER', () => {
		it('ADD_GET_REMOVE_GETALL', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			expect(manager.get(conn.id)).toBe(conn);
			expect(manager.getAll()).toHaveLength(1);

			manager.remove(conn.id);
			expect(manager.get(conn.id)).toBeUndefined();
			expect(manager.getAll()).toHaveLength(0);
		});

		it('GETBYROOM', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws1 = await makeMockWs();
			const ws2 = await makeMockWs();
			const conn1 = new WebSocketConnection(logger as any, ws1, '/test', manager);
			const conn2 = new WebSocketConnection(logger as any, ws2, '/test', manager);

			conn1.joinRoom('room-a');
			conn2.joinRoom('room-b');

			expect(manager.getByRoom('room-a')).toEqual([conn1]);
			expect(manager.getByRoom('room-b')).toEqual([conn2]);
			expect(manager.getByRoom('room-x')).toHaveLength(0);
		});

		it('BROADCAST_EXCLUDES_SENDER_AND_CLOSE_CONNECTIONS', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws1 = await makeMockWs();
			const ws2 = await makeMockWs();
			const ws3 = await makeMockWs();
			const conn1 = new WebSocketConnection(logger as any, ws1, '/test', manager);
			const conn2 = new WebSocketConnection(logger as any, ws2, '/test', manager);
			const conn3 = new WebSocketConnection(logger as any, ws3, '/test', manager);

			conn3.forceClose();

			manager.broadcast({ msg: 'hello' }, { excludeId: conn1.id });

			await vi.waitFor(() => expect(ws2.send).toHaveBeenCalledTimes(1));
			expect(ws1.send).not.toHaveBeenCalled();
			expect(ws3.send).not.toHaveBeenCalled();
		});

		it('BROADCAST_FILTERS_BY_ROOM', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws1 = await makeMockWs();
			const ws2 = await makeMockWs();
			const conn1 = new WebSocketConnection(logger as any, ws1, '/test', manager);
			const conn2 = new WebSocketConnection(logger as any, ws2, '/test', manager);

			conn1.joinRoom('lobby');
			manager.broadcast({ msg: 'hi' }, { room: 'lobby' });

			await vi.waitFor(() => expect(ws1.send).toHaveBeenCalledTimes(1));
			expect(ws2.send).not.toHaveBeenCalled();
		});
	});



	describe('WEBSOCKET_CONNECTION', () => {
		it('SEND_SERIALIZES_OBJECT_IN_JSON', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			await conn.send({ type: 'ping' });
			expect(ws.send).toHaveBeenCalledWith(
				JSON.stringify({ type: 'ping' }),
				expect.any(Function)
			);
		});

		it('SEND_NO-OP_IF_CONNECTION_IS_CLOSED', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);
			conn.forceClose();
			await conn.send({ type: 'test' });
			expect(ws.send).not.toHaveBeenCalled();
		});

		it('CLOSE_SENDS_CLOSING_AND_RESOLVE_PROMISE', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			await conn.close(1000, 'Normal');
			expect(ws.close).toHaveBeenCalledWith(1000, 'Normal');
			expect(conn.closed).toBe(true);
			expect(manager.get(conn.id)).toBeUndefined();
		});

		it('CLOSE_IS_IDEMPOTENT_SECOND_CALL_IS_NO-OP', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			await conn.close(1000, 'First');
			await conn.close(1000, 'Second');
			expect(ws.close).toHaveBeenCalledTimes(1);
		});

		it('FORCECLOSE_CLOSE_SOCKET_WITHOUT_HANDSHAKE', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			conn.forceClose();
			expect(ws.terminate).toHaveBeenCalled();
			expect(conn.closed).toBe(true);
		});

		it('MARKCLOSED_STOP_HEARTBEAT_AND_INACTIVITY_TIMER', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			conn.startHeartbeat(10000);
			conn.startInactivityTimeout(10000);
			conn.markClosed();
			expect(conn.closed).toBe(true);
		});

		it('JOINROOM_LEAVEROOM_ISINROOM_GETROOMS', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			conn.joinRoom('a');
			conn.joinRoom('b');
			expect(conn.isInRoom('a')).toBe(true);
			expect(conn.isInRoom('b')).toBe(true);
			expect(conn.getRooms()).toEqual(expect.arrayContaining(['a', 'b']));

			conn.leaveRoom('a');
			expect(conn.isInRoom('a')).toBe(false);
			expect(conn.isInRoom('b')).toBe(true);
		});

		it('BROADCASTALLROOMS_WITHOUT_ROOMS_DOES_GLOBAL_BROADCAST', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws1 = await makeMockWs();
			const ws2 = await makeMockWs();
			const conn1 = new WebSocketConnection(logger as any, ws1, '/test', manager);
			const conn2 = new WebSocketConnection(logger as any, ws2, '/test', manager);

			conn1.broadcastAllRooms({ msg: 'global' }, false);

			await vi.waitFor(() => expect(ws2.send).toHaveBeenCalledTimes(1));
			expect(ws1.send).not.toHaveBeenCalled();
		});

		it('BROADCASTALLROOMS_WITH_ROOMS_DOES_BROADCAST_FOR_EVERY_ROOM', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws1 = await makeMockWs();
			const ws2 = await makeMockWs();
			const ws3 = await makeMockWs();
			const conn1 = new WebSocketConnection(logger as any, ws1, '/test', manager);
			const conn2 = new WebSocketConnection(logger as any, ws2, '/test', manager);
			const conn3 = new WebSocketConnection(logger as any, ws3, '/test', manager);

			conn1.joinRoom('room-x');
			conn2.joinRoom('room-x');
			conn3.joinRoom('room-y');
			conn1.joinRoom('room-y');

			conn1.broadcastAllRooms({ msg: 'rooms' }, false);

			await vi.waitFor(() => {
				expect(ws2.send).toHaveBeenCalled();
				expect(ws3.send).toHaveBeenCalled();
			});
			expect(ws1.send).not.toHaveBeenCalled();
		});

		it('BROADCASTALLROOMS_WITHOUT_ROOMS_DOES_BROADCAST_FOR_EVERY_ROOM', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws1 = await makeMockWs();
			const ws2 = await makeMockWs();
			const ws3 = await makeMockWs();
			const conn1 = new WebSocketConnection(logger as any, ws1, '/test', manager);
			const conn2 = new WebSocketConnection(logger as any, ws2, '/test', manager);
			const conn3 = new WebSocketConnection(logger as any, ws3, '/test', manager);

			conn1.broadcastAllRooms({ msg: 'rooms' }, true);

			await vi.waitFor(() => {
				expect(ws2.send).toHaveBeenCalled();
				expect(ws3.send).toHaveBeenCalled();
				expect(ws1.send).toHaveBeenCalled();
			});
		});

		it('BROADCAST', async () => {
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws1 = await makeMockWs();
			const ws2 = await makeMockWs();
			const conn1 = new WebSocketConnection(logger as any, ws1, '/test', manager);
			const conn2 = new WebSocketConnection(logger as any, ws2, '/test', manager);

			conn1.joinRoom('room-x');
			conn2.joinRoom('room-x');
			conn1.broadcast({ msg: 'rooms' }, { includeSelf: false });

			await vi.waitFor(() => {
				expect(ws2.send).toHaveBeenCalled();
			});
			expect(ws1.send).not.toHaveBeenCalled();
		});

		it('HEARTBEAT_CLOSE_CONNECTION_AFTER_MAX_MISSED_PONGS', async () => {
			vi.useFakeTimers();
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			conn.startHeartbeat(100);
			vi.advanceTimersByTime(300);
			expect(ws.close).toHaveBeenCalledWith(1000, 'No pong received');
			vi.useRealTimers();
		});

		it('RESETMISSEDPONG_RESET_COUNTER_OF_MISSING_PONG', async () => {
			vi.useFakeTimers();
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			conn.startHeartbeat(100);
			vi.advanceTimersByTime(100);
			conn.resetMissedPong();
			vi.advanceTimersByTime(100);
			expect(ws.close).not.toHaveBeenCalled();
			vi.useRealTimers();
		});

		it('INACTIVITY_TIMEOUT_CLOSE_CONNECTION_AFTER_INACTIVITY', async () => {
			vi.useFakeTimers();
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			conn.startInactivityTimeout(500);
			vi.advanceTimersByTime(500);
			expect(ws.close).toHaveBeenCalledWith(1000, 'Inactivity timeout');
			vi.useRealTimers();
		});

		it('RESET_INACTIVITY_TIMER_REMAND_CLOSURE_FOR_INACTIVITY', async () => {
			vi.useFakeTimers();
			const logger = makeLogger();
			const manager = new ConnectionManager(logger as any);
			const ws = await makeMockWs();
			const conn = new WebSocketConnection(logger as any, ws, '/test', manager);

			conn.startInactivityTimeout(500);
			vi.advanceTimersByTime(400);
			conn.resetInactivityTimer(500);
			vi.advanceTimersByTime(400);
			expect(ws.close).not.toHaveBeenCalled();
			vi.advanceTimersByTime(100);
			expect(ws.close).toHaveBeenCalledWith(1000, 'Inactivity timeout');
			vi.useRealTimers();
		});

		it('PONG_METHOD_NOT_SEND_FRAME_IF_THE_CONNECTION_IS_CLOSE', async () => {
			const { WebSocketConnection, ConnectionManager } = await import('./utils/WebSocket');
			const logger = makeLogger();
			const manager = new ConnectionManager(logger);
			const mockWs = await makeMockWs();
			const connection = new WebSocketConnection(logger, mockWs, '/ws', manager);

			connection.pong('active');
			expect(mockWs.pong).toHaveBeenCalledWith('active');
			mockWs.pong.mockClear();

			connection.markClosed();
			connection.pong('ignored');
			expect(mockWs.pong).not.toHaveBeenCalled();
		});

		it('PING_METHOD:_DOESN\'T_SEND_FRAME_IF_THE_CONNECTION_IS_CLOSED', async () => {
			const { WebSocketConnection, ConnectionManager } = await import('./utils/WebSocket');
			const logger = makeLogger();
			const manager = new ConnectionManager(logger);
			const mockWs = await makeMockWs();
			const connection = new WebSocketConnection(logger, mockWs, '/ws', manager);

			connection.ping('hello');
			expect(mockWs.ping).toHaveBeenCalledWith('hello');
			mockWs.ping.mockClear();

			connection.markClosed();

			connection.ping('ignored');
			expect(mockWs.ping).not.toHaveBeenCalled();
		});

		it('FORCECLOSE_METHOD:_NO-OP_IF_THE_CONNECTION_IS_CLOSED', async () => {
			const { WebSocketConnection, ConnectionManager } = await import('./utils/WebSocket');
			const mockWs = await makeMockWs();
			const manager = new ConnectionManager(makeLogger());
			const connection = new WebSocketConnection(makeLogger(), mockWs, '/ws', manager);

			connection.markClosed();

			const removeSpy = vi.spyOn(manager, 'remove');
			const terminateSpy = vi.spyOn(mockWs, 'terminate');

			connection.forceClose();

			expect(removeSpy).not.toHaveBeenCalled();
			expect(terminateSpy).not.toHaveBeenCalled();
		});
	});

	describe('RUN_WS_PLUGIN', () => {
		let mockOptions: UniversalApiOptions;
		let httpServer: any;
		let upgradeHandler: ((req: any, socket: any, head: any) => Promise<void>);

		async function simulateUpgrade(url: string, wsOptions: { protocol?: string } = {}, attend=false) {
			const { EventEmitter } = await import('node:events');
			const socket = new EventEmitter() as any;
			socket.end = vi.fn();

			const ws = await makeMockWs();
			ws.protocol = wsOptions.protocol ?? '';

			const { WebSocketServer } = await import('./utils/WebSocket');
			let resolve:() => void;
			const upgradeFinished = new Promise<void>((res) => { resolve = res });
			vi.spyOn(WebSocketServer.prototype, 'handleUpgrade').mockImplementation(async (_req: any, _socket: any, _head: any, cb: any) => {
				await cb(ws);
				resolve();
			});

			const req = new PassThrough() as any;
			Object.assign(req, { url, method: 'GET', headers: {} });

			await upgradeHandler(req, socket, Buffer.alloc(0));
			attend && await upgradeFinished;
			return { ws, socket };
		}

		beforeEach(async () => {
			httpServer = await makeMockHttpServer();
			mockOptions = {
				endpointPrefix: ['/api'],
				logLevel: 'info',
				enableWs: true,
				disable: false,
				wsHandlers: []
			};
			vi.clearAllMocks();
			logSpy.mockClear();
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		async function setupWsPlugin(opts: UniversalApiOptions, wsHandlers: UniversalApiOptions["wsHandlers"]) {
			const plug = await generateOptions({ ...opts, wsHandlers } as unknown as UniversalApiOptions);
			await plug.configResolved(CONF);
			plug.configureServer({ ...getServer(), httpServer } as any);
			upgradeHandler = httpServer.rawListeners('upgrade')[0];
		}

		it('NOT_REGISTERED_ANYTHING_IF_ENABLE_WS_IS_FALSE', async () => {
			await setupWsPlugin({ ...mockOptions, enableWs: false, wsHandlers: undefined }, [
				{ pattern: '/ws/chat', onMessage: vi.fn() }
			]);
			expect(httpServer.listenerCount('upgrade')).toBe(0);
		});

		it('NOT_REGISTERED_ANYTHING_IF_WS_HANDLERS_IS_EMPTY', async () => {
			await setupWsPlugin({ ...mockOptions }, []);
			expect(httpServer.listenerCount('upgrade')).toBe(0);
		});

		it('RETURN_404_IF_NO_HANDLER_MATCH_PATTERN', async () => {
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onMessage: vi.fn() }
			]);
			const { socket } = await simulateUpgrade('/api/ws/other');
			expect(socket.end).toHaveBeenCalledWith('HTTP/1.1 404 Not Found\r\n\r\n');
		});

		it('RETURN_401_IF_AUTHENTICATE_RETURN_FALSE', async () => {
			const authenticate = vi.fn().mockResolvedValue(false);
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', authenticate, onMessage: vi.fn() }
			]);
			const { socket } = await simulateUpgrade('/api/ws/chat');
			expect(socket.end).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\n\r\n');
		});

		it('RETURN_500_IF_AUTHENTICATE_THROWS_ERROR', async () => {
			const authenticate = vi.fn().mockRejectedValue(new Error('auth failed'));
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', authenticate, onMessage: vi.fn() }
			]);
			const { socket } = await simulateUpgrade('/api/ws/chat');
			expect(socket.end).toHaveBeenCalledWith('HTTP/1.1 500 Internal Server Error\r\n\r\n');
		});

		it('CALL_ONCONNECT_AFTER_UPGRADE', async () => {
			const onConnect = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onConnect }
			]);
			await simulateUpgrade('/api/ws/chat');
			expect(onConnect).toHaveBeenCalledTimes(1);
		});

		it('CALL_ONCONNECT_AND_CLOSE(1011)_IF_ONCONNECT_THROWS_ERROR', async () => {
			const onConnect = vi.fn().mockRejectedValue(new Error('connect failed'));
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onConnect }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat', undefined, true);
			expect(ws.close).toHaveBeenCalledWith(1011, 'Internal error');
		});

		it('CALL_ONERROR_INSTEAD_OF_SEND_IF_ONCONNECT_THROWS_ERROR_AND_ONERROR_IS_PROVIDED', async () => {
			const onError = vi.fn();
			const onConnect = vi.fn().mockRejectedValue(new Error('oops'));
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onConnect, onError }
			]);
			await simulateUpgrade('/api/ws/chat');
			expect(onError).toHaveBeenCalledTimes(1);
		});

		it('CALL_ONMESSAGE_ON_NO-JSON_TEXT_MESSAGE', async () => {
			const onMessage = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onMessage }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('message', Buffer.from('hello plain text'), false);
			await vi.waitFor(() => expect(onMessage).toHaveBeenCalledWith(
				expect.anything(),
				'hello plain text'
			));
		});

		it('CALL_ONMESSAGE_WITH_PARSED_OBJECT_FROM_JSON', async () => {
			const onMessage = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onMessage }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('message', Buffer.from(JSON.stringify({ type: 'greet' })), false);
			await vi.waitFor(() => expect(onMessage).toHaveBeenCalledWith(
				expect.anything(),
				{ type: 'greet' }
			));
		});

		it('PASS_RAW_BUFFER_IF_ISBINARY_IS_TRUE', async () => {
			const onMessage = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onMessage }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			const binaryData = Buffer.from([0x01, 0x02, 0x03]);
			ws.emit('message', binaryData, true);
			await vi.waitFor(() => expect(onMessage).toHaveBeenCalledWith(
				expect.anything(),
				binaryData
			));
		});

		it('USE_TRANSFORM_RAW_DATA_IF_PROVIDED', async () => {
			const transformRawData = vi.fn().mockResolvedValue({ transformed: true });
			const onMessage = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', transformRawData, onMessage }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('message', Buffer.from('raw'), false);
			await vi.waitFor(() => expect(onMessage).toHaveBeenCalledWith(
				expect.anything(),
				{ transformed: true }
			));
		});

		it('CALL_ONERROR_IF_TRANSFORM_RAW_DATA_THROWS_ERROR', async () => {
			const onError = vi.fn();
			const transformRawData = vi.fn().mockRejectedValue(new Error('transform error'));
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', transformRawData, onError }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('message', Buffer.from('raw'), false);
			await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
		});

		it('MATCH_RESPONSES_AND_CALL_SEND', async () => {
			const responseFn = vi.fn().mockResolvedValue({ type: 'pong' });
			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/chat',
					responses: [
						{
							match: (_conn: any, msg: any) => msg?.type === 'ping',
							response: responseFn
						}
					]
				}
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('message', Buffer.from(JSON.stringify({ type: 'ping' })), false);
			await vi.waitFor(() => expect(ws.send).toHaveBeenCalledWith(
				JSON.stringify({ type: 'pong' }),
				expect.any(Function)
			));
		});

		it('BROADCAST_IF_RESPONSE_HAS_BROADCAST_TRUE', async () => {
			const onMessage2 = vi.fn();

			const { WebSocketServer } = await import('./utils/WebSocket');
			let upgradeCallCount = 0;
			const wsMocks = [await makeMockWs(), await makeMockWs()];
			vi.spyOn(WebSocketServer.prototype, 'handleUpgrade').mockImplementation(
				(_req: any, _socket: any, _head: any, cb: any) => cb(wsMocks[upgradeCallCount++])
			);

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/chat',
					responses: [
						{
							match: () => true,
							response: { type: 'broadcast-msg' },
							broadcast: true
						}
					]
				}
			]);

			const req1 = new PassThrough() as any;
			Object.assign(req1, { url: '/api/ws/chat', method: 'GET', headers: {} });
			const socket1 = { end: vi.fn() } as any;
			await upgradeHandler(req1, socket1, Buffer.alloc(0));

			const req2 = new PassThrough() as any;
			Object.assign(req2, { url: '/api/ws/chat', method: 'GET', headers: {} });
			const socket2 = { end: vi.fn() } as any;
			await upgradeHandler(req2, socket2, Buffer.alloc(0));

			wsMocks[0].emit('message', Buffer.from('hi'), false);

			await vi.waitFor(() => expect(wsMocks[1].send).toHaveBeenCalled());
		});

		it('CALL_ONCLOSE_WHEN_SOCKET_IS_CLOSED_BY_CLIENT', async () => {
			const onClose = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onClose }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('close', 1000, Buffer.from('Normal'));
			await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith(
				expect.anything(),
				1000,
				'Normal',
				true
			));
		});

		it('CALL_ONERROR_AND_FORCECLOSE_ON_SOCKET_ERROR_EVENT', async () => {
			const onError = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onError }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('error', new Error('socket boom'));
			await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
			expect(ws.terminate).toHaveBeenCalled();
		});

		it('RESPONSE_WITH_PONGON_PING_EVENT_WITHOUT_ON_PING', async () => {
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat' }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			const pingData = Buffer.from('ping-payload');
			ws.emit('ping', pingData);
			await vi.waitFor(() => expect(ws.pong).toHaveBeenCalledWith(pingData));
		});

		it('CALL_ONPING_IF_PROVIDED', async () => {
			const onPing = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', onPing }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('ping', Buffer.from('data'));
			await vi.waitFor(() => expect(onPing).toHaveBeenCalledTimes(1));
		});

		it('DOES_JOINROOM_TO_DEFAULTROOM_IF_PROVIDED', async () => {
			const onConnect = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', defaultRoom: 'lobby', onConnect }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');

			const connection = onConnect.mock.calls[0][0];
			expect(connection.isInRoom('lobby')).toBe(true);
		});

		it('SKIP_DISABLED_HANDLER_AND_RETURN_404', async () => {
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', disabled: true, onMessage: vi.fn() }
			]);
			const { socket } = await simulateUpgrade('/api/ws/chat');
			expect(socket.end).toHaveBeenCalledWith('HTTP/1.1 404 Not Found\r\n\r\n');
		});

		it('APPLIES_DELAY_IF_PROVIDED_IN_HANDLER', async () => {
			vi.useFakeTimers();
			const onMessage = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/chat', delay: 200, onMessage }
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('message', Buffer.from(JSON.stringify({ type: 'test' })), false);
			expect(onMessage).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(200);
			expect(onMessage).toHaveBeenCalledTimes(1);
			vi.useRealTimers();
		});

		it('ONMESSAGE_CATCH_CALL_ONERROR_IF_ON_MESSAGE_THROWS_ERROR', async () => {
			const error = new Error('crash onMessage');
			const onMessage = vi.fn().mockRejectedValue(error);
			const onError = vi.fn();

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/test-error',
					onMessage,
					onError
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/test-error');
			ws.emit('message', Buffer.from('test'), false);
			await vi.waitFor(() => {
				expect(onError).toHaveBeenCalledWith(expect.anything(), error);
			});
		});

		it('ONMESSAGE_CATCH_SEND_ERROR_MESSAGE_IF_ONERROR_IS_NOT_PROVIDED', async () => {
			const error = new Error('crash manual');
			const onMessage = vi.fn().mockRejectedValue(error);

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/test-send-error',
					onMessage

				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/test-send-error');

			ws.emit('message', Buffer.from('test'), false);

			await vi.waitFor(() => {
				expect(ws.send).toHaveBeenCalledWith(
					JSON.stringify({ type: 'error', message: 'crash manual' }),
					expect.any(Function)
				);
			});
		});

		it('CATCH IN MATCH: CALL_ONERROR_IF_MATCH_METHOD_THROWS_ERROR', async () => {
			const error = new Error('match criteria failed');
			const onError = vi.fn();

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/match-error',
					responses: [
						{
							match: () => { throw error; },
							response: { type: 'never-reached' }
						}
					],
					onError
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/match-error');
			ws.emit('message', Buffer.from('test'), false);
			await vi.waitFor(() => {
				expect(onError).toHaveBeenCalledWith(expect.anything(), error);
			});
		});

		it('CATCH IN MATCH_SEND_ERROR_MESSAGE_IF_MATCH_THROWS_ERROR_AND_ONERROR_IS_NOT_PROVIDED', async () => {
			const error = new Error('match error no handler');

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/match-error-send',
					responses: [
						{
							match: () => { throw error; },
							response: { type: 'never' }
						}
					]
				}
			]);
			const { ws } = await simulateUpgrade('/api/ws/match-error-send');

			ws.emit('message', Buffer.from('test'), false);
			await vi.waitFor(() => {
				expect(ws.send).toHaveBeenCalledWith(
					JSON.stringify({ type: 'error', message: 'match error no handler' }),
					expect.any(Function)
				);
			});
		});

		it('CATCH IN RESPONSE HANDLER_CALL_ONERROR_IF_RESPONSE_FUNCTION_THORWS_ERROR', async () => {
			const error = new Error('response function failed');
			const onError = vi.fn();

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/res-error',
					responses: [
						{
							match: () => true,
							response: async () => { throw error; }
						}
					],
					onError
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/res-error');
			ws.emit('message', Buffer.from('hi'), false);
			await vi.waitFor(() => {
				expect(onError).toHaveBeenCalledWith(expect.anything(), error);
			});
		});

		it('CATCH IN RESPONSE HANDLER_SEND_ERROR_TO_CLIENT_IF_ONERROR_IS_NOT_PROVIDED', async () => {
			const error = new Error('logic error');

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/res-error-send',
					responses: [
						{
							match: () => true,
							response: async () => { throw error; }
						}
					]
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/res-error-send');

			ws.emit('message', Buffer.from('hi'), false);
			await vi.waitFor(() => {
				expect(ws.send).toHaveBeenCalledWith(
					JSON.stringify({ type: 'error', message: 'logic error' }),
					expect.any(Function)
				);
			});
		});

		it('EXECUTE_BROADCAST_IN_A_SPECIFIED_ROOM', async () => {
			const responsePayload = { msg: 'hello room' };
			const roomName = 'secret-room';

			const { WebSocketConnection } = await import('./utils/WebSocket');
			const broadcastSpy = vi.spyOn(WebSocketConnection.prototype, 'broadcast').mockImplementation(() => { });

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/chat',
					responses: [
						{
							match: () => true,
							response: responsePayload,
							broadcast: {
								room: roomName,
								includeSelf: true
							}
						}
					]
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/chat');
			ws.emit('message', Buffer.from('trigger'), false);

			await vi.waitFor(() => {
				expect(broadcastSpy).toHaveBeenCalledWith(
					responsePayload,
					{
						room: roomName,
						includeSelf: true
					}
				);
			});
		});

		it('TRANSFORMRAWDATA_CATCH_SEND_ERROR_MESSAGE_IF_ONERROR_IS_NOT_PROVIDED', async () => {
			const error = new Error('transform failed');

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/transform-test',
					transformRawData: async () => { throw error; },
					onMessage: vi.fn(),
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/transform-test');
			ws.emit('message', Buffer.from('raw data'), false);
			await vi.waitFor(() => {
				expect(ws.send).toHaveBeenCalledWith(
					JSON.stringify({ type: 'error', message: 'transform failed' }),
					expect.any(Function)
				);
			});
		});

		it('CONCACT_A_BUFFER_ARRAY_IN_A_UNIQUE_DATABUFFER', async () => {
			const onMessage = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/array-test', onMessage }
			]);
			const { ws } = await simulateUpgrade('/api/ws/array-test');
			const chunks = [Buffer.from('hello '), Buffer.from('world')];
			ws.emit('message', chunks, false);

			await vi.waitFor(() => {
				expect(onMessage).toHaveBeenCalledWith(expect.anything(), 'hello world');
			});
		});

		it('CONVERT_AN_ARRAYBUFFER_IN_DATABUFFER_BY_BUFFER.FROM', async () => {
			const onMessage = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/ab-test', onMessage }
			]);

			const { ws } = await simulateUpgrade('/api/ws/ab-test');

			const text = 'arraybuffer test';
			const encoder = new TextEncoder();
			const arrayBuffer = encoder.encode(text).buffer;

			ws.emit('message', arrayBuffer, false);

			await vi.waitFor(() => {
				expect(onMessage).toHaveBeenCalledWith(expect.anything(), text);
			});
		});

		it('RESET_INACTIVITY_TIMER_ON_EVERY_RECEIVED_MESSAGE', async () => {
			const timeoutValue = 5000;

			const { WebSocketConnection } = await import('./utils/WebSocket');

			const resetSpy = vi.spyOn(WebSocketConnection.prototype, 'resetInactivityTimer');

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/timeout-test',
					inactivityTimeout: timeoutValue,
					onMessage: vi.fn()
				}
			]);
			const { ws } = await simulateUpgrade('/api/ws/timeout-test', undefined, true);

			resetSpy.mockClear();
			ws.emit('message', Buffer.from('ping1'), false);
			ws.emit('message', Buffer.from('ping2'), false);

			await vi.waitFor(() => {
				expect(resetSpy).toHaveBeenCalledTimes(2);
			});
			expect(resetSpy).toHaveBeenCalledWith(timeoutValue);
		});

		it('ONPING_CATCH_CALL_ONERROR_IF_ONPING_THROWS_ERROR', async () => {
			const error = new Error('ping crash');
			const onPing = vi.fn().mockRejectedValue(error);
			const onError = vi.fn();

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/ping-test',
					onPing,
					onError
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/ping-test');

			const pingData = Buffer.from('payload');
			ws.emit('ping', pingData);

			await vi.waitFor(() => {
				expect(onError).toHaveBeenCalledWith(expect.anything(), error);
			});
		});

		it('ONPING_CATCH_SEND_ERROR_MESSAGE_IF_ONERROR_IS_NOT_PROVIDED', async () => {
			const error = new Error('ping error no handler');
			const onPing = vi.fn().mockRejectedValue(error);

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/ping-test-send',
					onPing
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/ping-test-send');

			ws.emit('ping', Buffer.from('data'));

			await vi.waitFor(() => {
				expect(ws.send).toHaveBeenCalledWith(
					JSON.stringify({ type: 'error', message: 'ping error no handler' }),
					expect.any(Function)
				);
			});
		});

		it('RESET_MISSED_PONG_WHEN_RECEIVES_PING_AND_PONG_FROM_CLIENT', async () => {
			const { WebSocketConnection } = await import('./utils/WebSocket');

			const resetMissedPongSpy = vi.spyOn(WebSocketConnection.prototype, 'resetMissedPong').mockImplementation(() => { });

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/heartbeat-test',
					onPing: vi.fn().mockResolvedValue(undefined)
				}
			]);

			const { ws } = await simulateUpgrade('/api/ws/heartbeat-test');

			ws.emit('pong');

			ws.emit('ping', Buffer.from('data'));

			await vi.waitFor(() => {
				expect(resetMissedPongSpy).toHaveBeenCalledTimes(2);
			});
		});

		it('ENABLE_HEARTBEAT_IF_PROVIDED_WITH_POSITIVE_VALUE', async () => {
			const heartbeatMs = 30000;
			const { WebSocketConnection } = await import('./utils/WebSocket');

			const startHeartbeatSpy = vi.spyOn(WebSocketConnection.prototype, 'startHeartbeat').mockImplementation(() => { });

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/heartbeat-config',
					heartbeat: heartbeatMs,
					onMessage: vi.fn()
				}
			]);

			await simulateUpgrade('/api/ws/heartbeat-config');

			expect(startHeartbeatSpy).toHaveBeenCalledWith(heartbeatMs);
		});

		it('DISABLE_HEARTBEAT_IF_VALUE_IS_0_OR_NOT_PROVIDED', async () => {
			const { WebSocketConnection } = await import('./utils/WebSocket');
			const startHeartbeatSpy = vi.spyOn(WebSocketConnection.prototype, 'startHeartbeat').mockImplementation(() => { });

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/no-heartbeat',
					heartbeat: 0,
					onMessage: vi.fn()
				}
			]);

			await simulateUpgrade('/api/ws/no-heartbeat');
			expect(startHeartbeatSpy).not.toHaveBeenCalled();
		});

		it('CLEANUP_FUNCTION_EXECUTES_UNMOUNT', async () => {
			const { WebSocketServer, WebSocketConnection } = await import('./utils/WebSocket');
			const wssCloseSpy = vi.spyOn(WebSocketServer.prototype, 'close').mockImplementation(() => { });
			const forceCloseSpy = vi.spyOn(WebSocketConnection.prototype, 'forceClose').mockImplementation(() => { });

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/chat',
					onMessage: vi.fn(),
					subprotocols: ['proto1']
				}
			]);
			const { ws } = await simulateUpgrade('/api/ws/chat');
			const plug = await generateOptions({ ...mockOptions, enableWs: true, wsHandlers: [{ pattern: '/ws/chat' }] });
			await plug.configResolved(CONF);
			(plug as any).configureServer({ ...getServer(), httpServer });

			expect(httpServer.listenerCount('upgrade')).toBeGreaterThan(0);

			httpServer.emit('close');
			await vi.waitFor(() => {
				expect(httpServer.listenerCount('upgrade')).toBe(0);
				expect(wssCloseSpy).toHaveBeenCalled();
			});
			expect(httpServer.listenerCount('upgrade')).toBe(0);
			expect(httpServer.off).toHaveBeenCalledWith('upgrade', expect.any(Function));
			expect(wssCloseSpy).toHaveBeenCalled();
			expect(forceCloseSpy).toHaveBeenCalled();
		});

		it('HANDLEPROTOCOLS_SELECT_CORRECT_PROTOCOL', async () => {
			const WebSocketModule = await import('./utils/WebSocket');
			let capturedOptions: any = null;
			const wsServerSpy = vi.spyOn(WebSocketModule, 'WebSocketServer').mockImplementation(function (opts: any) {
				if (opts && opts.handleProtocols) {
					capturedOptions = opts;
				}
				return {
					close: vi.fn(),
					handleUpgrade: vi.fn()
				} as any;
			});
			const subprotocols = ['graphql-ws', 'json-api'];
			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/test',
					subprotocols,
					onMessage: vi.fn()
				}
			]);

			if (!capturedOptions) {
				throw new Error("Il costruttore WebSocketServer con handleProtocols non è stato chiamato. Verifica che il plugin entri nel blocco if (handler.subprotocols?.length)");
			}
			const handleProtocols = capturedOptions.handleProtocols;
			expect(handleProtocols(['unsupported', 'json-api'])).toBe('json-api');
			expect(handleProtocols(['binary', 'soap'])).toBe(false);
			expect(handleProtocols(['json-api', 'graphql-ws'])).toBe('json-api');
			wsServerSpy.mockRestore();
		});

		it('REGISTER_MIDDLEWARE_ONLY_FIRST_TIME_OR_IF_HTTPSERVER_CHANGE', async () => {
			const handlers = [{ pattern: '/ws', onMessage: vi.fn() }];
			const plug = await generateOptions({
				...mockOptions,
				enableWs: true,
				wsHandlers: handlers
			});
			await plug.configResolved(CONF);
			const httpServer1 = await makeMockHttpServer();
			const serverMock1 = {
				middlewares: { use: vi.fn() },
				httpServer: httpServer1
			} as any;
			plug.configureServer(serverMock1);
			expect(serverMock1.middlewares.use).toHaveBeenCalledTimes(1);
			expect(httpServer1.listenerCount('upgrade')).toBeGreaterThan(0);

			serverMock1.middlewares.use.mockClear();
			plug.configureServer(serverMock1);
			expect(serverMock1.middlewares.use).toHaveBeenCalledTimes(0);
		});

		it('REGISTER_MIDDLEWARE_ONLY_FIRST_TIME_OR_IF_HTTPSERVER_CHANGE_IN_PREVIEW', async () => {
			const handlers = [{ pattern: '/ws', onMessage: vi.fn() }];
			const plug = await generateOptions({
				...mockOptions,
				enableWs: true,
				wsHandlers: handlers
			});
			await plug.configResolved(CONF);
			const httpServer1 = await makeMockHttpServer();
			const serverMock1 = {
				middlewares: { use: vi.fn() },
				httpServer: httpServer1
			} as any;
			plug.configurePreviewServer(serverMock1);

			expect(serverMock1.middlewares.use).toHaveBeenCalledTimes(1);
			expect(httpServer1.listenerCount('upgrade')).toBeGreaterThan(0);

			serverMock1.middlewares.use.mockClear();
			plug.configurePreviewServer(serverMock1);
			expect(serverMock1.middlewares.use).toHaveBeenCalledTimes(0);
		});

		it('CLOSE_AND_ERROR_BLOCKS', async () => {
			const { WebSocketConnection, ConnectionManager } = await import('./utils/WebSocket');
			const markClosedSpy = vi.spyOn(WebSocketConnection.prototype, 'markClosed');
			const removeSpy = vi.spyOn(ConnectionManager.prototype, 'remove');

			const onClose = vi.fn();
			const onError = vi.fn();

			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/coverage', onClose, onError }
			]);

			const { ws } = await simulateUpgrade('/api/ws/coverage');
			ws.emit('close', 1000, Buffer.from('bye'));

			await vi.waitFor(() => {
				expect(markClosedSpy).toHaveBeenCalled();
				expect(onClose).toHaveBeenCalled();
				expect(removeSpy).toHaveBeenCalled();
			});

			ws.emit('error', new Error('test-error'));
			await vi.waitFor(() => {
				expect(onError).toHaveBeenCalled();
			});
		});

		it('ONCLOSE_BLOCK_AND_REASON_EMPTY_HANDLING', async () => {
			const { WebSocketConnection, ConnectionManager } = await import('./utils/WebSocket');
			const removeSpy = vi.spyOn(ConnectionManager.prototype, 'remove');

			const onClose = vi.fn();
			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/close-spec', onClose }
			]);

			const { ws: ws1 } = await simulateUpgrade('/api/ws/close-spec');
			ws1.emit('close', 1000, Buffer.from('bye'));

			await vi.waitFor(() => {
				expect(onClose).toHaveBeenCalledWith(expect.anything(), 1000, 'bye', true);
				expect(removeSpy).toHaveBeenCalled();
			});

			const { ws: ws2 } = await simulateUpgrade('/api/ws/close-spec');
			ws2.emit('close', 1001, Buffer.alloc(0));

			await vi.waitFor(() => {
				expect(onClose).toHaveBeenCalledWith(expect.anything(), 1001, '', true);
			});
		});

		it('SEND_METHOD_HANDLING_STRINGS_OBJECTS_AND_ERRORS', async () => {
			const { WebSocketConnection, ConnectionManager } = await import('./utils/WebSocket');
			const logger = makeLogger();
			const manager = new ConnectionManager(logger);
			const mockWs = await makeMockWs();
			const connection = new WebSocketConnection(logger, mockWs, '/ws', manager);
			await connection.send('test-string');
			expect(mockWs.send).toHaveBeenCalledWith('test-string', expect.any(Function));

			const obj = { message: 'hello' };
			await connection.send(obj);
			expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(obj), expect.any(Function));

			const mockError = new Error('send-fail');
			mockWs.send.mockImplementationOnce((payload: any, cb: (err?: Error) => void) => {
				cb(mockError);
			});
			await expect(connection.send('fail')).rejects.toThrow('send-fail');
		});

		it('PONG_EVENT_RESET_MISSED_PONG_AND_CALL_ONPONG', async () => {
			const onPong = vi.fn();
			const { WebSocketConnection } = await import('./utils/WebSocket');
			const resetSpy = vi.spyOn(WebSocketConnection.prototype, 'resetMissedPong');

			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/pong', onPong }
			]);
			const { ws } = await simulateUpgrade('/api/ws/pong');
			const pongData = Buffer.from('pong-payload');
			ws.emit('pong', pongData);

			await vi.waitFor(() => {
				expect(resetSpy).toHaveBeenCalled();
				expect(onPong).toHaveBeenCalledWith(expect.anything(), pongData);
			});
		});

		it('ONPONG_CATCH_SEND_ERROR_MESSAGE_IF_ONPONG_FAILS_AND_ONERROR_IS_NOT_PROVIDED', async () => {
			const error = new Error('pong-handler-failed');
			const onPong = vi.fn().mockRejectedValue(error);

			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/pong-err', onPong }
			]);

			const { ws } = await simulateUpgrade('/api/ws/pong-err');

			ws.emit('pong', Buffer.from('data'));

			await vi.waitFor(() => {
				expect(ws.send).toHaveBeenCalledWith(
					JSON.stringify({ type: 'error', message: 'pong-handler-failed' }),
					expect.any(Function)
				);
			});
		});

		it('ONPONG_CATCH_SEND_ERROR_MESSAGE_IF_ONPONG_FAILS_AND_ONERROR_IS_PROVIDED', async () => {
			const error = new Error('pong-handler-failed');
			const onPong = vi.fn().mockRejectedValue(error);
			const onError = vi.fn();

			await setupWsPlugin({ ...mockOptions }, [
				{ pattern: '/ws/pong-err', onPong, onError }
			]);

			const { ws } = await simulateUpgrade('/api/ws/pong-err');

			ws.emit('pong', Buffer.from('data'));

			await vi.waitFor(() => {
				expect(onError).toHaveBeenCalled();
			});
		});

		it('ERROR_WITHOUT_ON_ERROR', async () => {
			const { Logger } = await import('./utils/Logger');
			const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => { });
			const testError = new Error('forced-error-for-else');

			await setupWsPlugin({ ...mockOptions }, [
				{
					pattern: '/ws/else-coverage',
					onMessage: vi.fn()
				}
			]);
			const { ws } = await simulateUpgrade('/api/ws/else-coverage');
			ws.emit('error', testError);

			await vi.waitFor(() => {
				expect(loggerErrorSpy).toHaveBeenCalledWith(
					expect.stringContaining('runWsPlugin: socket error'),
					testError.message
				);
			});
			loggerErrorSpy.mockRestore();
		});
	});
});
