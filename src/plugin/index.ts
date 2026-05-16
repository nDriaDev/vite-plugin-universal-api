import { Connect, HttpServer, Plugin, PreviewServer, ViteDevServer } from "vite";
import { UniversalApiOptions, UniversalApiOptionsRequired } from "../models/plugin.model";
import { Logger } from "../utils/Logger";
import { Constants } from "../utils/constants";
import { Utils } from "../utils/utils";
import { IncomingMessage, ServerResponse } from "node:http";
import { runPlugin, runWsPlugin } from "../utils/plugin";

export function universalApiPlugin(opts?: UniversalApiOptions): Plugin {
	let options: UniversalApiOptionsRequired = {
		disable: true,
		logLevel: "info",
		delay: 0,
		gatewayTimeout: 0,
		endpointPrefix: [],
		enableWs: false,
		enablePreview: true,
		fsDir: null,
		fullFsDir: null,
		noHandledRestFsRequestsAction: "404",
		parser: true,
		middlewares: [],
		errorMiddlewares: [],
		handlers: [],
		wsHandlers: [],
		pagination: null,
		filters: null,
		config: {} as UniversalApiOptionsRequired["config"],
		matcher: {} as UniversalApiOptionsRequired["matcher"],
	};
	let logger: Logger = new Logger(Constants.PLUGIN_NAME, "info");
	let currentHandler: ((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => Promise<void>) | null = null;
	let registeredOnServer: HttpServer | null = null;
	let configResolvedPromise: Promise<void> | null = null;

	// INFO Shared logic for configureServer and configurePreviewServer.
	async function setupServer(server: ViteDevServer | PreviewServer, hookName: "configureServer" | "configurePreviewServer"): Promise<void> {
		if (configResolvedPromise) {
			await configResolvedPromise;
		}

		const isPreview = hookName === "configurePreviewServer";

		if (options.disable || (isPreview && !options.enablePreview)) {
			if (isPreview && !options.disable) {
				logger.debug("Vite configurePreviewServer: disabled in preview mode");
			}
			currentHandler = null;
		} else {
			logger.debug(`Vite ${hookName}: START`, `options= ${JSON.stringify({ ...options, config: "", matcher: "" }, null, 2)}`);
			currentHandler = async (req, res, next) => {
				await runPlugin(req, res, next, logger, options);
			};
			logger.debug(`Vite ${hookName}: FINISH`);
		}

		if (!server.httpServer || server.httpServer === registeredOnServer) {
			return;
		}

		/* v8 ignore start */
		if (registeredOnServer !== null) {
			const stack = (server.middlewares as any).stack as { handle: () => void }[] | undefined;
			if (Array.isArray(stack)) {
				const idx = stack.findIndex(layer => (layer.handle as any).__universalApi === true);
				if (idx !== -1) {
					stack.splice(idx, 1);
				}
			}
		}
		/* v8 ignore stop */

		registeredOnServer = server.httpServer;

		const middlewareFn = async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
			if (currentHandler === null) {
				next();
				return;
			}
			await currentHandler(req, res, next);
		};
		// INFO Tag the function so we can find and remove it on the next HMR restart.
		(middlewareFn as any).__universalApi = true;

		server.middlewares.use(middlewareFn);

		const cleanup = runWsPlugin(server, logger, options);
		server.httpServer.once("close", () => cleanup?.());
	}

	return {
		name: Constants.PLUGIN_NAME,
		apply: "serve",
		configResolved(conf) {
			options = Utils.plugin.initOptions(opts, conf);
			logger = new Logger(Constants.PLUGIN_NAME, options.logLevel);
			logger.debug("Vite configResolved: START");
			logger.info(`plugin initializing ...`);

			configResolvedPromise = (async () => {
				if (!options.fsDir || !(await Utils.files.isDirExists(options.fullFsDir!))) {
					options.fullFsDir = null;
					logger.info(`Directory with path ${options.fsDir} doesn't exist.`);
				}
				if (options.endpointPrefix.length === 0) {
					logger.warn(`Endpoint prefix empty or invalid`);
					options.disable = true;
				}

				logger.info(`plugin ${options.disable ? "disabled" : "started"}`);
				logger.debug("Vite configResolved: FINISH");
				/* v8 ignore start */
				/**
				 * INFO
				 * plugin print on process.stdout/stderr with console. If the process
				 * is running in background, when the client disconnects the session,
				 * stdout/stderr receive EIO/EPIPE errors.
				 * Register a handler to avoid killing the process on uncaughtException.
				 */
				const suppressIoError = (err: NodeJS.ErrnoException) => {
					if (err.code !== 'EIO' && err.code !== 'EPIPE') {
						throw err;
					}
				};
				if (process.stdout.listenerCount('error') === 0) {
					process.stdout.on('error', suppressIoError);
				}
				if (process.stderr.listenerCount('error') === 0) {
					process.stderr.on('error', suppressIoError);
				}
				/* v8 ignore stop */
			})();

			// INFO Return the promise so Vite awaits it when it supports async configResolved.
			return configResolvedPromise;
		},
		configureServer(server) {
			// INFO Return a function so Vite defers its execution to after the built-in middlewares are registered
			return () => {
				setupServer(server, "configureServer").catch(err =>
					logger.error("universalApiPlugin: error in configureServer setup", err)
				);
			};
		},
		configurePreviewServer(server) {
			return () => {
				setupServer(server, "configurePreviewServer").catch(err =>
					logger.error("universalApiPlugin: error in configurePreviewServer setup", err)
				);
			};
		}
	}
}
