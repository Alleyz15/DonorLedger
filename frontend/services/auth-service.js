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

function saveSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}
