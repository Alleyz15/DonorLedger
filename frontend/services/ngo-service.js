import { apiFormRequest } from './api-client.js'

export function registerNGO(formData) {
  return apiFormRequest('/ngo/register', formData, { method: 'POST' })
}
