import { z } from 'zod';

/**
 * Centralized error handler.
 * Handles Zod validation errors (→ 400) and unexpected errors (→ 500).
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Invalid request.',
      details: err.flatten(),
    });
  }

  console.error(err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
}
