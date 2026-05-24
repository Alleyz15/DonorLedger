import { apiFormRequest } from './api-client.js'

const evidenceFields = [
  'ssmDoc',
  'serviceAgreement',
  'invoice',
  'deliveryProof',
  'recipientConfirm',
]

export function submitEvidenceForReview(payload) {
  const formData = new FormData()
  formData.set('campaignId', payload.campaignId)
  formData.set('vendorId', payload.vendorId)
  formData.set('category', payload.category)
  formData.set('amount', payload.amount)

  evidenceFields.forEach((field) => {
    if (payload[field]) {
      formData.set(field, payload[field])
    }
  })

  return apiFormRequest('/evidence/submit', formData)
}
