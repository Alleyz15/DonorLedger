import { validateLoginForm } from './login-validation.js'

export function validateSignupForm({ name, email, password, confirmPassword }) {
  if (!name || name.trim().length < 2) {
    return 'Full name is required.'
  }

  const loginError = validateLoginForm({ email, password })
  if (loginError) {
    return loginError
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters.'
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match.'
  }

  return ''
}
