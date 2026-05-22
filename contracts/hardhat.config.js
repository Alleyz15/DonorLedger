// hardhat.config.js
//
// Sepolia testnet only (Section 5 — "Completely free. Sepolia ETH from
// faucet costs nothing"). Solidity 0.8.20 matches what every contract
// pins via pragma.
//
// Deployer key: SERVER_WALLET_PRIVATE_KEY is used to deploy infrastructure
// contracts (Registry, DonorTracker). Per-campaign Campaign.sol is
// deployed at runtime by the backend signed with BANK_ISLAM_PRIVATE_KEY,
// because Bank Islam is the owner of every Campaign instance.

import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Load the root .env (one level up from contracts/)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || ''
const SERVER_WALLET_PRIVATE_KEY = process.env.SERVER_WALLET_PRIVATE_KEY || ''
const BANK_ISLAM_PRIVATE_KEY = process.env.BANK_ISLAM_PRIVATE_KEY || ''
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ''

const accounts = [SERVER_WALLET_PRIVATE_KEY, BANK_ISLAM_PRIVATE_KEY].filter(
  (k) => k && /^0x[0-9a-fA-F]{64}$/.test(k)
)

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Hardhat's default EVM version is fine for Sepolia.
    },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts,
    },
  },
  etherscan: {
    apiKey: { sepolia: ETHERSCAN_API_KEY },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
}
