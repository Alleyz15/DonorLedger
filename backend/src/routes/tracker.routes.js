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
    // milestone if the tracker contract is unreachable — this fallback is
    // clearly flagged via `chainAvailable` below so it is never presented
    // to the donor as verified on-chain data.
    let journey = []
    let chainAvailable = true
    try {
      journey = await contractService.getDonorJourney(donorHash)
    } catch (e) {
      console.warn('[tracker] on-chain read failed:', e.message)
      chainAvailable = false
      journey = [
        {
          milestone: 'RECEIVED',
          description: DONOR_MILESTONE_TEXT.RECEIVED,
          timestamp: donation.createdAt.getTime(),
        },
      ]
    }

    // ALLOCATED is now written on-chain as its own milestone immediately
    // after RECEIVED (Section 6 Layer 2 — see bridge.service.js). For
    // donations made before this change, ALLOCATED may be missing from the
    // chain history — synthesise it from RECEIVED only in that legacy case
    // so older donor trackers don't show a missing step.
    const hasAllocated = journey.some((m) => m.milestone === 'ALLOCATED')
    const received     = journey.find((m) => m.milestone === 'RECEIVED')
    if (chainAvailable && !hasAllocated && received) {
      const insertAt = journey.findIndex((m) => m.milestone === 'RECEIVED') + 1
      journey.splice(insertAt, 0, {
        milestone:   'ALLOCATED',
        description: DONOR_MILESTONE_TEXT.ALLOCATED,
        timestamp:   received.timestamp + 1000, // 1 second after RECEIVED
      })
    }

    // Cross-check the donated amount stored in Postgres against the
    // DonationReceived event recorded on-chain for this donation's tx.
    // null = could not verify (no txHash / chain unreachable).
    const amountVerified = await contractService.verifyDonationAmount(
      donation.txHash,
      donation.amount
    )

    // Section 14 — transparency note for step 3 "Funds Released" while
    // it is still pending. We never use the word "rejected" to donors
    // (a false-positive review on a legitimate NGO should not alarm
    // donors) — instead we surface a neutral status: Bank Islam asked
    // for more documentation, and whether the NGO has since resubmitted.
    let evidenceNote = null
    const hasReleased = journey.some((m) => m.milestone === 'RELEASED')
    if (!hasReleased) {
      const evidenceList = await prisma.evidence.findMany({
        where: {
          campaignId: donation.campaign.id,
          ...(donation.vendorId ? { vendorId: donation.vendorId } : {}),
        },
        orderBy: { createdAt: 'asc' },
        select: { status: true },
      })
      const lastRejectedIndex = evidenceList
        .map((e) => e.status)
        .lastIndexOf('REJECTED')
      if (lastRejectedIndex !== -1) {
        const resubmitted = lastRejectedIndex < evidenceList.length - 1
        evidenceNote = resubmitted
          ? 'NGO has submitted updated evidence — Bank Islam is reviewing.'
          : 'Bank Islam requested additional documentation from the NGO.'
      }
    }

    // Section 14 — what the donor sees: plain language only.
    res.json({
      donorHash,
      chainAvailable,
      amountVerified,
      evidenceNote,
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
