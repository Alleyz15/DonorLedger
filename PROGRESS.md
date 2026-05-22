# DonorLedger — Build Progress & Handoff

> If you (kflee15) hit a usage limit and need a fresh AI session to continue,
> paste this file at the start of the new chat. It captures everything that
> has been built, every architectural decision that was made, and exactly
> what is left to do next.

---

## How to resume in a new AI session

Open a new Claude/Cowork session and start with this exact prompt:

```
Read D:\Hackerthon Project\DonorLedger\CLAUDE.md fully.
Then read D:\Hackerthon Project\DonorLedger\PROGRESS.md.
PROGRESS.md tells you what is already done and what is left.
Continue from the "Next steps" section. Do not regenerate files
that already exist — extend them. Follow every convention in CLAUDE.md
(ES modules, async/await, thin routes / fat services, Bank Islam framing).
```

---

## Project context (one paragraph)

DonorLedger is a Bank Islam x UMPSA Hackathon X Fintech Forward 2026
backend (Track 1, Reimagine Money). It is a blockchain-backed donation
transparency platform: donors pay via DuitNow, ringgit is held in Bank
Islam escrow, smart contracts on Ethereum Sepolia enforce allocation
rules, Gemini AI watches disbursements for fraud and auto-freezes the
campaign + alerts MACC when the confidence score crosses 85. Full spec
is in `CLAUDE.md` (37 KB). Do not improvise on framing — follow Section 7
"Bank Islam Framing — Critical" exactly.

Owner / team role: **Backend engineer.** Frontend folder is off-limits.

---

## What is COMPLETED (do not regenerate)

All paths are relative to `D:\Hackerthon Project\DonorLedger\`.

### Root
- `package.json` — ES module, Node 20+, deps: express, ethers v6,
  @google/generative-ai, prisma, @prisma/client, bull, ioredis,
  multer, helmet, cors, morgan, express-rate-limit, jsonwebtoken,
  dotenv. Dev deps: hardhat, @nomicfoundation/hardhat-toolbox,
  @openzeppelin/contracts v5, nodemon, prisma.
- `.env.example` — every env var the backend reads (see config/env.js)
- `.gitignore` — node_modules, .env, contracts/artifacts, uploads, etc.
- `CLAUDE.md` — original full spec (unchanged)
- `CODEX.md`, `README.md` — pre-existing, untouched

### Prisma
- `prisma/schema.prisma` — full data model:
  - Enums: NGOStatus, RiskTier, CampaignStatus, VendorStatus,
    VendorServiceType, EvidenceStatus, AlertSeverity, AlertChannel,
    AdminRole
  - Models: NGO, Campaign, Vendor, Donation, Evidence, Alert, AdminUser
  - Donor PII (email, name) lives here only (PDPA — never on-chain)

### Backend — `backend/src/`

#### `config/`  (single-source-of-truth layer)
- `env.js` — the **only** file that reads `process.env`. Throws on
  missing required vars. Exposes `env.blockchain`, `env.gemini`,
  `env.redis`, `env.macc`, `env.demo`, etc.
- `database.js` — `PrismaClient` singleton + SIGINT/SIGTERM shutdown.
- `gemini.js` — `GoogleGenerativeAI` client with
  `responseMimeType: 'application/json'`, model from env.
- `blockchain.js` — ethers v6 provider + the **two server-side wallets**
  (Section 9 security separation): `serverWallet` (lower privilege,
  bridge + AI freeze) and `bankIslamWallet` (higher privilege, KYC +
  approvals + unpause).
- `queue.js` — Bull queues `aiAnalysisQueue`, `alertQueue` on Redis.

#### `utils/`
- `hash.utils.js` — `createDonorHash(email, campaignId, ts)` returns
  `0x` + SHA256 of `email|campaignId|ts|salt`. Also `hashFile`,
  `hashBuffer`, `hashEvidencePackage` (deterministic 5-doc bundle hash).
- `format.utils.js` — `formatRinggit`, `formatPercent`, `formatDateTime`,
  `DONOR_MILESTONE_TEXT` (the donor-facing plain-language map —
  RECEIVED/ALLOCATED/RELEASED/CONFIRMED/UNDER_REVIEW/FROZEN/COMPLETED).

#### `middleware/`
- `error.middleware.js` — global handler. Services throw
  `Error` with `.status` and this turns it into clean JSON. Never leaks
  stack traces or env in prod.
- `validate.middleware.js` — lightweight schema-driven validator. Types:
  string, number, integer, boolean, email, address (0x...). Used inline
  in every route.
- `auth.middleware.js` — JWT (HS256, secret from env). Exports
  `requireAdmin`, `requireRole(...roles)`, `signAdminToken`.
  Token payload: `{ sub, email, role }`.

#### `services/`  (all business logic — Section 16 "thin routes, fat services")
- `contract.service.js` — **single point of entry for every ethers call**.
  Loads ABIs from `contracts/artifacts/` if present, else uses fallback
  ABIs hand-written from Section 8. Exposes:
  - Registry: `registerNGO`, `renewNGO`, `revokeNGO`, `isNGOVerified`
  - Bridge writes (server wallet): `recordDonation`, `submitEvidence`
  - Bank Islam writes: `approveDisbursement`, `rejectDisbursement`,
    `unpauseCampaign`, `addApprovedVendor`
  - AI auto-freeze (server wallet): `pauseCampaign`
  - Tracker: `updateDonorMilestone`, `getDonorJourney`,
    `getCampaignProgress`
  - Reads: `readCampaignTotals`
  - Amount convention: ringgit ↔ sen (×100 integer) so no floats on-chain.
- `ai.service.js` — Gemini fraud detection (Section 14).
  - System prompt seeded with MACC pattern list (RM230M case, Gaza,
    influencer cases).
  - `safeParse` strips ```json fences then JSON.parse with fallback
    `{ confidenceScore: 50, recommendation: 'review' }`.
  - Clamps score to 0-100, sanitises flaggedPatterns array.
  - `routeOnScore(score)` → `'ALLOW' | 'MANUAL_REVIEW' | 'AUTO_FREEZE'`
    using `env.gemini.reviewThreshold` (60) and `freezeThreshold` (85).
- `alert.service.js` — two channels:
  - `notifyBankIslam(...)` → persists row, marks delivered immediately
  - `notifyMACC(...)` → persists, then HMAC-SHA256 signs body with
    `MACC_WEBHOOK_SECRET` and POSTs to `MACC_WEBHOOK_URL`. Persists
    delivery success/failure.
- `storage.service.js` — multer with diskStorage. Categories:
  invoices, agreements, delivery-proof, vendor-registration,
  recipient-confirm, ssm. Allowed extensions: pdf, png, jpg, jpeg,
  docx, xlsx. Max bytes from env.
- `bridge.service.js` — `processDuitNowPayment({campaignId, donorEmail,
  amount, vendorId, duitNowRef})` runs Section 10 Steps 4-10:
  validate campaign + vendor, create donor hash, call
  `Campaign.donate()`, call `DonorTracker.updateMilestone(RECEIVED)`,
  persist Donation row, bump campaign aggregates, return
  `{donationId, txHash, trackerUrl, donorHash}`.
- `kyc.service.js` — Section 11 five-stage flow:
  `submitNGOApplication` (with simulated SSM/ROS/JPN/MACC checks),
  `approveNGO` (calls Registry.addNGO, 12-month expiry),
  `renewNGOCredential`, `revokeNGOCredential`.
- `vendor.service.js` — Section 12 shell-vendor guard:
  `submitVendor`, `approveVendor` (calls
  `Campaign.addApprovedVendor`), `rejectVendor`.

#### `routes/`  (thin — only validate + call service + return)
- `donate.routes.js` — `POST /api/donate`
- `campaign.routes.js` — `GET /api/campaign`, `GET /api/campaign/:id`
  (cross-checks chain via `readCampaignTotals`), `GET /api/campaign/:id/vendors`
- `evidence.routes.js` — `POST /api/evidence/submit` (multipart 5-doc),
  `GET /api/evidence/:id`. Queues `analyse-disbursement` job to Bull.
- `disbursement.routes.js` — `POST /api/disbursement/approve|reject|unpause`,
  all JWT-protected with role guards. On approve, batch-updates donor
  trackers to `RELEASED`.
- `tracker.routes.js` — `GET /api/tracker/:donorHash` — public donor
  view. Plain language only, never exposes AI score / patterns.
- `ngo.routes.js` — `POST /api/ngo/register`, `GET /api/ngo/:id`.
- `vendor.routes.js` — `POST /api/vendor/submit` (multipart).
- `admin.routes.js` — `POST /api/admin/login` (sha256 with salt, demo
  scope; argon2id is the production upgrade), plus NGO + vendor approval
  endpoints, alerts feed, pending evidence list, pending NGO list.
- `demo.routes.js` — gated by `env.demo.enabled`:
  - `POST /api/demo/simulate-duitnow` — proxies into bridge service
  - `POST /api/demo/recipient-confirm` — auto-YES after configurable delay
  - `POST /api/demo/simulate-fraud` — **the wow moment**: submits a
    fraudulent admin-cost disbursement, forces AI score to ≥92,
    calls `pauseCampaign`, fires MACC webhook, updates every donor's
    tracker to `UNDER_REVIEW` in plain language.

#### `listeners/`
- `contract.listener.js` — reconciles Postgres against the chain on
  reboot and live. Subscribes to Registry `NGOVerified`/`NGORevoked`
  and every Campaign's `CampaignPaused`/`CampaignUnpaused`/
  `DisbursementApproved`/`DisbursementRejected`. Boots via
  `startContractListeners()` from `server.js`.

#### `server.js`
- helmet + cors + json + morgan + rate-limit (120/min)
- `/health` endpoint exposing both wallet addresses and demo mode
- Mounts all 9 route files under `/api/...`
- `notFoundHandler` + `errorHandler` registered last
- **AI worker**: processes `analyse-disbursement` jobs (concurrency 2):
  load evidence + history → call Gemini → persist score → route on
  threshold → on AUTO_FREEZE: pauseCampaign + notifyMACC + flip every
  donor's tracker to UNDER_REVIEW; on MANUAL_REVIEW: status
  PENDING_REVIEW + notifyBankIslam WARNING; on ALLOW: PENDING_REVIEW +
  INFO alert.
- `boot()` starts worker → starts listeners → `app.listen`.

---

## Update — round 3 (tests + docker + smoke + PM2 + quickstart)

### Newly COMPLETED
- `docker-compose.yml` — Postgres 16 + Redis 7, healthchecks, localhost-only
  binds. Run `docker compose up -d` and the backend connects with the
  defaults already in `.env.example`.
- `contracts/test/Registry.test.js` — 8 tests: ownership, expiry-based
  isVerified, duplicate-block, revoke flow, renew flow.
- `contracts/test/Campaign.test.js` — 13 tests: allocation-must-sum-to-100,
  end-date validation, donation gating, vendor allowlist, dual-trigger
  pause (owner OR aiFreezeWallet — Section 9), AI-cannot-unpause invariant.
- `contracts/test/DonorTracker.test.js` — 4 tests: owner-only writes,
  milestone order, percent-bound check.
- `scripts/smoke-test.js` — 11-step end-to-end smoke test that exercises
  the exact demo flow from Section 21 (health → admin login → NGO submit
  + approve → campaign deploy → vendor submit + approve → simulate-duitnow
  → tracker read → simulate-fraud → alerts feed). Pretty colour output.
  Wired up as `npm run smoke`.
- `ecosystem.config.cjs` — PM2 config for the IPserverone VPS deploy
  (autorestart, max_memory_restart 512M, log files under ./logs/).
- `QUICKSTART.md` — one-page setup guide covering every step from the
  initial manual-items table through to VPS deployment, plus a
  troubleshooting section.
- `package.json` — added `contracts:test` and `smoke` scripts.

### Verifications performed in the sandbox
- All 13 backend dependencies + 5 dev-dependencies resolve cleanly
  against the public npm registry at the exact versions pinned in
  `package.json`.
- All 35 backend .js files pass `node --check` (0 parse errors).
- Solidity compiles 0 errors / 0 warnings (round 2 result still holds —
  no new contract changes this round).

---

## Update — round 2 (smart contracts + Hardhat + admin seed)

### Newly COMPLETED
- `contracts/contracts/Registry.sol` — Ownable, addNGO/renewNGO/revokeNGO,
  isVerified() returns false on expiry OR revocation, full event surface.
- `contracts/contracts/Campaign.sol` — Ownable + Pausable + ReentrancyGuard,
  immutable allocation percentages (sum to 100 required at deploy),
  approvedVendors mapping, evidence array with status enum,
  `pauseCampaign` callable by owner OR `aiFreezeWallet` (server wallet),
  `unpauseCampaign` owner-only. Amounts in sen (RM × 100).
- `contracts/contracts/DonorTracker.sol` — Ownable (server wallet),
  milestone array per donor hash, optional per-campaign progress aggregate.
- `contracts/hardhat.config.js` — solc 0.8.20, optimizer on, Sepolia network
  using `SERVER_WALLET_PRIVATE_KEY` and `BANK_ISLAM_PRIVATE_KEY` accounts.
- `contracts/package.json` — hardhat + toolbox + OZ v5, scripts:
  `compile`, `deploy:sepolia`, `seed:sepolia`, `verify`.
- `contracts/scripts/deploy.js` — deploys Registry (owner = Bank Islam)
  and DonorTracker (owner = server wallet), prints addresses to paste
  into `.env`.
- `contracts/scripts/seed.js` — registers a demo NGO, deploys a demo
  `Banjir Kelantan Relief 2026` campaign, approves a demo vendor.
- `prisma/seed.js` — creates the first SUPER_ADMIN user.
  Configurable via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` /
  `SEED_ADMIN_NAME`. Run with `npm run prisma:seed`.
- `contract.service.js` — added `deployCampaign(...)` which loads the
  Campaign artifact, deploys signed by Bank Islam, returns
  `{contractAddress, deployTxHash}`.
- `admin.routes.js` — added `POST /api/admin/campaign/create` (SUPER_ADMIN
  only). Deploys Campaign.sol → persists row → attaches the live
  contract listener so subsequent on-chain pause/approve events
  reconcile to Postgres.
- `.env.example` — added `SEED_ADMIN_*` and `ETHERSCAN_API_KEY`.
- `package.json` — added `prisma:seed` script.

### Compile verification
The three Solidity files were compiled in the sandbox against
OpenZeppelin v5 with solc 0.8.20:

```
Errors  : 0
Warnings: 0
Compiled: Campaign.sol → Campaign
Compiled: Campaign.sol → IRegistry
Compiled: DonorTracker.sol → DonorTracker
Compiled: Registry.sol → Registry
```

## NOT YET BUILT — Next steps in priority order

### 1. Local infrastructure (5 minutes)
```bash
cd "D:\Hackerthon Project\DonorLedger"
copy .env.example .env       # then fill in real values
npm install
cd contracts
npm install
npm run compile              # produces contracts/artifacts/ — contract.service.js prefers these over fallback ABIs
cd ..
```

### 2. Fund the two wallets on Sepolia
- Faucet: https://sepoliafaucet.com or Alchemy/Infura faucets
- Need at least 0.05 ETH each for `SERVER_WALLET_PRIVATE_KEY` and
  `BANK_ISLAM_PRIVATE_KEY` (deploy gas + per-campaign deploy gas).

### 3. Deploy infrastructure contracts (Registry + DonorTracker)
```bash
cd contracts
npm run deploy:sepolia
```
Copy the two addresses it prints into `.env`:
```
REGISTRY_CONTRACT_ADDRESS=0x...
DONOR_TRACKER_CONTRACT_ADDRESS=0x...
```

### 4. Postgres + Redis
- Install Postgres 16 + Redis 7 locally (or via Docker).
- Create the DB: `createdb donorledger` (or via psql).
- `DATABASE_URL` in `.env` points at it.
```bash
npm run prisma:migrate -- --name init
npm run prisma:seed
```

### 5. (Optional) seed a demo campaign on-chain
```bash
cd contracts
npm run seed:sepolia
```
This deploys one demo Campaign.sol; persist it via
`POST /api/admin/campaign/create` (or insert a row manually) so the
listener subscribes.

### 6. Boot the backend
```bash
npm run dev
# health: http://localhost:3001/health
```

### 7. Demo rehearsal flow (Section 21 priority #1)
1. `GET  /api/campaign` — show the active campaign.
2. `POST /api/demo/simulate-duitnow` — show on-chain tx hash returned.
3. `GET  /api/tracker/<donorHash>` — show donor plain-language view.
4. `POST /api/admin/login` → `POST /api/evidence/submit` (legit) →
   show AI score < 60 in dashboard.
5. `POST /api/demo/simulate-fraud` — the wow moment. Show:
   - score ≥ 92, reason text from Gemini
   - campaign status flipped to FROZEN on-chain (verify on Etherscan)
   - MACC webhook hit (verify on webhook.site)
   - donor tracker now says "Under Review — funds paused while we
     investigate" with no scores/patterns leaked.

### 8. VPS deployment (IPserverone NovaCloud, Cyberjaya)
- Ubuntu 22.04 LTS instance
- Node 20, Postgres 16, Redis 7
- `pm2 start backend/src/server.js --name donorledger`
- Open port 3001 in security group
- Frontend points at `http://VPS_IP:3001`

---

## Important conventions to keep following

1. **Bank Islam framing (Section 7)**. Never write "blockchain prevents
   Bank Islam from modifying records." Write "blockchain gives Bank
   Islam a permanent cryptographic alibi." This applies to code
   comments, not just the pitch.
2. **ES modules only.** `import` everywhere, never `require`.
3. **Async/await only.** No `.then()` chains.
4. **All `process.env` reads go through `config/env.js`.** No exceptions.
5. **All `ethers.Contract` instances go through `contract.service.js`.**
   No exceptions.
6. **Donor never sees**: AI score, flagged patterns, raw amounts of
   other donors, blockchain terminology, wallet addresses, tx hashes.
7. **Errors**: `const err = new Error('msg'); err.status = 400; throw err`
   pattern — the global handler turns it into a clean JSON response.
8. **Never log**: private keys, donor emails (in prod), donor names,
   the donor hash salt, JWT secret.

---

## File count summary

- Root: 7 files (package.json, .env.example, .gitignore, PROGRESS.md,
  docker-compose.yml, ecosystem.config.cjs, QUICKSTART.md)
- Prisma: 2 files (schema.prisma + seed.js)
- Backend src: 28 files (config 5 + utils 2 + middleware 3 + services 7
  + routes 9 + listeners 1 + server.js 1)
- Contracts: 10 files (3 .sol + 3 .test.js + hardhat.config.js +
  package.json + scripts/deploy.js + scripts/seed.js)
- Scripts: 1 file (smoke-test.js)

**Total project files: 48**.

---

## Last completed step

Sandbox verification: all dependencies resolve, all .js files parse,
Solidity compiles clean. The next move is on **your** machine —
QUICKSTART.md walks through it in eight numbered steps.
