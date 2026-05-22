// services/kyc.service.js
//
// Section 11 — NGO five-stage registration. For the hackathon demo the
// external checks (SSM, ROS, MyKad, MACC) are simulated. The workflow
// shape is real — judges will see the exact sequence Bank Islam would
// run in production, just with mocked external responses.

import prisma from '../config/database.js'
import contractService from './contract.service.js'

// --- Stage 1 — automated pre-screening (simulated) -----------------------
async function preScreen(applicant) {
  // In production these are real API calls to SSM, ROS, JPN, MACC.
  // For the demo we return deterministic mock results.
  return {
    ssm: { active: true, name: applicant.name },
    ros: applicant.isSociety ? { registered: true } : null,
    directorJPN: { allValid: true },
    maccCheck: { underInvestigation: false },
    blacklist: { found: false },
    bankAccountMatchesEntity: true,
  }
}

// --- Stage 3 — risk scoring ---------------------------------------------
function scoreRiskTier({ yearsActive, prevCampaigns, auditedFinancials }) {
  if (yearsActive >= 5 && prevCampaigns >= 3 && auditedFinancials) return 'LOW'
  if (yearsActive >= 2 || prevCampaigns >= 1) return 'MEDIUM'
  return 'HIGH'
}

/**
 * Submit a new NGO application (frontend → POST /api/ngo/register).
 * Bank Islam reviewer picks it up from the admin dashboard.
 */
export async function submitNGOApplication(applicant) {
  const screen = await preScreen(applicant)

  if (!screen.ssm.active) {
    const err = new Error('SSM record not active — application rejected')
    err.status = 400
    throw err
  }
  if (screen.maccCheck.underInvestigation) {
    const err = new Error('Director currently under MACC investigation')
    err.status = 400
    throw err
  }

  const riskTier = scoreRiskTier({
    yearsActive: applicant.yearsActive || 0,
    prevCampaigns: applicant.prevCampaigns || 0,
    auditedFinancials: !!applicant.auditedFinancials,
  })

  return prisma.nGO.create({
    data: {
      name: applicant.name,
      registrationNum: applicant.registrationNum,
      walletAddress: applicant.walletAddress,
      contactEmail: applicant.contactEmail,
      contactPhone: applicant.contactPhone,
      riskTier,
      status: 'PENDING_KYC',
      kycNotes: JSON.stringify({ stage1: screen }),
    },
  })
}

/**
 * Bank Islam approves an NGO — Stage 4 on-chain credential issuance.
 * Section 8 — Registry.addNGO() is called with a 12-month expiry.
 */
export async function approveNGO({ ngoId, adminUserId, expiryMonths = 12 }) {
  const ngo = await prisma.nGO.findUnique({ where: { id: ngoId } })
  if (!ngo) {
    const err = new Error('NGO not found')
    err.status = 404
    throw err
  }
  if (ngo.status === 'APPROVED') {
    const err = new Error('NGO already approved')
    err.status = 409
    throw err
  }

  const expiryDate = new Date()
  expiryDate.setMonth(expiryDate.getMonth() + expiryMonths)

  // Section 8 — Registry.addNGO emits NGOVerified event on chain
  const { txHash } = await contractService.registerNGO({
    walletAddress: ngo.walletAddress,
    name: ngo.name,
    regNumber: ngo.registrationNum,
    riskTier: ngo.riskTier,
    expiryDate,
  })

  return prisma.nGO.update({
    where: { id: ngoId },
    data: {
      status: 'APPROVED',
      onChainExpiry: expiryDate,
      kycApprovedBy: adminUserId,
      kycApprovedAt: new Date(),
      // Note: txHash captured for audit but not exposed in our schema —
      // it's recoverable from chain via the NGOVerified event.
      kycNotes: ngo.kycNotes
        ? `${ngo.kycNotes}\nApproval tx: ${txHash}`
        : `Approval tx: ${txHash}`,
    },
  })
}

/** Stage 5 — annual re-verification. */
export async function renewNGOCredential({ ngoId, adminUserId }) {
  const ngo = await prisma.nGO.findUnique({ where: { id: ngoId } })
  if (!ngo || ngo.status !== 'APPROVED') {
    const err = new Error('NGO is not approved — cannot renew')
    err.status = 400
    throw err
  }
  const newExpiry = new Date()
  newExpiry.setMonth(newExpiry.getMonth() + 12)

  await contractService.renewNGO(ngo.walletAddress, newExpiry)

  return prisma.nGO.update({
    where: { id: ngoId },
    data: { onChainExpiry: newExpiry, kycApprovedBy: adminUserId },
  })
}

/** Permanent revocation. */
export async function revokeNGOCredential({ ngoId, reason, adminUserId }) {
  const ngo = await prisma.nGO.findUnique({ where: { id: ngoId } })
  if (!ngo) {
    const err = new Error('NGO not found')
    err.status = 404
    throw err
  }
  await contractService.revokeNGO(ngo.walletAddress, reason)

  return prisma.nGO.update({
    where: { id: ngoId },
    data: {
      status: 'REVOKED',
      revokedReason: reason,
      kycApprovedBy: adminUserId,
    },
  })
}

export default {
  submitNGOApplication,
  approveNGO,
  renewNGOCredential,
  revokeNGOCredential,
}
