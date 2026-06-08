import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getNGOEvidence } from '../../services/document-service.js'
import {
  createDocumentSummaryCards,
  updateDocumentSummaryCards,
} from './components/document-summary-cards.js'
import {
  bindDocumentTableControls,
  createDocumentsTable,
  renderDocumentError,
  renderDocumentRows,
} from './components/documents-table.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewNGOPage = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewNGOPage) {
  renderAccessDenied()
} else {
  renderDocumentManagementPage()
}

async function renderDocumentManagementPage() {
  const content = document.createElement('div')
  content.className = 'my-campaigns-dashboard document-dashboard'
  content.innerHTML = `
    <header class="campaign-page-header">
      <div>
        <h1>Document Management</h1>
        <p>Review submitted evidence packages and Bank Islam decisions.</p>
      </div>
    </header>
  `

  const summaryCards = createDocumentSummaryCards()
  const table = createDocumentsTable()
  content.append(summaryCards, table)

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'document-management',
    content,
    searchPlaceholder: 'Search documents, vendors...',
  })

  try {
    const evidenceItems = await getNGOEvidence(session.token)
    updateDocumentSummaryCards(summaryCards, evidenceItems)
    renderDocumentRows(table, evidenceItems)
    bindDocumentTableControls(table, evidenceItems)
  } catch (error) {
    renderDocumentError(table, error.message)
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'documents-panel'
  panel.innerHTML = `
    <div class="documents-empty-cell">
      This page is only available for NGO accounts.
    </div>
  `
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'document-management',
    content: panel,
  })
}
