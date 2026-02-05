/** @internal */
export type UniversalApiErrorType = "NO_HANDLER" | "ERROR" | "TIMEOUT" | "MANUALLY_HANDLED" | "READ_FILE" | "ERROR_MIDDLEWARE";

/** @internal */
export interface IUniversalApiError extends Error {
    getType(): UniversalApiErrorType;
    getPath(): string;
    getCode(): number;
    getExtra(): any;
    setPath(path: string): void;
    setType(type: UniversalApiErrorType): void;
}
