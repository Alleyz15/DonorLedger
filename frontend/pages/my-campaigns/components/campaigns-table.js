export function createCampaignsTable() {
  const section = document.createElement('section')
  section.className = 'campaigns-panel'
  section.innerHTML = `
    <div class="campaigns-panel-header">
      <div></div>
      <a class="campaigns-primary-action" href="./start-campaign.html">
        <span aria-hidden="true">+</span>
        Start New Campaign
      </a>
    </div>
    <div class="campaigns-table-wrap">
      <table class="campaigns-table">
        <thead>
          <tr>
            <th>Campaign Name</th>
            <th>End Date</th>
            <th>Raised / Target</th>
            <th>Pending Evidence</th>
            <th>AI Alerts</th>
            <th>Actions</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody data-campaign-rows>
          <tr>
            <td class="campaigns-loading-cell" colspan="7">Loading campaigns...</td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer class="campaigns-pagination">
      <span data-campaign-count>Showing 0 entries</span>
      <div>
        <button type="button" disabled>&lt;</button>
        <button class="is-active" type="button">1</button>
        <button type="button" disabled>2</button>
        <button type="button" disabled>3</button>
        <button type="button" disabled>&gt;</button>
      </div>
    </footer>
  `
  return section
}

export function renderCampaignRows(table, campaigns) {
  const rows = table.querySelector('[data-campaign-rows]')
  if (!rows) return

  if (!campaigns.length) {
    rows.innerHTML = `
      <tr>
        <td class="campaigns-empty-cell" colspan="7">No campaigns created yet.</td>
      </tr>
    `
    updateCount(table, 0)
    return
  }

  rows.innerHTML = campaigns.map(renderCampaignRow).join('')
  updateCount(table, campaigns.length)
}

export function renderCampaignError(table, message) {
  const rows = table.querySelector('[data-campaign-rows]')
  if (!rows) return
  rows.innerHTML = `
    <tr>
      <td class="campaigns-error-cell" colspan="7">${escapeHtml(message)}</td>
    </tr>
  `
}

function renderCampaignRow(campaign) {
  const { label, statusClass } = getCampaignStatusMeta(campaign.status)
  const aiAlerts = getAIAlertCount(campaign.status)

  return `
    <tr>
      <td>
        <div class="campaign-title-cell">
          <span class="campaign-logo-placeholder"></span>
          <div>
            <strong>${escapeHtml(campaign.name)}</strong>
            <span>${escapeHtml(campaign.causeType)}</span>
          </div>
        </div>
      </td>
      <td>${campaign.endDate ? formatDate(campaign.endDate) : '-'}</td>
      <td>${formatMoney(campaign.raisedAmount)} /<br />${formatMoney(campaign.targetAmount)}</td>
      <td><span class="campaign-count-pill">${Number(campaign.pendingEvidenceCount || 0)}</span></td>
      <td><span class="campaign-count-pill ${aiAlerts > 0 ? 'is-alert' : ''}">${aiAlerts}</span></td>
      <td>${renderCampaignAction(campaign)}</td>
      <td><span class="campaign-status ${statusClass}">${escapeHtml(label)}</span></td>
    </tr>
  `
}

function renderCampaignAction(campaign) {
  const availableAmount = Number(campaign.availableAmount ?? campaign.raisedAmount ?? 0)

  // Draft — NGO can still edit before Bank Islam sees it
  if (campaign.status === 'DRAFT') {
    return `
      <a class="campaign-action-button" href="./start-campaign.html?campaignId=${encodeURIComponent(campaign.id)}">
        Edit Draft
      </a>
    `
  }

  // Submitted for review — awaiting Bank Islam approval, no edits allowed
  if (campaign.status === 'UNDER_REVIEW') {
    return '<span class="campaign-action-pending">⏳ Awaiting Bank Islam approval</span>'
  }

  // Campaign frozen — show frozen message
  if (campaign.status === 'FROZEN') {
    return '<span class="campaign-action-frozen">⚠ Campaign frozen — contact Bank Islam</span>'
  }

  // Active campaign with funds available — submit evidence
  if (['VERIFIED', 'ACTIVE', 'APPROVED'].includes(campaign.status) && availableAmount > 0) {
    return `
      <a class="campaign-action-button" href="./submit-evidence.html?campaignId=${encodeURIComponent(campaign.id)}">
        Submit Evidence
      </a>
    `
  }

  // Active but fully released
  if (['VERIFIED', 'ACTIVE', 'APPROVED', 'COMPLETED'].includes(campaign.status) && availableAmount <= 0) {
    return '<span class="campaign-action-empty">Fully Released</span>'
  }

  return '<span class="campaign-action-empty">—</span>'
}

// Returns human-readable label + CSS modifier class for each campaign status.
function getCampaignStatusMeta(status) {
  switch (status) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'VERIFIED':
      return { label: 'Active',         statusClass: 'is-active' }
    case 'DRAFT':
      return { label: 'Draft',          statusClass: 'is-draft' }
    case 'UNDER_REVIEW':
      return { label: 'Under Review',   statusClass: 'is-pending' }
    case 'FROZEN':
      return { label: 'AI Frozen',      statusClass: 'is-frozen' }
    case 'REJECTED':
      return { label: 'Rejected',       statusClass: 'is-rejected' }
    case 'COMPLETED':
      return { label: 'Completed',      statusClass: 'is-completed' }
    default:
      return { label: status,           statusClass: '' }
  }
}

// AI alert count — FROZEN is the highest severity (auto-frozen by Gemini AI),
// UNDER_REVIEW means Gemini flagged it for human review.
function getAIAlertCount(status) {
  if (status === 'FROZEN') return 1
  return 0
}

function updateCount(table, count) {
  const element = table.querySelector('[data-campaign-count]')
  if (element) element.textContent = `Showing ${count} entries`
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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
