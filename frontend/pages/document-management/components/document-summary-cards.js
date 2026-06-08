const summaryItems = [
  {
    key: 'total',
    label: 'Total Evidences Submitted',
    icon: 'documents',
    meta: 'All submitted evidence packages',
  },
  {
    key: 'approved',
    label: 'Approved Evidences',
    icon: 'approved',
    meta: 'Approved or confirmed by Bank Islam',
  },
  {
    key: 'pending',
    label: 'Pending Evidences',
    icon: 'pending',
    meta: 'Waiting for Bank Islam action',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    icon: 'rejected',
    meta: 'Evidence packages declined',
  },
]

export function createDocumentSummaryCards() {
  const section = document.createElement('section')
  section.className = 'document-summary-grid'
  section.setAttribute('aria-label', 'Evidence statistics')
  section.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="document-summary-card">
          <span class="document-summary-icon document-summary-icon-${item.icon}" aria-hidden="true"></span>
          <p>${item.label}</p>
          <strong data-document-summary="${item.key}">0</strong>
          <span>${item.meta}</span>
        </article>
      `
    )
    .join('')
  return section
}

export function updateDocumentSummaryCards(container, evidenceItems) {
  const counts = {
    total: evidenceItems.length,
    approved: evidenceItems.filter((item) =>
      ['APPROVED', 'CONFIRMED'].includes(item.status)
    ).length,
    pending: evidenceItems.filter((item) =>
      ['PENDING_REVIEW', 'AUTO_FROZEN'].includes(item.status)
    ).length,
    rejected: evidenceItems.filter((item) => item.status === 'REJECTED').length,
  }

  Object.entries(counts).forEach(([key, value]) => {
    const element = container.querySelector(`[data-document-summary="${key}"]`)
    if (element) animateCount(element, value)
  })
}

function animateCount(element, target) {
  const duration = 600
  const start = performance.now()

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    element.textContent = String(Math.round(target * eased))
    if (progress < 1) requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}
