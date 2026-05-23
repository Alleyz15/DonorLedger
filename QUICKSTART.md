# DonorLedger — Quickstart

Read `CLAUDE.md` first (full architecture spec). This is the **how to run
it locally** guide. Setup time: ~30 minutes once you have the manual
items below.

> **Network note:** CLAUDE.md was written assuming Sepolia testnet. The
> project actually deploys to **Monad testnet** by default (EVM-compatible,
> chainId 10143, MON as gas token). The contracts are 100% EVM — they
> compile and run unchanged on either network. Swap by editing
> `BLOCKCHAIN_RPC_URL`, `CHAIN_ID`, `BLOCKCHAIN_NETWORK_NAME` in `.env`.

---

## 0. Manual items you must collect yourself (~10 min)

These are the things only you can get — Claude cannot acquire them.

| Item | Where to get it | What it goes into |
|---|---|---|
| Monad testnet RPC URL | Use the default `https://testnet-rpc.monad.xyz`, OR copy from MetaMask → Networks → Monad Testnet → "RPC URL" | `BLOCKCHAIN_RPC_URL` |
| Two MetaMask wallets | MetaMask → Account menu → Create Account (×2). Click each → Account Details → Show Private Key | `SERVER_WALLET_PRIVATE_KEY`, `BANK_ISLAM_PRIVATE_KEY` |
| Monad testnet MON | https://faucet.monad.xyz (one-click claim; also Phantom / Quicknode have faucets) | n/a — fund both wallets |
| Gemini API key | https://aistudio.google.com/apikey (free tier OK) | `GEMINI_API_KEY` |
| Donor hash salt | Run in PowerShell: `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')` (gives 64 hex chars) | `DONOR_HASH_SALT` |
| JWT secret | Same as above, any 64-hex-char string | `JWT_SECRET` |
| MACC webhook URL | https://webhook.site → copy "Your unique URL" | `MACC_WEBHOOK_URL` |

Once you have all of the above, copy `.env.example` to `.env` and fill
them in.

```powershell
copy .env.example .env
notepad .env
```

### Example completed `.env` (Monad)

```
NODE_ENV=development
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173

DATABASE_URL=postgresql://donorledger:password@localhost:5432/donorledger?schema=public

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

BLOCKCHAIN_RPC_URL=https://testnet-rpc.monad.xyz
CHAIN_ID=10143
BLOCKCHAIN_NETWORK_NAME=monad
ENABLE_CONTRACT_LISTENERS=false

BANK_ISLAM_PRIVATE_KEY=0xabc...   # from MetaMask Account 2
SERVER_WALLET_PRIVATE_KEY=0xdef... # from MetaMask Account 1

REGISTRY_CONTRACT_ADDRESS=           # filled in after step 4
DONOR_TRACKER_CONTRACT_ADDRESS=      # filled in after step 4

DONOR_HASH_SALT=replace-with-64-hex-chars
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
AI_REVIEW_THRESHOLD=60
AI_FREEZE_THRESHOLD=85

JWT_SECRET=replace-with-64-hex-chars
JWT_EXPIRES_IN=12h

MACC_WEBHOOK_URL=https://webhook.site/your-unique-uuid
MACC_WEBHOOK_SECRET=any-string-bank-islam-and-macc-share

UPLOAD_DIR=./uploads
MAX_UPLOAD_BYTES=10485760

DEMO_MODE=true
RECIPIENT_CONFIRM_DELAY_MS=5000

SEED_ADMIN_EMAIL=admin@bankislam.demo
SEED_ADMIN_PASSWORD=Password123!
SEED_ADMIN_NAME=Bank Islam Super Admin
```

---

## 1. Local infrastructure (1 min)

```powershell
docker compose up -d
```

This starts Postgres on `127.0.0.1:5432` and Redis on `127.0.0.1:6379`,
matching the defaults in `.env.example`.

Verify:
```powershell
docker compose ps
```

Both should be `(healthy)`.

---

## 2. Install dependencies (3 min)

```powershell
npm install
cd contracts
npm install
cd ..
```

---

## 3. Compile + test contracts (1 min)

```powershell
npm run contracts:compile
npm run contracts:test
```

After compile, `contracts/artifacts/` exists and the backend will prefer
those real ABIs over the hand-written fallback ABIs in
`contract.service.js`. The test suite has 25 tests covering allocation
enforcement, vendor allowlist, NGO expiry, and the dual-trigger pause
invariant (Section 9).

---

## 4. Deploy Registry + DonorTracker to Monad (~30 s)

Make sure both your wallets show MON on the Monad Testnet network first
(the faucet usually credits in seconds). Then:

```powershell
npm run contracts:deploy
```

Copy the two addresses it prints into `.env`:

```
REGISTRY_CONTRACT_ADDRESS=0x...
DONOR_TRACKER_CONTRACT_ADDRESS=0x...
```

> Campaign contracts deploy **per-campaign** at runtime via
> `POST /api/admin/campaign/create` — there is no separate "campaign
> address" in `.env`.

Check the deploy on the Monad explorer:
- https://testnet.monadexplorer.com/address/<your-wallet-address>

---

## 5. Migrate + seed Postgres (1 min)

```powershell
npm run prisma:migrate -- --name init
npm run prisma:seed
```

The seed creates a SUPER_ADMIN admin user. Credentials come from
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`
(defaults: `admin@bankislam.demo` / `Password123!`).

---

## 6. Run the backend

```powershell
npm run dev
```

You should see:

```
[boot] DonorLedger backend listening on :3001 (env=development)
[boot] server wallet     : 0x...
[boot] bank islam wallet : 0x...
[boot] DEMO MODE active — /api/demo/* endpoints are live
```

Health check:
```powershell
curl http://localhost:3001/health
```

---

## 7. End-to-end smoke test (the demo flow)

In a **new** terminal:

```powershell
npm run smoke
```

This runs through all 11 steps of the demo (Section 21 priority #1):

1. /health
2. Admin login
3. NGO submit
4. NGO approve (chain: `Registry.addNGO`)
5. Campaign deploy (chain: `new Campaign(...)`)
6. Vendor submit
7. Vendor approve (chain: `Campaign.addApprovedVendor`)
8. Simulated DuitNow donation (chain: `Campaign.donate` + `DonorTracker.updateMilestone`)
9. Donor tracker read
10. **Fraud simulation** — score ≥ 92 → `Campaign.pauseCampaign` →
    MACC webhook → donor tracker flips to `UNDER_REVIEW`
11. Bank Islam dashboard alert feed

If everything passes, open your **webhook.site** tab — the MACC alert
payload (with the AI score, reason, flagged patterns, and pause tx)
should be sitting there.

---

## 8. (Optional) Deploy to IPserverone VPS

```bash
# on the VPS:
git clone <repo> donorledger && cd donorledger
cp .env.example .env  # then fill it in
docker compose up -d
npm install
cd contracts && npm install && cd ..
npm run contracts:compile
npm run contracts:deploy          # paste addresses into .env
npm run prisma:deploy             # use deploy, not migrate, in prod
npm run prisma:seed
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                       # follow the printed instructions
```

Open port 3001 in the IPserverone security group. The frontend can now
hit `http://VPS_IP:3001`.

---

## Switching from Monad back to Sepolia (if you ever need to)

Just edit `.env`:

```
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/<your_infura_project_id>
CHAIN_ID=11155111
BLOCKCHAIN_NETWORK_NAME=sepolia
```

...then run `cd contracts && npm run deploy:sepolia` and paste the new
contract addresses into `.env`. No code changes needed.

---

## Troubleshooting

**"Workspace still starting"** — n/a, that's the Claude sandbox; ignore.

**`Campaign artifact missing. Run npm run compile`** — you skipped
step 3 or `contracts/artifacts/` was wiped. Re-run
`npm run contracts:compile`.

**`Missing required env var: X`** — `config/env.js` fast-fails on
missing env. Open `.env` and fill in `X`.

**`AI service unavailable` in evidence flow** — `GEMINI_API_KEY` is
wrong or you hit the free-tier rate limit. The system still works —
score defaults to 50 (`review`) on every disbursement until Gemini
recovers.

**`Campaign: NGO credential lapsed`** — happens after the 12-month
expiry. Call `POST /api/admin/ngo/:id/renew`.

**`Campaign: vendor not approved`** on donate — make sure step 7
(vendor approve) ran for this specific campaign. Each campaign has its
own allowlist.

**`insufficient funds for intrinsic transaction cost`** — your wallet
ran out of MON (or ETH on Sepolia). Hit the faucet again.

**`network does not support ENS`** when running the seed script — this
is a non-fatal warning from ethers on testnets without ENS resolvers
(Monad doesn't have one). The script still completes successfully.

**Judge asks "why Monad and not Sepolia?"** — *"Monad is an EVM-compatible
testnet with chainId 10143. The architecture and contracts are identical
to Sepolia — we picked Monad because the faucet was accessible during
the hackathon. For Bank Islam production, this deploys on a permissioned
Hyperledger network anyway (CLAUDE.md Section 6, Layer 1)."*
