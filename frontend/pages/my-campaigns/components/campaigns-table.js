export function createCampaignsTable() {
  const section = document.createElement('section')
  section.className = 'campaigns-panel'
  section.innerHTML = `
    <div class="campaigns-panel-header">
      <div>
        <button class="campaign-tool-button" type="button">Filter</button>
        <button class="campaign-tool-button" type="button">Sort By: Date</button>
      </div>
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
            <th>Submission Date</th>
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
      <td>${formatDate(campaign.createdAt)}</td>
      <td>${formatMoney(campaign.raisedAmount)} /<br />${formatMoney(campaign.targetAmount)}</td>
      <td><span class="campaign-count-pill">0</span></td>
      <td><span class="campaign-count-pill is-alert">${campaign.status === 'UNDER_REVIEW' ? 1 : 0}</span></td>
      <td>${renderCampaignAction(campaign)}</td>
      <td><span class="campaign-status">${escapeHtml(getCampaignStatusLabel(campaign.status))}</span></td>
    </tr>
  `
}

function renderCampaignAction(campaign) {
  if (['VERIFIED', 'ACTIVE', 'APPROVED'].includes(campaign.status)) {
    return `
      <a class="campaign-action-button" href="#submit-evidence" aria-disabled="true">
        Submit Evidence
      </a>
    `
  }

  return '<span class="campaign-action-empty">-</span>'
}

function getCampaignStatusLabel(status) {
  if (['ACTIVE', 'APPROVED', 'VERIFIED'].includes(status)) return 'VERIFIED'
  if (status === 'DRAFT') return 'PENDING REVIEW'
  return status
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
