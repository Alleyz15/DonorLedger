export function renderCampaignDetail(campaign) {
  const raised = Number(campaign.raisedAmount ?? campaign.raised ?? 0)
  const target = Number(campaign.targetAmount ?? campaign.target ?? 0)
  const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0
  const vendors = Array.isArray(campaign.vendors) ? campaign.vendors : []

  return `
    <section class="campaign-detail-page">
      <header class="campaign-detail-hero">
        <div class="campaign-detail-meta">
          <span>${escapeHtml(campaign.causeType || 'Community')}</span>
          <time>${formatDate(campaign.createdAt)}</time>
        </div>
        <h1>${escapeHtml(campaign.name)}</h1>
        <p class="campaign-detail-ngo"><span aria-hidden="true"></span>by ${escapeHtml(campaign.ngo?.name || campaign.ngoName || 'Verified NGO')}</p>
      </header>

      <section class="campaign-progress-card">
        <div class="campaign-progress-top">
          <div>
            <span>Total Raised</span>
            <strong>${formatCurrency(raised)} <small>/ ${formatCurrency(target)} goal</small></strong>
          </div>
          <strong class="campaign-progress-percent">${percent}% Funded</strong>
        </div>
        <div class="campaign-progress-track">
          <span style="width: ${percent}%"></span>
        </div>
        <div class="campaign-progress-stats">
          <div>
            <span>Donors</span>
            <strong>${formatNumber(campaign.donorCount || 0)}</strong>
          </div>
          <div>
            <span>Days Left</span>
            <strong>${getDaysLeft(campaign.endDate)}</strong>
          </div>
          <div>
            <span>Verification</span>
            <strong>On-Chain</strong>
          </div>
        </div>
      </section>

      <div class="campaign-detail-grid">
        <section class="campaign-impact-card">
          <h2>Make an Impact Today</h2>
          <p>${escapeHtml(campaign.description || 'Every donation to this campaign is tracked through DonorLedger for transparent reporting and donor verification.')}</p>
          <aside>
            <strong>Notes</strong>
            <span>Every cent donated to this campaign is tracked on the public ledger. You can see exact fund movements to vendors, ensuring your contribution reaches those in need without compromise.</span>
          </aside>
          <a class="campaign-donate-button" href="./confirm-payment.html?campaignId=${encodeURIComponent(campaign.id)}">
            <span aria-hidden="true"></span>
            Donate Now
          </a>
        </section>

        <section class="campaign-vendors-card">
          <h2><span aria-hidden="true"></span>Verified Vendors</h2>
          <div class="campaign-vendor-list">
            ${renderVendors(vendors)}
          </div>
        </section>
      </div>
    </section>
  `
}

function renderVendors(vendors) {
  if (!vendors.length) {
    return '<p class="campaign-vendor-empty">No verified vendors are linked to this campaign yet.</p>'
  }

  return vendors
    .map(
      (vendor) => `
        <article class="campaign-vendor-item">
          <strong>${escapeHtml(vendor.name)}</strong>
          <p>${getVendorDescription(vendor)}</p>
        </article>
      `
    )
    .join('')
}

function getVendorDescription(vendor) {
  const serviceType = String(vendor.serviceType || 'service').toLowerCase().replaceAll('_', ' ')
  return `Approved ${serviceType} vendor for transparent campaign disbursements.`
}

function formatCurrency(value) {
  return `$${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(Number(value || 0))}`
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-MY').format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getDaysLeft(value) {
  if (!value) return '0'
  const today = new Date()
  const end = new Date(value)
  const diff = Math.ceil((end.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000)
  return String(Math.max(0, diff))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
