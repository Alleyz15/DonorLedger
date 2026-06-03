import { renderAppShell } from '../../components/layout/app-shell.js'
import { setFormStatus } from '../../components/form-status.js'
import {
  createNGOCampaign,
  updateNGOCampaignDraft,
  saveNGOCampaignDraft,
  getApprovedVendors,
  getNGOCampaign,
} from '../../services/campaign-service.js'
import { getSession } from '../../services/auth-service.js'
import { validateCampaignForm } from '../../validation/campaign-validation.js'
import {
  bindAllocationTotal,
  createCampaignForm,
  fillCampaignForm,
  getCampaignPayload,
} from './components/campaign-form.js'
import {
  createVendorsPanel,
  renderVendors,
  renderVendorsError,
} from './components/vendors-panel.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const query = new URLSearchParams(window.location.search)
const campaignId = query.get('campaignId')
const canViewNGOPage = session?.token && ['ORGANIZER', 'NGO'].includes(session.role)

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewNGOPage) {
  renderAccessDenied()
} else {
  renderStartCampaignPage()
}

function renderStartCampaignPage() {
  const form = createCampaignForm()
  const vendorsPanel = createVendorsPanel()
  form.querySelector('[data-vendors-slot]')?.append(vendorsPanel)
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'my-campaigns',
    content: form,
  })

  bindAllocationTotal(form)
  loadApprovedVendors(vendorsPanel)
  loadCampaignForEdit(form)
  form.addEventListener('submit', (event) => submitCampaign(event, form))

  const exitButton = form.querySelector('.start-campaign-exit')
  exitButton?.addEventListener('click', () => saveDraft(form))
}

async function loadCampaignForEdit(form) {
  if (!campaignId) return

  const statusElement = form.querySelector('.form-status')
  const submitButton = form.querySelector('.start-campaign-submit')

  try {
    setFormStatus(statusElement, 'Loading campaign...', 'loading')
    const campaign = await getNGOCampaign(session.token, campaignId)
    fillCampaignForm(form, campaign)
    setFormStatus(statusElement, '', 'idle')
  } catch (error) {
    setFormStatus(statusElement, error.message, 'error')
  }
}

async function loadApprovedVendors(vendorsPanel) {
  try {
    const vendors = await getApprovedVendors(session.token)
    renderVendors(vendorsPanel, vendors)
  } catch (error) {
    renderVendorsError(vendorsPanel, error.message)
  }
}

async function submitCampaign(event, form) {
  event.preventDefault()

  const submitButton = form.querySelector('.start-campaign-submit')
  const statusElement = form.querySelector('.form-status')
  const payload = getCampaignPayload(form)
  const validationMessage = validateCampaignForm(payload)

  if (validationMessage) {
    setFormStatus(statusElement, validationMessage, 'error')
    return
  }

  submitButton.disabled = true
  submitButton.textContent = 'Submitting...'
  setFormStatus(statusElement, 'Submitting campaign application...', 'loading')

  try {
    if (campaignId) {
      await updateNGOCampaignDraft(session.token, campaignId, { ...payload, submit: true })
    } else {
      await createNGOCampaign(session.token, payload)
    }
    setFormStatus(statusElement, 'Campaign submitted. Redirecting...', 'success')
    window.setTimeout(() => {
      window.location.href = './my-campaigns.html'
    }, 900)
  } catch (error) {
    setFormStatus(statusElement, error.message, 'error')
  } finally {
    submitButton.disabled = false
    submitButton.textContent = 'Submit for Bank Review'
  }
}

async function saveDraft(form) {
  const exitButton = form.querySelector('.start-campaign-exit')
  const statusElement = form.querySelector('.form-status')
  const payload = getCampaignPayload(form)

  if (!payload.name || payload.name.length < 2) {
    setFormStatus(statusElement, 'Enter a campaign title to save a draft.', 'error')
    return
  }

  exitButton.disabled = true
  exitButton.textContent = 'Saving...'
  setFormStatus(statusElement, 'Saving draft...', 'loading')

  try {
    if (campaignId) {
      await updateNGOCampaignDraft(session.token, campaignId, payload)
    } else {
      await saveNGOCampaignDraft(session.token, payload)
    }
    setFormStatus(statusElement, 'Draft saved. Redirecting...', 'success')
    window.setTimeout(() => { window.location.href = './my-campaigns.html' }, 800)
  } catch (error) {
    setFormStatus(statusElement, error.message, 'error')
    exitButton.disabled = false
    exitButton.textContent = 'Save Draft & Exit'
  }
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'start-campaign-form'
  panel.innerHTML = '<p class="vendors-empty">This page is only available for NGO accounts.</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'my-campaigns',
    content: panel,
  })
}
