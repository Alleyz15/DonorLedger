import { signup } from '../../services/auth-service.js'
import { validateSignupForm } from '../../validation/signup-validation.js'
import { setFormStatus } from '../../components/form-status.js'

const form = document.querySelector('.signup-card')
const submitButton = document.querySelector('.login-button')
const statusElement = document.querySelector('.form-status')
const introElement = document.querySelector('.signup-intro')
const query = new URLSearchParams(window.location.search)
const ngoId = query.get('ngoId')
const email = query.get('email')

if (email) {
  const emailInput = form?.querySelector('input[name="email"]')
  emailInput.value = email
}

if (ngoId && introElement) {
  introElement.textContent = 'Create the organizer account for your NGO application.'
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const formData = new FormData(form)
  const payload = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || ''),
    confirmPassword: String(formData.get('confirmPassword') || ''),
    ngoId,
  }

  const validationMessage = validateSignupForm(payload)
  if (validationMessage) {
    setFormStatus(statusElement, validationMessage, 'error')
    return
  }

  setLoading(true)
  setFormStatus(statusElement, 'Creating account...', 'loading')

  try {
    await signup(payload)
    setFormStatus(statusElement, 'Account created. Redirecting to login...', 'success')
    window.setTimeout(() => {
      window.location.href = './login.html'
    }, 900)
  } catch (error) {
    setFormStatus(statusElement, error.message, 'error')
  } finally {
    setLoading(false)
  }
})

function setLoading(isLoading) {
  submitButton.disabled = isLoading
  submitButton.textContent = isLoading ? 'Creating...' : 'Sign Up'
}
