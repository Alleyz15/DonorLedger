// middleware/auth.middleware.js
//
// JWT auth for Bank Islam admin endpoints and NGO portal endpoints.
// Admin routes are the only endpoints that should ever load the Bank Islam
// wallet because they sign higher-privilege contract calls.
//
// Admin token payload: { type: 'admin', sub, email, role }
// NGO token payload:   { type: 'ngo', sub, email, status }

import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const ADMIN_ROLES = ['KYC_REVIEWER', 'DISBURSEMENT_APPROVER', 'SUPER_ADMIN']

export function requireAdmin(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    const err = new Error('Missing bearer token')
    err.status = 401
    return next(err)
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret)
    const isAdminToken =
      payload.type === 'admin' ||
      (!payload.type && ADMIN_ROLES.includes(payload.role))
    if (!isAdminToken || !ADMIN_ROLES.includes(payload.role)) {
      const err = new Error('Admin token required')
      err.status = 403
      return next(err)
    }
    req.admin = payload
    next()
  } catch (e) {
    const err = new Error('Invalid or expired token')
    err.status = 401
    next(err)
  }
}

export function requireNGO(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    const err = new Error('Missing bearer token')
    err.status = 401
    return next(err)
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret)
    if (payload.type !== 'ngo') {
      const err = new Error('NGO token required')
      err.status = 403
      return next(err)
    }
    req.ngo = payload
    next()
  } catch (e) {
    const err = new Error('Invalid or expired token')
    err.status = 401
    next(err)
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.admin) {
      const err = new Error('Not authenticated')
      err.status = 401
      return next(err)
    }
    if (!roles.includes(req.admin.role) && req.admin.role !== 'SUPER_ADMIN') {
      const err = new Error('Forbidden - insufficient role')
      err.status = 403
      return next(err)
    }
    next()
  }
}

export function signAdminToken({ sub, email, role }) {
  return jwt.sign({ type: 'admin', sub, email, role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  })
}

export function signNGOToken({ sub, email, status }) {
  return jwt.sign({ type: 'ngo', sub, email, status }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  })
}
