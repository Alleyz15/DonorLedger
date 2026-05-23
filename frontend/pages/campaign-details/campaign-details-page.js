import { getSession } from '../../services/auth-service.js'
import { getCampaignDetails } from '../../services/campaign-service.js'
import { renderCampaignDetail } from './components/campaign-detail-view.js'

const session = getSession()
const root = document.querySelector('#campaign-detail-root')
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
  root.innerHTML = '<p class="campaign-detail-state">Loading campaign...</p>'
  loadCampaign()
}

async function loadCampaign() {
  if (!campaignId) {
    root.innerHTML = '<p class="campaign-detail-state is-error">Campaign id is missing.</p>'
    return
  }

  try {
    const campaign = await getCampaignDetails(campaignId)
    root.innerHTML = renderCampaignDetail(campaign)
  } catch (error) {
    root.innerHTML = `<p class="campaign-detail-state is-error">${escapeHtml(error.message)}</p>`
  }
}

function renderAccessDenied() {
  root.innerHTML = '<p class="campaign-detail-state">This page is only available for donor accounts.</p>'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
