import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import patientRoutes from './routes/patients.js';
import observationRoutes from './routes/observations.js';
import healthRoutes from './routes/health.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = express();

// ── Core middleware ──────────────────────────────────

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: config.frontendOrigin,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: false,
  }),
);
app.use(express.json({ limit: '250kb', strict: true }));

// Serve static frontend files from project root
app.use(
  express.static(projectRoot, {
    index: false,
    dotfiles: 'deny',
    maxAge: !config.isDev ? '1h' : 0,
  }),
);

// Rate-limit auth endpoints
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── API routes ───────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/observations', observationRoutes);
app.use('/api/health', healthRoutes);

// ── SPA fallback ─────────────────────────────────────
// Non-API GET requests serve the main HTML (single-page app)

app.use(async (req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res
      .type('html')
      .send(await readFile(resolve(projectRoot, 'index.html'), 'utf8'));
  }
  next();
});

// ── Error handler (must be last) ─────────────────────

app.use(errorHandler);

export default app;
