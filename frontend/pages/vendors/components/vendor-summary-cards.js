const summaryItems = [
  {
    key: 'total',
    label: 'Total Vendors',
    icon: 'grid',
    meta: 'All submitted vendors',
  },
  {
    key: 'approved',
    label: 'Approved Vendors',
    icon: 'check',
    meta: 'Ready for campaign use',
  },
  {
    key: 'pending',
    label: 'Pending Reviews',
    icon: 'pulse',
    meta: 'Awaiting Bank Islam review',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    icon: 'flag',
    meta: 'Not approved for use',
  },
]

export function createVendorSummaryCards() {
  const section = document.createElement('section')
  section.className = 'campaign-summary-grid vendor-summary-grid'
  section.setAttribute('aria-label', 'Vendor statistics')
  section.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="campaign-summary-card vendor-summary-card">
          <span class="summary-icon summary-icon-${item.icon}" aria-hidden="true"></span>
          <p>${item.label}</p>
          <strong data-vendor-summary="${item.key}">0</strong>
          <span>${item.meta}</span>
        </article>
      `
    )
    .join('')
  return section
}

export function updateVendorSummaryCards(container, vendors) {
  const counts = {
    total: vendors.length,
    approved: vendors.filter((vendor) => vendor.status === 'APPROVED').length,
    pending: vendors.filter((vendor) => vendor.status === 'PENDING_KYC').length,
    rejected: vendors.filter((vendor) => vendor.status === 'REJECTED').length,
  }

  Object.entries(counts).forEach(([key, value]) => {
    const element = container.querySelector(`[data-vendor-summary="${key}"]`)
    if (element) animateCount(element, value)
  })
}

function animateCount(element, target) {
  const duration = 600
  const start = performance.now()

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    element.textContent = String(Math.round(target * eased))
    if (progress < 1) requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}
