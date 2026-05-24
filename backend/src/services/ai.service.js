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

// Malaysian market price benchmarks (2025-2026 verified rates).
// Embedded in the Gemini prompt so the model can detect price inflation fraud —
// the pattern the user identified: "NGO buys food at RM5/kg when market is RM3/kg".
// No new DB fields needed — AI evaluates proportionality from amount + vendor type.
const MALAYSIA_MARKET_PRICE_REFERENCE = `
MALAYSIAN AID SUPPLY MARKET PRICE BENCHMARKS (2025-2026 bulk/wholesale):
Flag any disbursement where implied unit cost exceeds the upper bound by >40%.

FOOD SUPPLIES (bulk NGO pricing):
  Rice (beras putih):               RM 2.00 – 2.80 /kg
  Cooking oil (minyak masak):       RM 3.00 – 4.20 /litre
  Flour (tepung gandum):            RM 1.60 – 2.50 /kg
  Sugar (gula):                     RM 2.80 – 3.20 /kg
  Canned sardines (425g tin):       RM 3.50 – 5.00 /tin
  Instant noodles (mi segera):      RM 0.50 – 0.90 /pack
  Bottled water 500ml:              RM 0.40 – 0.80 /bottle
  Bottled water 1.5L:               RM 1.00 – 1.80 /bottle
  Ready-made food pack (nasi):      RM 4.50 – 8.00 /pack
  3-day emergency kit (1 person):   RM 35 – 60 /kit

HOUSEHOLD / RELIEF ITEMS:
  Blanket:                          RM 25 – 55 /unit
  Sleeping mat (tikar):             RM 8 – 20 /unit
  Emergency tent (4-person):        RM 180 – 350 /unit
  Tarpaulin (10x12ft):              RM 30 – 70 /unit
  Basic hygiene kit:                RM 20 – 45 /kit
  Sanitary pad pack:                RM 6 – 12 /pack
  Baby diapers (pack of 40):        RM 25 – 45 /pack

LOGISTICS / TRANSPORT:
  Van rental (1 day):               RM 200 – 400 /day
  3-tonne lorry rental (1 day):     RM 400 – 700 /day
  Fuel per km (petrol):             RM 0.50 – 0.80 /km
  Delivery driver daily rate:       RM 80 – 150 /day
  Warehouse storage per month:      RM 500 – 2,000 /unit

MEDICAL AID:
  Basic first-aid kit:              RM 30 – 80 /kit
  N95 masks (box of 20):            RM 18 – 35 /box
  Paracetamol (100-count box):      RM 8 – 15 /box
  ORS sachet:                       RM 1.50 – 3.00 /sachet
  Paramedic daily rate (contract):  RM 150 – 300 /day

ADMINISTRATIVE / LABOUR:
  General volunteer coordinator:    RM 80 – 150 /day
  Professional event coordinator:   RM 200 – 400 /day
  Social media / content creator:   RM 500 – 2,000 /campaign
  Photography/videography:          RM 500 – 1,500 /day
  Printing/flyers (per 1000):       RM 80 – 200

PROPORTIONALITY RULES:
  1. Derive implied unit cost where possible from amount + category + vendor type.
  2. Flag PRICE_INFLATION if unit price exceeds upper bound by more than 40%.
  3. A FOOD disbursement of RM100,000 for a campaign raising RM100,000 targeting
     100 beneficiaries implies RM1,000 per person — grossly over the RM60 kit max.
  4. For ADMIN: compare disbursement as % of raised amount vs campaign's declared adminPercent.
  5. For LOGISTICS: cross-check transport cost per beneficiary against realistic routes.
`

const SYSTEM_PROMPT = `You are an Islamic finance compliance and anti-fraud
analyst reviewing NGO disbursement requests for DonorLedger, operated under
Bank Islam Malaysia oversight. Evaluate the request against documented
Malaysian NGO fraud patterns (RM230M misappropriation case 2024-2026,
Gaza fundraising fraud 2025, MACC influencer cases 2025).

FRAUD PATTERN CHECKLIST — evaluate all eight, then produce a weighted score:
  1. PRICE_INFLATION     — Invoice unit prices exceed Malaysian market rates by >40%
                           (see benchmark table below — this is the #1 fraud signal)
  2. ADMIN_OVER_DECLARED — Admin costs exceed campaign's declared adminPercent by >10pp
  3. NEW_VENDOR          — Large payment (>RM10,000) to vendor registered <6 months ago
  4. IDLE_THEN_SPIKE     — Funds idle >30 days then sudden large withdrawal
  5. VENDOR_CONCENTRATION — Same vendor receiving from multiple unrelated campaigns
  6. RAPID_TRANSFERS     — Multiple transfers to same wallet within 24 hours
  7. CAMPAIGN_EXPIRED    — Donations still collected after campaign end date
  8. DISPROPORTIONATE    — Total amount grossly inconsistent with campaign size & cause

${MALAYSIA_MARKET_PRICE_REFERENCE}

Respond with JSON ONLY in this exact shape (no markdown fences, no extra text):
{
  "confidenceScore": <integer 0-100, higher = more suspicious>,
  "reason": "<one sentence in plain English — name the specific pattern if triggered>",
  "recommendation": "approve" | "review" | "freeze",
  "flaggedPatterns": [ "<short pattern name>", ... ],
  "priceAnalysis": "<one sentence on market price alignment, or null if not applicable>"
}

Scoring guide:
  0-30   Clean — normal Malaysian NGO aid operation
  31-59  Minor anomalies — note, allow funds to flow
  60-84  Significant concern — Bank Islam manual review required before release
  85-100 Strong fraud indicators — auto-freeze immediately, notify MACC`

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
    // Price analysis from the Malaysian market benchmark check (Section 14 enhancement)
    priceAnalysis: parsed.priceAnalysis
      ? String(parsed.priceAnalysis).slice(0, 500)
      : null,
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
