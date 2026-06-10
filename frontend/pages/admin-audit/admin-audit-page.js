// pages/admin-audit/admin-audit-page.js
//
// Immutable audit trail — every AI flag, Bank Islam decision, and
// campaign status change in a chronological timeline.
//
// This is what MACC would be shown during an investigation — the complete
// record that nobody can delete or alter because the key events are also
// anchored on-chain via Bank Islam's signatures.

import { renderAppShell } from '../../components/layout/app-shell.js?v=20260610-alert-popover'
import { getSession } from '../../services/auth-service.js'
import { getAdminAlerts, getAdminLedger } from '../../services/admin-service.js'

const session = getSession()
const shell = document.querySelector('#app-shell')

if (!session?.token) {
  window.location.href = './login.html'
} else if (session.role !== 'BANK_ADMIN') {
  renderAccessDenied()
} else {
  renderAuditPage()
}

function renderAuditPage() {
  const content = document.createElement('div')
  content.className = 'admin-audit-page'
  content.innerHTML = `
    <section class="admin-audit-hero">
      <h1>Audit Logs</h1>
      <p>Immutable record of every AI flag and Bank Islam decision. Cannot be deleted.</p>
    </section>

    <section class="admin-audit-panel">
      <header class="admin-audit-panel-header">
        <h2>Event Timeline</h2>
        <span class="admin-audit-count" data-count>Loading...</span>
      </header>
      <div class="admin-audit-timeline" data-timeline>
        <p class="admin-audit-empty">Loading audit trail...</p>
      </div>
    </section>

    <section class="admin-audit-panel">
      <header class="admin-audit-panel-header">
        <h2>Blockchain Ledger</h2>
        <span class="admin-audit-count" data-ledger-count>Loading...</span>
      </header>
      <p class="admin-audit-ledger-note">
        Every donation and campaign deployment recorded on-chain. Click any
        transaction to verify it directly on the explorer — nobody, including
        Bank Islam, can alter these records.
      </p>
      <div class="admin-audit-timeline" data-ledger>
        <p class="admin-audit-empty">Loading ledger...</p>
      </div>
    </section>
  `

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-audit-logs',
    searchPlaceholder: 'Search audit events...',
    content,
  })

  loadAudit(content)
  loadLedger(content)
}

async function loadAudit(content) {
  try {
    const alerts = await getAdminAlerts(session.token)
    content.querySelector('[data-count]').textContent = `${alerts.length} events`
    renderTimeline(content, alerts)
  } catch (err) {
    content.querySelector('[data-timeline]').innerHTML =
      `<p class="admin-audit-empty">Failed to load: ${escapeHtml(err.message)}</p>`
  }
}

async function loadLedger(content) {
  try {
    const ledger = await getAdminLedger(session.token)
    content.querySelector('[data-ledger-count]').textContent = `${ledger.length} on-chain records`
    renderLedger(content, ledger)
  } catch (err) {
    content.querySelector('[data-ledger]').innerHTML =
      `<p class="admin-audit-empty">Failed to load: ${escapeHtml(err.message)}</p>`
  }
}

function renderLedger(content, ledger) {
  const list = content.querySelector('[data-ledger]')
  if (!ledger.length) {
    list.innerHTML = '<p class="admin-audit-empty">No on-chain records yet.</p>'
    return
  }

  list.innerHTML = ledger.map(renderLedgerEntry).join('')
}

function renderLedgerEntry(entry) {
  const explorerUrl = `https://testnet.monadexplorer.com/tx/${encodeURIComponent(entry.txHash)}`

  if (entry.type === 'DONATION') {
    return `
      <article class="admin-audit-entry">
        <span class="admin-audit-dot is-info" aria-hidden="true"></span>
        <div class="admin-audit-entry-header">
          <span class="admin-audit-entry-time">${formatDate(entry.createdAt)}</span>
          <span class="admin-audit-entry-actor is-system">DONATION</span>
        </div>
        <p class="admin-audit-entry-msg">
          ${formatCurrency(entry.amount)} donated to
          ${escapeHtml(entry.campaignName || 'Unknown campaign')}
          (donor ${escapeHtml(formatHash(entry.donorHash))})
        </p>
        <a class="admin-audit-tx-link" href="${explorerUrl}" target="_blank" rel="noreferrer">
          ${escapeHtml(formatHash(entry.txHash))} ↗
        </a>
      </article>
    `
  }

  return `
    <article class="admin-audit-entry">
      <span class="admin-audit-dot is-info" aria-hidden="true"></span>
      <div class="admin-audit-entry-header">
        <span class="admin-audit-entry-time">${formatDate(entry.createdAt)}</span>
        <span class="admin-audit-entry-actor is-bank">CAMPAIGN DEPLOY</span>
      </div>
      <p class="admin-audit-entry-msg">
        Smart contract deployed for ${escapeHtml(entry.campaignName)}
        (${escapeHtml(formatHash(entry.contractAddress))})
      </p>
      <a class="admin-audit-tx-link" href="${explorerUrl}" target="_blank" rel="noreferrer">
        ${escapeHtml(formatHash(entry.txHash))} ↗
      </a>
    </article>
  `
}

function formatHash(value) {
  if (!value) return '—'
  const text = String(value)
  return text.length > 14 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function renderTimeline(content, alerts) {
  const timeline = content.querySelector('[data-timeline]')
  if (!alerts.length) {
    timeline.innerHTML = '<p class="admin-audit-empty">No audit events recorded yet.</p>'
    return
  }

  timeline.innerHTML = alerts.map(renderEntry).join('')
}

function renderEntry(alert) {
  const dotClass = alert.severity === 'CRITICAL' ? 'is-critical'
    : alert.severity === 'WARNING' ? 'is-warning' : 'is-info'

  // Determine actor from payload or message pattern
  const actor = detectActor(alert)
  const actorClass = actor === 'AI' ? 'is-ai'
    : actor === 'BANK ISLAM' ? 'is-bank' : 'is-system'

  const score = alert.payload?.confidenceScore
  const scoreText = score != null ? ` — AI Score: ${score}/100` : ''

  return `
    <article class="admin-audit-entry">
      <span class="admin-audit-dot ${dotClass}" aria-hidden="true"></span>
      <div class="admin-audit-entry-header">
        <span class="admin-audit-entry-time">${formatDate(alert.createdAt)}</span>
        <span class="admin-audit-entry-actor ${actorClass}">${actor}</span>
      </div>
      <p class="admin-audit-entry-msg">${escapeHtml(alert.message)}${escapeHtml(scoreText)}</p>
      ${alert.campaign
        ? `<span class="admin-audit-entry-campaign">Campaign: ${escapeHtml(alert.campaign.name)}</span>`
        : ''}
    </article>
  `
}

function detectActor(alert) {
  const msg = String(alert.message || '').toLowerCase()
  if (msg.includes('ai') || msg.includes('gemini') || msg.includes('auto-freeze')) return 'AI'
  if (msg.includes('bank islam') || msg.includes('approved') || msg.includes('rejected')) return 'BANK ISLAM'
  return 'SYSTEM'
}

function renderAccessDenied() {
  const p = document.createElement('p')
  p.style.padding = '48px'
  p.textContent = 'This page is only available for Bank Admin accounts.'
  renderAppShell({ mount: shell, session, activeKey: 'admin-audit-logs', content: p })
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(value))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
