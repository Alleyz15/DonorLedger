// pages/admin-dashboard/admin-dashboard-page.js
//
// Bank Islam admin overview dashboard.
// Pulls stats from /admin/campaigns and /admin/alerts — no new backend
// endpoints needed. Derives NGO and campaign counts from existing data.

import { renderAppShell } from '../../components/layout/app-shell.js?v=20260609-logout-welcome'
import { getSession } from '../../services/auth-service.js'
import { getAdminCampaigns, getAdminAlerts } from '../../services/admin-service.js'

const session = getSession()
const shell = document.querySelector('#app-shell')

if (!session?.token) {
  window.location.href = './login.html'
} else if (session.role !== 'BANK_ADMIN') {
  renderAccessDenied()
} else {
  renderDashboard()
}

function renderDashboard() {
  const content = document.createElement('div')
  content.className = 'admin-dashboard-page'
  content.innerHTML = `
    <section class="admin-dashboard-hero">
      <div>
        <h1>Bank Islam Dashboard</h1>
        <p>Live overview of DonorLedger's NGO transparency platform.</p>
      </div>
      <div class="admin-dashboard-badge">
        <span class="admin-dashboard-live-dot" aria-hidden="true"></span>
        System Live — Monad Testnet
      </div>
    </section>

    <section class="admin-dashboard-stats" data-stats>
      ${renderStatCard('🏢', 'is-ngo',      'Total NGOs',        '—', 'pending KYC review')}
      ${renderStatCard('📋', 'is-campaign', 'Active Campaigns',  '—', 'currently live')}
      ${renderStatCard('🔔', 'is-alert',    'Unread Alerts',     '—', 'need attention')}
      ${renderStatCard('🔒', 'is-frozen',   'Frozen Campaigns',  '—', 'AI auto-frozen')}
    </section>

    <div class="admin-dashboard-row">
      <section class="admin-dashboard-panel">
        <header class="admin-dashboard-panel-header">
          <h2>Recent Alerts</h2>
          <a class="admin-dashboard-panel-link" href="./admin-alerts.html">View all →</a>
        </header>
        <ul class="admin-dashboard-alert-list" data-alert-list>
          <li class="admin-dashboard-empty">Loading alerts...</li>
        </ul>
      </section>

      <section class="admin-dashboard-panel">
        <header class="admin-dashboard-panel-header">
          <h2>Campaign Status</h2>
          <a class="admin-dashboard-panel-link" href="./admin-campaigns.html">Manage →</a>
        </header>
        <ul class="admin-dashboard-campaign-list" data-campaign-list>
          <li class="admin-dashboard-empty">Loading campaigns...</li>
        </ul>
      </section>
    </div>
  `

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-dashboard',
    searchPlaceholder: 'Search campaigns, NGOs, alerts...',
    content,
  })

  loadData(content)
}

async function loadData(content) {
  try {
    const [campaigns, alerts] = await Promise.all([
      getAdminCampaigns(session.token),
      getAdminAlerts(session.token),
    ])
    renderStats(content, campaigns, alerts)
    renderAlerts(content, alerts)
    renderCampaigns(content, campaigns)
  } catch (err) {
    content.querySelector('[data-stats]').innerHTML =
      `<p class="admin-dashboard-empty" style="grid-column:1/-1">Failed to load data: ${escapeHtml(err.message)}</p>`
  }
}

function renderStats(content, campaigns, alerts) {
  const ngoNames = new Set(campaigns.map((c) => c.ngo?.id).filter(Boolean))
  const active = campaigns.filter((c) => c.status === 'ACTIVE').length
  const frozen = campaigns.filter((c) => c.status === 'FROZEN').length
  const unreadAlerts = alerts.filter((a) => !a.delivered).length

  const statsEl = content.querySelector('[data-stats]')
  statsEl.innerHTML = `
    ${renderStatCard('🏢', 'is-ngo',      'Total NGOs',       String(ngoNames.size),   'with active campaigns')}
    ${renderStatCard('📋', 'is-campaign', 'Active Campaigns',  String(active),          'currently live')}
    ${renderStatCard('🔔', 'is-alert',    'Unread Alerts',     String(unreadAlerts),    'need attention')}
    ${renderStatCard('🔒', 'is-frozen',   'Frozen Campaigns',  String(frozen),          'AI auto-frozen')}
  `
}

function renderStatCard(icon, iconClass, label, value, sub) {
  return `
    <article class="admin-dashboard-stat">
      <div class="admin-dashboard-stat-icon ${iconClass}" aria-hidden="true">${icon}</div>
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(sub)}</em>
    </article>
  `
}

function renderAlerts(content, alerts) {
  const list = content.querySelector('[data-alert-list]')
  if (!alerts.length) {
    list.innerHTML = '<li class="admin-dashboard-empty">No alerts yet.</li>'
    return
  }
  list.innerHTML = alerts
    .slice(0, 6)
    .map((a) => {
      const dot = a.severity === 'CRITICAL' ? 'is-critical'
        : a.severity === 'WARNING' ? 'is-warning' : 'is-info'
      return `
        <li class="admin-dashboard-alert-item">
          <span class="admin-dashboard-alert-dot ${dot}" aria-hidden="true"></span>
          <div class="admin-dashboard-alert-body">
            <p class="admin-dashboard-alert-msg">${escapeHtml(a.message)}</p>
            <span class="admin-dashboard-alert-meta">
              ${escapeHtml(a.campaign?.name || 'System')} · ${formatDate(a.createdAt)}
            </span>
          </div>
        </li>
      `
    })
    .join('')
}

function renderCampaigns(content, campaigns) {
  const list = content.querySelector('[data-campaign-list]')
  if (!campaigns.length) {
    list.innerHTML = '<li class="admin-dashboard-empty">No campaigns yet.</li>'
    return
  }
  list.innerHTML = campaigns
    .slice(0, 6)
    .map((c) => {
      const statusMeta = getCampaignStatus(c.status)
      return `
        <li class="admin-dashboard-campaign-item">
          <div class="admin-dashboard-campaign-name">
            <strong>${escapeHtml(c.name)}</strong>
            <span>${escapeHtml(c.ngo?.name || c.causeType || '—')}</span>
          </div>
          <span class="admin-dashboard-campaign-status ${statusMeta.cls}">${escapeHtml(statusMeta.label)}</span>
        </li>
      `
    })
    .join('')
}

function getCampaignStatus(status) {
  if (status === 'ACTIVE')       return { label: 'Active',      cls: 'is-active' }
  if (status === 'FROZEN')       return { label: 'Frozen',      cls: 'is-frozen' }
  if (status === 'DRAFT')        return { label: 'Pending',     cls: 'is-draft' }
  if (status === 'UNDER_REVIEW') return { label: 'Under Review', cls: 'is-review' }
  return { label: String(status || '—').replaceAll('_', ' '), cls: 'is-default' }
}

function renderAccessDenied() {
  const panel = document.createElement('p')
  panel.style.padding = '48px'
  panel.textContent = 'This page is only available for Bank Admin accounts.'
  renderAppShell({ mount: shell, session, activeKey: 'admin-dashboard', content: panel })
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
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
