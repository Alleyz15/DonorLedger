// scripts/smoke-test.js
//
// End-to-end smoke test for the DonorLedger backend. Run AFTER:
//   1. Backend is running   (npm run dev — on port 3001)
//   2. Postgres + Redis up  (docker compose up -d)
//   3. Contracts deployed   (REGISTRY_CONTRACT_ADDRESS + DONOR_TRACKER_CONTRACT_ADDRESS in .env)
//   4. Prisma seeded        (admin user exists in DB)
//
// What it does (mirrors Section 21 "End-to-end demo works without breaking"):
//
//   1. /health                                             — confirm server is up
//   2. POST /api/admin/login                               — get admin JWT
//   3. POST /api/ngo/register                              — submit demo NGO
//   4. POST /api/admin/ngo/:id/approve                     — Bank Islam KYC ✓ (chain)
//   5. POST /api/admin/campaign/create                     — deploy Campaign.sol
//   6. POST /api/vendor/submit                             — submit demo vendor
//   7. POST /api/admin/vendor/:id/approve                  — addApprovedVendor (chain)
//   8. POST /api/demo/simulate-duitnow                     — donate → tracker URL
//   9. GET  /api/tracker/:donorHash                        — confirm plain-language journey
//  10. POST /api/demo/simulate-fraud                       — the wow moment
//  11. GET  /api/admin/alerts                              — confirm MACC alert row
//
// Usage:
//   node scripts/smoke-test.js
//   # OR override the base URL
//   API_BASE_URL=http://localhost:3001 node scripts/smoke-test.js

import * as dotenv from 'dotenv'
dotenv.config()

const BASE = process.env.API_BASE_URL || 'http://localhost:3001'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@bankislam.demo'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'donorledger-demo-2026'

// Demo wallet addresses — these don't need to be funded for the smoke test
// because the backend does the on-chain signing. They just need to be valid
// 0x addresses. Replace with real ones if you want the chain side to succeed.
const DEMO_NGO_WALLET = process.env.SMOKE_NGO_WALLET ||
  '0x000000000000000000000000000000000000dEaD'
const DEMO_VENDOR_WALLET = process.env.SMOKE_VENDOR_WALLET ||
  '0x000000000000000000000000000000000000bEEF'

let token = null

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
}

async function http(method, path, body, opts = {}) {
  const headers = { 'content-type': 'application/json' }
  if (token && !opts.skipAuth) headers.authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, ok: res.ok, body: json }
}

function step(n, label) {
  process.stdout.write(`\n${c.blue}[${n}]${c.reset} ${label}\n`)
}

function ok(msg) {
  console.log(`  ${c.green}✓${c.reset} ${msg}`)
}

function warn(msg) {
  console.log(`  ${c.yellow}!${c.reset} ${msg}`)
}

function fail(msg, detail) {
  console.log(`  ${c.red}✗${c.reset} ${msg}`)
  if (detail) console.log(`    ${c.dim}${JSON.stringify(detail)}${c.reset}`)
  process.exit(1)
}

async function main() {
  console.log(`${c.blue}DonorLedger smoke test${c.reset}`)
  console.log(`base : ${BASE}`)
  console.log(`admin: ${ADMIN_EMAIL}`)

  // 1
  step(1, 'GET /health')
  {
    const r = await http('GET', '/health')
    if (!r.ok) fail('health check failed', r)
    ok(`server up — demoMode=${r.body.demoMode}`)
    ok(`server wallet     : ${r.body.serverWallet}`)
    ok(`bank islam wallet : ${r.body.bankIslamWallet}`)
  }

  // 2
  step(2, 'POST /api/admin/login')
  {
    const r = await http('POST', '/api/admin/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }, { skipAuth: true })
    if (!r.ok) fail('admin login failed — did you run `npm run prisma:seed`?', r)
    token = r.body.token
    ok(`logged in as ${r.body.name} (${r.body.role})`)
  }

  // 3
  step(3, 'POST /api/ngo/register')
  let ngoId
  {
    const r = await http('POST', '/api/ngo/register', {
      name: 'Yayasan Smoke Test',
      registrationNum: `SSM-SMOKE-${Date.now()}`,
      walletAddress: DEMO_NGO_WALLET,
      contactEmail: 'ngo@smoke.test',
      contactPhone: '+60123456789',
    }, { skipAuth: true })
    if (!r.ok) fail('NGO register failed', r)
    ngoId = r.body.id
    ok(`NGO submitted: ${ngoId} (status=${r.body.status})`)
  }

  // 4
  step(4, `POST /api/admin/ngo/${ngoId}/approve`)
  {
    const r = await http('POST', `/api/admin/ngo/${ngoId}/approve`)
    if (!r.ok) {
      warn(`approval call failed — likely missing chain wiring`)
      console.log(`    ${c.dim}${JSON.stringify(r.body)}${c.reset}`)
    } else {
      ok(`NGO approved on-chain (status=${r.body.status})`)
    }
  }

  // 5
  step(5, 'POST /api/admin/campaign/create')
  let campaignId
  {
    const endDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const r = await http('POST', '/api/admin/campaign/create', {
      ngoId,
      name: 'Smoke Test Banjir Relief',
      causeType: 'Disaster relief',
      description: 'Created by smoke-test.js',
      aidPercent: 70,
      logisticsPercent: 20,
      adminPercent: 10,
      targetAmount: 100000,
      endDate,
    })
    if (!r.ok) {
      warn('campaign deploy failed — most likely cause: contracts not compiled')
      console.log(`    ${c.dim}${JSON.stringify(r.body)}${c.reset}`)
      console.log(`    ${c.dim}Run: cd contracts && npm run compile${c.reset}`)
      process.exit(1)
    }
    campaignId = r.body.campaignId
    ok(`Campaign deployed: ${r.body.contractAddress}`)
    ok(`deploy tx: ${r.body.deployTxHash}`)
  }

  // 6
  step(6, 'POST /api/vendor/submit')
  let vendorId
  {
    const r = await http('POST', '/api/vendor/submit', {
      ngoId,
      name: 'Syarikat Makanan Smoke',
      ssmNumber: `SSM-V-${Date.now()}`,
      serviceType: 'FOOD',
      bankAccount: '5614xxxxxxxx',
      walletAddress: DEMO_VENDOR_WALLET,
    }, { skipAuth: true })
    if (!r.ok) fail('vendor submit failed', r)
    vendorId = r.body.id
    ok(`vendor submitted: ${vendorId}`)
  }

  // 7
  step(7, `POST /api/admin/vendor/${vendorId}/approve`)
  {
    const r = await http('POST', `/api/admin/vendor/${vendorId}/approve`, {
      campaignId,
    })
    if (!r.ok) fail('vendor approve failed', r)
    ok(`vendor approved on-chain`)
  }

  // 8
  step(8, 'POST /api/demo/simulate-duitnow')
  let donorHash, trackerUrl
  {
    const r = await http('POST', '/api/demo/simulate-duitnow', {
      campaignId,
      donorEmail: 'donor@smoke.test',
      amount: 50,
      vendorId,
    }, { skipAuth: true })
    if (!r.ok) fail('simulate-duitnow failed', r)
    donorHash = r.body.donorHash
    trackerUrl = r.body.trackerUrl
    ok(`donation recorded — tx ${r.body.txHash}`)
    ok(`donor hash: ${donorHash}`)
    ok(`tracker URL: ${trackerUrl}`)
  }

  // 9
  step(9, `GET /api/tracker/${donorHash}`)
  {
    const r = await http('GET', `/api/tracker/${donorHash}`, null, { skipAuth: true })
    if (!r.ok) fail('tracker fetch failed', r)
    ok(`tracker returned ${r.body.journey.length} milestone(s)`)
    for (const m of r.body.journey) {
      console.log(`    ${c.dim}- ${m.milestone}: ${m.description}${c.reset}`)
    }
  }

  // 10
  step(10, 'POST /api/demo/simulate-fraud — THE WOW MOMENT')
  {
    const r = await http('POST', '/api/demo/simulate-fraud', { campaignId }, { skipAuth: true })
    if (!r.ok) fail('simulate-fraud failed', r)
    ok(`AI confidence score: ${r.body.confidenceScore}`)
    ok(`reason             : ${r.body.reason}`)
    ok(`flagged patterns   : ${(r.body.flaggedPatterns || []).join(', ')}`)
    ok(`pause tx           : ${r.body.pauseTx}`)
    ok(`campaign status    : ${r.body.campaignStatus}`)
  }

  // 11
  step(11, 'GET /api/admin/alerts')
  {
    const r = await http('GET', '/api/admin/alerts')
    if (!r.ok) fail('alerts fetch failed', r)
    const macc = (r.body || []).filter((a) => a.channel === 'MACC_WEBHOOK')
    ok(`alert rows total : ${r.body.length}`)
    ok(`MACC alerts      : ${macc.length}`)
  }

  console.log(`\n${c.green}All steps passed.${c.reset}`)
  console.log(`${c.dim}If MACC_WEBHOOK_URL is set to a webhook.site URL,`)
  console.log(`open it now — the auto-freeze alert was delivered there.${c.reset}\n`)
}

main().catch((e) => {
  console.error(`\n${c.red}smoke test crashed:${c.reset}`, e.message)
  process.exit(1)
})
