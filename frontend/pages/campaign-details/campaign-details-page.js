import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getCampaignDetails } from '../../services/campaign-service.js'
import { renderCampaignDetail } from './components/campaign-detail-view.js?v=8'

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
    initInteractions(content)
  } catch (error) {
    content.innerHTML = `<p class="campaign-detail-state is-error">${escapeHtml(error.message)}</p>`
  }
}

// Wires up the tab switcher, the progress bar fill animation, and the
// count-up animation on the "Total Raised" / "% Funded" figures.
function initInteractions(content) {
  // ── Tabs ──
  const tabButtons = content.querySelectorAll('[data-tab]')
  const tabPanels = content.querySelectorAll('[data-tab-panel]')
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      tabButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button))
      tabPanels.forEach((panel) => {
        const isActive = panel.dataset.tabPanel === button.dataset.tab
        panel.hidden = !isActive
        panel.classList.toggle('is-active', isActive)
      })
    })
  })

  // ── Progress bar fill ──
  const fill = content.querySelector('[data-progress-fill]')
  if (fill) {
    const target = Number(fill.dataset.width || 0)
    requestAnimationFrame(() => {
      fill.style.width = `${target}%`
    })
  }

  // ── Count-up numbers (Total Raised / % Funded) ──
  content.querySelectorAll('[data-countup]').forEach((el) => {
    const target = Number(el.dataset.target || 0)
    const prefix = el.dataset.prefix || ''
    const suffix = el.dataset.suffix || ''
    const duration = 900
    const start = performance.now()

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = Math.round(target * eased)
      el.textContent = `${prefix}${formatNumber(value)}${suffix}`
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-MY').format(Number(value || 0))
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
