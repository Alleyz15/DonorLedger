const ICON = {
  arrowLeft: `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  dollarSign: `<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  tag: `<svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  store: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  filePdf: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  fileImage: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  externalLink: `<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  paperclip: `<svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
  xCircle: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
}

export function createEvidenceDetailPage() {
  const page = document.createElement('div')
  page.className = 'evidence-detail-page'
  page.innerHTML = `<p class="evidence-loading">Loading evidence details...</p>`
  return page
}

export function renderEvidenceDetail(page, evidence) {
  page.innerHTML = ''

  page.append(renderBackLink())
  page.append(renderHeaderCard(evidence))

  const body = document.createElement('div')
  body.className = 'evidence-detail-grid'
  body.append(renderInfoCard(evidence))
  body.append(renderDocumentsCard(evidence))
  page.append(body)
}

export function renderEvidenceDetailError(page, message) {
  page.innerHTML = `<p class="evidence-error">${escapeHtml(message)}</p>`
}

function renderBackLink() {
  const link = document.createElement('a')
  link.className = 'evidence-back-link'
  link.href = './document-management.html'
  link.innerHTML = `${icon('arrowLeft')} Back to Document Management`
  return link
}

function renderHeaderCard(evidence) {
  const div = document.createElement('div')
  div.className = 'evidence-header-card'
  div.innerHTML = `
    <div class="evidence-header-left">
      <div class="evidence-header-icon" aria-hidden="true">${icon('fileText')}</div>
      <div>
        <h1 class="evidence-title">${escapeHtml(evidence.title || 'Evidence Submission')}</h1>
        <div class="evidence-meta-row">
          <span class="evidence-meta-item">
            ${icon('store')}
            ${escapeHtml(evidence.campaignName || 'Campaign')}
          </span>
          <span class="evidence-meta-dot" aria-hidden="true"></span>
          <span class="evidence-meta-item">
            ${icon('calendar')}
            Submitted ${formatDate(evidence.submittedAt)}
          </span>
          <span class="evidence-meta-dot" aria-hidden="true"></span>
          <span class="evidence-meta-item">
            ${icon('tag')}
            ${escapeHtml(formatCategory(evidence.category))}
          </span>
        </div>
      </div>
    </div>
  `
  return div
}

function renderInfoCard(evidence) {
  const card = document.createElement('div')
  card.className = 'detail-card request-detail-card'

  const fields = [
    {
      label: 'Requested Date',
      value: formatDate(evidence.submittedAt),
      sub: formatTime(evidence.submittedAt),
    },
    {
      label: 'Process At',
      value: evidence.processAt ? formatDate(evidence.processAt) : '-',
      sub: evidence.processAt ? formatTime(evidence.processAt) : 'Awaiting bank review',
    },
    {
      label: 'Vendor',
      value: evidence.vendorName || '-',
      sub: evidence.vendorServiceType || 'Approved vendor',
    },
    {
      label: 'Category',
      value: formatCategory(evidence.category),
      sub: 'Disbursement category',
    },
    {
      label: 'Status',
      value: getStatusLabel(evidence.status),
      sub: getStatusSubtext(evidence.status),
    },
    {
      label: 'Campaign',
      value: evidence.campaignName || '-',
      sub: 'Linked campaign',
    },
  ]

  card.innerHTML = `
    <div class="detail-card-header">
      <span class="detail-card-icon">${icon('calendar')}</span>
      <h2>Request Details</h2>
    </div>
    <div class="amount-hero">
      <div class="amount-label">Requested Amount</div>
      <div class="amount-value">${escapeHtml(formatMoney(evidence.amount))}</div>
      <div class="amount-note">Disbursement to vendor upon approval</div>
    </div>
    <div class="detail-fields">
      ${fields.map((field) => `
        <div class="detail-field">
          <div class="field-label">${escapeHtml(field.label)}</div>
          <div class="field-value">${escapeHtml(String(field.value))}</div>
          <div class="field-subtext">${escapeHtml(field.sub || '')}</div>
        </div>
      `).join('')}
    </div>
    ${evidence.status === 'REJECTED' && evidence.rejectedReason ? `
      <div class="rejected-zone">
        <div class="rejected-header">
          <span class="rejected-icon">${icon('xCircle')}</span>
          Rejected Reason
        </div>
        <p class="rejected-body">${escapeHtml(evidence.rejectedReason)}</p>
      </div>
    ` : ''}
  `
  return card
}

function renderDocumentsCard(evidence) {
  const documents = Array.isArray(evidence.documents) ? evidence.documents : []
  const card = document.createElement('div')
  card.className = 'detail-card documents-detail-card'

  const documentHtml = documents.length
    ? documents.map(renderDocumentItem).join('')
    : `<p class="doc-empty">No documents attached to this evidence.</p>`

  card.innerHTML = `
    <div class="detail-card-header">
      <span class="detail-card-icon">${icon('paperclip')}</span>
      <h2>Submitted Documents <span>${documents.length}</span></h2>
    </div>
    <div class="detail-card-body">
      <div class="doc-list">
        ${documentHtml}
      </div>
    </div>
  `
  return card
}

function renderDocumentItem(document) {
  const fileName = document.name || document.label || 'Document'
  const iconClass = getDocIconClass(fileName)
  const svgIcon = getDocSvgIcon(fileName)
  const extension = getFileExtension(fileName)
  return `
    <a
      class="doc-item"
      href="${escapeAttribute(document.url)}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open ${escapeAttribute(fileName)}"
    >
      <span class="doc-ficon ${iconClass}" aria-hidden="true">
        ${svgIcon}
        <span class="doc-ext">${escapeHtml(extension)}</span>
      </span>
      <span class="doc-info">
        <span class="doc-name">${escapeHtml(document.label || fileName)}</span>
        <span class="doc-meta">
          <span>${escapeHtml(fileName)}</span>
          <span aria-hidden="true"></span>
          <span>${escapeHtml(extension.toUpperCase())}</span>
        </span>
      </span>
      <span class="doc-arrow" aria-hidden="true">${icon('externalLink')}</span>
    </a>
  `
}

function icon(name) {
  return ICON[name] || ''
}

function getDocIconClass(fileName) {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase()
  if (extension === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'img'
  if (['doc', 'docx'].includes(extension)) return 'doc'
  return 'file'
}

function getDocSvgIcon(fileName) {
  const iconClass = getDocIconClass(fileName)
  if (iconClass === 'pdf') return icon('filePdf')
  if (iconClass === 'img') return icon('fileImage')
  return icon('fileText')
}

function getFileExtension(fileName) {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase()
  if (!extension || extension === String(fileName || '').toLowerCase()) return 'file'
  return extension
}

function getStatusLabel(status) {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Pending Review'
    case 'APPROVED':
      return 'Approved'
    case 'CONFIRMED':
      return 'Confirmed'
    case 'REJECTED':
      return 'Rejected'
    case 'AUTO_FROZEN':
      return 'Auto Frozen'
    default:
      return status || '-'
  }
}

function getStatusSubtext(status) {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Awaiting Bank Islam review'
    case 'APPROVED':
      return 'Reviewed by Bank Islam'
    case 'CONFIRMED':
      return 'Recipient confirmed receipt'
    case 'REJECTED':
      return 'Rejected by Bank Islam'
    case 'AUTO_FROZEN':
      return 'Automatically frozen for investigation'
    default:
      return 'Evidence submission status'
  }
}

function formatCategory(value) {
  if (!value) return '-'
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function escapeAttribute(value) {
  return escapeHtml(value)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
