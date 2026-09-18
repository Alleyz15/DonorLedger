// scripts/fix-evidence-alert-messages.js
//
// One-time data migration: rewrites old "New disbursement evidence submitted
// (category, RMamount)" alert messages already stored in the Alert table to
// the new formal sentence format used by evidence.routes.js going forward:
//   "New disbursement evidence has been submitted for the <Category> category,
//    amounting to RM<amount>."
//
// Safe to run multiple times — only rows still matching the old pattern are
// updated; rows already in the new format are skipped.
//
// Usage:
//   node scripts/fix-evidence-alert-messages.js

import * as dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const prisma = new PrismaClient()

const OLD_MESSAGE_RE = /^New disbursement evidence submitted \(([^,]+), RM([\d.,]+)\)$/

function toFormal(category, amount) {
  const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1)
  return `New disbursement evidence has been submitted for the ${formattedCategory} category, amounting to RM${amount}.`
}

async function main() {
  const alerts = await prisma.alert.findMany({
    where: { message: { startsWith: 'New disbursement evidence submitted (' } },
    select: { id: true, message: true },
  })

  if (!alerts.length) {
    console.log('No alerts found with the old message format. Nothing to do.')
    return
  }

  let updated = 0
  for (const alert of alerts) {
    const match = alert.message.match(OLD_MESSAGE_RE)
    if (!match) continue

    const [, category, amount] = match
    const newMessage = toFormal(category, amount)

    await prisma.alert.update({
      where: { id: alert.id },
      data: { message: newMessage },
    })

    console.log(`Updated alert ${alert.id}:`)
    console.log(`  before: ${alert.message}`)
    console.log(`  after:  ${newMessage}`)
    updated++
  }

  console.log(`\nDone. ${updated} of ${alerts.length} matching alert(s) updated.`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
