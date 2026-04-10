export { universalApiPlugin } from './plugin';

export type {
	UniversalApiRequest,
	UniversalApiSimpleHandler,
	UniversalApiMiddleware,
	UniversalApiErrorMiddleware,
	UniversalApiParserFunction,
	UniversalApiParser,
	UniversalApiAuthenticate,
	UniversalApiRestFsHandler,
	UniversalApiWsHandler,
	UniversalApiOptions,
} from "./models/plugin.model";

export type {
	IWebSocketConnection
} from './models/webSocket.model'
