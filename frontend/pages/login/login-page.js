import { login } from '../../services/auth-service.js'
import { validateLoginForm } from '../../validation/login-validation.js'
import { setFormStatus } from '../../components/form-status.js'

const form = document.querySelector('.login-card')
const submitButton = document.querySelector('.login-button')
const statusElement = document.querySelector('.form-status')

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
