import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getNGOCampaign } from '../../services/campaign-service.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const campaignId = new URLSearchParams(window.location.search).get('id')
const canView = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canView) {
  renderAccessDenied()
} else {
  renderPage()
}

function renderPage() {
  const content = document.createElement('div')
  content.className = 'ngo-campaign-detail-page'
  content.innerHTML = '<p class="ngo-detail-state">Loading campaign...</p>'
  renderAppShell({ mount: shell, session, activeKey: 'my-campaigns', content })
  loadCampaign(content)
}

async function loadCampaign(content) {
  if (!campaignId) {
    content.innerHTML = '<p class="ngo-detail-state is-error">Campaign ID missing.</p>'
    return
  }
  try {
    const campaign = await getNGOCampaign(session.token, campaignId)
    content.innerHTML = renderDetail(campaign)
  } catch (err) {
    content.innerHTML = `<p class="ngo-detail-state is-error">${escapeHtml(err.message)}</p>`
  }
}

function renderDetail(c) {
  const raised  = Number(c.raisedAmount ?? 0)
  const target  = Number(c.targetAmount ?? 0)
  const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0
  const statusMeta = getStatusMeta(c.status)

  return `
    <a class="ngo-detail-back" href="./my-campaigns.html">← My Campaigns</a>

    <div class="ngo-detail-hero">
      <div>
        <h1>${escapeHtml(c.name)}</h1>
        <p class="ngo-detail-hero-sub">${escapeHtml(c.causeType || '—')}</p>
      </div>
      <span class="admin-campaign-status ${statusMeta.cls}">${statusMeta.label}</span>
    </div>

    <div class="ngo-detail-grid">

      <section class="ngo-detail-card">
        <h2>Funding Progress</h2>
        <div class="ngo-detail-progress-row">
          <span>RM ${formatNumber(raised)} raised</span>
          <strong>${percent}%</strong>
        </div>
        <div class="ngo-detail-progress-track">
          <div class="ngo-detail-progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="ngo-detail-stats">
          <div><span>Target</span><strong>RM ${formatNumber(target)}</strong></div>
          <div><span>Donors</span><strong>${formatNumber(c.donorCount || 0)}</strong></div>
          <div><span>End Date</span><strong>${formatDate(c.endDate)}</strong></div>
        </div>
      </section>

      <section class="ngo-detail-card">
        <h2>Fund Allocation</h2>
        ${renderAlloc('Direct Aid',  c.aidPercent,       'is-aid')}
        ${renderAlloc('Logistics',   c.logisticsPercent, 'is-logistics')}
        ${renderAlloc('Admin',       c.adminPercent,     'is-admin')}
        <p style="font-size:12px;color:#94a3b8;margin-top:8px;">
          Percentages are locked on-chain once the campaign is active.
        </p>
      </section>

      ${c.description ? `
        <section class="ngo-detail-card ngo-detail-card-full">
          <h2>Campaign Description</h2>
          <p class="ngo-detail-desc">${escapeHtml(c.description)}</p>
        </section>
      ` : ''}

      ${c.status === 'ACTIVE' ? `
        <div class="ngo-detail-actions-card">
          <a class="ngo-detail-btn" href="./submit-evidence.html?campaignId=${encodeURIComponent(c.id)}">
            Submit Disbursement Evidence
          </a>
          <a class="ngo-detail-btn is-secondary" href="./submit-vendor.html">
            Register New Vendor
          </a>
        </div>
      ` : ''}

    </div>
  `
}

function renderAlloc(label, value, cls) {
  const pct = Number(value || 0)
  return `
    <div class="ngo-detail-alloc-row">
      <span>${label}</span>
      <div class="ngo-detail-alloc-bar">
        <span class="${cls}" style="width:${pct}%"></span>
      </div>
      <span class="ngo-detail-alloc-pct">${pct}%</span>
    </div>
  `
}

function getStatusMeta(status) {
  if (status === 'DRAFT')        return { label: 'Pending',      cls: 'is-pending' }
  if (status === 'UNDER_REVIEW') return { label: 'Under Review', cls: 'is-review' }
  if (status === 'ACTIVE')       return { label: 'Active',       cls: 'is-active' }
  if (status === 'FROZEN')       return { label: 'Frozen',       cls: 'is-frozen' }
  if (status === 'REJECTED')     return { label: 'Rejected',     cls: 'is-rejected' }
  if (status === 'COMPLETED')    return { label: 'Completed',    cls: 'is-completed' }
  return { label: String(status || '—'), cls: '' }
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-MY').format(Number(value || 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function renderAccessDenied() {
  const p = document.createElement('p')
  p.style.padding = '48px'
  p.textContent = 'This page is only available for NGO accounts.'
  renderAppShell({ mount: shell, session, activeKey: 'my-campaigns', content: p })
}
