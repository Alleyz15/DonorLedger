// routes/donate.routes.js
//
// POST /api/donate
//
// Section 10, Steps 1-2 of the bridge flow. Frontend hits this when the
// donor clicks "Donate via DuitNow". In the demo we accept the payload
// directly; in production a Bank Islam webhook calls /api/demo/simulate-duitnow
// which proxies into this same code path.

import { Router } from 'express'
import { validate } from '../middleware/validate.middleware.js'
import prisma from '../config/database.js'
import bridgeService from '../services/bridge.service.js'

const router = Router()

const donateSchema = {
  campaignId: { type: 'string', required: true, min: 1 },
  donorEmail: { type: 'email', required: true },
  donorName: { type: 'string', required: false, max: 200 },
  amount: { type: 'number', required: true, min: 1 },
  vendorId: { type: 'string', required: false },
}

router.get('/history', async (req, res, next) => {
  try {
    const donorEmail = String(req.query.donorEmail || '').trim().toLowerCase()
    if (!donorEmail) {
      const err = new Error('donorEmail is required')
      err.status = 400
      throw err
    }

    const donations = await prisma.donation.findMany({
      where: { donorEmail },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            causeType: true,
            ngo: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalAmount = donations.reduce(
      (sum, donation) => sum + Number(donation.amount),
      0
    )
    const charities = new Set(donations.map((donation) => donation.campaign.ngo.id))
    const causeTypes = [...new Set(donations.map((donation) => donation.campaign.causeType))]

    res.json({
      summary: {
        totalAmount,
        charitiesSupported: charities.size,
        donationDiversity: causeTypes,
      },
      donations: donations.map((donation) => ({
        id: donation.id,
        donorHash: donation.donorHash,
        campaignId: donation.campaignId,
        campaignName: donation.campaign.name,
        causeType: donation.campaign.causeType,
        ngoName: donation.campaign.ngo.name,
        amount: Number(donation.amount),
        trackerUrl: donation.trackerUrl,
        txHash: donation.txHash,
        createdAt: donation.createdAt,
      })),
    })
  } catch (e) {
    next(e)
  }
})

router.post('/', validate(donateSchema), async (req, res, next) => {
  try {
    const result = await bridgeService.processDuitNowPayment(req.body)
    res.status(201).json(result)
  } catch (e) {
    next(e)
  }
})

export default router
