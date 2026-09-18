import { registerNGO } from '../../services/ngo-service.js'
import { validateNGORegistrationForm } from '../../validation/ngo-registration-validation.js'
import { setFormStatus } from '../../components/form-status.js'

const form = document.querySelector('.reg-form')
const submitButton = document.querySelector('.register-ngo-button')
const statusElement = document.querySelector('.form-status')
const addDirectorButton = document.querySelector('.add-director-button')
const removeLastDirectorButton = document.querySelector('.remove-last-director-button')
const directorsList = document.querySelector('.directors-list')
const documentInputs = document.querySelectorAll('.document-drop input[type="file"]')
const allocationInputs = [
  form?.querySelector('input[name="aidPercent"]'),
  form?.querySelector('input[name="logisticsPercent"]'),
  form?.querySelector('input[name="adminPercent"]'),
].filter(Boolean)
const allocationTotal = document.querySelector('.allocation-total')
const allocationFill = document.querySelector('.allocation-fill')
const allocationMessage = document.querySelector('.alloc-msg')
const progressSteps = Array.from(document.querySelectorAll('.step'))
const progressFill = document.querySelector('.steps-progress')
const registrationTypeOptions = document.querySelectorAll('.rt-opt')

const sectionOrder = [
  'organisation',
  'directors',
  'banking',
  'mission',
  'allocation',
  'documents',
]

addDirectorButton?.addEventListener('click', addDirectorBox)
removeLastDirectorButton?.addEventListener('click', removeLastDirectorBox)

registrationTypeOptions.forEach((option) => {
  option.addEventListener('click', () => {
    registrationTypeOptions.forEach((item) => item.classList.remove('selected'))
    option.classList.add('selected')
    option.querySelector('input[type="radio"]').checked = true
    updateProgress()
  })
})

form?.addEventListener('input', updateProgress)
form?.addEventListener('change', updateProgress)

documentInputs.forEach((input) => {
  input.addEventListener('change', updateDocumentLabel)
})

allocationInputs.forEach((input) => {
  input.addEventListener('input', updateAllocationTotal)
})

updateRemoveDirectorButton()
updateAllocationTotal()
updateProgress()

form?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const formData = new FormData(form)

  // The form does not collect a contact email/phone yet — generate a
  // placeholder email so the NGO record can be created. Bank Islam can
  // update contact details during KYC review.
  formData.set('contactEmail', buildPlaceholderEmail(formData))
  formData.set('contactPhone', '')

  const validationMessage = validateNGORegistrationForm({
    name: String(formData.get('name') || '').trim(),
    registrationNum: String(formData.get('registrationNum') || '').trim(),
    contactEmail: String(formData.get('contactEmail') || '').trim(),
  })
  if (validationMessage) {
    setFormStatus(statusElement, validationMessage, 'error')
    focusSection('organisation')
    return
  }

  const firstIncompleteSection = getFirstIncompleteSection()
  if (firstIncompleteSection) {
    setFormStatus(statusElement, getIncompleteMessage(firstIncompleteSection), 'error')
    focusSection(firstIncompleteSection)
    return
  }

  setLoading(true)
  setFormStatus(statusElement, 'Submitting NGO application...', 'loading')

  try {
    const result = await registerNGO(formData)
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

  const directorNumber = directorsList.querySelectorAll('.director-card').length + 1
  const directorBox = document.createElement('div')
  directorBox.className = 'director-card'
  directorBox.innerHTML = `
    <div class="dir-header">
      <div class="dir-label">
        <span class="dir-bubble">${directorNumber}</span>
        Director ${directorNumber}
      </div>
    </div>
    <div class="director-fields">
      <div class="field">
        <label for="dir-name-${directorNumber}">Full Name</label>
        <input
          id="dir-name-${directorNumber}"
          name="directorName${directorNumber}"
          type="text"
          placeholder="As per MyKad"
        />
      </div>

      <div class="field">
        <label for="dir-mykad-${directorNumber}">MyKad Number</label>
        <input
          id="dir-mykad-${directorNumber}"
          name="directorMyKad${directorNumber}"
          type="text"
          placeholder="XXXXXX-XX-XXXX"
        />
      </div>
    </div>
  `

  directorsList.append(directorBox)
  updateRemoveDirectorButton()
  updateProgress()
  directorBox.querySelector('input')?.focus()
}

function removeLastDirectorBox() {
  if (!directorsList) return

  const directorBoxes = directorsList.querySelectorAll('.director-card')
  if (directorBoxes.length <= 1) return

  directorBoxes[directorBoxes.length - 1].remove()
  renumberDirectorBoxes()
  updateRemoveDirectorButton()
  updateProgress()
}

function renumberDirectorBoxes() {
  if (!directorsList) return

  directorsList.querySelectorAll('.director-card').forEach((directorBox, index) => {
    const directorNumber = index + 1
    const bubble = directorBox.querySelector('.dir-bubble')
    const label = directorBox.querySelector('.dir-label')
    const nameLabel = directorBox.querySelector('.field:first-of-type label')
    const nameInput = directorBox.querySelector('.field:first-of-type input')
    const myKadLabel = directorBox.querySelector('.field:nth-of-type(2) label')
    const myKadInput = directorBox.querySelector('.field:nth-of-type(2) input')

    if (bubble) bubble.textContent = String(directorNumber)
    if (label) {
      label.innerHTML =
        directorNumber === 1
          ? '<span class="dir-bubble">1</span>Director 1 <em>(Required)</em>'
          : `<span class="dir-bubble">${directorNumber}</span>Director ${directorNumber}`
    }
    if (nameLabel) nameLabel.setAttribute('for', `dir-name-${directorNumber}`)
    if (nameInput) {
      nameInput.id = `dir-name-${directorNumber}`
      nameInput.name = directorNumber === 1 ? 'directorName' : `directorName${directorNumber}`
    }
    if (myKadLabel) myKadLabel.setAttribute('for', `dir-mykad-${directorNumber}`)
    if (myKadInput) {
      myKadInput.id = `dir-mykad-${directorNumber}`
      myKadInput.name = directorNumber === 1 ? 'directorMyKad' : `directorMyKad${directorNumber}`
    }
  })
}

function updateRemoveDirectorButton() {
  if (!directorsList || !removeLastDirectorButton) return
  removeLastDirectorButton.disabled =
    directorsList.querySelectorAll('.director-card').length <= 1
}

function updateDocumentLabel(event) {
  const input = event.currentTarget
  const documentDrop = input.closest('.document-drop')
  const hint = documentDrop?.querySelector('small')
  if (!documentDrop || !hint) return

  const fileName = input.files?.[0]?.name
  documentDrop.dataset.hasFile = fileName ? 'true' : 'false'
  hint.textContent = fileName || hint.dataset.emptyText || 'PDF, PNG, or JPG. Max 10MB'
  hint.title = fileName || ''
  updateProgress()
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
  const total = getAllocationTotal()
  const clampedTotal = Math.min(total, 100)

  if (allocationTotal) {
    allocationTotal.textContent = `${total}% / 100%`
    allocationTotal.classList.toggle('is-invalid', total !== 100)
  }

  if (allocationFill) {
    allocationFill.style.width = `${clampedTotal}%`
    allocationFill.style.backgroundColor = total === 100 ? '#3ecfa0' : '#d47f12'
  }

  if (allocationMessage) {
    allocationMessage.classList.toggle('is-invalid', total !== 100)
    allocationMessage.textContent =
      total === 100
        ? 'Perfect. All funds accounted for.'
        : `${Math.abs(100 - total)}% ${total > 100 ? 'over' : 'remaining'}. Values must total exactly 100%.`
  }

  updateProgress()
}

function getSectionCompletion() {
  return {
    organisation:
      getTrimmedValue('name').length >= 2 &&
      Boolean(form?.querySelector('input[name="registrationType"]:checked')) &&
      getTrimmedValue('registrationNum').length >= 3 &&
      getTrimmedValue('registeredAddress').length > 0,
    directors:
      getTrimmedValue('directorName').length > 0 &&
      getTrimmedValue('directorMyKad').length > 0,
    banking:
      getTrimmedValue('bankAccount').length > 0 &&
      getTrimmedValue('bankName').length > 0,
    mission:
      getTrimmedValue('causeType').length > 0 &&
      getTrimmedValue('description').length >= 20,
    allocation: getAllocationTotal() === 100,
    documents:
      Boolean(form?.querySelector('input[name="registrationDoc"]')?.files?.[0]) &&
      Boolean(form?.querySelector('input[name="financialDoc"]')?.files?.[0]),
  }
}

function updateProgress() {
  const completion = getSectionCompletion()
  const completedCount = sectionOrder.filter((section) => completion[section]).length
  const fillPercent =
    completedCount <= 1
      ? 0
      : ((completedCount - 1) / (sectionOrder.length - 1)) * 100

  progressSteps.forEach((step) => {
    const section = step.dataset.section
    step.classList.toggle('done', Boolean(completion[section]))
  })

  if (progressFill) {
    progressFill.style.width = `${fillPercent}%`
  }
}

function getFirstIncompleteSection() {
  const completion = getSectionCompletion()
  return sectionOrder.find((section) => !completion[section])
}

function getIncompleteMessage(section) {
  const messages = {
    organisation: 'Complete the organisation information section.',
    directors: 'Complete the primary director details.',
    banking: 'Complete the banking details section.',
    mission: 'Complete the cause and mission section.',
    allocation: 'Fund allocation must total exactly 100%.',
    documents: 'Upload both required documents.',
  }

  return messages[section] || 'Complete all application sections.'
}

function focusSection(section) {
  const sectionElement = document.querySelector(`[data-progress-section="${section}"]`)
  sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function getTrimmedValue(name) {
  const field = form?.querySelector(`[name="${name}"]`)
  return String(field?.value || '').trim()
}
