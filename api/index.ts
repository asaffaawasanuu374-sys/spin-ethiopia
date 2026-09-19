import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import apiRouter from '../server/api';


const app = express();

// CORS & Preflight handling
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// URL normalization for serverless environments (handles /api/index.ts, /api?all=..., /api/round/active, etc.)
app.use((req: Request, res: Response, next: NextFunction) => {
  let intendedPath = req.url || '/';

  if (req.query && req.query.all) {
    const rawAll = req.query.all;
    const pathPart = Array.isArray(rawAll) ? rawAll.join('/') : String(rawAll);
    intendedPath = '/' + pathPart.replace(/^\/+/, '');
  } else if (req.originalUrl && req.originalUrl !== '/api' && req.originalUrl !== '/') {
    intendedPath = req.originalUrl;
  }

  // Remove /api/index.ts artifact if present
  if (intendedPath.startsWith('/api/index.ts')) {
    intendedPath = intendedPath.replace('/api/index.ts', '') || '/';
  }

  // Remove leading /api so it directly matches routes inside apiRouter mounted at root
  if (intendedPath.startsWith('/api/')) {
    intendedPath = intendedPath.slice(4);
  } else if (intendedPath === '/api') {
    intendedPath = '/';
  }

  // Strip query string for route matching
  const qIdx = intendedPath.indexOf('?');
  if (qIdx !== -1) {
    intendedPath = intendedPath.slice(0, qIdx);
  }

  if (!intendedPath.startsWith('/')) {
    intendedPath = '/' + intendedPath;
  }

  req.url = intendedPath;
  next();
});

// Always-On Backend Proxy Support:
// If ALWAYS_ON_BACKEND_URL or BACKEND_URL is set in Vercel environment variables,
// transparently proxy all incoming /api requests to the 24/7 persistent backend/worker!
const alwaysOnBackendUrl = process.env.ALWAYS_ON_BACKEND_URL || process.env.BACKEND_URL || process.env.WORKER_URL;

if (alwaysOnBackendUrl) {
  const cleanTargetBase = alwaysOnBackendUrl.trim().replace(/\/+$/, '');
  console.log(`[Vercel Proxy] Connected to Always-On Backend: ${cleanTargetBase}`);

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const endpoint = req.url.startsWith('/') ? req.url : '/' + req.url;
    const targetUrl = `${cleanTargetBase}/api${endpoint === '/' ? '' : endpoint}`;

    try {
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (val && key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
          headers.set(key, Array.isArray(val) ? val.join(', ') : val);
        }
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }

      const upstreamRes = await fetch(targetUrl, fetchOptions);

      res.status(upstreamRes.status);
      upstreamRes.headers.forEach((val, key) => {
        if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'content-length') {
          res.setHeader(key, val);
        }
      });

      const bodyBuffer = await upstreamRes.arrayBuffer();
      return res.send(Buffer.from(bodyBuffer));
    } catch (err: any) {
      console.warn(`[Vercel Proxy] Forwarding to ${targetUrl} failed (${err.message}). Falling back to local serverless router.`);
      return next();
    }
  });
}

// Mount at both / and /api so all route styles match effortlessly!
app.use('/', apiRouter);
app.use('/api', apiRouter);


// Return JSON for any unhandled API route (NEVER HTML!)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `Kallattiin hin argamne (${req.method} ${req.url})`,
    status: 404,
  });
});

// Safe JSON error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Vercel API error:', err);
  res.status(500).json({
    error: 'Dogoggora keessoo sarvaraa (Internal Server Error)',
    message: err.message || 'Unknown error',
  });
});

export default app;
export { app };
