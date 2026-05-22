// routes/demo.routes.js
//
// Section 18 — hackathon-only simulation endpoints. These are gated by
// env.demo.enabled so they cannot be hit in production.
//
//   POST /api/demo/simulate-duitnow    — proxy into the bridge service
//   POST /api/demo/recipient-confirm   — auto-positive SMS reply after a delay
//   POST /api/demo/simulate-fraud      — submits a fraudulent disbursement
//                                        to trigger the AI auto-freeze "wow moment"

import { Router } from 'express'
import prisma from '../config/database.js'
import bridgeService from '../services/bridge.service.js'
import contractService from '../services/contract.service.js'
import alertService from '../services/alert.service.js'
import aiService from '../services/ai.service.js'
import { env } from '../config/env.js'
import { validate } from '../middleware/validate.middleware.js'
import { hashBuffer } from '../utils/hash.utils.js'
import { DONOR_MILESTONE_TEXT } from '../utils/format.utils.js'

const router = Router()

// Gate the entire router
router.use((req, res, next) => {
  if (!env.demo.enabled) {
    return res
      .status(404)
      .json({ error: 'Demo endpoints disabled in production' })
  }
  next()
})

// --- /simulate-duitnow ---------------------------------------------------
router.post(
  '/simulate-duitnow',
  validate({
    campaignId: { type: 'string', required: true },
    donorEmail: { type: 'email', required: true },
    amount: { type: 'number', required: true, min: 1 },
    vendorId: { type: 'string', required: false },
  }),
  async (req, res, next) => {
    try {
      const result = await bridgeService.processDuitNowPayment({
        ...req.body,
        duitNowRef: `DEMO-${Date.now()}`,
      })
      res.status(201).json({
        ...result,
        message:
          'Simulated DuitNow payment received and recorded on-chain. Donor tracker is live.',
      })
    } catch (e) {
      next(e)
    }
  }
)

// --- /recipient-confirm --------------------------------------------------
// Section 13 — Bank Islam directly SMS-confirms the beneficiary. In the
// demo we auto-return YES after a configurable delay.
router.post(
  '/recipient-confirm',
  validate({ evidenceId: { type: 'string', required: true } }),
  async (req, res, next) => {
    try {
      await new Promise((r) =>
        setTimeout(r, env.demo.recipientConfirmDelayMs)
      )
      res.json({
        evidenceId: req.body.evidenceId,
        recipientReply: 'YES',
        confirmedAt: new Date().toISOString(),
        message:
          'Recipient SMS confirmation received by Bank Islam (independent of NGO).',
      })
    } catch (e) {
      next(e)
    }
  }
)

// --- /simulate-fraud -----------------------------------------------------
// Section 18 — the "wow moment". We push a disbursement that exceeds the
// declared admin allocation and force the AI to score it >= freeze. The
// chain auto-freezes the campaign and we POST to the MACC webhook.
router.post(
  '/simulate-fraud',
  validate({ campaignId: { type: 'string', required: true } }),
  async (req, res, next) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.body.campaignId },
        include: { vendors: { where: { status: 'APPROVED' } } },
      })
      if (!campaign) {
        const err = new Error('Campaign not found')
        err.status = 404
        throw err
      }
      if (!campaign.vendors.length) {
        const err = new Error('Campaign needs at least one approved vendor')
        err.status = 400
        throw err
      }

      const vendor = campaign.vendors[0]
      const fraudulentAmount = Math.round(Number(campaign.raisedAmount) * 0.45)
      const packageHash = hashBuffer(
        Buffer.from(`demo-fraud-${campaign.id}-${Date.now()}`)
      )

      // Submit fraudulent evidence on-chain so the audit trail is real
      const { txHash, evidenceId: onChainId } = await contractService.submitEvidence({
        campaignAddress: campaign.contractAddress,
        packageHash,
        category: 'admin',
        amount: fraudulentAmount,
        vendorAddress: vendor.walletAddress,
      })

      const evidence = await prisma.evidence.create({
        data: {
          campaignId: campaign.id,
          vendorId: vendor.id,
          category: 'admin',
          amount: fraudulentAmount,
          onChainId,
          packageHash,
          status: 'PENDING_AI',
        },
      })

      // Run AI inline so the demo response includes the score
      const ai = await aiService.analyseDisbursement({
        campaign,
        evidence,
        vendor,
        historicalDisbursements: [],
      })

      // Force the recommendation up the routing scale so the freeze fires
      // even if Gemini happens to score this conservatively. (Demo only.)
      const forcedScore = Math.max(ai.confidenceScore, 92)

      await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          aiConfidenceScore: forcedScore,
          aiReason: ai.reason,
          aiRecommendation: 'freeze',
          aiFlaggedPatterns: ai.flaggedPatterns,
          status: 'AUTO_FROZEN',
        },
      })

      // Section 14 — auto-freeze + MACC alert
      const { txHash: pauseTx } = await contractService.pauseCampaign(
        campaign.contractAddress,
        `AI auto-freeze: ${ai.reason}`
      )
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'FROZEN', pausedReason: ai.reason },
      })

      await alertService.notifyMACC({
        campaignId: campaign.id,
        evidenceId: evidence.id,
        message: 'AI auto-freeze triggered — MACC notified',
        payload: {
          confidenceScore: forcedScore,
          reason: ai.reason,
          flaggedPatterns: ai.flaggedPatterns,
          submitTx: txHash,
          pauseTx,
          campaignContract: campaign.contractAddress,
        },
      })

      // Update donor-facing trackers to "UNDER_REVIEW" (plain language)
      const donations = await prisma.donation.findMany({
        where: { campaignId: campaign.id },
        select: { donorHash: true },
      })
      for (const d of donations) {
        try {
          await contractService.updateDonorMilestone({
            donorHash: d.donorHash,
            milestone: 'UNDER_REVIEW',
            description: DONOR_MILESTONE_TEXT.UNDER_REVIEW,
          })
        } catch (e) {
          console.warn('[demo] tracker update failed:', e.message)
        }
      }

      res.json({
        evidenceId: evidence.id,
        confidenceScore: forcedScore,
        reason: ai.reason,
        flaggedPatterns: ai.flaggedPatterns,
        submitTx: txHash,
        pauseTx,
        campaignStatus: 'FROZEN',
        message: 'Fraudulent disbursement detected — campaign frozen, MACC alerted.',
      })
    } catch (e) {
      next(e)
    }
  }
)

export default router
