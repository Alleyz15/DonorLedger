import { renderAppShell } from '../../components/layout/app-shell.js?v=20260609-logout-welcome'
import { getSession } from '../../services/auth-service.js'
import { getActiveCampaigns } from '../../services/campaign-service.js'
import { createDonorSummaryCards, updateDonorSummaryCards } from './components/donor-summary-cards.js'
import {
  createDonorCampaignsGrid,
  renderDonorCampaignRows,
  bindDonorTableControls,
  renderDonorCampaignError,
} from './components/donor-campaigns-grid.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewDonorPage = session?.token && session.role === 'DONOR'

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewDonorPage) {
  renderAccessDenied()
} else {
  renderDonorCampaignsPage()
}

async function renderDonorCampaignsPage() {
  const content = document.createElement('div')
  content.className = 'donor-dashboard'

  const summaryCards = createDonorSummaryCards()
  const grid = createDonorCampaignsGrid()
  content.append(summaryCards, grid)

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'donor-home',
    searchPlaceholder: 'Search for anything...',
    showUserChevron: true,
    content,
  })

  try {
    const campaigns = await getActiveCampaigns()
    updateDonorSummaryCards(summaryCards, campaigns)
    renderDonorCampaignRows(grid, campaigns)
    bindDonorTableControls(grid, campaigns)
  } catch (error) {
    renderDonorCampaignError(grid, error.message)
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'donor-dashboard'
  panel.innerHTML = '<p class="donor-empty-cell" style="padding:48px;text-align:center;color:#64748b;font-size:16px;">This page is only available for donor accounts.</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'donor-home',
    content: panel,
  })
}
