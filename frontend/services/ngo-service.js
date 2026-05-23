import { apiRequest } from './api-client.js'

export function registerNGO(payload) {
  return apiRequest('/ngo/register', {
    method: 'POST',
    body: payload,
  })
}
