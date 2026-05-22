// Registry.test.js
//
// Section 21 priority #2 — "Smart contract allocation enforcement is
// correct and tested". These tests cover the security-critical paths
// in Registry.sol:
//   - only owner can write
//   - revoked + expired NGOs are not verified
//   - duplicate registration is blocked
//   - renew/revoke require an existing record

import { expect } from 'chai'
import hardhat from 'hardhat'
const { ethers } = hardhat

const ONE_YEAR = 365 * 24 * 60 * 60

describe('Registry', () => {
  let owner, bankIslam, ngo, attacker, registry

  beforeEach(async () => {
    ;[owner, bankIslam, ngo, attacker] = await ethers.getSigners()
    const Registry = await ethers.getContractFactory('Registry', owner)
    registry = await Registry.deploy(bankIslam.address)
    await registry.waitForDeployment()
  })

  it('initial state: NGO is not verified', async () => {
    expect(await registry.isVerified(ngo.address)).to.equal(false)
  })

  it('only Bank Islam owner can addNGO', async () => {
    const future = Math.floor(Date.now() / 1000) + ONE_YEAR
    await expect(
      registry.connect(attacker).addNGO(ngo.address, 'X', 'SSM-1', 0, future)
    ).to.be.reverted
  })

  it('addNGO + isVerified happy path', async () => {
    const future = Math.floor(Date.now() / 1000) + ONE_YEAR
    await expect(
      registry
        .connect(bankIslam)
        .addNGO(ngo.address, 'Yayasan Demo', 'SSM-1', 0, future)
    )
      .to.emit(registry, 'NGOVerified')
      .withArgs(ngo.address, 'Yayasan Demo', future)
    expect(await registry.isVerified(ngo.address)).to.equal(true)
  })

  it('rejects duplicate registration', async () => {
    const future = Math.floor(Date.now() / 1000) + ONE_YEAR
    await registry
      .connect(bankIslam)
      .addNGO(ngo.address, 'X', 'SSM-1', 0, future)
    await expect(
      registry.connect(bankIslam).addNGO(ngo.address, 'X', 'SSM-1', 0, future)
    ).to.be.revertedWith('Registry: NGO already registered')
  })

  it('revokes — isVerified flips to false permanently', async () => {
    const future = Math.floor(Date.now() / 1000) + ONE_YEAR
    await registry
      .connect(bankIslam)
      .addNGO(ngo.address, 'X', 'SSM-1', 0, future)

    await expect(
      registry.connect(bankIslam).revokeNGO(ngo.address, 'Fraud — RM230M case')
    ).to.emit(registry, 'NGORevoked')
    expect(await registry.isVerified(ngo.address)).to.equal(false)
  })

  it('expired credentials are not verified (annual renewal required)', async () => {
    // Set expiry 2 seconds from now, then advance time past it
    const block = await ethers.provider.getBlock('latest')
    const expiry = block.timestamp + 2

    await registry
      .connect(bankIslam)
      .addNGO(ngo.address, 'X', 'SSM-1', 0, expiry)
    expect(await registry.isVerified(ngo.address)).to.equal(true)

    await ethers.provider.send('evm_increaseTime', [10])
    await ethers.provider.send('evm_mine', [])

    expect(await registry.isVerified(ngo.address)).to.equal(false)
  })

  it('renewNGO extends expiry', async () => {
    const block = await ethers.provider.getBlock('latest')
    const shortExpiry = block.timestamp + 2

    await registry
      .connect(bankIslam)
      .addNGO(ngo.address, 'X', 'SSM-1', 0, shortExpiry)

    await ethers.provider.send('evm_increaseTime', [10])
    await ethers.provider.send('evm_mine', [])
    expect(await registry.isVerified(ngo.address)).to.equal(false)

    const newExpiry = (await ethers.provider.getBlock('latest')).timestamp + ONE_YEAR
    await registry.connect(bankIslam).renewNGO(ngo.address, newExpiry)
    expect(await registry.isVerified(ngo.address)).to.equal(true)
  })

  it('cannot renew a revoked NGO', async () => {
    const future = Math.floor(Date.now() / 1000) + ONE_YEAR
    await registry
      .connect(bankIslam)
      .addNGO(ngo.address, 'X', 'SSM-1', 0, future)
    await registry.connect(bankIslam).revokeNGO(ngo.address, 'r')
    await expect(
      registry.connect(bankIslam).renewNGO(ngo.address, future + ONE_YEAR)
    ).to.be.revertedWith('Registry: NGO revoked')
  })
})
