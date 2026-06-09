import { apiRequest } from './api-client.js'
import { API_BASE_URL } from '../config/api-config.js'

const FILES_BASE_URL = API_BASE_URL.replace(/\/api$/, '')

export async function getNGOEvidence(token) {
  const evidenceItems = await apiRequest('/ngo/evidence', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return evidenceItems.map(normalizeEvidence)
}

export async function getNGOEvidenceDetail(token, evidenceId) {
  const evidence = await apiRequest(`/ngo/evidence/${encodeURIComponent(evidenceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return normalizeEvidence(evidence)
}

function normalizeEvidence(evidence) {
  return {
    ...evidence,
    documents: Array.isArray(evidence.documents)
      ? evidence.documents.map((document) => ({
          ...document,
          url: normalizeDocumentUrl(document.url),
        }))
      : [],
  }
}

function normalizeDocumentUrl(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  return `${FILES_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}
