const summaryItems = [
  { key: 'total', label: 'Total Vendors', icon: 'users' },
  { key: 'pending', label: 'Pending Reviews', icon: 'clipboard', tag: 'PENDING_KYC' },
  { key: 'approved', label: 'Approved Vendors', icon: 'badge', tag: 'APPROVED' },
  { key: 'rejected', label: 'Flagged / Rejected', icon: 'shield', tag: 'REJECTED' },
]

export function createAdminVendorSummary() {
  const section = document.createElement('section')
  section.className = 'admin-vendor-summary-grid'
  section.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="admin-vendor-summary-card">
          <span class="admin-vendor-summary-icon is-${item.icon}" aria-hidden="true"></span>
          <h2>${item.label}</h2>
          <div>
            <strong data-vendor-summary="${item.key}">0</strong>
            ${item.tag ? `<span class="admin-vendor-tag is-${item.key}">${item.tag}</span>` : ''}
          </div>
        </article>
      `
    )
    .join('')
  return section
}

export function updateAdminVendorSummary(container, vendors) {
  const counts = {
    total: vendors.length,
    pending: vendors.filter((vendor) => vendor.status === 'PENDING_KYC').length,
    approved: vendors.filter((vendor) => vendor.status === 'APPROVED').length,
    rejected: vendors.filter((vendor) => vendor.status === 'REJECTED').length,
  }

  Object.entries(counts).forEach(([key, value]) => {
    const element = container.querySelector(`[data-vendor-summary="${key}"]`)
    if (element) element.textContent = String(value)
  })
}
