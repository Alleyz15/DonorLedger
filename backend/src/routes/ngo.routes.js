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
import storageService from '../services/storage.service.js'

const router = Router()

function toUploadUrl(absPath) {
  if (!absPath) return null
  const normalized = absPath.replace(/\\/g, '/')
  const marker = '/uploads/'
  const index = normalized.lastIndexOf(marker)
  return index >= 0 ? normalized.slice(index) : null
}

function getEvidenceProcessAt(evidence) {
  if (['APPROVED', 'CONFIRMED'].includes(evidence.status)) {
    return evidence.approvedAt
  }
  if (['REJECTED', 'AUTO_FROZEN'].includes(evidence.status)) {
    return evidence.updatedAt
  }
  return null
}

function getEvidenceDocuments(evidence) {
  const docs = [
    ['ssmDoc', 'SSM Document', evidence.ssmDoc],
    ['serviceAgreement', 'Service Agreement', evidence.serviceAgreement],
    ['invoice', 'Invoice', evidence.invoice],
    ['deliveryProof', 'Delivery Proof', evidence.deliveryProof],
    ['recipientConfirm', 'Recipient Confirmation', evidence.recipientConfirm],
  ]

  return docs
    .map(([key, label, path]) => ({
      key,
      label,
      name: path ? path.replace(/\\/g, '/').split('/').pop() : null,
      url: toUploadUrl(path),
    }))
    .filter((doc) => doc.url)
}

function serializeEvidence(evidence) {
  return {
    id: evidence.id,
    title: evidence.title || null,
    campaignId: evidence.campaignId,
    campaignName: evidence.campaign?.name || 'Campaign',
    vendorId: evidence.vendorId,
    vendorName: evidence.vendor?.name || 'Vendor',
    vendorServiceType: evidence.vendor?.serviceType || null,
    category: evidence.category,
    amount: Number(evidence.amount),
    status: evidence.status,
    submittedAt: evidence.createdAt,
    processAt: getEvidenceProcessAt(evidence),
    approvedAt: evidence.approvedAt,
    rejectedReason: evidence.rejectedReason,
    packageHash: evidence.packageHash,
    documents: getEvidenceDocuments(evidence),
  }
}

function sumEvidenceAmount(evidence, statuses) {
  return evidence
    .filter((item) => statuses.includes(item.status))
    .reduce((sum, item) => sum + Number(item.amount), 0)
}

function buildCampaignClaimSummary(campaign) {
  const evidence = campaign.evidence || []
  const totalReceived = Number(campaign.raisedAmount || 0)
  const approvedClaimAmount = sumEvidenceAmount(evidence, ['APPROVED', 'CONFIRMED'])
  const pendingClaimAmount = sumEvidenceAmount(evidence, ['PENDING_REVIEW', 'AUTO_FROZEN'])
  const rejectedClaimAmount = sumEvidenceAmount(evidence, ['REJECTED'])
  const reservedAmount = approvedClaimAmount + pendingClaimAmount
  const availableAmount = Math.max(totalReceived - reservedAmount, 0)

  return {
    totalReceived,
    approvedClaimAmount,
    pendingClaimAmount,
    rejectedClaimAmount,
    reservedAmount,
    availableAmount,
    pendingEvidenceCount: evidence.filter((item) =>
      ['PENDING_REVIEW', 'AUTO_FROZEN'].includes(item.status)
    ).length,
  }
}

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

router.post(
  '/register',
  // Section 11 — registration form ships as multipart/form-data so the
  // SSM/ROS certificate and audited financial statement can be attached
  // alongside the rest of the application package.
  storageService.ngoRegistrationUploader.fields([
    { name: 'registrationDoc', maxCount: 1 },
    { name: 'financialDoc', maxCount: 1 },
  ]),
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { password, ...application } = req.body

      // Board of directors — Director 1 fields are unsuffixed
      // (directorName/directorMyKad), additional directors are numbered
      // (directorName2/directorMyKad2, ...).
      const directors = []
      if (application.directorName || application.directorMyKad) {
        directors.push({
          name: application.directorName || '',
          mykad: application.directorMyKad || '',
        })
      }
      let directorIndex = 2
      while (
        application[`directorName${directorIndex}`] ||
        application[`directorMyKad${directorIndex}`]
      ) {
        directors.push({
          name: application[`directorName${directorIndex}`] || '',
          mykad: application[`directorMyKad${directorIndex}`] || '',
        })
        directorIndex += 1
      }

      const ngo = await kycService.submitNGOApplication({
        name: application.name,
        registrationNum: application.registrationNum,
        walletAddress: application.walletAddress || undefined,
        contactEmail: application.contactEmail,
        contactPhone: application.contactPhone,
        passwordHash: password ? hashPassword(password) : undefined,
        registrationType: application.registrationType,
        registeredAddress: application.registeredAddress,
        directors,
        bankAccount: application.bankAccount,
        bankName: application.bankName,
        causeType: application.causeType,
        description: application.description,
        aidPercent: application.aidPercent !== undefined ? Number(application.aidPercent) : undefined,
        logisticsPercent: application.logisticsPercent !== undefined ? Number(application.logisticsPercent) : undefined,
        adminPercent: application.adminPercent !== undefined ? Number(application.adminPercent) : undefined,
        registrationDoc: req.files?.registrationDoc?.[0]
          ? storageService.relativeUploadPath(req.files.registrationDoc[0].path)
          : undefined,
        financialDoc: req.files?.financialDoc?.[0]
          ? storageService.relativeUploadPath(req.files.financialDoc[0].path)
          : undefined,
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
  }
)

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
          ['PENDING_REVIEW', 'AUTO_FROZEN'].includes(item.status)
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
        evidence: {
          select: {
            status: true,
            amount: true,
          },
        },
      },
    })

    if (!campaign) {
      const err = new Error('Campaign not found')
      err.status = 404
      throw err
    }

    const claimSummary = buildCampaignClaimSummary(campaign)
    const { evidence, ...campaignData } = campaign

    res.json({
      ...campaignData,
      targetAmount: Number(campaign.targetAmount),
      raisedAmount: Number(campaign.raisedAmount),
      claimSummary,
      reservedAmount: claimSummary.reservedAmount,
      availableAmount: claimSummary.availableAmount,
      pendingEvidenceCount: claimSummary.pendingEvidenceCount,
    })
  } catch (e) {
    next(e)
  }
})

router.get('/evidence', requireNGO, async (req, res, next) => {
  try {
    const evidence = await prisma.evidence.findMany({
      where: {
        campaign: {
          ngoId: req.ngo.sub,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true, serviceType: true } },
      },
    })

    res.json(evidence.map(serializeEvidence))
  } catch (e) {
    next(e)
  }
})

router.get('/evidence/:id', requireNGO, async (req, res, next) => {
  try {
    const evidence = await prisma.evidence.findFirst({
      where: {
        id: req.params.id,
        campaign: {
          ngoId: req.ngo.sub,
        },
      },
      include: {
        campaign: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true, serviceType: true } },
      },
    })

    if (!evidence) {
      const err = new Error('Evidence not found')
      err.status = 404
      throw err
    }

    res.json(serializeEvidence(evidence))
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
        approvedAt: true,
        rejectedReason: true,
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
