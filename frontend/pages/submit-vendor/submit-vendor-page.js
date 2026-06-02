// v7 — form HTML inlined directly to bypass Vite module cache on vendor-form.js
import { renderAppShell } from '../../components/layout/app-shell.js'
import { setFormStatus } from '../../components/form-status.js'
import { getSession } from '../../services/auth-service.js'
import { submitVendorForReview } from '../../services/vendor-service.js'
import { validateVendorForm } from '../../validation/vendor-validation.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewNGOPage = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewNGOPage) {
  renderAccessDenied()
} else {
  renderSubmitVendorPage()
}

function createVendorForm() {
  const form = document.createElement('form')
  form.className = 'vendor-review-card'
  form.noValidate = true
  form.innerHTML = `
    <header class="vendor-review-header">
      <div>
        <h1>Submit New Vendor for Review</h1>
        <p>Registration for the DonorLedger Institutional Portal</p>
      </div>
    </header>

    <section class="vendor-review-body">
      <label class="field vendor-field-full">
        <span>Vendor Name</span>
        <input name="name" type="text" placeholder="e.g. Global Logistics Solutions" />
      </label>

      <div class="vendor-form-grid">
        <label class="field">
          <span>SSM Number</span>
          <input name="ssmNumber" type="text" placeholder="202301XXXXXX" />
        </label>
        <label class="field">
          <span>Service Type</span>
          <select name="serviceType">
            <option value="">Select service...</option>
            <option value="FOOD">Food</option>
            <option value="LOGISTICS">Logistics</option>
            <option value="MEDICAL">Medical</option>
            <option value="CONSTRUCTION">Construction</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label class="field">
          <span>Bank Account Number</span>
          <input name="bankAccount" type="text" placeholder="Standard Chartered/Maybank..." />
        </label>
        <label class="field">
          <span>Wallet Address (Blockchain)</span>
          <input name="walletAddress" type="text" placeholder="0x..." />
        </label>
      </div>

      <div class="vendor-upload-wrapper">
        <span class="vendor-upload-label-text">Registration Document</span>
        <label class="vendor-dropzone-box">
          <span class="vendor-dropzone-icon-area" aria-hidden="true">
            <i class="vendor-dropzone-icon-svg"></i>
          </span>
          <strong class="vendor-dropzone-heading">Click to upload or drag and drop</strong>
          <span class="vendor-dropzone-sub" data-default="PDF, JPG or PNG (max. 10MB)">PDF, JPG or PNG (max. 10MB)</span>
          <input name="registrationDoc" type="file" accept=".pdf,.png,.jpg,.jpeg" style="display:none" />
        </label>
      </div>

      <section class="vendor-protocol-note">
        <i aria-hidden="true"></i>
        <div>
          <strong>By submitting, you agree to DonorLedger's transparency protocols.</strong>
          <span>All transactions with this vendor will be recorded on the public ledger for donor verification.</span>
        </div>
      </section>

      <div class="vendor-form-actions">
        <a class="vendor-cancel-button" href="./my-campaigns.html">Cancel</a>
        <button class="vendor-submit-button" type="submit">Submit Vendor for Review</button>
      </div>

      <div class="form-status" role="status" aria-live="polite"></div>
    </section>
  `
  return form
}

function bindUploadFeedback(form) {
  const input    = form.querySelector('input[name="registrationDoc"]')
  const dropzone = form.querySelector('.vendor-dropzone-box')
  const hint     = dropzone?.querySelector('.vendor-dropzone-sub')
  if (!input || !dropzone || !hint) return

  // Clicking the dropzone box triggers the hidden file input
  dropzone.addEventListener('click', () => input.click())

  input.addEventListener('change', () => {
    const fileName = input.files?.[0]?.name
    dropzone.classList.toggle('has-file', !!fileName)
    hint.textContent = fileName || hint.dataset.default || 'PDF, JPG or PNG (max. 10MB)'
  })
}

function getVendorPayload(form) {
  const formData = new FormData(form)
  const registrationDoc = formData.get('registrationDoc')
  return {
    ngoId: session.ngo?.id,
    name:          String(formData.get('name')          || '').trim(),
    ssmNumber:     String(formData.get('ssmNumber')     || '').trim(),
    serviceType:   String(formData.get('serviceType')   || ''),
    bankAccount:   String(formData.get('bankAccount')   || '').trim(),
    walletAddress: String(formData.get('walletAddress') || '').trim(),
    registrationDoc: registrationDoc instanceof File && registrationDoc.size > 0
      ? registrationDoc : null,
  }
}

function renderSubmitVendorPage() {
  const form = createVendorForm()
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'submit-vendor',
    content: form,
  })
  bindUploadFeedback(form)
  form.addEventListener('submit', (event) => submitVendor(event, form))
}

async function submitVendor(event, form) {
  event.preventDefault()
  const statusElement = form.querySelector('.form-status')
  const submitButton  = form.querySelector('.vendor-submit-button')
  const payload       = getVendorPayload(form)
  const validationMessage = validateVendorForm(payload)

  if (validationMessage) {
    setFormStatus(statusElement, validationMessage, 'error')
    return
  }

  submitButton.disabled = true
  submitButton.textContent = 'Submitting...'
  setFormStatus(statusElement, 'Submitting vendor for review...', 'loading')

  try {
    await submitVendorForReview(payload)
    setFormStatus(statusElement, 'Vendor submitted for review.', 'success')
    window.setTimeout(() => { window.location.href = './my-campaigns.html' }, 900)
  } catch (error) {
    setFormStatus(statusElement, error.message, 'error')
  } finally {
    submitButton.disabled = false
    submitButton.textContent = 'Submit Vendor for Review'
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'vendor-review-card'
  panel.innerHTML = '<p class="vendor-access-denied">This page is only available for NGO accounts.</p>'
  renderAppShell({ mount: shell, session, activeKey: 'submit-vendor', content: panel })
}
