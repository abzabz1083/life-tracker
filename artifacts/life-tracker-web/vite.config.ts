import path from 'path';
import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

function lifeTrackerPwa(): Plugin {
  return {
    name: 'life-tracker-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const outputFiles = Object.keys(bundle)
        .filter((fileName) => fileName !== 'sw.js' && !fileName.endsWith('.map'))
        .sort();
      const buildId = createHash('sha256')
        .update(outputFiles.join('\n'))
        .digest('hex')
        .slice(0, 12);
      const precachePaths = [
        './index.html',
        './manifest.webmanifest',
        './favicon.svg',
        './logo.svg',
        './icons/life-tracker-192.png',
        './icons/life-tracker-512.png',
        ...outputFiles.map((fileName) => `./${fileName}`),
      ];
      const uniquePrecachePaths = [...new Set(precachePaths)];
      const source = `
const CACHE_PREFIX = 'life-tracker-pwa-';
const CACHE_NAME = CACHE_PREFIX + '${buildId}';
const ASSET_PATHS = ${JSON.stringify(uniquePrecachePaths)};
const ASSET_URLS = ASSET_PATHS.map((assetPath) => new URL(assetPath, self.registration.scope).toString());
const APP_SHELL_URL = new URL('index.html', self.registration.scope).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSET_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedShell = await caches.match(APP_SHELL_URL);
        return cachedShell || new Response(
          'Life Tracker is offline. Reconnect to check your passcode and use online features.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
        );
      }),
    );
    return;
  }

  // Cache static app assets only. API responses, passcode sessions, and tracker data stay network-only.
  if (!['script', 'style', 'image', 'font', 'worker'].includes(request.destination)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    lifeTrackerPwa(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
