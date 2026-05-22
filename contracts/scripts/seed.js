// scripts/seed.js
//
// Seeds the current testnet (Monad by default) with one demo NGO
// credential, one demo Campaign instance, and one approved demo vendor —
// so judges can hit the full happy path and the fraud demo immediately
// after deploy without manual setup.
//
// Prerequisites:
//   1. scripts/deploy.js has been run and addresses pasted into .env
//   2. Both server + bank islam wallets hold a small amount of the gas
//      token (MON for Monad, ETH for Sepolia) — ~0.1 of either is plenty
//
// Usage:
//   cd contracts && npm run seed            # uses Monad (default)
//   cd contracts && npm run seed:sepolia    # uses Sepolia

import hre from 'hardhat'
import * as dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

const REGISTRY = process.env.REGISTRY_CONTRACT_ADDRESS
const TRACKER = process.env.DONOR_TRACKER_CONTRACT_ADDRESS

if (!REGISTRY || !TRACKER) {
  console.error('REGISTRY_CONTRACT_ADDRESS or DONOR_TRACKER_CONTRACT_ADDRESS missing in .env')
  process.exit(1)
}

async function main() {
  const [serverWallet, bankIslam] = await hre.ethers.getSigners()
  console.log('Server wallet     :', serverWallet.address)
  console.log('Bank Islam wallet :', bankIslam.address)

  // Demo NGO address — for the hackathon we just reuse the deployer address
  // as the "NGO wallet". In production this would be a wallet the NGO
  // controls.
  const demoNgo = serverWallet.address

  // ---- 1. Register demo NGO on Registry (Bank Islam owner) -----------
  const registry = await hre.ethers.getContractAt(
    'Registry',
    REGISTRY,
    bankIslam
  )
  const oneYearFromNow = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
  console.log('\n-> Registry.addNGO ...')
  const tx1 = await registry.addNGO(
    demoNgo,
    'Yayasan Demo Kebajikan Malaysia',
    'SSM-DEMO-2026',
    0, // LOW risk
    oneYearFromNow
  )
  await tx1.wait()
  console.log('  tx:', tx1.hash)

  // ---- 2. Deploy a demo Campaign (Bank Islam owner) ------------------
  console.log('\n-> Deploying demo Campaign...')
  const endDate = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60 // 60 days
  const Campaign = await hre.ethers.getContractFactory('Campaign', bankIslam)
  const campaign = await Campaign.deploy(
    bankIslam.address,             // owner
    demoNgo,                       // ngo
    'Banjir Kelantan Relief 2026', // name
    'Disaster relief',             // causeType
    70,                            // aidPercent
    20,                            // logisticsPercent
    10,                            // adminPercent
    10000000n,                     // targetAmount = RM100,000 (in sen)
    endDate,
    REGISTRY,
    serverWallet.address           // aiFreezeWallet (Section 9)
  )
  await campaign.waitForDeployment()
  const campaignAddr = await campaign.getAddress()
  console.log('  Campaign deployed at:', campaignAddr)

  // ---- 3. Approve a demo vendor on the campaign ----------------------
  // Vendor wallet — for the demo we use the bank islam wallet (any address
  // is fine; on production this is the vendor's actual wallet).
  const demoVendor = bankIslam.address
  console.log('\n-> Campaign.addApprovedVendor ...')
  const tx3 = await campaign.addApprovedVendor(demoVendor)
  await tx3.wait()
  console.log('  tx:', tx3.hash)
  console.log('  vendor address:', demoVendor)

  console.log('\n=== Seed complete ===')
  console.log('NGO wallet            :', demoNgo)
  console.log('Campaign address      :', campaignAddr)
  console.log('Approved demo vendor  :', demoVendor)
  console.log('=====================')
  console.log('\nPersist this Campaign in Postgres via the backend admin')
  console.log('endpoint POST /api/admin/campaign/create (or manually) so')
  console.log('the listener subscribes to its events on reboot.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
