// services/bridge.service.js
//
// DuitNow → Blockchain bridge. Section 10 — the full eleven-step flow.
//
// Ringgit never converts to crypto. Bank Islam holds the actual MYR in
// escrow. This service writes a shadow audit record on Sepolia so that
// the donor (and MACC) can verify every cent independently.
//
// For the hackathon demo, /api/demo/simulate-duitnow calls this directly.
// In production, this is triggered by a Bank Islam webhook on real
// DuitNow payment receipt.

import prisma from '../config/database.js'
import contractService from './contract.service.js'
import { createDonorHash } from '../utils/hash.utils.js'
import { DONOR_MILESTONE_TEXT } from '../utils/format.utils.js'

/**
 * Process a successful (simulated) DuitNow payment.
 *
 * @param {object} args
 * @param {string} args.campaignId    DonorLedger Campaign.id (cuid)
 * @param {string} args.donorEmail    raw email — kept in Postgres only
 * @param {string} [args.donorName]   optional display name
 * @param {number} args.amount        ringgit (decimal, 2 places)
 * @param {string} [args.vendorId]    donor-selected vendor (Section 12)
 * @param {string} [args.duitNowRef]  reference returned by DuitNow
 */
export async function processDuitNowPayment({
  campaignId,
  donorEmail,
  donorName,
  amount,
  vendorId,
  duitNowRef,
}) {
  // Step 4-ish: load the campaign + selected vendor
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { vendors: { where: { id: vendorId || undefined } } },
  })
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.status = 404
    throw err
  }
  if (campaign.status === 'FROZEN') {
    const err = new Error('Campaign is currently frozen — donations paused')
    err.status = 423
    throw err
  }

  let vendor = null
  if (vendorId) {
    vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
    if (!vendor || vendor.status !== 'APPROVED') {
      const err = new Error('Selected vendor is not Bank Islam-approved')
      err.status = 400
      throw err
    }
  }

  // Step 5 — anonymise the donor before anything touches the chain
  const timestamp = Date.now()
  const donorHash = createDonorHash(donorEmail, campaignId, timestamp)

  // Step 6 — on-chain donation (server wallet, lower privilege)
  const { txHash } = await contractService.recordDonation({
    campaignAddress: campaign.contractAddress,
    donorHash,
    amount,
    vendorAddress: vendor ? vendor.walletAddress : null,
  })

  // Step 8 — donor-facing milestone (plain English, no terminology)
  try {
    await contractService.updateDonorMilestone({
      donorHash,
      milestone: 'RECEIVED',
      description: DONOR_MILESTONE_TEXT.RECEIVED,
    })
  } catch (e) {
    // Tracker update should never block the donation record
    console.error('[bridge] tracker update failed:', e.message)
  }

  // Step 9 — persist the off-chain row (donor PII stays here only)
  const donation = await prisma.donation.create({
    data: {
      donorHash,
      donorEmail,
      donorName,
      campaignId,
      vendorId: vendor ? vendor.id : null,
      amount,
      duitNowRef,
      txHash,
      trackerUrl: buildTrackerUrl(donorHash),
    },
  })

  // Update aggregate counters used by the GoFundMe-style display (Section 6)
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      raisedAmount: { increment: amount },
      donorCount: { increment: 1 },
    },
  })

  // Step 10 — what we return to the frontend
  return {
    donationId: donation.id,
    txHash,
    trackerUrl: donation.trackerUrl,
    donorHash,
  }
}

function buildTrackerUrl(donorHash) {
  // The donor sees a URL — never blockchain terms. Section 6 Layer 2.
  return `/track/${donorHash}`
}

export default { processDuitNowPayment }
