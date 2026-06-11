// services/storage.service.js
//
// Section 13 — five-document package storage. Files live on the VPS under
// uploads/<category>/. Only the SHA-256 of the bundle goes on-chain.
//
// We deliberately do NOT use cloud storage (Section 5 stack note):
//   "Local VPS storage via multer. Documents stored on VPS. Only SHA-256
//    hash stored on blockchain. No Google Cloud Storage needed — simpler
//    for hackathon"

import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { env } from '../config/env.js'
import { hashFile } from '../utils/hash.utils.js'

const CATEGORIES = [
  'invoices',
  'agreements',
  'delivery-proof',
  'vendor-registration',
  'recipient-confirm',
  'ssm',
  'ngo-registration',
]

// Ensure upload subdirectories exist
function ensureDirs() {
  for (const c of CATEGORIES) {
    const dir = path.resolve(env.uploads.dir, c)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}
ensureDirs()

// multer setup — store with random filename to avoid collisions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = (req.body.category || file.fieldname || 'invoices')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
    const safeCategory = CATEGORIES.includes(category) ? category : 'invoices'
    const dir = path.resolve(env.uploads.dir, safeCategory)
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8)
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 10)
    cb(null, `${stamp}-${rand}${ext}`)
  },
})

export const uploader = multer({
  storage,
  limits: { fileSize: env.uploads.maxBytes },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx']
    const ext = path.extname(file.originalname).toLowerCase()
    if (!allowed.includes(ext)) {
      cb(new Error(`File type ${ext} not allowed`))
      return
    }
    cb(null, true)
  },
})

// Section 11 — NGO registration package (SSM/ROS certificate + audited
// financial statement). Always lands in uploads/ngo-registration/
// regardless of fieldname, since this form is not a "category" picker.
const ngoRegistrationStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(env.uploads.dir, 'ngo-registration')
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8)
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 10)
    cb(null, `${stamp}-${rand}${ext}`)
  },
})

export const ngoRegistrationUploader = multer({
  storage: ngoRegistrationStorage,
  limits: { fileSize: env.uploads.maxBytes },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg']
    const ext = path.extname(file.originalname).toLowerCase()
    if (!allowed.includes(ext)) {
      cb(new Error(`File type ${ext} not allowed`))
      return
    }
    cb(null, true)
  },
})

/** Return the absolute path stored on disk, normalised for the DB. */
export function relativeUploadPath(absPath) {
  return path.relative(path.resolve(env.uploads.dir), absPath).replace(/\\/g, '/')
}

/** Hash an individual file — used when an NGO uploads a single doc. */
export async function hashUploadedFile(filePath) {
  return hashFile(filePath)
}

export default { uploader, ngoRegistrationUploader, relativeUploadPath, hashUploadedFile }
