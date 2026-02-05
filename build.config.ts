import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
    name: "vite-plugin-universal-api",
    entries: ['src/index'],
    externals: ['vite'],
    clean: true,
    declaration: true,
    rollup: {
        emitCJS: true,
		inlineDependencies: true,
		output: {
			exports: "named"
		},
		esbuild: {
			target: "node16",
            minify: true,
            minifyWhitespace: true,
            minifySyntax: true,
            minifyIdentifiers: true,
            treeShaking: true,
            ignoreAnnotations: true,
            legalComments: "none"
		}
	},
	hooks: {
		'build:done': async (ctx) => {
			console.log('✅ Build completed successfully!')
			console.log('📦 Generated files:')
			console.log('   - dist/index.cjs (CommonJS)')
			console.log('   - dist/index.mjs (ESM)')
			console.log('   - dist/index.d.ts (TypeScript declarations)')
			console.log('   - dist/index.d.mts (ESM TypeScript declarations)')
		}
	}
})
