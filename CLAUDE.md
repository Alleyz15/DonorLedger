# CLAUDE.md

This file is a complete reference of every decision, discussion, architecture
choice, and implementation detail for DonorLedger. Read this entirely before
touching any file. Every section explains not just WHAT to build but WHY
we decided to build it this way.

---

## 1. What This Project Is

DonorLedger is a blockchain-powered donation transparency platform built for
Hackathon X Fintech Forward 2026 — Be U by Bank Islam × UMPSA.
Track 1: Reimagine Money — Islamic Digital Finance + Fraud Detection.

### The Real Problem

Malaysian NGO donation fraud — RM300 million lost in 2024-2026:
- RM230 million misappropriated by a single welfare NGO (deputy chairman
  transferred funds to his own company's investment account)
- RM70 million in Gaza fundraising fraud — 41 bank accounts frozen by MACC
- Influencers arrested for misusing RM1.52 million in public donations
- 96,722 registered NGOs in Malaysia — zero real-time accountability
- MACC and PDRM publicly admitted: no specific law exists to regulate
  online donation drives in Malaysia
- Existing laws (Societies Act 1966, House-to-House Collections Act 1947)
  were written before the internet existed

When a Malaysian donates money — RM10 on TikTok or RM10,000 to a
humanitarian cause — that money enters a complete black box.
The donor cannot track it. The regulator cannot monitor it in real time.
By the time MACC investigates, months have passed and money is spent.

### The One-Sentence Problem Statement

"Every year, Malaysians donate billions in good faith — but once the money
leaves their hands, it disappears into a black box that nobody, not donors,
not regulators, not even MACC, can see inside in real time."

### Why This Affects All Malaysians (Not Just Muslims)

This is not a Muslim problem or a poor people problem.
Every Malaysian regardless of race or religion donates to flood victims,
orphanages, community causes, humanitarian campaigns. Every single one of
them has donated with zero accountability. The platform serves all of them.

---

## 2. The Solution — How DonorLedger Fixes It

Six things happen that are currently impossible in Malaysia:

1. NGOs are Bank Islam KYC-verified before receiving a single ringgit
2. Fund allocation rules are locked in smart contracts — impossible to change
3. Money never touches NGO hands — Bank Islam holds escrow, releases
   directly to verified vendors only after evidence is approved
4. Donors pay via DuitNow exactly as they do today — zero new behaviour
5. Google Gemini AI monitors every disbursement in real time, auto-freezes
   and alerts MACC when fraud patterns are detected
6. Donors get a plain language tracker showing their specific ringgit's
   journey from payment to confirmed delivery

---

## 3. Hackathon Context

Track: Track 1 — Reimagine Money
Problem spaces: Islamic Digital Finance + Fraud Detection
Organiser: Be U by Bank Islam (Malaysia's first Islamic digital bank)

### Why We Win Against Other Teams

Most teams will build a chatbot or budgeting app — conventional web apps.
We are building national trust infrastructure for a problem that made
front-page news last month (MACC cases are fresh news during this hackathon).
No other team will have this specific combination:
- Real problem with documented RM figures from MACC cases
- Blockchain is genuinely architecturally necessary (not decorative)
- Bank Islam is elevated not threatened by the solution
- AI is load-bearing not added for show
- Serves all Malaysians regardless of religion

### Has Anyone Done This Before?

Globally: Platforms like Giveth exist but require crypto wallets —
99% of Malaysians do not have one. Academic papers exist (including from
UKM) but none have shipped a real deployed product.

In Malaysia: Nothing deployed at scale with:
- A licensed Malaysian bank as KYC anchor
- DuitNow as the payment rail (normal ringgit, no crypto)
- AI anomaly detection on disbursements
- Bank Islam-controlled escrow

The concept exists globally. Our Malaysian implementation does not.
That gap is our idea. That is what we build.

---

## 4. Team

| Role | Responsibility |
|---|---|
| Backend Engineer | Node.js backend, Solidity smart contracts, Gemini AI integration, blockchain bridge, IPserverone deployment |
| Frontend Engineer | Figma UI design, frontend implementation (language TBD), donor tracker page, campaign browser, NGO portal UI |
| Pitcher | Presentation, judge Q&A preparation |

Do NOT touch the frontend/ folder. That is the frontend teammate's work.
The pitcher handles presentation — they are not writing code.

---

## 5. Stack

| Layer | Technology | Why This Choice |
|---|---|---|
| Runtime | Node.js v20 | Strong event-driven architecture for webhooks and blockchain event listeners. Same language as frontend (likely React) for easier collaboration |
| Framework | Express.js v4 | Lightweight, well-documented, sufficient for hackathon REST API |
| Blockchain | ethers.js v6 | Best JavaScript blockchain library. Connects backend server wallet to smart contracts. v6 specifically — NOT v5 (different API) |
| AI | @google/generative-ai (Gemini 1.5 Flash) | Google Cloud Console already available. Gemini 1.5 Flash is free tier. Mature Python SDK exists but we chose JS for stack consistency |
| ORM | Prisma v5 + PostgreSQL | Type-safe queries, auto-migration, readable schema |
| Queue | Bull + Redis | Async AI analysis jobs — disbursement comes in, AI analysis queued, does not block the HTTP response |
| Contracts | Solidity ^0.8.20 + OpenZeppelin v5 | OpenZeppelin because writing security-critical contract code from scratch in a hackathon with limited Solidity experience introduces serious bugs. Their Ownable, Pausable, ReentrancyGuard are audited and battle-tested |
| Contract framework | Hardhat | Industry standard for Solidity compilation, testing, deployment |
| Network | Ethereum Sepolia testnet | Completely free. Sepolia ETH from faucet costs nothing. Same tools as mainnet. Judges recognise it immediately |
| Deployment | IPserverone NovaCloud VPS | Malaysia-Cyberjaya region. Already have account with 200 points. Ubuntu 22.04 LTS instance |
| File storage | Local VPS storage via multer | Documents (invoices, photos, PDFs) stored on VPS. Only SHA-256 hash stored on blockchain. No Google Cloud Storage needed — simpler for hackathon |
| Process manager | PM2 | Keeps Node.js running after terminal closes on VPS |

---

## 6. Blockchain Architecture — The Two Layers

This is the most important architectural decision. Understand it fully.

### Why We Use Blockchain (The Honest Answer)

Blockchain is NOT used because it sounds impressive.
Blockchain is used because of one specific property that no database has:

"Nobody owns the truth."

In DonorLedger, four parties distrust each other:
- Donors do not trust NGOs
- NGOs do not trust platforms
- MACC does not trust anyone's records
- Bank Islam cannot be seen as the sole arbiter

When all four parties distrust each other, you need a system where no
single party controls the data. That is blockchain's one genuine superpower
and it applies here.

A database always has an owner who can be pressured, corrupted, or
compromised. Blockchain has no owner. That is the entire point.

### When Does Blockchain Actually Matter?

Blockchain is NOT for the normal case where everything works fine.
Blockchain is for the DISPUTE CASE — when someone lies.

When an NGO director is arrested and claims Bank Islam fabricated records,
the on-chain signatures prove what actually happened. Nobody can alter
a past block. The evidence was written at the time. It is permanent.

With a database, a motivated party with server access or a court order
can alter records. With blockchain, mathematical proof makes alteration
computationally impossible.

### The Judge Question You Will Face

Judge: "Why can't you just use a regular database?"

Answer: "A database can be edited by whoever controls the server — which
is exactly how NGO fraud works today. The NGO or platform admin could
delete or alter records. Blockchain removes that possibility. No single
party controls the truth — not the NGO, not Bank Islam, not even our own
team as the developers. That trustless property is the only reason we use
blockchain. It is not decorative."

### Layer 1 — Bank Islam Sees Everything (Private Transactions)

All actual transaction data lives here:
- Every donation: exact ringgit amount, donor hash, timestamp, campaign
- Every disbursement request: category, amount, vendor, evidence hash
- Every Bank Islam approval with their cryptographic signature
- Every AI flag: confidence score, reason, patterns detected
- Every fund freeze and unfreeze with reasons and timestamps
- Every vendor approval by Bank Islam after KYC

Bank Islam has full visibility into everything.
MACC gets read access — can query directly without subpoenaing Bank Islam.
This removes months from fraud investigations — evidence is already there.

For hackathon demo: Sepolia testnet acts as single layer.
In production: Private Hyperledger Fabric node where Bank Islam is validator.

### Layer 2 — Donor Sees Impact Only (Public Transparency)

This is what DonorTracker.sol serves:
- Donor's personal fund journey in plain English milestones
- Campaign progress shown as percentages — not raw ringgit amounts
- Status: active / under review / funds released / completed / frozen
- Zero blockchain terminology, zero transaction hashes, zero wallet addresses

The donor's tracker link is just a URL.
It reads from DonorTracker.sol and renders plain language.
The donor never knows blockchain exists.
This is intentional — blockchain is invisible infrastructure.

### The Crowdfunding Display

The frontend shows a GoFundMe-style progress bar:
"RM87,450 raised — 87% of RM100,000 — 1,247 donors"

But underneath, every number is derived from immutable blockchain records.
Nobody can inflate the total. Nobody can fake donor counts.

Without blockchain: the display is just a number someone typed.
With blockchain: the display is mathematical truth derived from real
cryptographic transactions that nobody can fake.

The crowdfunding display motivates donors — it is the behavioural layer.
The blockchain makes the display honest — it is the integrity layer.
Both are needed. Neither works without the other.

---

## 7. Bank Islam Framing — Critical

This affects every comment you write, every variable you name,
every function description you add. Get this wrong and the pitch fails.

### The Core Tension

Bank Islam judges work for a bank. If you say "blockchain means nobody
can modify records including the bank" — they hear:
"We don't trust you. We built a system to put you on a leash."

That is an accusation dressed as a feature. They will mark you down.

### The Correct Frame

Blockchain does not restrict Bank Islam. Blockchain PROTECTS Bank Islam.

When fraud happens, everyone points fingers. With blockchain, Bank Islam
has a permanent, unforgeable record of exactly what they approved, when,
and what evidence was submitted. No NGO director can claim "Bank Islam
knew about the fraud" if Bank Islam's on-chain records show they didn't.
The cryptographic signature is their alibi.

### Never Write These Comments
```javascript
// Blockchain prevents Bank Islam from modifying records
// Immutability means no single party including bank can change data
// Trustless system removes need for bank oversight
// Nobody including Bank Islam can alter past records
```

### Always Write These Comments
```javascript
// Blockchain gives Bank Islam permanent cryptographic proof of every decision
// Bank Islam's signature is on-chain — NGO cannot dispute approval in court
// Immutable audit trail protects Bank Islam from false fraud accusations
// Bank Islam is the trust anchor — their signature makes the system legitimate
// Blockchain reduces Bank Islam's compliance burden — evidence auto-assembled
```

### Three Things Blockchain Does FOR Bank Islam
1. Protects them from false accusations — permanent signed record of every approval
2. Reduces compliance cost — MACC gets live audit trail, no manual reconstruction
3. Gives them a new product — verified charity credentialing no Malaysian bank offers

---

## 8. Smart Contracts

### Why OpenZeppelin (Not From Scratch)
With one previous Solidity experience, writing security-critical contract
code from scratch in 48 hours introduces serious bugs. The DAO hack in 2016
lost $60 million from one bug in an audited contract written by experts.
OpenZeppelin v5 contracts are audited, battle-tested, used by every major
protocol. We write our logic on top of their secure foundation.

### Registry.sol

```
Base: OpenZeppelin Ownable
Owner wallet: Bank Islam admin (BANK_ISLAM_PRIVATE_KEY)
Network: Ethereum Sepolia testnet
Purpose: Single source of truth for verified NGO credentials

Key design decisions:
- Credentials have expiry timestamps — annual renewal required
  (Bank Islam calls renewNGO() each year after re-verification)
- isVerified() returns false for expired OR revoked credentials
- revokeNGO() is permanent and writes to public blacklist
- Production upgrade path: transferOwnership() allows multi-sig later
  For hackathon: single Bank Islam wallet. Multi-sig is production plan.

Functions:
addNGO(address, name, regNumber, riskTier, expiryDate) — onlyOwner
renewNGO(address, newExpiryDate) — onlyOwner (annual re-verification)
revokeNGO(address, reason) — onlyOwner (permanent, writes blacklist entry)
isVerified(address) → bool — public (false if expired or revoked)
getNGODetails(address) → NGOCredential struct — public

Events:
NGOVerified(address indexed ngo, string name, uint256 expiryDate)
NGORenewed(address indexed ngo, uint256 newExpiryDate)
NGORevoked(address indexed ngo, string reason, uint256 timestamp)
```

### Campaign.sol

```
Base: OpenZeppelin Ownable + Pausable + ReentrancyGuard
Owner wallet: Bank Islam admin (BANK_ISLAM_PRIVATE_KEY)
Deployed: Once per campaign by backend server
Network: Ethereum Sepolia testnet
Purpose: Lock allocation rules, record donations, control disbursements

Key design decisions:
- Constructor percentages are PERMANENT (immutable) — the NGO's promise
  cannot be changed after campaign goes live under any circumstance
- Funds release ONLY to pre-approved vendor wallet addresses
  (Bank Islam calls addApprovedVendor() after vendor KYC check)
- Donor selects a vendor/cause category when donating — earmarks their
  specific contribution to that category from the start
- pauseCampaign() can be called by Bank Islam wallet OR backend AI trigger
  wallet (SERVER_WALLET_PRIVATE_KEY) — AI does not need Bank Islam approval
  to freeze, but Bank Islam is needed to unfreeze
- Production plan: Proxy upgrade pattern for bug fixes without data loss
  For hackathon: standard deployment. Proxy noted as production upgrade.

Constructor parameters (permanent after deploy):
ngoAddress, campaignName, causeType
aidPercent + logisticsPercent + adminPercent (must sum to 100)
targetAmount, endDate, registryContractAddress

Functions:
donate(donorHash, amount, vendorChoice) — called by backend bridge service
submitEvidence(documentHash, category, amount, vendorAddress) — NGO portal
approveDisbursement(evidenceId) — onlyOwner (Bank Islam wallet only)
rejectDisbursement(evidenceId, reason) — onlyOwner
pauseCampaign(reason) — Bank Islam wallet OR server wallet (AI trigger)
unpauseCampaign() — onlyOwner (Bank Islam only — AI cannot unpause)
addApprovedVendor(vendorAddress) — onlyOwner (after vendor KYC)

Events:
DonationReceived(bytes32 donorHash, uint256 amount, address vendorChoice)
EvidenceSubmitted(uint256 evidenceId, string category, uint256 amount)
DisbursementApproved(uint256 evidenceId, address vendor, uint256 amount)
DisbursementRejected(uint256 evidenceId, string reason)
CampaignPaused(string reason, uint256 timestamp)
CampaignUnpaused(uint256 timestamp)
VendorApproved(address vendor, uint256 timestamp)
```

### DonorTracker.sol

```
Base: OpenZeppelin Ownable
Owner wallet: Server wallet (SERVER_WALLET_PRIVATE_KEY)
Network: Ethereum Sepolia testnet
Purpose: Public anonymised transparency layer — what donor tracker reads

Key design decisions:
- Stores only human-readable milestones — no raw financial amounts exposed
- Completely separate from Campaign.sol — donor-facing data is decoupled
  from the financial enforcement layer
- Backend calls updateMilestone() whenever fund status changes
- getCampaignProgress() returns percentages for the frontend progress bar
  (powers the crowdfunding display with blockchain-verified numbers)

Functions:
updateMilestone(donorHash, milestone, description) — onlyOwner
getDonorJourney(donorHash) → Milestone[] — public read
getCampaignProgress(campaignId) → Progress (percentages) — public read

Milestone types used:
RECEIVED, ALLOCATED, RELEASED, CONFIRMED, UNDER_REVIEW, FROZEN, COMPLETED

Events:
MilestoneUpdated(bytes32 donorHash, string milestone, uint256 timestamp)
```

---

## 9. Two Server-Side Wallets — Security Separation

Two wallets exist in .env — this is intentional security design:

```
BANK_ISLAM_PRIVATE_KEY
Signs: addNGO, renewNGO, revokeNGO, approveDisbursement,
       rejectDisbursement, unpauseCampaign, addApprovedVendor
This wallet is loaded only when Bank Islam admin action is explicitly
triggered via admin API endpoint. Not running continuously in background.

SERVER_WALLET_PRIVATE_KEY
Signs: donate(), updateMilestone(), pauseCampaign()
This is the bridge wallet — lower privilege, runs continuously.
```

Why two wallets: If the bridge server is ever compromised, the attacker
only gets the lower-privilege wallet. They cannot approve disbursements
or unpause campaigns — those require the Bank Islam wallet.
This limits the blast radius of a server compromise.

For hackathon demo: both are just MetaMask test wallets with Sepolia ETH.
For production: Bank Islam wallet would be a hardware security module (HSM).

---

## 10. DuitNow Bridge — How Ringgit Connects to Blockchain

This is how donor pays in ringgit and blockchain records it invisibly.

```
Step 1: Donor taps "Donate via DuitNow" on frontend
Step 2: Frontend calls POST /api/donate with { campaignId, amount, donorEmail, vendorChoice }
Step 3: Backend simulates DuitNow payment receipt
        (demo: POST /api/demo/simulate-duitnow button)
        (production: real webhook from Bank Islam payment system)
Step 4: bridge.service.js receives payment confirmation
Step 5: hash.utils.js creates donorHash = SHA256(email + campaignId + timestamp + salt)
        donorHash goes on blockchain — email stays in PostgreSQL only
Step 6: contract.service.js calls Campaign.donate(donorHash, amount, vendorChoice)
Step 7: Sepolia blockchain writes immutable donation record
Step 8: contract.service.js calls DonorTracker.updateMilestone(donorHash, "RECEIVED", "...")
Step 9: Backend saves to PostgreSQL: { donorHash, donorEmail, amount, campaignId, txHash }
Step 10: API returns { txHash, trackerUrl } to frontend
Step 11: Frontend shows donor their tracker link — just a URL

Ringgit never converts to crypto at any point.
Bank Islam holds ringgit in escrow throughout.
Blockchain is a shadow audit ledger recording what the escrow does.
Donor sees nothing blockchain-related — just a tracker URL.
```

### Why No MetaMask for Donors

MetaMask is for developers deploying contracts and getting Sepolia ETH.
After deployment, MetaMask is done. Everything runs through server wallets.

```
WRONG mental model: Donor → MetaMask popup → signs transaction → blockchain
CORRECT model:      Donor → React app → Node.js backend
                                              ↓
                                   server wallet in .env
                                              ↓
                                         blockchain
```

---

## 11. NGO Registration and KYC Flow

### Five-Stage Registration (What Bank Islam Verifies)

Stage 1 — Automated pre-screening:
- SSM database query (is entity active and registered?)
- ROS database query (if registered as society)
- Director MyKad check against JPN database
- MACC investigation check (is any director currently under investigation?)
- Blacklist check (previously rejected or banned?)
- Bank account ownership check (account must belong to the entity, not personal)

Stage 2 — Bank Islam human KYC review:
- PEP screening (politically exposed persons — higher risk, not automatic reject)
- Financial crime history for every director
- Audited financial statements from past 2 years
- Cause verification — is it legal, specific enough to enforce, Shariah-compliant?
- Allocation reasonableness check against industry benchmarks

Stage 3 — Risk scoring (determines monitoring intensity):
- Low risk: established NGO, 5+ years, clean accounts → quarterly automated review
- Medium risk: newer NGO, limited history → monthly review + AI monitoring
- High risk: first campaign, new entity → every disbursement manually reviewed

Stage 4 — On-chain credential issued with 12-month expiry
Stage 5 — Annual re-verification (Bank Islam calls renewNGO() to extend)

### For Hackathon Demo
KYC is simulated through the Bank Islam admin panel.
Admin clicks "Approve NGO" → backend calls Registry.addNGO() with
a 12-month expiry date from today.
Use sample data for all NGO documents.

---

## 12. Vendor KYC Flow — Shell Vendor Prevention

### Why Vendors Need KYC (The Limitation We Addressed)

An NGO could create a shell company as a "vendor" — register it with SSM,
get it approved, then release all donated funds to themselves through it.
The smart contract would see a "legitimate vendor payment" and approve it.

Without vendor KYC: shell vendor attack is possible.
With vendor KYC: every vendor must pass Bank Islam verification before
being added to the contract as an approved recipient.

### How Vendor Selection Works for Donors

Campaigns have multiple approved vendors for different cause categories:
Example — "Banjir Kelantan Relief 2026":
- Food supply: Syarikat Makanan ABC (Bank Islam verified ✓)
- Logistics: Ekspres XYZ Sdn Bhd (Bank Islam verified ✓)
- Medical aid: Klinik Komuniti 123 (Bank Islam verified ✓)

Donor selects "Food supply" when donating RM50.
Their specific RM50 is earmarked for the food supply vendor from donation time.
Smart contract records the vendor choice in the donation event.

### Vendor Registration Flow in Backend

```
NGO submits vendor: name, SSM number, bank account, service type, wallet address
        ↓
Backend saves vendor with status "pending_kyc"
        ↓
Bank Islam admin dashboard shows pending vendor
        ↓
Bank Islam reviews: SSM active? Business nature matches service? Bank account valid?
        ↓
If approved: Bank Islam calls addApprovedVendor() on Campaign contract
        ↓
Vendor wallet address is now on the approved list
        ↓
Contract will only release funds to this address for this campaign
```

---

## 13. NGO Evidence Submission Flow

NGOs must submit a 5-document package before any disbursement is released.
The smart contract stores the SHA-256 hash of the package on-chain.
This proves the documents existed at submission time and were not altered.
Actual files are stored in uploads/ on the VPS.

### The Five Required Documents

1. Vendor SSM registration — proves vendor is a real registered company
2. Service agreement — must be dated BEFORE campaign launch date
   (backdated agreements are flagged — blockchain recorded the campaign
    launch date, any agreement after that timestamp is suspicious)
3. Itemised invoice — unit price × quantity breakdown required
   "Services rendered: RM50,000" is rejected — too vague to verify
   "500 food packs × RM100 = RM50,000" is accepted
4. Proof of delivery — delivery order signed by recipient, photos,
   or service completion report with GPS tags if possible
5. Recipient confirmation — Bank Islam sends SMS to beneficiary asking
   "Did you receive this aid? Reply YES or NO"

### For Hackathon Demo

Real documents do not exist. Use sample/example files.
The workflow validation must still run — just with demo data.

Recipient confirmation simulation:
POST /api/demo/recipient-confirm
Auto-returns positive confirmation after 5-second delay.
Show judges: "Bank Islam receives confirmation directly from beneficiary —
completely independent of the NGO."

---

## 14. AI Service — Gemini Fraud Detection

### What Gemini Does

Every disbursement request is analysed before Bank Islam reviews it.
Gemini receives structured financial data — NEVER personal donor data
(no names, no emails, no MyKad numbers — anonymised financial data only).

### Fraud Patterns Gemini Watches For (From MACC Malaysia Cases)

- Admin costs exceed declared percentage by more than 10%
- Large payment to vendor registered less than 6 months ago
- Funds idle more than 30 days then sudden large withdrawal
- Same vendor receiving from multiple unrelated NGO campaigns
- Invoice amount inconsistent with Malaysian market rates for claimed service
- Multiple transfers to same wallet within 24 hours
- Donations still being collected after campaign end date
- Spending pattern matches known fraud cases from MACC investigation data

### Confidence Score Routing

Thresholds come from env vars — never hardcode:

```
AI_REVIEW_THRESHOLD (default 60):
Below 60   → flag in Bank Islam dashboard, add note, funds flow normally
60 to 85   → flag with warning, Bank Islam must manually approve before release
Above 85   → AI_FREEZE_THRESHOLD: auto-freeze immediately + MACC alert fires
             contract.service.js calls Campaign.pauseCampaign() automatically
             No human approval needed — speed is critical to prevent fund movement
```

### Who Sees What From the AI Report

This is critical. Never expose raw scores to donors.

Donor sees — plain language ONLY:
- "Under Review — funds paused while we investigate" (if frozen)
- "Your donation is being processed" (if below freeze threshold)
- NEVER: confidence score, flagged patterns, reason text
- Why: a false positive score of 90 on a legitimate NGO would destroy
  donor confidence in that NGO even if Bank Islam clears them

NGO sees — their own campaign only:
- AI score for their own disbursement request
- Reason text (one sentence)
- Recommendation: approve / review / freeze
- Helps them understand why they were flagged
- NEVER: other NGOs' scores or patterns

Bank Islam sees — everything:
- All campaigns, all scores, all patterns
- Full Gemini reasoning text for audit trail
- Comparison across campaigns (detects cross-campaign shell vendor patterns)
- Historical score trends per NGO

MACC sees — full package when auto-freeze triggers:
- Complete fund flow history up to freeze point
- AI score, reason, flagged patterns
- All Bank Islam approval signatures on previous disbursements
- Direct link to on-chain evidence — no subpoena needed

### Gemini Response Always Parsed Safely

```javascript
// Gemini sometimes wraps JSON in markdown blocks
// Always strip before parsing
const text = result.response.text()
const clean = text.replace(/```json|```/g, '').trim()
try {
  return JSON.parse(clean)
} catch {
  // Fallback if Gemini returns unexpected format
  return {
    confidenceScore: 50,
    reason: 'Analysis unavailable — manual review required',
    recommendation: 'review',
    flaggedPatterns: []
  }
}
```

---

## 15. Limitations — Know These Before Judges Ask

Name these yourself before judges ask. Shows you built this, not generated it.

### Limitation 1 — KYC verifies identity, not future behaviour
An NGO that passes all KYC checks today can turn fraudulent tomorrow.
The RM230M case involved a legitimate long-standing welfare NGO.
Answer: KYC is gate 1. Smart contract allocation rules are gate 2.
AI monitoring is gate 3. No single layer is sufficient alone.

### Limitation 2 — Oracle problem (biggest technical weakness)
Smart contracts cannot read the real world.
AI checks spending patterns but cannot physically verify a delivery happened.
An NGO could submit a fake invoice and fake delivery photos.
Answer: Bank Islam admin spot-checks + recipient confirmation SMS from
Bank Islam directly to beneficiary (independent of NGO) is second oracle source.
In production: multi-source verification. Demo: simulated confirmation.

### Limitation 3 — NGOs can bypass platform entirely
Nothing legally forces NGOs to use DonorLedger.
Answer: Bank Islam controls DuitNow payment rails.
If you want to receive DuitNow donations with a verified badge,
your campaign must be on the ledger. That incentive drives adoption.

### Limitation 4 — Shell vendor fraud
Sophisticated NGO creates real SSM-registered company, gets it KYC approved,
releases funds there, splits excess back to NGO.
Answer: Vendor KYC required (business nature must match claimed service).
AI benchmarks invoice unit prices against Malaysian market rates.
Price inflation above market rate triggers flag.

### Limitation 5 — AI false positives freeze legitimate aid
Disaster response NGO spikes admin costs legitimately (emergency logistics staff).
AI auto-freezes. Real flood victims wait.
Answer: Auto-freeze only above 85% confidence. Between 60-85 is Bank Islam
human review without freezing. Threshold is tunable via env vars.
In disaster contexts, tune threshold upward to reduce false positives.

### Limitation 6 — Smart contract bugs are permanent
Once deployed, bugs cannot be patched by updating code.
Answer: OpenZeppelin audited base reduces risk significantly.
Production plan: proxy upgrade pattern (separates data from logic —
logic can be upgraded without losing historical records).
For hackathon: Sepolia testnet means bugs have zero real financial impact.
We acknowledge the risk and describe the production mitigation.

### Limitation 7 — Donor privacy on public chain
Blockchain analysis could potentially de-anonymize donors.
Answer: Hashed + salted donor IDs on chain. Real identity only in PostgreSQL.
Bank Islam holds identity data under PDPA. Never on-chain.

### Limitation 8 — Bank Islam as single point of trust
Bank Islam controls KYC gateway — if their systems fail, platform stops.
Answer: Deliberate v1 tradeoff. A fully trustless system has zero legal
enforceability and zero adoption in Malaysia. Bank Islam's involvement
bridges blockchain to the real legal and financial system.
Production v2: multi-institution co-signing (BNM + ROS + Bank Islam).

---

## 16. Code Conventions

### ES modules only
```javascript
import express from 'express'     // correct
const express = require('express') // NEVER
```

### Async/await only
```javascript
const result = await service.doThing()   // correct
service.doThing().then(r => {})           // NEVER
```

### Thin routes, fat services
Routes: receive → validate → call service → return response.
All business logic in services/ only.

### Environment variables
All accessed through config/env.js — never process.env directly in services.

### Error pattern
```javascript
const err = new Error('NGO credential expired')
err.status = 403
throw err
// error.middleware.js global handler catches this
```

### Never log sensitive data
```javascript
console.log(wallet.privateKey)  // NEVER
console.log(donorEmail)         // NEVER in production logs
console.log(wallet.address)     // OK — public data
```

### All contract calls through contract.service.js only
No other file creates ethers.Contract instances directly.

---

## 17. File Structure

```
donorledger/
├── backend/src/
│   ├── server.js                  Express app + route registration
│   ├── config/
│   │   ├── env.js                 Only file that reads process.env
│   │   ├── gemini.js              GoogleGenerativeAI client init
│   │   ├── blockchain.js          provider, bankIslamWallet, serverWallet
│   │   ├── database.js            PrismaClient singleton
│   │   └── queue.js               Bull queue with Redis connection
│   ├── routes/
│   │   ├── donate.routes.js       POST /api/donate
│   │   ├── campaign.routes.js     GET /api/campaign, GET /api/campaign/:id
│   │   │                          GET /api/campaign/:id/vendors
│   │   ├── evidence.routes.js     POST /api/evidence/submit
│   │   ├── disbursement.routes.js POST /api/disbursement/approve
│   │   │                          POST /api/disbursement/reject
│   │   ├── tracker.routes.js      GET /api/tracker/:donorHash
│   │   ├── ngo.routes.js          POST /api/ngo/register
│   │   ├── vendor.routes.js       POST /api/vendor/submit
│   │   ├── admin.routes.js        All Bank Islam admin endpoints
│   │   └── demo.routes.js         Simulation endpoints for hackathon
│   ├── services/
│   │   ├── bridge.service.js      DuitNow simulation → blockchain
│   │   ├── contract.service.js    All ethers.js contract interactions
│   │   ├── ai.service.js          Gemini fraud detection + routing
│   │   ├── alert.service.js       MACC webhook + Bank Islam dashboard alert
│   │   ├── storage.service.js     multer local file handling + SHA256 hash
│   │   ├── kyc.service.js         NGO KYC simulation workflow
│   │   └── vendor.service.js      Vendor KYC + approval workflow
│   ├── middleware/
│   │   ├── auth.middleware.js     JWT verify (Bank Islam admin routes)
│   │   ├── validate.middleware.js Request body validation
│   │   └── error.middleware.js    Global error handler
│   ├── listeners/
│   │   └── contract.listener.js   On-chain event listeners
│   └── utils/
│       ├── hash.utils.js          createDonorHash(), hashFile()
│       └── format.utils.js        Amount and date formatting
├── contracts/contracts/
│   ├── Registry.sol
│   ├── Campaign.sol
│   └── DonorTracker.sol
├── contracts/scripts/
│   ├── deploy.js                  Deploy all 3 to Sepolia
│   └── seed.js                    Register test NGO + campaign + vendors
├── uploads/                       Local document storage (gitignored)
│   ├── invoices/
│   ├── agreements/
│   ├── delivery-proof/
│   └── vendor-registration/
└── prisma/schema.prisma
```

---

## 18. Demo Simulation Endpoints

These exist for hackathon demo only — not production:

```
POST /api/demo/simulate-duitnow
Simulates DuitNow payment webhook received by Bank Islam.
Called by frontend "Pay via DuitNow" button.
Triggers bridge.service.js → contract donate() → tracker update.

POST /api/demo/recipient-confirm
Simulates Bank Islam sending SMS to beneficiary and getting YES reply.
Auto-returns positive confirmation after 5-second delay.
Used as the recipient oracle confirmation in evidence flow.
Show judges: "Bank Islam receives this confirmation independently of the NGO."

POST /api/demo/simulate-fraud
Submits a disbursement where admin costs exceed declared allocation.
Example: campaign declared 10% admin, this request pushes admin to 45%.
Triggers Gemini analysis → high confidence score → auto-freeze →
MACC webhook alert fires → donor tracker updates to "Under Review."
This is the "wow moment" — show this to judges after the normal donation flow.
```

---

## 19. Deployment — IPserverone NovaCloud

Platform: IPserverone NovaCloud
Region: Malaysia-Cyberjaya (MYS1a)
Account balance: 200 points
OS: Ubuntu 22.04 LTS
Process manager: PM2
Redis: IPserverone Redis service (available in dashboard sidebar)
Database: PostgreSQL installed on same VPS instance
Blockchain: Sepolia testnet via Infura free tier

VPS exposes backend on port 3001.
Frontend connects to http://YOUR_VPS_IP:3001 as API base URL.

---

## 20. What Not To Touch

- frontend/ — teammate's responsibility
- contracts/artifacts/ — regenerated by hardhat compile, never edit manually
- prisma/migrations/ — auto-generated, never edit manually
- .env files — contain private keys, never commit to Git
- uploads/ — runtime document storage, never commit to Git

---

## 21. Hackathon Priorities

1. End-to-end demo works without breaking
   (donate → tracker → evidence → AI flag → freeze → MACC alert)
2. Smart contract allocation enforcement is correct and tested
3. Gemini AI is clearly load-bearing — not just an API call with no purpose
4. Bank Islam framing is correct throughout all code comments
5. Code is readable and explainable when judges ask "walk me through this"
6. Error handling is present — demo does not crash on bad input

Perfect code is not the goal.
Working, readable, explainable code that demos cleanly is the goal.
