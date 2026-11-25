import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const springBackendUrl = (process.env.SPRING_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'formflow-proxy-loop-guard',
        configureServer(server) {
          return () => {
            server.middlewares.stack.unshift({
              route: '',
              handle: (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                if (req.url?.startsWith('/api') && req.headers['x-formflow-proxy-hop']) {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      message:
                        'Unable to reach the Spring Boot backend. Ensure the Spring Boot API and MySQL server are running.',
                    })
                  );
                  return;
                }
                next();
              },
            });
          };
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
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
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
      proxy: {
        '/api': {
          target: springBackendUrl,
          changeOrigin: true,
          secure: false,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('X-FormFlow-Proxy-Hop', '1');
            });
            proxy.on('error', (_err, _req, res) => {
              if ('headersSent' in res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    message:
                      'Unable to reach the Spring Boot backend. Ensure the Spring Boot API and MySQL server are running.',
                  })
                );
              }
            });
          },
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/.backups/**', '**/backend/target/**'] },
    },
  };
});
