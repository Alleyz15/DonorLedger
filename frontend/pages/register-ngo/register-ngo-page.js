import { registerNGO } from '../../services/ngo-service.js'
import { validateNGORegistrationForm } from '../../validation/ngo-registration-validation.js'
import { setFormStatus } from '../../components/form-status.js'

const form = document.querySelector('.register-ngo-card')
const submitButton = document.querySelector('.register-ngo-button')
const statusElement = document.querySelector('.form-status')
const addDirectorButton = document.querySelector('.add-director-button')
const directorsList = document.querySelector('.directors-list')
const documentInputs = document.querySelectorAll('.document-drop input[type="file"]')
const allocationInputs = [
  form?.querySelector('input[name="aidPercent"]'),
  form?.querySelector('input[name="logisticsPercent"]'),
  form?.querySelector('input[name="adminPercent"]'),
].filter(Boolean)
const allocationTotal = document.querySelector('.allocation-total strong')

addDirectorButton?.addEventListener('click', addDirectorBox)
documentInputs.forEach((input) => {
  input.addEventListener('change', updateDocumentLabel)
})

allocationInputs.forEach((input) => {
  input.addEventListener('input', updateAllocationTotal)
})
updateAllocationTotal()

form?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const formData = new FormData(form)
  const payload = {
    name: String(formData.get('name') || '').trim(),
    registrationNum: String(formData.get('registrationNum') || '').trim(),
    contactEmail: buildPlaceholderEmail(formData),
    contactPhone: '',
  }

  const validationMessage = validateNGORegistrationForm(payload)
  if (validationMessage) {
    setFormStatus(statusElement, validationMessage, 'error')
    return
  }
  if (getAllocationTotal() !== 100) {
    setFormStatus(statusElement, 'Fund allocation must total exactly 100%.', 'error')
    return
  }

  setLoading(true)
  setFormStatus(statusElement, 'Submitting NGO application...', 'loading')

  try {
    const result = await registerNGO(payload)
    setFormStatus(statusElement, 'Application submitted. Continue to signup.', 'success')
    const params = new URLSearchParams({
      ngoId: result.id,
    })
    window.setTimeout(() => {
      window.location.href = `./sign-up.html?${params.toString()}`
    }, 900)
  } catch (error) {
    setFormStatus(statusElement, error.message, 'error')
  } finally {
    setLoading(false)
  }
})

function setLoading(isLoading) {
  submitButton.disabled = isLoading
  submitButton.textContent = isLoading ? 'Submitting...' : 'Submit Application'
}

function addDirectorBox() {
  if (!directorsList) return

  const directorNumber = directorsList.querySelectorAll('.director-box').length + 1
  const directorBox = document.createElement('div')
  directorBox.className = 'director-box'
  directorBox.innerHTML = `
    <label class="field">
      <span>Director ${directorNumber} Full Name (Optional)</span>
      <input
        name="directorName${directorNumber}"
        type="text"
        placeholder="Name as per MyKad"
      />
    </label>

    <label class="field">
      <span>MyKad Number</span>
      <input
        name="directorMyKad${directorNumber}"
        type="text"
        placeholder="XXXXXX-XX-XXXX"
      />
    </label>
  `

  directorsList.append(directorBox)
  directorBox.querySelector('input')?.focus()
}

function updateDocumentLabel(event) {
  const input = event.currentTarget
  const documentDrop = input.closest('.document-drop')
  const hint = documentDrop?.querySelector('small')
  if (!documentDrop || !hint) return

  const fileName = input.files?.[0]?.name
  documentDrop.dataset.hasFile = fileName ? 'true' : 'false'
  hint.textContent = fileName || hint.dataset.emptyText || 'PDF only, max 10MB'
  hint.title = fileName || ''
}

function buildPlaceholderEmail(formData) {
  const registrationNum = String(formData.get('registrationNum') || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `ngo-${registrationNum || Date.now()}@pending.donorledger.local`
}

function getAllocationTotal() {
  return allocationInputs.reduce((sum, input) => sum + Number(input.value || 0), 0)
}

function updateAllocationTotal() {
  if (!allocationTotal) return
  const total = getAllocationTotal()
  allocationTotal.textContent = `${total}% / 100%`
  allocationTotal.classList.toggle('is-invalid', total !== 100)
}
