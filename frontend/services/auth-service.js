import { apiRequest } from './api-client.js'

const AUTH_STORAGE_KEY = 'donorledger.auth'

export async function login({ email, password }) {
  const session = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  })

  saveSession(session)
  return session
}

export function signup(payload) {
  return apiRequest('/auth/signup', {
    method: 'POST',
    body: payload,
  })
}

export function getSession() {
  const value = localStorage.getItem(AUTH_STORAGE_KEY)
  return value ? JSON.parse(value) : null
}

export function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

function saveSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}
