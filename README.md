# DonorLedger 🔗

> **Blockchain-powered donation transparency for Malaysia.**
> Every ringgit traceable. No crypto knowledge needed.

Built for **Hackathon X Fintech Forward 2026** — Be U by Bank Islam × UMPSA
**Track 1: Reimagine Money** — Islamic Digital Finance + Fraud Detection

---

## 👥 Team

| Role | Responsibility |
|---|---|
| Backend Engineer | Node.js server, Smart contracts (Solidity), Gemini AI integration, blockchain bridge, deployment |
| Frontend Engineer | UI/UX design (Figma), frontend implementation, donor tracker, campaign browser |
| Pitcher | Presentation, research, judge Q&A, documentation support |

---

## 🚨 The Problem

In 2024–2026, Malaysians lost over **RM300 million** in donated funds to NGO fraud:

- **RM230 million** misappropriated by a single welfare NGO
- **RM70 million** in Gaza fundraising fraud — 41 bank accounts frozen by MACC
- **96,722 registered NGOs** in Malaysia — zero real-time accountability infrastructure
- **No specific law** exists to regulate online donation drives in Malaysia
- Law enforcement admits they cannot act in real time — investigations take months

> *"Every year, Malaysians donate billions in good faith — but once the money leaves their hands, it disappears into a black box that nobody, not donors, not regulators, not even MACC, can see inside in real time."*

---

## 💡 The Solution

DonorLedger is a blockchain-powered donation transparency platform:

- **NGOs are verified** by Bank Islam KYC before receiving a single donation
- **Fund allocation rules** are locked in smart contracts — impossible to change after campaign launch
- **Money never touches NGO hands** — Bank Islam holds all funds in escrow, releases directly to verified vendors only
- **NGOs must submit evidence** (invoice, service agreement, delivery proof) before any ringgit is released
- **AI monitors** every disbursement in real time using Google Gemini, flags fraud patterns automatically
- **Funds auto-freeze** when anomaly is detected — MACC alerted immediately
- **Donors use DuitNow** — no crypto wallet, no seed phrase, no technical knowledge needed
- **Donor tracker** shows personal fund journey in plain language — no blockchain visible

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER LAYER                             │
│                                                                 │
│   Donor App          NGO Portal          Bank Islam Admin       │
│   (Frontend)         (Frontend)          Dashboard (Frontend)   │
└──────────┬───────────────┬──────────────────────┬──────────────┘
           │               │                      │
           ▼               ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND LAYER                                 │
│               Node.js + Express.js                              │
│              IPserverone NovaCloud VPS                          │
│                                                                 │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │  REST API    │  │ Bridge Service│  │   AI Monitor Service │ │
│  │  (Express)   │  │ DuitNow→Chain │  │   (Gemini API)       │ │
│  └──────────────┘  └───────────────┘  └──────────────────────┘ │
│                                                                 │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │  Webhook     │  │ Contract      │  │   Alert Service      │ │
│  │  Handler     │  │ Event         │  │   (MACC + BankIslam) │ │
│  │              │  │ Listener      │  │                      │ │
│  └──────────────┘  └───────────────┘  └──────────────────────┘ │
│                                                                 │
│  ┌──────────────┐  ┌───────────────┐                           │
│  │  PostgreSQL  │  │  Redis        │                           │
│  │  (IPserver1) │  │  (IPserver1)  │                           │
│  └──────────────┘  └───────────────┘                           │
└──────────┬───────────────┬──────────────────────────────────────┘
           │               │
           ▼               ▼
┌──────────────────┐   ┌──────────────────────────────────────────┐
│  BLOCKCHAIN      │   │         EXTERNAL SERVICES                │
│  LAYER           │   │                                          │
│                  │   │  Google Gemini API — AI fraud detection  │
│  Registry.sol    │   │  Infura — Sepolia RPC endpoint           │
│  Campaign.sol    │   │  Local Storage — NGO document files      │
│  DonorTracker    │   │  Webhook.site — MACC alert simulation    │
│  .sol            │   │                                          │
│                  │   │                                          │
│  Ethereum        │   │                                          │
│  Sepolia Testnet │   │                                          │
│  (FREE)          │   │                                          │
└──────────────────┘   └──────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | v20 LTS | Server runtime |
| Express.js | ^4.18 | REST API framework + webhook handling |
| ethers.js | ^6.9 | Smart contract interaction from backend |
| @google/generative-ai | ^0.2 | Google Gemini AI SDK for fraud detection |
| prisma | ^5.0 | PostgreSQL ORM — database queries |
| @prisma/client | ^5.0 | Generated database client |
| bull | ^4.12 | Redis-backed job queue for async AI analysis |
| multer | ^1.4 | Local file upload handling for NGO documents |
| jsonwebtoken | ^9.0 | JWT auth for Bank Islam admin endpoints |
| bcryptjs | ^2.4 | Password hashing |
| dotenv | ^16.0 | Environment variable management |
| cors | ^2.8 | Cross-origin requests from frontend |
| helmet | ^7.0 | Basic security headers |
| jest | ^29.0 | Unit testing |

### Smart Contracts
| Technology | Version | Purpose |
|---|---|---|
| Solidity | ^0.8.20 | Smart contract language |
| Hardhat | ^2.19 | Compile, test, deploy framework |
| OpenZeppelin Contracts | ^5.0 | Audited base contracts — Ownable, Pausable, ReentrancyGuard |
| ethers.js | ^6.9 | Hardhat + backend contract interaction |
| @nomicfoundation/hardhat-toolbox | ^4.0 | Testing utilities |
| Ethereum Sepolia Testnet | — | Free test network for demo deployment |

### Infrastructure
| Service | Purpose |
|---|---|
| IPserverone NovaCloud | VPS — runs Node.js backend + PostgreSQL + Redis |
| Ethereum Sepolia | Free testnet for smart contract deployment |
| Infura (free tier) | Sepolia RPC URL — connects backend to blockchain |
| Local VPS Storage | NGO document files (invoices, photos, PDFs) |

---

## 📁 Project Structure

```
donorledger/
│
├── backend/
│   ├── src/
│   │   ├── server.js                      # Express entry point
│   │   │
│   │   ├── config/
│   │   │   ├── env.js                     # Validate + export env vars
│   │   │   ├── gemini.js                  # Gemini API client init
│   │   │   ├── blockchain.js              # ethers provider + wallets
│   │   │   ├── database.js                # Prisma client init
│   │   │   └── queue.js                   # Bull queue init (Redis)
│   │   │
│   │   ├── routes/
│   │   │   ├── donate.routes.js           # POST /api/donate
│   │   │   ├── campaign.routes.js         # GET /api/campaign
│   │   │   │                              # GET /api/campaign/:id
│   │   │   ├── evidence.routes.js         # POST /api/evidence/submit
│   │   │   ├── disbursement.routes.js     # POST /api/disbursement/approve
│   │   │   │                              # POST /api/disbursement/reject
│   │   │   ├── tracker.routes.js          # GET /api/tracker/:donorHash
│   │   │   ├── ngo.routes.js              # POST /api/ngo/register
│   │   │   └── admin.routes.js            # All Bank Islam admin routes
│   │   │
│   │   ├── services/
│   │   │   ├── bridge.service.js          # DuitNow simulation → blockchain
│   │   │   ├── contract.service.js        # All ethers.js contract calls
│   │   │   ├── ai.service.js              # Gemini fraud detection logic
│   │   │   ├── alert.service.js           # MACC + Bank Islam alerts
│   │   │   ├── storage.service.js         # Local file storage (multer)
│   │   │   └── kyc.service.js             # Bank Islam KYC simulation
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js         # JWT verify for admin routes
│   │   │   ├── validate.middleware.js     # Request body validation
│   │   │   └── error.middleware.js        # Global error handler
│   │   │
│   │   ├── listeners/
│   │   │   └── contract.listener.js       # Listen for on-chain events
│   │   │                                  # (DonationReceived, CampaignPaused)
│   │   │
│   │   └── utils/
│   │       ├── hash.utils.js              # Donor ID hashing (SHA-256)
│   │       └── format.utils.js            # Amount + date formatting
│   │
│   ├── prisma/
│   │   ├── schema.prisma                  # Database schema
│   │   └── migrations/                    # Auto-generated migrations
│   │
│   ├── uploads/                           # Local NGO document storage
│   │   ├── invoices/
│   │   ├── agreements/
│   │   └── delivery-proof/
│   │
│   ├── .env                               # Your actual secrets (never commit)
│   ├── .env.example                       # Template (safe to commit)
│   ├── .gitignore
│   ├── package.json
│   └── jest.config.js
│
├── contracts/
│   ├── contracts/
│   │   ├── Registry.sol                   # NGO credential registry
│   │   ├── Campaign.sol                   # Per-campaign fund control
│   │   └── DonorTracker.sol               # Public transparency layer
│   │
│   ├── scripts/
│   │   ├── deploy.js                      # Deploy all 3 contracts to Sepolia
│   │   └── seed.js                        # Register test NGO + campaign
│   │
│   ├── test/
│   │   ├── Registry.test.js
│   │   └── Campaign.test.js
│   │
│   ├── hardhat.config.js
│   ├── .env                               # Separate .env for contracts
│   └── package.json
│
├── frontend/                              # Frontend teammate's folder
│   └── ...
│
└── README.md
```

---

## 🔄 Core Workflows

### Workflow 1 — Donation

```
1.  Donor picks a verified campaign on the frontend
2.  Frontend calls  POST /api/donate
                    body: { campaignId, amount, donorEmail }
3.  bridge.service.js simulates receiving DuitNow payment
4.  contract.service.js calls Campaign.donate(donorHash, amount)
5.  Smart contract writes immutable record on Sepolia
6.  Backend generates unique donorHash for this donor
7.  Backend saves donor email + donorHash to PostgreSQL
    (email is off-chain — never goes on blockchain)
8.  API returns { txHash, trackerUrl } to frontend
9.  Frontend shows donor their tracker link
```

### Workflow 2 — Evidence Submission + AI Check

```
1.  NGO submits disbursement request via NGO portal
2.  Frontend calls  POST /api/evidence/submit
                    body: { campaignId, category, amount,
                            vendorId, documents[] }
3.  storage.service.js saves files to /uploads/ on VPS
4.  contract.service.js writes SHA-256 hash of documents on-chain
    (proves documents existed at this timestamp — not alterable)
5.  Bull queue adds AI analysis job
6.  ai.service.js sends structured prompt to Gemini API:
    — campaign type, declared allocation %
    — spending history to date
    — this disbursement: amount, category, vendor
    — known fraud patterns from MACC cases
7.  Gemini returns { confidenceScore, reason, recommendation }
8a. Score BELOW 60  → flag in Bank Islam dashboard for human review
                      funds continue to flow normally
8b. Score 60-85     → flag with warning, Bank Islam must approve
                      before release
8c. Score ABOVE 85  → contract.service.js calls pauseCampaign()
                      alert.service.js fires MACC webhook alert
                      donor tracker updates to "Under Review"
```

### Workflow 3 — Disbursement Approval

```
1.  Bank Islam reviews evidence in admin dashboard
2.  Bank Islam clicks approve
3.  Frontend calls  POST /api/disbursement/approve
                    header: Authorization: Bearer <jwt>
4.  auth.middleware.js verifies Bank Islam JWT
5.  contract.service.js calls Campaign.approveDisbursement(evidenceId)
6.  Smart contract checks: does this amount keep all
    categories within declared allocation %?
    — If NO  → transaction reverted, approval rejected
    — If YES → DisbursementApproved event emitted on-chain
7.  contract.listener.js catches the event
8.  Bank Islam escrow releases ringgit directly to vendor
    bank account (simulated in demo)
9.  Donor tracker updates to "Funds Released to Vendor"
```

---

## 🤖 AI Tools Used

| Tool | How Used |
|---|---|
| **Google Gemini API** | Core fraud anomaly detection — analyses every disbursement request against declared allocation rules and known fraud patterns, returns confidence score and recommendation |
| **Claude by Anthropic** | System architecture design, problem statement development, pitch strategy, limitation analysis |
| **GitHub Copilot** | Code completion during hackathon build |

### Gemini Prompt Structure (ai.service.js)

Every disbursement request sends this structured prompt to Gemini:

```
You are a financial fraud detection system for Malaysian NGO donations.

CAMPAIGN CONTEXT:
- Cause type: [disaster_relief / medical_aid / education / etc]
- Declared allocation: [X]% direct aid, [Y]% logistics, [Z]% admin
- Campaign target: RM [amount]
- Total raised so far: RM [amount]

SPENDING HISTORY TO DATE:
- Direct aid spent: RM [amount] ([X]% of raised)
- Logistics spent: RM [amount] ([Y]% of raised)
- Admin spent: RM [amount] ([Z]% of raised)

THIS DISBURSEMENT REQUEST:
- Category claimed: [category]
- Amount: RM [amount]
- Vendor: [vendor name] — registered [X] months ago
- If approved, admin total becomes: [new %]

KNOWN FRAUD PATTERNS (from MACC Malaysia cases):
- Admin costs exceed declared % by more than 10%
- Large payment to vendor registered less than 6 months ago
- Funds idle more than 30 days then sudden large withdrawal
- Same vendor receiving payments from multiple unrelated NGOs
- Invoice amount inconsistent with market rates for claimed service

Analyse this disbursement request.
Return ONLY valid JSON, no markdown:
{
  "confidenceScore": 0-100,
  "reason": "one sentence explanation",
  "recommendation": "approve" | "review" | "freeze",
  "flaggedPatterns": ["pattern1", "pattern2"]
}
```

---

## 📋 Smart Contracts (Solidity + OpenZeppelin)

All three contracts use **OpenZeppelin v5** as the base.
OpenZeppelin is an industry-standard audited contract library — we build on top of it rather than writing security-critical code from scratch.

### Registry.sol

```
Base: Ownable (OpenZeppelin)
Owner: Bank Islam admin wallet
Network: Ethereum Sepolia Testnet
Purpose: Single source of truth for verified NGOs

Key functions:
addNGO(address, name, regNumber, riskTier, expiryDate)
  — Only callable by Bank Islam wallet (onlyOwner)
  — Writes NGO credential on-chain

revokeNGO(address, reason)
  — Only callable by Bank Islam wallet
  — Marks credential as revoked permanently

isVerified(address) → bool
  — Public read — anyone can check if NGO is verified
  — Returns false if expired or revoked

getNGODetails(address) → NGOCredential struct

Key events emitted:
NGOVerified(address indexed ngo, string name, uint256 timestamp)
NGORevoked(address indexed ngo, string reason, uint256 timestamp)
```

### Campaign.sol

```
Base: Ownable + Pausable + ReentrancyGuard (OpenZeppelin)
Deployed: Once per campaign by backend server wallet
Network: Ethereum Sepolia Testnet
Purpose: Locks allocation rules, records all donations,
         controls every disbursement

Constructor sets (PERMANENT — cannot change after deploy):
- ngoAddress
- campaignName
- causeType
- aidPercent + logisticsPercent + adminPercent
- targetAmount
- endDate
- registryContract address (checks NGO is verified)

Key functions:
donate(donorHash, amount)
  — Called by backend bridge when DuitNow payment received
  — Records immutable donation entry

submitEvidence(documentHash, category, amount, vendorAddress)
  — Called by backend when NGO submits disbursement request
  — Stores document hash on-chain (proves doc not tampered)

approveDisbursement(evidenceId)
  — Only callable by Bank Islam wallet
  — Checks allocation % before approving
  — Emits event for contract.listener.js to catch

pauseCampaign(reason)
  — Callable by Bank Islam wallet OR backend AI trigger wallet
  — Uses OpenZeppelin Pausable — blocks all disbursements

unpauseCampaign()
  — Only callable by Bank Islam wallet

Key events emitted:
DonationReceived(bytes32 donorHash, uint256 amount, uint256 timestamp)
EvidenceSubmitted(uint256 evidenceId, string category, uint256 amount)
DisbursementApproved(uint256 evidenceId, address vendor, uint256 amount)
CampaignPaused(string reason, uint256 timestamp)
CampaignUnpaused(uint256 timestamp)
```

### DonorTracker.sol

```
Base: Ownable (OpenZeppelin)
Owner: Backend server wallet
Network: Ethereum Sepolia Testnet
Purpose: Public anonymised transparency layer
         (what donor tracker page reads from)

Key functions:
updateMilestone(campaignId, donorHash, milestone, description)
  — Called by backend when fund status changes
  — Milestone types: RECEIVED, ALLOCATED, RELEASED, CONFIRMED,
                     UNDER_REVIEW, FROZEN, COMPLETED

getDonorJourney(donorHash) → Milestone[]
  — Public read
  — Returns array of milestones for one donor's donation

getCampaignProgress(campaignId) → Progress
  — Public read
  — Returns aggregate % per category for display

Key events emitted:
MilestoneUpdated(bytes32 donorHash, string milestone, uint256 timestamp)
```

---

## 🔐 Environment Variables — Complete Setup Guide

### Step 1 — Get your Sepolia RPC URL (Free)

Infura gives you a free connection URL to the Ethereum Sepolia testnet.
Your backend needs this to talk to the blockchain.

```
1. Go to https://app.infura.io
2. Sign up for a free account
3. Click "Create New API Key"
4. Name it "donorledger"
5. Click on the key → copy the Sepolia HTTPS URL
   It looks like: https://sepolia.infura.io/v3/abc123def456...
```

### Step 2 — Get free Sepolia testnet ETH

You need test ETH to pay gas fees when deploying contracts.
This is completely fake money — not real ETH, zero real cost.

```
1. Open MetaMask
2. Switch network to "Sepolia Test Network"
   (Settings → Advanced → Show test networks → ON)
3. Copy your wallet address
4. Go to https://sepoliafaucet.com
5. Paste your address → click Send
6. You receive 0.5 Sepolia ETH — enough for many deployments
7. Do this for all three wallets:
   - Bank Islam admin wallet
   - Test NGO wallet
   - Test donor wallet
```

### Step 3 — Export your MetaMask private keys

Your backend needs the Bank Islam admin wallet private key to sign
contract transactions from the server side.

```
WARNING: Private keys give full control of the wallet.
Never commit them to GitHub. Never share them.
Only put them in your .env file.

To export from MetaMask:
1. Click the three dots next to your account name
2. Click "Account Details"
3. Click "Export Private Key"
4. Enter your MetaMask password
5. Copy the 64-character hex string
```

You need to export:
- Bank Islam admin wallet private key → BANK_ISLAM_PRIVATE_KEY
- Backend server wallet private key → SERVER_WALLET_PRIVATE_KEY
  (this is the wallet that calls donate() and updateMilestone())

### Step 4 — Deploy contracts and get addresses

Contract addresses do not exist until you deploy them.
Run deployment first, then copy the printed addresses into .env

```bash
cd contracts
npm install
npx hardhat run scripts/deploy.js --network sepolia

# Terminal will print:
# Registry deployed to: 0xABC...
# Campaign deployed to: 0xDEF...
# DonorTracker deployed to: 0x789...
# Copy these three addresses into your backend .env
```

### Step 5 — Get Gemini API key

```
1. Go to https://aistudio.google.com
2. Sign in with your Google account
3. Click "Get API Key" → Create API Key
4. Copy the key — starts with "AIza..."
```

### Step 6 — Set up PostgreSQL on IPserverone VPS

```bash
# After launching your NovaCloud instance and SSH into it:
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo -u postgres psql

# Inside PostgreSQL shell:
CREATE DATABASE donorledger;
CREATE USER donoruser WITH PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE donorledger TO donoruser;
\q

# Your DATABASE_URL will be:
# postgresql://donoruser:your_strong_password@localhost:5432/donorledger
```

### Step 7 — Set up Redis on IPserverone

IPserverone NovaCloud has Redis available as a service in their dashboard sidebar. Use that. No separate installation needed.

```
1. In IPserverone dashboard → click Redis (sidebar)
2. Create a Redis instance
3. Copy the connection URL — looks like:
   redis://default:password@host:port
```

If Redis service is not available on your instance tier, install it manually:
```bash
sudo apt install redis-server -y
sudo systemctl start redis
# URL: redis://localhost:6379
```

---

### Complete .env.example

Copy this to `.env` and fill in every value:

```env
# ─────────────────────────────────────
# SERVER
# ─────────────────────────────────────
PORT=3001
NODE_ENV=development
# Change to 'production' when deploying to IPserverone

# ─────────────────────────────────────
# DATABASE
# PostgreSQL on IPserverone VPS
# ─────────────────────────────────────
DATABASE_URL=postgresql://donoruser:YOUR_DB_PASSWORD@localhost:5432/donorledger

# ─────────────────────────────────────
# REDIS
# IPserverone Redis service or local
# ─────────────────────────────────────
REDIS_URL=redis://localhost:6379
# Replace with IPserverone Redis URL if using their service

# ─────────────────────────────────────
# BLOCKCHAIN — ETHEREUM SEPOLIA TESTNET
# 100% free — no real money involved
# ─────────────────────────────────────

# From Infura (https://app.infura.io) — free account
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Bank Islam admin wallet private key
# Exported from MetaMask → Account Details → Export Private Key
# This wallet signs: addNGO, revokeNGO, approveDisbursement, pauseCampaign
BANK_ISLAM_PRIVATE_KEY=YOUR_64_CHAR_HEX_PRIVATE_KEY

# Backend server wallet private key
# Separate wallet from Bank Islam — signs: donate(), updateMilestone()
SERVER_WALLET_PRIVATE_KEY=YOUR_64_CHAR_HEX_PRIVATE_KEY

# Contract addresses — only available AFTER running deploy.js
# Run: cd contracts && npx hardhat run scripts/deploy.js --network sepolia
# Then copy the three addresses printed in terminal
REGISTRY_CONTRACT_ADDRESS=0x_FILL_AFTER_DEPLOY
CAMPAIGN_CONTRACT_ADDRESS=0x_FILL_AFTER_DEPLOY
DONOR_TRACKER_CONTRACT_ADDRESS=0x_FILL_AFTER_DEPLOY

# ─────────────────────────────────────
# GOOGLE GEMINI AI
# From https://aistudio.google.com
# ─────────────────────────────────────
GEMINI_API_KEY=AIza_YOUR_GEMINI_KEY
GEMINI_MODEL=gemini-1.5-flash
# gemini-1.5-flash is free tier — sufficient for hackathon

# Fraud detection thresholds (tunable)
AI_REVIEW_THRESHOLD=60
# Scores above this → flag for Bank Islam human review
AI_FREEZE_THRESHOLD=85
# Scores above this → auto freeze + MACC alert

# ─────────────────────────────────────
# FILE STORAGE
# Local storage on VPS — no cloud needed
# ─────────────────────────────────────
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png

# ─────────────────────────────────────
# AUTH
# JWT for Bank Islam admin routes
# ─────────────────────────────────────
JWT_SECRET=MINIMUM_32_CHARACTER_RANDOM_STRING_HERE
JWT_EXPIRES_IN=8h

# Demo admin credentials (change in production)
BANK_ISLAM_ADMIN_EMAIL=admin@bankislam.com.my
BANK_ISLAM_ADMIN_PASSWORD=DemoPassword2026!

# ─────────────────────────────────────
# ALERT SIMULATION
# Use webhook.site for demo — shows MACC alert payload
# ─────────────────────────────────────
MACC_ALERT_WEBHOOK_URL=https://webhook.site/YOUR_UNIQUE_URL
# Get your free URL at https://webhook.site
# When AI freezes a campaign, this URL receives the alert payload
# Show this to judges as "MACC receiving the alert"

# ─────────────────────────────────────
# CORS
# Your frontend URL
# ─────────────────────────────────────
FRONTEND_URL=http://localhost:5173
# Change to IPserverone IP when deployed:
# FRONTEND_URL=http://YOUR_VPS_IP:5173
```

---

## 🚀 Setup Instructions

### Prerequisites

```bash
Node.js v20 LTS
npm v10+
Git
MetaMask browser extension (Chrome/Firefox)
PostgreSQL (on VPS)
Redis (on VPS or IPserverone service)
```

### 1. Clone the repository

```bash
git clone https://github.com/yourteam/donorledger.git
cd donorledger
```

### 2. Deploy smart contracts to Sepolia

```bash
cd contracts
npm install

# Create contracts .env
cp .env.example .env
# Fill in: SEPOLIA_RPC_URL and BANK_ISLAM_PRIVATE_KEY

# Compile contracts
npx hardhat compile

# Run contract tests (always before deploy)
npx hardhat test

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
# COPY the three contract addresses printed in terminal

# Seed test data (registers test NGO + creates test campaign)
npx hardhat run scripts/seed.js --network sepolia
```

### 3. Set up backend

```bash
cd ../backend
npm install

# Set up environment
cp .env.example .env
# Fill in ALL values following the setup guide above

# Run database migrations
npx prisma migrate dev --name init
npx prisma generate

# Create upload directories
mkdir -p uploads/invoices uploads/agreements uploads/delivery-proof

# Start development server
npm run dev
# Backend running at http://localhost:3001
```

### 4. Verify setup is working

```bash
# Should return { status: "ok", blockchain: "connected" }
curl http://localhost:3001/api/health

# Should return list of campaigns (empty at first)
curl http://localhost:3001/api/campaign
```

---

## 🔌 API Endpoints

### Public — No Auth Required
```
GET  /api/health                          Server + blockchain health check
GET  /api/campaign                        All verified active campaigns
GET  /api/campaign/:id                    Single campaign details + progress
GET  /api/tracker/:donorHash              Donor fund journey (from blockchain)
```

### Donor Endpoints — No Auth Required
```
POST /api/donate
     body: { campaignId, amount, donorEmail }
     returns: { txHash, donorHash, trackerUrl }
```

### NGO Endpoints — NGO JWT Required
```
POST /api/ngo/register
     body: { legalName, regNumber, regType, directorIds[],
             bankAccount, cause, allocationPlan }

POST /api/evidence/submit
     body: { campaignId, category, amount, vendorId }
     files: { serviceAgreement, invoice, deliveryProof }
     returns: { evidenceId, documentHash, aiScore, status }

GET  /api/ngo/campaigns                   NGO's own campaigns + status
GET  /api/ngo/evidence/:campaignId        All submitted evidence for campaign
```

### Bank Islam Admin — Admin JWT Required
```
POST /api/auth/login                      Get admin JWT token
     body: { email, password }

GET  /api/admin/dashboard                 Live overview — all campaigns,
                                          alerts, frozen funds

GET  /api/admin/ngo/pending               NGOs awaiting KYC approval
POST /api/admin/ngo/verify                Approve NGO + issue on-chain credential
     body: { ngoAddress, riskTier }
POST /api/admin/ngo/revoke                Revoke NGO credential
     body: { ngoAddress, reason }

GET  /api/admin/alerts                    All AI-flagged anomalies with scores
POST /api/disbursement/approve            Approve evidence + release funds
     body: { evidenceId }
POST /api/disbursement/reject             Reject evidence
     body: { evidenceId, reason }

POST /api/campaign/pause                  Manually pause campaign
     body: { campaignId, reason }
POST /api/campaign/unpause                Unpause campaign
     body: { campaignId }
```

---

## 🗄️ Database Schema (Prisma)

```prisma
model NGO {
  id             String   @id @default(cuid())
  walletAddress  String   @unique
  legalName      String
  regNumber      String   @unique
  status         String   @default("pending")
  riskTier       String?
  verifiedAt     DateTime?
  createdAt      DateTime @default(now())
  campaigns      Campaign[]
}

model Campaign {
  id              String   @id @default(cuid())
  contractAddress String   @unique
  ngoId           String
  ngo             NGO      @relation(fields: [ngoId], references: [id])
  name            String
  causeType       String
  aidPercent      Int
  logisticsPercent Int
  adminPercent    Int
  targetAmount    Float
  status          String   @default("active")
  createdAt       DateTime @default(now())
  donations       Donation[]
  evidences       Evidence[]
}

model Donation {
  id          String   @id @default(cuid())
  donorHash   String   @unique
  donorEmail  String
  amount      Float
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id])
  txHash      String   @unique
  createdAt   DateTime @default(now())
}

model Evidence {
  id              String   @id @default(cuid())
  campaignId      String
  campaign        Campaign @relation(fields: [campaignId], references: [id])
  category        String
  amount          Float
  vendorId        String
  documentHash    String
  aiScore         Float?
  aiReason        String?
  status          String   @default("pending")
  submittedAt     DateTime @default(now())
  reviewedAt      DateTime?
}

model Alert {
  id          String   @id @default(cuid())
  campaignId  String
  evidenceId  String?
  aiScore     Float
  reason      String
  patterns    String[]
  status      String   @default("open")
  createdAt   DateTime @default(now())
}
```

---

## 🧪 Running Tests

```bash
# Smart contract tests
cd contracts
npx hardhat test

# Backend unit tests
cd backend
npm test

# Test only AI service
npm test -- --testPathPattern=ai.service

# Test only contract service
npm test -- --testPathPattern=contract.service
```

---

## 🌐 Deployment to IPserverone NovaCloud

### Launch VPS Instance

```
1. Log in to IPserverone dashboard
2. NovaCloud → Cloud Instances → Launch Instance
3. Select: Ubuntu 22.04 LTS
4. Select smallest available tier (sufficient for demo)
5. Add your SSH public key under Public Keys first
6. Launch → wait for instance to show "Active" status
7. Copy the Primary IP address
```

### SSH into your VPS and install dependencies

```bash
ssh ubuntu@YOUR_VPS_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install Redis (if not using IPserverone Redis service)
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install PM2 — keeps Node.js running after you close terminal
sudo npm install -g pm2

# Verify installations
node --version    # should show v20.x.x
npm --version
psql --version
redis-cli ping    # should return PONG
```

### Deploy backend to VPS

```bash
# On your VPS
git clone https://github.com/yourteam/donorledger.git
cd donorledger/backend

npm install
cp .env.example .env
nano .env    # Fill in all production values

npx prisma migrate deploy
npx prisma generate

mkdir -p uploads/invoices uploads/agreements uploads/delivery-proof

# Start with PM2 (keeps running after terminal closes)
pm2 start src/server.js --name donorledger-backend
pm2 save
pm2 startup    # Follow the command it prints to auto-start on reboot

# Check it is running
pm2 status
pm2 logs donorledger-backend
```

### Verify deployment

```bash
# From your local machine
curl http://YOUR_VPS_IP:3001/api/health
# Should return { status: "ok", blockchain: "connected" }
```

---

## ⚠️ Known Limitations

| # | Limitation | Severity | Mitigation for Hackathon |
|---|---|---|---|
| 1 | KYC verifies identity, not future behaviour | Medium | AI monitoring is second gate after KYC |
| 2 | Oracle problem — NGO can submit fake delivery proof | High | Bank Islam admin spot-check + recipient SMS confirmation simulation |
| 3 | NGOs can bypass platform entirely | High | Bank Islam payment rail incentive — unverified = no DuitNow badge |
| 4 | Shell vendor fraud via connected company | Medium | Vendor KYC required + AI benchmarks invoice price against market rates |
| 5 | AI false positives may freeze legitimate disaster aid | Medium | Confidence threshold tunable — auto-freeze only above 85% |
| 6 | Smart contract bugs are permanent once deployed | High | OpenZeppelin audited base + proxy upgrade pattern in production |
| 7 | Donor privacy — on-chain data analysis risk | Low | Hashed + salted donor IDs — real identity only in PostgreSQL |
| 8 | Bank Islam as single point of trust | Medium | Deliberate v1 tradeoff — multi-institution co-signing in v2 |

---

## 🔮 Production Roadmap

```
v1 — Hackathon Demo (current)
     Sepolia testnet · Simulated DuitNow · Mock KYC
     Gemini AI anomaly detection · IPserverone VPS

v2 — Pilot Program
     Private permissioned blockchain (Hyperledger Fabric)
     Real DuitNow integration via Bank Islam API
     Live Bank Islam KYC pipeline
     Recipient SMS confirmation via Twilio
     Mobile app for donors

v3 — National Production
     Multi-institution credential co-signing (BNM + ROS + Bank Islam)
     MACC live API integration
     National NGO registry API integration
     Zero-knowledge proofs for donor privacy
     Regional expansion — Indonesia, Bangladesh
```

---

## 📄 License

MIT — Built for Hackathon X Fintech Forward 2026

---

*Every ringgit should reach someone who needs it.*
