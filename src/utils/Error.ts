import { ApiWsRestFsErrorType, IApiWsRestFsError } from "src/models/error.model";
import { Constants } from "./constants";

export class ApiWsRestFsError extends Error implements IApiWsRestFsError {
	private type: ApiWsRestFsErrorType;
	private path: string;
	private code: number = Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
	private extra: any;


    constructor(e: string, type: ApiWsRestFsErrorType, path: string, code?: number, extra?: any);
    constructor(e: Error, type: ApiWsRestFsErrorType, path: string, code?: number, extra?: any);
    constructor(e: string | Error, type: ApiWsRestFsErrorType, path: string, code?: number, extra?: any) {
        if (typeof e === "string") {
            super(e);
        } else {
            super(e.message, { cause: e.cause });
			this.stack = `${this.name}: ${this.message}\nCaused by: ${e.stack}`;
		}
		this.type = type;
		this.path = path;
		!!code && (this.code = code);
		!!extra && (this.extra = extra);
    }

    getType(): ApiWsRestFsErrorType {
        return this.type;
	}

	getPath(): string {
		return this.path;
	}

	getCode(): number {
		return this.code;
	}

	getExtra(): any {
		return this.extra;
	}

	setPath(path: string): void {
		this.path = path;
	}

	setType(type: ApiWsRestFsErrorType) {
		this.type = type;
	}
}
