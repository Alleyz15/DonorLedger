// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DonorTracker
 * @notice Section 6 Layer 2 — the public, anonymised milestone log that
 *         powers the donor-facing tracker page. Completely decoupled from
 *         Campaign.sol: this contract stores only plain-language progress
 *         updates keyed by donor hash. No ringgit amounts, no NGO names,
 *         no vendor addresses.
 *
 * Owner is the server wallet (SERVER_WALLET_PRIVATE_KEY). The backend
 * calls updateMilestone() whenever fund status changes — RECEIVED right
 * after the donation, RELEASED after Bank Islam approves a disbursement,
 * UNDER_REVIEW when AI auto-freeze fires, etc.
 *
 * Why this is its own contract — it lets MACC, auditors, and donors read
 * the public log without touching the financial enforcement contract.
 * The frontend never reads Campaign.sol directly.
 */
contract DonorTracker is Ownable {
    struct Milestone {
        string  milestone;     // enum-like string: RECEIVED, ALLOCATED, ...
        string  description;   // plain English / Malay sentence
        uint256 timestamp;
    }

    /// donor hash → ordered list of milestones
    mapping(bytes32 => Milestone[]) private journeys;

    /// per-campaign aggregates that fuel the GoFundMe-style progress bar
    mapping(address => uint256) private campaignDonorCount;
    mapping(address => uint256) private campaignRaisedPercent;

    event MilestoneUpdated(bytes32 donorHash, string milestone, uint256 timestamp);
    event CampaignProgressUpdated(address campaign, uint256 raisedPercent, uint256 donorCount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ----- Writes (server wallet) --------------------------------------

    function updateMilestone(
        bytes32 donorHash,
        string calldata milestone,
        string calldata description
    ) external onlyOwner {
        journeys[donorHash].push(
            Milestone({
                milestone: milestone,
                description: description,
                timestamp: block.timestamp
            })
        );
        emit MilestoneUpdated(donorHash, milestone, block.timestamp);
    }

    /// Optional aggregate write — backend calls this when raised totals tick.
    function updateCampaignProgress(
        address campaign,
        uint256 raisedPercent,
        uint256 donorCount
    ) external onlyOwner {
        require(raisedPercent <= 1000, "Tracker: percent out of range"); // allow 0..1000 = 0..100.0%
        campaignRaisedPercent[campaign] = raisedPercent;
        campaignDonorCount[campaign] = donorCount;
        emit CampaignProgressUpdated(campaign, raisedPercent, donorCount);
    }

    // ----- Reads --------------------------------------------------------

    function getDonorJourney(bytes32 donorHash)
        external
        view
        returns (Milestone[] memory)
    {
        return journeys[donorHash];
    }

    function getCampaignProgress(address campaign)
        external
        view
        returns (uint256 raisedPercent, uint256 donorCount)
    {
        return (campaignRaisedPercent[campaign], campaignDonorCount[campaign]);
    }

    function milestoneCount(bytes32 donorHash) external view returns (uint256) {
        return journeys[donorHash].length;
    }
}
