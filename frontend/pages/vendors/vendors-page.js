import { renderAppShell } from '../../components/layout/app-shell.js?v=20260609-vendors'
import { getSession } from '../../services/auth-service.js?v=20260609-vendors'
import { getNGOVendors } from '../../services/vendor-service.js?v=20260609-vendors'
import {
  createVendorSummaryCards,
  updateVendorSummaryCards,
} from './components/vendor-summary-cards.js?v=20260609-vendors'
import {
  bindVendorTableControls,
  createVendorsTable,
  renderVendorError,
  renderVendorRows,
} from './components/vendors-table.js?v=20260609-vendors'

const shell = document.querySelector('#app-shell')
let session

try {
  session = getSession()
  const canViewNGOPage = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

  if (!session?.token) {
    window.location.href = './login.html'
  } else if (!canViewNGOPage) {
    renderAccessDenied()
  } else {
    renderVendorsPage()
  }
} catch (error) {
  renderStartupError(error)
}

async function renderVendorsPage() {
  const content = document.createElement('div')
  content.className = 'my-campaigns-dashboard vendor-dashboard'
  content.innerHTML = `
    <header class="campaign-page-header">
      <div>
        <h1>Vendors</h1>
        <p>Track submitted vendors and Bank Islam review outcomes.</p>
      </div>
    </header>
  `

  const summaryCards = createVendorSummaryCards()
  const table = createVendorsTable()
  content.append(summaryCards, table)

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'submit-vendor',
    content,
    searchPlaceholder: 'Search vendors, services...',
  })

  try {
    const vendors = await getNGOVendors(session.token)
    updateVendorSummaryCards(summaryCards, vendors)
    renderVendorRows(table, vendors)
    bindVendorTableControls(table, vendors)
  } catch (error) {
    renderVendorError(table, error.message)
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
    activeKey: 'submit-vendor',
    content: panel,
  })
}

function renderStartupError(error) {
  if (!shell) return

  shell.innerHTML = `
    <section class="vendor-startup-error">
      <h1>Vendor page could not start</h1>
      <p>${escapeHtml(error?.message || 'Unknown browser error')}</p>
      <a href="./my-campaigns.html">Back to My Campaigns</a>
    </section>
  `
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
