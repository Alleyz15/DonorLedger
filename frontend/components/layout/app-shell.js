const roleMenus = {
  ORGANIZER: [
    { label: 'My Campaigns',    href: './my-campaigns.html',  activeKey: 'my-campaigns' },
    { label: 'Register Vendor', href: './submit-vendor.html', activeKey: 'submit-vendor' },
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
    { label: 'Home', href: './donor-campaigns.html', activeKey: 'donor-home', icon: 'home' },
    { label: 'History', href: './donor-history.html', activeKey: 'donor-history', icon: 'history' },
  ],
}

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

  const role = normalizeRole(session?.role)
  const displayName =
    session?.ngo?.name || session?.user?.name || session?.name || 'Account'
  const initials = getInitials(displayName)
  const placeholder =
    searchPlaceholder ||
    (role === 'BANK_ADMIN' ? 'Search transactions...' : 'Search campaigns, transactions...')

  mount.innerHTML = `
    <aside class="app-sidebar">
      <a class="app-brand" href="./introduction.html" aria-label="DonorLedger home">
        <span class="app-brand-mark">D</span>
        <span>DonorLedger</span>
      </a>
      <nav class="app-menu" aria-label="Main menu">
        ${renderMenu(role, activeKey)}
      </nav>
    </aside>
    <div class="app-main">
      <header class="app-header">
        <label class="app-search">
          <span aria-hidden="true"></span>
          <input type="search" placeholder="${escapeHtml(placeholder)}" />
        </label>
        ${showHelp ? '<button class="app-help-button" type="button" aria-label="Help">?</button>' : ''}
        <div class="app-user">
          <div>
            <strong>${escapeHtml(displayName)}</strong>
            <span>${getRoleLabel(role)}</span>
          </div>
          <button class="app-avatar" type="button" title="Logout">${escapeHtml(initials)}</button>
          ${showUserChevron ? '<span class="app-user-chevron" aria-hidden="true"></span>' : ''}
        </div>
      </header>
      <section class="app-content"></section>
    </div>
  `

  mount.querySelector('.app-content')?.append(content)
  mount.querySelector('.app-avatar')?.addEventListener('click', () => {
    localStorage.removeItem('donorledger.auth')
    window.location.href = './login.html'
  })
}

function renderMenu(role, activeKey) {
  return getMenu(role)
    .map((item) => {
      const activeClass = item.activeKey === activeKey ? ' is-active' : ''
      const disabledClass = item.disabled ? ' is-disabled' : ''
      const ariaDisabled = item.disabled ? ' aria-disabled="true"' : ''
      return `
        <a class="app-menu-link${activeClass}${disabledClass}" href="${item.href}"${ariaDisabled}>
          <span class="app-menu-icon app-menu-icon-${escapeHtml(item.icon || 'default')}" aria-hidden="true"></span>
          ${escapeHtml(item.label)}
        </a>
      `
    })
    .join('')
}

function getMenu(role) {
  return roleMenus[role] || []
}

function normalizeRole(role) {
  return role === 'NGO' ? 'ORGANIZER' : role
}

function getRoleLabel(role) {
  if (role === 'ORGANIZER') return 'NGO ORGANIZER'
  if (role === 'BANK_ADMIN') return 'BANK ADMIN'
  if (role === 'DONOR') return 'Platinum Donor'
  return 'ACCOUNT'
}

function getInitials(value) {
  return String(value || 'Account')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
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
