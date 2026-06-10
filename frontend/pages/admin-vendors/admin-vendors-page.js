import { renderAppShell } from '../../components/layout/app-shell.js?v=20260610-alert-popover'
import { getSession } from '../../services/auth-service.js'
import {
  approveVendor,
  getAdminVendors,
  rejectVendor,
} from '../../services/admin-service.js'
import { API_BASE_URL } from '../../config/api-config.js'

const FILES_BASE = API_BASE_URL.replace(/\/api$/, '')
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
let vendorCache = []

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

  // The drawer is appended to document.body (outside #app-shell), so we must
  // listen on document.body — not on content — otherwise the X and Close
  // buttons are outside the listener's subtree and clicks are never captured.
  document.body.addEventListener('click', (event) => handleDrawerAction(event, table, summary))

  loadVendors(table, summary)
}

async function loadVendors(table, summary) {
  try {
    const vendors = await getAdminVendors(session.token)
    vendorCache = vendors
    updateAdminVendorSummary(summary, vendors)
    renderAdminVendorRows(table, vendors)
  } catch (error) {
    renderAdminVendorError(table, error.message)
  }
}

async function handleTableAction(event, table, summary) {
  const button = event.target.closest('[data-action="review"]')
  if (!button) return

  const vendor = vendorCache.find((item) => item.id === button.dataset.vendorId)
  if (vendor) openVendorDrawer(vendor)
}

async function handleDrawerAction(event, table, summary) {
  const closeButton = event.target.closest('[data-close-vendor-drawer]')
  if (closeButton || event.target.classList.contains('admin-vendor-drawer')) {
    closeVendorDrawer()
    return
  }

  const actionButton = event.target.closest('[data-vendor-review-action]')
  if (!actionButton) return

  const vendorId = actionButton.dataset.vendorId
  const action = actionButton.dataset.vendorReviewAction
  actionButton.disabled = true

  try {
    if (action === 'approve') {
      await approveVendor(session.token, vendorId)
    } else if (action === 'reject') {
      const reason = window.prompt('Reason for rejecting this vendor?', 'Rejected by Bank Admin review')
      if (!reason) return
      await rejectVendor(session.token, vendorId, reason)
    }
    closeVendorDrawer()
    await loadVendors(table, summary)
  } catch (error) {
    const status = document.querySelector('[data-vendor-drawer-status]')
    if (status) {
      status.textContent = error.message
      status.dataset.status = 'error'
    }
  } finally {
    actionButton.disabled = false
  }
}

function openVendorDrawer(vendor) {
  closeVendorDrawer()
  const drawer = document.createElement('aside')
  drawer.className = 'admin-vendor-drawer'
  drawer.innerHTML = `
    <section class="admin-vendor-drawer-card" role="dialog" aria-modal="true" aria-labelledby="vendor-review-title">
      <button class="admin-vendor-drawer-close" type="button" data-close-vendor-drawer aria-label="Close vendor review">×</button>
      <p>Vendor KYC Review</p>
      <h2 id="vendor-review-title">${escapeHtml(vendor.name)}</h2>
      <dl>
        <div><dt>SSM Number</dt><dd>${escapeHtml(vendor.ssmNumber || '-')}</dd></div>
        <div><dt>Service Type</dt><dd>${escapeHtml(vendor.serviceType || '-')}</dd></div>
        <div><dt>Submitted By NGO</dt><dd>${escapeHtml(vendor.ngo?.name || '-')}</dd></div>
        <div><dt>NGO Registration</dt><dd>${escapeHtml(vendor.ngo?.registrationNum || '-')}</dd></div>
        <div><dt>Bank Account</dt><dd>${escapeHtml(vendor.bankAccount || '-')}</dd></div>
        <div><dt>Wallet Address</dt><dd>${escapeHtml(vendor.walletAddress || '-')}</dd></div>
        <div><dt>Registration Document</dt><dd>${
          vendor.registrationDoc
            ? `<a href="${FILES_BASE}${escapeHtml(vendor.registrationDoc)}" target="_blank" rel="noreferrer" style="color:#065f46;font-weight:800;text-decoration:underline">📄 View Document</a>`
            : 'Not uploaded'
        }</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(vendor.status)}</dd></div>
        ${vendor.rejectedReason ? `<div><dt>Rejected Reason</dt><dd>${escapeHtml(vendor.rejectedReason)}</dd></div>` : ''}
      </dl>
      <div class="form-status" data-vendor-drawer-status role="status" aria-live="polite"></div>
      <footer>
        ${
          vendor.status === 'PENDING_KYC'
            ? `
              <button class="admin-vendor-drawer-reject" type="button" data-vendor-review-action="reject" data-vendor-id="${escapeHtml(vendor.id)}">Reject</button>
              <button class="admin-vendor-drawer-approve" type="button" data-vendor-review-action="approve" data-vendor-id="${escapeHtml(vendor.id)}">Approve Vendor</button>
            `
            : '<button class="admin-vendor-drawer-approve" type="button" data-close-vendor-drawer>Close</button>'
        }
      </footer>
    </section>
  `
  document.body.append(drawer)
}

function closeVendorDrawer() {
  document.querySelector('.admin-vendor-drawer')?.remove()
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
