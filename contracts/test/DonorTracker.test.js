// DonorTracker.test.js
//
// Covers Section 6 Layer 2 invariants:
//   - only the server wallet (owner) can write milestones
//   - getDonorJourney returns the full ordered list
//   - campaign progress aggregate is bounded

import { expect } from 'chai'
import hardhat from 'hardhat'
const { ethers } = hardhat

describe('DonorTracker', () => {
  let owner, server, attacker, tracker
  const hash = '0x' + 'a'.repeat(64)

  beforeEach(async () => {
    ;[owner, server, attacker] = await ethers.getSigners()
    const T = await ethers.getContractFactory('DonorTracker', owner)
    tracker = await T.deploy(server.address)
    await tracker.waitForDeployment()
  })

  it('initial journey is empty', async () => {
    expect(await tracker.milestoneCount(hash)).to.equal(0n)
  })

  it('only owner (server wallet) can updateMilestone', async () => {
    await expect(
      tracker.connect(attacker).updateMilestone(hash, 'RECEIVED', 'desc')
    ).to.be.reverted
  })

  it('milestones append in order', async () => {
    await tracker
      .connect(server)
      .updateMilestone(hash, 'RECEIVED', 'Your donation has been received')
    await tracker
      .connect(server)
      .updateMilestone(hash, 'RELEASED', 'Funds released to vendor')

    const journey = await tracker.getDonorJourney(hash)
    expect(journey.length).to.equal(2)
    expect(journey[0].milestone).to.equal('RECEIVED')
    expect(journey[1].milestone).to.equal('RELEASED')
  })

  it('campaign progress aggregate is bounded to 0-1000', async () => {
    const [, , , campaignAddr] = await ethers.getSigners()
    await expect(
      tracker
        .connect(server)
        .updateCampaignProgress(campaignAddr.address, 1500, 10)
    ).to.be.revertedWith('Tracker: percent out of range')

    await tracker
      .connect(server)
      .updateCampaignProgress(campaignAddr.address, 873, 1247) // 87.3%, 1247 donors
    const [percent, count] = await tracker.getCampaignProgress(
      campaignAddr.address
    )
    expect(percent).to.equal(873n)
    expect(count).to.equal(1247n)
  })
})
