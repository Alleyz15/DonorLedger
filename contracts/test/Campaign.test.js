// Campaign.test.js
//
// Section 21 priority #2 — "Smart contract allocation enforcement is
// correct and tested". These tests cover every load-bearing security
// rule in Campaign.sol:
//   - allocation percentages must sum to 100 at deploy
//   - donation only succeeds when NGO is verified and vendor is approved
//   - approveDisbursement is gated to the Bank Islam owner
//   - pauseCampaign is callable by owner OR aiFreezeWallet
//   - unpauseCampaign is owner-only (AI cannot reverse its own freeze)
//   - vendor allowlist is enforced for submitEvidence

import { expect } from 'chai'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs.js'
import hardhat from 'hardhat'
const { ethers } = hardhat

const ONE_YEAR = 365 * 24 * 60 * 60
const SIXTY_DAYS = 60 * 24 * 60 * 60

const donorHash = (i = 1) =>
  '0x' + i.toString(16).padStart(64, '0')

async function deployStack({
  aid = 70,
  logistics = 20,
  admin = 10,
} = {}) {
  const [deployer, bankIslam, server, ngo, vendor, donor] =
    await ethers.getSigners()

  const Registry = await ethers.getContractFactory('Registry', deployer)
  const registry = await Registry.deploy(bankIslam.address)
  await registry.waitForDeployment()

  const block = await ethers.provider.getBlock('latest')
  await registry
    .connect(bankIslam)
    .addNGO(ngo.address, 'Yayasan Demo', 'SSM-1', 0, block.timestamp + ONE_YEAR)

  const Campaign = await ethers.getContractFactory('Campaign', deployer)
  const campaign = await Campaign.deploy(
    bankIslam.address,
    ngo.address,
    'Banjir Kelantan Relief 2026',
    'Disaster relief',
    aid,
    logistics,
    admin,
    10_000_000n, // RM100,000 in sen
    block.timestamp + SIXTY_DAYS,
    await registry.getAddress(),
    server.address // aiFreezeWallet
  )
  await campaign.waitForDeployment()

  return { deployer, bankIslam, server, ngo, vendor, donor, registry, campaign }
}

describe('Campaign — deploy invariants', () => {
  it('reverts when allocation does not sum to 100', async () => {
    const [, bankIslam, server, ngo] = await ethers.getSigners()
    const Registry = await ethers.getContractFactory('Registry')
    const reg = await Registry.deploy(bankIslam.address)
    await reg.waitForDeployment()

    const Campaign = await ethers.getContractFactory('Campaign')
    const block = await ethers.provider.getBlock('latest')

    await expect(
      Campaign.deploy(
        bankIslam.address,
        ngo.address,
        'X',
        'X',
        50,
        25,
        20, // 95 — not 100
        1n,
        block.timestamp + SIXTY_DAYS,
        await reg.getAddress(),
        server.address
      )
    ).to.be.revertedWith('Campaign: allocation must sum to 100')
  })

  it('reverts when end date is in the past', async () => {
    const [, bankIslam, server, ngo] = await ethers.getSigners()
    const Registry = await ethers.getContractFactory('Registry')
    const reg = await Registry.deploy(bankIslam.address)
    await reg.waitForDeployment()

    const Campaign = await ethers.getContractFactory('Campaign')
    await expect(
      Campaign.deploy(
        bankIslam.address,
        ngo.address,
        'X',
        'X',
        70,
        20,
        10,
        1n,
        1n, // past
        await reg.getAddress(),
        server.address
      )
    ).to.be.revertedWith('Campaign: end date in past')
  })
})

describe('Campaign — donations', () => {
  it('donate() reverts when vendor is not on the allowlist', async () => {
    const { campaign, vendor, donor } = await deployStack()
    await expect(
      campaign.connect(donor).donate(donorHash(1), 100n, vendor.address)
    ).to.be.revertedWith('Campaign: vendor not approved')
  })

  it('donate() accepts zero-address vendor (donor did not pick a category)', async () => {
    const { campaign, donor } = await deployStack()
    await expect(
      campaign.connect(donor).donate(donorHash(1), 5_000n, ethers.ZeroAddress)
    ).to.emit(campaign, 'DonationReceived')
    expect(await campaign.raisedAmount()).to.equal(5_000n)
    expect(await campaign.donorCount()).to.equal(1n)
  })

  it('donate() accepts approved vendor and bumps aggregates', async () => {
    const { campaign, bankIslam, vendor, donor } = await deployStack()
    await campaign.connect(bankIslam).addApprovedVendor(vendor.address)
    await campaign.connect(donor).donate(donorHash(1), 1_000n, vendor.address)
    await campaign.connect(donor).donate(donorHash(2), 2_500n, vendor.address)

    expect(await campaign.raisedAmount()).to.equal(3_500n)
    expect(await campaign.donorCount()).to.equal(2n)
  })

  it('donate() reverts when NGO credential has been revoked', async () => {
    const { campaign, registry, bankIslam, ngo, donor } = await deployStack()
    await registry.connect(bankIslam).revokeNGO(ngo.address, 'r')
    await expect(
      campaign.connect(donor).donate(donorHash(1), 100n, ethers.ZeroAddress)
    ).to.be.revertedWith('Campaign: NGO credential lapsed')
  })
})

describe('Campaign — vendor allowlist + evidence', () => {
  it('submitEvidence requires the vendor to be approved', async () => {
    const { campaign, vendor } = await deployStack()
    await expect(
      campaign.submitEvidence(
        donorHash(99),
        'aid',
        100n,
        vendor.address
      )
    ).to.be.revertedWith('Campaign: vendor not approved')
  })

  it('submitEvidence reverts if amount exceeds raised - released', async () => {
    const { campaign, bankIslam, vendor, donor } = await deployStack()
    await campaign.connect(bankIslam).addApprovedVendor(vendor.address)
    await campaign.connect(donor).donate(donorHash(1), 1_000n, vendor.address)
    await expect(
      campaign.submitEvidence(donorHash(99), 'aid', 2_000n, vendor.address)
    ).to.be.revertedWith('Campaign: insufficient funds')
  })

  it('submitEvidence + approve flow updates releasedAmount', async () => {
    const { campaign, bankIslam, vendor, donor } = await deployStack()
    await campaign.connect(bankIslam).addApprovedVendor(vendor.address)
    await campaign.connect(donor).donate(donorHash(1), 10_000n, vendor.address)

    const tx = await campaign.submitEvidence(
      donorHash(99),
      'aid',
      4_000n,
      vendor.address
    )
    const receipt = await tx.wait()
    // First evidenceId is 0
    const evidenceId = 0n

    await expect(campaign.connect(bankIslam).approveDisbursement(evidenceId))
      .to.emit(campaign, 'DisbursementApproved')
      .withArgs(evidenceId, vendor.address, 4_000n)

    expect(await campaign.releasedAmount()).to.equal(4_000n)
  })

  it('non-owner cannot approveDisbursement', async () => {
    const { campaign, server, bankIslam, vendor, donor } = await deployStack()
    await campaign.connect(bankIslam).addApprovedVendor(vendor.address)
    await campaign.connect(donor).donate(donorHash(1), 10_000n, vendor.address)
    await campaign.submitEvidence(donorHash(99), 'aid', 1n, vendor.address)

    await expect(campaign.connect(server).approveDisbursement(0)).to.be.reverted
  })
})

describe('Campaign — pause / unpause (Section 9)', () => {
  it('owner (Bank Islam) can pause', async () => {
    const { campaign, bankIslam } = await deployStack()
    await expect(campaign.connect(bankIslam).pauseCampaign('manual'))
      .to.emit(campaign, 'CampaignPaused')
      .withArgs('manual', anyValue)
    expect(await campaign.paused()).to.equal(true)
  })

  it('aiFreezeWallet (server) can pause — auto-freeze path', async () => {
    const { campaign, server } = await deployStack()
    await expect(campaign.connect(server).pauseCampaign('AI: admin > 10%'))
      .to.emit(campaign, 'CampaignPaused')
    expect(await campaign.paused()).to.equal(true)
  })

  it('a random third party cannot pause', async () => {
    const { campaign, donor } = await deployStack()
    await expect(
      campaign.connect(donor).pauseCampaign('hax')
    ).to.be.revertedWith('Campaign: not owner or AI freeze wallet')
  })

  it('only owner can unpause — AI cannot reverse its own freeze', async () => {
    const { campaign, bankIslam, server } = await deployStack()
    await campaign.connect(server).pauseCampaign('AI')
    await expect(campaign.connect(server).unpauseCampaign()).to.be.reverted
    await expect(campaign.connect(bankIslam).unpauseCampaign()).to.emit(
      campaign,
      'CampaignUnpaused'
    )
    expect(await campaign.paused()).to.equal(false)
  })

  it('donate() reverts while paused', async () => {
    const { campaign, bankIslam, donor } = await deployStack()
    await campaign.connect(bankIslam).pauseCampaign('r')
    await expect(
      campaign.connect(donor).donate(donorHash(1), 100n, ethers.ZeroAddress)
    ).to.be.reverted
  })
})

