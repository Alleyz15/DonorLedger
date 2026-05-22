# CODEX.md

This file gives OpenAI Codex and GitHub Copilot complete context about
DonorLedger. Read this entirely before generating any suggestion.
Every section explains WHAT to generate and WHY we made each decision.

---

## 1. Project Summary

DonorLedger — blockchain donation transparency platform.
Hackathon X Fintech Forward 2026, Be U by Bank Islam × UMPSA.
Track 1: Reimagine Money — Islamic Digital Finance + Fraud Detection.

### The Problem
Malaysian NGO donation fraud — RM300 million lost in 2024-2026.
No specific law regulates online donations. MACC confirmed this publicly.
Donors have zero visibility. Fraud detected months after money is gone.

### The Solution Architecture
Bank Islam KYC verifies NGOs → smart contracts lock allocation rules →
donors pay via DuitNow (ringgit, no crypto) → server wallet bridges to
blockchain invisibly → Gemini AI monitors disbursements → auto-freeze +
MACC alert when fraud detected → donor sees plain language tracker URL.

---

## 2. Language Rules — Strictly Follow

- Node.js v20, ES modules only — import/export throughout
- Never use require() or CommonJS anywhere
- async/await everywhere — never .then() chains
- Solidity ^0.8.20 for smart contracts

---

## 3. ethers.js — This Project Uses v6 NOT v5

Copilot training data contains lots of ethers.js v5 code.
This project uses v6. The API is different. Always use v6 syntax.

```javascript
// CORRECT — v6 syntax
import { ethers } from 'ethers'
const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const contract = new ethers.Contract(address, abi, wallet)
const isValid = ethers.isAddress(addr)
const amount = ethers.parseUnits('50', 18)
const formatted = ethers.formatUnits(bigintVal, 18)

// WRONG — v5 syntax, never suggest this
const provider = new ethers.providers.JsonRpcProvider(url)  // WRONG
const amount = ethers.utils.parseEther('1.0')               // WRONG
const isValid = ethers.utils.isAddress(addr)                // WRONG
```

---

## 4. All Dependencies — Correct Usage

### ethers.js v6 — blockchain
```javascript
import { ethers } from 'ethers'

// config/blockchain.js — the only file that creates wallets
import { SEPOLIA_RPC_URL, BANK_ISLAM_PRIVATE_KEY, SERVER_WALLET_PRIVATE_KEY } from './env.js'

const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL)

// Two separate wallets — security isolation
export const bankIslamWallet = new ethers.Wallet(BANK_ISLAM_PRIVATE_KEY, provider)
export const serverWallet = new ethers.Wallet(SERVER_WALLET_PRIVATE_KEY, provider)
export { provider }

// bankIslamWallet signs: addNGO, approveDisbursement, addApprovedVendor, unpauseCampaign
// serverWallet signs: donate(), updateMilestone(), pauseCampaign() (AI trigger)
```

### @google/generative-ai — Gemini 1.5 Flash (free tier)
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/env.js'

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

const result = await model.generateContent(prompt)
const text = result.response.text()

// ALWAYS strip markdown before JSON parse — Gemini sometimes wraps in backticks
const clean = text.replace(/```json|```/g, '').trim()
try {
  return JSON.parse(clean)
} catch {
  return { confidenceScore: 50, reason: 'Parse error', recommendation: 'review', flaggedPatterns: [] }
}
```

### Prisma v5 — always Prisma methods, never raw SQL
```javascript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Correct
const ngo = await prisma.nGO.findUnique({ where: { walletAddress }, include: { campaigns: true } })
const donation = await prisma.donation.create({ data: { donorHash, donorEmail, amount, campaignId, txHash } })
const alerts = await prisma.alert.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'desc' } })

// NEVER raw SQL
await prisma.$queryRaw`SELECT * FROM donations`  // NEVER
```

### Bull + Redis — async AI analysis queue
```javascript
import Queue from 'bull'
import { REDIS_URL } from '../config/env.js'

const aiQueue = new Queue('ai-analysis', REDIS_URL)

// Add job when evidence submitted
await aiQueue.add({ evidenceId, campaignId, amount, category, vendorAgeMonths })

// Process job
aiQueue.process(async (job) => {
  const result = await aiService.analyseEvidence(job.data)
  return result
})
```

### multer — local file storage on IPserverone VPS
```javascript
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { UPLOAD_DIR, MAX_FILE_SIZE_MB } from '../config/env.js'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.body.category || 'general')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  }
})

export const upload = multer({
  storage,
  limits: { fileSize: parseInt(MAX_FILE_SIZE_MB) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['pdf', 'jpg', 'jpeg', 'png']
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '')
    cb(null, allowed.includes(ext))
  }
})
```

### Express.js — always async with try/catch and next
```javascript
import express from 'express'
const router = express.Router()

router.post('/donate', validateDonate, async (req, res, next) => {
  try {
    const result = await bridgeService.processDonation(req.body)
    res.json(result)
  } catch (err) {
    next(err)  // passes to error.middleware.js global handler
  }
})
```

---

## 5. Architecture Patterns — Always Follow

### Pattern 1 — Thin routes, fat services

Routes only handle HTTP. All logic in services/.

```javascript
// routes/evidence.routes.js — THIN (correct)
router.post('/submit', authNGO, upload.fields([
  { name: 'vendorRegistration' },
  { name: 'serviceAgreement' },
  { name: 'invoice' },
  { name: 'deliveryProof' }
]), async (req, res, next) => {
  try {
    const result = await evidenceService.submitEvidence(req.body, req.files)
    res.json(result)
  } catch (err) { next(err) }
})

// services/evidence.service.js — FAT (logic here)
export const submitEvidence = async (body, files) => {
  // validate all 5 documents present
  // hash all files
  // write hash to blockchain
  // queue AI analysis
  // return evidenceId + status
}
```

### Pattern 2 — All contract calls through contract.service.js ONLY

No other service creates Contract instances directly.
contract.service.js is the single gateway to the blockchain.

```javascript
// services/ai.service.js — correct (uses contract service)
import { contractService } from './contract.service.js'
await contractService.pauseCampaign(campaignAddress, reason)

// services/ai.service.js — WRONG (direct contract call)
const contract = new ethers.Contract(address, abi, wallet)  // NEVER outside contract.service.js
await contract.pauseCampaign(reason)
```

### Pattern 3 — Config centralisation

Only config/env.js reads process.env. Everything else imports from there.

```javascript
// config/env.js — reads process.env
export const {
  PORT, DATABASE_URL, REDIS_URL,
  SEPOLIA_RPC_URL,
  BANK_ISLAM_PRIVATE_KEY, SERVER_WALLET_PRIVATE_KEY,
  GEMINI_API_KEY, GEMINI_MODEL,
  REGISTRY_CONTRACT_ADDRESS,
  CAMPAIGN_CONTRACT_ADDRESS,
  DONOR_TRACKER_CONTRACT_ADDRESS,
  JWT_SECRET, JWT_EXPIRES_IN,
  AI_REVIEW_THRESHOLD, AI_FREEZE_THRESHOLD,
  UPLOAD_DIR, MAX_FILE_SIZE_MB,
  MACC_ALERT_WEBHOOK_URL,
  HASH_SALT
} = process.env

// services/ai.service.js — imports from config
import { GEMINI_API_KEY, AI_REVIEW_THRESHOLD, AI_FREEZE_THRESHOLD } from '../config/env.js'
```

### Pattern 4 — Error with status code

```javascript
const err = new Error('NGO credential expired or not verified')
err.status = 403
throw err
// error.middleware.js catches: res.status(err.status || 500).json({ error: err.message })
```

---

## 6. Smart Contract Patterns (Solidity + OpenZeppelin v5)

### Always extend OpenZeppelin — never write from scratch

```solidity
// CORRECT — build on audited OpenZeppelin foundation
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Campaign is Ownable, Pausable, ReentrancyGuard {
    constructor(address bankIslamWallet) Ownable(bankIslamWallet) {}
}
```

### Registry.sol key patterns
```solidity
struct NGOCredential {
    string legalName;
    string regNumber;
    string riskTier;        // "low" | "medium" | "high"
    uint256 verifiedAt;
    uint256 expiryDate;     // 12 months from verification — annual renewal
    bool isActive;
}

mapping(address => NGOCredential) public credentials;

// isVerified returns false if expired OR revoked
function isVerified(address ngoAddress) public view returns (bool) {
    NGOCredential memory cred = credentials[ngoAddress];
    return cred.isActive && block.timestamp < cred.expiryDate;
}

// Annual renewal — Bank Islam calls this each year
function renewNGO(address ngoAddress, uint256 newExpiryDate) external onlyOwner {
    require(credentials[ngoAddress].isActive, "NGO not active");
    credentials[ngoAddress].expiryDate = newExpiryDate;
    emit NGORenewed(ngoAddress, newExpiryDate);
}
```

### Campaign.sol key patterns
```solidity
// Allocation percentages — IMMUTABLE after deployment
uint256 public immutable aidPercent;
uint256 public immutable logisticsPercent;
uint256 public immutable adminPercent;

// Only Bank Islam-approved vendor addresses can receive funds
mapping(address => bool) public approvedVendors;

// Bank Islam adds vendor after KYC check
function addApprovedVendor(address vendor) external onlyOwner {
    approvedVendors[vendor] = true;
    emit VendorApproved(vendor, block.timestamp);
}

// pauseCampaign callable by Bank Islam OR server wallet (AI trigger)
// unpauseCampaign callable by Bank Islam ONLY
address public serverWallet;
modifier onlyBankIslamOrServer() {
    require(msg.sender == owner() || msg.sender == serverWallet, "Not authorised");
    _;
}
function pauseCampaign(string calldata reason) external onlyBankIslamOrServer whenNotPaused {
    _pause();
    emit CampaignPaused(reason, block.timestamp);
}
function unpauseCampaign() external onlyOwner whenPaused {
    _unpause();
    emit CampaignUnpaused(block.timestamp);
}
```

### DonorTracker.sol key patterns
```solidity
// Only stores anonymised milestones — no raw amounts visible publicly
struct Milestone {
    string milestone;    // "RECEIVED" | "ALLOCATED" | "RELEASED" | "CONFIRMED"
                         // "UNDER_REVIEW" | "FROZEN" | "COMPLETED"
    string description;  // plain English — what donor reads on tracker page
    uint256 timestamp;
}

mapping(bytes32 => Milestone[]) public donorJourneys;

function updateMilestone(
    bytes32 donorHash,
    string calldata milestone,
    string calldata description
) external onlyOwner {
    donorJourneys[donorHash].push(Milestone(milestone, description, block.timestamp));
    emit MilestoneUpdated(donorHash, milestone, block.timestamp);
}
```

---

## 7. Gemini Fraud Detection Prompt

Build every fraud analysis prompt like this:

```javascript
const buildFraudPrompt = (campaign, evidence, spendingHistory) => `
You are a financial fraud detection system for Malaysian NGO donations.
Analyse this disbursement request for fraud risk.

CAMPAIGN CONTEXT:
Cause type: ${campaign.causeType}
Declared allocation: ${campaign.aidPercent}% direct aid, ${campaign.logisticsPercent}% logistics, ${campaign.adminPercent}% admin
Campaign target: RM ${campaign.targetAmount}
Total raised: RM ${campaign.totalRaised}

SPENDING HISTORY TO DATE:
Direct aid: RM ${spendingHistory.aid} — ${spendingHistory.aidPercent}% of raised
Logistics: RM ${spendingHistory.logistics} — ${spendingHistory.logisticsPercent}% of raised
Admin: RM ${spendingHistory.admin} — ${spendingHistory.adminPercent}% of raised

THIS DISBURSEMENT REQUEST:
Category claimed: ${evidence.category}
Amount: RM ${evidence.amount}
Vendor company age: ${evidence.vendorAgeMonths} months since SSM registration
If approved, ${evidence.category} total becomes: ${evidence.newPercent}%

KNOWN MALAYSIA NGO FRAUD PATTERNS (from MACC cases 2024-2026):
- Admin costs spike above declared percentage by more than 10%
- Large payment to vendor registered less than 6 months ago
- Funds idle more than 30 days then sudden large withdrawal
- Same vendor receiving payments from multiple unrelated NGO campaigns
- Invoice amount inconsistent with Malaysian market rates for claimed service
- Multiple transfers to same wallet within 24 hours
- Donations still collected after campaign end date

Return ONLY valid JSON, no markdown backticks, no text outside JSON:
{
  "confidenceScore": 0-100,
  "reason": "one sentence explanation",
  "recommendation": "approve" | "review" | "freeze",
  "flaggedPatterns": ["pattern description if any"]
}
`
```

### Route the score — thresholds from env vars
```javascript
const REVIEW_THRESHOLD = parseInt(AI_REVIEW_THRESHOLD) || 60
const FREEZE_THRESHOLD = parseInt(AI_FREEZE_THRESHOLD) || 85

if (score >= FREEZE_THRESHOLD) {
  // Auto-freeze — no Bank Islam approval needed — speed critical
  await contractService.pauseCampaign(campaignAddress, aiResult.reason)
  await alertService.sendMACCAlert({ campaignId, evidenceId, aiResult })
  await trackerService.updateStatus(donorHashes, 'FROZEN', 'Funds under review')
} else if (score >= REVIEW_THRESHOLD) {
  // Flag for Bank Islam human review — funds continue flowing
  await alertService.flagForBankIslamReview({ campaignId, evidenceId, aiResult })
} else {
  // Below threshold — no action, proceed to Bank Islam approval queue
}
```

### AI report visibility — strictly enforced
```javascript
// What DONOR sees — plain language only, never score
const donorResponse = {
  status: score >= FREEZE_THRESHOLD ? 'under_review' : 'processing',
  message: score >= FREEZE_THRESHOLD
    ? 'Funds are under review. We will update you shortly.'
    : 'Your donation is being processed.'
  // NEVER: confidenceScore, flaggedPatterns, reason
}

// What NGO sees — their campaign only
const ngoResponse = {
  evidenceId,
  aiScore: aiResult.confidenceScore,
  reason: aiResult.reason,
  recommendation: aiResult.recommendation
  // NEVER: other NGOs data
}

// What Bank Islam sees — full report
const adminResponse = {
  evidenceId, campaignId,
  aiScore: aiResult.confidenceScore,
  reason: aiResult.reason,
  recommendation: aiResult.recommendation,
  flaggedPatterns: aiResult.flaggedPatterns,
  fullGeminiResponse: rawText
}
```

---

## 8. Donor Hash — Privacy Protection

Donor email NEVER goes on blockchain. SHA-256 hash goes on chain.

```javascript
// utils/hash.utils.js
import { createHash } from 'crypto'
import { HASH_SALT } from '../config/env.js'

export const createDonorHash = (email, campaignId, timestamp) => {
  return createHash('sha256')
    .update(`${email}:${campaignId}:${timestamp}:${HASH_SALT}`)
    .digest('hex')
}
// One-way — cannot be reversed to recover email
// donorHash → blockchain (public but anonymous)
// email → PostgreSQL only (private, under PDPA protection)
```

---

## 9. Document Integrity — File Hash Pattern

NGO document files stored locally in uploads/ on VPS.
Only SHA-256 hash stored on blockchain.
Hash proves: this exact file was submitted at this timestamp and not modified.

```javascript
// utils/hash.utils.js
import { createHash } from 'crypto'
import { readFileSync } from 'fs'

export const hashFile = (filePath) => {
  const buffer = readFileSync(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

// Usage in storage.service.js
const documentHash = hashFile(savedFilePath)
await contractService.submitEvidence(campaignAddress, documentHash, category, amount, vendorAddress)
// Hash is now immutably recorded on-chain
// File is in uploads/ — not on blockchain (too large and not necessary)
```

---

## 10. Evidence Submission — All 5 Documents Required

```javascript
// services/evidence.service.js

const REQUIRED_DOCUMENTS = [
  'vendorRegistration',   // SSM certificate proving vendor is real company
  'serviceAgreement',     // Signed contract — must predate campaign launch date
  'invoice',              // Itemised: unit price × quantity (not "services: RM50,000")
  'deliveryProof',        // Delivery order, photos, service completion report
  'recipientConfirmation' // Bank Islam confirms with beneficiary directly (demo: simulated)
]

export const submitEvidence = async (body, files) => {
  // Validate all 5 present
  const missing = REQUIRED_DOCUMENTS.filter(type => !files[type])
  if (missing.length > 0) {
    const err = new Error(`Missing required documents: ${missing.join(', ')}`)
    err.status = 400
    throw err
  }

  // Hash all files and combine into package hash
  const hashes = {}
  for (const docType of REQUIRED_DOCUMENTS) {
    hashes[docType] = hashFile(files[docType][0].path)
  }
  const packageHash = createHash('sha256')
    .update(JSON.stringify(hashes))
    .digest('hex')

  // Write package hash to blockchain
  await contractService.submitEvidence(
    body.campaignAddress, packageHash, body.category, body.amount, body.vendorAddress
  )

  // Queue AI analysis
  await aiQueue.add({ evidenceId: savedEvidence.id, ...body })

  return { evidenceId: savedEvidence.id, documentHash: packageHash, status: 'pending_ai_review' }
}
```

---

## 11. Vendor KYC — Shell Vendor Prevention

Shell vendor attack: NGO registers connected company as vendor, routes funds there.
Prevention: Every vendor requires Bank Islam KYC before addApprovedVendor() is called.

```javascript
// services/vendor.service.js

// NGO submits vendor for Bank Islam approval
export const submitVendorForApproval = async ({ campaignId, vendorName, ssmNumber, bankAccount, serviceType, walletAddress }) => {
  // Validate SSM number format
  // Save to database with status 'pending_kyc'
  // Alert Bank Islam admin dashboard
  return { vendorId, status: 'pending_kyc', message: 'Vendor submitted for Bank Islam verification' }
}

// Bank Islam approves vendor after checking:
// - SSM number is active and business nature matches claimed service
// - Bank account belongs to this entity not a personal account
// - Vendor not on blacklist or MACC watchlist
export const approveVendor = async ({ vendorId, campaignAddress }) => {
  const vendor = await prisma.vendor.update({ where: { id: vendorId }, data: { status: 'approved' } })
  await contractService.addApprovedVendor(campaignAddress, vendor.walletAddress)
  return { vendorId, status: 'approved', onChain: true }
}

// Frontend calls GET /api/campaign/:id/vendors to show donor their choices
export const getApprovedVendors = async (campaignId) => {
  return prisma.vendor.findMany({
    where: { campaignId, status: 'approved' },
    select: { id: true, vendorName: true, serviceType: true }
    // walletAddress not exposed to frontend — internal only
  })
}
```

---

## 12. Demo Simulation Endpoints

Hackathon demo only. Judges need to see the flow work.

```javascript
// routes/demo.routes.js

// Simulate DuitNow payment received by Bank Islam
router.post('/simulate-duitnow', async (req, res, next) => {
  try {
    const result = await bridgeService.processDonation(req.body)
    res.json(result)
  } catch (err) { next(err) }
})

// Simulate recipient SMS confirmation (auto-confirms after 5 seconds)
// In production: real SMS via Twilio to actual beneficiary
router.post('/recipient-confirm', async (req, res, next) => {
  try {
    await new Promise(resolve => setTimeout(resolve, 5000))
    // Update evidence status to recipient_confirmed
    await evidenceService.markRecipientConfirmed(req.body.evidenceId)
    res.json({ confirmed: true, method: 'sms_simulation', delay: '5s' })
  } catch (err) { next(err) }
})

// Simulate fraudulent disbursement — triggers AI → freeze → MACC alert
// Use this as the "wow moment" in the demo presentation
router.post('/simulate-fraud', async (req, res, next) => {
  try {
    // Submits disbursement where admin costs exceed declared % by large margin
    const fraudEvidence = {
      campaignId: req.body.campaignId,
      category: 'admin',
      amount: req.body.fraudAmount || 50000,
      vendorId: req.body.vendorId,
      // This will cause admin % to spike well above threshold
    }
    const result = await evidenceService.submitEvidence(fraudEvidence, SAMPLE_DOCS)
    res.json({ ...result, note: 'Demo fraud scenario — AI should flag this' })
  } catch (err) { next(err) }
})
```

---

## 13. Database Schema Reference

```
NGO          id, walletAddress*, legalName, regNumber*, status, riskTier, verifiedAt, expiryDate
Campaign     id, contractAddress*, ngoId, name, causeType, aidPercent, logisticsPercent, adminPercent, targetAmount, status
Vendor       id, campaignId, vendorName, ssmNumber, bankAccount, serviceType, walletAddress, status
Donation     id, donorHash*, donorEmail, amount, campaignId, vendorChoice, txHash*, createdAt
Evidence     id, campaignId, category, amount, vendorId, documentHash, aiScore, aiReason, recommendation, status, submittedAt
Alert        id, campaignId, evidenceId, aiScore, reason, patterns[], status, createdAt

* unique fields
```

---

## 14. Contract Event Listener Pattern

```javascript
// listeners/contract.listener.js

import { campaignContract } from '../config/blockchain.js'
import { trackerService } from '../services/tracker.service.js'
import { alertService } from '../services/alert.service.js'

// Listen for CampaignPaused — update all donor trackers for this campaign
campaignContract.on('CampaignPaused', async (reason, timestamp, event) => {
  const campaignId = event.address
  await trackerService.updateAllDonorsInCampaign(campaignId, 'FROZEN', 'Funds under review')
  console.log(`Campaign ${campaignId} paused: ${reason}`)
})

// Listen for DisbursementApproved — update donor trackers
campaignContract.on('DisbursementApproved', async (evidenceId, vendor, amount, event) => {
  const campaignId = event.address
  await trackerService.updateCampaignProgress(campaignId, 'RELEASED')
})
```

---

## 15. Security Rules — Never Violate

```javascript
// 1. Never log private keys
console.log(process.env.BANK_ISLAM_PRIVATE_KEY)        // NEVER
console.log(bankIslamWallet.privateKey)                 // NEVER

// 2. Never return private keys in API response
res.json({ key: bankIslamWallet.privateKey })           // NEVER

// 3. Never put donor email on blockchain — hash only
await contract.donate(donorEmail, amount)               // NEVER — use donorHash

// 4. Never use require() — ES modules only
const ethers = require('ethers')                        // NEVER

// 5. Never use ethers v5 syntax
new ethers.providers.JsonRpcProvider(url)               // NEVER — use v6

// 6. Never raw SQL
await prisma.$queryRaw`SELECT * FROM donations`         // NEVER

// 7. Never hardcode AI thresholds
if (score >= 85) { pause() }                            // NEVER — use env vars

// 8. Never create Contract instances outside contract.service.js
const c = new ethers.Contract(addr, abi, wallet)        // NEVER outside that file

// 9. Never send donor PII to Gemini
prompt += `donor email: ${email}`                       // NEVER

// 10. Never expose raw AI scores to donor-facing endpoints
res.json({ confidenceScore: 87, flaggedPatterns: [...] }) // NEVER to donors

// 11. Never commit .env or uploads/ directory
// Both are in .gitignore — never suggest git add on these

// 12. Never process.env directly in service files
const key = process.env.GEMINI_API_KEY                  // NEVER in services — import from config/env.js
```

---

## 16. Shariah Compliance Context

Bank Islam is Malaysia's first Islamic digital bank.
Any Shariah compliance concern must be addressed in code design:

- Ringgit NEVER converts to cryptocurrency at any point
- Bank Islam holds all funds in fiat escrow throughout
- Blockchain is used as an audit ledger only — not as a currency
- No speculative crypto asset is involved in any transaction
- All fund movements are straightforward ringgit donations to verified NGOs

When judges ask: "Is blockchain Shariah-compliant?"
Answer: "We use blockchain purely as a tamper-proof audit record.
No cryptocurrency is involved. All funds remain in ringgit held by
Bank Islam. It is functionally equivalent to a tamper-proof accounting book."

---

## 17. Hackathon vs Production Reference

| Feature | Hackathon demo | Production |
|---|---|---|
| Blockchain network | Ethereum Sepolia testnet (free) | Private Hyperledger Fabric |
| DuitNow payment | POST /api/demo/simulate-duitnow | Real Bank Islam DuitNow API webhook |
| Bank Islam KYC | Admin panel click to approve | Full KYC pipeline with JPN/SSM/ROS API |
| Recipient confirmation | Auto-confirm after 5s delay | Real SMS via Twilio to beneficiary |
| Multi-signature | Single Bank Islam wallet | OpenZeppelin multi-sig (if time allows) |
| Proxy upgrade pattern | Noted as production plan | Implemented |
| File storage | Local VPS uploads/ | Cloud object storage |
| Annual NGO renewal | Expiry timestamp in contract | Automated renewal notification pipeline |
| MACC alert | webhook.site test URL | Real MACC API integration |
