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
  '/ngo/:id/reject',
  requireRole('KYC_REVIEWER', 'SUPER_ADMIN'),
  validate({ reason: { type: 'string', required: true, min: 3 } }),
  async (req, res, next) => {
    try {
      // revokedReason is reused for rejection reason — schema has one field
      // for both REJECTED and REVOKED states. The status field disambiguates.
      const ngo = await prisma.nGO.update({
        where: { id: req.params.id },
        data: {
          status: 'REJECTED',
          revokedReason: req.body.reason,
          kycApprovedBy: req.admin.sub,
        },
      })
      res.json(ngo)
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/ngo/:id/renew',
  requireRole('SUPER_ADMIN'),
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
  validate({ campaignId: { type: 'string', required: false } }),
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

// GET /admin/ngos — list all NGOs for Bank Islam dashboard
router.get('/ngos', async (req, res, next) => {
  try {
    const ngos = await prisma.nGO.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        registrationNum: true,
        contactEmail: true,
        riskTier: true,
        status: true,
        kycNotes: true,
        kycApprovedAt: true,
        onChainExpiry: true,
        revokedReason: true,
        createdAt: true,
        _count: { select: { campaigns: true } },
      },
    })
    res.json(ngos)
  } catch (e) {
    next(e)
  }
})

router.get('/vendors', async (req, res, next) => {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        ssmNumber: true,
        serviceType: true,
        bankAccount: true,
        walletAddress: true,
        registrationDoc: true,
        status: true,
        approvedAt: true,
        rejectedReason: true,
        createdAt: true,
        ngo: {
          select: {
            id: true,
            name: true,
            registrationNum: true,
            status: true,
          },
        },
      },
    })

    res.json(vendors.map((v) => ({
      ...v,
      registrationDoc: toUploadUrl(v.registrationDoc),
    })))
  } catch (e) {
    next(e)
  }
})

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

// Convert an absolute upload path (stored in DB) to a browser-accessible URL.
// e.g. "D:\...\uploads\invoices\file.pdf" → "/uploads/invoices/file.pdf"
function toUploadUrl(absPath) {
  if (!absPath) return null
  const normalized = absPath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/uploads/')
  if (idx >= 0) return normalized.slice(idx)
  return '/uploads/' + normalized.split('/').pop()
}

router.get('/evidence/pending', async (req, res, next) => {
  try {
    // Include APPROVED so the Bank Islam UI can show the "Confirm Beneficiary
    // Receipt" button — Gate 4 independent SMS confirmation step (Section 13).
    const items = await prisma.evidence.findMany({
      where: { status: { in: ['PENDING_REVIEW', 'AUTO_FROZEN', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true, status: true } },
        vendor: { select: { id: true, name: true, serviceType: true } },
      },
    })

    // Map document paths to HTTP-accessible URLs so the Bank Admin
    // frontend can open the actual PDFs that NGOs submitted (Gate 4 —
    // Section 15 Limitation 2: human spot-check of uploaded documents).
    res.json(items.map((item) => ({
      ...item,
      amount: Number(item.amount),
      documents: {
        ssmDoc:           toUploadUrl(item.ssmDoc),
        serviceAgreement: toUploadUrl(item.serviceAgreement),
        invoice:          toUploadUrl(item.invoice),
        deliveryProof:    toUploadUrl(item.deliveryProof),
        recipientConfirm: toUploadUrl(item.recipientConfirm),
      },
    })))
  } catch (e) {
    next(e)
  }
})

// Specific routes MUST come before /campaign/:id — Express matches top-down.
// /campaign/pending would be swallowed by /:id if placed after it (id="pending" → 404).
router.get('/campaigns', async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { status: { not: 'DRAFT' } },
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

router.get('/campaign/pending', async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'UNDER_REVIEW' },
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

router.get('/campaign/:id', async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
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
        vendors: {
          select: {
            id: true,
            name: true,
            serviceType: true,
            status: true,
            walletAddress: true,
          },
        },
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

router.post(
  '/campaign/:id/approve',
  requireRole('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
        include: { ngo: true, vendors: true },
      })
      if (!campaign) {
        const err = new Error('Campaign not found')
        err.status = 404
        throw err
      }
      if (campaign.status !== 'UNDER_REVIEW') {
        const err = new Error('Only campaigns submitted for review can be approved')
        err.status = 409
        throw err
      }
      if (campaign.ngo.status !== 'APPROVED') {
        const err = new Error('NGO must be approved before campaign approval')
        err.status = 400
        throw err
      }

      // Guard against placeholder wallets generated when NGO registered
      // without providing a real address (kyc.service.js createInternalAuditAddress).
      // A placeholder deployed as ngoWalletAddress means nobody controls
      // that identity on-chain — block approval until a real wallet is set.
      if (!campaign.ngo.walletAddress || campaign.ngo.walletAddress === '0x0000000000000000000000000000000000000000') {
        const err = new Error('NGO does not have a valid wallet address — update before approving campaign')
        err.status = 400
        throw err
      }

      let contractAddress = campaign.contractAddress
      let deployTxHash = campaign.deployTxHash

      if (!contractAddress) {
        const deployed = await contractService.deployCampaign({
          ngoWalletAddress: campaign.ngo.walletAddress,
          name: campaign.name,
          causeType: campaign.causeType,
          aidPercent: campaign.aidPercent,
          logisticsPercent: campaign.logisticsPercent,
          adminPercent: campaign.adminPercent,
          targetAmount: Number(campaign.targetAmount),
          endDate: campaign.endDate,
        })
        contractAddress = deployed.contractAddress
        deployTxHash = deployed.deployTxHash
      }

      for (const vendor of campaign.vendors) {
        if (vendor.status !== 'APPROVED' || !vendor.walletAddress) continue
        const alreadyApproved = await contractService.isVendorApproved(
          contractAddress,
          vendor.walletAddress
        )
        if (!alreadyApproved) {
          await contractService.addApprovedVendor(
            contractAddress,
            vendor.walletAddress
          )
        }
      }

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          contractAddress,
          deployTxHash,
          status: 'ACTIVE',
          pausedReason: null,
        },
      })

      if (contractAddress) try {
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
      if (campaign.status !== 'UNDER_REVIEW') {
        const err = new Error('Only campaigns submitted for review can be rejected')
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

router.post(
  '/campaign/:id/unfreeze',
  requireRole('SUPER_ADMIN'),
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
      if (campaign.status !== 'FROZEN') {
        const err = new Error('Only frozen campaigns can be unfrozen')
        err.status = 409
        throw err
      }

      let txHash = null
      if (campaign.contractAddress) {
        const result = await contractService.unpauseCampaign(campaign.contractAddress)
        txHash = result.txHash
      }

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'ACTIVE',
          pausedReason: null,
        },
      })

      res.json({
        campaignId: updated.id,
        status: updated.status,
        txHash,
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
      // Explicit select — never return passwordHash to any API consumer
      select: {
        id: true,
        name: true,
        registrationNum: true,
        contactEmail: true,
        contactPhone: true,
        walletAddress: true,
        riskTier: true,
        status: true,
        kycNotes: true,
        createdAt: true,
      },
    })
    res.json(ngos)
  } catch (e) {
    next(e)
  }
})

// Duplicate GET /ngos removed — the full-detail version at line 162 is the
// correct one. This minimal version was dead code (Express always matched
// the first /ngos route above it).

export default router
