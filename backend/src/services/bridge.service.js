// services/bridge.service.js
//
// DuitNow -> blockchain bridge. Ringgit never converts to crypto; Bank Islam
// holds MYR in escrow while this service writes the public audit record.

import prisma from '../config/database.js'
import contractService from './contract.service.js'
import { createDonorHash } from '../utils/hash.utils.js'
import { DONOR_MILESTONE_TEXT } from '../utils/format.utils.js'

export async function processDuitNowPayment({
  campaignId,
  donorEmail,
  donorName,
  amount,
  vendorId,
  duitNowRef,
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { vendors: { where: { id: vendorId || undefined } } },
  })
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.status = 404
    throw err
  }
  if (campaign.status !== 'ACTIVE') {
    const err = new Error('Campaign is not active for donations')
    err.status = 423
    throw err
  }
  if (!campaign.contractAddress) {
    const err = new Error('Campaign has not been deployed on-chain yet')
    err.status = 409
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

  const timestamp = Date.now()
  const donorHash = createDonorHash(donorEmail, campaignId, timestamp)

  const { txHash } = await contractService.recordDonation({
    campaignAddress: campaign.contractAddress,
    donorHash,
    amount,
    vendorAddress: vendor ? vendor.walletAddress : null,
  })

  // Section 6 Layer 2 — Step 1: donor's payment received by Bank Islam.
  try {
    await contractService.updateDonorMilestone({
      donorHash,
      milestone: 'RECEIVED',
      description: DONOR_MILESTONE_TEXT.RECEIVED,
    })
  } catch (e) {
    console.error('[bridge] tracker update failed:', e.message)
  }

  // Step 2 — Bank Islam's escrow lock. This is written as its own on-chain
  // record immediately after RECEIVED: Campaign.donate() landing on-chain
  // IS the escrow lock, so we record it as a real, separately-timestamped
  // milestone rather than implying it on the tracker page.
  try {
    await contractService.updateDonorMilestone({
      donorHash,
      milestone: 'ALLOCATED',
      description: DONOR_MILESTONE_TEXT.ALLOCATED,
    })
  } catch (e) {
    console.error('[bridge] tracker update failed:', e.message)
  }

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

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      raisedAmount: { increment: amount },
      donorCount: { increment: 1 },
    },
  })

  return {
    donationId: donation.id,
    txHash,
    trackerUrl: donation.trackerUrl,
    donorHash,
  }
}

function buildTrackerUrl(donorHash) {
  return `/donor-history.html?highlight=${donorHash}`
}

export default { processDuitNowPayment }
