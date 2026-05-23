import { registerNGO } from '../../services/ngo-service.js'
import { validateNGORegistrationForm } from '../../validation/ngo-registration-validation.js'
import { setFormStatus } from '../../components/form-status.js'

const form = document.querySelector('.register-ngo-card')
const submitButton = document.querySelector('.register-ngo-button')
const statusElement = document.querySelector('.form-status')

form?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const formData = new FormData(form)
  const payload = {
    name: String(formData.get('name') || '').trim(),
    registrationNum: String(formData.get('registrationNum') || '').trim(),
    contactEmail: String(formData.get('contactEmail') || '').trim(),
    contactPhone: String(formData.get('contactPhone') || '').trim(),
  }

  const validationMessage = validateNGORegistrationForm(payload)
  if (validationMessage) {
    setFormStatus(statusElement, validationMessage, 'error')
    return
  }

  setLoading(true)
  setFormStatus(statusElement, 'Submitting NGO application...', 'loading')

  try {
    const result = await registerNGO(payload)
    setFormStatus(statusElement, 'Application submitted. Continue to signup.', 'success')
    const params = new URLSearchParams({
      ngoId: result.id,
      email: payload.contactEmail,
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
  submitButton.textContent = isLoading ? 'Submitting...' : 'Continue To Sign Up'
}
