const summaryItems = [
  { key: 'total', label: 'Total NGOs', icon: 'grid' },
  { key: 'pending', label: 'Pending Review', icon: 'calendar' },
  { key: 'verified', label: 'Verified This Month', icon: 'shield' },
  { key: 'flagged', label: 'Flagged Accounts', icon: 'warning' },
]

export function createAdminNGOSummary() {
  const section = document.createElement('section')
  section.className = 'admin-ngo-summary-grid'
  section.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="admin-ngo-summary-card">
          <span class="admin-summary-icon admin-summary-icon-${item.icon}" aria-hidden="true"></span>
          <h2>${item.label}</h2>
          <strong data-admin-summary="${item.key}">0</strong>
        </article>
      `
    )
    .join('')
  return section
}

export function updateAdminNGOSummary(container, ngos) {
  const now = new Date()
  const counts = {
    total: ngos.length,
    pending: ngos.filter((ngo) => ngo.status === 'PENDING_KYC').length,
    verified: ngos.filter((ngo) => {
      if (ngo.status !== 'APPROVED' || !ngo.kycApprovedAt) return false
      const approvedAt = new Date(ngo.kycApprovedAt)
      return (
        approvedAt.getMonth() === now.getMonth() &&
        approvedAt.getFullYear() === now.getFullYear()
      )
    }).length,
    flagged: ngos.filter((ngo) =>
      ['REJECTED', 'REVOKED'].includes(ngo.status) || ngo.riskTier === 'HIGH'
    ).length,
  }

  Object.entries(counts).forEach(([key, value]) => {
    const element = container.querySelector(`[data-admin-summary="${key}"]`)
    if (element) element.textContent = String(value)
  })
}
