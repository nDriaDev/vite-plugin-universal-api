/** @internal */
export type ApiWsRestFsErrorType = "NO_HANDLER" | "ERROR" | "TIMEOUT" | "MANUALLY_HANDLED" | "READ_FILE" | "ERROR_MIDDLEWARE";

/** @internal */
export interface IApiWsRestFsError extends Error {
    getType(): ApiWsRestFsErrorType;
    getPath(): string;
    getCode(): number;
    getExtra(): any;
    setPath(path: string): void;
    setType(type: ApiWsRestFsErrorType): void;
}
