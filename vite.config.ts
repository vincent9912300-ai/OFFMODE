import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const publicDir = fileURLToPath(new URL('./public', import.meta.url));
const outDir = fileURLToPath(new URL('./dist', import.meta.url));

// Serve public/<dir>/index.html at /<dir>/ in dev and preview, so clean
// URLs like /search/ and /offthedrums/ work instead of falling back to the SPA.
function directoryIndex(devDir: string, previewDir: string): Plugin {
  const rewrite = (baseDir: string, url: string | undefined) => {
    if (!url) return url;
    const [rawPath, query] = url.split('?');
    if (!rawPath || rawPath === '/' || rawPath.endsWith('.html')) return url;
    const clean = rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
    if (!fs.existsSync(path.join(baseDir, clean, 'index.html'))) return url;
    return `${clean}/index.html${query ? `?${query}` : ''}`;
  };
  const handler = (baseDir: string) => (req: IncomingMessage, _res: ServerResponse, next: () => void) => {
    req.url = rewrite(baseDir, req.url);
    next();
  };

  return {
    name: 'offmode-directory-index',
    configureServer(server) {
      server.middlewares.use(handler(devDir));
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler(previewDir));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), directoryIndex(publicDir, outDir)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2019',
  },
});
