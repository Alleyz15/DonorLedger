import { renderAppShell } from '../../components/layout/app-shell.js'
import { setFormStatus } from '../../components/form-status.js'
import { getSession } from '../../services/auth-service.js'
import { submitVendorForReview } from '../../services/vendor-service.js'
import { validateVendorForm } from '../../validation/vendor-validation.js'
import {
  bindVendorServiceSelect,
  bindVendorUploadFeedback,
  createVendorForm,
  getVendorPayload,
} from './components/vendor-form.js?v=10'

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

function renderSubmitVendorPage() {
  const form = createVendorForm()
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'submit-vendor',
    content: form,
  })
  bindVendorUploadFeedback(form)
  bindVendorServiceSelect(form)
  form.addEventListener('submit', (event) => submitVendor(event, form))
}

async function submitVendor(event, form) {
  event.preventDefault()
  const statusElement = form.querySelector('.form-status')
  const submitButton = form.querySelector('.vendor-submit-button')
  const payload = getVendorPayload(form, session.ngo?.id)
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
    window.setTimeout(() => { window.location.href = './vendors.html' }, 900)
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
