import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getCampaignDetails } from '../../services/campaign-service.js'
import { renderCampaignDetail } from './components/campaign-detail-view.js?v=5'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewDonorPage = session?.token && session.role === 'DONOR'
const campaignId = new URLSearchParams(window.location.search).get('id')

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewDonorPage) {
  renderAccessDenied()
} else {
  renderCampaignDetailsPage()
}

function renderCampaignDetailsPage() {
  const content = document.createElement('div')
  content.className = 'campaign-detail-page'
  content.innerHTML = '<p class="campaign-detail-state">Loading campaign...</p>'

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'donor-home',
    searchPlaceholder: 'Search campaigns...',
    showUserChevron: true,
    content,
  })

  loadCampaign(content)
}

async function loadCampaign(content) {
  if (!campaignId) {
    content.innerHTML = '<p class="campaign-detail-state is-error">Campaign id is missing.</p>'
    return
  }

  try {
    const campaign = await getCampaignDetails(campaignId)
    content.innerHTML = renderCampaignDetail(campaign)
  } catch (error) {
    content.innerHTML = `<p class="campaign-detail-state is-error">${escapeHtml(error.message)}</p>`
  }
}

function renderAccessDenied() {
  const content = document.createElement('div')
  content.className = 'campaign-detail-page'
  content.innerHTML = '<p class="campaign-detail-state">This page is only available for donor accounts.</p>'
  renderAppShell({ mount: shell, session, activeKey: 'donor-home', content })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
