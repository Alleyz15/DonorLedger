# DonorLedger — Quickstart

Read `CLAUDE.md` first (full architecture spec). This is the **how to run
it locally** guide. Setup time: ~30 minutes once you have the manual
items below.

---

## 0. Manual items you must collect yourself (10 min)

These are the things only you can get — Claude cannot acquire them.

| Item | Where to get it | What it goes into |
|---|---|---|
| Sepolia RPC URL | https://infura.io (free) → create project → copy the Sepolia endpoint | `SEPOLIA_RPC_URL` |
| Two test wallets | MetaMask → Create Account ×2. Export both private keys. | `SERVER_WALLET_PRIVATE_KEY`, `BANK_ISLAM_PRIVATE_KEY` |
| Sepolia ETH | https://sepoliafaucet.com (need ~0.1 ETH on each wallet) | n/a |
| Gemini API key | https://aistudio.google.com/apikey (free tier OK) | `GEMINI_API_KEY` |
| Donor hash salt | `openssl rand -hex 32` or any 32-byte random hex | `DONOR_HASH_SALT` |
| JWT secret | `openssl rand -hex 32` | `JWT_SECRET` |
| MACC webhook URL | https://webhook.site → copy "Your unique URL" | `MACC_WEBHOOK_URL` |

Once you have all of the above, copy `.env.example` to `.env` and fill
them in.

```powershell
copy .env.example .env
# then edit .env
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
`contract.service.js`.

---

## 4. Deploy Registry + DonorTracker to Sepolia (~30 s)

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

---

## 5. Migrate + seed Postgres (1 min)

```powershell
npm run prisma:migrate -- --name init
npm run prisma:seed
```

The seed creates a SUPER_ADMIN admin user. Credentials come from
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`
(defaults: `admin@bankislam.demo` / `donorledger-demo-2026`).

---

## 6. Run the backend (forever-loop)

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

**Tx underpriced / nonce issues on Sepolia** — both wallets need fresh
Sepolia ETH. Top them up from the faucet.
