export function createAdminNGOTable() {
  const section = document.createElement('section')
  section.className = 'admin-ngo-panel'
  section.innerHTML = `
    <div class="admin-ngo-panel-header">
      <div>
        <button class="admin-tool-button" type="button">Filter</button>
        <button class="admin-tool-button" type="button">Sort By: Date</button>
      </div>
      <button class="admin-primary-action" type="button" disabled>
        <span aria-hidden="true">+</span>
        Onboard New NGO
      </button>
    </div>
    <div class="admin-ngo-table-wrap">
      <table class="admin-ngo-table">
        <thead>
          <tr>
            <th>Organisation</th>
            <th>Registration No.</th>
            <th>Submission Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody data-admin-ngo-rows>
          <tr>
            <td class="admin-ngo-loading-cell" colspan="5">Loading NGOs...</td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer class="admin-ngo-pagination">
      <span data-admin-ngo-count>Showing 0 entries</span>
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

export function renderAdminNGORows(table, ngos) {
  const rows = table.querySelector('[data-admin-ngo-rows]')
  if (!rows) return

  if (!ngos.length) {
    rows.innerHTML = `
      <tr>
        <td class="admin-ngo-empty-cell" colspan="5">No NGO applications found.</td>
      </tr>
    `
    updateCount(table, 0)
    return
  }

  rows.innerHTML = ngos.map(renderRow).join('')
  updateCount(table, ngos.length)
}

export function renderAdminNGOError(table, message) {
  const rows = table.querySelector('[data-admin-ngo-rows]')
  if (!rows) return
  rows.innerHTML = `
    <tr>
      <td class="admin-ngo-error-cell" colspan="5">${escapeHtml(message)}</td>
    </tr>
  `
}

function renderRow(ngo) {
  return `
    <tr>
      <td>
        <div class="admin-ngo-name-cell">
          <span class="admin-ngo-logo"></span>
          <div>
            <strong>${escapeHtml(ngo.name)}</strong>
            <span>${escapeHtml(ngo.contactEmail || '-')}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(ngo.registrationNum)}</td>
      <td>${formatDate(ngo.createdAt)}</td>
      <td>${renderStatus(ngo)}</td>
      <td>${renderActions(ngo)}</td>
    </tr>
  `
}

function renderStatus(ngo) {
  const label = getStatusLabel(ngo)
  const className = getStatusClass(ngo)
  return `<span class="admin-status-pill ${className}">${label}</span>`
}

function renderActions(ngo) {
  if (ngo.status === 'PENDING_KYC') {
    return `
      <div class="admin-action-row">
        <button class="admin-verify-button" type="button" data-action="approve" data-ngo-id="${ngo.id}">
          Verify
        </button>
        <button class="admin-reject-button" type="button" data-action="reject" data-ngo-id="${ngo.id}" aria-label="Reject NGO">
          ×
        </button>
      </div>
    `
  }

  return '<button class="admin-details-button" type="button" disabled>View Details</button>'
}

function getStatusLabel(ngo) {
  if (ngo.status === 'PENDING_KYC') return 'Pending Review'
  if (ngo.status === 'APPROVED') return 'Verified'
  if (ngo.riskTier === 'HIGH' || ['REJECTED', 'REVOKED'].includes(ngo.status)) {
    return 'High Risk Flag'
  }
  return ngo.status.replaceAll('_', ' ')
}

function getStatusClass(ngo) {
  if (ngo.status === 'PENDING_KYC') return 'is-pending'
  if (ngo.status === 'APPROVED') return 'is-verified'
  return 'is-flagged'
}

function updateCount(table, count) {
  const element = table.querySelector('[data-admin-ngo-count]')
  if (element) element.textContent = `Showing ${count} entries`
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
