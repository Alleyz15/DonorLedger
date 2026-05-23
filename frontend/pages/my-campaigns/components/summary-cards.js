const summaryItems = [
  { key: 'total', label: 'Total Campaigns', icon: 'megaphone' },
  { key: 'active', label: 'Active Campaigns', icon: 'calendar' },
  { key: 'completed', label: 'Completed', icon: 'check' },
  { key: 'flagged', label: 'Flagged Campaigns', icon: 'warning' },
]

export function createSummaryCards() {
  const section = document.createElement('section')
  section.className = 'campaign-summary-grid'
  section.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="campaign-summary-card">
          <span class="summary-icon summary-icon-${item.icon}" aria-hidden="true"></span>
          <h2>${item.label}</h2>
          <strong data-summary="${item.key}">0</strong>
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
      ['FROZEN', 'UNDER_REVIEW', 'REJECTED'].includes(campaign.status)
    ).length,
  }

  Object.entries(counts).forEach(([key, value]) => {
    const element = container.querySelector(`[data-summary="${key}"]`)
    if (element) element.textContent = String(value)
  })
}
