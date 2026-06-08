import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getNGOEvidenceDetail } from '../../services/document-service.js'
import {
  createEvidenceDetailPage,
  renderEvidenceDetail,
  renderEvidenceDetailError,
} from './components/evidence-detail-component.js?v=2'

const session = getSession()
const shell = document.querySelector('#app-shell')
const query = new URLSearchParams(window.location.search)
const evidenceId = query.get('id')
const canViewNGOPage = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewNGOPage) {
  renderAccessDenied()
} else {
  renderPage()
}

async function renderPage() {
  const page = createEvidenceDetailPage()

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'document-management',
    content: page,
    searchPlaceholder: 'Search documents, vendors...',
  })

  if (!evidenceId) {
    renderEvidenceDetailError(page, 'No evidence ID provided.')
    return
  }

  try {
    const evidence = await getNGOEvidenceDetail(session.token, evidenceId)
    renderEvidenceDetail(page, evidence)
  } catch (error) {
    renderEvidenceDetailError(page, error.message)
  }
}

function renderAccessDenied() {
  const page = createEvidenceDetailPage()
  renderEvidenceDetailError(page, 'This page is only available for NGO accounts.')
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'document-management',
    content: page,
  })
}
