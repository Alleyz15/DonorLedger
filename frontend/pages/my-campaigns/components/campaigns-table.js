const statusFilters = ['all', 'active', 'completed', 'flagged', 'pending', 'draft']
const filterLabels = {
  all: 'All Status',
  active: 'Active',
  completed: 'Completed',
  flagged: 'Flagged',
  pending: 'Under Review',
  draft: 'Draft',
}
const pageSize = 5

export function createCampaignsTable() {
  const section = document.createElement('section')
  section.className = 'campaigns-panel'
  section.dataset.filterStatus = 'all'
  section.innerHTML = `
    <div class="campaigns-panel-header">
      <div class="campaigns-title-group">
        <h2>Campaign List</h2>
        <p data-campaign-count>Showing 0 campaigns</p>
      </div>
      <div class="campaigns-toolbar">
        <label class="campaign-search">
          <span aria-hidden="true"></span>
          <input data-campaign-search type="search" placeholder="Search campaigns..." />
        </label>
        <label class="campaign-status-filter">
          <span>Status</span>
          <select data-campaign-filter>
            ${statusFilters.map((key) => `<option value="${key}">${filterLabels[key]}</option>`).join('')}
          </select>
        </label>
        <a class="campaigns-primary-action" href="./start-campaign.html">
          <span aria-hidden="true">+</span>
          Start New Campaign
        </a>
      </div>
    </div>
    <div class="campaigns-table-wrap">
      <table class="campaigns-table">
        <thead>
          <tr>
            <th>Campaign Name</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Raise Target</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody data-campaign-rows>
          <tr>
            <td class="campaigns-loading-cell" colspan="6">Loading campaigns...</td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer class="campaigns-pagination">
      <span data-campaign-page-summary>Page 1 of 1 - 0 campaigns total</span>
      <div>
        <button type="button" disabled>&lt;</button>
        <button class="is-active" type="button">1</button>
        <button type="button" disabled>&gt;</button>
      </div>
    </footer>
  `
  return section
}

export function bindCampaignTableControls(table, campaigns) {
  const search = table.querySelector('[data-campaign-search]')
  const filter = table.querySelector('[data-campaign-filter]')

  search?.addEventListener('input', () => renderCampaignRows(table, campaigns))
  filter?.addEventListener('change', () => {
    table.dataset.filterStatus = filter.value || 'all'
    renderCampaignRows(table, campaigns)
  })
}

export function renderCampaignRows(table, campaigns) {
  const rows = table.querySelector('[data-campaign-rows]')
  if (!rows) return

  const filtered = filterCampaigns(table, campaigns)

  const visible = filtered.slice(0, pageSize)

  if (!visible.length) {
    rows.innerHTML = `
      <tr>
        <td class="campaigns-empty-cell" colspan="6">No campaigns found.</td>
      </tr>
    `
    updateCount(table, filtered.length, campaigns.length)
    return
  }

  rows.innerHTML = visible.map(renderCampaignRow).join('')
  updateCount(table, filtered.length, campaigns.length)
}

export function renderCampaignError(table, message) {
  const rows = table.querySelector('[data-campaign-rows]')
  if (!rows) return
  rows.innerHTML = `
    <tr>
      <td class="campaigns-error-cell" colspan="6">${escapeHtml(message)}</td>
    </tr>
  `
}

function filterCampaigns(table, campaigns) {
  const query = table.querySelector('[data-campaign-search]')?.value.trim().toLowerCase() || ''
  const filter = table.dataset.filterStatus || 'all'

  return campaigns.filter((campaign) => {
    const statusKey = getStatusKey(campaign.status)
    const matchesStatus = filter === 'all' || filter === statusKey
    const searchable = `${campaign.name || ''} ${campaign.causeType || ''}`.toLowerCase()
    return matchesStatus && searchable.includes(query)
  })
}

function renderCampaignRow(campaign) {
  const { label, statusClass } = getCampaignStatusMeta(campaign.status)
  const raised = Number(campaign.raisedAmount || 0)
  const target = Number(campaign.targetAmount || 0)
  const progress = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0

  return `
    <tr>
      <td>
        <div class="campaign-title-cell">
          <span class="campaign-logo-placeholder" aria-hidden="true">${escapeHtml(getInitial(campaign.name))}</span>
          <div>
            <a class="campaign-name-link" href="./ngo-campaign-detail.html?id=${encodeURIComponent(campaign.id)}">
              ${escapeHtml(campaign.name)}
            </a>
            <span>${escapeHtml(campaign.causeType || 'Campaign')}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="campaign-date-cell">${campaign.createdAt ? formatDate(campaign.createdAt) : '-'}</div>
      </td>
      <td>
        <div class="campaign-date-cell">${campaign.endDate ? formatDate(campaign.endDate) : '-'}</div>
      </td>
      <td>
        <div class="campaign-target-cell">${formatMoney(target)}</div>
        <div class="campaign-progress-copy">${formatMoney(raised)} raised - ${progress}%</div>
        <div class="campaign-progress-bar" aria-hidden="true">
          <span style="width: ${progress}%"></span>
        </div>
      </td>
      <td>${renderStatusSelect(campaign.status, label, statusClass)}</td>
      <td>${renderCampaignAction(campaign)}</td>
    </tr>
  `
}

function renderStatusSelect(status, label, statusClass) {
  const options = [
    ['ACTIVE', 'Active'],
    ['UNDER_REVIEW', 'Under Review'],
    ['DRAFT', 'Draft'],
    ['COMPLETED', 'Completed'],
    ['FROZEN', 'Flagged'],
    ['REJECTED', 'Rejected'],
  ]
  const normalized = ['APPROVED', 'VERIFIED'].includes(status) ? 'ACTIVE' : status
  const optionHtml = options
    .map(([value, text]) => (
      `<option value="${value}"${value === normalized ? ' selected' : ''}>${text}</option>`
    ))
    .join('')

  return `
    <select class="campaign-status-select ${statusClass}" aria-label="Campaign status" disabled>
      ${optionHtml || `<option>${escapeHtml(label)}</option>`}
    </select>
  `
}

function renderCampaignAction(campaign) {
  const availableAmount = Number(campaign.availableAmount ?? campaign.raisedAmount ?? 0)

  if (campaign.status === 'DRAFT') {
    return `
      <a class="campaign-action-button" href="./start-campaign.html?campaignId=${encodeURIComponent(campaign.id)}">
        Edit Draft
      </a>
    `
  }

  if (campaign.status === 'UNDER_REVIEW') {
    return '<span class="campaign-action-pending">Awaiting Bank Islam approval</span>'
  }

  if (campaign.status === 'FROZEN') {
    return '<span class="campaign-action-frozen">Campaign frozen</span>'
  }

  if (['VERIFIED', 'ACTIVE', 'APPROVED'].includes(campaign.status) && availableAmount > 0) {
    return `
      <a class="campaign-action-button" href="./submit-evidence.html?campaignId=${encodeURIComponent(campaign.id)}">
        Submit Evidence
      </a>
    `
  }

  if (['VERIFIED', 'ACTIVE', 'APPROVED', 'COMPLETED'].includes(campaign.status) && availableAmount <= 0) {
    return '<span class="campaign-action-empty">Fully Released</span>'
  }

  return '<span class="campaign-action-empty">-</span>'
}

function getCampaignStatusMeta(status) {
  switch (status) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'VERIFIED':
      return { label: 'Active', statusClass: 'is-active' }
    case 'DRAFT':
      return { label: 'Draft', statusClass: 'is-draft' }
    case 'UNDER_REVIEW':
      return { label: 'Under Review', statusClass: 'is-pending' }
    case 'FROZEN':
      return { label: 'Flagged', statusClass: 'is-frozen' }
    case 'REJECTED':
      return { label: 'Rejected', statusClass: 'is-rejected' }
    case 'COMPLETED':
      return { label: 'Completed', statusClass: 'is-completed' }
    default:
      return { label: status || 'Unknown', statusClass: '' }
  }
}

function getStatusKey(status) {
  if (['ACTIVE', 'APPROVED', 'VERIFIED'].includes(status)) return 'active'
  if (status === 'COMPLETED') return 'completed'
  if (['FROZEN', 'REJECTED'].includes(status)) return 'flagged'
  if (status === 'UNDER_REVIEW') return 'pending'
  if (status === 'DRAFT') return 'draft'
  return 'all'
}

function updateCount(table, visibleCount, totalCount) {
  const count = table.querySelector('[data-campaign-count]')
  const pageSummary = table.querySelector('[data-campaign-page-summary]')
  const shown = Math.min(visibleCount, pageSize)
  const pages = Math.max(1, Math.ceil(visibleCount / pageSize))
  if (count) count.textContent = `Showing ${shown} of ${visibleCount} campaigns`
  if (pageSummary) pageSummary.textContent = `Page 1 of ${pages} - ${totalCount} campaigns total`
}

function getInitial(value) {
  return String(value || 'C').trim().charAt(0).toUpperCase() || 'C'
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
