// hardhat.config.js
//
// Default network: Monad testnet (chainId 10143, MON as gas token).
// The contracts are pure EVM Solidity 0.8.20 + OpenZeppelin v5 — they
// compile and run unchanged on Sepolia (11155111), Polygon Amoy, BSC
// testnet, etc. To switch networks, change BLOCKCHAIN_RPC_URL +
// CHAIN_ID in `.env` and use `--network monad` or add another block here.
//
// Deployer key: SERVER_WALLET_PRIVATE_KEY deploys infrastructure
// contracts (Registry + DonorTracker). Per-campaign Campaign.sol is
// deployed at runtime by the backend signed with BANK_ISLAM_PRIVATE_KEY,
// because Bank Islam is the owner of every Campaign instance.

import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Load the root .env (one level up from contracts/)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const BLOCKCHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC_URL || ''
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '10143', 10)
const SERVER_WALLET_PRIVATE_KEY = process.env.SERVER_WALLET_PRIVATE_KEY || ''
const BANK_ISLAM_PRIVATE_KEY = process.env.BANK_ISLAM_PRIVATE_KEY || ''

const accounts = [SERVER_WALLET_PRIVATE_KEY, BANK_ISLAM_PRIVATE_KEY].filter(
  (k) => k && /^0x[0-9a-fA-F]{64}$/.test(k)
)

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},

    // Default Monad testnet — matches the .env defaults
    monad: {
      url: BLOCKCHAIN_RPC_URL || 'https://testnet-rpc.monad.xyz',
      chainId: CHAIN_ID || 10143,
      accounts,
    },

    // Generic "testnet" alias — reads whatever .env says
    testnet: {
      url: BLOCKCHAIN_RPC_URL,
      chainId: CHAIN_ID,
      accounts,
    },

    // Kept as a legacy option in case you switch back to Sepolia later
    sepolia: {
      url: BLOCKCHAIN_RPC_URL,
      chainId: 11155111,
      accounts,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
}
