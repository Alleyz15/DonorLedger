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
  // Translate known Prisma error codes into HTTP client errors so they never
  // silently become 500s. Add codes here as new routes are added.
  if (err.code === 'P2002') {
    // Unique constraint — e.g. duplicate walletAddress
    const fields = err.meta?.target ? ` (${err.meta.target.join(', ')})` : ''
    err = Object.assign(new Error(`A record with this value already exists${fields}`), { status: 409 })
  } else if (err.code === 'P2025') {
    // Record not found — e.g. update/delete on missing row
    err = Object.assign(new Error('Record not found'), { status: 404 })
  } else if (err.code === 'P2003') {
    // Foreign key constraint — e.g. ngoId references a non-existent NGO
    err = Object.assign(new Error('Related record not found'), { status: 400 })
  } else if (err.code === 'P2023' || err.code === 'P2006') {
    // Inconsistent / invalid data — e.g. bad UUID/CUID format
    err = Object.assign(new Error('Invalid data format'), { status: 400 })
  }

  const status = err.status || err.statusCode || 500
  const isClientError = status >= 400 && status < 500

  // Always log server errors in full so the terminal shows the real cause.
  // Never log private keys / donor PII.
  if (!isClientError) {
    console.error(`[error] ${req.method} ${req.path}`, {
      status,
      message: err.message,
      code: err.code,
      stack: err.stack,
    })
  }

  res.status(status).json({
    error: isClientError ? err.message : 'Internal server error',
    ...(env.nodeEnv === 'development' && !isClientError
      ? { detail: err.message }
      : {}),
  })
}
