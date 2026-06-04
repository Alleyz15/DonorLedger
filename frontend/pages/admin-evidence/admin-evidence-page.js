// pages/admin-evidence/admin-evidence-page.js
//
// Bank Islam evidence review queue — shows PENDING_REVIEW, AUTO_FROZEN, and
// APPROVED disbursement requests with their Gemini AI analysis scores.
//
// Bank Islam approves → POST /api/disbursement/approve (Bank Islam wallet signs on-chain)
// Bank Islam rejects  → POST /api/disbursement/reject  (on-chain rejection event)
// Bank Islam confirms → POST /api/demo/recipient-confirm (Section 13 SMS confirmation)
//                       Fires CONFIRMED + COMPLETED milestones on donor tracker
//
// The AI market price analysis (priceAnalysis field) is shown here so
// reviewers can immediately see if an NGO is over-charging for supplies.

import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getAdminEvidence, approveDisbursement, rejectDisbursement } from '../../services/admin-service.js'
import { API_BASE_URL } from '../../config/api-config.js'

// Strip /api suffix — uploaded files are served at the root /uploads path
const FILES_BASE = API_BASE_URL.replace(/\/api$/, '')

const session = getSession()
const shell = document.querySelector('#app-shell')
let evidenceCache = []

if (!session?.token) {
  window.location.href = './login.html'
} else if (session.role !== 'BANK_ADMIN') {
  renderAccessDenied()
} else {
  renderEvidencePage()
}

function renderEvidencePage() {
  const content = document.createElement('div')
  content.className = 'admin-evidence-page'
  content.innerHTML = `
    <section class="admin-evidence-hero">
      <div>
        <h1>Evidence Reviews</h1>
        <p>Approve or reject NGO disbursement requests after AI analysis.</p>
      </div>
    </section>

    <div class="admin-evidence-summary" data-summary>
      <div class="admin-evidence-badge">
        <strong data-count-pending>—</strong>
        <span>Pending Review</span>
      </div>
      <div class="admin-evidence-badge">
        <strong data-count-frozen>—</strong>
        <span>AI Auto-Frozen</span>
      </div>
      <div class="admin-evidence-badge">
        <strong data-count-approved>—</strong>
        <span>Awaiting Recipient Confirm</span>
      </div>
    </div>

    <div class="admin-evidence-list" data-list>
      <p class="admin-evidence-empty">Loading evidence queue...</p>
    </div>
  `

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-evidence-reviews',
    searchPlaceholder: 'Search evidence, campaigns...',
    content,
  })

  content.addEventListener('click', (e) => handleAction(e, content))
  loadEvidence(content)
}

async function loadEvidence(content) {
  try {
    evidenceCache = await getAdminEvidence(session.token)
    updateSummary(content)
    renderList(content)
  } catch (err) {
    content.querySelector('[data-list]').innerHTML =
      `<p class="admin-evidence-empty">Failed to load: ${escapeHtml(err.message)}</p>`
  }
}

function updateSummary(content) {
  const pending  = evidenceCache.filter((e) => e.status === 'PENDING_REVIEW').length
  const frozen   = evidenceCache.filter((e) => e.status === 'AUTO_FROZEN').length
  const approved = evidenceCache.filter((e) => e.status === 'APPROVED').length
  content.querySelector('[data-count-pending]').textContent  = String(pending)
  content.querySelector('[data-count-frozen]').textContent   = String(frozen)
  const approvedEl = content.querySelector('[data-count-approved]')
  if (approvedEl) approvedEl.textContent = String(approved)
}

function renderList(content) {
  const list = content.querySelector('[data-list]')
  if (!evidenceCache.length) {
    list.innerHTML = '<p class="admin-evidence-empty">No evidence pending review. Queue is clear.</p>'
    return
  }
  list.innerHTML = evidenceCache.map(renderCard).join('')
}

function renderCard(ev) {
  const isFrozen   = ev.status === 'AUTO_FROZEN'
  const isApproved = ev.status === 'APPROVED'
  const cardClass  = isFrozen ? 'is-frozen' : isApproved ? 'is-approved' : 'is-review'
  const statusLabel = isFrozen ? 'AI Frozen' : isApproved ? 'Approved — Awaiting SMS Confirm' : 'Pending Review'
  const statusClass = isFrozen ? 'is-frozen' : isApproved ? 'is-approved' : 'is-review'

  const score = ev.aiConfidenceScore
  const scoreClass = score >= 85 ? 'is-freeze' : score >= 60 ? 'is-review' : 'is-ok'
  const patterns = Array.isArray(ev.aiFlaggedPatterns) ? ev.aiFlaggedPatterns : []

  // Try to extract priceAnalysis from nested payload or direct field
  const priceAnalysis = ev.priceAnalysis || null

  return `
    <article class="admin-evidence-card ${cardClass}" data-evidence-id="${escapeHtml(ev.id)}">
      <div class="admin-evidence-card-header">
        <div class="admin-evidence-card-title">
          <strong>${escapeHtml(ev.campaign?.name || 'Unknown Campaign')}</strong>
          <span>${escapeHtml(ev.vendor?.name || '—')} · ${escapeHtml(ev.vendor?.serviceType || '—')}</span>
        </div>
        <span class="admin-evidence-status ${statusClass}">${statusLabel}</span>
      </div>

      <dl class="admin-evidence-card-body">
        <div class="admin-evidence-detail">
          <dt>Category</dt>
          <dd>${escapeHtml(String(ev.category || '—').toUpperCase())}</dd>
        </div>
        <div class="admin-evidence-detail">
          <dt>Amount Requested</dt>
          <dd>RM ${formatAmount(ev.amount)}</dd>
        </div>
        <div class="admin-evidence-detail">
          <dt>Submitted</dt>
          <dd>${formatDate(ev.createdAt)}</dd>
        </div>
      </dl>

      ${score !== null ? `
        <div class="admin-evidence-ai">
          <div class="admin-evidence-ai-header">
            <span class="admin-evidence-ai-label">Gemini AI Analysis</span>
            <span class="admin-evidence-score ${scoreClass}">Score: ${score}/100</span>
          </div>
          ${ev.aiReason ? `<p class="admin-evidence-ai-reason">${escapeHtml(ev.aiReason)}</p>` : ''}
          ${priceAnalysis ? `<p class="admin-evidence-price-note">📊 ${escapeHtml(priceAnalysis)}</p>` : ''}
          ${patterns.length ? `
            <div class="admin-evidence-patterns">
              ${patterns.map((p) => `<span class="admin-evidence-pattern">${escapeHtml(p)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${renderDocuments(ev.documents)}

      <div class="admin-evidence-actions">
        ${isApproved ? `
          <button class="admin-evidence-btn is-confirm" type="button"
            data-action="confirm" data-id="${escapeHtml(ev.id)}" data-campaign-id="${escapeHtml(ev.campaign?.id || '')}">
            ✅ Confirm Beneficiary Receipt
          </button>
          <p class="admin-evidence-confirm-note">
            Simulates Bank Islam SMS to beneficiary — independent of NGO. Updates donor tracker to COMPLETED.
          </p>
        ` : `
          <button class="admin-evidence-btn is-approve" type="button"
            data-action="approve" data-id="${escapeHtml(ev.id)}">
            Approve Disbursement
          </button>
          <button class="admin-evidence-btn is-reject" type="button"
            data-action="reject" data-id="${escapeHtml(ev.id)}">
            Reject
          </button>
        `}
      </div>
    </article>
  `
}

async function handleAction(e, content) {
  const btn = e.target.closest('[data-action]')
  if (!btn || btn.disabled) return

  const id         = btn.dataset.id
  const campaignId = btn.dataset.campaignId
  const action     = btn.dataset.action
  btn.disabled = true

  try {
    if (action === 'approve') {
      await approveDisbursement(session.token, id)
    } else if (action === 'reject') {
      const reason = window.prompt('Reason for rejecting this disbursement?', 'Rejected after Bank Islam review')
      if (!reason) { btn.disabled = false; return }
      await rejectDisbursement(session.token, id, reason)
    } else if (action === 'confirm') {
      // Section 13 — Bank Islam independently SMS-confirms beneficiary receipt.
      // This fires CONFIRMED + COMPLETED milestones on donor tracker (steps 4 & 5).
      // Independent of the NGO — Bank Islam goes directly to beneficiary.
      btn.textContent = '⏳ Sending SMS confirmation...'
      await triggerRecipientConfirm(campaignId)

      // Replace the entire actions div in-place — do NOT reload the evidence
      // list because the DB status stays APPROVED (no CONFIRMED enum value yet)
      // and a reload would just bring the button back.
      const actionsDiv = btn.closest('.admin-evidence-actions')
      if (actionsDiv) {
        actionsDiv.innerHTML = `
          <p class="admin-evidence-confirm-note" style="color:#16a34a;font-weight:600;">
            ✅ Beneficiary confirmed receipt. Donor tracker updated to COMPLETED.
          </p>
        `
      }

      // Also update the card status badge to reflect completion
      const card = btn.closest('article')
      if (card) {
        const badge = card.querySelector('.admin-evidence-status')
        if (badge) {
          badge.textContent = 'Completed'
          badge.className = 'admin-evidence-status is-confirmed'
        }
      }
      return
    }
    await loadEvidence(content)
  } catch (err) {
    alert(`Action failed: ${err.message}`)
    btn.disabled = false
  }
}

// POST /api/demo/recipient-confirm — Bank Islam SMS confirmation shortcut.
// No auth header needed — this is the demo simulation endpoint.
async function triggerRecipientConfirm(campaignId) {
  const res = await fetch(`${API_BASE_URL}/demo/recipient-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// Render the 5 NGO-submitted documents as clickable links.
// Gate 4 — Bank Islam human review (Section 15 Limitation 2).
function renderDocuments(docs) {
  if (!docs) return ''
  const labels = {
    ssmDoc:           'SSM Registration',
    serviceAgreement: 'Service Agreement',
    invoice:          'Itemised Invoice',
    deliveryProof:    'Delivery Proof',
    recipientConfirm: 'Recipient Confirmation',
  }
  const links = Object.entries(labels)
    .map(([key, label]) => {
      const url = docs[key]
      if (!url) {
        return `<span class="admin-evidence-doc admin-evidence-doc-missing" title="${label}">
          ${label} <em>not uploaded</em>
        </span>`
      }
      return `<a class="admin-evidence-doc" href="${FILES_BASE}${escapeHtml(url)}"
          target="_blank" rel="noreferrer" title="Open ${label}">
          📄 ${label}
        </a>`
    })
    .join('')

  return `
    <div class="admin-evidence-docs">
      <p class="admin-evidence-docs-label">NGO-Submitted Documents (5 required)</p>
      <div class="admin-evidence-docs-list">${links}</div>
    </div>
  `
}

function renderAccessDenied() {
  const p = document.createElement('p')
  p.style.padding = '48px'
  p.textContent = 'This page is only available for Bank Admin accounts.'
  renderAppShell({ mount: shell, session, activeKey: 'admin-evidence-reviews', content: p })
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(value))
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
