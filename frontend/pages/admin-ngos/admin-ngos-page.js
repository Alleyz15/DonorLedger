import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { approveNGO, getAdminNGOs, rejectNGO } from '../../services/admin-service.js'
import {
  createAdminNGOSummary,
  updateAdminNGOSummary,
} from './components/admin-ngo-summary.js'
import {
  createAdminNGOTable,
  renderAdminNGOError,
  renderAdminNGORows,
} from './components/admin-ngo-table.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewAdminPage = session?.token && session.role === 'BANK_ADMIN'

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewAdminPage) {
  renderAccessDenied()
} else {
  renderAdminNGOPage()
}

function renderAdminNGOPage() {
  const content = document.createElement('div')
  content.className = 'admin-ngo-dashboard'
  const summary = createAdminNGOSummary()
  const table = createAdminNGOTable()
  content.append(summary, table)

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-ngos',
    content,
  })

  table.addEventListener('click', (event) => handleTableAction(event, table, summary))
  loadNGOs(table, summary)
}

async function loadNGOs(table, summary) {
  try {
    const ngos = await getAdminNGOs(session.token)
    updateAdminNGOSummary(summary, ngos)
    renderAdminNGORows(table, ngos)
  } catch (error) {
    renderAdminNGOError(table, error.message)
  }
}

async function handleTableAction(event, table, summary) {
  const button = event.target.closest('[data-action]')
  if (!button) return

  const ngoId = button.dataset.ngoId
  button.disabled = true

  try {
    if (button.dataset.action === 'approve') {
      await approveNGO(session.token, ngoId)
    } else if (button.dataset.action === 'reject') {
      await rejectNGO(session.token, ngoId, 'Rejected by Bank Admin review')
    }
    await loadNGOs(table, summary)
  } catch (error) {
    renderAdminNGOError(table, error.message)
  } finally {
    button.disabled = false
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'admin-ngo-panel'
  panel.innerHTML = '<p class="admin-ngo-empty-cell">This page is only available for Bank Admin accounts.</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'admin-ngos',
    content: panel,
  })
}
