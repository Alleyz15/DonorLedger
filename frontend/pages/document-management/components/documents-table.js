const statusFilters = [
  { value: 'all', label: 'All Status' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'AUTO_FROZEN', label: 'Auto Frozen' },
]

const pageSize = 5

export function createDocumentsTable() {
  const section = document.createElement('section')
  section.className = 'documents-panel'
  section.dataset.filterStatus = 'all'
  section.dataset.page = '1'
  section.innerHTML = `
    <div class="documents-panel-header">
      <div class="documents-title-group">
        <h2>Evidence List</h2>
        <p data-document-count>Showing 0 evidences</p>
      </div>
      <div class="documents-toolbar">
        <label class="document-search">
          <span aria-hidden="true"></span>
          <input data-document-search type="search" placeholder="Search evidences..." />
        </label>
        <label class="document-status-filter">
          <span>Status</span>
          <select data-document-filter>
            ${statusFilters
              .map((filter) => `<option value="${filter.value}">${filter.label}</option>`)
              .join('')}
          </select>
        </label>
      </div>
    </div>
    <div class="documents-table-wrap">
      <table class="documents-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Campaign Name</th>
            <th>Vendor</th>
            <th>Status</th>
            <th>Submitted At</th>
            <th>Process At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody data-document-rows>
          <tr>
            <td class="documents-loading-cell" colspan="7">Loading evidences...</td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer class="documents-pagination">
      <span data-document-page-summary>Page 1 of 1 - 0 evidences total</span>
      <div data-document-pagination-buttons>
        <button type="button" disabled>&lt;</button>
        <button class="is-active" type="button">1</button>
        <button type="button" disabled>&gt;</button>
      </div>
    </footer>
  `
  return section
}

export function bindDocumentTableControls(table, evidenceItems) {
  const search = table.querySelector('[data-document-search]')
  const filter = table.querySelector('[data-document-filter]')

  search?.addEventListener('input', () => {
    table.dataset.page = '1'
    renderDocumentRows(table, evidenceItems)
  })

  filter?.addEventListener('change', () => {
    table.dataset.filterStatus = filter.value || 'all'
    table.dataset.page = '1'
    renderDocumentRows(table, evidenceItems)
  })

  table.addEventListener('click', (event) => {
    const button = event.target.closest('[data-document-page-btn]')
    if (!button) return
    const page = Number(button.dataset.documentPageBtn)
    if (!Number.isNaN(page)) {
      table.dataset.page = String(page)
      renderDocumentRows(table, evidenceItems)
    }
  })
}

export function renderDocumentRows(table, evidenceItems) {
  const rows = table.querySelector('[data-document-rows]')
  if (!rows) return

  const filtered = filterEvidence(table, evidenceItems)
  const currentPage = Math.max(1, Number(table.dataset.page) || 1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  table.dataset.page = String(safePage)

  const start = (safePage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  if (!visible.length) {
    rows.innerHTML = `
      <tr>
        <td class="documents-empty-cell" colspan="7">No evidences found.</td>
      </tr>
    `
    updateCount(table, filtered.length, evidenceItems.length, safePage, totalPages)
    renderPagination(table, safePage, totalPages)
    return
  }

  rows.innerHTML = visible.map(renderDocumentRow).join('')
  updateCount(table, filtered.length, evidenceItems.length, safePage, totalPages)
  renderPagination(table, safePage, totalPages)
}

export function renderDocumentError(table, message) {
  const rows = table.querySelector('[data-document-rows]')
  if (!rows) return
  rows.innerHTML = `
    <tr>
      <td class="documents-error-cell" colspan="7">${escapeHtml(message)}</td>
    </tr>
  `
}

function filterEvidence(table, evidenceItems) {
  const query = table.querySelector('[data-document-search]')?.value.trim().toLowerCase() || ''
  const filter = table.dataset.filterStatus || 'all'

  return evidenceItems.filter((item) => {
    const searchable = [
      item.title,
      item.campaignName,
      item.vendorName,
      item.vendorServiceType,
      item.category,
      getStatusMeta(item.status).label,
    ].join(' ').toLowerCase()

    return (filter === 'all' || item.status === filter) && searchable.includes(query)
  })
}

function renderDocumentRow(item) {
  const { label, statusClass } = getStatusMeta(item.status)

  return `
    <tr>
      <td>
        <div class="document-title-cell">
          <strong>${escapeHtml(item.title || '-')}</strong>
          <span>${escapeHtml(formatCategory(item.category))}</span>
        </div>
      </td>
      <td>
        <div class="document-campaign-cell">
          <span class="document-logo-placeholder" aria-hidden="true">${escapeHtml(getInitial(item.campaignName))}</span>
          <div>
            <span class="document-campaign-name">${escapeHtml(item.campaignName)}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="document-vendor-cell">
          <strong>${escapeHtml(item.vendorName)}</strong>
          <span>${escapeHtml(item.vendorServiceType || 'Vendor')}</span>
        </div>
      </td>
      <td>${renderStatusChip(label, statusClass)}</td>
      <td><div class="document-date-cell">${formatDate(item.submittedAt)}</div></td>
      <td><div class="document-date-cell">${item.processAt ? formatDate(item.processAt) : '-'}</div></td>
      <td>
        <div class="document-row-actions">
          <a class="document-action-button is-secondary" href="./evidence-detail.html?id=${encodeURIComponent(item.id)}">
            View Details
          </a>
        </div>
      </td>
    </tr>
  `
}

function renderStatusChip(label, statusClass) {
  return `<span class="document-status-chip ${statusClass}">${escapeHtml(label)}</span>`
}

function getStatusMeta(status) {
  switch (status) {
    case 'PENDING_REVIEW':
      return { label: 'Pending Review', statusClass: 'is-pending' }
    case 'APPROVED':
      return { label: 'Approved', statusClass: 'is-approved' }
    case 'CONFIRMED':
      return { label: 'Confirmed', statusClass: 'is-confirmed' }
    case 'REJECTED':
      return { label: 'Rejected', statusClass: 'is-rejected' }
    case 'AUTO_FROZEN':
      return { label: 'Auto Frozen', statusClass: 'is-frozen' }
    default:
      return { label: status || 'Unknown', statusClass: '' }
  }
}

function updateCount(table, visibleCount, totalCount, currentPage, totalPages) {
  const count = table.querySelector('[data-document-count]')
  const pageSummary = table.querySelector('[data-document-page-summary]')
  const shown = visibleCount === 0
    ? 0
    : Math.min(visibleCount - (currentPage - 1) * pageSize, pageSize)
  if (count) count.textContent = `Showing ${shown} of ${visibleCount} evidences`
  if (pageSummary) {
    pageSummary.textContent = `Page ${currentPage} of ${totalPages} - ${totalCount} evidences total`
  }
}

function renderPagination(table, currentPage, totalPages) {
  const container = table.querySelector('[data-document-pagination-buttons]')
  if (!container) return

  let html = `<button type="button" ${currentPage <= 1 ? 'disabled' : ''} data-document-page-btn="${currentPage - 1}">&lt;</button>`

  for (const page of getPaginationRange(currentPage, totalPages)) {
    if (page === '...') {
      html += '<button type="button" disabled style="opacity:.4;">...</button>'
    } else {
      html += `<button type="button" ${page === currentPage ? 'class="is-active"' : ''} data-document-page-btn="${page}">${page}</button>`
    }
  }

  html += `<button type="button" ${currentPage >= totalPages ? 'disabled' : ''} data-document-page-btn="${currentPage + 1}">&gt;</button>`
  container.innerHTML = html
}

function getPaginationRange(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 3) return [1, 2, 3, '...', total]
  if (current >= total - 2) return [1, '...', total - 2, total - 1, total]
  return [1, '...', current, '...', total]
}

function getInitial(value) {
  return String(value || 'E').trim().charAt(0).toUpperCase() || 'E'
}

function formatCategory(value) {
  if (!value) return 'Evidence'
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
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
