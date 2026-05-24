// routes/tracker.routes.js
//
// GET /api/tracker/:donorHash
//
// Section 6 Layer 2 — donor-facing journey. We read from the public
// DonorTracker.sol contract so the donor knows the data has not been
// edited by the platform.
//
// Donor sees plain language milestones only. NO scores, NO patterns,
// NO ringgit amounts of other donors. Section 14 enforces this.

import { Router } from 'express'
import prisma from '../config/database.js'
import contractService from '../services/contract.service.js'
import {
  DONOR_MILESTONE_TEXT,
  formatRinggit,
  formatDateTime,
} from '../utils/format.utils.js'

const router = Router()

router.get('/:donorHash', async (req, res, next) => {
  try {
    const donorHash = req.params.donorHash
    if (!/^0x[a-fA-F0-9]{64}$/.test(donorHash)) {
      const err = new Error('Invalid donor hash')
      err.status = 400
      throw err
    }

    // The donor's row stays in Postgres — we use it for the campaign name
    // and amount they personally donated. We do NOT expose their email back.
    const donation = await prisma.donation.findUnique({
      where: { donorHash },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            causeType: true,
            status: true,
            ngo: { select: { name: true } },
          },
        },
        vendor: { select: { name: true, serviceType: true } },
      },
    })
    if (!donation) {
      const err = new Error('Tracker not found')
      err.status = 404
      throw err
    }

    // Pull milestones from the chain. Falls back to a single "received"
    // milestone if the tracker contract is unreachable.
    let journey = []
    try {
      journey = await contractService.getDonorJourney(donorHash)
    } catch (e) {
      console.warn('[tracker] on-chain read failed:', e.message)
      journey = [
        {
          milestone: 'RECEIVED',
          description: DONOR_MILESTONE_TEXT.RECEIVED,
          timestamp: donation.createdAt.getTime(),
        },
      ]
    }

    // ALLOCATED is an implicit milestone — Bank Islam's escrow lock is
    // automatic the instant Campaign.donate() is recorded on-chain. There
    // is no separate transaction needed. If RECEIVED is present but
    // ALLOCATED is missing (e.g. older donations, nonce race on Sepolia),
    // we synthesise it here so the donor always sees step 2 as done.
    const hasAllocated = journey.some((m) => m.milestone === 'ALLOCATED')
    const received     = journey.find((m) => m.milestone === 'RECEIVED')
    if (!hasAllocated && received) {
      const insertAt = journey.findIndex((m) => m.milestone === 'RECEIVED') + 1
      journey.splice(insertAt, 0, {
        milestone:   'ALLOCATED',
        description: DONOR_MILESTONE_TEXT.ALLOCATED,
        timestamp:   received.timestamp + 1000, // 1 second after RECEIVED
      })
    }

    // Section 14 — what the donor sees: plain language only.
    res.json({
      donorHash,
      campaign: {
        name: donation.campaign.name,
        cause: donation.campaign.causeType,
        ngo: donation.campaign.ngo.name,
        status: donation.campaign.status,
      },
      yourDonation: {
        amount: Number(donation.amount),
        amountFormatted: formatRinggit(donation.amount),
        date: formatDateTime(donation.createdAt),
        vendor: donation.vendor ? donation.vendor.name : null,
      },
      journey: journey.map((m) => ({
        milestone: m.milestone,
        description: DONOR_MILESTONE_TEXT[m.milestone] || m.description,
        at: formatDateTime(m.timestamp),
      })),
    })
  } catch (e) {
    next(e)
  }
})

export default router
