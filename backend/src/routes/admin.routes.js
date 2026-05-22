// routes/admin.routes.js
//
// All Bank Islam admin endpoints. JWT-protected via requireAdmin.
// These are the only endpoints where the higher-privilege bank-islam
// wallet is loaded into the call path (Section 9).
//
// POST  /api/admin/login                    — exchange password for JWT
// POST  /api/admin/ngo/:id/approve          — Stage 4 KYC approval
// POST  /api/admin/ngo/:id/renew            — Stage 5 annual renewal
// POST  /api/admin/ngo/:id/revoke           — permanent revocation
// POST  /api/admin/vendor/:id/approve       — addApprovedVendor()
// POST  /api/admin/vendor/:id/reject        — soft reject (off-chain only)
// GET   /api/admin/alerts                   — Bank Islam dashboard feed
// GET   /api/admin/evidence/pending         — disbursements awaiting review

import { Router } from 'express'
import crypto from 'node:crypto'
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

const router = Router()

// --- Login (open) -------------------------------------------------------
// Demo: passwords are stored as sha256(salt + plaintext). For production
// switch to argon2id. Hackathon scope tradeoff (Section 21).
function checkPassword(plaintext, storedHash) {
  const [salt, expected] = (storedHash || '').split(':')
  if (!salt || !expected) return false
  const actual = crypto
    .createHash('sha256')
    .update(salt + plaintext)
    .digest('hex')
  return actual === expected
}

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

// --- All routes below require an admin JWT -----------------------------
router.use(requireAdmin)

// NGO KYC
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

// Vendor KYC
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

// Dashboard reads
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

// ---------------------------------------------------------------------------
// Campaign deployment — POST /api/admin/campaign/create
//
// Deploys a fresh Campaign.sol signed by the Bank Islam wallet, persists the
// row in Postgres, and attaches the on-chain event listener so reconciliation
// runs from this point forward (Section 17 listeners/contract.listener.js).
// ---------------------------------------------------------------------------
router.post(
  '/campaign/create',
  requireRole('SUPER_ADMIN'),
  validate({
    ngoId: { type: 'string', required: true },
    name: { type: 'string', required: true, min: 3, max: 200 },
    causeType: { type: 'string', required: true, min: 2, max: 100 },
    description: { type: 'string', required: false, max: 2000 },
    aidPercent: { type: 'integer', required: true, min: 0, max: 100 },
    logisticsPercent: { type: 'integer', required: true, min: 0, max: 100 },
    adminPercent: { type: 'integer', required: true, min: 0, max: 100 },
    targetAmount: { type: 'number', required: true, min: 1 },
    endDate: { type: 'string', required: true },
  }),
  async (req, res, next) => {
    try {
      const {
        ngoId,
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

      const ngo = await prisma.nGO.findUnique({ where: { id: ngoId } })
      if (!ngo || ngo.status !== 'APPROVED') {
        const err = new Error('NGO must be Bank Islam-approved before deploying a campaign')
        err.status = 400
        throw err
      }

      // Section 8 — Bank Islam wallet signs the deploy and becomes the owner
      const { contractAddress, deployTxHash } = await contractService.deployCampaign({
        ngoWalletAddress: ngo.walletAddress,
        name,
        causeType,
        aidPercent,
        logisticsPercent,
        adminPercent,
        targetAmount,
        endDate,
      })

      const campaign = await prisma.campaign.create({
        data: {
          ngoId,
          name,
          causeType,
          description: description || '',
          aidPercent,
          logisticsPercent,
          adminPercent,
          targetAmount,
          endDate: new Date(endDate),
          contractAddress,
          deployTxHash,
          status: 'ACTIVE',
        },
      })

      // Hook the listener so on-chain pause/approve events reconcile to Postgres
      try {
        attachCampaignListener(contractAddress, campaign.id)
      } catch (e) {
        console.warn('[admin] listener attach failed:', e.message)
      }

      res.status(201).json({
        campaignId: campaign.id,
        contractAddress,
        deployTxHash,
        status: campaign.status,
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
