import { defineConfig } from 'vite';
import { fetchFlashscoreMatch } from './src/flashscoreService.js';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: false,
  },
  plugins: [
    {
      name: 'flashscore-api',
      configureServer(server) {
        server.middlewares.use('/api/parse-url', async (req, res) => {
          try {
            const urlObj = new URL(req.url, 'http://localhost:3000');
            const targetUrl = urlObj.searchParams.get('url');
            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Brak parametru url' }));
              return;
            }

            const data = await fetchFlashscoreMatch(targetUrl);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, ...data }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      },
    },
  ],
});
