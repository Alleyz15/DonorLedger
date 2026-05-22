// middleware/auth.middleware.js
//
// JWT auth for Bank Islam admin endpoints. Section 16 — admin routes are
// the only ones that should ever load the bank-islam wallet (which signs
// the higher-privilege contract calls).
//
// Token payload: { sub, email, role }
// Roles: KYC_REVIEWER | DISBURSEMENT_APPROVER | SUPER_ADMIN

import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

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
    req.admin = payload
    next()
  } catch (e) {
    const err = new Error('Invalid or expired token')
    err.status = 401
    next(err)
  }
}

/** Role guard — chain after requireAdmin. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.admin) {
      const err = new Error('Not authenticated')
      err.status = 401
      return next(err)
    }
    if (!roles.includes(req.admin.role) && req.admin.role !== 'SUPER_ADMIN') {
      const err = new Error('Forbidden — insufficient role')
      err.status = 403
      return next(err)
    }
    next()
  }
}

export function signAdminToken({ sub, email, role }) {
  return jwt.sign({ sub, email, role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  })
}
