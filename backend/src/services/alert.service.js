// services/alert.service.js
//
// Two destinations (Section 14 — "Who sees what"):
//
//  1. BANK_ISLAM_DASHBOARD — internal queue row, fetched by admin UI
//  2. MACC_WEBHOOK — outbound POST when auto-freeze fires (Section 21:
//     "demo without breaking" — the MACC URL can be webhook.site for the
//     hackathon, and we sign the body with a shared secret).
//
// All alert payloads are persisted in the Alert table first so a network
// failure to the MACC endpoint never loses the audit trail.

import crypto from 'node:crypto'
import prisma from '../config/database.js'
import { env } from '../config/env.js'

function signPayload(payload) {
  if (!env.macc.webhookSecret) return null
  return crypto
    .createHmac('sha256', env.macc.webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex')
}

async function persistAlert({
  campaignId,
  evidenceId,
  channel,
  severity,
  message,
  payload,
}) {
  return prisma.alert.create({
    data: { campaignId, evidenceId, channel, severity, message, payload },
  })
}

/** Bank Islam dashboard — internal flag, always persisted. */
export async function notifyBankIslam({
  campaignId,
  evidenceId,
  severity = 'WARNING',
  message,
  payload = {},
}) {
  const alert = await persistAlert({
    campaignId,
    evidenceId,
    channel: 'BANK_ISLAM_DASHBOARD',
    severity,
    message,
    payload,
  })
  // Mark delivered immediately — the dashboard polls the Alert table.
  await prisma.alert.update({
    where: { id: alert.id },
    data: { delivered: true, deliveredAt: new Date() },
  })
  return alert
}

/**
 * MACC webhook — fired only when AI auto-freeze hits (>= freezeThreshold).
 * Section 14: payload includes complete fund flow, AI score, all Bank Islam
 * approval signatures so far, plus on-chain references.
 */
export async function notifyMACC({
  campaignId,
  evidenceId,
  message,
  payload,
}) {
  const alert = await persistAlert({
    campaignId,
    evidenceId,
    channel: 'MACC_WEBHOOK',
    severity: 'CRITICAL',
    message,
    payload,
  })

  if (!env.macc.webhookUrl) {
    console.warn('[alert] MACC_WEBHOOK_URL not configured — skipping send')
    return alert
  }

  const body = { id: alert.id, message, payload, createdAt: alert.createdAt }
  const signature = signPayload(body)

  try {
    const res = await fetch(env.macc.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(signature ? { 'x-donorledger-signature': signature } : {}),
      },
      body: JSON.stringify(body),
    })
    await prisma.alert.update({
      where: { id: alert.id },
      data: { delivered: res.ok, deliveredAt: res.ok ? new Date() : null },
    })
    if (!res.ok) {
      console.error(`[alert] MACC webhook returned ${res.status}`)
    }
  } catch (e) {
    console.error('[alert] MACC webhook delivery failed:', e.message)
  }
  return alert
}

export default { notifyBankIslam, notifyMACC }
