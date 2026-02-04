/// <reference types="node" />

import { defineConfig } from 'vitepress'
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "vite-plugin-ws-rest-fs-api",
	description: "Mock WebSocket, REST and File-based APIs for Vite",
	base: "/",
	buildEnd() {
		const sitemapPath = resolve(join(__dirname, "dist", "sitemap.xml"));
		const humansPath = resolve(join(__dirname, "dist", "humans.txt"));
		if (!existsSync(sitemapPath)) {
			return;
		}
		let xml = readFileSync(sitemapPath, "utf-8");
		const now = new Date();
		xml = xml.replace(/<lastmod>.*?<\/lastmod>/g, `<lastmod>${now.toISOString()}</lastmod >`);
		writeFileSync(sitemapPath, xml);
		if (!existsSync(humansPath)) {
			return;
		}
		const [month, day, year] = now.toLocaleDateString().split("/");
		let humans = readFileSync(humansPath, "utf-8");
		humans = humans.replace(
			/(Last update:\s*).*/,
			`$1${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
		);
		writeFileSync(humansPath, humans);
	},
	cleanUrls: true,
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		logo: '/logo_hd.png',
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'API Reference', link: '/api/' },
			{ text: 'Examples', link: '/examples/' }
		],
		sidebar: {
			'/guide/': [
				{
					text: 'Introduction',
					items: [
						{ text: 'Getting Started', link: '/guide/getting-started' },
						{ text: 'Quick Start', link: '/guide/quick-start' }
					]
				},
				{
					text: 'Core Concepts',
					items: [
						{ text: 'File-System API', link: '/guide/file-system-api' },
						{ text: 'REST Handlers', link: '/guide/rest-handlers' },
						{ text: 'WebSocket', link: '/guide/websocket' }
					]
				},
				{
					text: 'Advanced',
					items: [
						{ text: 'Middleware', link: '/guide/middleware' },
						{ text: 'Pagination & Filters', link: '/guide/pagination-filters' },
						{ text: 'Custom Parsers', link: '/guide/custom-parsers' },
						{ text: 'Pattern Matching', link: '/guide/pattern-matching' }
					]
				}
			],
			'/api/': [
				{
					text: 'API Reference',
					items: [
						{ text: 'Configuration Options', link: '/api/' },
						{ text: 'Request Object', link: '/api/request' },
						{ text: 'REST Handlers', link: '/api/rest-handlers' },
						{ text: 'WebSocket Handlers', link: '/api/websocket-handlers' },
						{ text: 'WebSocket Connection', link: '/api/websocket-connection' },
						{ text: 'Middleware Types', link: '/api/middleware' },
						{ text: 'HTTP Method Behavior', link: '/api/http-methods' }
					]
				}
			],
			'/examples/': [
				{
					text: 'Examples',
					items: [
						{ text: 'Overview', link: '/examples/' },
						{ text: 'File-Based Mocking', link: '/examples/file-based' },
						{ text: 'Custom Handlers', link: '/examples/custom-handlers' },
						{ text: 'WebSocket Chat', link: '/examples/websocket-chat' },
						{ text: 'WebSocket Game', link: '/examples/websocket-game' },
						{ text: 'Authentication', link: '/examples/authentication' },
						{ text: 'Stateful Server', link: '/examples/stateful-server' }
					]
				}
			]
		},
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/nDriaDev/vite-plugin-ws-rest-fs-api' },
			{ icon: 'npm', link: 'https://www.npmjs.com/package/@ndriadev/vite-plugin-ws-rest-fs-api' },
			{ icon: 'googlehome', link: 'https://ndria.dev' }
		],
		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2024-present nDriaDev'
		},
		search: {
			provider: 'local'
		},
		editLink: {
			pattern: 'https://github.com/nDriaDev/vite-plugin-ws-rest-fs-api/edit/main/docs/:path',
			text: 'Edit this page on GitHub'
		}
	},
	head: [
		['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
		['meta', { property: 'og:type', content: 'website' }],
		['meta', { property: 'og:title', content: 'vite-plugin-ws-rest-fs-api' }],
		['meta', { property: 'og:description', content: 'Mock WebSocket, REST and File-based APIs for Vite' }],
		['meta', { name: 'twitter:card', content: 'summary_large_image' }],
	],
	markdown: {
		theme: {
			light: 'github-light',
			dark: 'github-dark'
		},
		lineNumbers: true
	},
	vite: {
		build: {
			minify: true
		}
	}
});
