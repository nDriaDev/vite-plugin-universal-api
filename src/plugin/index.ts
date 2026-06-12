import { version as viteVersion, Connect, Plugin, PreviewServer, ViteDevServer } from "vite";
import { UniversalApiOptions, UniversalApiOptionsRequired } from "../models/plugin.model";
import { Logger } from "../utils/Logger";
import { Constants } from "../utils/constants";
import { Utils } from "../utils/utils";
import { IncomingMessage, ServerResponse } from "node:http";
import { runPlugin, runWsPlugin } from "../utils/plugin";

const viteMajor = parseInt(viteVersion.split('.')[0], 10);

export function universalApiPlugin(opts?: UniversalApiOptions): Plugin {
	let options: UniversalApiOptionsRequired;
	let logger: Logger;

	function printUrls(server: ViteDevServer | PreviewServer, originalPrint: (() => void) | (() => void)) {
		return function () {
			originalPrint.call(server);
			if (options.disable) {
				return;
			}

			const prefixes = options.endpointPrefix.join(", ");
			logger.info(`endpoint prefix: ${prefixes}`);

			if (options.fullFsDir) {
				logger.info(`file system API: ${options.fsDir}`);
			}

			if (options.handlers && options.handlers.length > 0) {
				const activeHandlers = options.handlers.filter(h => !h.disabled);
				if (activeHandlers.length > 0) {
					logger.info(`REST handlers (${activeHandlers.length}):`);
					for (const handler of activeHandlers) {
						const method = "method" in handler ? handler.method.padEnd(7) : "CUSTOM ";
						const handle = typeof handler.handle === "function" ? "custom" : handler.handle;
						logger.info(`  ${method} ${handler.pattern} → ${handle}`);
					}
				}
			}

			if (options.enableWs && options.wsHandlers && options.wsHandlers.length > 0) {
				const activeWsHandlers = options.wsHandlers.filter(h => !h.disabled);
				if (activeWsHandlers.length > 0) {
					logger.info(`WebSocket handlers (${activeWsHandlers.length}):`);
					for (const handler of activeWsHandlers) {
						const extras = [
							handler.heartbeat ? `heartbeat: ${handler.heartbeat}ms` : null,
							handler.inactivityTimeout ? `timeout: ${handler.inactivityTimeout}ms` : null,
							handler.defaultRoom ? `room: ${handler.defaultRoom}` : null,
						].filter(Boolean).join(", ");
						logger.info(`  WS      ${handler.pattern}${extras ? ` (${extras})` : ""}`);
					}
				}
			}
		}
	}

	/**
	 * INFO
	 * Registers the HTTP middleware and (optionally) the WebSocket handler
	 * on the given server, then returns a cleanup function.
	 */
	function setupServer(server: ViteDevServer | PreviewServer, isPreview: boolean): (() => void) {
		if (options.disable) {
			return () => { };
		}
		if (isPreview && !options.enablePreview) {
			logger.debug("Vite configurePreviewServer: disabled in preview mode");
			return () => { };
		}
		const hook = isPreview ? "configurePreviewServer" : "configureServer";
		logger.debug(
			`Vite ${hook}: START`,
			`options= ${JSON.stringify({ ...options, config: "", matcher: "" }, null, 2)}`
		);
		return () => {
			let active = true;
			const handler = (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
				if (!active) {
					return next();
				}
				return runPlugin(req, res, next, logger, options);
			};
			server.middlewares.use(handler);

			const wsCleanup = runWsPlugin(server, logger, options);

			const cleanup = () => {
				active = false;
				wsCleanup?.();
			};
			server.httpServer?.once("close", cleanup);

			server.printUrls = (function (originalPrint) {
				return printUrls(server, originalPrint);
			})(server.printUrls);
			logger.debug(`Vite ${hook}: FINISH`);
		}
	}

	return {
		name: Constants.PLUGIN_NAME,
		apply: "serve",

		async configResolved(conf) {
			options = Utils.plugin.initOptions(opts, conf);
			logger = new Logger(Constants.PLUGIN_NAME, options.logLevel);

			logger.debug("Vite configResolved: START");
			logger.info("plugin initializing ...");

			if (!options.fsDir) {
				options.fullFsDir = null;
				logger.debug("fsDir not configured, file system API disabled.");
			} else if (!(await Utils.files.isDirExists(options.fullFsDir!))) {
				options.fullFsDir = null;
				logger.debug(`Directory with path ${options.fsDir} doesn't exist, file system API disabled.`);
			}

			if (options.endpointPrefix.length === 0) {
				logger.warn("Endpoint prefix empty or invalid");
				options.disable = true;
			}

			logger.info(`plugin ${options.disable ? "disabled" : "started"}`);
			logger.debug("Vite configResolved: FINISH");

			/* v8 ignore start */
			/**
			 * The plugin writes to process.stdout / process.stderr via Logger.
			 * When the process runs in the background and the terminal session
			 * is disconnected, those streams emit EIO / EPIPE errors that would
			 * otherwise kill the process with an uncaught exception.
			 * We suppress only those two codes and re-throw everything else.
			 */
			const suppressIoError = (err: NodeJS.ErrnoException) => {
				if (err.code !== "EIO" && err.code !== "EPIPE") {
					throw err;
				}
			};
			if (process.stdout.listenerCount("error") === 0) {
				process.stdout.on("error", suppressIoError);
			}
			if (process.stderr.listenerCount("error") === 0) {
				process.stderr.on("error", suppressIoError);
			}
			/* v8 ignore stop */
		},

		configureServer(server) {
			return setupServer(server, false);
		},

		configurePreviewServer(server) {
			const cb = setupServer(server, true);
			/* v8 ignore start */
			if (viteMajor < 5) {
				if (typeof cb === 'function') {
					setImmediate(cb);
				}
				return;
			}
			/* v8 ignore stop */
			return cb;
		}
	};
}
