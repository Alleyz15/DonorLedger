// prisma/seed.js
//
// Seeds demo login accounts. Password hashing matches backend auth routes:
// a per-row random salt joined with the sha256 of (salt + plaintext), stored
// as "salt:hash".

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../backend/src/utils/password.utils.js'
import { SAMPLE_USER_PASSWORD, sampleUsers } from './sample-users.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const prisma = new PrismaClient()

async function main() {
  const reset = process.argv.includes('--reset')
  if (reset) {
    const deletedAdmins = await prisma.adminUser.deleteMany({})
    console.log(`Reset - deleted ${deletedAdmins.count} admin rows`)
    const deletedUsers = await prisma.user.deleteMany({})
    console.log(`Reset - deleted ${deletedUsers.count} user rows`)
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@bankislam.demo'
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || 'donorledger-demo-2026'
  const adminName = process.env.SEED_ADMIN_NAME || 'Bank Islam Super Admin'

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      name: adminName,
      role: 'SUPER_ADMIN',
    },
  })
  console.log('Seeded admin:', { id: admin.id, email: admin.email })
  console.log('Admin password:', adminPassword)

  for (const sample of sampleUsers) {
    const user = await prisma.user.upsert({
      where: { email: sample.email },
      update: {
        name: sample.name,
        role: sample.role,
        isActive: true,
      },
      create: {
        name: sample.name,
        email: sample.email,
        role: sample.role,
        passwordHash: hashPassword(SAMPLE_USER_PASSWORD),
      },
    })
    console.log('Seeded user:', { email: user.email, role: user.role })
  }

  console.log('Sample user password:', SAMPLE_USER_PASSWORD)
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
