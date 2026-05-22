// scripts/deploy.js
//
// One-shot deploy for the two infrastructure contracts:
//   - Registry      (owner = Bank Islam wallet)
//   - DonorTracker  (owner = Server wallet)
//
// Campaigns deploy per-campaign from the backend (POST /api/admin/campaign/create)
// so they are NOT deployed here.
//
// Usage:
//   cd contracts && npm run deploy:sepolia
// After running, copy the printed addresses into the root .env:
//   REGISTRY_CONTRACT_ADDRESS=...
//   DONOR_TRACKER_CONTRACT_ADDRESS=...

import hre from 'hardhat'

async function main() {
  const [deployer, bankIslam] = await hre.ethers.getSigners()
  if (!deployer) throw new Error('No deployer signer — check accounts in .env')

  const bankIslamAddress = bankIslam ? bankIslam.address : deployer.address
  console.log('Deployer (server wallet)    :', deployer.address)
  console.log('Bank Islam wallet           :', bankIslamAddress)

  // --- Registry — owner is Bank Islam wallet
  console.log('\nDeploying Registry…')
  const Registry = await hre.ethers.getContractFactory('Registry', deployer)
  const registry = await Registry.deploy(bankIslamAddress)
  await registry.waitForDeployment()
  const registryAddr = await registry.getAddress()
  console.log('Registry deployed at        :', registryAddr)

  // --- DonorTracker — owner is the server wallet (deployer)
  console.log('\nDeploying DonorTracker…')
  const Tracker = await hre.ethers.getContractFactory('DonorTracker', deployer)
  const tracker = await Tracker.deploy(deployer.address)
  await tracker.waitForDeployment()
  const trackerAddr = await tracker.getAddress()
  console.log('DonorTracker deployed at    :', trackerAddr)

  console.log('\n=== Paste these into .env ===')
  console.log(`REGISTRY_CONTRACT_ADDRESS=${registryAddr}`)
  console.log(`DONOR_TRACKER_CONTRACT_ADDRESS=${trackerAddr}`)
  console.log('=============================')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
