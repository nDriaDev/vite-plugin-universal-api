/** @internal */
export interface ILogger {
    debug(...msg: unknown[]): void;
    info(...msg: unknown[]): void;
    success(...msg: unknown[]): void;
    warn(...msg: unknown[]): void;
    error(...msg: unknown[]): void;
}
