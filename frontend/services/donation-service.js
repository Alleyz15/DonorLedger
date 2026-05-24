import { apiRequest } from './api-client.js'

export function submitDonation(payload) {
  return apiRequest('/donate', {
    method: 'POST',
    body: payload,
  })
}

export function getDonationHistory(donorEmail) {
  return apiRequest(`/donate/history?donorEmail=${encodeURIComponent(donorEmail)}`)
}
