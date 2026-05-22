// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Registry
 * @notice Single source of truth for verified NGO credentials.
 *
 * Section 7 — this contract is what gives Bank Islam permanent
 * cryptographic proof of every KYC decision they made and when.
 * No NGO director can later claim "the bank knew" — the bank's
 * on-chain signature is their alibi.
 *
 * Section 8 — Owner is Bank Islam's admin wallet (BANK_ISLAM_PRIVATE_KEY).
 * Production v2: transferOwnership() to a multi-sig (BNM + ROS + Bank Islam).
 */
contract Registry is Ownable {
    enum RiskTier { LOW, MEDIUM, HIGH }

    struct NGOCredential {
        string  name;
        string  regNumber;     // SSM or ROS
        RiskTier riskTier;
        uint256 expiryDate;    // unix seconds — annual renewal required
        bool    exists;        // distinguishes "never registered" from "revoked"
        bool    revoked;
        string  revokedReason;
        uint256 verifiedAt;
    }

    mapping(address => NGOCredential) private credentials;

    event NGOVerified(address indexed ngo, string name, uint256 expiryDate);
    event NGORenewed(address indexed ngo, uint256 newExpiryDate);
    event NGORevoked(address indexed ngo, string reason, uint256 timestamp);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // --- Writes (Bank Islam wallet) -----------------------------------

    function addNGO(
        address ngo,
        string calldata name,
        string calldata regNumber,
        uint8 riskTier,
        uint256 expiryDate
    ) external onlyOwner {
        require(ngo != address(0), "Registry: zero address");
        require(!credentials[ngo].exists, "Registry: NGO already registered");
        require(riskTier <= uint8(RiskTier.HIGH), "Registry: invalid risk tier");
        require(expiryDate > block.timestamp, "Registry: expiry in past");

        credentials[ngo] = NGOCredential({
            name: name,
            regNumber: regNumber,
            riskTier: RiskTier(riskTier),
            expiryDate: expiryDate,
            exists: true,
            revoked: false,
            revokedReason: "",
            verifiedAt: block.timestamp
        });

        emit NGOVerified(ngo, name, expiryDate);
    }

    function renewNGO(address ngo, uint256 newExpiryDate) external onlyOwner {
        NGOCredential storage c = credentials[ngo];
        require(c.exists, "Registry: NGO not registered");
        require(!c.revoked, "Registry: NGO revoked");
        require(newExpiryDate > block.timestamp, "Registry: expiry in past");

        c.expiryDate = newExpiryDate;
        emit NGORenewed(ngo, newExpiryDate);
    }

    function revokeNGO(address ngo, string calldata reason) external onlyOwner {
        NGOCredential storage c = credentials[ngo];
        require(c.exists, "Registry: NGO not registered");
        require(!c.revoked, "Registry: already revoked");

        c.revoked = true;
        c.revokedReason = reason;
        emit NGORevoked(ngo, reason, block.timestamp);
    }

    // --- Reads --------------------------------------------------------

    /**
     * @notice True only if the NGO is registered, not revoked, and not expired.
     * Campaign.sol calls this in submitEvidence() — that way a contract
     * deployed under an NGO whose credential lapsed simply stops working.
     */
    function isVerified(address ngo) external view returns (bool) {
        NGOCredential storage c = credentials[ngo];
        if (!c.exists) return false;
        if (c.revoked) return false;
        if (block.timestamp > c.expiryDate) return false;
        return true;
    }

    function getNGODetails(address ngo)
        external
        view
        returns (
            string memory name,
            string memory regNumber,
            uint8 riskTier,
            uint256 expiryDate,
            bool revoked
        )
    {
        NGOCredential storage c = credentials[ngo];
        require(c.exists, "Registry: NGO not registered");
        return (c.name, c.regNumber, uint8(c.riskTier), c.expiryDate, c.revoked);
    }
}
