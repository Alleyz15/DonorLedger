import { API_BASE_URL } from '../config/api-config.js'

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = await readJson(response)

  if (!response.ok) {
    const message = payload?.error || 'Request failed. Please try again.'
    throw new Error(message)
  }

  return payload
}

export async function apiFormRequest(path, formData, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'POST',
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
    body: formData,
  })

  const payload = await readJson(response)

  if (!response.ok) {
    const message = payload?.error || 'Request failed. Please try again.'
    throw new Error(message)
  }

  return payload
}

async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
