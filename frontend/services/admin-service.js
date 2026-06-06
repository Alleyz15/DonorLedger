import { apiRequest } from './api-client.js'

export function getAdminNGOs(token) {
  return apiRequest('/admin/ngos', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function approveNGO(token, ngoId) {
  return apiRequest(`/admin/ngo/${ngoId}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function rejectNGO(token, ngoId, reason) {
  return apiRequest(`/admin/ngo/${ngoId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { reason },
  })
}

export function getAdminVendors(token) {
  return apiRequest('/admin/vendors', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function approveVendor(token, vendorId, campaignId) {
  return apiRequest(`/admin/vendor/${vendorId}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: campaignId ? { campaignId } : {},
  })
}

export function rejectVendor(token, vendorId, reason) {
  return apiRequest(`/admin/vendor/${vendorId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { reason },
  })
}

export function getAdminCampaignDetail(token, campaignId) {
  return apiRequest(`/admin/campaign/${campaignId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function getAdminCampaigns(token) {
  return apiRequest('/admin/campaigns', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function approveCampaign(token, campaignId) {
  return apiRequest(`/admin/campaign/${campaignId}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function rejectCampaign(token, campaignId, reason) {
  return apiRequest(`/admin/campaign/${campaignId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { reason },
  })
}

export function unfreezeCampaign(token, campaignId) {
  return apiRequest(`/admin/campaign/${campaignId}/unfreeze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// ── New functions for Dashboard, Alerts, Evidence Reviews, Audit pages ──

export function getAdminAlerts(token) {
  return apiRequest('/admin/alerts', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function getAdminEvidence(token) {
  return apiRequest('/admin/evidence/pending', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function approveDisbursement(token, evidenceId) {
  return apiRequest('/disbursement/approve', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { evidenceId },
  })
}

export function rejectDisbursement(token, evidenceId, reason) {
  return apiRequest('/disbursement/reject', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { evidenceId, reason },
  })
}
