import { Connect, HttpServer, Plugin } from "vite";
import { UniversalApiOptions, UniversalApiOptionsRequired } from "../models/plugin.model";
import { Logger } from "../utils/Logger";
import { Constants } from "../utils/constants";
import { Utils } from "../utils/utils";
import { IncomingMessage, ServerResponse } from "node:http";
import { runPlugin, runWsPlugin } from "../utils/plugin";

export function universalApiPlugin(opts?: UniversalApiOptions): Plugin {
	let options: UniversalApiOptionsRequired,
		logger: Logger,
		currentHandler: ((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => Promise<void>) | null = null,
		registeredOnServer: HttpServer | null = null;

	return {
		name: Constants.PLUGIN_NAME,
		apply: "serve",
		async configResolved(conf) {
			options = Utils.plugin.initOptions(opts, conf);
			logger = new Logger(Constants.PLUGIN_NAME, options.logLevel);
			logger.debug("Vite configResolved: START");
			logger.info(`plugin initializing ...`);
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
			 * plugin print on process.stoud/sterr with console. If the process running in background,
			 * when client disconnect session, stdout/stderr receive EIO/EPIPE error.
			 * So register an hanlder to avoid process's death for uncaughtException
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
		},
		configureServer(server) {
			if (options.disable) {
				currentHandler = null;
				return;
			}
			logger.debug("Vite configureServer: START", `options= ${JSON.stringify({ ...options, config: "", matcher: "" }, null, 2)}`);
			currentHandler = async (req, res, next) => {
				await runPlugin(req, res, next, logger, options);
			};
			if (server.httpServer && server.httpServer !== registeredOnServer) {
				registeredOnServer = server.httpServer;
				server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
					await currentHandler!(req, res, next);
				});
				const cleanup = runWsPlugin(server, logger, options);
				server.httpServer?.once("close", () => cleanup?.());
			}
			logger.debug("Vite configureServer: FINISH");
		},
		configurePreviewServer(server) {
			if (options.disable) {
				currentHandler = null;
				return;
			}
			if (!options.enablePreview) {
				logger.debug("Vite configurePreviewServer: disabled in preview mode");
				currentHandler = null;
				return;
			}
			logger.debug("Vite configurePreviewServer: START", `options= ${JSON.stringify({ ...options, config: "", matcher: "" }, null, 2)}`);
			currentHandler = async (req, res, next) => {
				await runPlugin(req, res, next, logger, options);
			};
			if (server.httpServer && server.httpServer !== registeredOnServer) {
				registeredOnServer = server.httpServer;
				server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
					await currentHandler!(req, res, next);
				});
				const cleanup = runWsPlugin(server, logger, options);
				server.httpServer?.once("close", () => cleanup?.());
			}
			logger.debug("Vite configurePreviewServer: FINISH");
		}
	}
}
