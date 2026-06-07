export function createAdminVendorTable() {
  const section = document.createElement('section')
  section.className = 'admin-vendor-panel'
  section.innerHTML = `
    <header class="admin-vendor-panel-header">
      <h2>Vendor Review Queue</h2>
      <div>
        <button class="admin-vendor-tool" type="button">Filter</button>
        <button class="admin-vendor-tool" type="button">Sort By: Time</button>
      </div>
    </header>
    <div class="admin-vendor-table-wrap">
      <table class="admin-vendor-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Name / Reference</th>
            <th>Related NGO</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody data-admin-vendor-rows>
          <tr>
            <td class="admin-vendor-loading-cell" colspan="6">Loading vendors...</td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer class="admin-vendor-pagination">
      <span data-admin-vendor-count>Showing 0 activities</span>
      <div>
        <button type="button" disabled>&lt;</button>
        <button class="is-active" type="button">1</button>
        <button type="button" disabled>2</button>
        <button type="button" disabled>&gt;</button>
      </div>
    </footer>
  `
  return section
}

export function renderAdminVendorRows(table, vendors) {
  const rows = table.querySelector('[data-admin-vendor-rows]')
  if (!rows) return

  if (!vendors.length) {
    rows.innerHTML = `
      <tr>
        <td class="admin-vendor-empty-cell" colspan="6">No vendor submissions found.</td>
      </tr>
    `
    updateCount(table, 0)
    return
  }

  rows.innerHTML = vendors.map(renderRow).join('')
  updateCount(table, vendors.length)
}

export function renderAdminVendorError(table, message) {
  const rows = table.querySelector('[data-admin-vendor-rows]')
  if (!rows) return
  rows.innerHTML = `
    <tr>
      <td class="admin-vendor-error-cell" colspan="6">${escapeHtml(message)}</td>
    </tr>
  `
}

function renderRow(vendor) {
  const isPending = vendor.status === 'PENDING_KYC'
  return `
    <tr>
      <td>${formatRelativeTime(vendor.createdAt)}</td>
      <td><strong>Vendor Review</strong></td>
      <td>
        <div class="admin-vendor-reference">
          <strong>${escapeHtml(vendor.name)}</strong>
          <span>${escapeHtml(vendor.ssmNumber || vendor.serviceType || '-')}</span>
        </div>
      </td>
      <td>${escapeHtml(vendor.ngo?.name || '-')}</td>
      <td>${renderStatus(vendor.status)}</td>
      <td>
        <button
          class="admin-vendor-review-button"
          type="button"
          data-action="review"
          data-vendor-id="${escapeHtml(vendor.id)}"
        >
          ${isPending ? 'Review' : 'View'}
        </button>
      </td>
    </tr>
  `
}

function renderStatus(status) {
  const className = getStatusClass(status)
  const label = getStatusLabel(status)
  return `<span class="admin-vendor-status ${className}">${label}</span>`
}

function getStatusLabel(status) {
  if (status === 'PENDING_KYC') return 'Pending KYC'
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  return String(status || '-').replaceAll('_', ' ')
}

function getStatusClass(status) {
  if (status === 'PENDING_KYC') return 'is-pending'
  if (status === 'APPROVED') return 'is-approved'
  return 'is-rejected'
}

function updateCount(table, count) {
  const element = table.querySelector('[data-admin-vendor-count]')
  if (!element) return
  element.textContent = `Showing ${count} ${count === 1 ? 'activity' : 'activities'}`
}

function formatRelativeTime(value) {
  if (!value) return '-'
  const created = new Date(value).getTime()
  const diffMs = Date.now() - created
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
