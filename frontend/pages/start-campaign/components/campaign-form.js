export function createCampaignForm() {
  const form = document.createElement('form')
  form.className = 'start-campaign-form'
  form.noValidate = true
  form.innerHTML = `
    <header class="start-campaign-header">
      <h1>Start a New Campaign</h1>
      <p>
        Fuel your mission with transparency. Fill in the details below to launch your next
        social impact initiative on the blockchain-backed DonorLedger platform.
      </p>
    </header>

    <section class="start-campaign-section">
      <h2><span aria-hidden="true"></span>1. Campaign Basics</h2>
      <div class="start-campaign-stack">
        <label class="field">
          <span>Campaign Title</span>
          <input name="name" type="text" placeholder="e.g. Clean Water Initiative 2024" required />
        </label>
        <label class="field">
          <span>Cause Type / Category</span>
          <select name="causeType" required>
            <option value="">Select Category</option>
            <option value="Poverty Alleviation">Poverty Alleviation</option>
            <option value="Disaster Relief">Disaster Relief</option>
            <option value="Food Aid">Food Aid</option>
            <option value="Medical Aid">Medical Aid</option>
            <option value="Education">Education</option>
            <option value="Community Development">Community Development</option>
          </select>
        </label>
        <label class="field">
          <span>Detailed Description</span>
          <textarea
            name="description"
            rows="6"
            placeholder="Tell the heart-moving story of why this campaign exists..."
            required
          ></textarea>
        </label>
      </div>
    </section>

    <section class="start-campaign-section">
      <h2><span aria-hidden="true"></span>2. Financial Goals</h2>
      <div class="start-campaign-financial-row">
        <label class="field">
          <span>Target Amount (RM)</span>
          <input name="targetAmount" type="number" min="1" placeholder="e.g. 100,000" required />
        </label>
        <label class="field">
          <span>Campaign End Date</span>
          <input name="endDate" type="date" required />
        </label>
      </div>
    </section>

    <section class="start-campaign-section">
      <h2><span aria-hidden="true"></span>3. Vendors</h2>
      <div data-vendors-slot></div>
    </section>

    <section class="start-campaign-section start-campaign-allocation-section">
      <h2><span aria-hidden="true"></span>4. Fund Allocation</h2>
      <div class="start-campaign-allocation">
        <label class="field">
          <span>Direct Aid %</span>
          <input name="aidPercent" type="number" value="80" min="0" max="100" />
        </label>
        <label class="field">
          <span>Logistics %</span>
          <input name="logisticsPercent" type="number" value="10" min="0" max="100" />
        </label>
        <label class="field">
          <span>Admin %</span>
          <input name="adminPercent" type="number" value="10" min="0" max="100" />
        </label>
      </div>
      <p class="start-campaign-total">
        Total Allocation: <strong data-allocation-total>100% / 100%</strong>
      </p>
    </section>

    <section class="transparency-tips">
      <h2><span aria-hidden="true"></span>Transparency Tips</h2>
      <p><span aria-hidden="true"></span>Clear budgets and vendor choices help Bank Islam review your campaign faster.</p>
      <p><span aria-hidden="true"></span>Keep all evidence ready before submitting disbursement requests later.</p>
    </section>

    <button class="start-campaign-submit" type="submit">Submit for Bank Review</button>
    <a class="start-campaign-exit" href="./my-campaigns.html">Save Draft &amp; Exit</a>
    <div class="form-status" role="status" aria-live="polite"></div>
    <p class="start-campaign-terms">
      By submitting, you agree to DonorLedger's
      <a href="#terms">Institutional Integrity Terms</a>.
    </p>
  `
  return form
}

export function getCampaignPayload(form) {
  const formData = new FormData(form)
  return {
    name: String(formData.get('name') || '').trim(),
    causeType: String(formData.get('causeType') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    targetAmount: Number(formData.get('targetAmount') || 0),
    endDate: String(formData.get('endDate') || '').trim(),
    vendorId: String(formData.get('vendorId') || '').trim(),
    aidPercent: Number(formData.get('aidPercent') || 0),
    logisticsPercent: Number(formData.get('logisticsPercent') || 0),
    adminPercent: Number(formData.get('adminPercent') || 0),
  }
}

export function fillCampaignForm(form, campaign) {
  setValue(form, 'name', campaign.name)
  setValue(form, 'causeType', campaign.causeType)
  setValue(form, 'description', campaign.description)
  setValue(form, 'targetAmount', campaign.targetAmount)
  setValue(form, 'endDate', formatDateInput(campaign.endDate))
  setValue(form, 'aidPercent', campaign.aidPercent)
  setValue(form, 'logisticsPercent', campaign.logisticsPercent)
  setValue(form, 'adminPercent', campaign.adminPercent)
}

export function bindAllocationTotal(form) {
  const inputs = [
    form.querySelector('input[name="aidPercent"]'),
    form.querySelector('input[name="logisticsPercent"]'),
    form.querySelector('input[name="adminPercent"]'),
  ].filter(Boolean)
  const totalElement = form.querySelector('[data-allocation-total]')

  const update = () => {
    const total = getAllocationTotal(inputs)
    totalElement.textContent = `${total}% / 100%`
    totalElement.classList.toggle('is-invalid', total !== 100)
  }

  inputs.forEach((input) => input.addEventListener('input', update))
  update()
}

function setValue(form, name, value) {
  const field = form.elements.namedItem(name)
  if (field && value !== undefined && value !== null) {
    field.value = value
  }
}

function formatDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function getAllocationTotal(inputs) {
  return inputs.reduce((sum, input) => sum + Number(input.value || 0), 0)
}
