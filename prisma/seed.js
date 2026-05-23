// prisma/seed.js
//
// Seeds the first AdminUser so the team can log into /api/admin/login on
// a fresh deploy. Password hashing matches admin.routes.js: a per-row
// random salt joined with the sha256 of (salt + plaintext), stored as
// "salt:hash".
//
// Usage:
//   node prisma/seed.js          # seeds default admin
//   node prisma/seed.js --reset  # deletes existing admins first
//
// Production note: argon2id is the upgrade path (Section 21 — hackathon
// scope tradeoff). sha256 with a per-row salt is good enough for the demo
// because the demo VPS is single-tenant and the admin password rotates
// after the hackathon.

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../backend/src/utils/password.utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const prisma = new PrismaClient()

async function main() {
  const reset = process.argv.includes('--reset')
  if (reset) {
    const deleted = await prisma.adminUser.deleteMany({})
    console.log(`Reset — deleted ${deleted.count} admin rows`)
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@bankislam.demo'
  const password = process.env.SEED_ADMIN_PASSWORD || 'donorledger-demo-2026'
  const name = process.env.SEED_ADMIN_NAME || 'Bank Islam Super Admin'

  const existing = await prisma.adminUser.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin ${email} already exists — skipping (use --reset to recreate).`)
  } else {
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        name,
        role: 'SUPER_ADMIN',
      },
    })
    console.log('Created admin:', { id: admin.id, email: admin.email })
    console.log('Login password (rotate after the demo!):', password)
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
