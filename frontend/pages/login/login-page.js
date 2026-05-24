import { login } from '../../services/auth-service.js'
import { validateLoginForm } from '../../validation/login-validation.js'
import { setFormStatus } from '../../components/form-status.js'

const form = document.querySelector('.login-card')
const submitButton = document.querySelector('.login-button')
const statusElement = document.querySelector('.form-status')
const demoButtons = document.querySelectorAll('[data-demo-email]')
const query = new URLSearchParams(window.location.search)
const loginRole = query.get('role')

if (loginRole === 'ngo') {
  renderNGOLoginMode()
}

demoButtons.forEach((button) => {
  button.addEventListener('click', () => {
    form.querySelector('input[name="email"]').value = button.dataset.demoEmail
    form.querySelector('input[name="password"]').value = button.dataset.demoPassword
    setFormStatus(statusElement, `${button.querySelector('span').textContent} demo account loaded.`, 'success')
  })
})

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
        window.location.href = './admin-ngos.html'
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
  const demoCard = document.querySelector('.login-demo-card')

  if (title) title.textContent = 'NGO Organizer Login'
  if (intro) {
    intro.textContent =
      'Sign in with the organizer account created after your NGO application.'
  }
  if (emailInput) {
    emailInput.placeholder = 'Enter NGO organizer email'
  }
  if (demoCard) {
    demoCard.innerHTML = `
      <h2>New NGO?</h2>
      <p>
        If your organization does not have an account yet, submit the NGO application first.
        After submission, you will create the organizer login account.
      </p>
      <a href="./register-ngo.html">Register NGO Application</a>
      <a class="login-demo-secondary-link" href="./login.html">Use donor or bank login</a>
    `
  }
}
