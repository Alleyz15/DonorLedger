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
  vendorId: { type: 'string', required: true },
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
        vendorId,
      } = req.body

      if (aidPercent + logisticsPercent + adminPercent !== 100) {
        const err = new Error('Allocation percentages must sum to 100')
        err.status = 400
        throw err
      }

      const vendor = await prisma.vendor.findFirst({
        where: {
          id: vendorId,
          ngoId: ngo.id,
          status: 'APPROVED',
        },
        select: { id: true },
      })

      if (!vendor) {
        const err = new Error('Approved vendor is required before submitting a campaign')
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
          status: 'UNDER_REVIEW',
          vendors: {
            connect: { id: vendor.id },
          },
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

// Save a partial campaign as DRAFT — no vendor or allocation required.
// NGO can return later to complete and submit for Bank Islam review.
router.post('/campaign/save-draft', requireNGO, async (req, res, next) => {
  try {
    const ngo = await prisma.nGO.findUnique({ where: { id: req.ngo.sub } })
    if (!ngo) {
      const err = new Error('NGO not found')
      err.status = 404
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

    if (!name || String(name).trim().length < 2) {
      const err = new Error('Campaign title is required to save a draft')
      err.status = 400
      throw err
    }

    const campaign = await prisma.campaign.create({
      data: {
        ngoId: ngo.id,
        name: String(name).trim(),
        causeType: causeType || 'Uncategorised',
        description: description || '',
        aidPercent:        Number(aidPercent)        || 80,
        logisticsPercent:  Number(logisticsPercent)  || 10,
        adminPercent:      Number(adminPercent)       || 10,
        targetAmount:      String(Number(targetAmount) || 0),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: 'DRAFT',
      },
    })

    res.status(201).json({
      campaignId: campaign.id,
      status: campaign.status,
      message: 'Draft saved.',
    })
  } catch (e) {
    next(e)
  }
})

// Update an existing DRAFT campaign — used by "Save Draft & Exit" and
// "Submit for Bank Review" when editing. Only allowed while status is DRAFT.
router.patch('/campaign/:id', requireNGO, async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, ngoId: req.ngo.sub },
    })
    if (!campaign) {
      const err = new Error('Campaign not found')
      err.status = 404
      throw err
    }
    if (campaign.status !== 'DRAFT') {
      const err = new Error('Only draft campaigns can be edited')
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
      vendorId,
      submit,
    } = req.body

    const data = {}
    if (name)           data.name           = String(name).trim()
    if (causeType)      data.causeType      = causeType
    if (description !== undefined) data.description = description || ''
    if (aidPercent !== undefined)        data.aidPercent        = Number(aidPercent)
    if (logisticsPercent !== undefined)  data.logisticsPercent  = Number(logisticsPercent)
    if (adminPercent !== undefined)      data.adminPercent      = Number(adminPercent)
    if (targetAmount !== undefined)      data.targetAmount      = String(Number(targetAmount))
    if (endDate)        data.endDate        = new Date(endDate)
    // Validate allocation when submitting for Bank Islam review
    if (submit === true) {
      const aid  = Number(aidPercent      ?? campaign.aidPercent)
      const logi = Number(logisticsPercent ?? campaign.logisticsPercent)
      const adm  = Number(adminPercent    ?? campaign.adminPercent)
      if (aid + logi + adm !== 100) {
        const err = new Error(`Allocation percentages must sum to 100 (currently ${aid + logi + adm}%)`)
        err.status = 400
        throw err
      }
      data.status = 'UNDER_REVIEW'
    }

    // If submitting for review, at least one vendor must be linked
    if (submit === true) {
      const existingVendors = await prisma.campaign.findUnique({
        where: { id: campaign.id },
        select: { vendors: { select: { id: true } } },
      })
      const hasVendor = (existingVendors?.vendors?.length ?? 0) > 0 || !!vendorId
      if (!hasVendor) {
        const err = new Error('At least one approved vendor must be selected before submitting for Bank Islam review')
        err.status = 400
        throw err
      }
    }

    // If a vendor is provided, connect it to the campaign
    const updatePayload = vendorId
      ? { ...data, vendors: { connect: { id: vendorId } } }
      : data

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: updatePayload,
    })

    res.json({
      campaignId: updated.id,
      status: updated.status,
      message: 'Draft updated.',
    })
  } catch (e) {
    next(e)
  }
})

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
        evidence: {
          select: {
            status: true,
            amount: true,
          },
        },
      },
    })
    res.json(
      campaigns.map((c) => {
        const reservedAmount = c.evidence
          .filter((item) => item.status !== 'REJECTED')
          .reduce((sum, item) => sum + Number(item.amount), 0)
        const pendingEvidenceCount = c.evidence.filter((item) =>
          ['PENDING_AI', 'PENDING_REVIEW', 'AUTO_FROZEN'].includes(item.status)
        ).length
        const raisedAmount = Number(c.raisedAmount)
        const { evidence, ...campaign } = c

        return {
          ...campaign,
          targetAmount: Number(c.targetAmount),
          raisedAmount,
          reservedAmount,
          availableAmount: Math.max(raisedAmount - reservedAmount, 0),
          pendingEvidenceCount,
        }
      })
    )
  } catch (e) {
    next(e)
  }
})

router.get('/campaigns/:id', requireNGO, async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        ngoId: req.ngo.sub,
      },
      select: {
        id: true,
        name: true,
        causeType: true,
        description: true,
        aidPercent: true,
        logisticsPercent: true,
        adminPercent: true,
        targetAmount: true,
        raisedAmount: true,
        donorCount: true,
        endDate: true,
        status: true,
        createdAt: true,
      },
    })

    if (!campaign) {
      const err = new Error('Campaign not found')
      err.status = 404
      throw err
    }

    res.json({
      ...campaign,
      targetAmount: Number(campaign.targetAmount),
      raisedAmount: Number(campaign.raisedAmount),
    })
  } catch (e) {
    next(e)
  }
})

router.get('/vendors', requireNGO, async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim().toUpperCase()
    const where = {
      ngoId: req.ngo.sub,
      ...(status ? { status } : {}),
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        ssmNumber: true,
        serviceType: true,
        walletAddress: true,
        status: true,
        createdAt: true,
      },
    })

    res.json(vendors)
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
