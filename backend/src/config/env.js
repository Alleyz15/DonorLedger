// config/env.js
//
// SINGLE SOURCE OF TRUTH for environment variables (Section 16).
// No other file in the codebase is allowed to read process.env directly.
// This keeps misconfiguration loud — required vars fail fast at boot.

import dotenv from 'dotenv'

dotenv.config()

const required = (key) => {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

const optional = (key, fallback) => {
  const value = process.env[key]
  return value === undefined || value === '' ? fallback : value
}

const asInt = (value, fallback) => {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

const asBool = (value, fallback) => {
  if (value === undefined) return fallback
  return value === 'true' || value === '1'
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: asInt(optional('PORT', '3001'), 3001),
  frontendOrigin: optional('FRONTEND_ORIGIN', 'http://localhost:5173'),

  databaseUrl: required('DATABASE_URL'),

  redis: {
    host: optional('REDIS_HOST', '127.0.0.1'),
    port: asInt(optional('REDIS_PORT', '6379'), 6379),
    password: optional('REDIS_PASSWORD', undefined),
  },

  blockchain: {
    // Chain-agnostic — works with any EVM testnet. Default in
    // .env.example is Monad testnet (chainId 10143). For Sepolia switch
    // BLOCKCHAIN_RPC_URL + CHAIN_ID + BLOCKCHAIN_NETWORK_NAME together.
    rpcUrl: required('BLOCKCHAIN_RPC_URL'),
    chainId: asInt(optional('CHAIN_ID', '10143'), 10143),
    networkName: optional('BLOCKCHAIN_NETWORK_NAME', 'monad'),
    // Monad's public RPC is write/read capable but restrictive for live
    // event filters. Routes already reconcile DB writes after tx success,
    // so listeners are opt-in on Monad for demo stability.
    enableListeners: asBool(
      process.env.ENABLE_CONTRACT_LISTENERS,
      optional('BLOCKCHAIN_NETWORK_NAME', 'monad').toLowerCase() !== 'monad'
    ),

    // Section 9 — security separation. Bank Islam wallet has higher
    // privilege; server wallet runs continuously with lower privilege.
    bankIslamPrivateKey: required('BANK_ISLAM_PRIVATE_KEY'),
    serverWalletPrivateKey: required('SERVER_WALLET_PRIVATE_KEY'),

    registryAddress: optional('REGISTRY_CONTRACT_ADDRESS', ''),
    donorTrackerAddress: optional('DONOR_TRACKER_CONTRACT_ADDRESS', ''),
  },

  // Section 10, Step 5 — donor hash salt. NEVER log this.
  donorHashSalt: required('DONOR_HASH_SALT'),

  gemini: {
    apiKey: required('GEMINI_API_KEY'),
    model: optional('GEMINI_MODEL', 'gemini-2.5-flash'),
    // Section 14 — confidence thresholds from env, never hardcoded
    reviewThreshold: asInt(optional('AI_REVIEW_THRESHOLD', '60'), 60),
    freezeThreshold: asInt(optional('AI_FREEZE_THRESHOLD', '85'), 85),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '12h'),
  },

  macc: {
    webhookUrl: optional('MACC_WEBHOOK_URL', ''),
    webhookSecret: optional('MACC_WEBHOOK_SECRET', ''),
  },

  uploads: {
    dir: optional('UPLOAD_DIR', './uploads'),
    maxBytes: asInt(optional('MAX_UPLOAD_BYTES', '10485760'), 10 * 1024 * 1024),
  },

  demo: {
    enabled: asBool(process.env.DEMO_MODE, true),
    recipientConfirmDelayMs: asInt(
      optional('RECIPIENT_CONFIRM_DELAY_MS', '5000'),
      5000
    ),
  },
}

export default env
