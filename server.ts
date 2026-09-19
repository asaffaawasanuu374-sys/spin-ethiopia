import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/api';
import { startWorker } from './server/worker';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Mount API routes FIRST
  app.use('/api', apiRouter);

  // Development vs Production serving
  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import of Vite to prevent Vite from ever being bundled in production serverless build!
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global safe error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      error: 'Dogoggora keessoo sirnichaa (Internal Server Error)',
      message: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Spin Ethiopia running on http://0.0.0.0:${PORT}`);
    if (process.env.START_WORKER !== 'false') {
      startWorker(5000);
    }
  });
}


startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
