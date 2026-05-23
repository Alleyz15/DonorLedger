// routes/auth.routes.js
//
// Unified frontend authentication. The login page sends only email/password.
// Bank Islam staff are identified by Bank Islam email domains and receive an
// admin token; NGO organizers receive an NGO token; donors receive a user token.

import { Router } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../config/database.js'
import { env } from '../config/env.js'
import { validate } from '../middleware/validate.middleware.js'
import { signAdminToken, signNGOToken } from '../middleware/auth.middleware.js'
import { checkPassword, hashPassword } from '../utils/password.utils.js'

const router = Router()

const BANK_ISLAM_EMAIL_RE = /@(?:bankislam\.demo|bankislam\.com\.my)$/i

const loginSchema = {
  email: { type: 'email', required: true },
  password: { type: 'string', required: true, min: 6, max: 128 },
}

const signupSchema = {
  name: { type: 'string', required: true, min: 2, max: 200 },
  email: { type: 'email', required: true },
  password: { type: 'string', required: true, min: 8, max: 128 },
  ngoId: { type: 'string', required: false, max: 200 },
}

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email)
    const password = req.body.password

    if (isBankIslamEmail(email)) {
      const bankUser = await prisma.user.findUnique({ where: { email } })
      if (
        bankUser &&
        bankUser.role === 'BANK_ADMIN' &&
        bankUser.isActive &&
        checkPassword(password, bankUser.passwordHash)
      ) {
        return res.json(buildBankAdminSession(bankUser))
      }

      const admin = await prisma.adminUser.findUnique({ where: { email } })
      if (
        admin &&
        admin.isActive &&
        checkPassword(password, admin.passwordHash)
      ) {
        return res.json({
          token: signAdminToken({
            sub: admin.id,
            email: admin.email,
            role: admin.role,
          }),
          role: 'BANK_ADMIN',
          name: admin.name,
        })
      }

      throwInvalidCredentials()
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (user && user.isActive && checkPassword(password, user.passwordHash)) {
      if (user.role === 'ORGANIZER' && user.ngoId) {
        const ngo = await prisma.nGO.findUnique({ where: { id: user.ngoId } })
        if (ngo) {
          return res.json(buildOrganizerSession({ user, ngo }))
        }
      }

      return res.json(buildDonorSession(user))
    }

    const ngo = await prisma.nGO.findFirst({ where: { contactEmail: email } })
    if (ngo && ngo.passwordHash && checkPassword(password, ngo.passwordHash)) {
      return res.json(buildLegacyNGOSession(ngo))
    }

    throwInvalidCredentials()
  } catch (e) {
    next(e)
  }
})

router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    if (req.body.ngoId) {
      const email = normalizeEmail(req.body.email)
      if (isBankIslamEmail(email)) {
        const err = new Error('Bank Islam accounts are provisioned by the system administrator')
        err.status = 403
        throw err
      }

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        const err = new Error('An account with this email already exists')
        err.status = 409
        throw err
      }

      const ngo = await prisma.nGO.findUnique({ where: { id: req.body.ngoId } })
      if (!ngo) {
        const err = new Error('NGO application not found')
        err.status = 404
        throw err
      }

      const passwordHash = hashPassword(req.body.password)
      const user = await prisma.$transaction(async (tx) => {
        await tx.nGO.update({
          where: { id: ngo.id },
          data: {
            contactEmail: email,
            passwordHash,
          },
        })
        return tx.user.create({
          data: {
            name: req.body.name,
            email,
            passwordHash,
            role: 'ORGANIZER',
            ngoId: ngo.id,
          },
        })
      })

      return res.status(201).json({
        id: user.id,
        role: user.role,
        message: 'Organizer account created. You can now log in.',
      })
    }

    const err = new Error(
      'Demo donor accounts are pre-seeded. Use donor01@example.com to donor10@example.com with Password123!.'
    )
    err.status = 403
    throw err
  } catch (e) {
    next(e)
  }
})

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function isBankIslamEmail(email) {
  return BANK_ISLAM_EMAIL_RE.test(email)
}

function throwInvalidCredentials() {
  const err = new Error('Invalid credentials')
  err.status = 401
  throw err
}

function buildBankAdminSession(user) {
  return {
    token: signAdminToken({
      sub: user.id,
      email: user.email,
      role: 'SUPER_ADMIN',
    }),
    role: 'BANK_ADMIN',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }
}

function buildOrganizerSession({ user, ngo }) {
  return {
    token: signNGOToken({
      sub: ngo.id,
      email: ngo.contactEmail,
      status: ngo.status,
    }),
    role: 'ORGANIZER',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    ngo: {
      id: ngo.id,
      name: ngo.name,
      status: ngo.status,
      riskTier: ngo.riskTier,
    },
  }
}

function buildLegacyNGOSession(ngo) {
  return {
    token: signNGOToken({
      sub: ngo.id,
      email: ngo.contactEmail,
      status: ngo.status,
    }),
    role: 'ORGANIZER',
    ngo: {
      id: ngo.id,
      name: ngo.name,
      status: ngo.status,
      riskTier: ngo.riskTier,
    },
  }
}

function buildDonorSession(user) {
  return {
    token: jwt.sign(
      { type: 'user', sub: user.id, email: user.email, role: user.role },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn }
    ),
    role: user.role,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }
}

export default router
