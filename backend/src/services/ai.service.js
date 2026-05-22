// services/ai.service.js
//
// Section 14 — Gemini fraud detection.
//
// Gemini receives ONLY anonymised financial data (no email, no MyKad, no
// names). The output is a confidence score that drives three routing tiers:
//
//   below reviewThreshold (60)   → flag, funds flow normally
//   reviewThreshold..freezeThreshold (60..85)  → flag + manual Bank Islam approve
//   above freezeThreshold (85)   → AUTO-FREEZE: contract.service pauseCampaign()
//                                  + MACC webhook fires
//
// Thresholds come from env (Section 14 — never hardcode).
// Response is parsed defensively — Gemini sometimes wraps JSON in markdown.

import { geminiModel } from '../config/gemini.js'
import { env } from '../config/env.js'

const SYSTEM_PROMPT = `You are an Islamic finance compliance and anti-fraud
analyst reviewing NGO disbursement requests for DonorLedger, operated under
Bank Islam Malaysia oversight. Evaluate the request against documented
Malaysian NGO fraud patterns (RM230M misappropriation case 2024-2026,
Gaza fundraising fraud 2025, MACC influencer cases).

Specific patterns to weigh:
  - Admin costs exceeding declared percentage by more than 10%
  - Large payment to vendor registered less than 6 months ago
  - Funds idle more than 30 days then a sudden large withdrawal
  - Same vendor receiving from multiple unrelated NGO campaigns
  - Invoice amount inconsistent with Malaysian market rates
  - Multiple transfers to same wallet within 24 hours
  - Donations still being collected after campaign end date

Respond with JSON ONLY in this exact shape:
{
  "confidenceScore": <integer 0-100, higher = more suspicious>,
  "reason": "<one sentence, plain English>",
  "recommendation": "approve" | "review" | "freeze",
  "flaggedPatterns": [ "<short pattern name>", ... ]
}

Do not include markdown code fences. Do not include extra commentary.`

function safeParse(text) {
  // Section 14 — Gemini sometimes wraps in ```json ... ```
  const cleaned = (text || '').replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return {
      confidenceScore: 50,
      reason: 'Analysis unavailable — manual review required',
      recommendation: 'review',
      flaggedPatterns: [],
    }
  }
}

function deriveRecommendation(score) {
  if (score >= env.gemini.freezeThreshold) return 'freeze'
  if (score >= env.gemini.reviewThreshold) return 'review'
  return 'approve'
}

/**
 * Build the anonymised financial profile that goes to Gemini.
 * Never include: donor emails, donor names, MyKad, raw bank account numbers.
 */
function buildAnalysisInput({
  campaign,
  evidence,
  vendor,
  historicalDisbursements = [],
}) {
  return {
    campaign: {
      causeType: campaign.causeType,
      declaredAllocation: {
        aid: campaign.aidPercent,
        logistics: campaign.logisticsPercent,
        admin: campaign.adminPercent,
      },
      targetAmount: Number(campaign.targetAmount),
      raisedAmount: Number(campaign.raisedAmount),
      endDateISO: campaign.endDate,
      status: campaign.status,
    },
    disbursementRequest: {
      category: evidence.category, // 'aid' | 'logistics' | 'admin'
      amount: Number(evidence.amount),
      packageHashOnChain: evidence.packageHash,
    },
    vendor: {
      serviceType: vendor.serviceType,
      registeredMonthsAgo: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(vendor.createdAt).getTime()) /
            (1000 * 60 * 60 * 24 * 30)
        )
      ),
      bankIslamApproved: vendor.status === 'APPROVED',
    },
    historicalContext: {
      priorDisbursementsThisCampaign: historicalDisbursements.length,
      cumulativeReleasedToVendor: historicalDisbursements
        .filter((d) => d.vendorId === vendor.id && d.status === 'APPROVED')
        .reduce((s, d) => s + Number(d.amount), 0),
    },
  }
}

/**
 * Call Gemini. Returns { confidenceScore, reason, recommendation,
 * flaggedPatterns }. Always safe to consume — never throws on parse error.
 */
export async function analyseDisbursement(payload) {
  const input = buildAnalysisInput(payload)

  let raw
  try {
    const result = await geminiModel.generateContent([
      SYSTEM_PROMPT,
      `Disbursement request to analyse:\n${JSON.stringify(input, null, 2)}`,
    ])
    raw = result.response.text()
  } catch (e) {
    console.error('[ai] Gemini call failed:', e.message)
    return {
      confidenceScore: 50,
      reason: 'AI service unavailable — manual review required',
      recommendation: 'review',
      flaggedPatterns: [],
      raw: null,
    }
  }

  const parsed = safeParse(raw)

  // Clamp + normalise — never trust the model blindly
  const score = Math.max(
    0,
    Math.min(100, Math.round(Number(parsed.confidenceScore) || 0))
  )
  const recommendation =
    ['approve', 'review', 'freeze'].includes(parsed.recommendation)
      ? parsed.recommendation
      : deriveRecommendation(score)

  return {
    confidenceScore: score,
    reason: String(parsed.reason || 'No reason provided').slice(0, 500),
    recommendation,
    flaggedPatterns: Array.isArray(parsed.flaggedPatterns)
      ? parsed.flaggedPatterns.slice(0, 10).map((p) => String(p).slice(0, 100))
      : [],
    raw,
  }
}

/** Routing helper — used by evidence flow */
export function routeOnScore(score) {
  if (score >= env.gemini.freezeThreshold) return 'AUTO_FREEZE'
  if (score >= env.gemini.reviewThreshold) return 'MANUAL_REVIEW'
  return 'ALLOW'
}

export default { analyseDisbursement, routeOnScore }
