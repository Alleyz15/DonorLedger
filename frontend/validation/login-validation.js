export function validateLoginForm({ email, password }) {
  if (!email) {
    return 'Email is required.'
  }

  if (!isEmail(email)) {
    return 'Enter a valid email address.'
  }

  if (!password) {
    return 'Password is required.'
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters.'
  }

  return ''
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
