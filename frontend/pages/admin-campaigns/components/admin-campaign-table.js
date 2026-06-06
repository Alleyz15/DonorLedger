export function createAdminCampaignTable() {
  const section = document.createElement('section')
  section.className = 'admin-campaign-panel'
  section.innerHTML = `
    <table class="admin-campaign-table">
      <thead>
        <tr>
          <th>Campaign</th>
          <th>Status</th>
          <th>Raised</th>
          <th>Days Left</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody data-admin-campaign-rows>
        <tr>
          <td class="admin-campaign-loading-cell" colspan="5">Loading campaign requests...</td>
        </tr>
      </tbody>
    </table>
  `
  return section
}

export function renderAdminCampaignRows(table, campaigns) {
  const rows = table.querySelector('[data-admin-campaign-rows]')
  if (!rows) return

  if (!campaigns.length) {
    rows.innerHTML = `
      <tr>
        <td class="admin-campaign-empty-cell" colspan="5">No campaign requests found.</td>
      </tr>
    `
    return
  }

  rows.innerHTML = campaigns.map(renderRow).join('')
}

export function renderAdminCampaignError(table, message) {
  const rows = table.querySelector('[data-admin-campaign-rows]')
  if (!rows) return
  rows.innerHTML = `
    <tr>
      <td class="admin-campaign-error-cell" colspan="5">${escapeHtml(message)}</td>
    </tr>
  `
}

function renderRow(campaign) {
  return `
    <tr>
      <td>
        <div class="admin-campaign-name">
          <a class="admin-campaign-name-link" href="./admin-campaign-detail.html?id=${encodeURIComponent(campaign.id)}">
            ${escapeHtml(campaign.name)}
          </a>
          <span>${escapeHtml(campaign.ngo?.name || campaign.causeType || '-')}</span>
          ${campaign.pausedReason ? `<small>${escapeHtml(campaign.pausedReason)}</small>` : ''}
        </div>
      </td>
      <td>${renderStatus(campaign.status)}</td>
      <td>
        <div class="admin-campaign-raised">
          <strong>${formatCurrency(campaign.raisedAmount)}</strong>
          <span>of ${formatCurrency(campaign.targetAmount)} target</span>
        </div>
      </td>
      <td>${getDaysLeft(campaign)}</td>
      <td>${renderActions(campaign)}</td>
    </tr>
  `
}

function renderStatus(status) {
  const statusMeta = getStatusMeta(status)
  return `<span class="admin-campaign-status ${statusMeta.className}">${statusMeta.label}</span>`
}

function renderActions(campaign) {
  if (['DRAFT', 'UNDER_REVIEW'].includes(campaign.status)) {
    return `
      <div class="admin-campaign-actions">
        <button class="admin-campaign-action is-approve" type="button" data-action="approve" data-campaign-id="${escapeHtml(campaign.id)}">Approve</button>
        <button class="admin-campaign-action is-reject" type="button" data-action="reject" data-campaign-id="${escapeHtml(campaign.id)}">Reject</button>
      </div>
    `
  }

  if (campaign.status === 'FROZEN') {
    return `
      <button class="admin-campaign-action is-unfreeze" type="button" data-action="unfreeze" data-campaign-id="${escapeHtml(campaign.id)}">Unfreeze</button>
    `
  }

  return '<button class="admin-campaign-more" type="button" aria-label="More actions">⋮</button>'
}

function getStatusMeta(status) {
  if (status === 'DRAFT') return { label: 'Pending', className: 'is-pending' }
  if (status === 'UNDER_REVIEW') return { label: 'Under Review', className: 'is-review' }
  if (status === 'FROZEN') return { label: 'Frozen', className: 'is-frozen' }
  if (status === 'ACTIVE') return { label: 'Active', className: 'is-active' }
  if (status === 'REJECTED') return { label: 'Rejected', className: 'is-rejected' }
  if (status === 'COMPLETED') return { label: 'Completed', className: 'is-completed' }
  return { label: String(status || '-').replaceAll('_', ' '), className: 'is-default' }
}

function getDaysLeft(campaign) {
  if (campaign.status === 'FROZEN') return 'Ended'
  if (!campaign.endDate) return '-'
  const today = new Date()
  const end = new Date(campaign.endDate)
  const diff = Math.ceil((end.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000)
  return diff <= 0 ? 'Ended' : `${diff} Days`
}

function formatCurrency(value) {
  return `RM ${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(Number(value || 0))}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
