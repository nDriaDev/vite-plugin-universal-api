import { ILogger } from "../models/logger.model";
import { LogLevel } from "vite";

export class Logger implements ILogger {
	private packageName;
	private logLevel;
	private colors = {
		reset: '\x1b[0m',
		debug: '\x1b[1;93m',
		red: '\x1b[1;31m',
		green: '\x1b[1;32m',
		yellow: '\x1b[1;33m'
	};

	constructor(packageName: string, logLevel: LogLevel | "debug" = "info") {
		this.packageName = packageName;
		this.logLevel = logLevel;
	}

	private serialize(value: unknown): string {
		if (value instanceof Error) {
			return value.stack ?? `${value.name}: ${value.message}`;
		}
		if (typeof value === "string") {
			return value;
		}
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}

	private log(msg: unknown[], prefix: string = "") {
		this.logLevel !== "silent" && process.stdout.write(
			`${prefix}${this.packageName}${prefix ? this.colors.reset : ''} ${msg.map(m => this.serialize(m)).join(" ")}\n`
		);
	}

	debug(...msg: unknown[]): void {
		this.logLevel === "debug" && this.log(msg, this.colors.debug);
	}

	info(...msg: unknown[]): void {
		["debug", "info"].includes(this.logLevel) && this.log(msg);
	}
	success(...msg: unknown[]): void {
		["debug", "info"].includes(this.logLevel) && this.log(msg, this.colors.green);
	}
	warn(...msg: unknown[]): void {
		["debug", "info", "warn"].includes(this.logLevel) && this.log(msg, this.colors.yellow);
	}
	error(...msg: unknown[]): void {
		this.log(msg, this.colors.red);
	}
}
