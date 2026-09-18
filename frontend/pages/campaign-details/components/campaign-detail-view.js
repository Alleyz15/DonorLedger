export function renderCampaignDetail(campaign) {
  const raised = Number(campaign.raisedAmount ?? campaign.raised ?? 0)
  const target = Number(campaign.targetAmount ?? campaign.target ?? 0)
  const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0
  const goalReached = percent >= 100
  const daysLeft = getDaysLeft(campaign.endDate)
  const hasEnded = daysLeft === 'Ended'
  const canDonate = !goalReached && !hasEnded
  const vendors = Array.isArray(campaign.vendors) ? campaign.vendors : []

  return `
    <section class="campaign-detail-page">
      <!-- ── Hero ── -->
      <header class="campaign-hero">
        <div class="campaign-hero-top">
          <span class="campaign-hero-badge">${escapeHtml(campaign.causeType ? formatCause(campaign.causeType) : 'Community')}</span>
          ${campaign.endDate ? `<time class="campaign-hero-end">Ends ${formatDate(campaign.endDate)}</time>` : ''}
        </div>
        <h1>${escapeHtml(campaign.name)}</h1>
        <p class="campaign-hero-ngo">by ${escapeHtml(campaign.ngo?.name || campaign.ngoName || 'Verified NGO')}</p>
      </header>

      <!-- ── Trust badges — reinforces the platform's core differentiators ── -->
      <div class="campaign-trust-badges">
        <span class="campaign-trust-badge">🏦 Bank Islam Verified</span>
        <span class="campaign-trust-badge">⛓ Blockchain Secured</span>
        <span class="campaign-trust-badge">🤖 AI Monitored</span>
      </div>

      ${goalReached ? `
        <div class="campaign-goal-reached">
          🎉 <strong>Donation Goal Reached!</strong>
          This campaign has been fully funded. Funds are now being verified and disbursed to beneficiaries through Bank Islam.
        </div>
      ` : ''}

      <!-- ── Progress card (animated counters) ── -->
      <section class="campaign-progress-card">
        <div class="campaign-progress-top">
          <div>
            <span>Total Raised</span>
            <strong>
              <span data-countup data-target="${raised}" data-prefix="RM ">RM 0</span>
              <small>/ ${formatCurrency(target)} goal</small>
            </strong>
          </div>
          <strong class="campaign-progress-percent ${goalReached ? 'is-complete' : ''}">
            <span data-countup data-target="${percent}" data-suffix="%">0%</span> Funded
          </strong>
        </div>
        <div class="campaign-progress-track">
          <span data-progress-fill style="width: 0%" class="${goalReached ? 'is-complete' : ''}" data-width="${percent}"></span>
        </div>
        <div class="campaign-progress-stats">
          <div>
            <span>Donors</span>
            <strong>${formatNumber(campaign.donorCount || 0)}</strong>
            <span class="campaign-chain-chip" title="Donor count derived from immutable on-chain records — cannot be inflated">⛓ Blockchain Verified</span>
          </div>
          <div>
            <span>Days Left</span>
            <strong ${hasEnded ? 'style="color:#ef4444"' : ''}>${daysLeft}</strong>
          </div>
          <div>
            <span>Campaign Status</span>
            <strong>${hasEnded ? '🔴 Ended' : goalReached ? '🎉 Fully Funded' : '🟢 Active'}</strong>
          </div>
        </div>
      </section>

      <!-- ── Main layout: tabs + sticky donate sidebar ── -->
      <div class="campaign-detail-layout">
        <section class="campaign-tabs">
          <div class="campaign-tab-buttons" role="tablist">
            <button class="campaign-tab-btn is-active" type="button" role="tab" data-tab="overview">Overview</button>
            <button class="campaign-tab-btn" type="button" role="tab" data-tab="vendors">Verified Vendors</button>
          </div>

          <div class="campaign-tab-panel is-active" data-tab-panel="overview">
            <h2>Make an Impact Today</h2>
            <p>${escapeHtml(campaign.description || 'Every donation to this campaign is tracked through DonorLedger for transparent reporting and donor verification.')}</p>
            <aside class="campaign-note">
              <strong>Notes</strong>
              <span>Every cent donated to this campaign is tracked on the public ledger. You can see exact fund movements to vendors, ensuring your contribution reaches those in need without compromise.</span>
            </aside>
          </div>

          <div class="campaign-tab-panel" data-tab-panel="vendors" hidden>
            <h2>Verified Vendors</h2>
            <div class="campaign-vendor-list">
              ${renderVendors(vendors)}
            </div>
          </div>
        </section>

        <!-- ── Sticky donate sidebar ── -->
        <aside class="campaign-detail-sidebar">
          <div class="campaign-donate-card">
            <span>Support This Campaign</span>
            <strong>${formatCurrency(raised)} <small>raised of ${formatCurrency(target)}</small></strong>
            <div class="campaign-progress-track campaign-progress-track--mini">
              <span style="width: ${percent}%" class="${goalReached ? 'is-complete' : ''}"></span>
            </div>

            <ul class="campaign-donate-points">
              <li><span aria-hidden="true">🔒</span>Funds are locked in Bank Islam escrow until release</li>
              <li><span aria-hidden="true">📄</span>NGO must submit verified evidence before payout</li>
              <li><span aria-hidden="true">⛓</span>Every step is recorded on an immutable ledger</li>
            </ul>

            ${goalReached
              ? `<div class="campaign-donate-button is-funded">
                  <span aria-hidden="true">🎉</span>
                  Goal Reached — Fully Funded
                 </div>`
              : hasEnded
                ? `<div class="campaign-donate-button is-funded" style="background:#94a3b8;">
                    <span aria-hidden="true">🔴</span>
                    Campaign Has Ended
                   </div>`
                : `<a class="campaign-donate-button is-pulsing" href="./confirm-payment.html?campaignId=${encodeURIComponent(campaign.id)}">
                    <span aria-hidden="true"></span>
                    Donate Now
                   </a>`
            }
            <p class="campaign-donate-foot">100% transparent · Bank Islam escrow · Blockchain verified</p>
          </div>
        </aside>
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
          <div class="campaign-vendor-icon" aria-hidden="true">${getVendorIcon(vendor.serviceType)}</div>
          <div class="campaign-vendor-body">
            <strong>${escapeHtml(vendor.name)}</strong>
            ${vendor.serviceType ? `<span class="campaign-vendor-badge">${escapeHtml(formatCause(vendor.serviceType))}</span>` : ''}
          </div>
        </article>
      `
    )
    .join('')
}

// Decorative icon based on the vendor's real serviceType field — purely
// presentational, falls back to a neutral icon for unrecognised types.
function getVendorIcon(serviceType) {
  const type = String(serviceType || '').toLowerCase()
  if (type.includes('food')) return '🍱'
  if (type.includes('medical') || type.includes('health') || type.includes('clinic')) return '⚕️'
  if (type.includes('logistic') || type.includes('transport') || type.includes('delivery')) return '🚚'
  if (type.includes('water')) return '💧'
  if (type.includes('shelter') || type.includes('housing')) return '🏠'
  if (type.includes('education') || type.includes('school')) return '📚'
  if (type.includes('clothing') || type.includes('apparel')) return '👕'
  return '🏷️'
}

function formatCurrency(value) {
  return `RM ${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(Number(value || 0))}`
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

function formatCause(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
}

function getDaysLeft(value) {
  if (!value) return 'Ended'
  const today = new Date()
  const end = new Date(value)
  const diff = Math.ceil((end.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000)
  return diff <= 0 ? 'Ended' : String(diff)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
