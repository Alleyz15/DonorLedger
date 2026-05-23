// routes/ngo.routes.js
//
// POST /api/ngo/register  - public application submission
// POST /api/ngo/login     - NGO portal JWT login
// GET  /api/ngo/:id       - public-safe NGO profile
//
// Approval / renewal / revocation live in admin.routes.js because they
// require the Bank Islam wallet.

import { Router } from 'express'
import prisma from '../config/database.js'
import kycService from '../services/kyc.service.js'
import { requireNGO, signNGOToken } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { checkPassword, hashPassword } from '../utils/password.utils.js'

const router = Router()

const registerSchema = {
  name: { type: 'string', required: true, min: 2, max: 200 },
  registrationNum: { type: 'string', required: true, min: 3, max: 50 },
  walletAddress: { type: 'address', required: false },
  contactEmail: { type: 'email', required: true },
  contactPhone: { type: 'string', required: false },
  password: { type: 'string', required: false, min: 8, max: 128 },
}

const campaignSchema = {
  name: { type: 'string', required: true, min: 3, max: 200 },
  causeType: { type: 'string', required: true, min: 2, max: 100 },
  description: { type: 'string', required: false, max: 2000 },
  aidPercent: { type: 'integer', required: true, min: 0, max: 100 },
  logisticsPercent: { type: 'integer', required: true, min: 0, max: 100 },
  adminPercent: { type: 'integer', required: true, min: 0, max: 100 },
  targetAmount: { type: 'number', required: true, min: 1 },
  endDate: { type: 'string', required: true },
}

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { password, ...application } = req.body
    const ngo = await kycService.submitNGOApplication({
      ...application,
      passwordHash: password ? hashPassword(password) : undefined,
    })
    res.status(201).json({
      id: ngo.id,
      status: ngo.status,
      riskTier: ngo.riskTier,
      message:
        'Application received. Bank Islam will complete KYC verification.',
    })
  } catch (e) {
    next(e)
  }
})

router.post(
  '/login',
  validate({
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 8 },
  }),
  async (req, res, next) => {
    try {
      const ngo = await prisma.nGO.findFirst({
        where: { contactEmail: req.body.email },
      })

      if (!ngo || !ngo.passwordHash || !checkPassword(req.body.password, ngo.passwordHash)) {
        const err = new Error('Invalid credentials')
        err.status = 401
        throw err
      }

      if (['REJECTED', 'REVOKED'].includes(ngo.status)) {
        const err = new Error(`NGO account is ${ngo.status.toLowerCase()}`)
        err.status = 403
        throw err
      }

      const token = signNGOToken({
        sub: ngo.id,
        email: ngo.contactEmail,
        status: ngo.status,
      })

      res.json({
        token,
        role: 'NGO',
        ngo: {
          id: ngo.id,
          name: ngo.name,
          status: ngo.status,
          riskTier: ngo.riskTier,
        },
      })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/campaign/create',
  requireNGO,
  validate(campaignSchema),
  async (req, res, next) => {
    try {
      const ngo = await prisma.nGO.findUnique({ where: { id: req.ngo.sub } })
      if (!ngo || ngo.status !== 'APPROVED') {
        const err = new Error('NGO must be Bank Islam-approved before creating a campaign application')
        err.status = 403
        throw err
      }

      const {
        name,
        causeType,
        description,
        aidPercent,
        logisticsPercent,
        adminPercent,
        targetAmount,
        endDate,
      } = req.body

      if (aidPercent + logisticsPercent + adminPercent !== 100) {
        const err = new Error('Allocation percentages must sum to 100')
        err.status = 400
        throw err
      }

      const campaign = await prisma.campaign.create({
        data: {
          ngoId: ngo.id,
          name,
          causeType,
          description: description || '',
          aidPercent,
          logisticsPercent,
          adminPercent,
          targetAmount,
          endDate: new Date(endDate),
          status: 'DRAFT',
        },
      })

      res.status(201).json({
        campaignId: campaign.id,
        status: campaign.status,
        message: 'Campaign application submitted for Bank Islam review.',
      })
    } catch (e) {
      next(e)
    }
  }
)

router.get('/campaigns', requireNGO, async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { ngoId: req.ngo.sub },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        causeType: true,
        targetAmount: true,
        raisedAmount: true,
        donorCount: true,
        endDate: true,
        status: true,
        pausedReason: true,
        contractAddress: true,
        createdAt: true,
      },
    })
    res.json(
      campaigns.map((c) => ({
        ...c,
        targetAmount: Number(c.targetAmount),
        raisedAmount: Number(c.raisedAmount),
      }))
    )
  } catch (e) {
    next(e)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const ngo = await prisma.nGO.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        registrationNum: true,
        riskTier: true,
        status: true,
        onChainExpiry: true,
        createdAt: true,
      },
    })
    if (!ngo) {
      const err = new Error('NGO not found')
      err.status = 404
      throw err
    }
    res.json(ngo)
  } catch (e) {
    next(e)
  }
})

export default router
