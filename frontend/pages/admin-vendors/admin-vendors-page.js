import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import {
  approveVendor,
  getAdminVendors,
} from '../../services/admin-service.js'
import {
  createAdminVendorSummary,
  updateAdminVendorSummary,
} from './components/admin-vendor-summary.js'
import {
  createAdminVendorTable,
  renderAdminVendorError,
  renderAdminVendorRows,
} from './components/admin-vendor-table.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewAdminPage = session?.token && session.role === 'BANK_ADMIN'

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewAdminPage) {
  renderAccessDenied()
} else {
  renderAdminVendorPage()
}

function renderAdminVendorPage() {
  const content = document.createElement('div')
  content.className = 'admin-vendor-dashboard'
  content.innerHTML = `
    <section class="admin-vendor-hero">
      <div>
        <h1>Manage Vendors</h1>
        <p>Review vendor KYC submissions and approve vendors eligible for fund release.</p>
      </div>
      <button class="admin-vendor-queue-button" type="button">
        <span aria-hidden="true"></span>
        Open Review Queue
      </button>
    </section>
  `

  const summary = createAdminVendorSummary()
  const table = createAdminVendorTable()
  content.append(summary, table)

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-vendors',
    searchPlaceholder: 'Search vendors, SSM numbers, NGOs...',
    showHelp: true,
    content,
  })

  content.querySelector('.admin-vendor-queue-button')?.addEventListener('click', () => {
    table.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  table.addEventListener('click', (event) => handleTableAction(event, table, summary))
  loadVendors(table, summary)
}

async function loadVendors(table, summary) {
  try {
    const vendors = await getAdminVendors(session.token)
    updateAdminVendorSummary(summary, vendors)
    renderAdminVendorRows(table, vendors)
  } catch (error) {
    renderAdminVendorError(table, error.message)
  }
}

async function handleTableAction(event, table, summary) {
  const button = event.target.closest('[data-action="approve"]')
  if (!button || button.disabled) return

  button.disabled = true
  try {
    await approveVendor(session.token, button.dataset.vendorId)
    await loadVendors(table, summary)
  } catch (error) {
    renderAdminVendorError(table, error.message)
  } finally {
    button.disabled = false
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'admin-vendor-panel'
  panel.innerHTML = '<p class="admin-vendor-empty-cell">This page is only available for Bank Admin accounts.</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-vendors',
    content: panel,
  })
}
