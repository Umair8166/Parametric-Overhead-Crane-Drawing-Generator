import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Built frontend (client/dist). Resolved relative to this file so it works
// from both server/src (tsx dev) and server/dist (compiled start).
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

/**
 * Builds the Express app. Kept separate from index.ts (which only listens)
 * so tests can create an app instance without opening a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Unknown API routes -> JSON 404 (never fall through to the SPA).
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found' } });
  });

  // Serve the built React app, if it has been built.
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile('index.html', { root: CLIENT_DIST });
    });
  }

  // Central error handler. Express 5 forwards rejected async handlers here.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
  });

  return app;
}

