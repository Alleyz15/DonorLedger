import { renderAppShell } from '../../components/layout/app-shell.js?v=20260610-alert-popover'
import { getSession } from '../../services/auth-service.js'
import {
  approveCampaign,
  getAdminCampaigns,
  rejectCampaign,
  unfreezeCampaign,
} from '../../services/admin-service.js'
import {
  createAdminCampaignSummary,
  updateAdminCampaignSummary,
} from './components/admin-campaign-summary.js'
import {
  createAdminCampaignTable,
  renderAdminCampaignError,
  renderAdminCampaignRows,
} from './components/admin-campaign-table.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewAdminPage = session?.token && session.role === 'BANK_ADMIN'

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewAdminPage) {
  renderAccessDenied()
} else {
  renderAdminCampaignPage()
}

function renderAdminCampaignPage() {
  const content = document.createElement('div')
  content.className = 'admin-campaign-dashboard'
  content.innerHTML = `
    <section class="admin-review-hero">
      <div>
        <h1>Manage Campaigns</h1>
        <p>Approve or reject NGO campaign applications before they go live.</p>
      </div>
      <button class="admin-review-queue-button" type="button">Open Review Queue</button>
    </section>
  `

  const summary = createAdminCampaignSummary()
  const table = createAdminCampaignTable()
  content.append(summary, table)

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-campaigns',
    searchPlaceholder: 'Search campaigns, NGOs...',
    content,
  })

  content.querySelector('.admin-review-queue-button')?.addEventListener('click', () => {
    table.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  table.addEventListener('click', (event) => handleCampaignAction(event, table, summary))
  loadCampaigns(table, summary)
}

async function loadCampaigns(table, summary) {
  try {
    const campaigns = await getAdminCampaigns(session.token)
    updateAdminCampaignSummary(summary, campaigns)
    renderAdminCampaignRows(table, campaigns)
  } catch (error) {
    renderAdminCampaignError(table, error.message)
  }
}

async function handleCampaignAction(event, table, summary) {
  const button = event.target.closest('[data-action]')
  if (!button || button.disabled) return

  const campaignId = button.dataset.campaignId
  const action = button.dataset.action
  button.disabled = true

  try {
    if (action === 'approve') {
      await approveCampaign(session.token, campaignId)
    } else if (action === 'reject') {
      const reason = window.prompt('Reason for rejecting this campaign?', 'Rejected by Bank Admin review')
      if (!reason) return
      await rejectCampaign(session.token, campaignId, reason)
    } else if (action === 'unfreeze') {
      await unfreezeCampaign(session.token, campaignId)
    }
    await loadCampaigns(table, summary)
  } catch (error) {
    renderAdminCampaignError(table, error.message)
  } finally {
    button.disabled = false
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'admin-campaign-panel'
  panel.innerHTML = '<p class="admin-campaign-empty-cell">This page is only available for Bank Admin accounts.</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-campaigns',
    content: panel,
  })
}
