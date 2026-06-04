// routes/evidence.routes.js
//
// POST /api/evidence/submit  (multipart form upload — 5 documents)
//
// Section 13 — NGO uploads the 5-document package, we hash the bundle,
// submit it on-chain, queue Gemini analysis. The HTTP response returns
// IMMEDIATELY after the on-chain submit; AI analysis runs async via Bull.

import { Router } from 'express'
import prisma from '../config/database.js'
import storageService from '../services/storage.service.js'
import contractService from '../services/contract.service.js'
import alertService from '../services/alert.service.js'
import { aiAnalysisQueue } from '../config/queue.js'
import { hashEvidencePackage } from '../utils/hash.utils.js'

const router = Router()

const fields = [
  { name: 'ssmDoc', maxCount: 1 },
  { name: 'serviceAgreement', maxCount: 1 },
  { name: 'invoice', maxCount: 1 },
  { name: 'deliveryProof', maxCount: 1 },
  { name: 'recipientConfirm', maxCount: 1 },
]

router.post(
  '/submit',
  storageService.uploader.fields(fields),
  async (req, res, next) => {
    try {
      const { campaignId, vendorId, category, amount } = req.body
      if (!campaignId || !vendorId || !category || !amount) {
        const err = new Error(
          'campaignId, vendorId, category and amount are required'
        )
        err.status = 400
        throw err
      }
      if (!['aid', 'logistics', 'admin'].includes(category)) {
        const err = new Error('category must be aid | logistics | admin')
        err.status = 400
        throw err
      }

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          vendors: {
            where: { id: vendorId },
            select: { id: true, status: true, walletAddress: true },
          },
          evidence: {
            where: { status: { not: 'REJECTED' } },
            select: { amount: true },
          },
        },
      })
      if (!campaign) {
        const err = new Error('Campaign not found')
        err.status = 404
        throw err
      }
      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
      if (!vendor || vendor.status !== 'APPROVED') {
        const err = new Error('Vendor is not Bank Islam-approved')
        err.status = 400
        throw err
      }
      if (!campaign.contractAddress || campaign.status !== 'ACTIVE') {
        const err = new Error('Campaign must be active before evidence can be submitted')
        err.status = 409
        throw err
      }
      if (!campaign.vendors.some((linkedVendor) => linkedVendor.id === vendor.id)) {
        const err = new Error('Vendor is not approved for this campaign')
        err.status = 409
        throw err
      }
      const requestedAmount = Number(amount)
      const reservedAmount = campaign.evidence.reduce(
        (sum, item) => sum + Number(item.amount),
        0
      )
      const availableAmount = Number(campaign.raisedAmount) - reservedAmount
      if (requestedAmount > availableAmount) {
        const err = new Error(
          availableAmount <= 0
            ? 'No releasable funds remaining for this campaign.'
            : `Requested amount exceeds remaining releasable balance of RM${availableAmount.toFixed(2)}.`
        )
        err.status = 400
        throw err
      }

      const vendorOnChain = await contractService.isVendorApproved(
        campaign.contractAddress,
        vendor.walletAddress
      )
      if (!vendorOnChain) {
        // Repairs older demo data created before vendor approval was synced
        // onto each campaign contract. The DB relation already proves Bank
        // Islam approved this vendor for this campaign.
        await contractService.addApprovedVendor(
          campaign.contractAddress,
          vendor.walletAddress
        )
      }

      const files = req.files || {}
      const pickPath = (k) => (files[k] && files[k][0] ? files[k][0].path : null)

      const filePaths = {
        ssmDoc: pickPath('ssmDoc'),
        serviceAgreement: pickPath('serviceAgreement'),
        invoice: pickPath('invoice'),
        deliveryProof: pickPath('deliveryProof'),
        recipientConfirm: pickPath('recipientConfirm'),
      }
      const missingFiles = Object.entries(filePaths)
        .filter(([, filePath]) => !filePath)
        .map(([name]) => name)
      if (missingFiles.length) {
        const err = new Error(`Missing evidence documents: ${missingFiles.join(', ')}`)
        err.status = 400
        throw err
      }

      // Section 13 — one bundle hash that goes on-chain. The files
      // themselves stay on the VPS (uploads/).
      const packageHash = await hashEvidencePackage(filePaths)

      // Section 8 — Campaign.submitEvidence emits EvidenceSubmitted event
      const { txHash, evidenceId: onChainId } = await contractService.submitEvidence({
        campaignAddress: campaign.contractAddress,
        packageHash,
        category,
        amount: requestedAmount,
        vendorAddress: vendor.walletAddress,
      })

      const evidence = await prisma.evidence.create({
        data: {
          campaignId,
          vendorId,
          category,
          amount: requestedAmount,
          onChainId,
          packageHash,
          ssmDoc: filePaths.ssmDoc,
          serviceAgreement: filePaths.serviceAgreement,
          invoice: filePaths.invoice,
          deliveryProof: filePaths.deliveryProof,
          recipientConfirm: filePaths.recipientConfirm,
          status: 'PENDING_AI',
        },
      })

      // Push Gemini analysis off the HTTP thread (Section 5 — Bull/Redis)
      await aiAnalysisQueue.add(
        'analyse-disbursement',
        { evidenceId: evidence.id },
        { jobId: `evidence-${evidence.id}` }
      )

      // Section 13 — Bank Islam dashboard gets a notification of the new
      // evidence submission immediately (before AI finishes).
      await alertService.notifyBankIslam({
        campaignId,
        evidenceId: evidence.id,
        severity: 'INFO',
        message: `New disbursement evidence submitted (${category}, RM${amount})`,
        payload: { txHash, onChainId },
      })

      res.status(201).json({
        evidenceId: evidence.id,
        onChainId,
        txHash,
        status: evidence.status,
        message: 'Evidence submitted. AI analysis in progress.',
      })
    } catch (e) {
      next(e)
    }
  }
)

router.get('/:id', async (req, res, next) => {
  try {
    const evidence = await prisma.evidence.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: { select: { name: true, ngoId: true } },
        vendor: { select: { name: true, serviceType: true } },
      },
    })
    if (!evidence) {
      const err = new Error('Evidence not found')
      err.status = 404
      throw err
    }
    res.json(evidence)
  } catch (e) {
    next(e)
  }
})

export default router
