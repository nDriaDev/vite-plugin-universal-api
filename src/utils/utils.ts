import { createReadStream, createWriteStream, PathLike } from "node:fs";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { IncomingMessage, ServerResponse } from "node:http";
import { ApiWsRestFsDataResponse, UniversalApiErrorMiddleware, UniversalApiRestFsHandler, UniversalApiMiddleware, UniversalApiOptions, UniversalApiOptionsRequired, UniversalApiParser, UniversalApiParserFunction, UniversalApiRequest } from "../models/index.model";
import { ResolvedConfig } from "vite";
import { AntPathMatcher } from "./AntPathMatcher";
import { join, parse as parsePath } from "node:path";
import { parse, URLSearchParams } from "node:url";
import { StringDecoder } from "node:string_decoder";
import { MimeType, MimeTypeExt } from "./MimeType";
import { Constants } from "./constants";
import { UniversalApiError } from "./Error";
import { ILogger } from "../models/logger.model";

function patchWalkPath(target: any, path: string) {
    const segments = path.split('/').filter(s => s !== '');
    let current = target;

    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
		if (!(key in current)) {
			throw new UniversalApiError("PATCH body request malformed", "MANUALLY_HANDLED", "", Constants.HTTP_STATUS_CODE.BAD_REQUEST);
		}
        current = current[key];
    }

    const lastKey = segments[segments.length - 1];
    return { parent: current, key: lastKey };
}

function patchGetValue(obj: any, path: string) {
    if (path === '' || path === '/') return obj;
    const { parent, key } = patchWalkPath(obj, path);
    return parent[key];
}

export const Utils = {
	plugin: {
		promiseWithResolver<T>() {
			let resolve!: (value: T | PromiseLike<T>) => void, reject!: (reason?: any) => void;
			const promise = new Promise<T>((res, rej) => {
				resolve = res;
				reject = rej;
			});
			return {
				promise,
				reject,
				resolve
			}
		},
        initOptions(opts: UniversalApiOptions | undefined, config: ResolvedConfig): UniversalApiOptionsRequired {
            const fullFsDir = join(config.root, opts?.fsDir ?? "");
            const endpointPrefix = opts?.endpointPrefix
                ? Array.isArray(opts.endpointPrefix) && opts.endpointPrefix.length > 0
                    ? opts.endpointPrefix.map(el => {
                        let endpoint = Utils.request.addSlash(el, "leading");
                        endpoint = Utils.request.removeSlash(endpoint, "trailing");
                        return endpoint;
                    })
                    : Array.isArray(opts.endpointPrefix) ? opts.endpointPrefix : [opts.endpointPrefix]
                : ['/api'];
            return {
                disable: opts?.disable ?? false,
                logLevel: opts?.logLevel || "info",
                delay: opts?.delay ? opts.delay : 0,
                gatewayTimeout: opts?.gatewayTimeout ?? 0,
				endpointPrefix: endpointPrefix.filter(el => el !== "" && el !== "/"),
				enableWs: opts?.enableWs ?? false,
				enablePreview: opts?.enablePreview ?? true,
                fsDir: opts?.fsDir ?? null,
                fullFsDir: fullFsDir || null,
				noHandledRestFsRequestsAction: opts?.noHandledRestFsRequestsAction ?? "404",
				parser: opts?.parser ?? true,
                middlewares: opts?.handlerMiddlewares ?? [],
                errorMiddlewares: opts?.errorMiddlewares ?? [],
                handlers: opts?.handlers ?? [],
                wsHandlers: opts?.wsHandlers ?? [],
                pagination: opts?.pagination ?? null,
                filters: opts?.filters ?? null,
                config,
                matcher: new AntPathMatcher()
            };
		},
		/* v8 ignore start */
		validatingOptions() {
			//TODO
		},
		cloneData(obj: any) {
			return typeof structuredClone === "function"
				? structuredClone(obj)
				: JSON.parse(JSON.stringify(obj));
		}
		/* v8 ignore stop */
    },
    files: {
        async isDirExists(s: PathLike) {
            try {
                return (await stat(s)).isDirectory();
            } catch (err: any) {
                if (["ENOTDIR", "ENOENT"].includes(err.code)) {
                    return false;
                }
                throw err;
            }
        },
        async createDir(s: PathLike) {
			await mkdir(s, { recursive: true });
        },
        async directoryFileList(s: PathLike, options?: { encoding: BufferEncoding | null; withFileTypes?: false | undefined; recursive?: boolean | undefined; }) {
            try {
                return await readdir(s, options);
            } catch (err: any) {
                if (err.code === 'ENOTDIR') {
                    return [];
                }
                throw err;
            }
        },
        async isFileExists(s: PathLike) {
            try {
                return (await stat(s)).isFile();
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    return false;
                }
                throw err;
            }
        },
        async readingFile(s: PathLike) {
			return await readFile(s, 'utf-8');
		},
		async readingStreamFile(s: PathLike) {
			const { promise, reject, resolve } = Utils.plugin.promiseWithResolver();
			const stream = createReadStream(s, { encoding: "utf-8" });
			let data = "";
			stream.on('data', chunk => {
				data += chunk;
			});
			stream.on('end', () => {
				resolve(data);
			});
			stream.on('error', (err: any) => {
				reject(err);
			})
			return promise;
		},
		async writingStreamFile(s: PathLike, data: any, options: Parameters<typeof createWriteStream>[1]) {
			const { promise, reject, resolve } = Utils.plugin.promiseWithResolver<void>();
			const stream = createWriteStream(s, options);
			stream.on('error', reject);
			stream.on('finish', ()=> resolve());
			stream.write(data, "utf-8");
			stream.end();
			return promise;
		},
        async writingFile(s: string, fileFound: boolean, data: any, mimeType: MimeType | null, withStream: boolean) {
			const { dir, ext } = parsePath(s);
			let file, path = s, options = {};
			if (!fileFound) {
				await Utils.files.createDir(dir);
			}
			if (!ext && mimeType != null) {
				const extFile = MimeTypeExt[mimeType];
				path += `${extFile ? extFile : typeof data === "string" ? ".txt" : ""}`;
			}
			if (mimeType != null && mimeType.toString() === MimeType[".json"] || !!ext && ext === MimeTypeExt["application/json"]) {
				file = JSON.stringify(data, null, 2);
				options = { encoding: "utf-8" };
			} else {
				if (typeof data === "object" && !Buffer.isBuffer(data)) {
					file = JSON.stringify(data, null, 2);
					options = { encoding: "utf-8" };
				} else {
					file = data;
					typeof data === "string" && (options = { encoding: "utf-8" });
				}
			}
			withStream
				? await this.writingStreamFile(path, file, options)
				: await writeFile(path, file, options);
        },
        async removeFile(s: PathLike) {
			await unlink(s);
        },
		getByteLength(data: any) {
			let value;
			try {
				value = typeof data === "string"
					? data
					: JSON.stringify(data)
			} catch (_) {
				value = data;
			}
            return Buffer.byteLength(value, "utf-8");
        },
		/* v8 ignore start */
        isDeepEqual(objA: unknown, objB: unknown, map = new WeakMap()): boolean {
            if (Object.is(objA, objB)) {
                return true;
            }

            if (objA instanceof Date && objB instanceof Date) {
                return objA.getTime() === objB.getTime();
            }
            if (objA instanceof RegExp && objB instanceof RegExp) {
                return objA.toString() === objB.toString();
            }

            if (
                typeof objA !== 'object' ||
                objA === null ||
                typeof objB !== 'object' ||
                objB === null
            ) {
                return false;
            }

            if (map.get(objA) === objB) {
                return true;
            }

            map.set(objA, objB);

            const keysA = Reflect.ownKeys(objA);
            const keysB = Reflect.ownKeys(objB);

            if (keysA.length !== keysB.length) {
                return false;
            }

            for (let i = 0; i < keysA.length; i++) {
                if (
                    !Reflect.has(objB, keysA[i]) ||
                    !this.isDeepEqual((objA as { [key: string | symbol]: unknown })[keysA[i]], (objB as { [key: string | symbol]: unknown })[keysA[i]], map)
                ) {
                    return false;
                }
            }

            return true;
		},
		/* v8 ignore stop */
		applyingPatch(data: any, patch: any, contentTypePath: "merge" | "json"): any {
			let result: any;
			if (contentTypePath === "merge") {
				// INFO RFC 7396 standard (Merge Patch)
				if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
					return patch;
				}
				const IS_DATA_OBJECT = data !== null && typeof data === "object" && !Array.isArray(data);
				result = IS_DATA_OBJECT ? { ...data } : {};
				for (const key in patch) {
					const newValue = patch[key];
					if (newValue === null) {
						delete result[key];
					} else {
						result[key] = this.applyingPatch(result[key], newValue, contentTypePath);
					}
				}
			} else {
				// INFO RFC 6902 standard (JSON Patch)
				if (!Array.isArray(patch)) {
					throw new UniversalApiError("PATCH body request malformed", "MANUALLY_HANDLED", "", Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				result = Utils.plugin.cloneData(data);
				patch.forEach(operation => {
					const { op, path, value, from } = operation;
					if (!op || !path) {
						throw new UniversalApiError("PATCH body request malformed", "MANUALLY_HANDLED", "", Constants.HTTP_STATUS_CODE.BAD_REQUEST);
					}
					switch (op) {
						case 'add': {
							const { parent, key } = patchWalkPath(result, path);
							if (Array.isArray(parent)) {
								const index = key === '-' ? parent.length : parseInt(key);
								parent.splice(index, 0, value);
							} else {
								parent[key] = value;
							}
							break;
						}
						case 'remove': {
							const { parent, key } = patchWalkPath(result, path);
							if (Array.isArray(parent)) {
								parent.splice(parseInt(key), 1);
							} else {
								if (!(key in parent)){
									throw new UniversalApiError("PATCH body request malformed", "MANUALLY_HANDLED", "", Constants.HTTP_STATUS_CODE.BAD_REQUEST);
								};
								delete parent[key];
							}
							break;
						}
						case 'replace': {
							const { parent, key } = patchWalkPath(result, path);
							if (!(key in parent)){
								throw new UniversalApiError("PATCH body request malformed", "MANUALLY_HANDLED", "", Constants.HTTP_STATUS_CODE.BAD_REQUEST);
							};
							parent[key] = value;
							break;
						}
						case 'move': {
							const val = patchGetValue(result, from);
							const { parent: fromParent, key: fromKey } = patchWalkPath(result, from);
							if (Array.isArray(fromParent)) {
								fromParent.splice(parseInt(fromKey), 1);
							} else {
								delete fromParent[fromKey];
							}
							const { parent: toParent, key: toKey } = patchWalkPath(result, path);
							if (Array.isArray(toParent)) {
								const index = toKey === '-' ? toParent.length : parseInt(toKey);
								toParent.splice(index, 0, val);
							} else {
								toParent[toKey] = val;
							}
							break;
						}
						case 'copy': {
							const val = patchGetValue(result, from);
							const { parent: toP, key: toK } = patchWalkPath(result, path);
							if (Array.isArray(toP)) {
								const idx = toK === '-' ? toP.length : parseInt(toK);
								toP.splice(idx, 0, val);
							} else {
								toP[toK] = val;
							}
							break;
						}
						default:
							throw new UniversalApiError(`PATCH operation not supported: ${op}`, "MANUALLY_HANDLED", "", Constants.HTTP_STATUS_CODE.BAD_REQUEST);
					}
				})
			}
			return result;
		}
    },
    request: {
        addSlash(url: string, type: "leading" | "trailing" | "both") {
            let newUrl = url;
            if (["both", "leading"].includes(type)) {
                !newUrl.startsWith("/") && (newUrl = "/" + newUrl);
            }
            if (["both", "trailing"].includes(type)) {
                !newUrl.endsWith("/") && (newUrl += "/");
            }
            return newUrl;
        },
        removeSlash(url: string, type: "leading" | "trailing" | "both") {
            let newUrl = url;
            if (["both", "leading"].includes(type)) {
                newUrl.startsWith("/") && (newUrl = newUrl.substring(1));
            }
            if (["both", "trailing"].includes(type)) {
                newUrl.endsWith("/") && (newUrl = newUrl.substring(0, newUrl.length - 1));
            }
            return newUrl;
        },
        buildFullUrl(req: IncomingMessage, config: ResolvedConfig): URL {
			const host = typeof config.server.host === "string"
				? config.server.host
				: req.headers.host ?? "localhost";
			return new URL(req.url!, `http${config.server.https ? 's' : ''}://${host}`);
        },
		matchesEndpointPrefix(url: string | undefined, prefixes: string[]) {
			if (url) {
				const pathname = url.split("?")[0];
				return prefixes.some(prefix =>
					pathname === prefix || pathname.startsWith(prefix + "/")
				);
			}
			return false;
        },
        removeEndpointPrefix(originalUrl: string, prefixes: string[]) {
            let url = "";
            if (originalUrl) {
                for (const prefix of prefixes) {
                    if (originalUrl.startsWith(prefix)) {
                        url = originalUrl.substring(prefix.length);
                        break;
                    }
                }
            }
            return url;
        },
        async mergeBodyChunk(req: IncomingMessage): Promise<Buffer | null> {
			const chunks: Buffer[] = [];
			let receiveData = false;
			const { promise, resolve, reject } = Utils.plugin.promiseWithResolver<Buffer | null>();

			req.on("data", (chunk: Buffer) => {
				receiveData = true;
				chunks.push(chunk);
			});

			req.on("error", () => {
				reject(new Error("Error parsing request body"));
			});

			req.on("end", () => {
				resolve(receiveData ? Buffer.concat(chunks) : null);
			});

			return promise;
		},
		createRequest(req: IncomingMessage): UniversalApiRequest<unknown> {
			const request: UniversalApiRequest<any> = req as UniversalApiRequest<any>;
			request.body = null;
			request.files = null;
			request.params = null;
			request.query = new URLSearchParams();
			return request;
		},
		async parseRequest(request: UniversalApiRequest<any>, res: ServerResponse, fullUrl: URL, parserRequest: UniversalApiParser, logger: ILogger) {
			try {
				if (parserRequest) {
					logger.debug("parseRequest: START");
					if (typeof parserRequest === "object") {
						const { promise, reject, resolve } = Utils.plugin.promiseWithResolver<any>();
						const next = (error?: any) => resolve(error);
						let parserFunc: UniversalApiParserFunction[] = [];
						if (!Array.isArray(parserRequest.parser)) {
							parserFunc.push(parserRequest.parser);
						} else {
							parserFunc = parserRequest.parser;
						}
						Promise.all(parserFunc.map(callbackfn => callbackfn(request, res, next))).then(() => resolve("done")).catch(reject);
						await promise;
						const { body, files, query } = parserRequest.transform(request);
						body != undefined && (request.body = body);
						files != undefined && (request.files = files);
						query != undefined && (request.query = query);
					} else {
						const { query } = parse(request.url!, true);
						let buildBody = false;
						let body: unknown = null,
							files: UniversalApiRequest<unknown>["files"] = null;
						const mergedChunk: Buffer | null = await this.mergeBodyChunk(request);
						const contentType = request.headers["content-type"];
						if (mergedChunk !== null) {
							if (contentType?.includes("text") || ["application/json", "application/merge-patch+json", "application/json-patch+json"].includes(contentType || "") || contentType?.includes("application/x-www-form-urlencoded")) {
								const bodyString = mergedChunk.toString("utf-8");
								buildBody = true;
								if (contentType?.includes("text")) {
									body = bodyString;
								} else if (contentType?.includes("json")) {
									try {
										body = JSON.parse(bodyString);
									} catch (_) {
										body = bodyString;
									}
								} else {
									body = Object.fromEntries(new URLSearchParams(bodyString));
								}
							} else if (contentType?.includes('multipart/form-data')) {
								body = {};
								const boundary = contentType.split("boundary=")[1];
								const boundaryStr = `--${boundary}`;
								const bodyString = mergedChunk.toString("binary");
								const trimmedBody = bodyString.trimEnd();
								const cleanBody = trimmedBody.endsWith(`${boundaryStr}--`)
									? trimmedBody.slice(0, -2)
									: bodyString;

								const rawParts: string[] = cleanBody.split(boundaryStr).filter((part: string) => part.trim() !== '');

								rawParts.forEach(part => {
									const divider = '\r\n\r\n';
									const dividerIndex = part.indexOf(divider);
									if (dividerIndex === -1) {
										return;
									}
									const headersPart = part.substring(0, dividerIndex);
									let bodyPartString = part.substring(dividerIndex + divider.length);
									bodyPartString = bodyPartString.replace(/\r\n$/, "");
									const headerLines = headersPart.trim().split("\r\n");
									const partData: Record<string, string> = {};
									headerLines.forEach(line => {
										const colonIndex = line.indexOf(": ");
										if (colonIndex !== -1) {
											const key = line.substring(0, colonIndex);
											const value = line.substring(colonIndex + 2);
											partData[key.toLowerCase()] = value;
										}
									});

									const disposition = partData["content-disposition"] || "";
									const isFile = disposition.includes("filename=");

									const partBuffer = Buffer.from(bodyPartString, "binary");
									const name = disposition.match(/name="([^"]+)"/)?.[1];
									const filename = disposition.match(/filename="([^"]+)"/)?.[1];
									const partContentType = partData["content-type"] || "";
									let finalContent: any = partBuffer;
									// INFO JSON file are writed as JSON, text as string
									if (partContentType.includes("application/json")) {
										try {
											finalContent = JSON.parse(partBuffer.toString("utf-8").trim());
										} catch (_) {
											finalContent = partBuffer.toString("utf-8");
										}
									} else if (partContentType.includes("text/") || !isFile) {
										finalContent = partBuffer.toString("utf-8");
									}
									if (isFile) {
										!files && (files = []);
										files.push({
											name: filename!,
											content: finalContent,
											contentType: partContentType || "application/octet-stream"
										});
									} else {
										(body as Record<string, any>)[name ?? ''] = finalContent;
										buildBody = true;
									}
								});
							} else {
								let parsed;
								buildBody = true;
								try {
									parsed = mergedChunk.toString("utf-8");
									body = JSON.parse(parsed.trim());
								} catch (_) {
									body = parsed ?? mergedChunk;
								}
							}
						}
						request.query = new URLSearchParams();
						if (query) {
							Object.entries(query).forEach(([key, value]) => {
								request.query.append(key, Array.isArray(value) ? value.join(",") : value ?? '');
							});
						}
						request.body = buildBody ? body : null;
						request.files = files;
					}
				} else {
					logger.debug("parseRequest: parsing disabled");
				}
			} catch (error: any) {
				logger.debug("parseRequest: ERROR - ", error);
				throw new UniversalApiError("Error parsing request", "ERROR", fullUrl.pathname);
			} finally {
				!!parserRequest && logger.debug("parseRequest: END");
			}
        },
        MiddlewaresChain() {
            const middlewares: UniversalApiMiddleware[] = [];
            const errorMiddlewares: UniversalApiErrorMiddleware[] = [];

            function use(m: UniversalApiMiddleware[], me: UniversalApiErrorMiddleware[]) {
				middlewares.push(...m.filter(m => m !== null));
				errorMiddlewares.push(...me.filter(me => me !== null));
			}

			async function handle(req: UniversalApiRequest<any>, res: ServerResponse, error?: any) {
				let mIdx = 0,
					emIdx = 0,
					lastError: any = null;

				async function next(err?: any) {
					if (err && emIdx >= errorMiddlewares.length) {
						lastError = err;
						return;
					}
					if (!err && mIdx >= middlewares.length) {
						return;
					}
					try {
						if (err) {
							lastError = err;
							const handler = errorMiddlewares[emIdx++];
							await handler(err, req, res, next);
						} else {
							const handler = middlewares[mIdx++];
							await handler(req, res, next);
						}
					} catch (error) {
						await next(error);
					}
				}
				try {
					await next(error);
					if (lastError && !res.writableEnded) {
						throw lastError;
					}
				} catch (finalError: any) {
					throw new UniversalApiError(finalError, "ERROR_MIDDLEWARE", "", Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
				}
			}

			async function handleError(req: UniversalApiRequest<any>, res: ServerResponse, error: any, errorMiddlewares: UniversalApiErrorMiddleware[]) {
				use([], errorMiddlewares);
				await handle(req, res, error);
			}

            return {
				handle,
				handleError,
                use
            };
		},
		hasPaginationOrFilters(method: UniversalApiRequest<any>["method"], paginationPlugin: UniversalApiOptionsRequired["pagination"], filterPlugin: UniversalApiOptionsRequired["filters"], paginationHandler: UniversalApiRestFsHandler["pagination"], filtersHandler: UniversalApiRestFsHandler["filters"]) {
			return (!!paginationHandler && paginationHandler !== "none")
				|| (!!filtersHandler && filtersHandler !== null)
				|| (paginationPlugin !== null && (method! in paginationPlugin || "ALL" in paginationPlugin))
				|| (filterPlugin !== null && (method! in filterPlugin || "ALL" in filterPlugin))
		},
        getPaginationAndFilters(request: UniversalApiRequest<any>, paginationHandler: UniversalApiRestFsHandler["pagination"], filtersHandler: UniversalApiRestFsHandler["filters"], paginationPlugin: UniversalApiOptions["pagination"], filtersPlugin: UniversalApiOptions["filters"]): { pagination: null | { limit: null | number, skip: null | number, sort: null | string, order: null | string }, filters: null | { key: string, value: any, comparison: string, regexFlags?: string }[] } {
            const result: { pagination: null | { limit: null | number, skip: null | number, sort: null | string, order: null | string }, filters: null | { key: string, value: any, comparison: string, regexFlags?: string }[] } = {
                pagination: null,
				filters: null
            }
            let pagPlugin: typeof result.pagination = null;
            let filtPlugin: typeof result.filters = null;
            if (!!paginationPlugin && (request.method! in paginationPlugin || "ALL" in paginationPlugin && ["HEAD", "GET", "POST", "DELETE"].includes(request.method!))) {
                const pag = request.method! in paginationPlugin
                    ? paginationPlugin[request.method! as keyof typeof paginationPlugin]
					: paginationPlugin.ALL;
				const limit = pag?.limit
					? pag.type === "query-param"
						? request.query.get(pag.limit) !== null
							? Number(request.query.get(pag.limit))
							: null
						: pag?.root && pag.root in request.body
							? pag.limit && pag.limit in request.body[pag.root]
								? request.body[pag.root][pag.limit]
									? Number(request.body[pag.root][pag.limit])
									: null
								: null
							: pag?.limit && pag.limit in request.body
								? request.body[pag.limit]
									? Number(request.body[pag.limit])
									: null
								: null
					: null;
				const skip = pag?.skip
					? pag.type === "query-param"
						? request.query.get(pag.skip) !== null
							? Number(request.query.get(pag.skip))
							: null
						: pag?.root && pag.root in request.body
							? pag.skip && pag.skip in request.body[pag.root]
								? request.body[pag.root][pag.skip]
									? Number(request.body[pag.root][pag.skip])
									: null
								: null
							: pag?.skip && pag.skip in request.body
								? request.body[pag.skip]
									? Number(request.body[pag.skip])
									: null
								: null
					: null;
				const order = pag?.order
					? pag.type === "query-param"
						? request.query.get(pag.order) !== null
							? request.query.get(pag.order)
							: null
						: pag?.root && pag.root in request.body
							? pag.order && pag.order in request.body[pag.root]
								? request.body[pag.root][pag.order]
									? request.body[pag.root][pag.order]
									: null
								: null
							: pag?.order && pag.order in request.body
								? request.body[pag.order]
									? request.body[pag.order]
									: null
								: null
					: null;
				const sort = pag?.sort
					? pag.type === "query-param"
						? request.query.get(pag.sort) !== null
							? request.query.get(pag.sort)
							: null
						: pag?.root && pag.root in request.body
							? pag.sort && pag.sort in request.body[pag.root]
								? request.body[pag.root][pag.sort]
									? request.body[pag.root][pag.sort]
									: null
								: null
							: pag?.sort && pag.sort in request.body
								? request.body[pag.sort]
									? request.body[pag.sort]
									: null
								: null
					: null;
				if ([limit, skip, sort, order].some(el => el !== null)) {
					pagPlugin = {
						limit,
						skip,
						sort,
						order
					}
				}
            }
            if (!!filtersPlugin && (request.method! in filtersPlugin || "ALL" in filtersPlugin && ["HEAD", "GET", "POST", "DELETE"].includes(request.method!))) {
                const filts = request.method! in filtersPlugin
                    ? filtersPlugin[request.method! as keyof typeof filtersPlugin]
					: filtersPlugin.ALL;
                filts && filts.filters.forEach(filt => {
                    let value: any = filts.type === "query-param"
                        ? request.query.get(filt.key)
                        : filts.root && filts.root in request.body
                            ? filt.key in request.body[filts.root]
                                ? request.body[filts.root][filt.key]
                                : null
                            : filt.key in request.body
                                ? request.body[filt.key]
                                : null
                        ;
                    if (value != null) {
                        if (typeof filt.valueType === "string") {
                            switch (filt.valueType) {
                                case "string":
                                    break;
                                case "boolean":
                                    value = !["false", "0", false].includes(value);
                                    break;
                                case "number":
                                    value = Number(value);
                                    break;
                                case "date":
                                    value = new Date(value);
                                    break;
                                case "string[]":
                                    value = value.split(",");
                                    break;
                                case "boolean[]":
                                    value = value.split(",").map((el: string) => !["false", "0"].includes(el));
                                    break;
                                case "number[]":
                                    value = value.split(",").map((el: string) => Number(el));
                                    break;
                                case "date[]":
                                    value = value.split(",").map((el: string) => new Date(el));
                                    break;
                            }
                        } else {
                            value = filt.valueType(value);
						}
						filtPlugin === null && (filtPlugin = []);
                        filtPlugin!.push({
                            key: `${filts.root ? filts.root + "." : ""}${filt.key}`,
                            value,
                            comparison: filt.comparison,
                            ...(filt.regexFlags ? { regexFlags: filt.regexFlags } : {})
                        });
                    }
                });
			}
			if (paginationHandler !== "none") {
				if (paginationHandler) {
					const exclIncl = paginationHandler.exclusive ? "exclusive" : "inclusive";
					const limit = paginationHandler[exclIncl]?.limit
						? paginationHandler[exclIncl].type === "query-param"
							? request.query.get(paginationHandler[exclIncl].limit) !== null
								? Number(request.query.get(paginationHandler[exclIncl].limit))
								: null
							: paginationHandler[exclIncl]?.root && paginationHandler[exclIncl].root in request.body
								? paginationHandler[exclIncl].limit && paginationHandler[exclIncl].limit in request.body[paginationHandler[exclIncl].root]
									? request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].limit]
										? Number(request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].limit])
										: null
									: null
								: paginationHandler[exclIncl]?.limit && paginationHandler[exclIncl].limit in request.body
									? request.body[paginationHandler[exclIncl].limit]
										? Number(request.body[paginationHandler[exclIncl].limit])
										: null
									: null
						: null;
					const skip = paginationHandler[exclIncl]?.skip
						? paginationHandler[exclIncl].type === "query-param"
							? request.query.get(paginationHandler[exclIncl].skip) !== null
								? Number(request.query.get(paginationHandler[exclIncl].skip))
								: null
							: paginationHandler[exclIncl]?.root && paginationHandler[exclIncl].root in request.body
								? paginationHandler[exclIncl].skip && paginationHandler[exclIncl].skip in request.body[paginationHandler[exclIncl].root]
									? request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].skip]
										? Number(request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].skip])
										: null
									: null
								: paginationHandler[exclIncl]?.skip && paginationHandler[exclIncl].skip in request.body
									? request.body[paginationHandler[exclIncl].skip]
										? Number(request.body[paginationHandler[exclIncl].skip])
										: null
									: null
						: null;
					const order = paginationHandler[exclIncl]?.order
						? paginationHandler[exclIncl].type === "query-param"
							? request.query.get(paginationHandler[exclIncl].order) !== null
								? request.query.get(paginationHandler[exclIncl].order)
								: null
							: paginationHandler[exclIncl]?.root && paginationHandler[exclIncl].root in request.body
								? paginationHandler[exclIncl].order && paginationHandler[exclIncl].order in request.body[paginationHandler[exclIncl].root]
									? request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].order]
										? request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].order]
										: null
									: null
								: paginationHandler[exclIncl]?.order && paginationHandler[exclIncl].order in request.body
									? request.body[paginationHandler[exclIncl].order]
										? request.body[paginationHandler[exclIncl].order]
										: null
									: null
						: null;
					const sort = paginationHandler[exclIncl]?.sort
						? paginationHandler[exclIncl].type === "query-param"
							? request.query.get(paginationHandler[exclIncl].sort) !== null
								? request.query.get(paginationHandler[exclIncl].sort)
								: null
							: paginationHandler[exclIncl]?.root && paginationHandler[exclIncl].root in request.body
								? paginationHandler[exclIncl].sort && paginationHandler[exclIncl].sort in request.body[paginationHandler[exclIncl].root]
									? request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].sort]
										? request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].sort]
										: null
									: null
								: paginationHandler[exclIncl]?.sort && paginationHandler[exclIncl].sort in request.body
									? request.body[paginationHandler[exclIncl].sort]
										? request.body[paginationHandler[exclIncl].sort]
										: null
									: null
						: null;
					if (paginationHandler.inclusive) {
						pagPlugin != null && (
							result.pagination = {
								...pagPlugin
							}
						);
					}
					if ([limit, skip, order, sort].some(el => el !== null)) {
						if (result.pagination !== null) {
							limit !== null && (result.pagination.limit = limit);
							skip !== null && (result.pagination.skip = skip);
							order !== null && (result.pagination.order = order);
							sort !== null && (result.pagination.sort = sort);
						} else {
							result.pagination = {
								limit,
								skip,
								sort,
								order
							};
						}
					}
				} else {
					pagPlugin != null && (result.pagination = pagPlugin);
				}
			}

            if (filtersHandler !== "none") {
				if (filtersHandler) {
					const exclIncl = filtersHandler.exclusive ? "exclusive" : "inclusive" as keyof typeof filtersHandler;
					const filters: typeof result.filters = [];
					filtersHandler[exclIncl]?.filters.forEach(filt => {
						let value: any = filtersHandler[exclIncl]?.type === "query-param"
							? request.query.get(filt.key)
							: filtersHandler[exclIncl]?.root && filtersHandler[exclIncl].root in request.body
								? filt.key in request.body[filtersHandler[exclIncl].root]
									? request.body[filtersHandler[exclIncl].root][filt.key]
									: null
								: filt.key in request.body
									? request.body[filt.key]
									: null
							;
						if (value != null) {
							if (typeof filt.valueType === "string") {
								switch (filt.valueType) {
									case "string":
										break;
									case "boolean":
										value = !["false", "0", false].includes(value);
										break;
									case "number":
										value = Number(value);
										break;
									case "date":
										value = new Date(value);
										break;
									case "string[]":
										value = value.split(",");
										break;
									case "boolean[]":
										value = value.split(",").map((el: string) => !["false", "0"].includes(el));
										break;
									case "number[]":
										value = value.split(",").map((el: string) => Number(el));
										break;
									case "date[]":
										value = value.split(",").map((el: string) => new Date(el));
										break;
								}
							} else {
								value = filt.valueType(value);
							}
							filters!.push({
								key: `${filtersHandler[exclIncl]?.root ? filtersHandler[exclIncl].root + "." : ""}${filt.key}`,
								value,
								comparison: filt.comparison,
								...(filt.regexFlags ? {regexFlags: filt.regexFlags} : {})
							});
						}
					});
					if (filtersHandler.inclusive) {
						filtPlugin != null && (result.filters = [...filtPlugin]);
					}
					result.filters = [
						...(result.filters != null ? result.filters : []),
						...filters
					];
				} else {
					filtPlugin !== null && (result.filters = filtPlugin);
				}
            }
            return result;
		},
		applyPaginationAndFilters(request: UniversalApiRequest<any>, paginationHandler: UniversalApiRestFsHandler["pagination"], filtersHandler: UniversalApiRestFsHandler["filters"], paginationPlugin: UniversalApiOptions["pagination"], filtersPlugin: UniversalApiOptions["filters"], dataFile: { originalData: any, data: any, mimeType: string, total: number}) {
			const data = JSON.parse(dataFile.data);
			dataFile.originalData = JSON.parse(dataFile.data);
			dataFile.data = data;
			const IS_ARRAY = Array.isArray(dataFile.data);
			if (![null, undefined].includes(dataFile.data)) {
				const { pagination, filters } = this.getPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin);
				if (filters !== null) {
					dataFile.data = (IS_ARRAY ? dataFile.data as any[] : [dataFile.data]).filter(el => {
						return filters.every(filter => {
							let value = null;
							if (filter.key.includes(".")) {
								const keySplitted = filter.key.split(".");
								value = keySplitted.reduce((acc, key) => (acc && typeof acc === 'object' && acc.hasOwnProperty(key)) ? acc[key] : undefined, el);
							} else {
								value = el.hasOwnProperty(filter.key) ? el[filter.key] : undefined;
							}
							let result;
							switch (filter.comparison) {
								case "eq":
									result = value === filter.value;
									break;
								case "ne":
									result = value !== filter.value;
									break;
								case "in":
									result = Array.isArray(value)
										? Array.isArray(filter.value)
											? filter.value.every(el => value.includes(el))
											: value.includes(filter.value)
										: Array.isArray(filter.value)
											? filter.value.includes(value)
											: filter.value === value;
									break;
								case "nin":
									result = Array.isArray(value)
										? Array.isArray(filter.value)
											? filter.value.every(el => !value.includes(el))
											: !value.includes(filter.value)
										: Array.isArray(filter.value)
											? !filter.value.includes(value)
											: filter.value !== value;
									break;
								case "lt":
									result = value < filter.value;
									break;
								case "lte":
									result = value <= filter.value;
									break;
								case "gt":
									result = value > filter.value;
									break;
								case "gte":
									result = value >= filter.value;
									break;
								case "regex":
									result = RegExp(filter.value, filter.regexFlags || "").test(String(value))
									break;
							}
							return result;
						});
					});
				}
				if (pagination !== null && Array.isArray(dataFile.data)) {
					if (pagination.sort !== null && pagination.order !== null) {
						if (!["ASC", "DESC", "1", "-1", "true", "false"].includes(pagination.order)) {
							throw new UniversalApiError("Error parsing pagination request", "MANUALLY_HANDLED", "", Constants.HTTP_STATUS_CODE.BAD_REQUEST);
						}
						dataFile.data = dataFile.data.sort((a: any, b: any) => {
							return ["ASC", "1", "true"].includes(pagination.order!)
								? Reflect.get(a, pagination.sort as keyof typeof a) > Reflect.get(b, pagination.sort as keyof typeof b)
									? 1
									: Reflect.get(a, pagination.sort as keyof typeof a) < Reflect.get(b, pagination.sort as keyof typeof b)
										? -1
										: 0
								: Reflect.get(a, pagination.sort as keyof typeof a) < Reflect.get(b, pagination.sort as keyof typeof b)
									? 1
									: Reflect.get(a, pagination.sort as keyof typeof a) > Reflect.get(b, pagination.sort as keyof typeof b)
										? -1
										: 0
						});
					}
					const start = pagination.skip ?? undefined;
					const end = pagination.limit !== null
						? (pagination.limit + (pagination.skip ?? 0))
						: undefined;
					dataFile.data = dataFile.data.slice(start, end);
				}
				!IS_ARRAY && (dataFile.data = dataFile.data.length > 0 ? dataFile.data[0] : null);
			}
			dataFile.total = Array.isArray(dataFile.data) ? dataFile.data.length : dataFile.data === null ? 0 : 1;
		},
        getCleanBody(requestMethod: string | undefined, body: any, paginationHandler: UniversalApiRestFsHandler["pagination"], filtersHandler: UniversalApiRestFsHandler["filters"], paginationPlugin: UniversalApiOptions["pagination"], filtersPlugin: UniversalApiOptions["filters"]): any {
            // INFO This method is only used when the request body is present and is of type JSON.
			if (Array.isArray(body)) {
                let newBody: any = [];
                body.forEach(elem => {
                    const keys = Reflect.ownKeys(elem);
					const keysToExclude = [];
					const IS_PAG_EXCLUSIVE = paginationHandler && paginationHandler !== "none" && "exclusive" in paginationHandler && paginationHandler.exclusive?.type === "body";
					const IS_FILT_EXCLUSIVE = filtersHandler && filtersHandler !== "none" && "exclusive" in filtersHandler && filtersHandler.exclusive?.type === "body";
                    if (paginationHandler && paginationHandler !== "none" && (paginationHandler?.exclusive || paginationHandler?.inclusive)?.type === "body") {
						const exclIncl = paginationHandler?.exclusive ? "exclusive" : "inclusive";
						paginationHandler[exclIncl]?.root && paginationHandler[exclIncl].root in elem && keysToExclude.push(paginationHandler[exclIncl].root);
						!paginationHandler[exclIncl]?.root && paginationHandler[exclIncl]?.limit && paginationHandler[exclIncl].limit in elem && keysToExclude.push(paginationHandler[exclIncl].limit);
						!paginationHandler[exclIncl]?.root && paginationHandler[exclIncl]?.skip && paginationHandler[exclIncl].skip in elem && keysToExclude.push(paginationHandler[exclIncl].skip);
						!paginationHandler[exclIncl]?.root && paginationHandler[exclIncl]?.sort && paginationHandler[exclIncl].sort in elem && keysToExclude.push(paginationHandler[exclIncl].sort);
						!paginationHandler[exclIncl]?.root && paginationHandler[exclIncl]?.order && paginationHandler[exclIncl].order in elem && keysToExclude.push(paginationHandler[exclIncl].order);
                    }
                    if (!IS_PAG_EXCLUSIVE && paginationPlugin && (paginationPlugin[requestMethod! as keyof typeof paginationPlugin] || paginationPlugin.ALL && ["HEAD", "GET", "POST", "DELETE"].includes(requestMethod!))) {
                        const pag = requestMethod && requestMethod in paginationPlugin ? paginationPlugin[requestMethod as keyof typeof paginationPlugin] : paginationPlugin.ALL;
                        if (pag?.type === "body") {
                            pag.root && pag.root in elem && keysToExclude.push(pag.root);
                            !pag.root && pag.limit && pag.limit in elem && keysToExclude.push(pag.limit);
                            !pag.root && pag.skip && pag.skip in elem && keysToExclude.push(pag.skip);
                            !pag.root && pag.sort && pag.sort in elem && keysToExclude.push(pag.sort);
                            !pag.root && pag.order && pag.order in elem && keysToExclude.push(pag.order);
                        }
                    }
                    if (filtersHandler && filtersHandler !== "none" && ((filtersHandler?.exclusive || filtersHandler?.inclusive)?.filters || []).length > 0) {
						const filters = (filtersHandler.inclusive || filtersHandler.exclusive);
						filters && filters.filters.forEach(filter => {
                            if (filters.type === "body") {
                                filters.root && filters.root in elem && keysToExclude.push(filters.root);
                                !filters.root && filter.key && filter.key in elem && keysToExclude.push(filter.key);
                            }
                        })
                    }
                    if (!IS_FILT_EXCLUSIVE && filtersPlugin && (filtersPlugin[requestMethod! as keyof typeof filtersPlugin] || filtersPlugin.ALL && ["HEAD", "GET", "POST", "DELETE"].includes(requestMethod!))) {
						const filters = (filtersPlugin[requestMethod! as keyof typeof filtersPlugin] || filtersPlugin.ALL);
						filters && filters.filters.forEach(filter => {
                            if (filters.type === "body") {
                                filters.root && filters.root in elem && keysToExclude.push(filters.root);
                                !filters.root && filter.key && filter.key in elem && keysToExclude.push(filter.key);
                            }
                        })
                    }
                    const newElem = {};
                    for (const key of keys) {
                        !keysToExclude.includes(key as string) && Reflect.set(newElem, key, Reflect.get(elem, key));
                    }
                    Reflect.ownKeys(newElem).length > 0 && newBody.push(newElem);
                });
                newBody.length === 0 && (newBody = null);
                return newBody;
            }
            if (typeof body === "object") {
                let newBody: any = {};
                const keys = Reflect.ownKeys(body);
                const keysToExclude = [];
                if (paginationHandler && paginationHandler !== "none" && (paginationHandler?.exclusive || paginationHandler?.inclusive)?.type === "body") {
                    const exclIncl = paginationHandler["exclusive" ] || paginationHandler["inclusive"];
                    exclIncl?.root && exclIncl?.root in body && keysToExclude.push(exclIncl?.root);
                    !exclIncl?.root && exclIncl?.limit && exclIncl?.limit in body && keysToExclude.push(exclIncl?.limit);
                    !exclIncl?.root && exclIncl?.skip && exclIncl?.skip in body && keysToExclude.push(exclIncl?.skip);
                    !exclIncl?.root && exclIncl?.sort && exclIncl?.sort in body && keysToExclude.push(exclIncl?.sort);
                    !exclIncl?.root && exclIncl?.order && exclIncl?.order in body && keysToExclude.push(exclIncl?.order);
                }
                if (paginationPlugin && (paginationPlugin[requestMethod! as keyof typeof paginationPlugin] || paginationPlugin.ALL && ["HEAD", "GET", "POST", "DELETE"].includes(requestMethod!))) {
                    const pag = requestMethod && requestMethod in paginationPlugin ? paginationPlugin[requestMethod as keyof typeof paginationPlugin] : paginationPlugin.ALL;
                    if (pag?.type === "body") {
                        pag.root && pag.root in body && keysToExclude.push(pag.root);
                        !pag.root && pag.limit && pag.limit in body && keysToExclude.push(pag.limit);
                        !pag.root && pag.skip && pag.skip in body && keysToExclude.push(pag.skip);
                        !pag.root && pag.sort && pag.sort in body && keysToExclude.push(pag.sort);
                        !pag.root && pag.order && pag.order in body && keysToExclude.push(pag.order);
                    }
                }
                if (filtersHandler && filtersHandler !== "none" && ((filtersHandler?.exclusive || filtersHandler?.inclusive)?.filters || []).length > 0) {
					const filters = (filtersHandler.inclusive || filtersHandler.exclusive);
					filters && filters.filters.forEach(filter => {
                        if (filters.type === "body") {
                            filters.root && filters.root in body && keysToExclude.push(filters.root);
                            !filters.root && filter.key && filter.key in body && keysToExclude.push(filter.key);
                        }
                    })
                }
                if (filtersPlugin && (filtersPlugin[requestMethod! as keyof typeof filtersPlugin] || filtersPlugin.ALL && ["HEAD", "GET", "POST", "DELETE"].includes(requestMethod!))) {
					const filters = (filtersPlugin[requestMethod! as keyof typeof filtersPlugin] || filtersPlugin.ALL);
					filters && filters.filters.forEach(filter => {
                        if (filters.type === "body") {
                            filters.root && filters.root in body && keysToExclude.push(filters.root);
                            !filters.root && filter.key && filter.key in body && keysToExclude.push(filter.key);
                        }
                    })
                }
                for (const key of keys) {
                    !keysToExclude.includes(key as string) && Reflect.set(newBody, key, Reflect.get(body, key));
                }
                Reflect.ownKeys(newBody).length === 0 && (newBody = null);
                return newBody;
            }
		},
		/* v8 ignore start */
		getBodyOtherData(originalBody: any, bodyClean: any, contentType: string) {
			if (contentType !== MimeType[".json"]) {
				return originalBody;
			}
			if (!originalBody || Array.isArray(originalBody) && originalBody.length === 0 || typeof originalBody === "object" && Reflect.ownKeys(originalBody).length === 0) {
				return null;
			}
			const cleanBodyKeys = Reflect.ownKeys(bodyClean);
			const originalBodyKeys = Reflect.ownKeys(originalBody);
			const otherDataBody = {};
			originalBodyKeys.forEach(key => {
				!cleanBodyKeys.includes(key) && Reflect.set(otherDataBody, key, Reflect.get(originalBody, key));
			})
			return otherDataBody;
		},
		/* v8 ignore stop */
		isBodyJson(body: any): boolean {
			if (typeof body === "string") {
				try {
					JSON.parse(body);
					return true;
				} catch (_) {
					return false;
				}
			}
			return body !== null && body !== undefined && (Array.isArray(body) || typeof body === 'object');
		}
    },
	response: {
		NO_RESPONSE: Symbol("NO_RESPONSE"),
		async sendStreamFile(res: ServerResponse, data: ApiWsRestFsDataResponse) {
			const { promise, reject, resolve } = Utils.plugin.promiseWithResolver<void>();
			const { size } = await stat(data.data);
			data.headers.push({ name: "content-length", value: size });
			res.statusCode = data.status;
			data.headers.forEach(({ name, value }) => res.setHeader(name, value));
			const stream = createReadStream(data.data);
			stream.on('error', (err) => {
				data.status = 500;
				reject(err);
			});
			res.on('error', (err) => {
				data.status = 500;
				reject(err);
			});
			res.on('finish', () => {
				resolve();
			});
			stream.pipe(res);
			return promise;
		},
        async settingResponse(logger: ILogger, res: ServerResponse, data: ApiWsRestFsDataResponse) {
			logger.debug(`settingResponse: START`);
			try {
				const { promise, reject, resolve } = Utils.plugin.promiseWithResolver();
				function callbackErrorWritingResponse(error: Error | null | undefined) {
					try {
						if (error instanceof Error) {
							logger.debug(`settingResponse: ERROR - failed to write response `, error as any);
							res.statusCode = Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
							res.write(JSON.stringify({
								status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
								error: Object.entries(Constants.HTTP_STATUS_CODE).find(el => el[1] === responseData.status)?.[0] ?? "Internal Server Error",
								message: "Error writing response",
								path: "",
								timestamp: new Date().toISOString()
							}));
						}
						!res.writableEnded && res.end();
						resolve(null);
					} catch (error) {
						reject(error);
					}
				}
				let responseData = data;
				if (responseData.isError && responseData.errorMiddlewares && Array.isArray(responseData.errorMiddlewares) && responseData.errorMiddlewares.length > 0) {
					logger.debug(`settingResponse: errorMiddlewares founded.`);
					const chain = Utils.request.MiddlewaresChain();
					try {
						await chain.handleError(responseData.req as UniversalApiRequest<any>, res, responseData.error, responseData.errorMiddlewares);
						return Promise.resolve(null);
					} catch (error: any) {
						logger.error(`settingResponse: ERROR - failed to evalute errorMiddlewares. Original error`, error);
						responseData = {
							status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
							data: `${(error as Error)?.message ?? "Internal Server Error"}`,
							isError: true,
							readFile: false,
							error: responseData.error,
							headers: responseData.headers
						};
					}
				}
				if (!responseData.isError) {
					if (typeof responseData.data !== "string") {
						try {
							if ([null, undefined].includes(responseData.data)) {
								responseData.data = this.NO_RESPONSE;
								responseData.headers = [
									...responseData.headers,
									{"name": "content-length", value: 0}
								]
							} else {
								responseData.data = JSON.stringify(responseData.data);
							}
						} catch (error: any) {
							logger.error(`settingResponse: ERROR - failed to parse body response.`, error);
							responseData = {
								...responseData,
								status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
								data: "Error parsing body response",
								isError: true,
								error: new UniversalApiError(error as Error, "ERROR", responseData.error?.getPath() ?? "", Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR),
							}
						}
					}
					if (responseData.readFile) {
						try {
							if (responseData.req?.method === "HEAD") {
								const { size } = await stat(responseData.data);
								const { ext } = parsePath(responseData.data);
								responseData.headers.push(...[
									{ name: "content-type", value: ext in MimeType ? MimeType[ext as keyof typeof MimeType] : MimeType[".bin"] },
									{ name: "content-length", value: size }
								]);
							} else {
								await this.sendStreamFile(res, responseData);
							}
						} catch (error: any) {
							logger.error(`settingResponse: ERROR - failed to send stream data.`, error);
							responseData = {
								status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
								data: `Failed to send stream data`,
								isError: true,
								readFile: false,
								error: responseData.error,
								headers: responseData.headers
							};
						}
					}
				}
				if (res.writableEnded) {
					return Promise.resolve(null);
				}
				res.statusCode = responseData.status;
				if (responseData.isError) {
					responseData.headers.forEach(({ name }) => {
						res.removeHeader(name);
					});
					res.setHeader("content-type", MimeType[".json"]);
					res.write(
						JSON.stringify({
							status: responseData.status,
							error: Object.entries(Constants.HTTP_STATUS_CODE).find(el => el[1] === responseData.status)?.[0] ?? "Internal Server Error",
							message: responseData.data ?? responseData.error?.message ?? "",
							path: responseData.error?.getPath() ?? "",
							timestamp: new Date().toISOString()
						}),
						callbackErrorWritingResponse
					);
				} else {
					responseData.headers.forEach(({ name, value }) => {
						res.setHeader(name, value);
					});
					if (responseData.data !== this.NO_RESPONSE) {
						res.write(responseData.data, callbackErrorWritingResponse);
					} else {
						!res.writableEnded && res.end();
						resolve(null);
					}
				}
				return await promise;
			} finally {
				logger.debug(`settingResponse: END`);
			}
        }
	}
}
