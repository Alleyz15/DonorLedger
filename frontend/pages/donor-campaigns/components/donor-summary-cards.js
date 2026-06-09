const summaryItems = [
  {
    key: 'total',
    label: 'Total Campaigns',
    icon: 'grid',
    meta: 'All available campaigns',
  },
  {
    key: 'active',
    label: 'Active Campaigns',
    icon: 'pulse',
    meta: 'Open for donations',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: 'check',
    meta: 'Finished fundraising',
  },
  {
    key: 'funded',
    label: 'Fully Funded',
    icon: 'heart',
    meta: 'Target reached',
  },
]

export function createDonorSummaryCards() {
  const section = document.createElement('section')
  section.className = 'donor-summary-grid'
  section.setAttribute('aria-label', 'Campaign statistics')
  section.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="donor-summary-card">
          <span class="donor-summary-icon donor-summary-icon-${item.icon}" aria-hidden="true"></span>
          <p>${item.label}</p>
          <strong data-donor-summary="${item.key}">0</strong>
          <span>${item.meta}</span>
        </article>
      `
    )
    .join('')
  return section
}

export function updateDonorSummaryCards(container, campaigns) {
  const counts = {
    total: campaigns.length,
    active: campaigns.filter((c) => {
      const target = Number(c.target ?? c.targetAmount ?? 0)
      const raised = Number(c.raised ?? c.raisedAmount ?? 0)
      return target <= 0 || raised < target
    }).length,
    completed: 0,
    funded: campaigns.filter((c) => {
      const target = Number(c.target ?? c.targetAmount ?? 0)
      const raised = Number(c.raised ?? c.raisedAmount ?? 0)
      return target > 0 && raised >= target
    }).length,
  }

  Object.entries(counts).forEach(([key, value]) => {
    const element = container.querySelector(`[data-donor-summary="${key}"]`)
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
