// routes/admin.routes.js
//
// Bank Islam admin endpoints. Admins review NGO KYC, campaign applications,
// evidence, and alerts. NGOs create campaign applications; Bank Islam only
// approves or rejects them.

import { Router } from 'express'
import prisma from '../config/database.js'
import kycService from '../services/kyc.service.js'
import vendorService from '../services/vendor.service.js'
import contractService from '../services/contract.service.js'
import { attachCampaignListener } from '../listeners/contract.listener.js'
import {
  requireAdmin,
  requireRole,
  signAdminToken,
} from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { checkPassword } from '../utils/password.utils.js'

const router = Router()

router.post(
  '/login',
  validate({
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 6 },
  }),
  async (req, res, next) => {
    try {
      const admin = await prisma.adminUser.findUnique({
        where: { email: req.body.email },
      })
      if (!admin || !admin.isActive || !checkPassword(req.body.password, admin.passwordHash)) {
        const err = new Error('Invalid credentials')
        err.status = 401
        throw err
      }
      const token = signAdminToken({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
      })
      res.json({ token, role: admin.role, name: admin.name })
    } catch (e) {
      next(e)
    }
  }
)

router.use(requireAdmin)

router.post(
  '/ngo/:id/approve',
  requireRole('KYC_REVIEWER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const ngo = await kycService.approveNGO({
        ngoId: req.params.id,
        adminUserId: req.admin.sub,
      })
      res.json(ngo)
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/ngo/:id/renew',
  requireRole('KYC_REVIEWER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const ngo = await kycService.renewNGOCredential({
        ngoId: req.params.id,
        adminUserId: req.admin.sub,
      })
      res.json(ngo)
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/ngo/:id/revoke',
  requireRole('SUPER_ADMIN'),
  validate({ reason: { type: 'string', required: true, min: 3 } }),
  async (req, res, next) => {
    try {
      const ngo = await kycService.revokeNGOCredential({
        ngoId: req.params.id,
        reason: req.body.reason,
        adminUserId: req.admin.sub,
      })
      res.json(ngo)
    } catch (e) {
      next(e)
    }
  }
)

// Kept for backend compatibility, but not part of the frontend demo flow.
router.post(
  '/vendor/:id/approve',
  requireRole('KYC_REVIEWER', 'SUPER_ADMIN'),
  validate({ campaignId: { type: 'string', required: true } }),
  async (req, res, next) => {
    try {
      const vendor = await vendorService.approveVendor({
        vendorId: req.params.id,
        campaignId: req.body.campaignId,
        adminUserId: req.admin.sub,
      })
      res.json(vendor)
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/vendor/:id/reject',
  requireRole('KYC_REVIEWER', 'SUPER_ADMIN'),
  validate({ reason: { type: 'string', required: true, min: 3 } }),
  async (req, res, next) => {
    try {
      const vendor = await vendorService.rejectVendor({
        vendorId: req.params.id,
        reason: req.body.reason,
        adminUserId: req.admin.sub,
      })
      res.json(vendor)
    } catch (e) {
      next(e)
    }
  }
)

router.get('/alerts', async (req, res, next) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { channel: 'BANK_ISLAM_DASHBOARD' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        campaign: { select: { id: true, name: true } },
        evidence: { select: { id: true, category: true, amount: true } },
      },
    })
    res.json(alerts)
  } catch (e) {
    next(e)
  }
})

router.get('/evidence/pending', async (req, res, next) => {
  try {
    const items = await prisma.evidence.findMany({
      where: { status: { in: ['PENDING_REVIEW', 'AUTO_FROZEN'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true, status: true } },
        vendor: { select: { id: true, name: true, serviceType: true } },
      },
    })
    res.json(items)
  } catch (e) {
    next(e)
  }
})

router.get('/campaign/pending', async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      include: {
        ngo: {
          select: {
            id: true,
            name: true,
            registrationNum: true,
            riskTier: true,
            status: true,
          },
        },
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

router.post(
  '/campaign/:id/approve',
  requireRole('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
        include: { ngo: true },
      })
      if (!campaign) {
        const err = new Error('Campaign not found')
        err.status = 404
        throw err
      }
      if (campaign.status !== 'DRAFT') {
        const err = new Error('Only draft campaign applications can be approved')
        err.status = 409
        throw err
      }
      if (campaign.ngo.status !== 'APPROVED') {
        const err = new Error('NGO must be approved before campaign approval')
        err.status = 400
        throw err
      }

      const { contractAddress, deployTxHash } = await contractService.deployCampaign({
        ngoWalletAddress: campaign.ngo.walletAddress,
        name: campaign.name,
        causeType: campaign.causeType,
        aidPercent: campaign.aidPercent,
        logisticsPercent: campaign.logisticsPercent,
        adminPercent: campaign.adminPercent,
        targetAmount: Number(campaign.targetAmount),
        endDate: campaign.endDate,
      })

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          contractAddress,
          deployTxHash,
          status: 'ACTIVE',
          pausedReason: null,
        },
      })

      try {
        attachCampaignListener(contractAddress, campaign.id)
      } catch (e) {
        console.warn('[admin] listener attach failed:', e.message)
      }

      res.json({
        campaignId: updated.id,
        contractAddress,
        deployTxHash,
        status: updated.status,
      })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/campaign/:id/reject',
  requireRole('SUPER_ADMIN'),
  validate({ reason: { type: 'string', required: true, min: 3, max: 1000 } }),
  async (req, res, next) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      })
      if (!campaign) {
        const err = new Error('Campaign not found')
        err.status = 404
        throw err
      }
      if (campaign.status !== 'DRAFT') {
        const err = new Error('Only draft campaign applications can be rejected')
        err.status = 409
        throw err
      }

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'REJECTED',
          pausedReason: req.body.reason,
        },
      })

      res.json({
        campaignId: updated.id,
        status: updated.status,
        reason: updated.pausedReason,
      })
    } catch (e) {
      next(e)
    }
  }
)

router.get('/ngo/pending', async (req, res, next) => {
  try {
    const ngos = await prisma.nGO.findMany({
      where: { status: 'PENDING_KYC' },
      orderBy: { createdAt: 'desc' },
    })
    res.json(ngos)
  } catch (e) {
    next(e)
  }
})

export default router
