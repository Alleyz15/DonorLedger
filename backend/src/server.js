// server.js
//
// DonorLedger backend entry point.
//
// Boot order:
//   1. env + Prisma (database.js singleton attaches its own SIGTERM hook)
//   2. Express middleware (helmet, cors, json, morgan)
//   3. Routes
//   4. AI analysis Bull worker
//   5. On-chain contract listeners
//   6. Error handlers
//   7. listen()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { env } from './config/env.js'
import { walletAddresses } from './config/blockchain.js'
import { aiAnalysisQueue } from './config/queue.js'
import prisma from './config/database.js'

import donateRoutes from './routes/donate.routes.js'
import campaignRoutes from './routes/campaign.routes.js'
import evidenceRoutes from './routes/evidence.routes.js'
import disbursementRoutes from './routes/disbursement.routes.js'
import trackerRoutes from './routes/tracker.routes.js'
import ngoRoutes from './routes/ngo.routes.js'
import vendorRoutes from './routes/vendor.routes.js'
import adminRoutes from './routes/admin.routes.js'
import demoRoutes from './routes/demo.routes.js'
import authRoutes from './routes/auth.routes.js'

import {
  errorHandler,
  notFoundHandler,
} from './middleware/error.middleware.js'

import aiService from './services/ai.service.js'
import contractService from './services/contract.service.js'
import alertService from './services/alert.service.js'
import { startContractListeners } from './listeners/contract.listener.js'
import { DONOR_MILESTONE_TEXT } from './utils/format.utils.js'

const app = express()
const allowedFrontendOrigins = new Set([
  env.frontendOrigin,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

// ---- Hardening --------------------------------------------------------
app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedFrontendOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`))
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'))
}

// Generic rate limit — admin login + donor flows can be tightened later
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
)

// ---- Health -----------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: env.nodeEnv,
    serverWallet: walletAddresses.server,
    bankIslamWallet: walletAddresses.bankIslam,
    demoMode: env.demo.enabled,
  })
})

// ---- Routes -----------------------------------------------------------
app.use('/api/auth', authRoutes)
app.use('/api/donate', donateRoutes)
app.use('/api/campaign', campaignRoutes)
app.use('/api/evidence', evidenceRoutes)
app.use('/api/disbursement', disbursementRoutes)
app.use('/api/tracker', trackerRoutes)
app.use('/api/ngo', ngoRoutes)
app.use('/api/vendor', vendorRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/demo', demoRoutes)

// ---- Error handlers (must be last) -----------------------------------
app.use(notFoundHandler)
app.use(errorHandler)

// ---- AI worker (Bull) -------------------------------------------------
//
// Section 14 — evidence.routes pushes a job here so the HTTP response can
// return immediately. Worker handles: Gemini call → score routing →
// optional on-chain pauseCampaign + MACC alert.
function startAiWorker() {
  aiAnalysisQueue.process('analyse-disbursement', 2, async (job) => {
    const { evidenceId } = job.data

    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { campaign: true, vendor: true },
    })
    if (!evidence) {
      console.warn(`[ai-worker] evidence ${evidenceId} not found`)
      return
    }

    const historical = await prisma.evidence.findMany({
      where: { campaignId: evidence.campaignId, NOT: { id: evidence.id } },
      select: { id: true, vendorId: true, amount: true, status: true },
    })

    const ai = await aiService.analyseDisbursement({
      campaign: evidence.campaign,
      evidence,
      vendor: evidence.vendor,
      historicalDisbursements: historical,
    })

    // Persist AI output first — never lose the analysis even if downstream fails
    await prisma.evidence.update({
      where: { id: evidence.id },
      data: {
        aiConfidenceScore: ai.confidenceScore,
        aiReason: ai.reason,
        aiRecommendation: ai.recommendation,
        aiFlaggedPatterns: ai.flaggedPatterns,
      },
    })

    const route = aiService.routeOnScore(ai.confidenceScore)

    if (route === 'AUTO_FREEZE') {
      // Section 14 — auto-freeze + MACC alert
      try {
        const { txHash } = await contractService.pauseCampaign(
          evidence.campaign.contractAddress,
          `AI auto-freeze: ${ai.reason}`
        )
        await prisma.campaign.update({
          where: { id: evidence.campaignId },
          data: { status: 'FROZEN', pausedReason: ai.reason },
        })
        await prisma.evidence.update({
          where: { id: evidence.id },
          data: { status: 'AUTO_FROZEN' },
        })
        await alertService.notifyMACC({
          campaignId: evidence.campaignId,
          evidenceId: evidence.id,
          message: 'AI auto-freeze triggered — MACC notified',
          payload: {
            confidenceScore: ai.confidenceScore,
            reason: ai.reason,
            flaggedPatterns: ai.flaggedPatterns,
            pauseTx: txHash,
          },
        })

        // Donor-facing update — plain language only (Section 14)
        const donations = await prisma.donation.findMany({
          where: { campaignId: evidence.campaignId },
          select: { donorHash: true },
        })
        for (const d of donations) {
          try {
            await contractService.updateDonorMilestone({
              donorHash: d.donorHash,
              milestone: 'UNDER_REVIEW',
              description: DONOR_MILESTONE_TEXT.UNDER_REVIEW,
            })
          } catch (e) {
            console.warn('[ai-worker] tracker update failed:', e.message)
          }
        }
      } catch (e) {
        console.error('[ai-worker] auto-freeze failed:', e.message)
      }
    } else if (route === 'MANUAL_REVIEW') {
      await prisma.evidence.update({
        where: { id: evidence.id },
        data: { status: 'PENDING_REVIEW' },
      })
      await alertService.notifyBankIslam({
        campaignId: evidence.campaignId,
        evidenceId: evidence.id,
        severity: 'WARNING',
        message: `AI flagged for review (score ${ai.confidenceScore}): ${ai.reason}`,
        payload: { flaggedPatterns: ai.flaggedPatterns },
      })
    } else {
      // ALLOW — still surface to dashboard at INFO so Bank Islam keeps oversight
      await prisma.evidence.update({
        where: { id: evidence.id },
        data: { status: 'PENDING_REVIEW' },
      })
      await alertService.notifyBankIslam({
        campaignId: evidence.campaignId,
        evidenceId: evidence.id,
        severity: 'INFO',
        message: `AI cleared disbursement (score ${ai.confidenceScore})`,
        payload: {},
      })
    }
  })

  console.log('[ai-worker] listening on queue: ai-analysis')
}

// ---- Boot --------------------------------------------------------------
async function boot() {
  startAiWorker()

  try {
    await startContractListeners()
  } catch (e) {
    console.warn('[boot] contract listener init failed:', e.message)
  }

  app.listen(env.port, () => {
    console.log(
      `[boot] DonorLedger backend listening on :${env.port} (env=${env.nodeEnv})`
    )
    console.log(`[boot] server wallet     : ${walletAddresses.server}`)
    console.log(`[boot] bank islam wallet : ${walletAddresses.bankIslam}`)
    if (env.demo.enabled) {
      console.log('[boot] DEMO MODE active — /api/demo/* endpoints are live')
    }
  })
}

boot().catch((err) => {
  console.error('[boot] fatal:', err)
  process.exit(1)
})

export default app
