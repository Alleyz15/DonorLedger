import { API_BASE_URL } from '../../config/api-config.js'
import { renderAppShell } from '../../components/layout/app-shell.js?v=20260610-alert-popover'
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
let ngoCache = []

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
  content.innerHTML = `
    <section class="admin-review-hero">
      <div>
        <h1>Manage NGOs</h1>
        <p>Review NGO KYC applications and manage verified organizations.</p>
      </div>
    </section>
  `
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

  // The drawer is appended to document.body (outside #app-shell), so we must
  // listen on document.body — not on content — otherwise the X and action
  // buttons are outside the listener's subtree and clicks are never captured.
  document.body.addEventListener('click', (event) => handleDrawerAction(event, table, summary))

  loadNGOs(table, summary)
}

async function loadNGOs(table, summary) {
  try {
    const ngos = await getAdminNGOs(session.token)
    ngoCache = ngos
    updateAdminNGOSummary(summary, ngos)
    renderAdminNGORows(table, ngos)
  } catch (error) {
    renderAdminNGOError(table, error.message)
  }
}

async function handleTableAction(event, table, summary) {
  const button = event.target.closest('[data-action]')
  if (!button) return

  if (button.dataset.action === 'view') {
    const ngo = ngoCache.find((item) => item.id === button.dataset.ngoId)
    if (ngo) openNGODrawer(ngo)
    return
  }

  const ngoId = button.dataset.ngoId
  button.disabled = true

  try {
    if (button.dataset.action === 'approve') {
      await approveNGO(session.token, ngoId)
    } else if (button.dataset.action === 'reject') {
      const reason = window.prompt('Reason for rejecting this NGO?', 'Rejected by Bank Admin review')
      if (!reason) return
      await rejectNGO(session.token, ngoId, reason)
    }
    await loadNGOs(table, summary)
  } catch (error) {
    renderAdminNGOError(table, error.message)
  } finally {
    button.disabled = false
  }
}

async function handleDrawerAction(event, table, summary) {
  const closeButton = event.target.closest('[data-close-ngo-drawer]')
  if (closeButton || event.target.classList.contains('admin-ngo-drawer')) {
    closeNGODrawer()
    return
  }

  const actionButton = event.target.closest('[data-ngo-review-action]')
  if (!actionButton) return

  const ngoId = actionButton.dataset.ngoId
  const action = actionButton.dataset.ngoReviewAction
  actionButton.disabled = true

  try {
    if (action === 'approve') {
      await approveNGO(session.token, ngoId)
    } else if (action === 'reject') {
      const reason = window.prompt('Reason for rejecting this NGO?', 'Rejected by Bank Admin review')
      if (!reason) return
      await rejectNGO(session.token, ngoId, reason)
    }
    closeNGODrawer()
    await loadNGOs(table, summary)
  } catch (error) {
    const status = document.querySelector('[data-ngo-drawer-status]')
    if (status) {
      status.textContent = error.message
      status.dataset.status = 'error'
    }
  } finally {
    actionButton.disabled = false
  }
}

function openNGODrawer(ngo) {
  closeNGODrawer()
  const drawer = document.createElement('aside')
  drawer.className = 'admin-ngo-drawer'
  drawer.innerHTML = `
    <section class="admin-ngo-drawer-card" role="dialog" aria-modal="true" aria-labelledby="ngo-review-title">
      <button class="admin-ngo-drawer-close" type="button" data-close-ngo-drawer aria-label="Close NGO details">×</button>
      <p>NGO Registration Details</p>
      <h2 id="ngo-review-title">${escapeHtml(ngo.name)}</h2>
      <dl>
        <div><dt>Organisation Name</dt><dd>${escapeHtml(ngo.name || '-')}</dd></div>
        <div><dt>Registration Type</dt><dd>${escapeHtml(ngo.registrationType || '-')}</dd></div>
        <div><dt>Registration Number</dt><dd>${escapeHtml(ngo.registrationNum || '-')}</dd></div>
        <div><dt>Registered Address</dt><dd>${escapeHtml(ngo.registeredAddress || '-')}</dd></div>
        <div><dt>Contact Email</dt><dd>${escapeHtml(ngo.contactEmail || '-')}</dd></div>
        <div><dt>Contact Phone</dt><dd>${escapeHtml(ngo.contactPhone || '-')}</dd></div>
      </dl>

      <p class="admin-ngo-drawer-section-title">Board of Directors</p>
      <dl>
        ${renderDirectors(ngo.directors)}
      </dl>

      <p class="admin-ngo-drawer-section-title">Banking Details</p>
      <dl>
        <div><dt>Bank Name</dt><dd>${escapeHtml(ngo.bankName || '-')}</dd></div>
        <div><dt>Bank Account</dt><dd>${escapeHtml(ngo.bankAccount || '-')}</dd></div>
      </dl>

      <p class="admin-ngo-drawer-section-title">Cause &amp; Mission</p>
      <dl>
        <div><dt>Cause Category</dt><dd>${escapeHtml(ngo.causeType || '-')}</dd></div>
        <div><dt>Mission Statement</dt><dd>${escapeHtml(ngo.description || '-')}</dd></div>
      </dl>

      <p class="admin-ngo-drawer-section-title">Proposed Fund Allocation</p>
      <dl>
        <div><dt>Aid / Beneficiaries</dt><dd>${formatPercent(ngo.aidPercent)}</dd></div>
        <div><dt>Logistics</dt><dd>${formatPercent(ngo.logisticsPercent)}</dd></div>
        <div><dt>Admin Costs</dt><dd>${formatPercent(ngo.adminPercent)}</dd></div>
      </dl>

      <p class="admin-ngo-drawer-section-title">Submitted Documents</p>
      <dl>
        <div><dt>SSM / ROS Certificate</dt><dd>${renderDocumentLink(ngo.registrationDoc)}</dd></div>
        <div><dt>Audited Financial Statement</dt><dd>${renderDocumentLink(ngo.financialDoc)}</dd></div>
      </dl>

      <div class="form-status" data-ngo-drawer-status role="status" aria-live="polite"></div>
      <footer>
        ${
          ngo.status === 'PENDING_KYC'
            ? `
              <button class="admin-ngo-drawer-reject" type="button" data-ngo-review-action="reject" data-ngo-id="${escapeHtml(ngo.id)}">Reject</button>
              <button class="admin-ngo-drawer-approve" type="button" data-ngo-review-action="approve" data-ngo-id="${escapeHtml(ngo.id)}">Verify NGO</button>
            `
            : '<button class="admin-ngo-drawer-approve" type="button" data-close-ngo-drawer>Close</button>'
        }
      </footer>
    </section>
  `
  document.body.append(drawer)
}

// API_BASE_URL points at .../api — uploaded files are served from the
// server root (e.g. /uploads/ngo-registration/...), so strip the /api suffix.
const FILE_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '')

function renderDirectors(directors) {
  if (!Array.isArray(directors) || directors.length === 0) {
    return '<div><dt>Director 1</dt><dd>-</dd></div>'
  }
  return directors
    .map((director, index) => {
      const number = index + 1
      const name = escapeHtml(director?.name || '-')
      const mykad = escapeHtml(director?.mykad || '-')
      return `<div><dt>Director ${number}</dt><dd>${name} &mdash; ${mykad}</dd></div>`
    })
    .join('')
}

function formatPercent(value) {
  return value === null || value === undefined ? '-' : `${value}%`
}

function renderDocumentLink(path) {
  if (!path) return '-'
  const url = `${FILE_BASE_URL}${path}`
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View document</a>`
}

function closeNGODrawer() {
  document.querySelector('.admin-ngo-drawer')?.remove()
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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
