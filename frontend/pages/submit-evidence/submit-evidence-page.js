import { renderAppShell } from '../../components/layout/app-shell.js'
import { setFormStatus } from '../../components/form-status.js'
import { getSession } from '../../services/auth-service.js'
import { getCampaignVendors, getCampaignDetails } from '../../services/campaign-service.js'
import { submitEvidenceForReview } from '../../services/evidence-service.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const params = new URLSearchParams(window.location.search)
const campaignId = params.get('campaignId')
const canViewNGOPage = session?.token && isNGOSession(session)

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewNGOPage) {
  renderAccessDenied()
} else {
  renderSubmitEvidencePage()
}

async function renderSubmitEvidencePage() {
  const form = document.createElement('form')
  form.className = 'evidence-card'
  form.noValidate = true
  form.innerHTML = `
    <header class="evidence-header">
      <div>
        <h1>Submit Evidence</h1>
        <p data-campaign-label>Upload proof before Bank Islam releases funds.</p>
      </div>
      <a class="evidence-close-btn" href="./my-campaigns.html" aria-label="Back to My Campaigns">← Back</a>
    </header>
    <section class="evidence-body">

      <div class="evidence-ai-gate">
        <span class="evidence-ai-gate-icon" aria-hidden="true">🤖</span>
        <div>
          <strong>Gemini AI will analyse this submission before Bank Islam reviews it.</strong>
          <span>Ensure invoice amounts match Malaysian market rates. Inflated prices, vague line items, or mismatched amounts will be flagged and may result in an auto-freeze.</span>
        </div>
      </div>

      <div class="evidence-grid">
        <label class="field">
          <span>Approved Vendor</span>
          <select name="vendorId" required>
            <option value="">Loading vendors...</option>
          </select>
        </label>
        <label class="field">
          <span>Category</span>
          <select name="category" required>
            <option value="aid">Aid</option>
            <option value="logistics">Logistics</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label class="field">
          <span>Requested Amount (RM)</span>
          <input name="amount" type="number" min="1" step="0.01" placeholder="e.g. 500" required />
        </label>
      </div>

      <div class="evidence-checklist-header">
        <span>Required Documents</span>
        <span class="evidence-checklist-counter" data-checklist-counter>0 / 5 uploaded</span>
      </div>

      <div class="evidence-upload-grid">
        ${renderFileInput('ssmDoc', 'SSM / ROS Document', true)}
        ${renderFileInput('serviceAgreement', 'Service Agreement', true)}
        ${renderFileInput('invoice', 'Itemised Invoice', true)}
        ${renderFileInput('deliveryProof', 'Delivery Proof', true)}
        ${renderFileInput('recipientConfirm', 'Recipient Confirmation', true)}
      </div>

      <div class="evidence-actions">
        <a class="evidence-cancel-link" href="./my-campaigns.html">Cancel</a>
        <button class="evidence-submit-button" type="submit">Submit Evidence for Review</button>
      </div>
      <div class="form-status" role="status" aria-live="polite"></div>
    </section>
  `

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'my-campaigns',
    content: form,
  })

  await loadCampaignContext(form)
  form.addEventListener('change', handleFileChange)
  form.addEventListener('submit', submitEvidence)
}

async function loadCampaignContext(form) {
  const label = form.querySelector('[data-campaign-label]')
  const vendorSelect = form.querySelector('select[name="vendorId"]')

  try {
    const [campaign, vendors] = await Promise.all([
      getCampaignDetails(campaignId),
      getCampaignVendors(campaignId),
    ])
    label.textContent = `Campaign: ${campaign.name}`
    vendorSelect.innerHTML = vendors.length
      ? vendors.map((vendor) => `<option value="${escapeHtml(vendor.id)}">${escapeHtml(vendor.name)} (${escapeHtml(vendor.serviceType)})</option>`).join('')
      : '<option value="">No approved vendors available</option>'
    vendorSelect.disabled = !vendors.length
  } catch (error) {
    vendorSelect.innerHTML = '<option value="">Unable to load vendors</option>'
    setFormStatus(form.querySelector('.form-status'), error.message, 'error')
  }
}

async function submitEvidence(event) {
  event.preventDefault()
  const form = event.currentTarget
  const status = form.querySelector('.form-status')
  const button = form.querySelector('.evidence-submit-button')
  const formData = new FormData(form)

  const payload = {
    campaignId,
    vendorId: String(formData.get('vendorId') || ''),
    category: String(formData.get('category') || ''),
    amount: String(formData.get('amount') || ''),
    ssmDoc: formData.get('ssmDoc'),
    serviceAgreement: formData.get('serviceAgreement'),
    invoice: formData.get('invoice'),
    deliveryProof: formData.get('deliveryProof'),
    recipientConfirm: formData.get('recipientConfirm'),
  }

  if (!payload.campaignId || !payload.vendorId || !payload.category || !payload.amount) {
    setFormStatus(status, 'Campaign, vendor, category and amount are required.', 'error')
    return
  }
  if (!evidenceFields.every((field) => payload[field] instanceof File && payload[field].size > 0)) {
    setFormStatus(status, 'Please upload all five evidence documents before submitting.', 'error')
    return
  }

  button.disabled = true
  button.textContent = 'Submitting...'
  setFormStatus(status, 'Submitting evidence for Bank review...', 'loading')

  try {
    await submitEvidenceForReview(payload, session.token)
    setFormStatus(status, 'Evidence submitted. AI analysis and Bank review are now pending.', 'success')
    window.setTimeout(() => {
      window.location.href = './my-campaigns.html'
    }, 1000)
  } catch (error) {
    setFormStatus(status, error.message, 'error')
  } finally {
    button.disabled = false
    button.textContent = 'Submit Evidence for Review'
  }
}

const evidenceFields = [
  'ssmDoc',
  'serviceAgreement',
  'invoice',
  'deliveryProof',
  'recipientConfirm',
]

function renderFileInput(name, label, required = false) {
  return `
    <label class="evidence-upload">
      <span>${label}</span>
      <strong>Click to upload</strong>
      <small>PDF, JPG or PNG</small>
      <input name="${name}" type="file" accept=".pdf,.jpg,.jpeg,.png" ${required ? 'required' : ''} />
    </label>
  `
}

function handleFileChange(event) {
  if (!event.target.matches('input[type="file"]')) return
  const form     = event.target.closest('form')
  const upload   = event.target.closest('.evidence-upload')
  const small    = upload?.querySelector('small')
  const fileName = event.target.files?.[0]?.name

  // Update individual upload tile
  if (upload) upload.dataset.hasFile = fileName ? 'true' : 'false'
  if (small) small.textContent = fileName || small.dataset.default || 'PDF, JPG or PNG'

  // Update "X / 5 uploaded" counter
  if (form) {
    const total   = evidenceFields.length
    const uploaded = evidenceFields.filter((field) => {
      const input = form.querySelector(`input[name="${field}"]`)
      return input?.files?.[0]?.size > 0
    }).length
    const counter = form.querySelector('[data-checklist-counter]')
    if (counter) {
      counter.textContent = `${uploaded} / ${total} uploaded`
      counter.dataset.complete = uploaded === total ? 'true' : 'false'
    }
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'evidence-card'
  panel.innerHTML = '<p class="evidence-access-denied">This page is only available for NGO accounts.</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'my-campaigns',
    content: panel,
  })
}

function isNGOSession(value) {
  const role = String(value?.role || value?.user?.role || '').toUpperCase()
  return (
    role === 'ORGANIZER' ||
    role === 'NGO' ||
    role === 'NGO_ORGANIZER' ||
    Boolean(value?.ngo?.id)
  )
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
