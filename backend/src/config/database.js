// config/database.js
//
// PrismaClient singleton. Importing this from multiple services would
// otherwise open multiple connection pools and exhaust Postgres.

import { PrismaClient } from '@prisma/client'
import { env } from './env.js'

const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
})

// Graceful shutdown — close the pool when PM2 sends SIGTERM
const shutdown = async (signal) => {
  console.log(`[db] received ${signal}, disconnecting Prisma`)
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

export default prisma
