const statusFilters = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'FROZEN', label: 'Frozen' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
]
const pageSize = 5

export function createCampaignsTable() {
  const section = document.createElement('section')
  section.className = 'campaigns-panel'
  section.dataset.filterStatus = 'all'
  section.dataset.page = '1'
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
            ${statusFilters
              .map((filter) => `<option value="${filter.value}">${filter.label}</option>`)
              .join('')}
          </select>
        </label>
        <a class="campaigns-primary-action" href="./start-campaign.html">
          <span aria-hidden="true">+</span>
          New Campaign
        </a>
      </div>
    </div>
    <div class="campaigns-table-wrap">
      <table class="campaigns-table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Raise Target</th>
            <th>Status</th>
            <th>Action</th>
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
      <div data-pagination-buttons>
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

  search?.addEventListener('input', () => {
    table.dataset.page = '1'
    renderCampaignRows(table, campaigns)
  })

  filter?.addEventListener('change', () => {
    table.dataset.filterStatus = filter.value || 'all'
    table.dataset.page = '1'
    renderCampaignRows(table, campaigns)
  })

  table.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page-btn]')
    if (!button) return
    const page = Number(button.dataset.pageBtn)
    if (!Number.isNaN(page)) {
      table.dataset.page = String(page)
      renderCampaignRows(table, campaigns)
    }
  })
}

export function renderCampaignRows(table, campaigns) {
  const rows = table.querySelector('[data-campaign-rows]')
  if (!rows) return

  const filtered = filterCampaigns(table, campaigns)
  const currentPage = Math.max(1, Number(table.dataset.page) || 1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  table.dataset.page = String(safePage)

  const start = (safePage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  if (!visible.length) {
    rows.innerHTML = `
      <tr>
        <td class="campaigns-empty-cell" colspan="6">No campaigns found.</td>
      </tr>
    `
    updateCount(table, filtered.length, campaigns.length, safePage, totalPages)
    renderPagination(table, safePage, totalPages)
    return
  }

  rows.innerHTML = visible.map(renderCampaignRow).join('')
  updateCount(table, filtered.length, campaigns.length, safePage, totalPages)
  renderPagination(table, safePage, totalPages)
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
    const searchable = `${campaign.name || ''} ${campaign.causeType || ''}`.toLowerCase()
    return (filter === 'all' || campaign.status === filter) && searchable.includes(query)
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
            <span class="campaign-name-text">
              ${escapeHtml(campaign.name)}
            </span>
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
      <td>${renderStatusChip(label, statusClass)}</td>
      <td>${renderCampaignAction(campaign)}</td>
    </tr>
  `
}

function renderStatusChip(label, statusClass) {
  return `<span class="campaign-status-chip ${statusClass}">${escapeHtml(label)}</span>`
}

function renderCampaignAction(campaign) {
  const availableAmount = Number(campaign.availableAmount ?? campaign.raisedAmount ?? 0)
  const detailsButton = `
    <a class="campaign-action-button is-secondary" href="./ngo-campaign-detail.html?id=${encodeURIComponent(campaign.id)}">
      View Details
    </a>
  `

  if (campaign.status === 'DRAFT') {
    return `
      <div class="campaign-row-actions">
        <a class="campaign-action-button" href="./start-campaign.html?campaignId=${encodeURIComponent(campaign.id)}">
          Edit Draft
        </a>
        ${detailsButton}
      </div>
    `
  }

  if (campaign.status === 'UNDER_REVIEW') {
    return `<div class="campaign-row-actions">${detailsButton}</div>`
  }

  if (campaign.status === 'FROZEN') {
    return `<div class="campaign-row-actions">${detailsButton}</div>`
  }

  if (campaign.status === 'ACTIVE' && availableAmount > 0) {
    return `
      <div class="campaign-row-actions">
        <a class="campaign-action-button" href="./submit-evidence.html?campaignId=${encodeURIComponent(campaign.id)}">
          Submit Evidence
        </a>
        ${detailsButton}
      </div>
    `
  }

  if (campaign.status === 'ACTIVE' && availableAmount <= 0) {
    return `<div class="campaign-row-actions">${detailsButton}</div>`
  }

  return `<div class="campaign-row-actions">${detailsButton}</div>`
}

function getCampaignStatusMeta(status) {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', statusClass: 'is-active' }
    case 'DRAFT':
      return { label: 'Draft', statusClass: 'is-draft' }
    case 'UNDER_REVIEW':
      return { label: 'Under Review', statusClass: 'is-pending' }
    case 'FROZEN':
      return { label: 'Frozen', statusClass: 'is-frozen' }
    case 'REJECTED':
      return { label: 'Rejected', statusClass: 'is-rejected' }
    case 'COMPLETED':
      return { label: 'Completed', statusClass: 'is-completed' }
    default:
      return { label: status || 'Unknown', statusClass: '' }
  }
}

function updateCount(table, visibleCount, totalCount, currentPage, totalPages) {
  const count = table.querySelector('[data-campaign-count]')
  const pageSummary = table.querySelector('[data-campaign-page-summary]')
  const shown = visibleCount === 0
    ? 0
    : Math.min(visibleCount - (currentPage - 1) * pageSize, pageSize)
  if (count) count.textContent = `Showing ${shown} of ${visibleCount} campaigns`
  if (pageSummary) {
    pageSummary.textContent = `Page ${currentPage} of ${totalPages} - ${totalCount} campaigns total`
  }
}

function renderPagination(table, currentPage, totalPages) {
  const container = table.querySelector('[data-pagination-buttons]')
  if (!container) return

  let html = `<button type="button" ${currentPage <= 1 ? 'disabled' : ''} data-page-btn="${currentPage - 1}">&lt;</button>`

  for (const page of getPaginationRange(currentPage, totalPages)) {
    if (page === '...') {
      html += '<button type="button" disabled style="opacity:.4;">...</button>'
    } else {
      html += `<button type="button" ${page === currentPage ? 'class="is-active"' : ''} data-page-btn="${page}">${page}</button>`
    }
  }

  html += `<button type="button" ${currentPage >= totalPages ? 'disabled' : ''} data-page-btn="${currentPage + 1}">&gt;</button>`
  container.innerHTML = html
}

function getPaginationRange(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 3) return [1, 2, 3, '...', total]
  if (current >= total - 2) return [1, '...', total - 2, total - 1, total]
  return [1, '...', current, '...', total]
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
