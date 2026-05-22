// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRegistry {
    function isVerified(address ngo) external view returns (bool);
}

/**
 * @title Campaign
 * @notice One instance per donation campaign. Locks the NGO's allocation
 *         promise, records donations, and gates disbursements to vendors
 *         pre-approved by Bank Islam.
 *
 * Section 7 framing — this contract is what protects Bank Islam from
 * "you knew about the fraud" accusations. Every approval/rejection is
 * signed by the Bank Islam wallet on-chain. That signature is permanent.
 *
 * Section 9 security separation — TWO addresses can call pauseCampaign():
 *   - owner() (Bank Islam wallet)
 *   - aiFreezeWallet (server wallet, AI auto-freeze, Section 14)
 * Only owner() can unpause. AI cannot reverse its own freeze.
 *
 * Section 8 — Ringgit amount is passed in sen (RM × 100, integer).
 */
contract Campaign is Ownable, Pausable, ReentrancyGuard {
    // ----- Immutable allocation promise (the NGO's locked commitment) ----
    address public immutable ngo;
    string  public name;
    string  public causeType;

    uint256 public immutable aidPercent;
    uint256 public immutable logisticsPercent;
    uint256 public immutable adminPercent;

    uint256 public immutable targetAmount; // sen
    uint256 public immutable endDate;       // unix seconds

    IRegistry public immutable registry;

    /// Lower-privilege wallet allowed to trigger AI auto-freeze.
    address public immutable aiFreezeWallet;

    // ----- Mutable state -----------------------------------------------
    uint256 public raisedAmount;            // sen
    uint256 public donorCount;
    uint256 public releasedAmount;          // sen released to vendors
    mapping(address => bool) public approvedVendors;

    // ----- Evidence -----------------------------------------------------
    enum EvidenceStatus { Pending, Approved, Rejected }

    struct Evidence {
        bytes32 documentHash;
        string  category;          // "aid" | "logistics" | "admin"
        uint256 amount;            // sen
        address vendor;
        EvidenceStatus status;
        string  rejectedReason;
        uint256 submittedAt;
        uint256 decidedAt;
    }

    Evidence[] private evidenceList;

    // ----- Events -------------------------------------------------------
    event DonationReceived(bytes32 donorHash, uint256 amount, address vendorChoice);
    event EvidenceSubmitted(uint256 evidenceId, string category, uint256 amount);
    event DisbursementApproved(uint256 evidenceId, address vendor, uint256 amount);
    event DisbursementRejected(uint256 evidenceId, string reason);
    event CampaignPaused(string reason, uint256 timestamp);
    event CampaignUnpaused(uint256 timestamp);
    event VendorApproved(address vendor, uint256 timestamp);

    // ----- Constructor --------------------------------------------------
    constructor(
        address initialOwner,
        address _ngo,
        string memory _name,
        string memory _causeType,
        uint256 _aidPercent,
        uint256 _logisticsPercent,
        uint256 _adminPercent,
        uint256 _targetAmount,
        uint256 _endDate,
        address _registry,
        address _aiFreezeWallet
    ) Ownable(initialOwner) {
        require(_ngo != address(0), "Campaign: ngo zero");
        require(_registry != address(0), "Campaign: registry zero");
        require(_aiFreezeWallet != address(0), "Campaign: ai wallet zero");
        require(
            _aidPercent + _logisticsPercent + _adminPercent == 100,
            "Campaign: allocation must sum to 100"
        );
        require(_targetAmount > 0, "Campaign: target zero");
        require(_endDate > block.timestamp, "Campaign: end date in past");

        ngo = _ngo;
        name = _name;
        causeType = _causeType;
        aidPercent = _aidPercent;
        logisticsPercent = _logisticsPercent;
        adminPercent = _adminPercent;
        targetAmount = _targetAmount;
        endDate = _endDate;
        registry = IRegistry(_registry);
        aiFreezeWallet = _aiFreezeWallet;
    }

    // ----- Modifiers ----------------------------------------------------
    modifier onlyAiOrOwner() {
        require(
            msg.sender == owner() || msg.sender == aiFreezeWallet,
            "Campaign: not owner or AI freeze wallet"
        );
        _;
    }

    // ----- Donations (server wallet) ------------------------------------

    /**
     * @notice Record a donation. Called by the bridge service after a
     *         confirmed DuitNow payment. `amount` is in sen.
     *         `vendorChoice` may be the zero address if the donor did not
     *         pick a category up-front.
     */
    function donate(bytes32 donorHash, uint256 amount, address vendorChoice)
        external
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Campaign: amount zero");
        require(block.timestamp <= endDate, "Campaign: ended");
        require(registry.isVerified(ngo), "Campaign: NGO credential lapsed");
        if (vendorChoice != address(0)) {
            require(approvedVendors[vendorChoice], "Campaign: vendor not approved");
        }

        raisedAmount += amount;
        donorCount += 1;

        emit DonationReceived(donorHash, amount, vendorChoice);
    }

    // ----- Evidence (NGO portal, submitted via server wallet) ----------

    function submitEvidence(
        bytes32 documentHash,
        string calldata category,
        uint256 amount,
        address vendorAddress
    ) external whenNotPaused returns (uint256) {
        require(registry.isVerified(ngo), "Campaign: NGO credential lapsed");
        require(approvedVendors[vendorAddress], "Campaign: vendor not approved");
        require(amount > 0, "Campaign: amount zero");
        require(amount <= raisedAmount - releasedAmount, "Campaign: insufficient funds");

        evidenceList.push(
            Evidence({
                documentHash: documentHash,
                category: category,
                amount: amount,
                vendor: vendorAddress,
                status: EvidenceStatus.Pending,
                rejectedReason: "",
                submittedAt: block.timestamp,
                decidedAt: 0
            })
        );

        uint256 evidenceId = evidenceList.length - 1;
        emit EvidenceSubmitted(evidenceId, category, amount);
        return evidenceId;
    }

    // ----- Disbursement decisions (Bank Islam wallet) ------------------

    function approveDisbursement(uint256 evidenceId)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        require(evidenceId < evidenceList.length, "Campaign: bad evidenceId");
        Evidence storage e = evidenceList[evidenceId];
        require(e.status == EvidenceStatus.Pending, "Campaign: not pending");
        require(approvedVendors[e.vendor], "Campaign: vendor no longer approved");
        require(
            e.amount <= raisedAmount - releasedAmount,
            "Campaign: would exceed raised"
        );

        e.status = EvidenceStatus.Approved;
        e.decidedAt = block.timestamp;
        releasedAmount += e.amount;

        emit DisbursementApproved(evidenceId, e.vendor, e.amount);

        // NOTE: Bank Islam moves the actual MYR in escrow — this contract
        // only records the authorisation. No on-chain ETH transfer here.
    }

    function rejectDisbursement(uint256 evidenceId, string calldata reason)
        external
        onlyOwner
    {
        require(evidenceId < evidenceList.length, "Campaign: bad evidenceId");
        Evidence storage e = evidenceList[evidenceId];
        require(e.status == EvidenceStatus.Pending, "Campaign: not pending");

        e.status = EvidenceStatus.Rejected;
        e.rejectedReason = reason;
        e.decidedAt = block.timestamp;
        emit DisbursementRejected(evidenceId, reason);
    }

    // ----- Pause / unpause ---------------------------------------------

    /// Either owner (Bank Islam) or aiFreezeWallet (Section 14) can pause.
    function pauseCampaign(string calldata reason) external onlyAiOrOwner {
        _pause();
        emit CampaignPaused(reason, block.timestamp);
    }

    /// Only owner (Bank Islam) can unpause — AI cannot reverse its freeze.
    function unpauseCampaign() external onlyOwner {
        _unpause();
        emit CampaignUnpaused(block.timestamp);
    }

    // ----- Vendor allowlist (Bank Islam wallet) ------------------------

    function addApprovedVendor(address vendor) external onlyOwner {
        require(vendor != address(0), "Campaign: vendor zero");
        require(!approvedVendors[vendor], "Campaign: vendor already approved");
        approvedVendors[vendor] = true;
        emit VendorApproved(vendor, block.timestamp);
    }

    // ----- Reads --------------------------------------------------------

    function paused()
        public
        view
        override(Pausable)
        returns (bool)
    {
        return super.paused();
    }

    function getEvidence(uint256 evidenceId)
        external
        view
        returns (
            bytes32 documentHash,
            string memory category,
            uint256 amount,
            address vendor,
            uint8 status,
            string memory rejectedReason,
            uint256 submittedAt,
            uint256 decidedAt
        )
    {
        require(evidenceId < evidenceList.length, "Campaign: bad evidenceId");
        Evidence storage e = evidenceList[evidenceId];
        return (
            e.documentHash,
            e.category,
            e.amount,
            e.vendor,
            uint8(e.status),
            e.rejectedReason,
            e.submittedAt,
            e.decidedAt
        );
    }

    function evidenceCount() external view returns (uint256) {
        return evidenceList.length;
    }
}
