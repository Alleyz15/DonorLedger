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

function renderDetail(campaign) {
  const raised = Number(campaign.raisedAmount ?? 0)
  const target = Number(campaign.targetAmount ?? 0)
  const fundingPercent = getPercent(raised, target)
  const statusMeta = getStatusMeta(campaign.status)

  return `
    <a class="ngo-detail-back" href="./my-campaigns.html">
      ${icon('arrowLeft')}
      Back to My Campaigns
    </a>

    <section class="ngo-detail-hero">
      <div class="ngo-detail-hero-left">
        <span class="ngo-detail-eyebrow">${escapeHtml(campaign.causeType || 'Campaign')}</span>
        <h1>${escapeHtml(campaign.name)}</h1>
        <p class="ngo-detail-hero-sub">Campaign ID: ${escapeHtml(campaign.id)}</p>
      </div>
      <div class="ngo-detail-hero-right">
        <span class="ngo-detail-status ${statusMeta.cls}">${statusMeta.label}</span>
      </div>
    </section>

    <div class="ngo-detail-grid">
      <section class="ngo-detail-card">
        <div class="ngo-detail-card-header">
          <span class="ngo-detail-card-icon" aria-hidden="true">${icon('money')}</span>
          <h2>Funding Progress</h2>
        </div>
        <div class="ngo-detail-progress-row">
          <div class="ngo-detail-raised">
            <span class="ngo-detail-raised-label">Total Raised</span>
            <span class="ngo-detail-raised-value">${formatMoney(raised)}</span>
          </div>
          <span class="ngo-detail-percent-badge">${fundingPercent}%</span>
        </div>
        <div class="ngo-detail-progress-track">
          <div class="ngo-detail-progress-fill" style="width:${fundingPercent}%"></div>
        </div>
        <div class="ngo-detail-stats">
          <div><span>Target</span><strong>${formatMoney(target)}</strong></div>
          <div><span>Donors</span><strong>${formatNumber(campaign.donorCount || 0)}</strong></div>
          <div><span>End Date</span><strong>${formatDate(campaign.endDate)}</strong></div>
        </div>
      </section>

      <section class="ngo-detail-card">
        <div class="ngo-detail-card-header">
          <span class="ngo-detail-card-icon" aria-hidden="true">${icon('pie')}</span>
          <h2>Fund Allocation</h2>
        </div>
        ${renderAllocation('Direct Aid', campaign.aidPercent, 'is-aid')}
        ${renderAllocation('Logistics', campaign.logisticsPercent, 'is-logistics')}
        ${renderAllocation('Admin', campaign.adminPercent, 'is-admin')}
        <div class="ngo-detail-allocation-legend">
          <span><i class="is-aid"></i>Direct Aid</span>
          <span><i class="is-logistics"></i>Logistics</span>
          <span><i class="is-admin"></i>Admin</span>
        </div>
        <p class="ngo-detail-onchain-note">
          ${icon('info')}
          Percentages are locked on-chain once the campaign is active.
        </p>
      </section>

      ${renderClaimSummary(campaign.claimSummary, raised, target)}

      <section class="ngo-detail-card ngo-detail-card-full">
        <div class="ngo-detail-card-header">
          <span class="ngo-detail-card-icon" aria-hidden="true">${icon('document')}</span>
          <h2>Campaign Description</h2>
        </div>
        <p class="ngo-detail-desc">${escapeHtml(campaign.description || 'No campaign description provided.')}</p>
      </section>
    </div>
  `
}

function renderAllocation(label, value, cls) {
  const percent = clampPercent(Number(value || 0))
  return `
    <div class="ngo-detail-allocation-row">
      <span>${escapeHtml(label)}</span>
      <div class="ngo-detail-allocation-bar">
        <span class="${cls}" style="width:${percent}%"></span>
      </div>
      <strong>${percent}%</strong>
    </div>
  `
}

function renderClaimSummary(summary = {}, raisedAmount = 0, targetAmount = 0) {
  const totalReceived = Number(summary.totalReceived ?? raisedAmount ?? 0)
  const approved = Number(summary.approvedClaimAmount ?? 0)
  const pending = Number(summary.pendingClaimAmount ?? 0)
  const rejected = Number(summary.rejectedClaimAmount ?? 0)
  const reserved = Number(summary.reservedAmount ?? approved + pending)
  const available = Number(summary.availableAmount ?? Math.max(totalReceived - reserved, 0))
  const approvedPercent = getPercent(approved, totalReceived)
  const pendingPercent = getPercent(pending, totalReceived)
  const rejectedPercent = Math.min(
    getPercent(rejected, totalReceived),
    Math.max(0, 100 - approvedPercent - pendingPercent)
  )
  const reservedPercent = getPercent(reserved, totalReceived)

  return `
    <section class="ngo-detail-claim-card">
      <div class="ngo-detail-card-header">
        <span class="ngo-detail-card-icon" aria-hidden="true">${icon('claim')}</span>
        <h2>Claim Summary</h2>
      </div>

      <div class="ngo-detail-claim-metrics">
        ${renderClaimMetric({
          cls: 'is-total',
          iconName: 'briefcase',
          label: 'Total Received',
          value: formatMoney(totalReceived),
          sub: targetAmount > 0 ? `${getPercent(totalReceived, targetAmount)}% of target` : 'From donors',
        })}
        ${renderClaimMetric({
          cls: 'is-approved',
          iconName: 'check',
          label: 'Claimed / Approved',
          value: formatMoney(approved),
          sub: `${approvedPercent}% of received`,
        })}
        ${renderClaimMetric({
          cls: 'is-pending',
          iconName: 'clock',
          label: 'Pending Review',
          value: formatMoney(pending),
          sub: `${pendingPercent}% of received`,
        })}
        ${renderClaimMetric({
          cls: 'is-rejected',
          iconName: 'xCircle',
          label: 'Rejected',
          value: formatMoney(rejected),
          sub: `${getPercent(rejected, totalReceived)}% of received`,
        })}
        ${renderClaimMetric({
          cls: 'is-available',
          iconName: 'money',
          label: 'Available to Claim',
          value: formatMoney(available),
          sub: available > 0 ? 'Ready for disbursement' : 'No claimable balance',
        })}
      </div>

      <div class="ngo-detail-claim-progress-section">
        <div class="ngo-detail-claim-progress-header">
          <span>Funding Utilisation Breakdown</span>
          <div class="ngo-detail-claim-legend">
            <span><i class="is-approved"></i>Approved</span>
            <span><i class="is-pending"></i>Pending</span>
            <span><i class="is-rejected"></i>Rejected</span>
            <span><i class="is-available"></i>Available</span>
          </div>
        </div>
        <div class="ngo-detail-claim-track">
          <span class="ngo-detail-segment is-approved" style="width:${approvedPercent}%"></span>
          <span class="ngo-detail-segment is-pending" style="width:${pendingPercent}%"></span>
          <span class="ngo-detail-segment is-rejected" style="width:${rejectedPercent}%"></span>
        </div>
        <div class="ngo-detail-claim-footer">
          <span>${formatMoney(available)} is available for new claims. Rejected claims do not reduce available funds.</span>
          <strong>${reservedPercent}% reserved or claimed</strong>
        </div>
      </div>
    </section>
  `
}

function renderClaimMetric({ cls, iconName, label, value, sub }) {
  return `
    <div class="ngo-detail-claim-metric ${cls}">
      <span class="ngo-detail-metric-icon" aria-hidden="true">${icon(iconName)}</span>
      <span class="ngo-detail-metric-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <span class="ngo-detail-metric-sub">${escapeHtml(sub)}</span>
    </div>
  `
}

function getStatusMeta(status) {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', cls: 'is-draft' }
    case 'UNDER_REVIEW':
      return { label: 'Under Review', cls: 'is-review' }
    case 'ACTIVE':
      return { label: 'Active', cls: 'is-active' }
    case 'FROZEN':
      return { label: 'Frozen', cls: 'is-frozen' }
    case 'REJECTED':
      return { label: 'Rejected', cls: 'is-rejected' }
    case 'COMPLETED':
      return { label: 'Completed', cls: 'is-completed' }
    default:
      return { label: String(status || '-'), cls: '' }
  }
}

function icon(name) {
  const icons = {
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    pie: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"/></svg>',
    claim: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>',
    document: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2M12 12v4m-2-2h4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>',
  }
  return icons[name] || ''
}

function getPercent(value, total) {
  const safeTotal = Number(total || 0)
  if (safeTotal <= 0) return 0
  return clampPercent(Math.round((Number(value || 0) / safeTotal) * 100))
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatMoney(value) {
  return `RM ${formatNumber(value)}`
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-MY').format(Number(value || 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderAccessDenied() {
  const content = document.createElement('div')
  content.className = 'ngo-campaign-detail-page'
  content.innerHTML = '<p class="ngo-detail-state is-error">This page is only available for NGO accounts.</p>'
  renderAppShell({ mount: shell, session, activeKey: 'my-campaigns', content })
}
