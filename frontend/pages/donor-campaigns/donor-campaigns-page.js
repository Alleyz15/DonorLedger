import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getActiveCampaigns } from '../../services/campaign-service.js'
import { renderCampaignCards } from './components/campaign-card.js?v=3'

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

function renderDonorCampaignsPage() {
  const content = document.createElement('div')
  content.className = 'donor-campaign-page'
  content.innerHTML = `
    <header class="donor-page-heading">
      <h1>Active Campaigns</h1>
      <button class="donor-filter-button" type="button"><span aria-hidden="true"></span>Filter</button>
    </header>
    <section class="donor-campaign-grid" data-campaign-grid>
      <p class="donor-empty-state">Loading campaigns...</p>
    </section>
  `

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'donor-home',
    searchPlaceholder: 'Search for anything...',
    showUserChevron: true,
    content,
  })

  loadCampaigns(content)
}

async function loadCampaigns(content) {
  const grid = content.querySelector('[data-campaign-grid]')
  try {
    const campaigns = await getActiveCampaigns()
    grid.innerHTML = renderCampaignCards(campaigns)
  } catch (error) {
    grid.innerHTML = `<p class="donor-empty-state is-error">${escapeHtml(error.message)}</p>`
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'donor-campaign-page'
  panel.innerHTML = '<p class="donor-empty-state">This page is only available for donor accounts.</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'donor-home',
    content: panel,
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
