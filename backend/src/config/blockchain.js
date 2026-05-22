// config/blockchain.js
//
// ethers.js v6 — provider plus the two server-side wallets (Section 9).
//
// SECURITY: Two wallets exist intentionally. If the bridge server is ever
// compromised the attacker only gets `serverWallet` — they cannot approve
// disbursements or unpause campaigns. Those require `bankIslamWallet`,
// which is only loaded into the request lifecycle when a Bank Islam admin
// endpoint is hit.
//
// All ethers.Contract instances must be created in contract.service.js
// (Section 16 — single point for contract calls).

import { ethers } from 'ethers'
import { env } from './env.js'

export const provider = new ethers.JsonRpcProvider(
  env.blockchain.sepoliaRpcUrl,
  {
    chainId: env.blockchain.chainId,
    name: 'sepolia',
  }
)

// Lower-privilege bridge wallet — runs continuously. Signs:
//   Campaign.donate(), DonorTracker.updateMilestone(), Campaign.pauseCampaign()
export const serverWallet = new ethers.Wallet(
  env.blockchain.serverWalletPrivateKey,
  provider
)

// Higher-privilege wallet — loaded when admin acts. Signs:
//   Registry.addNGO / renewNGO / revokeNGO
//   Campaign.approveDisbursement / rejectDisbursement
//   Campaign.unpauseCampaign / addApprovedVendor
// Production note: this would be an HSM (Section 9).
export const bankIslamWallet = new ethers.Wallet(
  env.blockchain.bankIslamPrivateKey,
  provider
)

// Public addresses are safe to log. Private keys NEVER touch logs.
export const walletAddresses = {
  server: serverWallet.address,
  bankIslam: bankIslamWallet.address,
}

export default {
  provider,
  serverWallet,
  bankIslamWallet,
  walletAddresses,
}
