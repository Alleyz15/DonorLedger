import { renderAppShell } from '../../components/layout/app-shell.js'
import { getSession } from '../../services/auth-service.js'
import { getDonationHistory } from '../../services/donation-service.js'
import { API_BASE_URL } from '../../config/api-config.js'

const session = getSession()
const shell = document.querySelector('#app-shell')
const canViewDonorPage = session?.token && session.role === 'DONOR'
let donationHistory = null

if (!session?.token) {
  window.location.href = './login.html'
} else if (!canViewDonorPage) {
  renderAccessDenied()
} else {
  renderDonorHistoryPage()
}

function renderDonorHistoryPage() {
  const content = document.createElement('div')
  content.className = 'donor-history-page'
  content.innerHTML = `
    <header class="donor-history-heading">
      <h1>Donation Impact Summary</h1>
      <p>Track your contribution to global social change and institutional growth.</p>
    </header>
    <section class="donor-history-summary" data-history-summary>
      ${renderSummaryLoading()}
    </section>
    <section class="donor-ledger-card">
      <div class="donor-ledger-header">
        <h2>Donation Ledger</h2>
        <button class="donor-export-button" type="button">Export Statement</button>
      </div>
      <div class="donor-ledger-table-wrap">
        <table class="donor-ledger-table">
          <thead>
            <tr>
              <th>Event / Campaign</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody data-history-rows>
            <tr><td colspan="4">Loading donation history...</td></tr>
          </tbody>
        </table>
      </div>
      <footer class="donor-ledger-footer" data-history-footer></footer>
    </section>
    <div class="donor-receipt-modal" data-receipt-modal hidden></div>
  `

  renderAppShell({
    mount: shell,
    session,
    activeKey: 'donor-history',
    searchPlaceholder: 'Search transactions...',
    showUserChevron: true,
    content,
  })

  loadHistory(content)
}

async function loadHistory(content) {
  const donorEmail = session?.user?.email
  const summary = content.querySelector('[data-history-summary]')
  const rows = content.querySelector('[data-history-rows]')
  const footer = content.querySelector('[data-history-footer]')

  try {
    donationHistory = await getDonationHistory(donorEmail)
    summary.innerHTML = renderSummary(donationHistory.summary)
    rows.innerHTML = renderRows(donationHistory.donations)
    footer.innerHTML = renderFooter(donationHistory.donations.length)
    content.addEventListener('click', handleReceiptClick)
  } catch (error) {
    summary.innerHTML = renderSummary({ totalAmount: 0, charitiesSupported: 0, donationDiversity: [] })
    rows.innerHTML = `<tr><td class="donor-history-error" colspan="4">${escapeHtml(error.message)}</td></tr>`
    footer.innerHTML = ''
  }
}

function renderSummaryLoading() {
  return `
    <article class="donor-history-card"><span></span><p>Total Amount Donated</p><strong>Loading...</strong></article>
    <article class="donor-history-card"><span></span><p>Total Charities Supported</p><strong>Loading...</strong></article>
    <article class="donor-history-card"><span></span><p>Donation Diversity</p><strong>Loading...</strong></article>
  `
}

function renderSummary(summary) {
  const diversity = summary.donationDiversity?.length
    ? summary.donationDiversity.slice(0, 3)
    : ['No donations yet']

  return `
    <article class="donor-history-card">
      <span aria-hidden="true"></span>
      <p>Total Amount Donated</p>
      <strong>${formatMoney(summary.totalAmount || 0)}</strong>
    </article>
    <article class="donor-history-card">
      <span aria-hidden="true"></span>
      <p>Total Charities Supported</p>
      <strong>${formatNumber(summary.charitiesSupported || 0)} Organizations</strong>
    </article>
    <article class="donor-history-card">
      <span aria-hidden="true"></span>
      <p>Donation Diversity</p>
      <div class="donor-diversity-tags">
        ${diversity.map((item) => `<em>${escapeHtml(formatCause(item))}</em>`).join('')}
      </div>
    </article>
  `
}

function renderRows(donations) {
  if (!donations.length) {
    return '<tr><td colspan="4">No donations recorded yet.</td></tr>'
  }

  return donations
    .map((donation) => `
      <tr>
        <td>
          <strong>${escapeHtml(donation.campaignName)}</strong>
          <span>${escapeHtml(formatCause(donation.causeType))}</span>
        </td>
        <td>${formatDate(donation.createdAt)}</td>
        <td>${formatMoney(donation.amount)}</td>
        <td>
          <button class="donor-receipt-button" type="button" data-donor-hash="${escapeHtml(donation.donorHash || '')}">
            View Receipt
          </button>
          <span class="donor-chain-proof">On-chain: ${escapeHtml(formatHash(donation.txHash))}</span>
        </td>
      </tr>
    `)
    .join('')
}

async function handleReceiptClick(event) {
  const receiptButton = event.target.closest('[data-donor-hash]')
  if (receiptButton) {
    await openReceiptModal(receiptButton.dataset.donorHash)
    return
  }

  if (
    event.target.matches('[data-close-receipt]') ||
    event.target.classList.contains('donor-receipt-modal')
  ) {
    closeReceiptModal()
  }
}

async function openReceiptModal(donorHash) {
  const modal = document.querySelector('[data-receipt-modal]')
  if (!modal || !donorHash) return

  modal.hidden = false
  modal.innerHTML = `
    <section class="donor-receipt-card" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <button class="donor-receipt-close" type="button" data-close-receipt aria-label="Close receipt">×</button>
      <p class="donor-receipt-kicker">Verified Donation Receipt</p>
      <h2 id="receipt-title">Loading receipt...</h2>
      <p class="donor-receipt-muted">Reading the donor tracker audit record.</p>
    </section>
  `

  try {
    const response = await fetch(`${API_BASE_URL}/tracker/${encodeURIComponent(donorHash)}`)
    const receipt = await response.json()
    if (!response.ok) {
      throw new Error(receipt?.error || 'Receipt could not be loaded.')
    }

    const donation = donationHistory?.donations?.find((item) => item.donorHash === donorHash)
    modal.innerHTML = renderReceipt(receipt, donation)
  } catch (error) {
    modal.innerHTML = `
      <section class="donor-receipt-card" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <button class="donor-receipt-close" type="button" data-close-receipt aria-label="Close receipt">×</button>
        <p class="donor-receipt-kicker">Verified Donation Receipt</p>
        <h2 id="receipt-title">Receipt unavailable</h2>
        <p class="donor-receipt-muted">${escapeHtml(error.message)}</p>
      </section>
    `
  }
}

function closeReceiptModal() {
  const modal = document.querySelector('[data-receipt-modal]')
  if (!modal) return
  modal.hidden = true
  modal.innerHTML = ''
}

// ---------------------------------------------------------------------------
// Receipt — complete blockchain journey visual
//
// Shows the full money flow that is architecturally impossible to fake:
//   Donor → Bank Islam Escrow → NGO Evidence → Vendor Release → Beneficiary
//
// Each stage maps to a real on-chain event in DonorTracker.sol.
// Milestones not yet reached are shown as "pending" so the donor can see
// exactly where in the pipeline their money sits right now.
// ---------------------------------------------------------------------------

function renderReceipt(receipt, donation) {
  const statusMeta = getCampaignStatusMeta(receipt.campaign.status)

  return `
    <section class="donor-receipt-card" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <button class="donor-receipt-close" type="button" data-close-receipt aria-label="Close receipt">×</button>

      <p class="donor-receipt-kicker">Verified Donation Receipt</p>
      <h2 id="receipt-title">${escapeHtml(receipt.campaign.name)}</h2>
      <p class="donor-receipt-muted">
        Your donation is anchored on the Ethereum Sepolia blockchain.
        Every step below was written by Bank Islam's cryptographic signature — nobody can alter it.
      </p>

      <!-- Core donation details -->
      <dl class="donor-receipt-grid">
        <div>
          <dt>NGO</dt>
          <dd>${escapeHtml(receipt.campaign.ngo)}</dd>
        </div>
        <div>
          <dt>Cause</dt>
          <dd>${escapeHtml(formatCause(receipt.campaign.cause))}</dd>
        </div>
        <div>
          <dt>Your Donation</dt>
          <dd>${escapeHtml(receipt.yourDonation.amountFormatted)}</dd>
        </div>
        <div>
          <dt>Paid On</dt>
          <dd>${escapeHtml(receipt.yourDonation.date)}</dd>
        </div>
        <div>
          <dt>Campaign Status</dt>
          <dd>
            <span style="display:inline-flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${statusMeta.color};flex-shrink:0"></span>
              ${escapeHtml(statusMeta.label)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Earmarked For</dt>
          <dd>${escapeHtml(receipt.yourDonation.vendor || 'General Aid Fund')}</dd>
        </div>
      </dl>

      <!-- ── Blockchain Flow Diagram ── -->
      <section class="donor-receipt-flow">
        <h3>Complete Blockchain Journey</h3>
        <p class="donor-receipt-flow-sub">
          Follow your ${escapeHtml(receipt.yourDonation.amountFormatted)} from your phone to the final beneficiary.
        </p>
        <div class="donor-receipt-flow-steps">
          ${renderFlowStep(receipt, 'RECEIVED',    '1', 'You', 'Paid via DuitNow', 'Your payment was received by Bank Islam.')}
          ${renderFlowConnector(receipt, 'RECEIVED')}
          ${renderFlowStep(receipt, 'ALLOCATED',   '2', 'Bank Islam', 'Escrow Locked', 'Bank Islam locked your funds in the smart contract. Allocation rules are now immutable.')}
          ${renderFlowConnector(receipt, 'ALLOCATED')}
          ${renderFlowStep(receipt, 'RELEASED',    '3', 'NGO → Vendor', 'Funds Released', 'NGO submitted verified evidence. Bank Islam approved and released funds directly to the vendor.')}
          ${renderFlowConnector(receipt, 'RELEASED')}
          ${renderFlowStep(receipt, 'CONFIRMED',   '4', 'Beneficiary', 'Delivery Confirmed', 'Bank Islam received independent confirmation from the beneficiary that aid was delivered.')}
          ${renderFlowConnector(receipt, 'CONFIRMED')}
          ${renderFlowStep(receipt, 'COMPLETED',   '5', 'Complete', 'Full Cycle Done', 'Your donation completed the full accountability loop. Impact verified on-chain.')}
        </div>
      </section>

      <!-- ── Blockchain Proof ── -->
      <section class="donor-receipt-proof">
        <h3>Blockchain Proof</h3>
        <p>
          Your identity is never stored on-chain. Your donation is anonymously
          linked to this unique hash generated from your email + campaign + timestamp.
        </p>
        <code>${escapeHtml(receipt.donorHash)}</code>
        <p class="donor-receipt-tx">
          On-chain transaction:
          <strong>${escapeHtml(formatHash(donation?.txHash))}</strong>
          ${donation?.txHash
            ? `<a href="https://sepolia.etherscan.io/tx/${encodeURIComponent(donation.txHash)}"
                 target="_blank" rel="noreferrer"
                 style="margin-left:8px;color:#10b981;font-size:11px;font-weight:800">
                 View on Etherscan ↗
               </a>`
            : ''}
        </p>
      </section>

      <footer class="donor-receipt-actions">
        <a href="${API_BASE_URL}/tracker/${encodeURIComponent(receipt.donorHash)}" target="_blank" rel="noreferrer">
          Open Audit JSON
        </a>
        <button type="button" data-close-receipt>Close</button>
      </footer>
    </section>
  `
}

/**
 * Renders one step in the Donor → Bank → NGO → Vendor → Beneficiary flow.
 * Checks if this milestone exists in the journey array to mark it done/pending.
 */
function renderFlowStep(receipt, milestone, stepNum, actor, title, description) {
  const reached = receipt.journey.find((j) => j.milestone === milestone)
  const isFrozen = receipt.campaign.status === 'FROZEN' || receipt.campaign.status === 'UNDER_REVIEW'
  const isUnderReview = receipt.journey.find((j) => j.milestone === 'UNDER_REVIEW')

  let state = 'pending'
  if (reached) state = 'done'
  // Only show frozen/amber if the campaign is CURRENTLY frozen AND
  // UNDER_REVIEW is in the journey. Once Bank Islam unfreezes the campaign
  // (status back to ACTIVE), steps revert to pending so the donor knows
  // things are moving again — even though the on-chain UNDER_REVIEW entry
  // is permanent (blockchain immutability is the point).
  if (!reached && isFrozen && isUnderReview && ['RELEASED', 'CONFIRMED', 'COMPLETED'].includes(milestone)) {
    state = 'frozen'
  }

  const stateClass = state === 'done' ? 'is-done'
    : state === 'frozen' ? 'is-frozen' : 'is-pending'

  const icon = state === 'done' ? '✓'
    : state === 'frozen' ? '⏸' : stepNum

  return `
    <div class="donor-flow-step ${stateClass}">
      <div class="donor-flow-step-icon">${escapeHtml(icon)}</div>
      <div class="donor-flow-step-body">
        <span class="donor-flow-step-actor">${escapeHtml(actor)}</span>
        <strong class="donor-flow-step-title">${escapeHtml(title)}</strong>
        <p class="donor-flow-step-desc">${escapeHtml(reached ? reached.description : description)}</p>
        ${reached ? `<span class="donor-flow-step-time">${escapeHtml(reached.at)}</span>` : ''}
        ${state === 'frozen' ? '<span class="donor-flow-step-frozen">⚠ Paused — under Bank Islam review</span>' : ''}
      </div>
    </div>
  `
}

function renderFlowConnector(receipt, afterMilestone) {
  const reached = receipt.journey.find((j) => j.milestone === afterMilestone)
  return `<div class="donor-flow-connector ${reached ? 'is-done' : 'is-pending'}"></div>`
}

function getCampaignStatusMeta(status) {
  if (status === 'ACTIVE')       return { label: 'Active',       color: '#10b981' }
  if (status === 'COMPLETED')    return { label: 'Completed',    color: '#3b82f6' }
  if (status === 'FROZEN')       return { label: 'Under Review', color: '#f59e0b' }
  if (status === 'UNDER_REVIEW') return { label: 'Under Review', color: '#f59e0b' }
  if (status === 'DRAFT')        return { label: 'Pending',      color: '#94a3b8' }
  return { label: status || '—', color: '#94a3b8' }
}

function formatHash(value) {
  if (!value) return 'Pending'
  const text = String(value)
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text
}

function renderFooter(count) {
  return `
    <span>Showing ${Math.min(count, 4)} of ${formatNumber(count)} transactions</span>
    <nav class="donor-history-pages" aria-label="History pages">
      <button type="button" disabled>Previous</button>
      <button class="is-active" type="button">1</button>
      <button type="button">2</button>
      <button type="button">3</button>
      <button type="button">Next</button>
    </nav>
  `
}

function renderAccessDenied() {
  const panel = document.createElement('section')
  panel.className = 'donor-history-page'
  panel.innerHTML = '<p class="donor-empty-state">This page is only available for donor accounts.</p>'
  renderAppShell({
    mount: shell,
    session,
    activeKey: 'donor-history',
    content: panel,
  })
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-MY', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(Number(value || 0))
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-MY').format(Number(value || 0))
}

function formatCause(value) {
  return String(value || 'General Aid')
    .replaceAll('_', ' ')
    .replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
