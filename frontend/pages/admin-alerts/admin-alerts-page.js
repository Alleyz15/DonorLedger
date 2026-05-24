// pages/admin-alerts/admin-alerts-page.js
//
// Bank Islam alerts page — shows all AI fraud flags, manual review notes,
// and MACC-level auto-freeze events. Uses GET /admin/alerts.
//
// Donors never see this page. Scores are for Bank Islam eyes only.

import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getAdminAlerts } from '../../services/admin-service.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
let allAlerts = []
let activeFilter = 'ALL'

if (!session?.token) {
  window.location.href = './login.html'
} else if (session.role !== 'BANK_ADMIN') {
  renderAccessDenied()
} else {
  renderAlertsPage()
}

function renderAlertsPage() {
  const content = document.createElement('div')
  content.className = 'admin-alerts-page'
  content.innerHTML = `
    <section class="admin-alerts-hero">
      <div>
        <h1>Alerts</h1>
        <p>AI fraud flags and Bank Islam review notifications.</p>
      </div>
    </section>

    <div class="admin-alerts-filters" data-filters>
      ${renderFilterBtn('ALL', 'All Alerts', true)}
      ${renderFilterBtn('CRITICAL', 'Critical')}
      ${renderFilterBtn('WARNING', 'Warning')}
      ${renderFilterBtn('INFO', 'Info')}
    </div>

    <div class="admin-alerts-list" data-list>
      <p class="admin-alerts-empty">Loading alerts...</p>
    </div>
  `

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-alerts',
    searchPlaceholder: 'Search alerts...',
    content,
  })

  content.querySelector('[data-filters]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]')
    if (!btn) return
    activeFilter = btn.dataset.filter
    content.querySelectorAll('[data-filter]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.filter === activeFilter)
    )
    renderList(content)
  })

  loadAlerts(content)
}

async function loadAlerts(content) {
  try {
    allAlerts = await getAdminAlerts(session.token)
    renderList(content)
  } catch (err) {
    content.querySelector('[data-list]').innerHTML =
      `<p class="admin-alerts-empty">Failed to load alerts: ${escapeHtml(err.message)}</p>`
  }
}

function renderList(content) {
  const list = content.querySelector('[data-list]')
  const filtered = activeFilter === 'ALL'
    ? allAlerts
    : allAlerts.filter((a) => a.severity === activeFilter)

  if (!filtered.length) {
    list.innerHTML = `<p class="admin-alerts-empty">No ${activeFilter === 'ALL' ? '' : activeFilter.toLowerCase() + ' '}alerts found.</p>`
    return
  }

  list.innerHTML = filtered.map(renderAlertCard).join('')
}

function renderAlertCard(alert) {
  const sevClass = alert.severity === 'CRITICAL' ? 'is-critical'
    : alert.severity === 'WARNING' ? 'is-warning' : 'is-info'

  const payload = alert.payload || {}
  const score = payload.confidenceScore ?? null
  const patterns = Array.isArray(payload.flaggedPatterns) ? payload.flaggedPatterns : []
  const priceAnalysis = payload.priceAnalysis || null

  let scoreBadge = ''
  if (score !== null) {
    const scoreClass = score >= 85 ? 'is-freeze' : score >= 60 ? 'is-review' : 'is-ok'
    scoreBadge = `<span class="admin-alerts-score ${scoreClass}">AI Score: ${score}/100</span>`
  }

  return `
    <article class="admin-alerts-card ${sevClass}">
      <div class="admin-alerts-card-top">
        <span class="admin-alerts-card-severity ${sevClass}">${escapeHtml(alert.severity)}</span>
        <span class="admin-alerts-card-time">${formatDate(alert.createdAt)}</span>
      </div>

      <p class="admin-alerts-card-msg">${escapeHtml(alert.message)}</p>

      <div class="admin-alerts-card-meta">
        ${alert.campaign ? `<span>Campaign: <strong>${escapeHtml(alert.campaign.name)}</strong></span>` : ''}
        ${alert.evidence ? `<span>Evidence: <strong>${escapeHtml(alert.evidence.category)} — RM ${formatAmount(alert.evidence.amount)}</strong></span>` : ''}
        ${scoreBadge}
      </div>

      ${priceAnalysis ? `<div class="admin-alerts-card-meta" style="margin-top:8px"><span>📊 ${escapeHtml(priceAnalysis)}</span></div>` : ''}

      ${patterns.length ? `
        <div class="admin-alerts-card-patterns">
          ${patterns.map((p) => `<span class="admin-alerts-pattern-tag">${escapeHtml(p)}</span>`).join('')}
        </div>
      ` : ''}
    </article>
  `
}

function renderFilterBtn(filter, label, active = false) {
  return `<button class="admin-alerts-filter-btn ${active ? 'is-active' : ''}" data-filter="${filter}" type="button">${escapeHtml(label)}</button>`
}

function renderAccessDenied() {
  const p = document.createElement('p')
  p.style.padding = '48px'
  p.textContent = 'This page is only available for Bank Admin accounts.'
  renderAppShell({ mount: shell, session, activeKey: 'admin-alerts', content: p })
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
