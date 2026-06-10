// ── Icons ──────────────────────────────────────────────────────────────
import { clearSession } from '../../services/auth-service.js'
import { getAdminAlerts } from '../../services/admin-service.js'

const ICONS = {
  'my-campaigns': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`,
  'submit-vendor': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`,
  'document-management': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
  'admin-dashboard': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  'admin-alerts': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  'admin-ngos': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  'admin-vendors': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  'admin-campaigns': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>`,
  'admin-evidence-reviews': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  'admin-audit-logs': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  'donor-home': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`,
  'donor-history': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><polyline points="12,8 12,12 14,14"/><path d="M3.05 11a9 9 0 1 0 .5-4"/><polyline points="3,3 3,7 7,7"/></svg>`,
  'logout': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  'default': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4"/></svg>`,
}

// ── Role menus ─────────────────────────────────────────────────────────
const roleMenus = {
  ORGANIZER: [
    { label: 'My Campaigns',        href: './my-campaigns.html',  activeKey: 'my-campaigns' },
    { label: 'Vendor',              href: './vendors.html',       activeKey: 'submit-vendor' },
    { label: 'Document Management', href: './document-management.html', activeKey: 'document-management' },
  ],
  BANK_ADMIN: [
    { label: 'Dashboard',        href: './admin-dashboard.html', activeKey: 'admin-dashboard' },
    { label: 'NGOs',             href: './admin-ngos.html',      activeKey: 'admin-ngos' },
    { label: 'Vendors',          href: './admin-vendors.html',   activeKey: 'admin-vendors' },
    { label: 'Campaigns',        href: './admin-campaigns.html', activeKey: 'admin-campaigns' },
    { label: 'Evidence Reviews', href: './admin-evidence.html',  activeKey: 'admin-evidence-reviews' },
    { label: 'Audit Logs',       href: './admin-audit.html',     activeKey: 'admin-audit-logs' },
  ],
  DONOR: [
    { label: 'Home',    href: './donor-campaigns.html', activeKey: 'donor-home' },
    { label: 'History', href: './donor-history.html',   activeKey: 'donor-history' },
  ],
}

// ── Main render ────────────────────────────────────────────────────────
export function renderAppShell({
  mount,
  session,
  activeKey,
  content,
  searchPlaceholder,
  showHelp = false,
  showUserChevron = false,
}) {
  if (!mount) return

  const role        = normalizeRole(session?.role)
  const displayName = session?.ngo?.name || session?.user?.name || session?.name || 'Account'
  const initials    = getInitials(displayName)
  const placeholder = searchPlaceholder
    || (role === 'BANK_ADMIN' ? 'Search transactions, NGOs...' : 'Search campaigns, transactions...')

  mount.innerHTML = `
    <aside class="app-sidebar">
      <a class="app-brand" href="${getRoleHome(role)}" aria-label="DonorLedger home">
        <span class="app-brand-mark">D</span>
        <span class="app-brand-name">Donor<em>Ledger</em></span>
      </a>

      <div class="app-menu-wrap">
        <div class="app-menu-section">
          <span class="app-menu-section-label">Navigation</span>
          <nav class="app-menu" aria-label="Main menu">
            ${renderMenu(role, activeKey)}
          </nav>
        </div>
      </div>
    </aside>

    <div class="app-main">
      <header class="app-header">
        <label class="app-search">
          <span aria-hidden="true"></span>
          <input type="search" placeholder="${escapeHtml(placeholder)}" aria-label="Search" />
        </label>

        <div class="app-header-end">
          ${renderHeaderActions(role, activeKey)}
          <div class="app-user" data-user-menu>
            <div class="app-user-info">
              <strong>${escapeHtml(displayName)}</strong>
              <span>${getRoleLabel(role)}</span>
            </div>
            <button class="app-avatar" type="button" title="Account menu" aria-label="Open account menu" aria-haspopup="menu" aria-expanded="false">
              ${escapeHtml(initials)}
            </button>
            <div class="app-user-dropdown" role="menu" aria-hidden="true">
              <button class="app-user-dropdown-item" type="button" role="menuitem" data-logout>
                <span class="app-user-dropdown-icon" aria-hidden="true">${ICONS.logout}</span>
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <section class="app-content"></section>
    </div>
  `

  // Mount page content
  mount.querySelector('.app-content')?.append(content)

  bindUserMenu(mount)
  bindAdminNotifications(mount, session, role)
}

// ── Helpers ────────────────────────────────────────────────────────────
function renderMenu(role, activeKey) {
  return getMenu(role)
    .map((item) => {
      const activeClass   = item.activeKey === activeKey ? ' is-active' : ''
      const disabledClass = item.disabled ? ' is-disabled' : ''
      const ariaDisabled  = item.disabled ? ' aria-disabled="true"' : ''
      const iconKey       = item.activeKey || 'default'
      const icon          = ICONS[iconKey] || ICONS['default']
      return `
        <a class="app-menu-link${activeClass}${disabledClass}"
           href="${item.href}"${ariaDisabled}>
          <span class="app-menu-icon-wrap" aria-hidden="true">${icon}</span>
          <span class="app-menu-link-label">${escapeHtml(item.label)}</span>
        </a>
      `
    })
    .join('')
}

function getMenu(role)           { return roleMenus[role] || [] }
function normalizeRole(role)     { return role === 'NGO' ? 'ORGANIZER' : role }

function renderHeaderActions(role, activeKey) {
  if (role !== 'BANK_ADMIN') return ''

  return `
    <div class="app-notification" data-admin-notifications>
      <button class="app-header-icon-button" type="button" title="Notifications" aria-label="Open notifications" aria-expanded="false" data-notification-toggle>
        ${ICONS['admin-alerts']}
        <span class="app-notification-dot" data-notification-dot hidden></span>
      </button>
      <section class="app-notification-panel" aria-label="Notifications" aria-hidden="true">
        <header class="app-notification-header">
          <h2>Notifications</h2>
        </header>
        <div class="app-notification-tabs" role="tablist" aria-label="Notification severity">
          ${renderNotificationTab('CRITICAL', 'Critical', true)}
          ${renderNotificationTab('WARNING', 'Warning')}
          ${renderNotificationTab('INFO', 'Info')}
        </div>
        <div class="app-notification-list" data-notification-list>
          <p class="app-notification-state">Loading notifications...</p>
        </div>
      </section>
    </div>
  `
}

function renderNotificationTab(value, label, active = false) {
  return `
    <button class="app-notification-tab${active ? ' is-active' : ''}" type="button" role="tab" aria-selected="${active}" data-notification-tab="${value}">
      ${escapeHtml(label)}
    </button>
  `
}

function getRoleHome(role) {
  if (role === 'BANK_ADMIN') return './admin-dashboard.html'
  if (role === 'ORGANIZER')  return './my-campaigns.html'
  if (role === 'DONOR')      return './donor-campaigns.html'
  return './introduction.html'
}

function bindUserMenu(mount) {
  const userMenu = mount.querySelector('[data-user-menu]')
  const avatarButton = userMenu?.querySelector('.app-avatar')
  const dropdown = userMenu?.querySelector('.app-user-dropdown')
  const logoutButton = userMenu?.querySelector('[data-logout]')

  if (!userMenu || !avatarButton || !dropdown || !logoutButton) return

  const setOpen = (isOpen) => {
    userMenu.classList.toggle('is-open', isOpen)
    avatarButton.setAttribute('aria-expanded', String(isOpen))
    dropdown.setAttribute('aria-hidden', String(!isOpen))
  }

  avatarButton.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(!userMenu.classList.contains('is-open'))
  })

  logoutButton.addEventListener('click', () => {
    clearSession()
    window.location.replace('./introduction.html')
  })

  document.addEventListener('click', (event) => {
    if (!userMenu.contains(event.target)) setOpen(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false)
  })
}

function bindAdminNotifications(mount, session, role) {
  if (role !== 'BANK_ADMIN') return

  const root = mount.querySelector('[data-admin-notifications]')
  const toggle = root?.querySelector('[data-notification-toggle]')
  const panel = root?.querySelector('.app-notification-panel')
  const dot = root?.querySelector('[data-notification-dot]')
  const list = root?.querySelector('[data-notification-list]')
  const tabs = Array.from(root?.querySelectorAll('[data-notification-tab]') || [])
  if (!root || !toggle || !panel || !list || !tabs.length) return

  let alerts = []
  let activeSeverity = 'CRITICAL'
  let loaded = false

  const setOpen = (isOpen) => {
    root.classList.toggle('is-open', isOpen)
    toggle.setAttribute('aria-expanded', String(isOpen))
    panel.setAttribute('aria-hidden', String(!isOpen))
    if (isOpen && !loaded) syncAlerts({ showLoading: true })
  }

  const render = () => {
    const filtered = alerts.filter((alert) => alert.severity === activeSeverity)
    if (!filtered.length) {
      list.innerHTML = `<p class="app-notification-state">No ${activeSeverity.toLowerCase()} notifications.</p>`
      return
    }

    list.innerHTML = filtered.slice(0, 8).map(renderNotificationItem).join('')
  }

  const syncAlerts = async ({ showLoading = false } = {}) => {
    loaded = true
    if (showLoading) {
      list.innerHTML = '<p class="app-notification-state">Loading notifications...</p>'
    }

    try {
      alerts = await getAdminAlerts(session.token)
      const hasUnread = alerts.some((alert) => !alert.delivered)
      if (dot) dot.hidden = !hasUnread
      if (showLoading || root.classList.contains('is-open')) render()
    } catch (error) {
      if (showLoading) {
        list.innerHTML = `<p class="app-notification-state is-error">${escapeHtml(error.message)}</p>`
      }
    }
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(!root.classList.contains('is-open'))
  })

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeSeverity = tab.dataset.notificationTab
      tabs.forEach((item) => {
        const isActive = item === tab
        item.classList.toggle('is-active', isActive)
        item.setAttribute('aria-selected', String(isActive))
      })
      render()
    })
  })

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) setOpen(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false)
  })

  syncAlerts({ showLoading: true })
  window.setInterval(() => syncAlerts(), 30000)
}

function renderNotificationItem(alert) {
  const organization = alert.campaign?.ngo?.name || 'Organization'
  const initial = getInitials(organization).charAt(0) || 'O'

  return `
    <article class="app-notification-item">
      <span class="app-notification-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <div class="app-notification-body">
        <div class="app-notification-item-top">
          <strong>${escapeHtml(organization)}</strong>
          <time>${formatNotificationDate(alert.createdAt)}</time>
        </div>
        <p>${escapeHtml(alert.message)}</p>
      </div>
    </article>
  `
}

function formatNotificationDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getRoleLabel(role) {
  if (role === 'ORGANIZER') return 'NGO ORGANIZER'
  if (role === 'BANK_ADMIN') return 'BANK ADMIN'
  if (role === 'DONOR')      return 'PLATINUM DONOR'
  return 'ACCOUNT'
}

function getInitials(value) {
  return String(value || 'Account')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
