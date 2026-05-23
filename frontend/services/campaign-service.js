import { apiRequest } from './api-client.js'

export function getNGOCampaigns(token) {
  return apiRequest('/ngo/campaigns', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function getNGOCampaign(token, campaignId) {
  return apiRequest(`/ngo/campaigns/${campaignId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function createNGOCampaign(token, payload) {
  return apiRequest('/ngo/campaign/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: payload,
  })
}

export function getApprovedVendors(token) {
  return apiRequest('/ngo/vendors?status=APPROVED', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function getActiveCampaigns() {
  return apiRequest('/campaign?status=ACTIVE')
}

export function getCampaignDetails(campaignId) {
  return apiRequest(`/campaign/${campaignId}`)
}
