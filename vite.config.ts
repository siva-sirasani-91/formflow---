import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';
import {handleAuthRequest} from './server/authStore.js';
import {handleWorkspaceRequest} from './server/workspaceStore.js';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'formflow-dev-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const rawUrl = req.url || '';
            const [urlPath, rawQuery = ''] = rawUrl.split('?');
            if (!urlPath.startsWith('/api/')) {
              return next();
            }

            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
              try {
                let parsedBody = {};
                if (chunks.length > 0) {
                  try {
                    parsedBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                  } catch {
                    parsedBody = {};
                  }
                }
                const queryParams = new URLSearchParams(rawQuery);
                const result =
                  handleAuthRequest(
                    req.method || 'GET',
                    urlPath,
                    parsedBody,
                    req.headers.authorization
                  ) ||
                  handleWorkspaceRequest(
                    req.method || 'GET',
                    urlPath,
                    queryParams,
                    parsedBody,
                    req.headers.authorization
                  );
                if (!result) {
                  res.statusCode = 404;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ message: 'Endpoint not found.' }));
                  return;
                }
                res.statusCode = result.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.data));
              } catch (err) {
                console.error('[FormFlow API Error]', err);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ message: 'Internal server error.' }));
                }
              }
            });
          });
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/.data/**'] },
    },
  };
});
