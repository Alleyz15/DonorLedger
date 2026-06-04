// routes/disbursement.routes.js
//
// Bank Islam admin endpoints — wraps Campaign.approveDisbursement /
// rejectDisbursement. JWT-protected. The on-chain signature is the
// Bank Islam wallet's audit-trail alibi (Section 7).

import { Router } from 'express'
import prisma from '../config/database.js'
import contractService from '../services/contract.service.js'
import alertService from '../services/alert.service.js'
import { requireAdmin, requireRole } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { DONOR_MILESTONE_TEXT } from '../utils/format.utils.js'
import { env } from '../config/env.js'

const router = Router()

router.use(requireAdmin)

router.post(
  '/approve',
  requireRole('DISBURSEMENT_APPROVER', 'SUPER_ADMIN'),
  validate({ evidenceId: { type: 'string', required: true } }),
  async (req, res, next) => {
    try {
      const evidence = await prisma.evidence.findUnique({
        where: { id: req.body.evidenceId },
        include: { campaign: true, vendor: true },
      })
      if (!evidence) {
        const err = new Error('Evidence not found')
        err.status = 404
        throw err
      }
      if (evidence.status === 'APPROVED') {
        const err = new Error('Evidence already approved')
        err.status = 409
        throw err
      }
      // Section 8 — Bank Islam wallet signs the approval on-chain.
      // In demo mode (no deployed contract), skip the chain call and use a
      // placeholder tx hash so the rest of the approval flow works normally.
      let txHash = 'demo-tx-' + Date.now()
      const hasContract = evidence.campaign.contractAddress && evidence.onChainId !== null
      if (!env.demo.enabled && !hasContract) {
        const err = new Error('Evidence missing on-chain id or contract address')
        err.status = 400
        throw err
      }
      if (hasContract) {
        const result = await contractService.approveDisbursement(
          evidence.campaign.contractAddress,
          evidence.onChainId
        )
        txHash = result.txHash
      }

      const updated = await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          status: 'APPROVED',
          approvedBy: req.admin.sub,
          approvedAt: new Date(),
        },
      })

      // Donor-facing milestone update (Section 6 Layer 2 — plain language)
      // We scope to campaignId only — NOT vendorId — because donors who
      // chose "General Aid Fund" have vendorId = null and would be excluded
      // by a vendorId filter. When Bank Islam approves any disbursement for
      // this campaign, every donor in that campaign should see RELEASED.
      try {
        const donations = await prisma.donation.findMany({
          where: { campaignId: evidence.campaignId },
          select: { donorHash: true },
        })
        for (const d of donations) {
          await contractService.updateDonorMilestone({
            donorHash: d.donorHash,
            milestone: 'RELEASED',
            description: DONOR_MILESTONE_TEXT.RELEASED,
          })
        }
      } catch (e) {
        console.warn('[disbursement] tracker batch update failed:', e.message)
      }

      res.json({ evidenceId: updated.id, txHash, status: updated.status })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/reject',
  requireRole('DISBURSEMENT_APPROVER', 'SUPER_ADMIN'),
  validate({
    evidenceId: { type: 'string', required: true },
    reason: { type: 'string', required: true, min: 3, max: 500 },
  }),
  async (req, res, next) => {
    try {
      const evidence = await prisma.evidence.findUnique({
        where: { id: req.body.evidenceId },
        include: { campaign: true },
      })
      if (!evidence) {
        const err = new Error('Evidence not found')
        err.status = 404
        throw err
      }

      let txHash = 'demo-tx-' + Date.now()
      if (evidence.campaign.contractAddress && evidence.onChainId !== null) {
        const result = await contractService.rejectDisbursement(
          evidence.campaign.contractAddress,
          evidence.onChainId,
          req.body.reason
        )
        txHash = result.txHash
      }

      await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          status: 'REJECTED',
          rejectedReason: req.body.reason,
          approvedBy: req.admin.sub,
        },
      })

      await alertService.notifyBankIslam({
        campaignId: evidence.campaignId,
        evidenceId: evidence.id,
        severity: 'WARNING',
        message: `Disbursement rejected: ${req.body.reason}`,
        payload: { txHash },
      })

      res.json({ evidenceId: evidence.id, txHash, status: 'REJECTED' })
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  '/unpause',
  requireRole('SUPER_ADMIN'),
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
      const { txHash } = await contractService.unpauseCampaign(
        campaign.contractAddress
      )
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'ACTIVE', pausedReason: null },
      })
      res.json({ campaignId: campaign.id, txHash, status: 'ACTIVE' })
    } catch (e) {
      next(e)
    }
  }
)

export default router
