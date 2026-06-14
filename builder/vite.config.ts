import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(__dirname, '../data');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'save-recipes-dev',
      configureServer(server) {
        server.middlewares.use('/api/save-recipes', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('POST only');
            return;
          }
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(
                path.join(dataDir, 'recipes.json'),
                JSON.stringify(parsed, null, 1) + '\n',
              );
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.statusCode = 400;
              res.end(String(e));
            }
          });
        });
      },
    },
  ],
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
  resolve: {
    alias: {
      '@data': dataDir,
    },
  },
});
