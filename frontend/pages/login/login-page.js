import { login } from '../../services/auth-service.js'
import { validateLoginForm } from '../../validation/login-validation.js'
import { setFormStatus } from '../../components/form-status.js'

const form = document.querySelector('.login-card')
const submitButton = document.querySelector('.login-button')
const statusElement = document.querySelector('.form-status')
const registerPrompt = document.querySelector('.login-register-prompt')
const query = new URLSearchParams(window.location.search)
const loginRole = query.get('role')

if (loginRole === 'ngo') {
  renderNGOLoginMode()
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const formData = new FormData(form)
  const payload = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || ''),
  }

  const validationMessage = validateLoginForm(payload)
  if (validationMessage) {
    setFormStatus(statusElement, validationMessage, 'error')
    return
  }

  setLoading(true)
  setFormStatus(statusElement, 'Signing in...', 'loading')

  try {
    const session = await login(payload)
    const displayName =
      session.name || session.user?.name || session.ngo?.name || 'Account'
    setFormStatus(statusElement, `Signed in as ${displayName}.`, 'success')
    if (['ORGANIZER', 'NGO'].includes(session.role)) {
      window.setTimeout(() => {
        window.location.href = './my-campaigns.html'
      }, 500)
    } else if (session.role === 'BANK_ADMIN') {
      window.setTimeout(() => {
        window.location.href = './admin-dashboard.html'
      }, 500)
    } else if (session.role === 'DONOR') {
      window.setTimeout(() => {
        window.location.href = './donor-campaigns.html'
      }, 500)
    }
  } catch (error) {
    setFormStatus(statusElement, error.message, 'error')
  } finally {
    setLoading(false)
  }
})

function setLoading(isLoading) {
  submitButton.disabled = isLoading
  submitButton.textContent = isLoading ? 'Logging in...' : 'Login'
}

function renderNGOLoginMode() {
  document.body.dataset.loginMode = 'ngo'

  const title = document.querySelector('#login-title')
  const intro = document.querySelector('.login-card > p')
  const emailInput = form?.querySelector('input[name="email"]')

  if (title) title.textContent = 'NGO Organizer Login'
  if (intro) {
    intro.textContent =
      'Sign in with the organizer account created after your NGO application.'
  }
  if (emailInput) {
    emailInput.placeholder = 'Enter NGO organizer email'
  }
  if (registerPrompt) {
    registerPrompt.hidden = false
  }
}
