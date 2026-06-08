const summaryItems = [
  {
    key: 'total',
    label: 'Total Campaigns',
    icon: 'grid',
    meta: 'All campaign applications',
  },
  {
    key: 'active',
    label: 'Active Campaigns',
    icon: 'pulse',
    meta: 'Live and receiving donations',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: 'check',
    meta: 'Finished fundraising cycles',
  },
  {
    key: 'flagged',
    label: 'Flagged',
    icon: 'flag',
    meta: 'Requires your attention',
  },
]

export function createSummaryCards() {
  const section = document.createElement('section')
  section.className = 'campaign-summary-grid'
  section.setAttribute('aria-label', 'Campaign statistics')
  section.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="campaign-summary-card">
          <span class="summary-icon summary-icon-${item.icon}" aria-hidden="true"></span>
          <p>${item.label}</p>
          <strong data-summary="${item.key}">0</strong>
          <span>${item.meta}</span>
        </article>
      `
    )
    .join('')
  return section
}

export function updateSummaryCards(container, campaigns) {
  const counts = {
    total: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === 'ACTIVE').length,
    completed: campaigns.filter((campaign) => campaign.status === 'COMPLETED').length,
    flagged: campaigns.filter((campaign) =>
      ['FROZEN', 'REJECTED'].includes(campaign.status)
    ).length,
  }

  Object.entries(counts).forEach(([key, value]) => {
    const element = container.querySelector(`[data-summary="${key}"]`)
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
