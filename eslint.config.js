import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
	{
		ignores: [
			"**/dist/**",
			"**/node_modules/**",
			"**/coverage/**",
			"**/.vitepress/config.mts",
			"**/.vitepress/dist/**",
			"**/.vitepress/cache/**",
			"**/docs/.vitepress/dist/**",
			"**/docs/.vitepress/cache/**",
			"**/*.config.js",
			"**/*.config.ts",
			"**/scripts/**/*.js",
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.node,
				...globals.es2021,
			},
			parserOptions: {
				project: "./tsconfig.json",
			}
		},
		rules: {
			"no-console": "off",
			"no-debugger": "warn",
			"no-alert": "error",
			"no-duplicate-imports": "error",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					"argsIgnorePattern": "^_",
					"varsIgnorePattern": "^_",
					"caughtErrorsIgnorePattern": "^_"
				}
			],
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-empty-interface": "off",
			"@typescript-eslint/no-unused-expressions": "off",
			"@typescript-eslint/no-var-requires": "off",
			"camelcase": ["warn", { "properties": "never" }],
			"no-async-promise-executor": "off",
			"no-case-declarations": "off",
			"no-prototype-builtins": "off"
		}
	},
	{
		files: ["**/*.test.ts", "**/*.spec.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"no-case-declarations": "off"
		}
	}
);
