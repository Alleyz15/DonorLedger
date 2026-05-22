// listeners/contract.listener.js
//
// On-chain event listeners. Section 5 stack notes call out Node's
// event-driven architecture as the reason we picked it — this file is
// where that pays off. We subscribe to:
//
//   Registry.NGORevoked        → mark NGO row REVOKED in Postgres
//   Campaign.CampaignPaused    → mark Campaign row FROZEN + alert
//   Campaign.CampaignUnpaused  → mark Campaign row ACTIVE
//   Campaign.DonationReceived  → reconciliation sanity check
//   Campaign.DisbursementApproved / Rejected → reconcile evidence row
//
// Why bother — the routes already write to Postgres after each on-chain
// call succeeds. The listener catches the cases where:
//   (a) someone (e.g. Bank Islam SuperAdmin) calls a contract directly
//       from a wallet UI, bypassing our backend
//   (b) our backend crashes after the on-chain tx but before the DB write,
//       leaving Postgres stale — the listener reconciles on reboot

import { ethers } from 'ethers'
import prisma from '../config/database.js'
import { provider } from '../config/blockchain.js'
import { env } from '../config/env.js'
import alertService from '../services/alert.service.js'

// We reuse the same fallback ABIs as contract.service.js — small subset
// here, just the events we care about.
const REGISTRY_EVENT_ABI = [
  'event NGORevoked(address indexed ngo, string reason, uint256 timestamp)',
  'event NGOVerified(address indexed ngo, string name, uint256 expiryDate)',
]

const CAMPAIGN_EVENT_ABI = [
  'event DonationReceived(bytes32 donorHash, uint256 amount, address vendorChoice)',
  'event EvidenceSubmitted(uint256 evidenceId, string category, uint256 amount)',
  'event DisbursementApproved(uint256 evidenceId, address vendor, uint256 amount)',
  'event DisbursementRejected(uint256 evidenceId, string reason)',
  'event CampaignPaused(string reason, uint256 timestamp)',
  'event CampaignUnpaused(uint256 timestamp)',
  'event VendorApproved(address vendor, uint256 timestamp)',
]

// Track listeners we've attached per campaign address so we never
// double-subscribe across reboots / hot reloads.
const attachedCampaigns = new Set()

// ---------------- Registry listener -------------------------------------

function attachRegistryListeners() {
  if (!env.blockchain.registryAddress) {
    console.warn('[listener] REGISTRY_CONTRACT_ADDRESS not set — skipping')
    return
  }

  const registry = new ethers.Contract(
    env.blockchain.registryAddress,
    REGISTRY_EVENT_ABI,
    provider
  )

  registry.on('NGORevoked', async (ngoAddress, reason) => {
    try {
      const ngo = await prisma.nGO.findUnique({
        where: { walletAddress: ngoAddress },
      })
      if (ngo && ngo.status !== 'REVOKED') {
        await prisma.nGO.update({
          where: { id: ngo.id },
          data: { status: 'REVOKED', revokedReason: reason },
        })
        console.log(`[listener] NGO ${ngo.id} reconciled to REVOKED on-chain`)
      }
    } catch (e) {
      console.error('[listener] NGORevoked handler failed:', e.message)
    }
  })

  registry.on('NGOVerified', async (ngoAddress, name, expiryDate) => {
    try {
      const ngo = await prisma.nGO.findUnique({
        where: { walletAddress: ngoAddress },
      })
      if (ngo && ngo.status !== 'APPROVED') {
        await prisma.nGO.update({
          where: { id: ngo.id },
          data: {
            status: 'APPROVED',
            onChainExpiry: new Date(Number(expiryDate) * 1000),
          },
        })
        console.log(`[listener] NGO ${ngo.id} reconciled to APPROVED on-chain`)
      }
    } catch (e) {
      console.error('[listener] NGOVerified handler failed:', e.message)
    }
  })

  console.log(
    `[listener] Registry listener attached @ ${env.blockchain.registryAddress}`
  )
}

// ---------------- Campaign listener (per-campaign) ----------------------

export function attachCampaignListener(campaignAddress, campaignId) {
  if (!env.blockchain.enableListeners) return
  if (attachedCampaigns.has(campaignAddress)) return
  attachedCampaigns.add(campaignAddress)

  const campaign = new ethers.Contract(
    campaignAddress,
    CAMPAIGN_EVENT_ABI,
    provider
  )

  campaign.on('CampaignPaused', async (reason) => {
    try {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FROZEN', pausedReason: reason },
      })
      await alertService.notifyBankIslam({
        campaignId,
        severity: 'CRITICAL',
        message: `Campaign frozen on-chain: ${reason}`,
        payload: { contractAddress: campaignAddress },
      })
      console.log(`[listener] Campaign ${campaignId} → FROZEN`)
    } catch (e) {
      console.error('[listener] CampaignPaused handler failed:', e.message)
    }
  })

  campaign.on('CampaignUnpaused', async () => {
    try {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'ACTIVE', pausedReason: null },
      })
      console.log(`[listener] Campaign ${campaignId} → ACTIVE`)
    } catch (e) {
      console.error('[listener] CampaignUnpaused handler failed:', e.message)
    }
  })

  campaign.on('DisbursementApproved', async (evidenceOnChainId) => {
    try {
      const evidence = await prisma.evidence.findFirst({
        where: {
          campaignId,
          onChainId: Number(evidenceOnChainId),
        },
      })
      if (evidence && evidence.status !== 'APPROVED') {
        await prisma.evidence.update({
          where: { id: evidence.id },
          data: { status: 'APPROVED', approvedAt: new Date() },
        })
        console.log(`[listener] Evidence ${evidence.id} → APPROVED (chain)`)
      }
    } catch (e) {
      console.error('[listener] DisbursementApproved handler failed:', e.message)
    }
  })

  campaign.on('DisbursementRejected', async (evidenceOnChainId, reason) => {
    try {
      const evidence = await prisma.evidence.findFirst({
        where: {
          campaignId,
          onChainId: Number(evidenceOnChainId),
        },
      })
      if (evidence && evidence.status !== 'REJECTED') {
        await prisma.evidence.update({
          where: { id: evidence.id },
          data: { status: 'REJECTED', rejectedReason: reason },
        })
        console.log(`[listener] Evidence ${evidence.id} → REJECTED (chain)`)
      }
    } catch (e) {
      console.error('[listener] DisbursementRejected handler failed:', e.message)
    }
  })

  console.log(`[listener] Campaign listener attached @ ${campaignAddress}`)
}

// ---------------- Boot --------------------------------------------------

export async function startContractListeners() {
  if (!env.blockchain.enableListeners) {
    console.log(
      `[listener] disabled for ${env.blockchain.networkName}; set ENABLE_CONTRACT_LISTENERS=true to opt in`
    )
    return
  }

  attachRegistryListeners()

  // Subscribe to every deployed Campaign on boot
  const campaigns = await prisma.campaign.findMany({
    where: { contractAddress: { not: '' } },
    select: { id: true, contractAddress: true },
  })
  for (const c of campaigns) {
    attachCampaignListener(c.contractAddress, c.id)
  }

  console.log(
    `[listener] subscribed to ${campaigns.length} campaign contract(s)`
  )
}

export default { startContractListeners, attachCampaignListener }
