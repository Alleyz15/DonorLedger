const summaryItems = [
  { key: 'total', label: 'Total Campaigns' },
  { key: 'raised', label: 'Total Raised' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'frozen', label: 'Frozen' },
]

export function createAdminCampaignSummary() {
  const section = document.createElement('section')
  section.className = 'admin-campaign-summary-grid'
  section.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="admin-campaign-summary-card">
          <h2>${item.label}</h2>
          <strong data-campaign-summary="${item.key}">0</strong>
        </article>
      `
    )
    .join('')
  return section
}

export function updateAdminCampaignSummary(container, campaigns) {
  const counts = {
    total: campaigns.length,
    raised: formatRaised(campaigns.reduce((sum, campaign) => sum + Number(campaign.raisedAmount || 0), 0)),
    pending: campaigns.filter((campaign) => ['DRAFT', 'UNDER_REVIEW'].includes(campaign.status)).length,
    frozen: campaigns.filter((campaign) => campaign.status === 'FROZEN').length,
  }

  Object.entries(counts).forEach(([key, value]) => {
    const element = container.querySelector(`[data-campaign-summary="${key}"]`)
    if (element) element.textContent = String(value)
  })
}

function formatRaised(value) {
  if (value >= 1000000) return `RM ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `RM ${(value / 1000).toFixed(1)}K`
  return `RM ${new Intl.NumberFormat('en-MY').format(value)}`
}
