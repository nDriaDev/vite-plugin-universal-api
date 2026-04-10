import { defineConfig, UserConfig } from 'tsdown';
const commonConfig: UserConfig = {
	entry: "src/index.ts",
	platform: "node",
	dts: true,
	sourcemap: true,
	minify: true,
	clean: false
}
export default defineConfig([
	{
		...commonConfig,
		clean: true,
		format: "esm",
		outExtensions() {
			return { dts: ".d.ts", js: ".js" }
		}
	},
	{
		...commonConfig,
		format: "esm",
		outExtensions() {
			return { dts: ".d.mts" }
		}
	},
	{
		...commonConfig,
		format: "cjs",
		outExtensions() {
			return { dts: ".d.cts" }
		}
	},
])
