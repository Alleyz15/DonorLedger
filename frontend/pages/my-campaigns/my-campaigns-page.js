import { renderAppShell } from '../../components/layout/app-shell.js'
import { getNGOCampaigns } from '../../services/campaign-service.js'
import { getSession } from '../../services/auth-service.js'
import {
  createCampaignsTable,
  renderCampaignError,
  renderCampaignRows,
} from './components/campaigns-table.js?v=5'
import { createSummaryCards, updateSummaryCards } from './components/summary-cards.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewNGOPage = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewNGOPage) {
  renderAccessDenied()
} else {
  renderMyCampaignsPage()
}

async function renderMyCampaignsPage() {
  const content = document.createElement('div')
  content.className = 'my-campaigns-dashboard'
  const summaryCards = createSummaryCards()
  const table = createCampaignsTable()
  content.append(summaryCards, table)
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'my-campaigns',
    content,
  })

  try {
    const campaigns = await getNGOCampaigns(session.token)
    updateSummaryCards(summaryCards, campaigns)
    renderCampaignRows(table, campaigns)
    patchDraftRows(table, campaigns)
  } catch (error) {
    renderCampaignError(table, error.message)
  }
}

// Patch draft rows directly in the DOM in case campaigns-table.js is cached.
// Finds every row whose status badge says the old "Pending Review" text,
// cross-checks against the campaigns data, and replaces with Draft + Edit button.
function patchDraftRows(table, campaigns) {
  const tbody = table.querySelector('[data-campaign-rows]')
  if (!tbody) return

  const rows = Array.from(tbody.querySelectorAll('tr'))
  rows.forEach((row, index) => {
    const campaign = campaigns[index]
    if (!campaign) return

    if (campaign.status === 'DRAFT') {
      // Fix status badge
      const badge = row.querySelector('.campaign-status')
      if (badge) {
        badge.textContent = 'Draft'
        badge.className = 'campaign-status is-draft'
      }

      // Fix action cell — replace anything in it with Edit Draft link
      const cells = row.querySelectorAll('td')
      const actionCell = cells[5] // Actions is the 6th column (index 5)
      if (actionCell) {
        actionCell.innerHTML = `<a class="campaign-action-button" href="./start-campaign.html?campaignId=${encodeURIComponent(campaign.id)}">Edit Draft</a>`
      }
    }
  })
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'campaigns-panel'
  panel.innerHTML = `
    <div class="campaigns-empty-cell">
      This page is only available for NGO accounts.
    </div>
  `
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'my-campaigns',
    content: panel,
  })
}
