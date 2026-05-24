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

function renderReceipt(receipt, donation) {
  return `
    <section class="donor-receipt-card" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <button class="donor-receipt-close" type="button" data-close-receipt aria-label="Close receipt">×</button>
      <p class="donor-receipt-kicker">Verified Donation Receipt</p>
      <h2 id="receipt-title">${escapeHtml(receipt.campaign.name)}</h2>
      <p class="donor-receipt-muted">
        This receipt confirms your donation was recorded in DonorLedger's audit trail.
      </p>

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
          <dt>Date Received</dt>
          <dd>${escapeHtml(receipt.yourDonation.date)}</dd>
        </div>
        <div>
          <dt>Campaign Status</dt>
          <dd>${escapeHtml(receipt.campaign.status)}</dd>
        </div>
        <div>
          <dt>Vendor Choice</dt>
          <dd>${escapeHtml(receipt.yourDonation.vendor || 'Not earmarked')}</dd>
        </div>
      </dl>

      <section class="donor-receipt-proof">
        <h3>Blockchain Proof</h3>
        <p>
          DonorLedger does not expose your email on-chain. Your donation is linked to this anonymous donor hash.
        </p>
        <code>${escapeHtml(receipt.donorHash)}</code>
        <p class="donor-receipt-tx">Transaction: ${escapeHtml(formatHash(donation?.txHash))}</p>
      </section>

      <section class="donor-receipt-journey">
        <h3>Donation Journey</h3>
        ${receipt.journey.map(renderJourneyItem).join('')}
      </section>

      <footer class="donor-receipt-actions">
        <a href="${API_BASE_URL}/tracker/${encodeURIComponent(receipt.donorHash)}" target="_blank" rel="noreferrer">
          Open Raw Audit JSON
        </a>
        <button type="button" data-close-receipt>Close</button>
      </footer>
    </section>
  `
}

function renderJourneyItem(item) {
  return `
    <article>
      <strong>${escapeHtml(item.milestone)}</strong>
      <p>${escapeHtml(item.description)}</p>
      <span>${escapeHtml(item.at)}</span>
    </article>
  `
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
