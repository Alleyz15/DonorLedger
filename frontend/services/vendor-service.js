import { apiFormRequest, apiRequest } from './api-client.js'

export function getNGOVendors(token) {
  return apiRequest('/ngo/vendors', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function submitVendorForReview(payload) {
  const formData = new FormData()
  formData.set('ngoId', payload.ngoId)
  formData.set('name', payload.name)
  formData.set('ssmNumber', payload.ssmNumber)
  formData.set('serviceType', payload.serviceType)
  formData.set('bankAccount', payload.bankAccount)
  formData.set('walletAddress', payload.walletAddress)

  if (payload.registrationDoc) {
    formData.set('registrationDoc', payload.registrationDoc)
  }

  return apiFormRequest('/vendor/submit', formData)
}
