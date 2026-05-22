// middleware/error.middleware.js
//
// Global error handler. Section 16 — services throw Error with `.status`
// and the handler turns those into a clean JSON response. Anything without
// a status becomes a 500 with a generic message (we never leak internals
// like stack traces or env keys to the client).

import { env } from '../config/env.js'

export function notFoundHandler(req, res, _next) {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  })
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500
  const isClientError = status >= 400 && status < 500

  // Server errors get logged in full. Client errors stay quiet to avoid
  // log spam from malformed input. Never log private keys / donor PII.
  if (!isClientError) {
    console.error(`[error] ${req.method} ${req.path}`, {
      status,
      message: err.message,
      stack: env.nodeEnv === 'development' ? err.stack : undefined,
    })
  }

  res.status(status).json({
    error: isClientError ? err.message : 'Internal server error',
    ...(env.nodeEnv === 'development' && !isClientError
      ? { detail: err.message }
      : {}),
  })
}
