import { renderAppShell } from '../../components/layout/app-shell.js?v=20260610-alert-popover'
import { getSession } from '../../services/auth-service.js'
import { getAdminCampaignDetail, approveCampaign, rejectCampaign } from '../../services/admin-service.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const campaignId = new URLSearchParams(window.location.search).get('id')
let content = null

if (!session?.token) {
  window.location.href = './login.html'
} else if (session.role !== 'BANK_ADMIN') {
  renderAccessDenied()
} else {
  renderPage()
}

function renderPage() {
  content = document.createElement('div')
  content.className = 'admin-campaign-detail-page'
  content.innerHTML = '<p class="admin-detail-state">Loading...</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-campaigns',
    searchPlaceholder: 'Search campaigns...',
    content,
  })
  loadCampaign()
}

async function loadCampaign() {
  if (!campaignId) {
    content.innerHTML = '<p class="admin-detail-state is-error">Campaign ID missing.</p>'
    return
  }
  try {
    const campaign = await getAdminCampaignDetail(session.token, campaignId)
    content.innerHTML = renderDetail(campaign)
    bindActions(campaign)
  } catch (err) {
    content.innerHTML = `<p class="admin-detail-state is-error">${escapeHtml(err.message)}</p>`
  }
}

function renderDetail(c) {
  const raised  = Number(c.raisedAmount ?? 0)
  const target  = Number(c.targetAmount ?? 0)
  const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0
  const vendors = Array.isArray(c.vendors) ? c.vendors : []
  const statusMeta = getStatusMeta(c.status)

  return `
    <a class="admin-detail-back" href="./admin-campaigns.html">← Back to Campaigns</a>

    <div class="admin-detail-hero">
      <div>
        <h1>${escapeHtml(c.name)}</h1>
        <p class="admin-detail-hero-sub">${escapeHtml(c.causeType || '—')} · by ${escapeHtml(c.ngo?.name || '—')}</p>
      </div>
      <span class="admin-campaign-status ${statusMeta.className}">${statusMeta.label}</span>
    </div>

    <div class="admin-detail-grid">

      <section class="admin-detail-card">
        <h2>NGO Information</h2>
        <dl class="admin-detail-dl">
          <div><dt>Organisation</dt><dd>${escapeHtml(c.ngo?.name || '—')}</dd></div>
          <div><dt>Registration No.</dt><dd>${escapeHtml(c.ngo?.registrationNum || '—')}</dd></div>
          <div><dt>Risk Tier</dt><dd>${escapeHtml(String(c.ngo?.riskTier ?? '—'))}</dd></div>
          <div><dt>KYC Status</dt><dd>${escapeHtml(c.ngo?.status || '—')}</dd></div>
        </dl>
      </section>

      <section class="admin-detail-card">
        <h2>Funding</h2>
        <div class="admin-detail-progress-row">
          <span>RM ${formatNumber(raised)} raised</span>
          <strong>${percent}%</strong>
        </div>
        <div class="admin-detail-progress-track">
          <div class="admin-detail-progress-fill" style="width:${percent}%"></div>
        </div>
        <dl class="admin-detail-dl">
          <div><dt>Target</dt><dd>RM ${formatNumber(target)}</dd></div>
          <div><dt>Donors</dt><dd>${formatNumber(c.donorCount || 0)}</dd></div>
          <div><dt>End Date</dt><dd>${formatDate(c.endDate)}</dd></div>
          <div><dt>Contract</dt><dd class="admin-detail-mono">${c.contractAddress ? truncate(c.contractAddress) : 'Not deployed yet'}</dd></div>
        </dl>
      </section>

      <section class="admin-detail-card">
        <h2>Fund Allocation</h2>
        ${renderAlloc('Direct Aid',  c.aidPercent,        'is-aid')}
        ${renderAlloc('Logistics',   c.logisticsPercent,  'is-logistics')}
        ${renderAlloc('Admin',       c.adminPercent,      'is-admin')}
        <p style="font-size:12px;color:#94a3b8;margin-top:8px;">
          Percentages are locked on-chain once the campaign is approved.
        </p>
      </section>

      <section class="admin-detail-card">
        <h2>Approved Vendors (${vendors.length})</h2>
        ${vendors.length ? `
          <ul class="admin-detail-vendor-list">
            ${vendors.map(v => `
              <li class="admin-detail-vendor-item">
                <strong>${escapeHtml(v.name)}</strong>
                <span>${escapeHtml(v.serviceType || '—')}</span>
              </li>
            `).join('')}
          </ul>
        ` : '<p class="admin-detail-empty">No vendors linked yet.</p>'}
      </section>

      ${c.description ? `
        <section class="admin-detail-card admin-detail-card-full">
          <h2>Campaign Description</h2>
          <p class="admin-detail-desc">${escapeHtml(c.description)}</p>
        </section>
      ` : ''}

      ${c.status === 'UNDER_REVIEW' ? `
        <section class="admin-detail-decision-card admin-detail-card-full">
          <h2>Bank Islam Decision</h2>
          <p class="admin-detail-decision-note">
            Review all details above. Approving will deploy Campaign.sol on Monad testnet,
            lock the allocation percentages on-chain, and make this campaign live for donations.
          </p>
          <div class="admin-detail-decision-row" data-action-row>
            <button class="admin-campaign-action is-approve" type="button" data-action="approve">
              Approve Campaign
            </button>
            <button class="admin-campaign-action is-reject" type="button" data-action="reject">
              Reject Campaign
            </button>
          </div>
          <p class="admin-detail-status-msg" data-status-msg></p>
        </section>
      ` : ''}

    </div>
  `
}

function renderAlloc(label, value, cls) {
  const pct = Number(value || 0)
  return `
    <div class="admin-detail-alloc-row">
      <span>${label}</span>
      <div class="admin-detail-alloc-bar">
        <span class="${cls}" style="width:${pct}%"></span>
      </div>
      <span class="admin-detail-alloc-pct">${pct}%</span>
    </div>
  `
}

function bindActions(campaign) {
  const row = content.querySelector('[data-action-row]')
  if (!row) return

  row.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]')
    if (!btn || btn.disabled) return
    const action = btn.dataset.action
    const msg = content.querySelector('[data-status-msg]')

    if (action === 'reject') {
      const reason = window.prompt('Reason for rejecting this campaign?')
      if (!reason) return
      try {
        btn.disabled = true
        msg.textContent = 'Rejecting...'
        await rejectCampaign(session.token, campaign.id, reason)
        msg.textContent = '✅ Campaign rejected.'
        row.innerHTML = ''
        await loadCampaign()
      } catch (err) {
        msg.textContent = `Error: ${err.message}`
        btn.disabled = false
      }
      return
    }

    try {
      row.querySelectorAll('button').forEach(b => b.disabled = true)
      msg.textContent = '⏳ Deploying contract on Monad and activating campaign...'
      await approveCampaign(session.token, campaign.id)
      msg.textContent = '✅ Campaign approved and live on Monad.'
      await loadCampaign()
    } catch (err) {
      msg.textContent = `Error: ${err.message}`
      row.querySelectorAll('button').forEach(b => b.disabled = false)
    }
  })
}

function getStatusMeta(status) {
  if (status === 'DRAFT')        return { label: 'Pending',      className: 'is-pending' }
  if (status === 'UNDER_REVIEW') return { label: 'Under Review', className: 'is-review' }
  if (status === 'ACTIVE')       return { label: 'Active',       className: 'is-active' }
  if (status === 'FROZEN')       return { label: 'Frozen',       className: 'is-frozen' }
  if (status === 'REJECTED')     return { label: 'Rejected',     className: 'is-rejected' }
  if (status === 'COMPLETED')    return { label: 'Completed',    className: 'is-completed' }
  return { label: String(status || '—'), className: '' }
}

function truncate(str) {
  return str ? `${str.slice(0, 10)}...${str.slice(-6)}` : '—'
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
  p.textContent = 'This page is only available for Bank Admin accounts.'
  renderAppShell({ mount: shell, session, activeKey: 'admin-campaigns', content: p })
}
