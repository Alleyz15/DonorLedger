import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getNGOVendors } from '../../services/vendor-service.js'
import {
  createVendorSummaryCards,
  updateVendorSummaryCards,
} from './components/vendor-summary-cards.js'
import {
  bindVendorTableControls,
  createVendorsTable,
  renderVendorError,
  renderVendorRows,
} from './components/vendors-table.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewNGOPage = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewNGOPage) {
  renderAccessDenied()
} else {
  renderVendorsPage()
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
