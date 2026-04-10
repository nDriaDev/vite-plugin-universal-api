import { IncomingMessage, ServerResponse } from "node:http";
import { Connect, PreviewServer, ViteDevServer } from "vite";
import { ApiWsRestFsDataResponse, UniversalApiRestFsHandler, UniversalApiOptionsRequired, UniversalApiRequest, HandledRequestData, UniversalApiWsHandler, UniversalApiAuthenticate } from "../models/plugin.model";
import { Utils } from "./utils";
import { join, parse } from "node:path";
import { MimeType } from "./MimeType";
import { Constants } from "./constants";
import { AntPathMatcher } from "./AntPathMatcher";
import { UniversalApiError } from "./Error";
import { ConnectionManager, WebSocketConnection, WebSocketServer } from "./WebSocket";
import { ILogger } from "../models/logger.model";
import { Socket } from "node:net";


async function checkAuthenticate(authenticate: UniversalApiAuthenticate | undefined, req: IncomingMessage): Promise<boolean> {
	if (!authenticate) return true;
	if (authenticate === true) {
		const value = req.headers["authorization"];
		return typeof value === "string" ? value.trim().length > 0 : false;
	}
	if (typeof authenticate === "string") {
		const value = req.headers[authenticate.toLowerCase()];
		return typeof value === "string" ? value.trim().length > 0 : false;
	}
	return await authenticate(req);
}

/* v8 ignore start */
/**
 * @ignore
 * Not used for now. It simulates the options http request behavior
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handlingOptionsRequest(logger: ILogger, matcher: AntPathMatcher, fullUrl: URL, request: UniversalApiRequest<any>, handlers: UniversalApiRestFsHandler[], endpointNoPrefix: string, result: HandledRequestData): boolean {
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
					allow.add(handle.method!);
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

async function handlingApiFsRequest(logger: ILogger, fullUrl: URL, request: UniversalApiRequest<any>, res: ServerResponse, paginationPlugin: UniversalApiOptionsRequired["pagination"], filtersPlugin: UniversalApiOptionsRequired["filters"], parser: UniversalApiOptionsRequired["parser"], handler: UniversalApiRestFsHandler | null, endpointPrefix: string[], fullFsDir: string | null, result: HandledRequestData): Promise<boolean> {
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
						} else {
							try {
								dataFile.data = JSON.parse(dataFile.data);
								Array.isArray(dataFile.data) && (dataFile.total = dataFile.data.length);
							} catch (_) {
								dataFile.total = 1;
							}
						}
						request.method === "GET" && (result.data = dataFile.data);
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
					let writeFile: any = -1;
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
								throw new UniversalApiError(`Error retrieving filtered and paginated data from ${file}`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
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
						// INFO partial delete allowed allowed in json file with array
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
						result.headers.push({ name: Constants.DELETED_ELEMENTS_HEADER, value: 1 });
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

async function handlingApiRestRequest(logger: ILogger, matcher: AntPathMatcher, fullUrl: URL, request: UniversalApiRequest<any>, res: ServerResponse, handlers: UniversalApiOptionsRequired["handlers"], middlewares: UniversalApiOptionsRequired["middlewares"], errorMiddlewares: UniversalApiOptionsRequired["errorMiddlewares"], delay: UniversalApiOptionsRequired["delay"], pagination: UniversalApiOptionsRequired["pagination"], filters: UniversalApiOptionsRequired["filters"], parser: UniversalApiOptionsRequired["parser"], endpointPrefix: string[], endpointNoPrefix: string, fullFsDir: string | null, result: HandledRequestData): Promise<boolean> {
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

			if (handler.authenticate) {
				try {
					const allowed = await checkAuthenticate(handler.authenticate, request);
					if (!allowed) {
						logger.debug("handlingApiRestRequest: authenticate rejected " + fullUrl.pathname);
						throw new UniversalApiError("Unauthorized", "ERROR", fullUrl.pathname, 401);
					}
				} catch (err: any) {
					if (err instanceof UniversalApiError) {
						throw err;
					}
					throw new UniversalApiError(err as Error, "ERROR", fullUrl.pathname, 500);
				}
			}

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
	let requ: UniversalApiRequest<any> = req as UniversalApiRequest<any>;
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

		logger.debug(`runPluginInternal: fullUrl=${fullUrl.pathname}, endpointNoPrefix=${endpointNoPrefix}`);

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
						dataResponse.data = `${error.message} Handled request did not send any response`;
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
	if (!httpServer || !enableWs || wsHandlers.length === 0) {
		logger.debug(`runWsPlugin disabled${!httpServer ? ": no http server found" : enableWs ? ": no handlers found" : ""}`);
		return undefined;
	}

	const managers = new Map<UniversalApiWsHandler, ConnectionManager>();
	const handlerWssMap = new Map<UniversalApiWsHandler, WebSocketServer>();

	wsHandlers.forEach(handler => {
		if (!handler.disabled) {
			managers.set(handler, new ConnectionManager(logger));
			if (handler.perMessageDeflate !== undefined || handler.subprotocols?.length) {
				handlerWssMap.set(handler, new WebSocketServer({
					noServer: true,
					...(
						handler.perMessageDeflate !== undefined
							? { perMessageDeflate: handler.perMessageDeflate }
							: {}
					),
					...(
						handler.subprotocols?.length
							? {
								handleProtocols: (protocols) => {
									for (const p of protocols) {
										if (handler.subprotocols!.includes(p)) {
											return p;
										}
									}
									return false;
								}
							}
							: {}
					)
				}));
			}
		}
	});

	const wss = new WebSocketServer({ noServer: true });

	const upgradeHandler = async (req: IncomingMessage, socket: Socket, head: NonSharedBuffer) => {
		logger.debug(`runWsPlugin: new upgrade event`);
		const url = Utils.request.buildFullUrl(req, options.config);
		const endpointNoPrefix = Utils.request.removeEndpointPrefix(url.pathname, options.endpointPrefix);

		let handler: typeof wsHandlers[number] | null = null;
		for (const handle of wsHandlers) {
			const matched = options.matcher.doMatch(
				Utils.request.addSlash(handle.pattern, "leading"),
				Utils.request.addSlash(endpointNoPrefix, "leading"),
				true,
				null
			);
			if (matched) {
				if (handle.disabled) {
					logger.debug("runWsPlugin: matched handler is disabled");
				} else {
					handler = handle;
					break;
				}
			}
		}

		if (handler === null) {
			logger.debug(`runWsPlugin: no handler for ${url.pathname}`);
			socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
			return;
		}

		const currentHandler = handler;

		if (currentHandler.authenticate) {
			try {
				const allowed = await checkAuthenticate(currentHandler.authenticate, req);
				if (!allowed) {
					logger.debug(`runWsPlugin: authenticate rejected ${url.pathname}`);
					socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
					return;
				}
			} catch (err: any) {
				logger.error(`runWsPlugin: authenticate threw for ${url.pathname} - `, err.message);
				socket.end("HTTP/1.1 500 Internal Server Error\r\n\r\n");
				return;
			}
		}

		const manager = managers.get(currentHandler)!;

		const handlerWss = handlerWssMap.get(currentHandler) ?? wss;

		handlerWss.handleUpgrade(req, socket as any, head, async (ws) => {
			logger.debug(`runWsPlugin: connection upgraded for ${url.pathname}`);
			const connection = new WebSocketConnection(
				logger,
				ws,
				url.pathname,
				manager,
				ws.protocol || undefined
			);

			if (currentHandler.defaultRoom) {
				logger.debug(`runWsPlugin: joining default room ${currentHandler.defaultRoom}`);
				connection.joinRoom(currentHandler.defaultRoom);
			}

			if (currentHandler.heartbeat && currentHandler.heartbeat > 0) {
				logger.debug(`runWsPlugin: heartbeat enabled`);
				connection.startHeartbeat(currentHandler.heartbeat);
			}

			if (currentHandler.inactivityTimeout && currentHandler.inactivityTimeout > 0) {
				logger.debug(`runWsPlugin: inactivity timeout enabled`);
				connection.startInactivityTimeout(currentHandler.inactivityTimeout);
			}

			ws.on("pong", async (data: Buffer) => {
				connection.resetMissedPong();
				if (currentHandler.onPong) {
					try {
						await currentHandler.onPong(connection, data);
					} catch (err: any) {
						logger.debug(`runWsPlugin: error in onPong handler - `, err);
						if (currentHandler.onError) {
							await currentHandler.onError(connection, err);
						} else {
							await connection.send({ type: "error", message: (err as Error).message });
						}
					}
				}
			});

			ws.on("ping", async (data: Buffer) => {
				connection.resetMissedPong();
				if (currentHandler.onPing) {
					try {
						await currentHandler.onPing(connection, data);
					} catch (err: any) {
						logger.debug(`runWsPlugin: error in onPing handler - `, err);
						if (currentHandler.onError) {
							await currentHandler.onError(connection, err);
						} else {
							await connection.send({ type: "error", message: (err as Error).message });
						}
					}
				} else {
					connection.pong(data);
				}
			});

			ws.on("message", async (rawData: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
				if (currentHandler.inactivityTimeout && currentHandler.inactivityTimeout > 0) {
					connection.resetInactivityTimer(currentHandler.inactivityTimeout);
				}

				let message: any;
				let dataBuffer: Buffer;
				if (Buffer.isBuffer(rawData)) {
					dataBuffer = rawData;
				} else if (Array.isArray(rawData)) {
					dataBuffer = Buffer.concat(rawData);
				} else {
					dataBuffer = Buffer.from(rawData);
				}

				if (currentHandler.transformRawData) {
					try {
						message = await currentHandler.transformRawData(dataBuffer);
					} catch (err: any) {
						logger.debug(`runWsPlugin: error in transformRawData - `, err);
						if (currentHandler.onError) {
							await currentHandler.onError(connection, err);
						} else {
							await connection.send({ type: "error", message: (err as Error).message });
						}
						return;
					}
				} else if (isBinary) {
					message = dataBuffer;
				} else {
					const text = dataBuffer.toString("utf8");
					try {
						message = JSON.parse(text);
					} catch {
						message = text;
					}
				}

				if (currentHandler.delay && currentHandler.delay > 0) {
					await new Promise(res => setTimeout(res, currentHandler.delay));
				}

				let matched = false;
				if (currentHandler.responses && currentHandler.responses.length > 0) {
					for (const resp of currentHandler.responses) {
						try {
							if (resp.match(connection, message)) {
								matched = true;
								try {
									let responseData = resp.response;
									if (typeof responseData === "function") {
										responseData = await responseData(connection, message);
									}
									if (resp.broadcast) {
										if (typeof resp.broadcast === "boolean") {
											connection.broadcastAllRooms(responseData, false);
										} else {
											connection.broadcast(responseData, {
												room: resp.broadcast.room,
												includeSelf: resp.broadcast.includeSelf ?? false,
											});
										}
									} else {
										await connection.send(responseData);
									}
								} catch (err: any) {
									logger.debug(`runWsPlugin: error in response handler - `, err);
									if (currentHandler.onError) {
										await currentHandler.onError(connection, err);
									} else {
										await connection.send({ type: "error", message: (err as Error).message });
									}
								}
								break;
							}
						} catch (err: any) {
							matched = true;
							logger.debug(`runWsPlugin: error matching response pattern - `, err);
							if (currentHandler.onError) {
								await currentHandler.onError(connection, err);
							} else {
								await connection.send({ type: "error", message: (err as Error).message });
							}
							break;
						}
					}
				}

				if (!matched && currentHandler.onMessage) {
					try {
						await currentHandler.onMessage(connection, message);
					} catch (err: any) {
						logger.debug(`runWsPlugin: error in onMessage handler - `, err);
						if (currentHandler.onError) {
							await currentHandler.onError(connection, err);
						} else {
							await connection.send({ type: "error", message: (err as Error).message });
						}
					}
				}
			});

			ws.on("close", async (code: number, reason: Buffer) => {
				if (!connection.closed) {
					connection.markClosed();
					if (currentHandler.onClose) {
						await currentHandler.onClose(connection, code, reason.toString() || "", true);
					}
					manager.remove(connection.id);
				}
			});

			ws.on("error", async (err: Error) => {
				logger.debug(`runWsPlugin: socket error for ${connection.id}: `, err.message);
				if (currentHandler.onError) {
					await currentHandler.onError(connection, err);
				} else {
					logger.error(`runWsPlugin: socket error for ${connection.id}: `, err.message);
				}
				if (!connection.closed) {
					connection.forceClose();
				}
			});

			if (currentHandler.onConnect) {
				try {
					await currentHandler.onConnect(connection, req);
				} catch (err: any) {
					logger.debug(`runWsPlugin: error in onConnect handler - `, err);
					if (currentHandler.onError) {
						await currentHandler.onError(connection, err);
					} else {
						await connection.send({ type: "error", message: (err as Error).message });
					}
					if (!connection.closed) {
						connection.close(1011, "Internal error");
					}
				}
			}
			logger.debug(`runWsPlugin: connection ${connection.id} fully set up`);
		});
	};

	httpServer.on("upgrade", upgradeHandler);

	logger.debug(`runWsPlugin: END`);

	return () => {
		httpServer.off("upgrade", upgradeHandler);
		wss.close();
		handlerWssMap.forEach(s => s.close());
		managers.forEach(manager => {
			manager.getAll().forEach(conn => conn.forceClose());
		});
	};
}
