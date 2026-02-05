import { IncomingMessage, ServerResponse } from "node:http";
import { Connect, PreviewServer, ViteDevServer } from "vite";
import { ApiWsRestFsDataResponse, UniversalApiRestFsHandler, UniversalApiOptionsRequired, UniversalApiRequest, HandledRequestData, UniversalApiWsHandler } from "src/models/index.model";
import { Utils } from "./utils";
import { join, parse } from "node:path";
import { MimeType } from "./MimeType";
import { Constants } from "./constants";
import { AntPathMatcher } from "./AntPathMatcher";
import { UniversalApiError } from "./Error";
import { Socket } from "node:net";
import { ConnectionManager, WebSocketConnection, WebSocketFrameParser } from "./WebSocket";
import { ILogger } from "src/models/logger.model";
import { IWebSocketConnection, WebSocketFrame } from "src/models/webSocket.model";

/* v8 ignore start */
/**
 * @ignore
 * Not used for now. It simulates the options http request behavior
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handlingOptionsRequest(logger: ILogger, matcher: AntPathMatcher, fullUrl: URL, request: UniversalApiRequest, handlers: UniversalApiRestFsHandler[], endpointNoPrefix: string, result: HandledRequestData): boolean {
	logger.debug("handlingOptionsRequest: START");
	try {
		if (request.method !== "OPTIONS") {
			return false;
		}
		const allow: Set<string> = new Set<string>();
		for (const handle of handlers) {
			const handlerMatched = matcher.doMatch(
				Utils.request.addSlash(handle.pattern, "leading"),
				Utils.request.addSlash(endpointNoPrefix, "leading"),
				true,
				request.params
			);
			if (handlerMatched) {
				if (request.method === handle.method) {
					return false;
				} else {
					allow.add(request.method!);
				}
			}
		}
		if (allow.size > 0) {
			result.status = Constants.HTTP_STATUS_CODE.OK;
			result.data = null;
			result.headers.push({
				name: "Allow",
				value: [...allow].join(", ")
			});
			const hasCors = !!request.headers["access-control-request-methods"] || !!request.headers["access-control-request-headers"];
			if (hasCors) {
				result.headers.push({
					name: "Access-Control-Allow-Methods",
					value: [...allow].join(", ")
				});
			}
			return true;
		}
		throw new UniversalApiError("Request with OPTIONS method doesn't match endpointPrefix", "NO_HANDLER", fullUrl.pathname);
	} finally {
		logger.debug("handlingOptionsRequest: END");
	}
}
/* v8 ignore stop */

async function handlingApiFsRequest(logger: ILogger, fullUrl: URL, request: UniversalApiRequest, res: ServerResponse, paginationPlugin: UniversalApiOptionsRequired["pagination"], filtersPlugin: UniversalApiOptionsRequired["filters"], parser: UniversalApiOptionsRequired["parser"], handler: UniversalApiRestFsHandler | null, endpointPrefix: string[], fullFsDir: string | null, result: HandledRequestData): Promise<boolean> {
	logger.debug("handlingApiFsRequest: START");
	try {
		const IS_API_REST_FS = handler !== null && handler.handle === "FS",
			paginationHandler = handler !== null ? handler.pagination : undefined,
			filtersHandler = handler !== null ? handler.filters : undefined,
			postHandleHandler = handler !== null ? handler.postHandle : undefined;
		if (fullFsDir === null) {
			if (IS_API_REST_FS) {
				throw new UniversalApiError("Request matching Api Rest Fs handler but fsDir provide doesn't exists", "ERROR", fullUrl.pathname);
			} else {
				return false;
			}
		}
		handler === null && logger.info("Request handling with FS API");
		const dataFile: { originalData: any, data: any, mimeType: string, total: number } = {
			total: 0,
			data: null,
			originalData: null,
			mimeType: MimeType[".bin"]
		}
		let url = fullUrl.pathname;
		if (IS_API_REST_FS && handler.preHandle) {
			let pathname = fullUrl.pathname;
			if (Array.isArray(handler.preHandle.transform)) {
				handler.preHandle.transform.forEach(({ searchValue, replaceValue }) => {
					pathname = pathname.replace(searchValue, replaceValue);
				});
			} else {
				pathname = handler.preHandle.transform(pathname);
			}
			fullUrl.pathname = pathname;
			url = fullUrl.pathname + fullUrl.search;
		}

		const endpointNoPrefix = Utils.request.removeSlash(Utils.request.removeEndpointPrefix(url, endpointPrefix), "trailing");
		const filePath = join(fullFsDir, endpointNoPrefix);
		let file: string = filePath,
			fileFound;
		if (await Utils.files.isFileExists(filePath)) {
			file = filePath;
			fileFound = true;
		} else if (await Utils.files.isDirExists(filePath)) {
			const files: string[] = await Utils.files.directoryFileList(filePath);
			const fileIndex = files.find(el => el.startsWith("index.json")) ?? null;
			if (fileIndex) {
				fileFound = true;
				file = join(filePath, fileIndex)
			} else {
				fileFound = false;
			}
		} else {
			const pathBeforeLastSegment = join(filePath, "..");
			const lastSegmentPath = Utils.request.removeSlash(filePath.substring(pathBeforeLastSegment.length), "both");
			if (lastSegmentPath !== "" && await Utils.files.isDirExists(pathBeforeLastSegment)) {
				const files: string[] = await Utils.files.directoryFileList(pathBeforeLastSegment);
				const fileExt = files.find(f => f.startsWith(lastSegmentPath)) ?? null;
				if (fileExt) {
					file = join(pathBeforeLastSegment, fileExt);
					fileFound = true;
				} else {
					fileFound = false;
				}
			} else {
				fileFound = false;
			}
		}
		if (fileFound) {
			const { ext } = parse(file);
			dataFile.mimeType = ext in MimeType ? MimeType[ext as keyof typeof MimeType] : MimeType[".bin"];
			try {
				dataFile.data = dataFile.mimeType === MimeType[".json"]
					? await Utils.files.readingStreamFile(file)
					: null;
				dataFile.total = 1;
			} catch (error: any) {
				logger.error("handlingApiFsRequest: Error reading file ", file, error);
				throw new UniversalApiError(`Error reading file ${file}`, "ERROR", fullUrl.pathname);
			}
		}
		dataFile.originalData = dataFile.data;

		if (IS_API_REST_FS && !!postHandleHandler) {
			logger.debug("handlingApiFsRequest: applying postHandle");
			await postHandleHandler(
				request,
				res,
				fileFound
					? dataFile.originalData === null
						? await Utils.files.readingFile(file)
						: dataFile.originalData
					: null
			);
			throw new UniversalApiError("FS REST", "MANUALLY_HANDLED", fullUrl.pathname);
		}

		logger.debug("handlingApiFsRequest: request Method: ", request.method!);

		switch (request.method!) {
			case "HEAD":
			case "GET":
				if (fileFound) {
					result.status = Constants.HTTP_STATUS_CODE.OK;
					result.headers = [
						...result.headers,
						{ name: "content-type", value: dataFile.mimeType }
					];
					if (dataFile.data && dataFile.mimeType === MimeType[".json"]) {
						if (Utils.request.hasPaginationOrFilters(request.method, paginationPlugin, filtersPlugin, paginationHandler, filtersHandler)) {
							if (!IS_API_REST_FS) {
								logger.debug("handlingApiFsRequest: parsing request");
								await Utils.request.parseRequest(request, res, fullUrl, parser, logger);
							}
							if (request.body !== null || request.files !== null) {
								throw new UniversalApiError(`${request.method} request cannot have a body in ${IS_API_REST_FS ? "REST " : ""}File System API mode`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
							}
							try {
								logger.debug("handlingApiFsRequest: applying pagination and filters");
								Utils.request.applyPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin, dataFile);
							} catch (error: any) {
								if (error instanceof UniversalApiError) {
									if (error.getType() === "MANUALLY_HANDLED") {
										error.setType("ERROR");
										error.setPath(fullUrl.pathname);
									}
									throw error;
								}
								logger.debug("handlingApiFsRequest: ERROR parsing json content file ", file!, error);
								throw new UniversalApiError(`Error parsing json content file ${file}`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
							}
						}
						request.method === "GET" && (result.data = dataFile.data);
						try {
							const datas = JSON.parse(dataFile.data);
							Array.isArray(datas) && (dataFile.total = datas.length);
						} catch (_) {
							dataFile.total = 1;
						}
						result.headers.push(
							{ name: "content-length", value: Utils.files.getByteLength(dataFile.data) },
							{ name: Constants.TOTAL_ELEMENTS_HEADER, value: dataFile.total }
						);
					} else {
						throw new UniversalApiError(
							file,
							"READ_FILE",
							fullUrl.pathname,
							undefined,
							{
								headers: result.headers,
								requ: request
							}
						);
					}
				} else {
					throw new UniversalApiError("Not found", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.NOT_FOUND);
				}
				break;
			case "POST":
				try {
					if (!IS_API_REST_FS) {
						logger.debug("handlingApiFsRequest: parsing request");
						await Utils.request.parseRequest(request, res, fullUrl, parser, logger);
					}
					if (request.files !== null && request.files.length > 1) {
						throw new UniversalApiError(`POST request with multiple file is not allowed in ${IS_API_REST_FS ? "REST " : ""}File System API mode`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
					}
					const HAS_BODY = request.body !== null;
					const HAS_FILE = request.files !== null && request.files.length > 0;
					const currentContent = HAS_BODY
						? request.body
						: (HAS_FILE ? request.files![0].content : null);
					const currentMime = HAS_BODY
						? (Utils.request.isBodyJson(request.body) ? MimeType[".json"] : request.headers["content-type"] as MimeType)
						: (HAS_FILE ? request.files![0].contentType as MimeType : null);
					const HAS_DATA = currentContent !== null;
					const IS_JSON_CONTENT = currentMime === MimeType[".json"];
					const HAS_PAG_OR_FILT = Utils.request.hasPaginationOrFilters(request.method, paginationPlugin, filtersPlugin, paginationHandler, filtersHandler);
					const IS_JSON_FILE = dataFile.mimeType === MimeType[".json"];

					if (HAS_BODY && HAS_FILE) {
						throw new UniversalApiError(`POST request with file and body is not allowed in ${IS_API_REST_FS ? "REST " : ""}File System API mode`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
					}
					let writeFile = -1;
					if (fileFound) {
						if (!IS_JSON_FILE) {
							throw new UniversalApiError(`POST request for not json file is not allowed in ${IS_API_REST_FS ? "REST " : ""}File System API mode`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
						}
						result.status = Constants.HTTP_STATUS_CODE.OK;
						if (HAS_PAG_OR_FILT) {
							try {
								logger.debug("handlingApiFsRequest: applying pagination and filters");
								Utils.request.applyPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin, dataFile);
							} catch (error: any) {
								if (error instanceof UniversalApiError) {
									if (error.getType() === "MANUALLY_HANDLED") {
										error.setType("ERROR");
										error.setPath(fullUrl.pathname);
									}
									throw error;
								}
								logger.debug("handlingApiFsRequest: ERROR parsing json content file", file!, error);
								throw new UniversalApiError(`Error to retrive filtered and paginated data from ${file}`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
							}
						}
						if (HAS_DATA) {
							if (!IS_JSON_CONTENT || !HAS_PAG_OR_FILT) {
								throw new UniversalApiError(`File at ${fullUrl.pathname} already exists`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.CONFLICT);
							}
							const bodyClean = Utils.request.getCleanBody(request.method, currentContent, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin);
							if (bodyClean !== null) {
								throw new UniversalApiError(`File at ${fullUrl.pathname} already exists`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.CONFLICT);
							}
						}
						result.data = dataFile.data;
						dataFile.total = Array.isArray(dataFile.data)
							? dataFile.data.length
							: dataFile.data
								? 1
								: 0;
						result.headers.push(
							...result.headers,
							{ name: "content-type", value: dataFile.mimeType },
							{ name: "content-length", value: Utils.files.getByteLength(dataFile.data) },
							{ name: Constants.TOTAL_ELEMENTS_HEADER, value: dataFile.total }
						);
					} else {
						if (!HAS_DATA) {
							throw new UniversalApiError(`No data provided`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
						}
						if (HAS_PAG_OR_FILT) {
							throw new UniversalApiError(`No data to filter or to paginate`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
						}
						result.status = Constants.HTTP_STATUS_CODE.CREATED;
						writeFile = currentContent;
					}
					if (writeFile !== -1) {
						try {
							await Utils.files.writingFile(file, fileFound, writeFile, currentMime, true);
						} catch (error: any) {
							logger.error("handlingApiFsRequest: Error writing file with POST method", error);
							throw new UniversalApiError("Error writing data", "ERROR", fullUrl.pathname);
						}
					}
				} catch (error: any) {
					if (error instanceof UniversalApiError) {
						throw error;
					}
					logger.error("handlingApiFsRequest: Error detecting data to write with POST method", error);
					throw new UniversalApiError("Error creating data", "ERROR", fullUrl.pathname);
				}
				break;
			case "PUT":
				if (!IS_API_REST_FS) {
					logger.debug("handlingApiFsRequest: parsing request");
					await Utils.request.parseRequest(request, res, fullUrl, parser, logger);
				}
				if (request.files !== null && request.files.length > 1) {
					throw new UniversalApiError(`PUT request with multiple file is not allowed in ${IS_API_REST_FS ? "REST " : ""}File System API mode`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				result.status = Constants.HTTP_STATUS_CODE[fileFound ? "OK" : "CREATED"];
				let writeFile, mimeType;
				if (request.body !== null) {
					writeFile = request.body
					mimeType = Utils.request.isBodyJson(request.body)
						? MimeType[".json"]
						: request.headers["content-type"] as MimeType;
				} else if (request.files !== null && request.files.length > 0) {
					writeFile = request.files[0].content;
					mimeType = request.files[0].contentType as MimeType;
				} else {
					throw new UniversalApiError("No data provided", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				try {
					await Utils.files.writingFile(file, fileFound, writeFile, mimeType as MimeType, true);
				} catch (error: any) {
					logger.error(`handlingApiFsRequest: Error ${fileFound ? "updating" : "creating"} file with PUT method`, error);
					throw new UniversalApiError(`Error ${fileFound ? "updating" : "creating"} data`, "ERROR", fullUrl.pathname);
				}
				break;
			case "PATCH":
				if (!["application/json", "application/json-patch+json", "application/merge-patch+json"].includes(request.headers["content-type"] || "")) {
					throw new UniversalApiError(`PATCH request content-type unsupported in ${IS_API_REST_FS ? "REST " : ""}File System API mode`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.UNSUPPORTED_MEDIA_TYPE);
				}
				if (!IS_API_REST_FS) {
					logger.debug("handlingApiFsRequest: parsing request");
					await Utils.request.parseRequest(request, res, fullUrl, parser, logger);
				}
				if (!fileFound) {
					throw new UniversalApiError("Resource to update not found", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.NOT_FOUND);
				}
				if (dataFile.mimeType !== MimeType[".json"]) {
					throw new UniversalApiError(`Only json file can be processing with PATCH http method`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				result.status = Constants.HTTP_STATUS_CODE.OK;
				try {
					const TYPE_PATCH = ["application/json", "application/merge-patch+json"].includes(request.headers["content-type"]!) ? "merge" : "json";
					const newData = Utils.files.applyingPatch(JSON.parse(dataFile.data), request.body, TYPE_PATCH);
					await Utils.files.writingFile(file, fileFound, newData, dataFile.mimeType, true);
				} catch (error: any) {
					if (error instanceof UniversalApiError) {
						if (error.getType() === "MANUALLY_HANDLED") {
							error.setType("ERROR");
							error.setPath(fullUrl.pathname);
						}
						throw error;
					}
					logger.error(`handlingApiFsRequest: Error partial updating resource with PATCH method`, error);
					throw new UniversalApiError("Error partial updating resource", "ERROR", fullUrl.pathname);
				}
				break;
			case "OPTIONS":
				throw new UniversalApiError(`Method OPTIONS not allowed in File System API mode`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.METHOD_NOT_ALLOWED);
			case "DELETE":
				if (!fileFound) {
					throw new UniversalApiError("Resource to delete not found", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.NOT_FOUND);
				}
				if (!IS_API_REST_FS) {
					logger.debug("handlingApiFsRequest: parsing request");
					await Utils.request.parseRequest(request, res, fullUrl, parser, logger);
				}
				if (request.body !== null || request.files !== null) {
					throw new UniversalApiError(`DELETE request cannot have a body in ${IS_API_REST_FS ? "REST " : ""}File System API mode`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				result.status = Constants.HTTP_STATUS_CODE.NO_CONTENT;
				try {
					let removeFile = true;
					if (dataFile.mimeType === MimeType[".json"] && Utils.request.hasPaginationOrFilters(request.method, paginationPlugin, filtersPlugin, paginationHandler, filtersHandler)) {
						try {
							logger.debug("handlingApiFsRequest: applying pagination and filters");
							Utils.request.applyPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin, dataFile);
							if (!dataFile.data || Array.isArray(dataFile.data) && dataFile.data.length === 0) {
								throw new UniversalApiError("Partial resource to delete not found", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.NOT_FOUND);
							}
						} catch (error: any) {
							if (error instanceof UniversalApiError) {
								if (error.getType() === "MANUALLY_HANDLED") {
									error.setType("ERROR");
									error.setPath(fullUrl.pathname);
								}
								throw error;
							}
							logger.debug("handlingApiFsRequest: ERROR parsing json content file ", file!, error);
							throw new UniversalApiError(`Error parsing json content file ${file}`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
						}
						let newData: any[] | Record<string, any>;
						if (Array.isArray(dataFile.originalData)) {
							const toDeleteStrings = new Set((dataFile.data as Array<any>).map(el => JSON.stringify(el)));
							newData = dataFile.originalData.filter(el => !toDeleteStrings.has(JSON.stringify(el)));
						} else {
							newData = structuredClone(dataFile.originalData);
							Object.keys(dataFile.data).forEach(key => {
								JSON.stringify(dataFile.originalData[key]) === JSON.stringify(dataFile.data[key]) && delete (newData as Record<string, any>)[key];
							})
						}
						if (Array.isArray(newData) && newData.length > 0) {
							removeFile = false;
							await Utils.files.writingFile(file, fileFound, newData, MimeType[".json"], true);
							result.headers.push({
								name: Constants.DELETED_ELEMENTS_HEADER,
								value: dataFile.originalData.length - newData.length
							});
						}
					}
					if (removeFile) {
						await Utils.files.removeFile(file);
						result.headers.push({name: Constants.DELETED_ELEMENTS_HEADER, value: 1});
					}
				} catch (error) {
					if (error instanceof UniversalApiError) {
						throw error;
					}
					throw new UniversalApiError("Error deleting resource", "ERROR", fullUrl.pathname);
				}
				break;
			default:
				return false;
		}
		return true;
	} catch (error: any) {
		if (error instanceof UniversalApiError) {
			throw error;
		}
		logger.debug("handlingApiFsRequest: ERROR - ", error);
		throw new UniversalApiError(error, "ERROR", fullUrl.pathname);
	} finally {
		logger.debug("handlingApiFsRequest: END");
	}
}

async function handlingApiRestRequest(logger: ILogger, matcher: AntPathMatcher, fullUrl: URL, request: UniversalApiRequest, res: ServerResponse, handlers: UniversalApiOptionsRequired["handlers"], middlewares: UniversalApiOptionsRequired["middlewares"], errorMiddlewares: UniversalApiOptionsRequired["errorMiddlewares"], delay: UniversalApiOptionsRequired["delay"], pagination: UniversalApiOptionsRequired["pagination"], filters: UniversalApiOptionsRequired["filters"], parser: UniversalApiOptionsRequired["parser"], endpointPrefix: string[], endpointNoPrefix: string, fullFsDir: string | null, result: HandledRequestData): Promise<boolean> {
	logger.debug("handlingApiRestRequest: START");
	try {
		let handler: typeof handlers[number] | null = null;
		for (const handle of handlers) {
			const handlerMatched = matcher.doMatch(
				Utils.request.addSlash(handle.pattern, "leading"),
				Utils.request.addSlash(endpointNoPrefix, "leading"),
				true,
				request.params
			);
			if (handlerMatched) {
				if (handle.disabled) {
					logger.debug("handlingApiRestRequest: Request handler is disabled");
				} else if (request.method !== handle.method) {
					logger.debug("handlingApiRestRequest: Request url and handler have different http method");
				} else {
					handler = handle;
					break;
				}
			}
		}
		if (handler !== null) {
			logger.debug("handlingApiRestRequest: using REST api");
			logger.info("Request handling with REST API: handler matched= ", handler.pattern);
			const chain = Utils.request.MiddlewaresChain();
			try {
				chain.use(middlewares, errorMiddlewares);
				logger.debug("handlingApiRestRequest: applying middleware chain");
				await chain.handle(request, res);

				logger.debug("handlingApiRestRequest: parsing request");
				await Utils.request.parseRequest(request, res, fullUrl, handler.parser !== undefined ? handler.parser : parser, logger);

				if (handler.delay || delay) {
					const delayHandler = handler.delay || delay;
					logger.debug("handlingApiRestRequest: request execution will be delayed by", delayHandler.toString());
					await new Promise(res => setTimeout(res, delayHandler));
				}

				if (handler.handle === "FS") {
					logger.debug("handlingApiRestRequest: API FS REST handler");
					return await handlingApiFsRequest(logger, fullUrl, request, res, pagination, filters, parser, handler, endpointPrefix, fullFsDir, result);
				}
				logger.debug("handlingApiRestRequest: API REST handler");
				await handler.handle(request, res);
				throw new UniversalApiError("REST", "MANUALLY_HANDLED", fullUrl.pathname);
			} catch (error: any) {
				if (error instanceof UniversalApiError) {
					throw error;
				}
				logger.debug("handlingApiRestRequest: ERROR applying middleware chain ", error);
				throw new UniversalApiError(error as Error, "ERROR", fullUrl.pathname);
			}
		}
		return false;
	} catch (error: any) {
		if (error instanceof UniversalApiError) {
			throw error;
		}
		logger.debug("handlingApiRestRequest: ERROR - ", error);
		throw new UniversalApiError(error, "ERROR", fullUrl.pathname);
	} finally {
		logger.debug("handlingApiRestRequest: END");
	}
}

const runPluginInternal = async (req: IncomingMessage, res: ServerResponse, logger: ILogger, options: UniversalApiOptionsRequired) => {
	const { config, endpointPrefix, handlers, matcher, middlewares, errorMiddlewares, delay, fullFsDir, filters, pagination, parser } = options;
	const fullUrl = Utils.request.buildFullUrl(req, config);
	const endpointNoPrefix = Utils.request.removeEndpointPrefix(fullUrl.pathname, endpointPrefix);
	let requ: UniversalApiRequest = req as UniversalApiRequest;
	try {
		logger.debug(`runPluginInternal: START request url = ${req.url}`);

		const result: HandledRequestData = {
			status: null,
			data: null,
			headers: []
		}

		if (!Utils.request.matchesEndpointPrefix(req.url, endpointPrefix)) {
			logger.info(`runPluginInternal: Request with url ${req.url} doesn't match endpointPrefix option.`);
			throw new UniversalApiError("Request doesn't match endpointPrefix", "NO_HANDLER", fullUrl.pathname);
		}
		const request = Utils.request.createRequest(req);
		requ = request;

		logger.debug(`runPluginInternal: fullUrl=${endpointNoPrefix}, endpointNoPrefix=${endpointNoPrefix}`);

		let handled = await handlingApiRestRequest(logger, matcher, fullUrl, request, res, handlers, middlewares, errorMiddlewares, delay, pagination, filters, parser, endpointPrefix, endpointNoPrefix, fullFsDir, result);
		if (handled) {
			return result;
		}

		handled = await handlingApiFsRequest(logger, fullUrl, request, res, pagination, filters, parser, null, endpointPrefix, fullFsDir, result);
		if (handled) {
			return result;
		}

		throw new UniversalApiError(`Impossible handling request with url ${fullUrl}`, "NO_HANDLER", fullUrl.pathname);
	} catch (error: any) {
		if (error instanceof UniversalApiError) {
			throw error;
		}
		logger.error("runPluginInternal: ERROR - ", error);
		throw new UniversalApiError(error, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, { requ });
	} finally {
		logger.debug(`runPluginInternal: FINISH`);
	}
}

async function handleControlFrame(frame: WebSocketFrame, connection: IWebSocketConnection, handler: UniversalApiWsHandler, logger: ILogger) {
	logger.debug(`handleControlFrame: START`);
	let result = false;
	// INFO CLOSE FRAME
	if (frame.opcode === 0x08) {
		let code = 1000;
		let reason = "";
		if (frame.payload.length >= 2) {
			if (frame.payload.length > 125) {
				logger.debug(`handleControlFrame: Close frame payload too long: ${frame.payload.length}`);
				code = 1002;
				reason = "Protocol error: close payload too long";
			} else {
				code = frame.payload.readUInt16BE(0);
				if (!Utils.ws.isValidCloseCode(code)) {
					logger.debug(`handleControlFrame: Invalid close code: ${code}`);
					code = 1002;
					reason = "Protocol error: invalid close code";
				} else if (frame.payload.length > 2) {
					const reasonBuffer = frame.payload.subarray(2);
					try {
						reason = reasonBuffer.toString('utf-8');
						// INFO Verify that the decoding did not produce replacement characters
						if (reason.includes('\uFFFD')) {
							throw new Error('Invalid UTF-8');
						}
					} catch (_) {
						logger.debug(`handleControlFrame: Invalid UTF-8 in close reason`);
						code = 1002;
						reason = "Protocol error: invalid UTF-8 in close reason";
					}
				}
			}
		} else if (frame.payload.length === 1) {
			// INFO Close frame with 1 byte is invalid (code requires 2 bytes)
			logger.debug(`handleControlFrame: Invalid close frame payload length: 1`);
			code = 1002;
			reason = "Protocol error: invalid close payload";
		}
		if (!connection.closed) {
			if (handler.onClose) {
				await handler.onClose(connection, code, reason, false);
			}
			!connection.closed && await connection.close(code, reason, false);
		}
		result = true;
	}
	// INFO PING FRAME
	if (frame.opcode === 0x09) {
		connection.resetMissedPong();
		if (handler.onPing) {
			try {
				await handler.onPing(connection, frame.payload);
			} catch (error: any) {
				logger.debug(`handleControlFrame: error in ping handler - `, error);
				if (handler.onError) {
					await handler.onError(connection, error);
				} else {
					logger.error(`handleControlFrame: error in ping handler - `, error);
					await connection.send({
						type: "error",
						message: (error as Error).message
					});
				}
			}
		} else {
			connection.pong(frame.payload);
		}
		result = true;
	}
	// INFO PONG FRAME
	if (frame.opcode === 0x0A) {
		if (handler.onPong) {
			try {
				await handler.onPong(connection, frame.payload);
			} catch (error: any) {
				logger.debug(`handleControlFrame: error in pong handler - `, error);
				if (handler.onError) {
					await handler.onError(connection, error);
				} else {
					logger.error(`handleControlFrame: error in pong handler - `, error);
					await connection.send({
						type: "error",
						message: "Pong handler error"
					});
				}
			}
		}
		result = true;
	}
	logger.debug(`handleControlFrame END`);
	return result;
}

async function validateFrame(frame: WebSocketFrame, connection: IWebSocketConnection, handler: UniversalApiWsHandler, logger: ILogger) {
	logger.debug(`validateFrame START`);
	let result = true;
	let reason = "";
	// INFO UNKNOWN OR RESERVED OPCODE
	if (frame.opcode > 0x0A || (frame.opcode >= 0x03 && frame.opcode <= 0x07)) {
		logger.debug(`validateFrame: Unknown/reserved opcode: ${frame.opcode}`);
		reason = "Protocol error: unknown opcode";
		result = false;
	}
	// INFO Check RSV2/RSV3
    if (result && (frame.rsv2 || frame.rsv3)) {
        logger.debug(`validateFrame: Invalid RSV2/RSV3 flags`);
		reason = "Protocol error: invalid RSV flags";
        result = false;
	}
	// INFO Check RSV1
    if (result && frame.rsv1 && !connection.perMessageDeflate) {
        logger.debug(`validateFrame: RSV1 set without compression extension`);
		reason = "Protocol error: unexpected RSV1";
		result = false;
	}
	if (reason !== "" && !result) {
		if (!connection.closed) {
			if (handler.onClose) {
				await handler.onClose(connection, 1002, reason, false);
			}
			!connection.closed && await connection.close(1002, reason, false);
		}
	}
	logger.debug(`validateFrame END`);
	return result;
}

async function handleResponsesMatching(connection: IWebSocketConnection, handler: UniversalApiWsHandler, message: any, logger: ILogger) {
	logger.debug(`handleResponsesMatching: START`);
	let result = false;
	if (handler.responses && handler.responses.length > 0) {
		let response: Exclude<typeof handler["responses"], undefined | null>[number] | null = null;
		let error: any = null;
		for (const resp of handler.responses) {
			try {
				if (resp.match(connection, message)) {
					response = resp;
					break;
				}
			} catch (err) {
				error = err;
			}
		}
		if (response !== null) {
			result = true;
			try {
				let responseData = response.response;
				if (typeof responseData === "function") {
					responseData = await responseData(connection, message);
				}
				if (response.broadcast) {
                    if (typeof response.broadcast === "boolean") {
                        connection.broadcastAllRooms(responseData, false);
                    } else {
                        connection.broadcast(responseData, {
                            room: response.broadcast.room,
                            includeSelf: response.broadcast.includeSelf ?? false
                        });
                    }
                } else {
                    await connection.send(responseData);
                }
			} catch (err: any) {
				logger.debug(`handleResponsesMatching: Error in handler response match execution - `, err);
				if (handler.onError) {
					await handler.onError(connection, err);
				} else {
					logger.error(`handleResponsesMatching: Error in handler response match execution - `, err);
					await connection.send({
						type: 'error',
						message: (err as Error)?.message
					});
				}
			}
		} else {
			if (error) {
				result = true;
				logger.debug(`handleResponsesMatching: Error matching response pattern - `, error);
				if (handler.onError) {
					await handler.onError(connection, error);
				} else {
					logger.error(`handleResponsesMatching: Error matching response pattern - `, error);
					await connection.send({
						type: 'error',
						message: (error as Error)?.message
					});
				}
			}
		}
	}
	logger.debug(`handleResponsesMatching: END`);
	return result;
}

async function handleDataFrame(frame: WebSocketFrame, connection: IWebSocketConnection, handler: UniversalApiWsHandler, logger: ILogger) {
	logger.debug(`handleDataFrame START`);
	try {
		const result = connection.accumulateFragment(frame);
		if (!result) {
			return;
		}
		let payload = result.payload;
		const originalOpcode = result.opcode;
		// INFO Decompression
		if (frame.rsv1) {
			try {
				payload = await connection.decompressData(result.payload);
			} catch (err: any) {
				logger.debug(`handleDataFrame: decompression error - `, err);
				if (handler.onError) {
					await handler.onError(connection, err);
				} else {
					logger.error(`handleDataFrame: decompression error - `, err);
					await connection.send({
						type: "error",
						message: (err as Error).message
					});
				}
				if (!connection.closed) {
					await connection.close(1002, 'Protocol error', false);
				}
				return;
			}
		}
		let message: any = payload;

		if (handler.transformRawData) {
			try {
				message = await handler.transformRawData(message);
			} catch (error: any) {
				logger.debug(`handleDataFrame: error transforming raw data - `, error);
				if (handler.onError) {
					await handler.onError(connection, error);
				} else {
					logger.error(`handleDataFrame: error transforming raw data - `, error);
					await connection.send({
						type: 'error',
						message: (error as Error).message
					});
				}
			}
		} else {
			const {result, message: mess} = Utils.ws.transformPayloadToMessage(payload, originalOpcode);
			if (!result) {
				logger.debug(`handleDataFrame: Unexpected opcode for data frame ${originalOpcode}`);
			} else {
				message = mess;
			}
		}
		if (handler.delay && handler.delay > 0) {
			await new Promise(resolve => setTimeout(resolve, handler.delay));
		}
		const hasMatch = await handleResponsesMatching(connection, handler, message, logger);
		if (!hasMatch && handler.onMessage) {
			try {
				await handler.onMessage(connection, message);
			} catch (err: any) {
				logger.debug(`handleDataFrame: Error in message handler - `, err);
				if (handler.onError) {
					await handler.onError(connection, err);
				} else {
					logger.error(`handleDataFrame: Error in message handler - `, err);
					await connection.send({
						type: 'error',
						message: (err as Error).message
					});
				}
			}
		}
	} finally {
		logger.debug(`handleDataFrame END`);
	}
}

async function processFrame(frame: WebSocketFrame, connection: IWebSocketConnection, handler: UniversalApiWsHandler, logger: ILogger) {
	logger.debug(`processFrame: START`);
	try {
		const handled = await handleControlFrame(frame, connection, handler, logger);
		if (handled) {
			return;
		}
		const valid = await validateFrame(frame, connection, handler, logger);
		if (!valid) {
			return;
		}
		await handleDataFrame(frame, connection, handler, logger);
	} catch (error: any) {
		logger.debug(`processFrame: ERROR - `, error);
		if (handler.onError) {
			await handler.onError(connection, error);
		} else {
			await connection.send({
				type: "error",
				message: (error as Error).message
			});
		}
		if (!connection.closed) {
			await connection.close(1011, "Internal error", false);
		}
	} finally {
		logger.debug(`processFrame: END`);
	}
}

function handlingApiWsRequest(logger: ILogger, options: UniversalApiOptionsRequired) {
	logger.debug(`handlingApiWsRequest: START`);
	const { endpointPrefix, wsHandlers, matcher } = options;
	const managers = new Map<UniversalApiWsHandler, ConnectionManager>();
	logger.debug(`handlingApiWsRequest: initialize connection managers for enabled handlers`);
	wsHandlers.forEach(handler => {
		if (!handler.disabled) {
			managers.set(handler, new ConnectionManager(logger));
		}
	});
	return async (request: IncomingMessage, socket: Socket, _: Buffer) => {
		logger.debug(`handlingApiWsRequest: new http upgraded event`);
		const url = Utils.request.buildFullUrl(request, options.config);
		const pathname = url.pathname;
		const endpointNoPrefix = Utils.request.removeEndpointPrefix(pathname, endpointPrefix);
		let handler: typeof wsHandlers[number] | null = null;
		for (const handle of wsHandlers) {
			const handlerMatched = matcher.doMatch(
				Utils.request.addSlash(handle.pattern, "leading"),
				Utils.request.addSlash(endpointNoPrefix, "leading"),
				true,
				null
			);
			if (handlerMatched) {
				if (handle.disabled) {
					logger.debug("handlingApiWsRequest: Request handler is disabled");
				} else {
					handler = handle;
					break;
				}
			}
		}
		if (handler !== null) {
			logger.debug("handlingApiWsRequest: Request handler matched");
			const clientKey = request.headers["sec-websocket-key"];
			if (!clientKey) {
				socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
				socket.destroy();
				return;
			}
			if (handler.authenticate) {
				try {
					const authenticated = await handler.authenticate(request);
					if (!authenticated) {
						socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
						socket.destroy();
						return;
					}
				} catch (err: any) {
					logger.debug("handlingApiWsRequest: Request handler authentication error: ", err);
					socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
					socket.destroy();
					return;
				}
			}
			let connection;
			try {
				const {headers, deflateOptions, subprotocol} = Utils.ws.handshake(request, clientKey, logger, handler.perMessageDeflate, handler.subprotocols);
				socket.write(headers);
				connection = new WebSocketConnection(
					logger,
					socket,
					pathname,
					managers.get(handler)!,
					deflateOptions,
					handler.perMessageDeflate,
					subprotocol
				);
			} catch (error: any) {
				if (error.message === Constants.WEB_SOCKET.PER_MESSAGE_DEFLATE_STRICT_ERROR) {
					logger.error(`handlingApiWsRequest: ERROR - plugin have strict perMessageDeflate options and client sent different options`);
					return;
				} else {
					throw error;
				}
			}
			const parser = new WebSocketFrameParser();
			logger.debug(`handlingApiWsRequest: connection established ${connection.id} on ${pathname}`);

			if (handler.defaultRoom) {
				logger.debug(`handlingApiWsRequest: join to default room ${handler.defaultRoom}`);
				connection.joinRoom(handler.defaultRoom);
			}

			if (handler.heartbeat && handler.heartbeat > 0) {
				logger.debug(`handlingApiWsRequest: heartbeat enabled`);
				connection.startHeartbeat(handler.heartbeat);
			}

			if (handler.inactivityTimeout && handler.inactivityTimeout > 0) {
				logger.debug(`handlingApiWsRequest: inactivity timeout enabled`);
				connection.startInactivityTimeout(handler.inactivityTimeout);
			}

			if (handler.onConnect) {
				try {
					await handler.onConnect(connection, request);
				} catch (error: any) {
					logger.debug(`handlingApiWsRequest: error in connect handler - `, error);
					if (handler.onError) {
						await handler.onError(connection, error);
					} else {
						logger.error("handlingApiWsRequest: error in connect handler - ", error);
						await connection.send({
							type: "error",
							message: (error as Error).message
						});
					}
					if (!connection.closed) {
						connection.close(1011, "Internal error", false);
					}
				}
			}

			const onDataSocket = async (data: Buffer) => {
				if (handler.inactivityTimeout && handler.inactivityTimeout > 0) {
					connection.resetInactivityTimer(handler.inactivityTimeout);
				}
				let frames: WebSocketFrame[] = [];
				try {
					frames = parser.parse(data);
				} catch (error: any) {
					logger.debug(`handlingApiWsRequest: error parsing frame - `, error);
					if (handler.onError) {
						await handler.onError(connection, error);
					} else {
						logger.error(`handlingApiWsRequest: error parsing frame - `, error);
						await connection.send({
							type: "error",
							message: (error as Error).message
						});
					}
					if (!connection.closed) {
						const code = 1002;
						const reason = "Protocol error";
						if (handler.onClose) {
							await handler.onClose(connection, code, reason, false);
						}
						!connection.closed && await connection.close(code, reason, false);
					}
				}

				for (const frame of frames) {
					await processFrame(frame, connection, handler, logger);
				}
			}

			const onCloseSocket = async (hadError: boolean) => {
				logger.debug(`handlingApiWsRequest: Socket closed for ${connection.id}${hadError ? ' with error' : ''}`);
				if (!connection.closed) {
					if (handler.onClose) {
						await handler.onClose(connection, hadError ? 1006 : 1000, hadError ? 'Connection closed abnormally' : "", false);
					}
					!connection.closed && await connection.close(hadError ? 1006 : 1000, hadError ? 'Connection closed abnormally' : "", false);
				}
			}

			const onErrorSocket = async (error: any) => {
				logger.error(`handlingApiWsRequest: Socket error for ${connection.id}: `, error);
				if (handler.onError) {
					await handler.onError(connection, error);
				}
				if (!connection.closed) {
					connection.forceClose();
				}
			}

			socket.on('data', onDataSocket);

			socket.on('close', onCloseSocket);

			socket.on('error', onErrorSocket);

			connection.cleanup = () => {
				socket.removeListener('data', onDataSocket);
				socket.removeListener('close', onCloseSocket);
				socket.removeListener('error', onErrorSocket);
			}
		} else {
			socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
			socket.destroy();
		}
		logger.debug(`handlingApiWsRequest: http upgraded event terminated`);
	}
}

export const runPlugin = async (req: IncomingMessage, response: ServerResponse, next: Connect.NextFunction, logger: ILogger, options: UniversalApiOptionsRequired) => {
	logger.debug(`runPlugin: START`);
	try {
		const { gatewayTimeout, errorMiddlewares, noHandledRestFsRequestsAction: noHandledRequestsAction } = options;
		const { promise, reject, resolve } = Utils.plugin.promiseWithResolver<ApiWsRestFsDataResponse>();
		let gatewayIdTimeout: NodeJS.Timeout;

		if (gatewayTimeout !== 0) {
			gatewayIdTimeout = setTimeout(() => {
				resolve({
					status: Constants.HTTP_STATUS_CODE.GATEWAY_TIMEOUT,
					readFile: false,
					isError: true,
					data: "Gateway Timeout",
					headers: [],
					req,
					errorMiddlewares
				});
			}, gatewayTimeout);
		}

		runPluginInternal(req, response, logger, options)
			.then(result => {
				clearTimeout(gatewayIdTimeout);
				const { status, data, headers } = result;
				resolve({
					status: status!,
					data,
					readFile: false,
					isError: false,
					headers
				});
			})
			.catch(async (error: UniversalApiError) => {
				clearTimeout(gatewayIdTimeout);
				const dataResponse: ApiWsRestFsDataResponse = {
					status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
					data: error.message,
					isError: true,
					readFile: false,
					headers: [],
					error,
					req: error.getExtra()?.requ ?? req,
					errorMiddlewares: errorMiddlewares
				};
				let callReject = false;
				switch (error.getType()) {
					case "NO_HANDLER":
						if (noHandledRequestsAction === "forward") {
							reject("next");
							callReject = true;
						} else {
							dataResponse.status = Constants.HTTP_STATUS_CODE.NOT_FOUND;
							dataResponse.data = dataResponse.data ?? "Not Found";
						}
						break;
					case "MANUALLY_HANDLED":
						dataResponse.data = `${error.message} Handle request not send any response`;
						break;
					case "ERROR":
						dataResponse.status = error.getCode();
						break;
					case "READ_FILE":
						dataResponse.status = Constants.HTTP_STATUS_CODE.OK;
						dataResponse.isError = false;
						dataResponse.readFile = true;
						dataResponse.headers = error.getExtra()?.headers ?? [];
						dataResponse.error = undefined;
						dataResponse.errorMiddlewares = undefined;
						break;
					case "ERROR_MIDDLEWARE":
						dataResponse.errorMiddlewares = undefined;
						dataResponse.isError = true;
						dataResponse.data = error instanceof Error ? error.message : error;
						dataResponse.status = 500;
						break;
					default:
						dataResponse.status = error.getCode();
						dataResponse.data = dataResponse.data ?? "Internal Server Error";
						break;
				}
				!callReject && resolve(dataResponse);
			});

		logger.debug(`runPlugin: awaiting runInternalPlugin execution`);
		const result = await promise;
		await Utils.response.settingResponse(logger, response, result);
	} catch (error) {
		logger.debug(`runPlugin: runInternalPlugin error`);
		if (error === "next") {
			next();
		} else {
			process.exitCode = -1;
			next(error);
		}
	} finally {
		logger.debug(`runPlugin: END`);
	}
}

export const runWsPlugin = (server: ViteDevServer | PreviewServer, logger: ILogger, options: UniversalApiOptionsRequired) => {
	logger.debug(`runWsPlugin: START`);
	const { enableWs, wsHandlers } = options;
	const httpServer = server.httpServer;
	if (!httpServer || !enableWs || httpServer && enableWs && wsHandlers.length === 0) {
		logger.debug(`runWsPlugin disabled${!httpServer ? ": no server http found" : enableWs ? ": no handler found" : ""}`);
		return;
	}
	const callback = handlingApiWsRequest(logger, options);
	httpServer.on("upgrade", callback);
	logger.debug(`runWsPlugin: END`);
}
