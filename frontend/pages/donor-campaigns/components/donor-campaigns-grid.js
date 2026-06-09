const pageSize = 6

const imageMap = [
  { test: /medical|health|surgery|aid/i, tag: 'Medical Aid', class: 'is-medical', image: './assets/medicaid-alliance.png' },
  { test: /environment|forest|ocean|water|clean|climate|eco/i, tag: 'Environment', class: 'is-environment', image: './assets/earthcare-sustainability-charity.png' },
  { test: /school|education|community|poverty|relief/i, tag: 'Community', class: 'is-community', image: './assets/children-education.png' },
]

export function createDonorCampaignsGrid() {
  const section = document.createElement('section')
  section.className = 'donor-campaigns-grid-panel'
  section.dataset.page = '1'
  section.innerHTML = `
    <div class="donor-panel-header">
      <div class="donor-panel-title-group">
        <h2>Active Campaigns</h2>
      </div>
      <div class="donor-panel-toolbar">
        <label class="donor-panel-search">
          <span aria-hidden="true"></span>
          <input data-donor-search type="search" placeholder="Search for anything..." />
        </label>
        <button class="donor-filter-btn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
          Filter
        </button>
      </div>
    </div>
    <div class="donor-card-grid" data-donor-campaign-rows>
      <div class="donor-loading-cell" style="grid-column: 1 / -1;">Loading campaigns...</div>
    </div>
  `
  return section
}

export function renderDonorCampaignRows(panel, campaigns) {
  const grid = panel.querySelector('[data-donor-campaign-rows]')
  if (!grid) return

  const filtered = filterCampaigns(panel, campaigns)
  const currentPage = Math.max(1, Number(panel.dataset.page) || 1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  panel.dataset.page = String(safePage)

  const start = (safePage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  if (!visible.length) {
    grid.innerHTML = `
      <div class="donor-empty-cell" style="grid-column: 1 / -1;">No campaigns found.</div>
    `
    return
  }

  grid.innerHTML = visible.map(renderCard).join('')
}

export function bindDonorTableControls(panel, campaigns) {
  const search = panel.querySelector('[data-donor-search]')

  search?.addEventListener('input', () => {
    panel.dataset.page = '1'
    renderDonorCampaignRows(panel, campaigns)
  })
}

export function renderDonorCampaignError(panel, message) {
  const grid = panel.querySelector('[data-donor-campaign-rows]')
  if (!grid) return
  grid.innerHTML = `
    <div class="donor-error-cell" style="grid-column: 1 / -1;">${escapeHtml(message)}</div>
  `
}

/* ─── Internal helpers ──────────────────────────────────── */

function filterCampaigns(panel, campaigns) {
  const query = panel.querySelector('[data-donor-search]')?.value.trim().toLowerCase() || ''
  return campaigns.filter((c) => {
    const searchable = `${c.name || ''} ${c.causeType || ''} ${c.ngoName || ''}`.toLowerCase()
    return searchable.includes(query)
  })
}

function renderCard(campaign) {
  const raised = Number(campaign.raised ?? campaign.raisedAmount ?? 0)
  const target = Number(campaign.target ?? campaign.targetAmount ?? 0)
  const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0
  const daysLeft = getDaysLeft(campaign.endDate)
  const causeInfo = getCauseInfo(campaign)

  // Use the local mapped image if the campaign doesn't have one
  const imageUrl = campaign.image || causeInfo.image || './assets/global-relief.png'

  return `
    <article class="donor-campaign-card">
      <div class="donor-card-image-wrap">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(campaign.name)}" class="donor-card-image" />
        <span class="donor-card-tag ${causeInfo.class}">${escapeHtml(causeInfo.tag)}</span>
      </div>
      
      <div class="donor-card-content">
        <h3 class="donor-card-title">${escapeHtml(campaign.name)}</h3>
        
        <div class="donor-card-ngo">
          <span class="donor-card-ngo-icon" aria-hidden="true"></span>
          ${escapeHtml(campaign.ngoName || 'Verified NGO')}
        </div>
        
        <div class="donor-card-kyc">
          <span class="donor-card-kyc-tick" aria-hidden="true">✓</span>
          Bank Islam KYC Verified
        </div>
        
        <div class="donor-card-progress-text">
          <span>${formatMoney(raised)} raised</span>
          <strong>${percent}%</strong>
        </div>
        
        <div class="donor-card-progress-bar" aria-hidden="true">
          <span style="width: ${percent}%"></span>
        </div>
        
        <div class="donor-card-stats">
          <div class="donor-card-stat">
            <span class="donor-card-stat-label">DONORS</span>
            <strong class="donor-card-stat-value">1</strong>
          </div>
          <div class="donor-card-stat-divider"></div>
          <div class="donor-card-stat">
            <span class="donor-card-stat-label">DAYS LEFT</span>
            <strong class="donor-card-stat-value">${daysLeft}</strong>
          </div>
        </div>
        
        <a class="donor-card-btn" href="./campaign-details.html?id=${encodeURIComponent(campaign.id)}">
          View Details
        </a>
      </div>
    </article>
  `
}

function getCauseInfo(campaign) {
  const value = `${campaign.causeType || ''} ${campaign.name || ''}`
  const matched = imageMap.find((item) => item.test.test(value))
  return matched ? matched : { tag: campaign.causeType || 'COMMUNITY', class: 'is-community', image: './assets/global-relief.png' }
}

function getDaysLeft(value) {
  if (!value) return '60' // default for display
  const today = new Date()
  const end = new Date(value)
  const diff = Math.ceil((end.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000)
  return diff <= 0 ? '0' : String(diff)
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
