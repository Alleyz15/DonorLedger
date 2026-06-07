const statusFilters = [
  { value: 'all', label: 'All Status' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING_KYC', label: 'Pending Review' },
  { value: 'REJECTED', label: 'Rejected' },
]
const pageSize = 5

export function createVendorsTable() {
  const section = document.createElement('section')
  section.className = 'campaigns-panel vendors-panel-dashboard'
  section.dataset.filterStatus = 'all'
  section.dataset.page = '1'
  section.innerHTML = `
    <div class="campaigns-panel-header">
      <div class="campaigns-title-group">
        <h2>Vendor List</h2>
        <p data-vendor-count>Showing 0 vendors</p>
      </div>
      <div class="campaigns-toolbar">
        <label class="campaign-search">
          <span aria-hidden="true"></span>
          <input data-vendor-search type="search" placeholder="Search vendors..." />
        </label>
        <label class="campaign-status-filter">
          <span>Status</span>
          <select data-vendor-filter>
            ${statusFilters
              .map((filter) => `<option value="${filter.value}">${filter.label}</option>`)
              .join('')}
          </select>
        </label>
        <a class="campaigns-primary-action" href="./submit-vendor.html">
          <span aria-hidden="true">+</span>
          New Vendor
        </a>
      </div>
    </div>
    <div class="campaigns-table-wrap">
      <table class="campaigns-table vendors-table">
        <thead>
          <tr>
            <th>Vendor Name</th>
            <th>Service Type</th>
            <th>Status</th>
            <th>Submitted At</th>
            <th>Approved At</th>
            <th>Rejected Reason</th>
          </tr>
        </thead>
        <tbody data-vendor-rows>
          <tr>
            <td class="campaigns-loading-cell" colspan="6">Loading vendors...</td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer class="campaigns-pagination">
      <span data-vendor-page-summary>Page 1 of 1 - 0 vendors total</span>
      <div data-pagination-buttons>
        <button type="button" disabled>&lt;</button>
        <button class="is-active" type="button">1</button>
        <button type="button" disabled>&gt;</button>
      </div>
    </footer>
  `
  return section
}

export function bindVendorTableControls(table, vendors) {
  const search = table.querySelector('[data-vendor-search]')
  const filter = table.querySelector('[data-vendor-filter]')

  search?.addEventListener('input', () => {
    table.dataset.page = '1'
    renderVendorRows(table, vendors)
  })

  filter?.addEventListener('change', () => {
    table.dataset.filterStatus = filter.value || 'all'
    table.dataset.page = '1'
    renderVendorRows(table, vendors)
  })

  table.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page-btn]')
    if (!button) return
    const page = Number(button.dataset.pageBtn)
    if (!Number.isNaN(page)) {
      table.dataset.page = String(page)
      renderVendorRows(table, vendors)
    }
  })
}

export function renderVendorRows(table, vendors) {
  const rows = table.querySelector('[data-vendor-rows]')
  if (!rows) return

  const filtered = filterVendors(table, vendors)
  const currentPage = Math.max(1, Number(table.dataset.page) || 1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  table.dataset.page = String(safePage)

  const start = (safePage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  if (!visible.length) {
    rows.innerHTML = `
      <tr>
        <td class="campaigns-empty-cell" colspan="6">No vendors found.</td>
      </tr>
    `
    updateCount(table, filtered.length, vendors.length, safePage, totalPages)
    renderPagination(table, safePage, totalPages)
    return
  }

  rows.innerHTML = visible.map(renderVendorRow).join('')
  updateCount(table, filtered.length, vendors.length, safePage, totalPages)
  renderPagination(table, safePage, totalPages)
}

export function renderVendorError(table, message) {
  const rows = table.querySelector('[data-vendor-rows]')
  if (!rows) return
  rows.innerHTML = `
    <tr>
      <td class="campaigns-error-cell" colspan="6">${escapeHtml(message)}</td>
    </tr>
  `
}

function filterVendors(table, vendors) {
  const query = table.querySelector('[data-vendor-search]')?.value.trim().toLowerCase() || ''
  const filter = table.dataset.filterStatus || 'all'

  return vendors.filter((vendor) => {
    const searchable = `${vendor.name || ''} ${vendor.serviceType || ''} ${vendor.status || ''}`.toLowerCase()
    return (filter === 'all' || vendor.status === filter) && searchable.includes(query)
  })
}

function renderVendorRow(vendor) {
  const { label, statusClass } = getVendorStatusMeta(vendor.status)

  return `
    <tr>
      <td>
        <div class="campaign-title-cell">
          <span class="campaign-logo-placeholder" aria-hidden="true">${escapeHtml(getInitial(vendor.name))}</span>
          <div>
            <span class="vendor-name-text">${escapeHtml(vendor.name || 'Unnamed Vendor')}</span>
            <span>${escapeHtml(vendor.ssmNumber || 'No registration number')}</span>
          </div>
        </div>
      </td>
      <td><span class="vendor-service-cell">${escapeHtml(formatServiceType(vendor.serviceType))}</span></td>
      <td>${renderStatusChip(label, statusClass)}</td>
      <td><div class="campaign-date-cell">${formatDate(vendor.createdAt)}</div></td>
      <td><div class="campaign-date-cell">${formatDate(vendor.approvedAt)}</div></td>
      <td><span class="vendor-reason-cell">${escapeHtml(vendor.rejectedReason || '-')}</span></td>
    </tr>
  `
}

function renderStatusChip(label, statusClass) {
  return `<span class="campaign-status-chip ${statusClass}">${escapeHtml(label)}</span>`
}

function getVendorStatusMeta(status) {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', statusClass: 'is-active' }
    case 'PENDING_KYC':
      return { label: 'Pending Review', statusClass: 'is-pending' }
    case 'REJECTED':
      return { label: 'Rejected', statusClass: 'is-rejected' }
    default:
      return { label: status || 'Unknown', statusClass: '' }
  }
}

function updateCount(table, visibleCount, totalCount, currentPage, totalPages) {
  const count = table.querySelector('[data-vendor-count]')
  const pageSummary = table.querySelector('[data-vendor-page-summary]')
  const shown = visibleCount === 0
    ? 0
    : Math.min(visibleCount - (currentPage - 1) * pageSize, pageSize)
  if (count) count.textContent = `Showing ${shown} of ${visibleCount} vendors`
  if (pageSummary) {
    pageSummary.textContent = `Page ${currentPage} of ${totalPages} - ${totalCount} vendors total`
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
  return String(value || 'V').trim().charAt(0).toUpperCase() || 'V'
}

function formatServiceType(value) {
  return String(value || '-')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
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
