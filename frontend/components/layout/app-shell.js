// ── Icons ──────────────────────────────────────────────────────────────
import { clearSession } from '../../services/auth-service.js'

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
    { label: 'Vendor',              href: './submit-vendor.html', activeKey: 'submit-vendor' },
    { label: 'Document Management', href: '#',                    activeKey: 'document-management', disabled: true },
  ],
  BANK_ADMIN: [
    { label: 'Dashboard',        href: './admin-dashboard.html', activeKey: 'admin-dashboard' },
    { label: 'Alerts',           href: './admin-alerts.html',    activeKey: 'admin-alerts' },
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
      <a class="app-brand" href="./introduction.html" aria-label="DonorLedger home">
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
    window.location.href = './login.html'
  })

  document.addEventListener('click', (event) => {
    if (!userMenu.contains(event.target)) setOpen(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false)
  })
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
