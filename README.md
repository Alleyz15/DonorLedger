# DonorLedger

Blockchain-backed donation transparency for Malaysia.

DonorLedger lets donors donate in MYR while Bank Islam, NGOs, and donors can verify the donation journey through an immutable audit layer on Monad testnet. The blockchain does not replace Ringgit. It records campaign approval, donations, vendor allowlists, evidence submission, disbursement decisions, and donor milestones.

Built for Hackathon X Fintech Forward 2026, Be U by Bank Islam x UMPSA.

## Current Demo Flow

### Donor

- Logs in with a pre-seeded demo donor account.
- Views active campaigns.
- Opens campaign details.
- Donates a MYR amount through a simulated DuitNow flow.
- Backend records the donation in PostgreSQL and writes an audit record to the campaign smart contract.
- Donor identity is protected with a salted donor hash.
- Donor can view donation history and receipt.
- Receipt shows the campaign, amount, date, and public audit journey.

### NGO Organizer

- Registers through the NGO application form.
- Logs in after the account exists.
- Creates a campaign — can save as draft and return later to complete it.
- Edits draft campaigns before submitting for Bank Islam review.
- Submits campaign for Bank Islam review when ready.
- Views campaign detail page showing funding progress, allocation breakdown, and vendor list.
- Adds or selects approved vendors through the Register Vendor page.
- Tracks campaign status in My Campaigns dashboard.
- Submits evidence before money can be released.
- Evidence upload requires five documents:
  - SSM / ROS document
  - Service agreement
  - Invoice
  - Delivery proof
  - Recipient confirmation

### Bank Islam Admin

- Logs in with the seeded admin account.
- Reviews NGO applications.
- Approves or rejects campaign applications from the campaign detail page, which shows full NGO info, fund allocation, contract address, and linked vendors.
- Reviews vendor KYC.
- Approves or rejects vendors.
- Reviews evidence with Gate 3 (AI Screening) and Gate 4 (Beneficiary Confirmation) labels.
- AI fraud score shown as a colour-coded progress bar — green below 60, amber 60–85, red above 85.
- Approves or rejects disbursement.
- Confirms beneficiary receipt independently of the NGO, which updates donor tracker to COMPLETED.
- Can view alerts with severity colour coding, audit logs, campaigns, NGOs, vendors, and evidence reviews.

## Demo Accounts

### Donor

Use any seeded donor:

```text
Email: donor01@example.com
Password: Password123!
```

More demo donors exist from `donor01@example.com` to `donor10@example.com`.

### Bank Islam Admin

```text
Email: admin@bankislam.demo
Password: Password123!
```

### NGO

NGO accounts are created through the NGO registration / organizer signup flow. The NGO login uses email and password.

## Tech Stack

### Frontend

- Static HTML, CSS, and JavaScript
- Modular page scripts under `frontend/pages`
- Shared services under `frontend/services`
- API base configured in `frontend/config/api-config.js`

### Backend

- Node.js
- Express
- Prisma
- PostgreSQL
- Redis + Bull queue
- Multer file upload
- JWT authentication
- Google Gemini AI fraud detection
- ethers.js blockchain bridge

### Smart Contracts

- Solidity
- Hardhat
- OpenZeppelin
- Monad testnet

Contracts:

- `Registry.sol`: Bank Islam verified NGO registry.
- `Campaign.sol`: Per-campaign donation, vendor allowlist, evidence, pause, and disbursement logic.
- `DonorTracker.sol`: Donor-facing milestone and campaign progress audit trail.

## Blockchain Design

Production MYR flow:

```text
Donor -> DuitNow / Bank Islam -> Bank escrow -> verified vendor / NGO-linked payout flow
```

Blockchain audit flow:

```text
Backend -> Monad smart contracts -> public audit trail
```

Important distinction:

- MYR is still real money handled by Bank Islam / DuitNow.
- MON is only used as testnet gas for the hackathon demo.
- Blockchain is used for transparency, not as the donation currency.

## Smart Contract Responsibilities

### Registry.sol

Stores verified NGO credentials.

Bank Islam can:

- Add approved NGO
- Renew NGO credential
- Revoke NGO credential

Campaign contracts call this registry to check whether an NGO is still valid.

### Campaign.sol

Each approved campaign gets its own campaign contract.

It records:

- Donation totals
- Donor hashes
- Approved vendors
- Evidence submissions
- Disbursement approval or rejection
- Campaign pause / unpause state

It enforces:

- NGO must be verified
- Vendor must be approved for that campaign
- Evidence amount cannot exceed raised minus released funds
- Bank Islam approval is required for disbursement

### DonorTracker.sol

Stores donor journey milestones using donor hashes, not donor emails.

Example milestones:

- `RECEIVED`
- `ALLOCATED`
- `UNDER_REVIEW`
- `RELEASED`
- `CONFIRMED`
- `COMPLETED`

## Evidence And Fraud Detection

Evidence submission works like this:

```text
NGO submits five documents
Backend hashes the evidence package
Backend writes the evidence hash to Campaign.sol
Gemini AI reviews the disbursement
Bank Islam sees the fraud risk score
Bank Islam approves or rejects the evidence
Smart contract records the final decision
```

Fraud score routing:

```text
Below 60: low risk, still visible to Bank Islam
60 to 85: manual Bank Islam review
Above 85: auto-freeze campaign and send MACC webhook alert
```

## Local Setup

### 1. Start infrastructure

```powershell
docker compose up -d
```

This starts:

- PostgreSQL
- Redis

### 2. Install dependencies

```powershell
npm install
cd contracts
npm install
cd ..
```

### 3. Configure environment

Copy the example env file:

```powershell
copy .env.example .env
```

Fill in:

- `DATABASE_URL`
- `BLOCKCHAIN_RPC_URL`
- `CHAIN_ID`
- `BLOCKCHAIN_NETWORK_NAME`
- `BANK_ISLAM_PRIVATE_KEY`
- `SERVER_WALLET_PRIVATE_KEY`
- `REGISTRY_CONTRACT_ADDRESS`
- `DONOR_TRACKER_CONTRACT_ADDRESS`
- `DONOR_HASH_SALT`
- `GEMINI_API_KEY`
- `JWT_SECRET`
- `MACC_WEBHOOK_URL`

Do not commit `.env`.

### 4. Compile and test contracts

```powershell
npm run contracts:compile
npm run contracts:test
```

### 5. Deploy infrastructure contracts to Monad

```powershell
npm run contracts:deploy
```

Copy the printed addresses into `.env`:

```text
REGISTRY_CONTRACT_ADDRESS=0x...
DONOR_TRACKER_CONTRACT_ADDRESS=0x...
```

Campaign contracts are deployed later when Bank Islam approves a campaign.

### 6. Migrate and seed database

```powershell
npm run prisma:migrate -- --name init
npm run prisma:seed
```

### 7. Run backend

```powershell
npm run dev
```

Backend health check:

```powershell
curl http://localhost:3001/health
```

### 8. Run frontend

From the `frontend` folder:

```powershell
python -m http.server 5173
```

Open:

```text
http://127.0.0.1:5173/introduction.html
```

## Useful Local URLs

```text
Frontend: http://127.0.0.1:5173
Backend:  http://127.0.0.1:3001
Health:   http://127.0.0.1:3001/health
```

## Key Pages

### Public / Auth

```text
frontend/introduction.html
frontend/login.html
frontend/register-ngo.html
```

### Donor

```text
frontend/donor-campaigns.html
frontend/campaign-details.html
frontend/confirm-payment.html
frontend/payment-success.html
frontend/donor-history.html
```

### NGO

```text
frontend/my-campaigns.html
frontend/ngo-campaign-detail.html
frontend/start-campaign.html
frontend/submit-vendor.html
frontend/submit-evidence.html
```

### Bank Admin

```text
frontend/admin-dashboard.html
frontend/admin-ngos.html
frontend/admin-vendors.html
frontend/admin-campaigns.html
frontend/admin-campaign-detail.html
frontend/admin-evidence.html
frontend/admin-alerts.html
frontend/admin-audit.html
```

## Main API Endpoints

### Auth

```text
POST /api/auth/login
POST /api/auth/signup
```

### Donor

```text
GET  /api/campaign
GET  /api/campaign/:id
GET  /api/campaign/:id/vendors
POST /api/donate
GET  /api/donate/history
GET  /api/tracker/:donorHash
```

### NGO

```text
POST  /api/ngo/register
POST  /api/ngo/campaign/create
POST  /api/ngo/campaign/save-draft
PATCH /api/ngo/campaign/:id
GET   /api/ngo/campaigns
GET   /api/ngo/campaigns/:id
GET   /api/ngo/vendors
POST  /api/vendor/submit
POST  /api/evidence/submit
```

### Bank Admin

```text
GET  /api/admin/ngos
POST /api/admin/ngo/:id/approve
POST /api/admin/ngo/:id/reject
GET  /api/admin/vendors
POST /api/admin/vendor/:id/approve
POST /api/admin/vendor/:id/reject
GET  /api/admin/campaigns
POST /api/admin/campaign/:id/approve
POST /api/admin/campaign/:id/reject
GET  /api/admin/evidence/pending
GET  /api/admin/alerts
POST /api/disbursement/approve
POST /api/disbursement/reject
POST /api/disbursement/unpause
```

### Demo

```text
POST /api/demo/simulate-duitnow
POST /api/demo/simulate-fraud
POST /api/demo/recipient-confirm
```

## Demo Scripts For Presentation

### Normal Donation

```text
Donor views active campaigns, opens a campaign detail page, checks the NGO, cause, target amount, and Bank Islam verification status.

Then the donor donates RM10.

In real life, the money moves through DuitNow or Bank Islam. In our demo, we simulate the payment.

After payment, our backend records the donation and writes an audit record to the smart contract on Monad testnet.

The donor identity is protected using a donor hash, so personal details are not public on-chain.

The donor can then view the receipt and donation history.

So blockchain is used for transparency and verification, not to replace MYR.
```

### Evidence And Fraud Detection

```text
After receiving donations, the NGO cannot directly take the money.

The NGO must submit evidence first, such as invoice, delivery proof, service agreement, and recipient confirmation.

Then Bank Islam reviews the evidence with AI fraud detection.

The AI gives a fraud risk percentage. If the score is low, it can proceed to bank review. If it is medium, Bank Islam manually reviews it. If it is high, the campaign can be frozen automatically.

Only after Bank Islam approves the evidence, the fund release is recorded in the smart contract.

So this prevents NGOs from taking money without proof.
```

## Troubleshooting

### `Campaign: vendor not approved`

The vendor is approved in the database but may not be approved on-chain for that specific campaign.

Fix:

- Approve the vendor from Bank Admin.
- Make sure the campaign is active.
- Retry evidence submission.

The backend now also repairs older demo data by syncing the vendor allowlist before evidence submission when the DB relation is already valid.

### Evidence page says only NGO accounts can access

Hard refresh the browser:

```text
Ctrl + Shift + R
```

Then log in again as an NGO organizer.

### Backend not responding

Restart backend:

```powershell
npm run dev
```

Or check health:

```powershell
curl http://localhost:3001/health
```

### Gemini unavailable

If Gemini returns an outage or rate-limit error, the platform still keeps the evidence pending for Bank Islam manual review.

### Monad gas error

Fund both wallets with Monad testnet MON:

```text
SERVER_WALLET_PRIVATE_KEY wallet
BANK_ISLAM_PRIVATE_KEY wallet
```

Use the Monad faucet for testnet MON.

## Production Notes

Hackathon demo:

- Monad testnet
- Simulated DuitNow
- Simulated KYC
- Gemini AI fraud scoring
- Webhook.site for MACC alert simulation

Production direction:

- MYR remains on Bank Islam payment rails.
- Permissioned blockchain such as Hyperledger Fabric can remove public gas fees.
- Bank Islam writes the audit trail as a regulated institution.
- MACC / regulators can receive alerts through a real integration.
- Donors continue to use normal Malaysian payment methods.

## License

MIT
