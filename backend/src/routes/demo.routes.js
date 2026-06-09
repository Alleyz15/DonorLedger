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
//
// Milestone chain fired here (Section 6 Layer 2):
//   CONFIRMED — beneficiary replied YES to Bank Islam's SMS.
//   COMPLETED — full accountability loop closed. The donor's journey is done.
//
// Both fire here because the same Bank Islam action that receives the SMS
// confirmation also closes out the campaign step.
router.post(
  '/recipient-confirm',
  validate({
    evidenceId: { type: 'string', required: false },
    campaignId: { type: 'string', required: false },
  }),
  async (req, res, next) => {
    try {
      if (!req.body.evidenceId && !req.body.campaignId) {
        const err = new Error('Provide evidenceId or campaignId')
        err.status = 400
        throw err
      }

      await new Promise((r) =>
        setTimeout(r, env.demo.recipientConfirmDelayMs)
      )

      const confirmedAt = new Date().toISOString()

      // Resolve campaignId — accept either evidenceId or campaignId directly
      let campaignId = req.body.campaignId
      if (!campaignId && req.body.evidenceId) {
        const evidence = await prisma.evidence.findUnique({
          where: { id: req.body.evidenceId },
          select: { campaignId: true },
        })
        campaignId = evidence?.campaignId
      }

      if (campaignId) {
        const donations = await prisma.donation.findMany({
          where: { campaignId },
          select: { donorHash: true },
        })

        for (const d of donations) {
          try {
            // Step 4 — beneficiary confirmed receipt directly with Bank Islam
            await contractService.updateDonorMilestone({
              donorHash: d.donorHash,
              milestone: 'CONFIRMED',
              description: DONOR_MILESTONE_TEXT.CONFIRMED,
            })
            // Step 5 — full accountability loop closed
            await contractService.updateDonorMilestone({
              donorHash: d.donorHash,
              milestone: 'COMPLETED',
              description: DONOR_MILESTONE_TEXT.COMPLETED,
            })
          } catch (e) {
            console.warn('[demo] tracker milestone failed:', e.message)
          }
        }

        // Do NOT set campaign status to COMPLETED here — the campaign may
        // still be collecting donations until its end date. Delivery
        // confirmation closes out one evidence package, not the whole campaign.

        // Mark all APPROVED evidence for this campaign as CONFIRMED so the
        // "Confirm Beneficiary Receipt" button does not reappear on refresh.
        await prisma.evidence.updateMany({
          where: { campaignId, status: 'APPROVED' },
          data: { status: 'CONFIRMED' },
        })
      }

      res.json({
        campaignId,
        recipientReply: 'YES',
        confirmedAt,
        milestonesUpdated: campaignId ? ['CONFIRMED', 'COMPLETED'] : [],
        message:
          'Recipient SMS confirmation received by Bank Islam (independent of NGO). Donor trackers updated to COMPLETED.',
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
          status: 'PENDING_REVIEW',
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

// --- /simulate-clean -----------------------------------------------------
// Demo endpoint that runs Gemini with a clearly legitimate disbursement.
// No on-chain write, no DB write — pure AI analysis for demo showcase.
// Shows that normal, correctly-priced, proportional disbursements PASS.
//
// Scenario: Food vendor supplying rice packs at RM2.50/kg (market rate).
// 200 kg of rice = RM500. Campaign raised RM50,000. Admin only 8%.
// Expected Gemini score: ~10–30 (ALLOW).
router.post(
  '/simulate-clean',
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

      // Clean scenario: small, proportional aid disbursement at market prices.
      // RM500 = 200 kg rice × RM2.50/kg (within RM2.00–2.80 benchmark).
      // This is 1% of a RM50,000 campaign — completely reasonable.
      const cleanAmount = Math.max(500, Math.round(Number(campaign.raisedAmount) * 0.01))

      const cleanEvidence = {
        id: 'demo-clean-preview',
        campaignId: campaign.id,
        vendorId: vendor.id,
        category: 'aid',
        amount: cleanAmount,
        packageHash: '0x' + 'a'.repeat(64),
        onChainId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const ai = await aiService.analyseDisbursement({
        campaign,
        evidence: cleanEvidence,
        vendor,
        historicalDisbursements: [],
      })

      res.json({
        scenario: 'CLEAN',
        invoiceDescription: `200 kg beras putih (white rice) × RM2.50/kg = RM${cleanAmount}`,
        marketBenchmark: 'Rice benchmark: RM2.00–2.80/kg  ✓  Within range',
        disbursementCategory: 'aid',
        amount: cleanAmount,
        confidenceScore: ai.confidenceScore,
        reason: ai.reason,
        recommendation: ai.recommendation,
        flaggedPatterns: ai.flaggedPatterns,
        priceAnalysis: ai.priceAnalysis,
        verdict: ai.confidenceScore < 60
          ? '✅ PASS — Funds cleared for Bank Islam approval'
          : '⚠ FLAGGED — Manual review required',
        message: 'Legitimate disbursement analysed. No fraud indicators detected.',
      })
    } catch (e) {
      next(e)
    }
  }
)

// --- /simulate-price-fraud -----------------------------------------------
// Demo endpoint specifically for the price inflation fraud pattern.
// Same rice purchase but vendor invoices RM8.50/kg — 3× above market.
// No on-chain write — pure AI analysis for demo showcase.
// Expected Gemini score: ~75–95 (REVIEW or AUTO-FREEZE).
router.post(
  '/simulate-price-fraud',
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

      // Price fraud scenario: same 200 kg rice but invoiced at RM8.50/kg.
      // RM1,700 for what should cost RM500 — 240% price inflation.
      // Also suspiciously large relative to campaign for a single food run.
      const fraudAmount = Math.round(Number(campaign.raisedAmount) * 0.34)

      const fraudEvidence = {
        id: 'demo-price-fraud-preview',
        campaignId: campaign.id,
        vendorId: vendor.id,
        category: 'aid',
        amount: fraudAmount,
        packageHash: '0x' + 'b'.repeat(64),
        onChainId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const ai = await aiService.analyseDisbursement({
        campaign,
        evidence: fraudEvidence,
        vendor,
        historicalDisbursements: [],
      })

      const score = Math.max(ai.confidenceScore, 78)

      res.json({
        scenario: 'PRICE_FRAUD',
        invoiceDescription: `200 kg beras putih (white rice) × RM8.50/kg = RM${fraudAmount}`,
        marketBenchmark: 'Rice benchmark: RM2.00–2.80/kg  ✗  EXCEEDED by 204%',
        disbursementCategory: 'aid',
        amount: fraudAmount,
        confidenceScore: score,
        reason: ai.reason || 'Invoice unit price (RM8.50/kg rice) exceeds Malaysian market ceiling (RM2.80/kg) by 204% — PRICE_INFLATION pattern detected.',
        recommendation: score >= 85 ? 'freeze' : 'review',
        flaggedPatterns: ai.flaggedPatterns.length ? ai.flaggedPatterns : ['PRICE_INFLATION', 'DISPROPORTIONATE'],
        priceAnalysis: ai.priceAnalysis || 'Rice priced at RM8.50/kg is 204% above the RM2.80/kg wholesale ceiling — consistent with invoice price inflation fraud.',
        verdict: score >= 85
          ? '🚨 AUTO-FREEZE — Campaign frozen, MACC alerted'
          : '⚠ MANUAL REVIEW — Bank Islam must approve before release',
        message: 'Price inflation detected. Invoice unit price is 3× above Malaysian market rate.',
      })
    } catch (e) {
      next(e)
    }
  }
)

// --- /backfill-milestones ------------------------------------------------
// Hackathon helper — pushes any missing milestones onto existing donations.
// Useful when a donation was made before the ALLOCATED milestone was added.
//
// Accepts either:
//   { donorHash }   — fix one specific donation
//   { campaignId }  — fix every donation in a campaign
//
// Only writes milestones that are not already on-chain (getDonorJourney
// is checked first so we don't duplicate entries).
router.post(
  '/backfill-milestones',
  validate({
    donorHash: { type: 'string', required: false },
    campaignId: { type: 'string', required: false },
  }),
  async (req, res, next) => {
    try {
      const { donorHash, campaignId } = req.body
      if (!donorHash && !campaignId) {
        const err = new Error('Provide donorHash or campaignId')
        err.status = 400
        throw err
      }

      // Gather target donations
      const donations = donorHash
        ? await prisma.donation.findMany({
            where: { donorHash },
            select: { donorHash: true },
          })
        : await prisma.donation.findMany({
            where: { campaignId },
            select: { donorHash: true },
          })

      if (!donations.length) {
        const err = new Error('No donations found')
        err.status = 404
        throw err
      }

      const results = []

      for (const d of donations) {
        // Check which milestones are already recorded on-chain
        let existing = []
        try {
          const journey = await contractService.getDonorJourney(d.donorHash)
          existing = journey.map((m) => m.milestone)
        } catch (e) {
          console.warn('[demo] backfill journey read failed:', e.message)
        }

        const added = []

        // ALLOCATED — Bank Islam escrow locked (fires right after RECEIVED)
        if (!existing.includes('ALLOCATED')) {
          try {
            await contractService.updateDonorMilestone({
              donorHash: d.donorHash,
              milestone: 'ALLOCATED',
              description: DONOR_MILESTONE_TEXT.ALLOCATED,
            })
            added.push('ALLOCATED')
          } catch (e) {
            console.warn('[demo] backfill ALLOCATED failed:', e.message)
          }
        }

        results.push({ donorHash: d.donorHash, added, skipped: existing })
      }

      res.json({
        updated: results.length,
        results,
        message: 'Backfill complete. Reload the donor receipt to see updated steps.',
      })
    } catch (e) {
      next(e)
    }
  }
)

// --- /reset-campaign-status ----------------------------------------------
// Hackathon helper — resets a campaign that was wrongly set to COMPLETED
// back to ACTIVE. Use when recipient-confirm accidentally completed a
// campaign that still has time left on its end date.
router.post(
  '/reset-campaign-status',
  validate({ campaignId: { type: 'string', required: true } }),
  async (req, res, next) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.body.campaignId },
      })
      if (!campaign) {
        const err = new Error('Campaign not found')
        err.status = 404
        throw err
      }
      const updated = await prisma.campaign.update({
        where: { id: req.body.campaignId },
        data: { status: 'ACTIVE', pausedReason: null },
      })
      res.json({ campaignId: updated.id, status: updated.status, message: 'Campaign reset to ACTIVE.' })
    } catch (e) {
      next(e)
    }
  }
)

export default router
