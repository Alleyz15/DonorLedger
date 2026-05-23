import { validateLoginForm } from './login-validation.js'

export function validateSignupForm({ email, password, confirmPassword }) {
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
