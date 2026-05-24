// services/contract.service.js
//
// SINGLE point of entry for every smart-contract call (Section 16).
// No other file is allowed to create ethers.Contract instances.
//
// Why this rule:
//   - Centralises ABI loading so a contract change is a one-file edit.
//   - Centralises wallet selection: lower-privilege server wallet for the
//     bridge writes, higher-privilege Bank Islam wallet for admin writes
//     (Section 9 — security separation).
//   - Centralises gas + retry policy.
//
// The ABIs are loaded from contracts/artifacts/ if Hardhat has been run.
// We fall back to minimal hand-written ABIs so the backend boots even
// before the contracts are compiled (useful in the early hackathon hours).

import { ethers } from 'ethers'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  provider,
  serverWallet,
  bankIslamWallet,
} from '../config/blockchain.js'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ARTIFACTS = path.resolve(__dirname, '../../../contracts/artifacts/contracts')

// --- Minimal fallback ABIs ---------------------------------------------
// Keep these in sync with the Solidity sources. If Hardhat artifacts exist
// we prefer them — they include the exact event signatures and types.
const fallbackABIs = {
  Registry: [
    'function addNGO(address ngo, string name, string regNumber, uint8 riskTier, uint256 expiryDate) external',
    'function renewNGO(address ngo, uint256 newExpiryDate) external',
    'function revokeNGO(address ngo, string reason) external',
    'function isVerified(address ngo) external view returns (bool)',
    'function getNGODetails(address ngo) external view returns (string name, string regNumber, uint8 riskTier, uint256 expiryDate, bool revoked)',
    'event NGOVerified(address indexed ngo, string name, uint256 expiryDate)',
    'event NGORenewed(address indexed ngo, uint256 newExpiryDate)',
    'event NGORevoked(address indexed ngo, string reason, uint256 timestamp)',
  ],
  Campaign: [
    'function donate(bytes32 donorHash, uint256 amount, address vendorChoice) external',
    'function submitEvidence(bytes32 documentHash, string category, uint256 amount, address vendorAddress) external returns (uint256)',
    'function approveDisbursement(uint256 evidenceId) external',
    'function rejectDisbursement(uint256 evidenceId, string reason) external',
    'function pauseCampaign(string reason) external',
    'function unpauseCampaign() external',
    'function addApprovedVendor(address vendor) external',
    'function approvedVendors(address vendor) external view returns (bool)',
    'function aidPercent() external view returns (uint256)',
    'function logisticsPercent() external view returns (uint256)',
    'function adminPercent() external view returns (uint256)',
    'function targetAmount() external view returns (uint256)',
    'function raisedAmount() external view returns (uint256)',
    'function paused() external view returns (bool)',
    'event DonationReceived(bytes32 donorHash, uint256 amount, address vendorChoice)',
    'event EvidenceSubmitted(uint256 evidenceId, string category, uint256 amount)',
    'event DisbursementApproved(uint256 evidenceId, address vendor, uint256 amount)',
    'event DisbursementRejected(uint256 evidenceId, string reason)',
    'event CampaignPaused(string reason, uint256 timestamp)',
    'event CampaignUnpaused(uint256 timestamp)',
    'event VendorApproved(address vendor, uint256 timestamp)',
  ],
  DonorTracker: [
    'function updateMilestone(bytes32 donorHash, string milestone, string description) external',
    'function getDonorJourney(bytes32 donorHash) external view returns (tuple(string milestone, string description, uint256 timestamp)[])',
    'function getCampaignProgress(address campaign) external view returns (uint256 raisedPercent, uint256 donorCount)',
    'event MilestoneUpdated(bytes32 donorHash, string milestone, uint256 timestamp)',
  ],
}

function loadABI(name) {
  try {
    const file = path.join(ARTIFACTS, `${name}.sol`, `${name}.json`)
    if (fs.existsSync(file)) {
      const artifact = JSON.parse(fs.readFileSync(file, 'utf8'))
      return artifact.abi
    }
  } catch (e) {
    console.warn(`[contract] could not load ${name} artifact:`, e.message)
  }
  return fallbackABIs[name]
}

// ----- Helpers ----------------------------------------------------------

function ringgitToWei(amount) {
  // Convert MYR (decimal, 2 places) to an integer with 2-decimal precision
  // expressed in "sen" units. The contract treats `amount` as an opaque
  // integer — keeping it in sen (1 RM = 100 units) sidesteps floating point.
  const sen = Math.round(Number(amount) * 100)
  return BigInt(sen)
}

function weiToRinggit(amount) {
  return Number(amount) / 100
}

// Single registry instance (signed by Bank Islam wallet for writes).
let registryRead = null
let registryAdmin = null

function getRegistry({ admin = false } = {}) {
  if (!env.blockchain.registryAddress) {
    throw new Error('REGISTRY_CONTRACT_ADDRESS not set in .env')
  }
  const abi = loadABI('Registry')
  if (admin) {
    if (!registryAdmin) {
      registryAdmin = new ethers.Contract(
        env.blockchain.registryAddress,
        abi,
        bankIslamWallet
      )
    }
    return registryAdmin
  }
  if (!registryRead) {
    registryRead = new ethers.Contract(
      env.blockchain.registryAddress,
      abi,
      provider
    )
  }
  return registryRead
}

function getCampaign(address, { admin = false } = {}) {
  if (!address) throw new Error('Campaign address required')
  const abi = loadABI('Campaign')
  const signer = admin ? bankIslamWallet : serverWallet
  return new ethers.Contract(address, abi, signer)
}

function getDonorTracker() {
  if (!env.blockchain.donorTrackerAddress) {
    throw new Error('DONOR_TRACKER_CONTRACT_ADDRESS not set in .env')
  }
  const abi = loadABI('DonorTracker')
  // Server wallet owns DonorTracker.sol (Section 8 — owner is server wallet)
  return new ethers.Contract(
    env.blockchain.donorTrackerAddress,
    abi,
    serverWallet
  )
}

/**
 * Deploy a fresh Campaign.sol instance. Signed by the Bank Islam wallet
 * (which becomes the owner). Used when Bank Islam approves an NGO-created
 * campaign application.
 *
 * Bytecode + ABI must come from the Hardhat artifact — fallback ABIs are
 * read-only, they have no bytecode. So this requires `hardhat compile`
 * to have been run before the first campaign deploy.
 */
async function loadCampaignArtifact() {
  const file = path.join(ARTIFACTS, 'Campaign.sol', 'Campaign.json')
  if (!fs.existsSync(file)) {
    throw new Error(
      'Campaign artifact missing. Run `cd contracts && npm run compile` first.'
    )
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export async function deployCampaign({
  ngoWalletAddress,
  name,
  causeType,
  aidPercent,
  logisticsPercent,
  adminPercent,
  targetAmount,           // ringgit, decimal
  endDate,                // JS Date / ISO string
}) {
  if (aidPercent + logisticsPercent + adminPercent !== 100) {
    throw new Error('Allocation percentages must sum to 100')
  }
  if (!env.blockchain.registryAddress) {
    throw new Error('REGISTRY_CONTRACT_ADDRESS not set in .env')
  }

  const artifact = await loadCampaignArtifact()
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    bankIslamWallet
  )

  const targetSen = ringgitToWei(targetAmount)
  const endDateSeconds = Math.floor(new Date(endDate).getTime() / 1000)

  const campaign = await factory.deploy(
    bankIslamWallet.address,        // initialOwner
    ngoWalletAddress,
    name,
    causeType,
    aidPercent,
    logisticsPercent,
    adminPercent,
    targetSen,
    endDateSeconds,
    env.blockchain.registryAddress,
    serverWallet.address            // aiFreezeWallet (Section 9)
  )
  await campaign.waitForDeployment()
  const address = await campaign.getAddress()
  const tx = campaign.deploymentTransaction()
  return {
    contractAddress: address,
    deployTxHash: tx ? tx.hash : null,
  }
}

// ----- Registry (Bank Islam admin) --------------------------------------

export async function registerNGO({
  walletAddress,
  name,
  regNumber,
  riskTier,
  expiryDate,
}) {
  // riskTier: 0=LOW 1=MEDIUM 2=HIGH (matches Solidity enum order)
  const tier = ['LOW', 'MEDIUM', 'HIGH'].indexOf(riskTier)
  if (tier < 0) throw new Error('Invalid riskTier')
  const expirySeconds = Math.floor(new Date(expiryDate).getTime() / 1000)

  const tx = await getRegistry({ admin: true }).addNGO(
    walletAddress,
    name,
    regNumber,
    tier,
    expirySeconds
  )
  const receipt = await tx.wait()
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber }
}

export async function renewNGO(walletAddress, newExpiryDate) {
  const expirySeconds = Math.floor(new Date(newExpiryDate).getTime() / 1000)
  const tx = await getRegistry({ admin: true }).renewNGO(
    walletAddress,
    expirySeconds
  )
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

export async function revokeNGO(walletAddress, reason) {
  const tx = await getRegistry({ admin: true }).revokeNGO(walletAddress, reason)
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

export async function isNGOVerified(walletAddress) {
  return getRegistry().isVerified(walletAddress)
}

// ----- Campaign — server wallet writes (bridge) -------------------------

export async function recordDonation({
  campaignAddress,
  donorHash,
  amount,
  vendorAddress,
}) {
  // Section 10 Steps 6-7 — server wallet calls Campaign.donate()
  const tx = await getCampaign(campaignAddress).donate(
    donorHash,
    ringgitToWei(amount),
    vendorAddress || ethers.ZeroAddress
  )
  const receipt = await tx.wait()
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber }
}

export async function submitEvidence({
  campaignAddress,
  packageHash,
  category,
  amount,
  vendorAddress,
}) {
  // NGO portal action — but on-chain it's the server wallet that submits
  // (donor-friendly UX: NGO never holds wallet keys).
  const tx = await getCampaign(campaignAddress).submitEvidence(
    packageHash,
    category,
    ringgitToWei(amount),
    vendorAddress
  )
  const receipt = await tx.wait()

  // Parse EvidenceSubmitted event to extract evidenceId
  const iface = getCampaign(campaignAddress).interface
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed && parsed.name === 'EvidenceSubmitted') {
        return {
          txHash: receipt.hash,
          evidenceId: Number(parsed.args.evidenceId),
        }
      }
    } catch {
      // ignore non-matching logs
    }
  }
  return { txHash: receipt.hash, evidenceId: null }
}

// ----- Campaign — Bank Islam admin writes -------------------------------

export async function approveDisbursement(campaignAddress, evidenceId) {
  // Bank Islam wallet — leaves a permanent cryptographic signature on-chain.
  // Section 7: this signature is Bank Islam's alibi if the NGO later disputes.
  const tx = await getCampaign(campaignAddress, { admin: true }).approveDisbursement(
    evidenceId
  )
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

export async function rejectDisbursement(campaignAddress, evidenceId, reason) {
  const tx = await getCampaign(campaignAddress, { admin: true }).rejectDisbursement(
    evidenceId,
    reason
  )
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

export async function unpauseCampaign(campaignAddress) {
  // Only Bank Islam can unpause — AI cannot reverse its own freeze.
  const tx = await getCampaign(campaignAddress, { admin: true }).unpauseCampaign()
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

export async function addApprovedVendor(campaignAddress, vendorAddress) {
  // After vendor passes Bank Islam KYC (Section 12)
  const tx = await getCampaign(campaignAddress, { admin: true }).addApprovedVendor(
    vendorAddress
  )
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

export async function isVendorApproved(campaignAddress, vendorAddress) {
  if (!vendorAddress) return false
  return getCampaign(campaignAddress).approvedVendors(vendorAddress)
}

// ----- Campaign — AI auto-freeze (server wallet, Section 14) -----------

export async function pauseCampaign(campaignAddress, reason) {
  // AI-triggered freeze does NOT need Bank Islam approval — speed matters.
  // Server wallet has freeze power; unfreeze requires Bank Islam.
  const tx = await getCampaign(campaignAddress).pauseCampaign(reason)
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

// ----- DonorTracker (public layer, Section 6 Layer 2) -------------------

export async function updateDonorMilestone({ donorHash, milestone, description }) {
  const tx = await getDonorTracker().updateMilestone(
    donorHash,
    milestone,
    description
  )
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

export async function getDonorJourney(donorHash) {
  const journey = await getDonorTracker().getDonorJourney(donorHash)
  return journey.map((m) => ({
    milestone: m.milestone,
    description: m.description,
    timestamp: Number(m.timestamp) * 1000,
  }))
}

export async function getCampaignProgress(campaignAddress) {
  const [raisedPercent, donorCount] = await getDonorTracker().getCampaignProgress(
    campaignAddress
  )
  return {
    raisedPercent: Number(raisedPercent),
    donorCount: Number(donorCount),
  }
}

// ----- Read helpers -----------------------------------------------------

export async function readCampaignTotals(campaignAddress) {
  const c = getCampaign(campaignAddress)
  const [target, raised, paused] = await Promise.all([
    c.targetAmount(),
    c.raisedAmount(),
    c.paused(),
  ])
  return {
    targetAmount: weiToRinggit(target),
    raisedAmount: weiToRinggit(raised),
    paused,
  }
}

export default {
  // registry
  registerNGO,
  renewNGO,
  revokeNGO,
  isNGOVerified,
  // campaign deploy
  deployCampaign,
  // bridge writes
  recordDonation,
  submitEvidence,
  // bank islam writes
  approveDisbursement,
  rejectDisbursement,
  unpauseCampaign,
  addApprovedVendor,
  isVendorApproved,
  // ai auto-freeze
  pauseCampaign,
  // tracker
  updateDonorMilestone,
  getDonorJourney,
  getCampaignProgress,
  // reads
  readCampaignTotals,
}
