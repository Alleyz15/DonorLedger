const imageMap = [
  { test: /medical|health|surgery|aid/i, image: './assets/medicaid-alliance.png', tag: 'MEDICAL AID' },
  { test: /environment|forest|ocean|water|clean|climate|eco/i, image: './assets/earthcare-sustainability-charity.png', tag: 'ENVIRONMENT' },
  { test: /school|education|community|poverty|relief/i, image: './assets/children-education.png', tag: 'COMMUNITY' },
]

export function renderCampaignCards(campaigns) {
  if (!campaigns.length) {
    return '<p class="donor-empty-state">No active campaigns are available right now.</p>'
  }

  return campaigns.map(renderCampaignCard).join('')
}

function renderCampaignCard(campaign) {
  const visual = getCampaignVisual(campaign)
  return `
    <article class="donor-campaign-card">
      <div class="donor-campaign-image" style="background-image: url('${visual.image}')">
        <span>${visual.tag}</span>
      </div>
      <div class="donor-campaign-body">
        <h2>${escapeHtml(campaign.name)}</h2>
        <p class="donor-campaign-ngo"><span aria-hidden="true"></span>${escapeHtml(campaign.ngoName || 'Verified NGO')}</p>
        <p class="donor-verified"><span aria-hidden="true"></span>Verified by Bank Islam</p>
        <div class="donor-campaign-stats">
          <div>
            <span>Donors</span>
            <strong>${formatNumber(campaign.donorCount || 0)}</strong>
          </div>
          <div>
            <span>Days Left</span>
            <strong>${getDaysLeft(campaign.endDate)}</strong>
          </div>
        </div>
        <a class="donor-details-button" href="./campaign-details.html?id=${encodeURIComponent(campaign.id)}">
          View Details
        </a>
      </div>
    </article>
  `
}

function getCampaignVisual(campaign) {
  const value = `${campaign.causeType || ''} ${campaign.name || ''}`
  return imageMap.find((item) => item.test.test(value)) || {
    image: './assets/global-relief.png',
    tag: 'COMMUNITY',
  }
}

function getDaysLeft(value) {
  if (!value) return '0'
  const today = new Date()
  const end = new Date(value)
  const diff = Math.ceil((end.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000)
  return String(Math.max(0, diff))
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-MY').format(Number(value || 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
