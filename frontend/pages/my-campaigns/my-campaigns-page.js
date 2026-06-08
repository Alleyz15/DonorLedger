import { renderAppShell } from '../../components/layout/app-shell.js'
import { getNGOCampaigns } from '../../services/campaign-service.js'
import { getSession } from '../../services/auth-service.js'
import {
  bindCampaignTableControls,
  createCampaignsTable,
  renderCampaignError,
  renderCampaignRows,
} from './components/campaigns-table.js?v=13'
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
  content.innerHTML = `
    <header class="campaign-page-header">
      <div>
        <h1>My Campaigns</h1>
        <p>Track, manage, and grow your charitable initiatives.</p>
      </div>
    </header>
  `

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
    bindCampaignTableControls(table, campaigns)
  } catch (error) {
    renderCampaignError(table, error.message)
  }
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
