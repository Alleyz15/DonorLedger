// routes/campaign.routes.js
//
// Public read endpoints. The crowdfunding progress numbers come from the
// off-chain mirror table — but the underlying figures were written into
// the DB only after the corresponding on-chain donation succeeded. The
// frontend can optionally hit /api/tracker/:donorHash to verify against
// the chain directly (Section 6 — "every number is derived from immutable
// blockchain records").

import { Router } from 'express'
import prisma from '../config/database.js'
import contractService from '../services/contract.service.js'
import { formatPercent, formatRinggit } from '../utils/format.utils.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status || 'ACTIVE'
    const campaigns = await prisma.campaign.findMany({
      where: status === 'ALL' ? {} : { status },
      include: { ngo: { select: { name: true, riskTier: true } } },
      orderBy: { createdAt: 'desc' },
    })

    res.json(
      campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        causeType: c.causeType,
        ngoName: c.ngo.name,
        ngoRiskTier: c.ngo.riskTier,
        target: Number(c.targetAmount),
        targetFormatted: formatRinggit(c.targetAmount),
        raised: Number(c.raisedAmount),
        raisedFormatted: formatRinggit(c.raisedAmount),
        donorCount: c.donorCount,
        progressPercent: formatPercent(
          c.targetAmount > 0
            ? Number(c.raisedAmount) / Number(c.targetAmount)
            : 0
        ),
        endDate: c.endDate,
        status: c.status,
        allocation: {
          aid: c.aidPercent,
          logistics: c.logisticsPercent,
          admin: c.adminPercent,
        },
      }))
    )
  } catch (e) {
    next(e)
  }
})

router.get('/:id', async (req, res, next) => {
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
          where: { status: 'APPROVED' },
          select: {
            id: true,
            name: true,
            serviceType: true,
          },
        },
      },
    })
    if (!campaign) {
      const err = new Error('Campaign not found')
      err.status = 404
      throw err
    }

    // Optionally cross-verify with the chain — never block if the chain
    // call fails. The frontend gets the DB number with a note.
    let onChainTotals = null
    if (campaign.contractAddress) {
      try {
        onChainTotals = await contractService.readCampaignTotals(
          campaign.contractAddress
        )
      } catch (e) {
        console.warn('[campaign] on-chain read failed:', e.message)
      }
    }

    res.json({
      ...campaign,
      targetAmount: Number(campaign.targetAmount),
      raisedAmount: Number(campaign.raisedAmount),
      onChainTotals,
      raisedFormatted: formatRinggit(campaign.raisedAmount),
      targetFormatted: formatRinggit(campaign.targetAmount),
    })
  } catch (e) {
    next(e)
  }
})

router.get('/:id/vendors', async (req, res, next) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        status: 'APPROVED',
        campaigns: { some: { id: req.params.id } },
      },
      select: {
        id: true,
        name: true,
        serviceType: true,
        // Never expose bank account or full wallet — donor only needs name
      },
    })
    res.json(vendors)
  } catch (e) {
    next(e)
  }
})

export default router
