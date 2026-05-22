// utils/hash.utils.js
//
// Hashing helpers — both flavours we need:
//
//  1. createDonorHash() — Section 10, Step 5. Anchors a donor's PII-bearing
//     PostgreSQL row to the pseudonymous on-chain identifier. Uses a salt
//     from env so a leaked DB alone cannot be brute-forced back to emails.
//
//  2. hashFile() / hashBuffer() — Section 13. Five-document evidence package
//     gets a single SHA-256 fingerprint that is sent on-chain. Actual file
//     bytes never leave the VPS.

import crypto from 'node:crypto'
import fs from 'node:fs'
import { env } from '../config/env.js'

/**
 * Compute the pseudonymous donor hash that goes on-chain.
 * Inputs: donor email, campaign id, donation timestamp (ms).
 */
export function createDonorHash(email, campaignId, timestampMs = Date.now()) {
  if (!email || !campaignId) {
    throw new Error('createDonorHash requires email and campaignId')
  }
  const payload = `${email.toLowerCase()}|${campaignId}|${timestampMs}|${env.donorHashSalt}`
  // 0x-prefixed so it can be used directly as a bytes32 on Solidity
  return '0x' + crypto.createHash('sha256').update(payload).digest('hex')
}

/** SHA-256 a buffer — used by storage.service.js for individual files. */
export function hashBuffer(buf) {
  return '0x' + crypto.createHash('sha256').update(buf).digest('hex')
}

/** SHA-256 a file on disk (streaming — safe for ~10MB upload cap). */
export function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve('0x' + hash.digest('hex')))
  })
}

/**
 * Hash a five-document package as a single fingerprint. Deterministic order:
 * the documents are sorted by category name first so the same five files
 * always produce the same hash regardless of upload order.
 */
export async function hashEvidencePackage(filePaths) {
  const ordered = Object.entries(filePaths)
    .filter(([, path]) => Boolean(path))
    .sort(([a], [b]) => a.localeCompare(b))

  const hash = crypto.createHash('sha256')
  for (const [category, path] of ordered) {
    hash.update(`${category}:`)
    const fileHash = await hashFile(path)
    hash.update(fileHash)
  }
  return '0x' + hash.digest('hex')
}
