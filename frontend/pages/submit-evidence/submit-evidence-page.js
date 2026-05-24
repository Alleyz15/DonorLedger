import { renderAppShell } from '../../components/layout/app-shell.js'
import { setFormStatus } from '../../components/form-status.js'
import { getSession } from '../../services/auth-service.js'
import { getCampaignVendors, getCampaignDetails } from '../../services/campaign-service.js'
import { submitEvidenceForReview } from '../../services/evidence-service.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const params = new URLSearchParams(window.location.search)
const campaignId = params.get('campaignId')
const canViewNGOPage = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

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
      <a href="./my-campaigns.html">×</a>
    </header>
    <section class="evidence-body">
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

      <div class="evidence-upload-grid">
        ${renderFileInput('ssmDoc', 'SSM / ROS Document')}
        ${renderFileInput('serviceAgreement', 'Service Agreement')}
        ${renderFileInput('invoice', 'Invoice')}
        ${renderFileInput('deliveryProof', 'Delivery Proof')}
        ${renderFileInput('recipientConfirm', 'Recipient Confirmation')}
      </div>

      <p class="evidence-note">
        Bank Islam and AI review this evidence before any disbursement is approved.
      </p>

      <div class="evidence-actions">
        <a href="./my-campaigns.html">Cancel</a>
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

  button.disabled = true
  button.textContent = 'Submitting...'
  setFormStatus(status, 'Submitting evidence for Bank review...', 'loading')

  try {
    await submitEvidenceForReview(payload)
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

function renderFileInput(name, label) {
  return `
    <label class="evidence-upload">
      <span>${label}</span>
      <strong>Click to upload</strong>
      <small>PDF, JPG or PNG</small>
      <input name="${name}" type="file" accept=".pdf,.jpg,.jpeg,.png" />
    </label>
  `
}

function handleFileChange(event) {
  if (!event.target.matches('input[type="file"]')) return
  const upload = event.target.closest('.evidence-upload')
  const small = upload?.querySelector('small')
  const fileName = event.target.files?.[0]?.name
  if (upload) upload.dataset.hasFile = fileName ? 'true' : 'false'
  if (small && fileName) small.textContent = fileName
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
