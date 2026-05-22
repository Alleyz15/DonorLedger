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
      if (evidence.onChainId === null) {
        const err = new Error('Evidence missing on-chain id')
        err.status = 400
        throw err
      }

      // Section 8 — Bank Islam wallet signs the approval on-chain.
      const { txHash } = await contractService.approveDisbursement(
        evidence.campaign.contractAddress,
        evidence.onChainId
      )

      const updated = await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          status: 'APPROVED',
          approvedBy: req.admin.sub,
          approvedAt: new Date(),
        },
      })

      // Donor-facing milestone update (Section 6 Layer 2 — plain language)
      try {
        // Note: the donor milestone is keyed by donor hash, but a single
        // disbursement affects many donors. We emit one "RELEASED" event
        // per donation tied to this campaign category. In a production
        // build this would be a batched on-chain call.
        const donations = await prisma.donation.findMany({
          where: {
            campaignId: evidence.campaignId,
            vendorId: evidence.vendorId,
          },
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

      const { txHash } = await contractService.rejectDisbursement(
        evidence.campaign.contractAddress,
        evidence.onChainId,
        req.body.reason
      )

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
